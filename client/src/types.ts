export enum MessageType {
  TEXT = 'TEXT',
  STICKER = 'STICKER',
  IMAGE = 'IMAGE',
  GIF = 'GIF',
  AUDIO = 'AUDIO',
  NOTIFICATION = 'NOTIFICATION',
  PRESENCE = 'PRESENCE',
  IOS_NOTIFICATION = 'IOS_NOTIFICATION',
  CONTACT_CARD = 'CONTACT_CARD'
}

export enum SenderType {
  ME = 'ME',
  THEM = 'THEM'
}

export interface CastMember {
  id: string;
  name: string;
  bitmojiAvatarId: string; // The specific versioned ID from the pool (e.g. 280531978_4-s1)
  isMe: boolean;
  color?: string; // Color for group pills and name labels
}

export interface ScriptEvent {
  id: string;
  type: MessageType;
  senderId?: string; 
  text?: string;
  mediaUrl?: string;
  mediaThumbnailUrl?: string;
  duration?: string;
  timestamp?: string;
  instanceId?: string;
  presenceAction?: 'ENTER' | 'LEAVE';
  isVertical?: boolean; // Metadata for image orientation
  soundEffect?: string; // Assigned sound effect name
  isBackspaced?: boolean; // If true, the message is typed but then deleted instead of sent
  backspaceDelay?: 'immediate' | 'end' | number; // When to backspace: immediately after typing, at end of sequence, or after N more events
  isPreShown?: boolean; // If true, the message is already visible when the video starts
  revealedAt?: number; // Timestamp (ms) when message was revealed during playback
  notifPlatform?: NotificationPlatform;
  notifSenderName?: string;
  notifMessage?: string;
  notifDurationMs?: number;
  notifIconUrl?: string;
  meTypingStart?: 'default' | 'during_previous';
  contactCardName?: string;
  contactCardUsername?: string;
  contactCardAvatarId?: string;
}

export interface SystemConfig {
  carrier: string;
  time: string;
  battery: number;
  connectionType: '5G' | 'LTE' | 'Wi-Fi';
  signalStrength: number; 
  isSoundEnabled: boolean;
  uiScale: number;
}

export interface ChatConfig {
  contactName: string;
  isGroup: boolean;
  groupName?: string;
  typingSpeed: number;
  messageDelay: number;
  groupIconUrl?: string;
  isKeyboardCropped?: boolean;
  isKeyboardHidden?: boolean;
  isShortCrop?: boolean;
  shortCropHeight: number;
  topCornerRadius: number;
  exportBackgroundUrl?: string;
  isVideoBackgroundMode?: boolean;
  exportBackgroundVideoUrl?: string;
  videoModeScale: number;
  messageFontSize: number;
  lockscreenEnabled?: boolean;
  lockscreenBgUrl?: string;
  lockscreenDate?: string;
  lockscreenDurationMs?: number;
  export16x9?: boolean;
}

export interface TimedSoundEffect {
  id: string;
  effectName: string;
  timeMs: number;
}

export type NotificationPlatform = 'Messages' | 'Snapchat';

export interface TimedNotification {
  id: string;
  platform: NotificationPlatform;
  senderName: string;
  message: string;
  timeMs: number;
  durationMs: number;
  customIconUrl?: string;
}

export interface Sequence {
  id: string;
  label: string;
  cast: CastMember[];
  script: ScriptEvent[];
  chat: ChatConfig;
  transitionDelayMs: number;
  returnToSeqIndex?: number;
}

export interface AppState {
  cast: CastMember[];
  script: ScriptEvent[];
  system: SystemConfig;
  chat: ChatConfig;
}