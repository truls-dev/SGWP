
const KEYBOARD_CLICK_URL = "https://raw.githubusercontent.com/truls-dev/sounds/main/tock2.wav";
const NOTIFICATION_SOUND_URL = "https://raw.githubusercontent.com/truls-dev/sounds/main/snapnotif.wav";
const BACKSPACE_SOUND_URL = "https://raw.githubusercontent.com/truls-dev/sounds/main/key_press_modifier.wav";

const SOUND_EFFECTS: Record<string, string> = {
  Bruh: "https://raw.githubusercontent.com/truls-dev/sounds/main/bruh.wav",
  Crickets: "https://raw.githubusercontent.com/truls-dev/sounds/main/crickets.wav",
  Rizz: "https://raw.githubusercontent.com/truls-dev/sounds/main/rizz.wav",
  Shocked: "https://raw.githubusercontent.com/truls-dev/sounds/main/shocked.wav",
  Shocking: "https://raw.githubusercontent.com/truls-dev/sounds/main/shocking.wav",
};

export interface SoundEvent {
  type: 'click' | 'notification' | 'backspace' | 'effect';
  timeMs: number;
  volume: number;
  effectName?: string;
}

class SoundService {
  private audioCtx: AudioContext | null = null;
  private clickBuffer: AudioBuffer | null = null;
  private notificationBuffer: AudioBuffer | null = null;
  private backspaceBuffer: AudioBuffer | null = null;
  private effectBuffers: Map<string, AudioBuffer> = new Map();
  private streamDestination: MediaStreamAudioDestinationNode | null = null;
  private masterGain: GainNode | null = null;
  private recordingDelayNode: DelayNode | null = null;
  private keepAliveOsc: OscillatorNode | null = null;
  private isLoading: boolean = false;

  private _isRecordingMode = false;
  private _recordingStartTime = 0;
  private _soundLog: SoundEvent[] = [];

  public async init() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      return;
    }

    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    
    const ctx: AudioContext = new AudioContextClass({ 
        sampleRate: 48000,
        latencyHint: 'playback'
    });
    this.audioCtx = ctx;
    
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 1.0;

    this.masterGain.connect(ctx.destination);

    this.recordingDelayNode = ctx.createDelay(2.0);
    this.recordingDelayNode.delayTime.value = 0;
    
    this.streamDestination = ctx.createMediaStreamDestination();
    
    this.masterGain.connect(this.recordingDelayNode);
    this.recordingDelayNode.connect(this.streamDestination);

    const silenceGain = ctx.createGain();
    silenceGain.gain.value = 0.0001; 
    this.keepAliveOsc = ctx.createOscillator();
    this.keepAliveOsc.connect(silenceGain);
    silenceGain.connect(this.streamDestination);
    this.keepAliveOsc.start();

    await this.loadBuffers();
  }

  private async loadBuffers() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const fetchAndDecode = async (url: string) => {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        return await this.audioCtx!.decodeAudioData(arr);
      };

      const [click, notif, backspace] = await Promise.all([
        fetchAndDecode(KEYBOARD_CLICK_URL),
        fetchAndDecode(NOTIFICATION_SOUND_URL),
        fetchAndDecode(BACKSPACE_SOUND_URL)
      ]);

      this.clickBuffer = click;
      this.notificationBuffer = notif;
      this.backspaceBuffer = backspace;

      const effectEntries = Object.entries(SOUND_EFFECTS);
      const decodedEffects = await Promise.all(
        effectEntries.map(([_, url]) => fetchAndDecode(url))
      );

      effectEntries.forEach(([name, _], index) => {
        this.effectBuffers.set(name, decodedEffects[index]);
      });

    } catch (e) {
      console.error("SoundService: Failed to load audio assets", e);
    } finally {
      this.isLoading = false;
    }
  }

  public async prepare() {
    await this.init();
    if (!this.clickBuffer || !this.notificationBuffer || !this.backspaceBuffer || this.effectBuffers.size === 0) {
      await this.loadBuffers();
    }
  }

  public setRecordingSyncDelay(seconds: number) {
    if (this.recordingDelayNode) {
      this.recordingDelayNode.delayTime.setTargetAtTime(seconds, this.audioCtx?.currentTime || 0, 0.02);
    }
  }

  public getStream(): MediaStream | null {
    return this.streamDestination ? this.streamDestination.stream : null;
  }

  public startRecordingMode() {
    this._isRecordingMode = true;
    this._recordingStartTime = performance.now();
    this._soundLog = [];
  }

  public resetRecordingStartTime() {
    this._recordingStartTime = performance.now();
    this._soundLog = [];
  }

  public stopRecordingMode(): SoundEvent[] {
    this._isRecordingMode = false;
    const log = this._soundLog;
    this._soundLog = [];
    return log;
  }

  private logEvent(type: SoundEvent['type'], volume: number, effectName?: string) {
    if (!this._isRecordingMode) return;
    const timeMs = performance.now() - this._recordingStartTime;
    this._soundLog.push({ type, timeMs, volume, effectName });
  }

  public playClick() {
    this.logEvent('click', 0.85);
    this.playSound(this.clickBuffer, 0.85);
  }

  public playNotification() {
    this.logEvent('notification', 0.9);
    this.playSound(this.notificationBuffer, 0.9);
  }

  public playBackspace() {
    this.logEvent('backspace', 0.9);
    this.playSound(this.backspaceBuffer, 0.9);
  }

  public async playEffect(name?: string): Promise<void> {
    if (!name) return Promise.resolve();
    this.logEvent('effect', 1.0, name);
    
    return new Promise((resolve) => {
      const buffer = this.effectBuffers.get(name);
      if (!this.audioCtx || !buffer || !this.masterGain) {
        resolve();
        return;
      }

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      
      const gain = this.audioCtx.createGain();
      gain.gain.value = 1.0;
      
      source.connect(gain);
      gain.connect(this.masterGain);
      
      source.onended = () => {
        resolve();
      };
      
      source.start(0);
    });
  }

  private getBufferForEvent(event: SoundEvent): AudioBuffer | null {
    switch (event.type) {
      case 'click': return this.clickBuffer;
      case 'notification': return this.notificationBuffer;
      case 'backspace': return this.backspaceBuffer;
      case 'effect': return event.effectName ? (this.effectBuffers.get(event.effectName) || null) : null;
      default: return null;
    }
  }

  public async renderOffline(events: SoundEvent[], durationMs: number): Promise<AudioBuffer> {
    const sampleRate = 48000;
    const channels = 2;

    let maxEndMs = durationMs;
    for (const event of events) {
      const buf = this.getBufferForEvent(event);
      if (buf) {
        const eventEndMs = event.timeMs + (buf.duration * 1000);
        if (eventEndMs > maxEndMs) maxEndMs = eventEndMs;
      }
    }
    const durationSec = (maxEndMs + 200) / 1000;
    const totalSamples = Math.ceil(durationSec * sampleRate);

    const offlineCtx = new OfflineAudioContext(channels, totalSamples, sampleRate);
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(offlineCtx.destination);

    for (const event of events) {
      const srcBuffer = this.getBufferForEvent(event);
      if (!srcBuffer) continue;

      const resampled = this.resampleBuffer(offlineCtx, srcBuffer);
      const source = offlineCtx.createBufferSource();
      source.buffer = resampled;

      const gain = offlineCtx.createGain();
      gain.gain.value = event.volume;

      source.connect(gain);
      gain.connect(masterGain);

      const startTimeSec = Math.max(0, event.timeMs / 1000);
      source.start(startTimeSec);
    }

    return await offlineCtx.startRendering();
  }

  private resampleBuffer(ctx: OfflineAudioContext, buffer: AudioBuffer): AudioBuffer {
    if (buffer.sampleRate === ctx.sampleRate) return buffer;
    const ratio = buffer.sampleRate / ctx.sampleRate;
    const newLength = Math.round(buffer.length / ratio);
    const newBuffer = ctx.createBuffer(buffer.numberOfChannels, newLength, ctx.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const oldData = buffer.getChannelData(ch);
      const newData = newBuffer.getChannelData(ch);
      for (let i = 0; i < newLength; i++) {
        const srcIdx = i * ratio;
        const idx0 = Math.floor(srcIdx);
        const idx1 = Math.min(idx0 + 1, oldData.length - 1);
        const frac = srcIdx - idx0;
        newData[i] = oldData[idx0] * (1 - frac) + oldData[idx1] * frac;
      }
    }
    return newBuffer;
  }

  private playSound(buffer: AudioBuffer | null, volume: number) {
    if (!this.audioCtx || !buffer || !this.masterGain) return;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    
    const gain = this.audioCtx.createGain();
    gain.gain.value = volume;
    
    source.connect(gain);
    gain.connect(this.masterGain);
    
    source.start(0);
  }
}

export const soundService = new SoundService();
