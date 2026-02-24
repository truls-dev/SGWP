
const KEYBOARD_CLICK_URL = "https://raw.githubusercontent.com/truls-dev/sounds/main/tock2.wav";
const NOTIFICATION_SOUND_URL = "https://raw.githubusercontent.com/truls-dev/sounds/main/snapnotif.wav";
const BACKSPACE_SOUND_URL = "https://raw.githubusercontent.com/truls-dev/sounds/main/key_press_modifier.wav";
const SUBSEQUENT_NOTIF_URL = "https://raw.githubusercontent.com/truls-dev/sounds/main/48ee2b497d30471250b4.mp3";

const SOUND_EFFECTS: Record<string, string> = {
  Bruh: "https://raw.githubusercontent.com/truls-dev/sounds/main/bruh.wav",
  Crickets: "https://raw.githubusercontent.com/truls-dev/sounds/main/crickets.wav",
  Rizz: "https://raw.githubusercontent.com/truls-dev/sounds/main/rizz.wav",
  Shocked: "https://raw.githubusercontent.com/truls-dev/sounds/main/shocked.wav",
  Shocking: "https://raw.githubusercontent.com/truls-dev/sounds/main/shocking.wav",
};

const MUSIC_BASE_URL = "https://raw.githubusercontent.com/truls-dev/music/main/";
const MUSIC_BASE_URL_2 = "https://raw.githubusercontent.com/truls-dev/music2/main/";

export const MUSIC_TRACKS: { name: string; filename: string; baseUrl?: string }[] = [
  { name: "3am Walk", filename: "3am walk.mp3" },
  { name: "As The Light Fades", filename: "As the light fades.mp3" },
  { name: "Bladerunner", filename: "Bladerunner.mp3" },
  { name: "Copyright Free Bad Snacks", filename: "Copyright Free Bad Snacks.mp3", baseUrl: MUSIC_BASE_URL_2 },
  { name: "Dreamscaped", filename: "Copyright Free Dreamscaped.mp3", baseUrl: MUSIC_BASE_URL_2 },
  { name: "Copyright Free Kawaii", filename: "Copyright Free Kawaii.mp3", baseUrl: MUSIC_BASE_URL_2 },
  { name: "Copyright Free PowerUp", filename: "Copyright Free PowerUp.mp3", baseUrl: MUSIC_BASE_URL_2 },
  { name: "Copyright Free South London HiFi", filename: "Copyright Free South London HiFi.mp3", baseUrl: MUSIC_BASE_URL_2 },
  { name: "Copyright Free Telecasted", filename: "Copyright Free Telecasted.mp3", baseUrl: MUSIC_BASE_URL_2 },
  { name: "Copyright Free Tock Time Warp Tick", filename: "Copyright Free Tock Time Warp Tick.mp3", baseUrl: MUSIC_BASE_URL_2 },
  { name: "Exploration Time", filename: "ExplorationTime.mp3" },
  { name: "Fallen Down (Slowed)", filename: "Fallen Down (slowed and reverb).mp3" },
  { name: "Fluffing Duck", filename: "FluffingDuck.mp3" },
  { name: "Green to Blue (Slowed)", filename: "Green to blue (slowed + reverb).mp3" },
  { name: "I Was Only Temporary", filename: "I was only temporary.mp3" },
  { name: "Idea 22", filename: "Idea 22.mp3" },
  { name: "Innovation", filename: "Innovation.mp3" },
  { name: "Investigate", filename: "Investigate.mp3" },
  { name: "Language of Light", filename: "Language of light.mp3" },
  { name: "Let's Go", filename: "Letsgo.mp3" },
  { name: "M83 Solitude", filename: "M83 Solitude.mp3" },
  { name: "Married Life", filename: "MarriedLife.mp3" },
  { name: "Marty Plan", filename: "MartyPlan.mp3" },
  { name: "Milk Cassette", filename: "Milk cassette.mp3" },
  { name: "Morning Coffee", filename: "MorningCoffee.mp3" },
  { name: "On My Way", filename: "OnMyWay.mp3" },
  { name: "Perfectly Drifting", filename: "Perfectly drifting.mp3" },
  { name: "Snowfall", filename: "Snowfall.mp3" },
  { name: "Somethings Not Right", filename: "Somethings not right.mp3" },
  { name: "Stranded", filename: "Stranded.mp3" },
  { name: "Sunset Lover", filename: "SunsetLover.mp3" },
  { name: "Surrender", filename: "Surrender.mp3" },
  { name: "Take Me Back", filename: "Take me back.mp3" },
  { name: "The Long Walk", filename: "TheLongWalk.mp3" },
  { name: "Warm Memories", filename: "Warm Memories.mp3" },
  { name: "Where Is My Mind", filename: "Where is my mind.mp3" },
];

export interface SoundEvent {
  type: 'click' | 'notification' | 'notification_subsequent' | 'backspace' | 'effect';
  timeMs: number;
  volume: number;
  effectName?: string;
}

class SoundService {
  private audioCtx: AudioContext | null = null;
  private clickBuffer: AudioBuffer | null = null;
  private notificationBuffer: AudioBuffer | null = null;
  private subsequentNotifBuffer: AudioBuffer | null = null;
  private backspaceBuffer: AudioBuffer | null = null;
  private effectBuffers: Map<string, AudioBuffer> = new Map();
  private musicBuffers: Map<string, AudioBuffer> = new Map();
  private streamDestination: MediaStreamAudioDestinationNode | null = null;
  private masterGain: GainNode | null = null;
  private recordingDelayNode: DelayNode | null = null;
  private keepAliveOsc: OscillatorNode | null = null;
  private isLoading: boolean = false;
  private _previewSource: AudioBufferSourceNode | null = null;
  private _previewGain: GainNode | null = null;

  private _isRecordingMode = false;
  private _recordingStartTime = 0;
  private _soundLog: SoundEvent[] = [];
  private _sfxVolume = 1.0;

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

      const [click, notif, subNotif, backspace] = await Promise.all([
        fetchAndDecode(KEYBOARD_CLICK_URL),
        fetchAndDecode(NOTIFICATION_SOUND_URL),
        fetchAndDecode(SUBSEQUENT_NOTIF_URL),
        fetchAndDecode(BACKSPACE_SOUND_URL)
      ]);

      this.clickBuffer = click;
      this.notificationBuffer = notif;
      this.subsequentNotifBuffer = subNotif;
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
    if (!this.clickBuffer || !this.notificationBuffer || !this.subsequentNotifBuffer || !this.backspaceBuffer || this.effectBuffers.size === 0) {
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

  public setSfxVolume(volume: number) {
    this._sfxVolume = Math.max(0, Math.min(1, volume));
  }

  public getSfxVolume(): number {
    return this._sfxVolume;
  }

  public playClick() {
    const vol = 0.85 * this._sfxVolume;
    this.logEvent('click', vol);
    this.playSound(this.clickBuffer, vol);
  }

  public playNotification() {
    const vol = 0.9 * this._sfxVolume;
    this.logEvent('notification', vol);
    this.playSound(this.notificationBuffer, vol);
  }

  public playSubsequentNotification() {
    const vol = 0.9 * this._sfxVolume;
    this.logEvent('notification_subsequent', vol);
    this.playSound(this.subsequentNotifBuffer, vol);
  }

  public playBackspace() {
    const vol = 0.9 * this._sfxVolume;
    this.logEvent('backspace', vol);
    this.playSound(this.backspaceBuffer, vol);
  }

  public async playEffect(name?: string): Promise<void> {
    if (!name) return Promise.resolve();
    const vol = 1.0 * this._sfxVolume;
    this.logEvent('effect', vol, name);
    
    return new Promise((resolve) => {
      const buffer = this.effectBuffers.get(name);
      if (!this.audioCtx || !buffer || !this.masterGain) {
        resolve();
        return;
      }

      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      
      const gain = this.audioCtx.createGain();
      gain.gain.value = vol;
      
      source.connect(gain);
      gain.connect(this.masterGain);
      
      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch (_) {}
        resolve();
      };
      
      source.start(0);
    });
  }

  private getBufferForEvent(event: SoundEvent): AudioBuffer | null {
    switch (event.type) {
      case 'click': return this.clickBuffer;
      case 'notification': return this.notificationBuffer;
      case 'notification_subsequent': return this.subsequentNotifBuffer;
      case 'backspace': return this.backspaceBuffer;
      case 'effect': return event.effectName ? (this.effectBuffers.get(event.effectName) || null) : null;
      default: return null;
    }
  }

  public async renderOffline(
    events: SoundEvent[],
    durationMs: number,
    musicFilename?: string,
    musicVolume?: number
  ): Promise<{ left: Float32Array; right: Float32Array; sampleRate: number }> {
    const sampleRate = 48000;

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

    console.log(`[AudioMix] Mixing ${events.length} events over ${durationSec.toFixed(1)}s (${totalSamples} samples)`);

    const outputL = new Float32Array(totalSamples);
    const outputR = new Float32Array(totalSamples);

    const resampleCache = new Map<AudioBuffer, Float32Array[]>();

    const getResampledChannels = (buffer: AudioBuffer): Float32Array[] => {
      if (resampleCache.has(buffer)) return resampleCache.get(buffer)!;

      const chCount = buffer.numberOfChannels;
      if (buffer.sampleRate === sampleRate) {
        const result: Float32Array[] = [];
        for (let ch = 0; ch < chCount; ch++) {
          result.push(new Float32Array(buffer.getChannelData(ch)));
        }
        resampleCache.set(buffer, result);
        return result;
      }

      const ratio = buffer.sampleRate / sampleRate;
      const newLength = Math.round(buffer.length / ratio);
      const result: Float32Array[] = [];
      for (let ch = 0; ch < chCount; ch++) {
        const oldData = buffer.getChannelData(ch);
        const newData = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
          const srcIdx = i * ratio;
          const idx0 = Math.floor(srcIdx);
          const idx1 = Math.min(idx0 + 1, oldData.length - 1);
          const frac = srcIdx - idx0;
          newData[i] = oldData[idx0] * (1 - frac) + oldData[idx1] * frac;
        }
        result.push(newData);
      }
      resampleCache.set(buffer, result);
      return result;
    };

    const mixInto = (
      srcChannels: Float32Array[],
      startSample: number,
      volume: number,
      maxSamples?: number
    ) => {
      const srcLen = srcChannels[0].length;
      const len = maxSamples !== undefined ? Math.min(srcLen, maxSamples) : srcLen;
      const isMono = srcChannels.length === 1;
      const srcL = srcChannels[0];
      const srcR = isMono ? srcL : srcChannels[1];

      const endSample = Math.min(startSample + len, totalSamples);
      for (let i = startSample, si = 0; i < endSample; i++, si++) {
        outputL[i] += srcL[si] * volume;
        outputR[i] += srcR[si] * volume;
      }
    };

    if (musicFilename && musicVolume && musicVolume > 0) {
      const musicBuffer = this.musicBuffers.get(musicFilename);
      if (musicBuffer) {
        console.log(`[AudioMix] Music: ${musicFilename}, vol=${musicVolume}, buffer SR=${musicBuffer.sampleRate}, ch=${musicBuffer.numberOfChannels}`);
        const musicChannels = getResampledChannels(musicBuffer);
        const musicLen = musicChannels[0].length;
        let offset = 0;
        while (offset < totalSamples) {
          const remaining = totalSamples - offset;
          mixInto(musicChannels, offset, musicVolume, remaining);
          offset += musicLen;
        }
      }
    }

    for (const event of events) {
      const srcBuffer = this.getBufferForEvent(event);
      if (!srcBuffer) continue;
      const srcChannels = getResampledChannels(srcBuffer);
      const startSample = Math.max(0, Math.round((event.timeMs / 1000) * sampleRate));
      mixInto(srcChannels, startSample, event.volume);
    }

    for (let i = 0; i < totalSamples; i++) {
      outputL[i] = Math.max(-1.0, Math.min(1.0, outputL[i]));
      outputR[i] = Math.max(-1.0, Math.min(1.0, outputR[i]));
    }

    const checkpoints = [0, 0.25, 0.5, 0.75, 1.0];
    for (const pct of checkpoints) {
      const sampleIdx = Math.min(Math.floor(pct * totalSamples), totalSamples - 1);
      const windowSize = Math.min(4800, totalSamples - sampleIdx);
      let rmsL = 0;
      for (let i = sampleIdx; i < sampleIdx + windowSize; i++) {
        rmsL += outputL[i] * outputL[i];
      }
      rmsL = Math.sqrt(rmsL / windowSize);
      const peakL = Math.max(...Array.from(outputL.subarray(sampleIdx, sampleIdx + windowSize)).map(Math.abs));
      console.log(`[AudioMix] @${(pct * 100).toFixed(0)}% (sample ${sampleIdx}): RMS=${rmsL.toFixed(6)}, Peak=${peakL.toFixed(6)}`);
    }

    resampleCache.clear();

    return { left: outputL, right: outputR, sampleRate };
  }

  public async loadMusicTrack(filename: string): Promise<AudioBuffer | null> {
    if (this.musicBuffers.has(filename)) return this.musicBuffers.get(filename)!;
    await this.init();
    if (!this.audioCtx) return null;
    try {
      const track = MUSIC_TRACKS.find(t => t.filename === filename);
      const base = track?.baseUrl || MUSIC_BASE_URL;
      const url = base + encodeURIComponent(filename);
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buffer = await this.audioCtx.decodeAudioData(arr);
      this.musicBuffers.set(filename, buffer);
      return buffer;
    } catch (e) {
      console.error("Failed to load music track:", filename, e);
      return null;
    }
  }

  public async previewMusic(filename: string, volume: number) {
    this.stopMusicPreview();
    await this.init();
    if (!this.audioCtx) return;
    const buffer = await this.loadMusicTrack(filename);
    if (!buffer) return;

    this._previewSource = this.audioCtx.createBufferSource();
    this._previewSource.buffer = buffer;
    this._previewSource.loop = true;

    this._previewGain = this.audioCtx.createGain();
    this._previewGain.gain.value = volume;

    this._previewSource.connect(this._previewGain);
    this._previewGain.connect(this.audioCtx.destination);
    this._previewSource.start(0);
  }

  public stopMusicPreview() {
    if (this._previewSource) {
      try { this._previewSource.stop(); } catch {}
      this._previewSource.disconnect();
      this._previewSource = null;
    }
    if (this._previewGain) {
      this._previewGain.disconnect();
      this._previewGain = null;
    }
  }

  public setPreviewVolume(volume: number) {
    if (this._previewGain) {
      this._previewGain.gain.value = volume;
    }
  }

  public isPreviewingMusic(): boolean {
    return this._previewSource !== null;
  }

  public getMusicBuffer(filename: string): AudioBuffer | null {
    return this.musicBuffers.get(filename) || null;
  }

  private playSound(buffer: AudioBuffer | null, volume: number) {
    if (!this.audioCtx || !buffer || !this.masterGain) return;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    
    const gain = this.audioCtx.createGain();
    gain.gain.value = volume;
    
    source.connect(gain);
    gain.connect(this.masterGain);
    
    source.onended = () => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch (_) {}
    };
    
    source.start(0);
  }
}

export const soundService = new SoundService();
