export enum MessageType {
  TEXT = 'TEXT',
  STICKER = 'STICKER',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  NOTIFICATION = 'NOTIFICATION',
  PRESENCE = 'PRESENCE',
  IOS_NOTIFICATION = 'IOS_NOTIFICATION'
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
  duration?: string;
  timestamp?: string;
  instanceId?: string;
  presenceAction?: 'ENTER' | 'LEAVE';
  isVertical?: boolean; // Metadata for image orientation
  soundEffect?: string; // Assigned sound effect name
  isBackspaced?: boolean; // If true, the message is typed but then deleted instead of sent
  isPreShown?: boolean; // If true, the message is already visible when the video starts
  revealedAt?: number; // Timestamp (ms) when message was revealed during playback
  notifPlatform?: NotificationPlatform;
  notifSenderName?: string;
  notifMessage?: string;
  notifDurationMs?: number;
  notifIconUrl?: string;
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
  isShortCrop?: boolean; // New social media framing toggle
  shortCropHeight: number; // New: Dynamic height for short crop mode
  topCornerRadius: number; // Corner radius for top corners
  exportBackgroundUrl?: string; // Background image for the export canvas
  isVideoBackgroundMode?: boolean; // NEW: Toggle for video background
  exportBackgroundVideoUrl?: string; // NEW: URL for the background video
  videoModeScale: number; // NEW: Manual scale for the phone in video mode
  messageFontSize: number;
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

export interface AppState {
  cast: CastMember[];
  script: ScriptEvent[];
  system: SystemConfig;
  chat: ChatConfig;
}