
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

  public async init() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      return;
    }

    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    
    // Low latency hint for live feedback, but stable processing for export.
    this.audioCtx = new AudioContextClass({ 
        sampleRate: 48000,
        latencyHint: 'playback'
    });
    
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 1.0;

    // Path A: Physical speakers for live preview
    this.masterGain.connect(this.audioCtx.destination);

    // Path B: Encapsulated stream for the MediaRecorder
    this.recordingDelayNode = this.audioCtx.createDelay(2.0);
    this.recordingDelayNode.delayTime.value = 0;
    
    this.streamDestination = this.audioCtx.createMediaStreamDestination();
    
    this.masterGain.connect(this.recordingDelayNode);
    this.recordingDelayNode.connect(this.streamDestination);

    // Constant oscillation ensures the audio track is initialized at T=0 
    // and stays alive during long silences.
    const silenceGain = this.audioCtx.createGain();
    silenceGain.gain.value = 0.0001; 
    this.keepAliveOsc = this.audioCtx.createOscillator();
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

  public playClick() {
    this.playSound(this.clickBuffer, 0.85);
  }

  public playNotification() {
    this.playSound(this.notificationBuffer, 0.9);
  }

  public playBackspace() {
    this.playSound(this.backspaceBuffer, 0.9);
  }

  public async playEffect(name?: string): Promise<void> {
    if (!name) return Promise.resolve();
    
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
