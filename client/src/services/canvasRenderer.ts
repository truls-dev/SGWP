import {
  ScriptEvent,
  SystemConfig,
  ChatConfig,
  CastMember,
  MessageType,
  TimedNotification,
} from "../types";
import { KeyboardLayout } from "../components/IOSKeyboard";
import {
  getSelfieUrlForAvatar,
  getPeekingUrlForAvatar,
} from "./bitmojiService";
import { SNAP_COLORS } from "../constants";

export interface FrameState {
  messages: ScriptEvent[];
  compositionText: string;
  isMeTyping: boolean;
  activeKey: string | null;
  isShiftActive: boolean;
  keyboardLayout: KeyboardLayout;
  typingParticipantIds: string[];
  activeParticipantIds: string[];
  scriptParticipantIds: string[];
  systemConfig: SystemConfig;
  chatConfig: ChatConfig;
  cast: CastMember[];
  time: number;
  backgroundVideo?: HTMLVideoElement | null;
  suggestedCustomojiUrl?: string | null;
  activeNotifications?: TimedNotification[];
  lockscreenActive?: boolean;
  lockscreenNotification?: TimedNotification | null;
  lockscreenSwipeProgress?: number;
  snapFullscreenActive?: boolean;
  snapFullscreenEventId?: string;
  snapOpenedIds?: Set<string>;
  snapTappingId?: string;
  snapOpeningStartTime?: number;
  snapClosingStartTime?: number;
  endScreenActive?: boolean;
  endScreenStartTime?: number;
}

interface StickerAnimState {
  url: string;
  startTime: number;
}

interface PresenceAnimState {
  arrived: boolean;
  arrivalStartTime: number;
  typing: boolean;
  typingStartTime: number;
  hasEverArrived: boolean;
  hasEverTyped: boolean;
}

const FONT_REGULAR = "'Avenir Next LT Pro', sans-serif";
const FONT_HEADER = "'Avenir Black', sans-serif";
const FONT_SYSTEM =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_EMOJI = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

const EMOJI_CDN_BASE = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/";

function emojiToUnified(emoji: string): string {
  const codePoints: string[] = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0xFE0F) continue;
    codePoints.push(cp.toString(16).toLowerCase());
  }
  return codePoints.join("-");
}

function collectEmojisFromText(text: string): string[] {
  if (!hasEmoji(text)) return [];
  const segments = splitEmojiSegments(text);
  const emojis: string[] = [];
  for (const seg of segments) {
    if (seg.isEmoji) {
      const emojiChars = splitEmojiChars(seg.text);
      for (const ch of emojiChars) {
        emojis.push(ch);
      }
    }
  }
  return emojis;
}

function splitEmojiChars(emojiText: string): string[] {
  const results: string[] = [];
  const chars = Array.from(emojiText);
  let current = "";
  let prevWasZWJ = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const code = ch.codePointAt(0)!;
    const isJoiner = code === 0x200D;
    const isModifier = code === 0xFE0F || code === 0xFE0E || (code >= 0x1F3FB && code <= 0x1F3FF) || code === 0x20E3;
    const isFlag = code >= 0x1F1E0 && code <= 0x1F1FF;

    if (current === "") {
      current = ch;
      prevWasZWJ = false;
    } else if (isJoiner || isModifier) {
      current += ch;
      prevWasZWJ = isJoiner;
    } else if (prevWasZWJ) {
      current += ch;
      prevWasZWJ = false;
    } else if (isFlag && current.length > 0) {
      const currentChars = Array.from(current);
      const lastCode = currentChars[currentChars.length - 1]?.codePointAt(0);
      if (lastCode && lastCode >= 0x1F1E0 && lastCode <= 0x1F1FF && currentChars.length === 1) {
        current += ch;
      } else {
        results.push(current);
        current = ch;
      }
      prevWasZWJ = false;
    } else {
      results.push(current);
      current = ch;
      prevWasZWJ = false;
    }
  }
  if (current.length > 0) results.push(current);
  return results;
}

function isEmojiCodePoint(code: number): boolean {
  return (
    (code >= 0x1F600 && code <= 0x1F64F) ||
    (code >= 0x1F300 && code <= 0x1F5FF) ||
    (code >= 0x1F680 && code <= 0x1F6FF) ||
    (code >= 0x1F700 && code <= 0x1F77F) ||
    (code >= 0x1F780 && code <= 0x1F7FF) ||
    (code >= 0x1F800 && code <= 0x1F8FF) ||
    (code >= 0x1F900 && code <= 0x1F9FF) ||
    (code >= 0x1FA00 && code <= 0x1FA6F) ||
    (code >= 0x1FA70 && code <= 0x1FAFF) ||
    (code >= 0x2600 && code <= 0x26FF) ||
    (code >= 0x2700 && code <= 0x27BF) ||
    (code >= 0x2300 && code <= 0x23FF) ||
    (code >= 0x2B50 && code <= 0x2B55) ||
    code === 0x200D ||
    code === 0xFE0F ||
    code === 0xFE0E ||
    code === 0x20E3 ||
    code === 0x2764 ||
    code === 0x2763 ||
    code === 0x2665 ||
    code === 0x2663 ||
    code === 0x2660 ||
    code === 0x2622 ||
    code === 0x2623 ||
    code === 0x263A ||
    code === 0x203C ||
    code === 0x2049 ||
    code === 0x3030 ||
    code === 0x303D ||
    code === 0x2139 ||
    code === 0x2934 ||
    code === 0x2935 ||
    (code >= 0x25AA && code <= 0x25FE) ||
    (code >= 0x2190 && code <= 0x21AA) ||
    (code >= 0x231A && code <= 0x231B) ||
    (code >= 0x23E9 && code <= 0x23F3) ||
    code === 0x23F8 || code === 0x23F9 || code === 0x23FA ||
    (code >= 0x1F1E0 && code <= 0x1F1FF) ||
    (code >= 0x1F3FB && code <= 0x1F3FF) ||
    (code >= 0xE0020 && code <= 0xE007F)
  );
}

function hasEmoji(text: string): boolean {
  for (const ch of text) {
    if (isEmojiCodePoint(ch.codePointAt(0)!)) return true;
  }
  return false;
}

function splitEmojiSegments(text: string): { text: string; isEmoji: boolean }[] {
  const segments: { text: string; isEmoji: boolean }[] = [];
  let current = "";
  let currentIsEmoji = false;
  const chars = Array.from(text);

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const code = ch.codePointAt(0)!;
    const isEm = isEmojiCodePoint(code);

    const isModifier = code === 0xFE0F || code === 0xFE0E || code === 0x200D ||
      (code >= 0x1F3FB && code <= 0x1F3FF) || code === 0x20E3;

    if (isModifier && segments.length > 0 && current === "") {
      segments[segments.length - 1].text += ch;
      continue;
    }
    if (isModifier && current.length > 0 && currentIsEmoji) {
      current += ch;
      continue;
    }

    if (current.length === 0) {
      currentIsEmoji = isEm;
      current = ch;
    } else if (isEm === currentIsEmoji) {
      current += ch;
    } else {
      segments.push({ text: current, isEmoji: currentIsEmoji });
      current = ch;
      currentIsEmoji = isEm;
    }
  }
  if (current.length > 0) {
    segments.push({ text: current, isEmoji: currentIsEmoji });
  }
  return segments;
}

const STATUS_BAR_H = 42;
const HEADER_H = 116;
const INPUT_H = 133;
const KEYBOARD_H = 640;
const KEYBOARD_SHORT_H = 460;

const MSG_FONT_SIZE = 56;
const MSG_LINE_H = 68;
const NAME_FONT_SIZE = 36;
const NOTIF_FONT_SIZE = 33;
const BAR_WIDTH = 6;
const BAR_GAP = 14;
const MSG_PAD_X = 24;
const MSG_PAD_X_CROPPED = 183;

interface MsgLayout {
  msg: ScriptEvent;
  h: number;
  isGrouped: boolean;
  lines: string[];
  sender: CastMember | undefined;
  color: string;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private W = 1080;
  private H = 1920;
  private images = new Map<string, HTMLImageElement>();
  private whiteIconCache = new Map<string, HTMLCanvasElement>();
  private gifVideos = new Map<string, HTMLVideoElement>();
  private currentSnapOpenedIds: Set<string> = new Set();
  private hiddenVideoContainer: HTMLDivElement;
  private emojiImages = new Map<string, HTMLImageElement>();
  private stickerAnim: StickerAnimState | null = null;
  private presenceAnims = new Map<string, PresenceAnimState>();
  private presenceEnabled = false;
  private actionIconsVisible = true;
  private actionIconsTransitionTime = -Infinity;
  private snapOriginRect: { x: number; y: number; w: number; h: number } | null = null;
  private phoneCanvasRect: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 1080, h: 1920 };
  // The horizontal/vertical scale applied to the phone UI (before uiScale). Used
  // so the snap fullscreen status bar can replicate the chat status bar's exact size.
  private phoneScaleX = 1;
  private phoneScaleY = 1;
  private endScreenSnapshot: HTMLCanvasElement | null = null;
  private lastEndScreenActive = false;

  resetAnimations(): void {
    this.presenceAnims.clear();
    this.presenceEnabled = false;
  }

  enablePresence(): void {
    this.presenceEnabled = true;
  }

  preArriveParticipants(ids: string[]): void {
    for (const id of ids) {
      this.presenceAnims.set(id, {
        arrived: true,
        arrivalStartTime: -10000,
        typing: false,
        typingStartTime: -10000,
        hasEverArrived: true,
        hasEverTyped: false,
      });
    }
  }

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
    this.hiddenVideoContainer = document.createElement("div");
    this.hiddenVideoContainer.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;";
    document.body.appendChild(this.hiddenVideoContainer);
  }

  destroy(): void {
    this.gifVideos.forEach(v => { v.pause(); v.src = ''; });
    this.gifVideos.clear();
    if (this.hiddenVideoContainer.parentNode) {
      this.hiddenVideoContainer.parentNode.removeChild(this.hiddenVideoContainer);
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  async preload(
    cast: CastMember[],
    events: ScriptEvent[],
    chatConfig?: ChatConfig,
  ): Promise<void> {
    const staticUrls: [string, string][] = [
      [
        "signal",
        "https://raw.githubusercontent.com/truls-dev/images/main/signalbarsblack.png",
      ],
      [
        "wifi",
        "https://raw.githubusercontent.com/truls-dev/images/main/wifi.png",
      ],
      [
        "battery",
        "https://raw.githubusercontent.com/truls-dev/images/main/battery.100.png",
      ],
      [
        "callIcons",
        "https://raw.githubusercontent.com/truls-dev/images/main/sccicons.png",
      ],
      [
        "cameraBtn",
        "https://raw.githubusercontent.com/truls-dev/images/main/sccb_empty.png",
      ],
      [
        "sendBtn",
        "https://raw.githubusercontent.com/truls-dev/images/main/sccb_text.png",
      ],
      [
        "smiley",
        "https://raw.githubusercontent.com/truls-dev/images/main/smiley.png",
      ],
      [
        "galleryIcon",
        "https://raw.githubusercontent.com/truls-dev/images/main/images.png",
      ],
      [
        "plusIcon",
        "https://raw.githubusercontent.com/truls-dev/images/main/plus.png",
      ],
      [
        "updown",
        "https://raw.githubusercontent.com/truls-dev/images/main/updown-removebg-preview.png",
      ],
      [
        "snapLogo",
        "https://raw.githubusercontent.com/truls-dev/images/main/snaplogo.png",
      ],
      [
        "snapChatBar",
        "https://raw.githubusercontent.com/truls-dev/images/main/image.png",
      ],
      [
        "imessageLogo",
        "https://raw.githubusercontent.com/truls-dev/images/main/IMessage_logo.png",
      ],
    ];

    const promises: Promise<void>[] = [];
    for (const [key, url] of staticUrls) {
      promises.push(this.loadImg(key, url));
    }

    for (const m of cast) {
      promises.push(
        this.loadImg(
          `selfie_${m.bitmojiAvatarId}`,
          getSelfieUrlForAvatar(m.bitmojiAvatarId),
        ),
      );
      promises.push(
        this.loadImg(
          `peeking_${m.bitmojiAvatarId}`,
          getPeekingUrlForAvatar(m.bitmojiAvatarId),
        ),
      );
    }

    for (const e of events) {
      if (e.mediaUrl) {
        const isGiphyMp4 = e.type === MessageType.GIF && e.mediaUrl.includes('.mp4') && !e.mediaUrl.startsWith('data:');
        if (isGiphyMp4) {
          promises.push(this.loadVideo(`media_${e.id}`, e.mediaUrl));
        } else {
          promises.push(this.loadImg(`media_${e.id}`, e.mediaUrl));
        }
      }
      if (e.type === MessageType.CONTACT_CARD && e.contactCardAvatarId) {
        const bitmojiUrl = getSelfieUrlForAvatar(e.contactCardAvatarId);
        promises.push(this.loadImg(`contact_${e.id}`, `/api/media-proxy?url=${encodeURIComponent(bitmojiUrl)}`));
      }
      if (e.type === MessageType.OPEN_SNAP && e.snapImageUrl) {
        promises.push(this.loadImg(`snap_${e.id}`, e.snapImageUrl));
      }
    }

    if (chatConfig?.exportBackgroundUrl) {
      promises.push(this.loadImg("exportBg", chatConfig.exportBackgroundUrl));
    }
    if (chatConfig?.lockscreenBgUrl) {
      promises.push(this.loadImg("lockscreenBg", chatConfig.lockscreenBgUrl));
    }
    if (chatConfig?.groupIconUrl) {
      promises.push(this.loadImg("groupIcon", chatConfig.groupIconUrl));
    }

    const allEmojis = new Set<string>();
    for (const e of events) {
      if (e.text) {
        for (const em of collectEmojisFromText(e.text)) allEmojis.add(em);
      }
    }
    for (const m of cast) {
      if (m.name) {
        for (const em of collectEmojisFromText(m.name)) allEmojis.add(em);
      }
    }
    allEmojis.forEach(emoji => {
      promises.push(this.loadEmojiImg(emoji));
    });

    await Promise.all(promises);
    await document.fonts.ready;
  }

  private loadImg(key: string, url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        this.images.set(key, img);
        resolve();
      };
      img.onerror = () => {
        const img2 = new Image();
        img2.onload = () => {
          this.images.set(key, img2);
          resolve();
        };
        img2.onerror = () => resolve();
        img2.src = url;
      };
      img.src = url;
    });
  }

  private loadVideo(key: string, originalUrl: string): Promise<void> {
    if (!originalUrl) return Promise.resolve();
    if (this.gifVideos.has(key)) return Promise.resolve();
    const proxyUrl = `/api/media-proxy?url=${encodeURIComponent(originalUrl)}`;
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      let resolved = false;
      const done = () => { if (!resolved) { resolved = true; resolve(); } };
      video.oncanplay = () => {
        if (!resolved) {
          this.gifVideos.set(key, video);
          video.play().catch(() => {});
          done();
        }
      };
      video.onerror = () => {
        const fallbackUrl = originalUrl.replace(/\.mp4(\?.*)?$/, '.gif');
        if (fallbackUrl !== originalUrl) {
          this.loadImg(key, `/api/media-proxy?url=${encodeURIComponent(fallbackUrl)}`).then(done);
        } else {
          done();
        }
      };
      setTimeout(() => {
        if (!resolved) {
          if (video.readyState >= 2) {
            this.gifVideos.set(key, video);
            video.play().catch(() => {});
          }
          done();
        }
      }, 8000);
      this.hiddenVideoContainer.appendChild(video);
      video.src = proxyUrl;
      video.load();
    });
  }

  private loadEmojiImg(emoji: string): Promise<void> {
    const unified = emojiToUnified(emoji);
    if (this.emojiImages.has(unified)) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        this.emojiImages.set(unified, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = `${EMOJI_CDN_BASE}${unified}.png`;
    });
  }

  private getEmojiImage(emoji: string): HTMLImageElement | null {
    const unified = emojiToUnified(emoji);
    const cached = this.emojiImages.get(unified);
    if (cached) return cached;
    if (!this.emojiImages.has(unified)) {
      this.emojiImages.set(unified, null as any);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { this.emojiImages.set(unified, img); };
      img.src = `${EMOJI_CDN_BASE}${unified}.png`;
    }
    return null;
  }

  renderFrame(state: FrameState): HTMLCanvasElement {
    if (
      state.suggestedCustomojiUrl &&
      !this.images.has(`sticker_${state.suggestedCustomojiUrl}`)
    ) {
      this.loadImg(
        `sticker_${state.suggestedCustomojiUrl}`,
        state.suggestedCustomojiUrl,
      );
    }

    const ctx = this.ctx;
    const isVideoMode = state.chatConfig.isVideoBackgroundMode;
    const kbH = state.chatConfig.isShortCrop ? KEYBOARD_SHORT_H : KEYBOARD_H;

    // Shortcut: if end screen is already running and snapshot exists, draw frozen frame + overlay only
    if (state.endScreenActive && this.lastEndScreenActive && this.endScreenSnapshot) {
      ctx.drawImage(this.endScreenSnapshot, 0, 0);
      this.drawEndScreen(this.ctx, state);
      return this.canvas;
    }

    if (isVideoMode) {
      if (state.backgroundVideo && state.backgroundVideo.videoWidth) {
        this.drawVideoBackground(ctx, state.backgroundVideo);
      } else {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, this.W, this.H);
      }
      const scale = state.chatConfig.videoModeScale || 1;
      const phoneW = this.W * scale;
      const phoneH = this.H * scale;
      const ox = (this.W - phoneW) / 2;
      const oy = (this.H - phoneH) / 2 + (state.chatConfig.phoneYOffset ?? 0);

      const actualKbH = state.chatConfig.isShortCrop ? KEYBOARD_SHORT_H : KEYBOARD_H;
      const clipPhoneH = state.chatConfig.isKeyboardHidden
        ? phoneH - actualKbH * scale
        : phoneH;

      ctx.save();
      const cr = state.chatConfig.topCornerRadius * (phoneW / 390);
      ctx.beginPath();
      ctx.moveTo(ox + cr, oy);
      ctx.lineTo(ox + phoneW - cr, oy);
      ctx.quadraticCurveTo(ox + phoneW, oy, ox + phoneW, oy + cr);
      ctx.lineTo(ox + phoneW, oy + clipPhoneH);
      ctx.lineTo(ox, oy + clipPhoneH);
      ctx.lineTo(ox, oy + cr);
      ctx.quadraticCurveTo(ox, oy, ox + cr, oy);
      ctx.closePath();
      ctx.clip();

      this.phoneCanvasRect = { x: ox, y: oy, w: phoneW, h: phoneH };
      this.phoneScaleX = scale;
      this.phoneScaleY = scale;
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);
      this.drawPhoneUI(ctx, state, kbH);
      ctx.restore();
    } else {
      const exportBg = this.images.get("exportBg");
      if (exportBg) {
        const imgR = exportBg.width / exportBg.height;
        const canR = this.W / this.H;
        let dw: number, dh: number, dx: number, dy: number;
        if (imgR > canR) {
          dw = this.W;
          dh = this.W / imgR;
          dx = 0;
          dy = (this.H - dh) / 2;
        } else {
          dh = this.H;
          dw = this.H * imgR;
          dx = (this.W - dw) / 2;
          dy = 0;
        }
        ctx.drawImage(exportBg, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, this.W, this.H);
      }

      const safePad = 20;
      const safeScale = (this.W - safePad * 2) / this.W;

      if (state.chatConfig.isShortCrop) {
        const phoneH = this.H * 0.75;
        const phoneY = (this.H - phoneH) / 2;
        const cr = state.chatConfig.topCornerRadius * 2.77;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(safePad + cr, phoneY);
        ctx.lineTo(this.W - safePad - cr, phoneY);
        ctx.quadraticCurveTo(this.W - safePad, phoneY, this.W - safePad, phoneY + cr);
        ctx.lineTo(this.W - safePad, phoneY + phoneH);
        ctx.lineTo(safePad, phoneY + phoneH);
        ctx.lineTo(safePad, phoneY + cr);
        ctx.quadraticCurveTo(safePad, phoneY, safePad + cr, phoneY);
        ctx.closePath();
        ctx.clip();
        this.phoneCanvasRect = { x: safePad, y: phoneY, w: this.W - safePad * 2, h: phoneH };
        this.phoneScaleX = safeScale;
        this.phoneScaleY = 1;
        ctx.translate(safePad, phoneY);
        ctx.scale(safeScale, 1);
        this.drawPhoneUI(ctx, state, kbH);
        ctx.restore();
      } else {
        this.phoneCanvasRect = { x: safePad, y: 0, w: this.W - safePad * 2, h: this.H };
        this.phoneScaleX = safeScale;
        this.phoneScaleY = 1;
        ctx.save();
        ctx.translate(safePad, 0);
        ctx.scale(safeScale, 1);
        this.drawPhoneUI(ctx, state, kbH);
        ctx.restore();
      }
    }

    // Draw snap fullscreen overlay in root canvas space (no transforms active)
    // so the black bg covers the full canvas and zoom coords are correct.
    if (state.snapFullscreenActive && state.snapFullscreenEventId) {
      this.drawSnapFullscreen(this.ctx, state);
    }

    // End screen frost overlay — capture snapshot on first active frame, then render
    if (state.endScreenActive && !this.lastEndScreenActive) {
      const snap = document.createElement('canvas');
      snap.width = this.W;
      snap.height = this.H;
      snap.getContext('2d')!.drawImage(this.canvas, 0, 0);
      this.endScreenSnapshot = snap;
      this.lastEndScreenActive = true;
    } else if (!state.endScreenActive) {
      this.lastEndScreenActive = false;
      this.endScreenSnapshot = null;
    }
    if (state.endScreenActive) {
      this.drawEndScreen(this.ctx, state);
    }

    return this.canvas;
  }

  private drawPhoneUI(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    kbH: number,
  ): void {
    if (state.lockscreenActive) {
      this.drawLockscreen(ctx, state);
      return;
    }

    const uiScale = state.systemConfig.uiScale || 1;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, this.W, this.H);

    const origW = this.W;
    const origH = this.H;

    ctx.save();
    ctx.scale(uiScale, uiScale);
    (this as any).W = Math.round(origW / uiScale);
    (this as any).H = Math.round(origH / uiScale);

    const scaledKbH = Math.round(kbH / uiScale);

    let y = 0;
    this.drawStatusBar(ctx, state, y);
    y += STATUS_BAR_H;

    this.drawHeader(ctx, state, y);
    y += HEADER_H;

    const inputH = this.computeInputHeight(ctx, state);
    const msgAreaH = this.H - y - inputH - scaledKbH;
    this.drawMessages(ctx, state, y, msgAreaH);
    this.drawTypingIndicator(ctx, state, y + msgAreaH);
    y += msgAreaH;

    this.drawInput(ctx, state, y, inputH);
    y += inputH;

    const kbYInCanvas = Math.round(y * uiScale);

    ctx.restore();
    (this as any).W = origW;
    (this as any).H = origH;

    if (!state.chatConfig.isKeyboardHidden) {
      this.drawKeyboard(ctx, state, kbYInCanvas, kbH);
    }

    this.drawActiveNotifications(ctx, state);
  }

  private drawLockscreen(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
  ): void {
    const lockBg = this.images.get("lockscreenBg");
    if (lockBg) {
      const imgR = lockBg.width / lockBg.height;
      const canR = this.W / this.H;
      let dw: number, dh: number, dx: number, dy: number;
      if (imgR > canR) {
        dh = this.H; dw = this.H * imgR;
        dx = (this.W - dw) / 2; dy = 0;
      } else {
        dw = this.W; dh = this.W / imgR;
        dx = 0; dy = (this.H - dh) / 2;
      }
      ctx.drawImage(lockBg, dx, dy, dw, dh);
    } else {
      const grad = ctx.createLinearGradient(0, 0, this.W, this.H);
      grad.addColorStop(0, '#1a0533');
      grad.addColorStop(0.4, '#3b1a7a');
      grad.addColorStop(0.7, '#7b2d8e');
      grad.addColorStop(1, '#c94b8a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    const uiScale = state.systemConfig.uiScale || 1;
    const origW = this.W;
    const origH = this.H;
    ctx.save();
    ctx.scale(uiScale, uiScale);
    (this as any).W = Math.round(origW / uiScale);
    (this as any).H = Math.round(origH / uiScale);
    this.drawLockscreenStatusBar(ctx, state, 0);
    ctx.restore();
    (this as any).W = origW;
    (this as any).H = origH;

    const dateText = state.chatConfig.lockscreenDate || 'Thursday, February 19';
    const timeText = state.systemConfig.time || '5:40';

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `500 52px ${FONT_SYSTEM}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    this.fillTextWithEmoji(ctx, dateText, this.W / 2, STATUS_BAR_H + 100, FONT_SYSTEM, 52);

    ctx.font = `bold 260px ${FONT_SYSTEM}`;
    this.fillTextWithEmoji(ctx, timeText, this.W / 2, STATUS_BAR_H + 290, FONT_SYSTEM, 260);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    const notif = state.lockscreenNotification;
    if (notif) {
      if (notif.customIconUrl && !this.images.has(`notif_icon_${notif.id}`)) {
        this.loadImg(`notif_icon_${notif.id}`, notif.customIconUrl);
      }
      const elapsed = state.time - notif.timeMs;
      const totalDuration = notif.durationMs;
      const popInDuration = 350;

      let appearProgress: number;
      if (elapsed < 0) {
        appearProgress = 0;
      } else if (elapsed < popInDuration) {
        appearProgress = elapsed / popInDuration;
      } else if (elapsed < totalDuration) {
        appearProgress = 1;
      } else {
        appearProgress = 1;
      }

      if (appearProgress > 0) {
        const swipe = state.lockscreenSwipeProgress || 0;
        if (swipe > 0) {
          this.drawSwipeOpenPill(ctx, swipe);
        }
        this.drawLockscreenNotification(ctx, notif, appearProgress, state);
      }
    }
  }

  private drawLockscreenStatusBar(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    y: number,
  ): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 28px ${FONT_SYSTEM}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const carrierY = y + STATUS_BAR_H / 2;

    const signalH = 17;
    const svgAspect = 27 / 17;
    const signalW = signalH * svgAspect;
    const signalX = 22;
    const signalY2 = carrierY - signalH / 2;
    const sx = signalW / 27;
    const sy = signalH / 17;

    ctx.save();
    ctx.translate(signalX, signalY2);
    ctx.scale(sx, sy);
    ctx.fillStyle = '#FFFFFF';

    ctx.fill(new Path2D("M22.959 16.9531H25.332C25.9375 16.9531 26.3477 16.5234 26.3477 15.8887V1.06445C26.3477 0.429688 25.9375 0 25.332 0H22.959C22.3535 0 21.9336 0.429688 21.9336 1.06445V15.8887C21.9336 16.5234 22.3535 16.9531 22.959 16.9531Z"));
    ctx.fill(new Path2D("M15.6543 16.9531H18.0078C18.6133 16.9531 19.0332 16.5234 19.0332 15.8887V4.92188C19.0332 4.28711 18.6133 3.85742 18.0078 3.85742H15.6543C15.0391 3.85742 14.6289 4.28711 14.6289 4.92188V15.8887C14.6289 16.5234 15.0391 16.9531 15.6543 16.9531Z"));
    ctx.fill(new Path2D("M8.33984 16.9531H10.6934C11.3086 16.9531 11.7188 16.5234 11.7188 15.8887V8.45703C11.7188 7.82227 11.3086 7.39258 10.6934 7.39258H8.33984C7.72461 7.39258 7.31445 7.82227 7.31445 8.45703V15.8887C7.31445 16.5234 7.72461 16.9531 8.33984 16.9531Z"));
    ctx.fill(new Path2D("M1.02539 16.9531H3.37891C3.99414 16.9531 4.4043 16.5234 4.4043 15.8887V11.5039C4.4043 10.8691 3.99414 10.4492 3.37891 10.4492H1.02539C0.410156 10.4492 0 10.8691 0 11.5039V15.8887C0 16.5234 0.410156 16.9531 1.02539 16.9531Z"));

    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    this.fillTextWithEmoji(ctx, state.systemConfig.carrier, signalX + signalW + 8, carrierY, FONT_SYSTEM, 28);

    let rx = this.W - 22;
    const batteryImg = this.images.get("battery");
    if (batteryImg) {
      const ih = 24;
      const iw = batteryImg.width * (ih / batteryImg.height);
      rx -= iw;
      ctx.save();
      ctx.filter = 'brightness(0) invert(1)';
      ctx.drawImage(batteryImg, rx, y + (STATUS_BAR_H - ih) / 2, iw, ih);
      ctx.restore();
      rx -= 14;
    }

    const wifiImg = this.images.get("wifi");
    if (wifiImg) {
      const ih = 25;
      const iw = wifiImg.width * (ih / wifiImg.height);
      rx -= iw;
      ctx.save();
      ctx.filter = 'brightness(0) invert(1)';
      ctx.drawImage(wifiImg, rx, y + (STATUS_BAR_H - ih) / 2, iw, ih);
      ctx.restore();
    }
  }

  private drawLockscreenNotification(
    ctx: CanvasRenderingContext2D,
    notification: TimedNotification,
    appearProgress: number,
    state: FrameState,
  ): void {
    const bannerW = this.W - 100;
    const bannerH = 210;
    const bannerX = 50;
    const bannerR = 52;
    const bannerY = STATUS_BAR_H + 440;

    const swipe = state.lockscreenSwipeProgress || 0;
    const swipeEased = swipe < 0.5
      ? 2 * swipe * swipe
      : 1 - Math.pow(-2 * swipe + 2, 2) / 2;
    const swipeOffsetX = swipeEased * (this.W - bannerX + 20);

    const eased = 1 - Math.pow(1 - appearProgress, 3);
    const scale = 0.85 + 0.15 * eased;
    const opacity = eased;

    ctx.save();
    ctx.globalAlpha = opacity;

    if (swipeOffsetX > 0) {
      ctx.translate(swipeOffsetX, 0);
    }

    const cx = bannerX + bannerW / 2;
    const cy = bannerY + bannerH / 2;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = 'rgba(220, 210, 230, 0.65)';
    ctx.beginPath();
    ctx.moveTo(bannerX + bannerR, bannerY);
    ctx.lineTo(bannerX + bannerW - bannerR, bannerY);
    ctx.quadraticCurveTo(bannerX + bannerW, bannerY, bannerX + bannerW, bannerY + bannerR);
    ctx.lineTo(bannerX + bannerW, bannerY + bannerH - bannerR);
    ctx.quadraticCurveTo(bannerX + bannerW, bannerY + bannerH, bannerX + bannerW - bannerR, bannerY + bannerH);
    ctx.lineTo(bannerX + bannerR, bannerY + bannerH);
    ctx.quadraticCurveTo(bannerX, bannerY + bannerH, bannerX, bannerY + bannerH - bannerR);
    ctx.lineTo(bannerX, bannerY + bannerR);
    ctx.quadraticCurveTo(bannerX, bannerY, bannerX + bannerR, bannerY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';

    const nameFontSize = 60;
    const msgFontSize = 52;
    const lineGap = 4;
    const textBlockH = nameFontSize + lineGap + msgFontSize;
    const textBlockTop = bannerY + (bannerH - textBlockH) / 2;
    const msgBottomY = textBlockTop + nameFontSize + lineGap + msgFontSize;

    const iconSize = 130;
    const badgeSize = 56;
    const badgeBottomY = msgBottomY;
    const badgeTopY = badgeBottomY - badgeSize;
    const iconBottomY = badgeBottomY - badgeSize * 0.25;
    const iconTopY = iconBottomY - iconSize;
    const iconX = bannerX + 30;
    const iconY = iconTopY;

    const badgeX = iconX + iconSize - badgeSize + 8;
    const badgeY = badgeTopY;

    const customIcon = notification.customIconUrl ? this.images.get(`notif_icon_${notification.id}`) : null;
    const snapLogo = this.images.get('snapLogo');

    if (customIcon) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const imgRatio = customIcon.width / customIcon.height;
      let dw: number, dh: number, dx: number, dy: number;
      if (imgRatio > 1) {
        dh = iconSize; dw = iconSize * imgRatio;
        dx = iconX + (iconSize - dw) / 2; dy = iconY;
      } else {
        dw = iconSize; dh = iconSize / imgRatio;
        dx = iconX; dy = iconY + (iconSize - dh) / 2;
      }
      ctx.drawImage(customIcon, dx, dy, dw, dh);
      ctx.restore();

      if (snapLogo) {
        ctx.drawImage(snapLogo, badgeX, badgeY, badgeSize, badgeSize);
      }
    } else {
      ctx.fillStyle = '#FFFC00';
      ctx.beginPath();
      ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      if (snapLogo) {
        ctx.drawImage(snapLogo, badgeX, badgeY, badgeSize, badgeSize);
      }
    }

    const textX = iconX + iconSize + 24;
    const textMaxW = bannerX + bannerW - textX - 120;

    ctx.fillStyle = '#000000';
    ctx.font = `700 ${nameFontSize}px ${FONT_SYSTEM}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const nameText = notification.senderName;
    const measuredName = ctx.measureText(nameText).width;
    if (measuredName > textMaxW) {
      ctx.fillText(this.truncateText(ctx, nameText, textMaxW), textX, textBlockTop);
    } else {
      ctx.fillText(nameText, textX, textBlockTop);
    }

    ctx.fillStyle = '#000000';
    ctx.font = `400 ${msgFontSize}px ${FONT_SYSTEM}`;
    const msgY = textBlockTop + nameFontSize + lineGap;
    const msgText = notification.message;
    const measuredMsg = ctx.measureText(msgText).width;
    if (measuredMsg > textMaxW) {
      ctx.fillText(this.truncateText(ctx, msgText, textMaxW), textX, msgY);
    } else {
      ctx.fillText(msgText, textX, msgY);
    }

    ctx.fillStyle = 'rgba(60, 40, 90, 0.75)';
    ctx.font = `500 42px ${FONT_SYSTEM}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('now', bannerX + bannerW - 36, textBlockTop + 4);

    ctx.restore();
  }

  private drawSwipeOpenPill(
    ctx: CanvasRenderingContext2D,
    swipeProgress: number,
  ): void {
    const bannerW = this.W - 100;
    const bannerH = 210;
    const bannerX = 50;
    const bannerR = 52;
    const bannerY = STATUS_BAR_H + 440;

    const swipeEased = swipeProgress < 0.5
      ? 2 * swipeProgress * swipeProgress
      : 1 - Math.pow(-2 * swipeProgress + 2, 2) / 2;
    const swipeOffsetX = swipeEased * (this.W - bannerX + 20);

    const pillRight = bannerX + bannerW + swipeOffsetX;
    const pillW = pillRight - bannerX;

    if (pillW > 5) {
      ctx.save();
      ctx.globalAlpha = 0.9;

      const pillR = Math.min(bannerR, pillW / 2);
      ctx.fillStyle = 'rgba(180, 170, 200, 0.45)';
      ctx.beginPath();
      ctx.moveTo(bannerX + pillR, bannerY);
      ctx.lineTo(pillRight - pillR, bannerY);
      ctx.quadraticCurveTo(pillRight, bannerY, pillRight, bannerY + pillR);
      ctx.lineTo(pillRight, bannerY + bannerH - pillR);
      ctx.quadraticCurveTo(pillRight, bannerY + bannerH, pillRight - pillR, bannerY + bannerH);
      ctx.lineTo(bannerX + pillR, bannerY + bannerH);
      ctx.quadraticCurveTo(bannerX, bannerY + bannerH, bannerX, bannerY + bannerH - pillR);
      ctx.lineTo(bannerX, bannerY + pillR);
      ctx.quadraticCurveTo(bannerX, bannerY, bannerX + pillR, bannerY);
      ctx.closePath();
      ctx.fill();

      const textCenterX = bannerX + (pillW - swipeOffsetX) / 2;
      ctx.globalAlpha = Math.min(swipeEased * 2, 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = `500 34px ${FONT_SYSTEM}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Open', textCenterX, bannerY + bannerH / 2);

      ctx.restore();
    }
  }

  private drawVideoBackground(
    ctx: CanvasRenderingContext2D,
    vid: HTMLVideoElement,
  ): void {
    if (!vid.videoWidth) return;
    const vidR = vid.videoWidth / vid.videoHeight;
    const canR = this.W / this.H;
    let dw: number, dh: number, dx: number, dy: number;
    if (vidR > canR) {
      dh = this.H;
      dw = this.H * vidR;
      dx = (this.W - dw) / 2;
      dy = 0;
    } else {
      dw = this.W;
      dh = this.W / vidR;
      dx = 0;
      dy = (this.H - dh) / 2;
    }
    ctx.drawImage(vid, dx, dy, dw, dh);
  }

  /**
   * Returns a cached HTMLCanvasElement of the given image key recoloured solid
   * white. Operates on a separate alpha-enabled offscreen canvas (source-in
   * composite) so the result has transparent backgrounds and purely white
   * foreground pixels — safe to draw onto the main alpha:false canvas.
   */
  private getWhiteIcon(key: string): HTMLCanvasElement | null {
    if (this.whiteIconCache.has(key)) return this.whiteIconCache.get(key)!;
    const img = this.images.get(key);
    if (!img || !img.width) return null;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const cx = c.getContext('2d')!; // alpha:true by default — critical
    cx.drawImage(img, 0, 0);
    cx.globalCompositeOperation = 'source-in';
    cx.fillStyle = '#FFFFFF';
    cx.fillRect(0, 0, img.width, img.height);
    this.whiteIconCache.set(key, c);
    return c;
  }

  private drawStatusBar(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    y: number,
    iconColor = '#000000',
    width = this.W,
  ): void {
    const isWhite = iconColor === '#FFFFFF';

    if (!isWhite) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, y, width, STATUS_BAR_H);
    }

    ctx.fillStyle = iconColor;
    ctx.font = `bold 28px ${FONT_SYSTEM}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const carrierY = y + STATUS_BAR_H / 2;

    const signalH = 17;
    const svgAspect = 27 / 17;
    const signalW = signalH * svgAspect;
    const signalX = 22;
    const signalY = carrierY - signalH / 2;
    const sx = signalW / 27;
    const sy = signalH / 17;

    ctx.save();
    ctx.translate(signalX, signalY);
    ctx.scale(sx, sy);
    ctx.fillStyle = iconColor;

    ctx.fill(new Path2D("M22.959 16.9531H25.332C25.9375 16.9531 26.3477 16.5234 26.3477 15.8887V1.06445C26.3477 0.429688 25.9375 0 25.332 0H22.959C22.3535 0 21.9336 0.429688 21.9336 1.06445V15.8887C21.9336 16.5234 22.3535 16.9531 22.959 16.9531Z"));
    ctx.fill(new Path2D("M15.6543 16.9531H18.0078C18.6133 16.9531 19.0332 16.5234 19.0332 15.8887V4.92188C19.0332 4.28711 18.6133 3.85742 18.0078 3.85742H15.6543C15.0391 3.85742 14.6289 4.28711 14.6289 4.92188V15.8887C14.6289 16.5234 15.0391 16.9531 15.6543 16.9531Z"));
    ctx.fill(new Path2D("M8.33984 16.9531H10.6934C11.3086 16.9531 11.7188 16.5234 11.7188 15.8887V8.45703C11.7188 7.82227 11.3086 7.39258 10.6934 7.39258H8.33984C7.72461 7.39258 7.31445 7.82227 7.31445 8.45703V15.8887C7.31445 16.5234 7.72461 16.9531 8.33984 16.9531Z"));
    ctx.fill(new Path2D("M1.02539 16.9531H3.37891C3.99414 16.9531 4.4043 16.5234 4.4043 15.8887V11.5039C4.4043 10.8691 3.99414 10.4492 3.37891 10.4492H1.02539C0.410156 10.4492 0 10.8691 0 11.5039V15.8887C0 16.5234 0.410156 16.9531 1.02539 16.9531Z"));

    ctx.restore();

    ctx.fillStyle = iconColor;
    this.fillTextWithEmoji(ctx, state.systemConfig.carrier, signalX + signalW + 8, carrierY, FONT_SYSTEM, 28);

    ctx.font = `bold 30px ${FONT_SYSTEM}`;
    ctx.textAlign = "center";
    this.fillTextWithEmoji(ctx, state.systemConfig.time, width / 2, y + STATUS_BAR_H / 2, FONT_SYSTEM, 30);

    let rx = width - 22;
    const batteryImg = isWhite ? this.getWhiteIcon('battery') : this.images.get('battery');
    if (batteryImg) {
      const src = isWhite ? batteryImg : batteryImg as HTMLImageElement;
      const ih = 24;
      const iw = (src.width) * (ih / (src.height));
      rx -= iw;
      ctx.drawImage(src, rx, y + (STATUS_BAR_H - ih) / 2, iw, ih);
      rx -= 14;
    }

    const wifiImg = isWhite ? this.getWhiteIcon('wifi') : this.images.get('wifi');
    if (wifiImg) {
      const ih = 25;
      const iw = (wifiImg.width) * (ih / (wifiImg.height));
      rx -= iw;
      ctx.drawImage(wifiImg, rx, y + (STATUS_BAR_H - ih) / 2, iw, ih);
    }
  }

  private drawHeader(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    y: number,
  ): void {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, y, this.W, HEADER_H);
    ctx.fillStyle = "#F0F0F0";
    ctx.fillRect(0, y + HEADER_H - 1, this.W, 1);

    const isCropped = state.chatConfig.isKeyboardCropped;
    let cx = isCropped ? 183 : 8;

    if (!isCropped) {
      ctx.strokeStyle = "#9CA3AF";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx + 38, y + HEADER_H / 2 - 16);
      ctx.lineTo(cx + 22, y + HEADER_H / 2);
      ctx.lineTo(cx + 38, y + HEADER_H / 2 + 16);
      ctx.stroke();
      cx += 58;
    }

    const others = state.cast.filter((c) => !c.isMe);
    if (others[0]) {
      const avatarImg = this.images.get(`selfie_${others[0].bitmojiAvatarId}`);
      if (state.chatConfig.isGroup) {
        const groupIconImg = this.images.get("groupIcon");
        if (groupIconImg) {
          const s = 90;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx + s / 2, y + HEADER_H / 2, s / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(groupIconImg, cx, y + HEADER_H / 2 - s / 2, s, s);
          ctx.restore();
          cx += s + 20;
        } else if (avatarImg) {
          const s = 76;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx + s / 2, y + HEADER_H / 2, s / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatarImg, cx, y + HEADER_H / 2 - s / 2, s, s);
          ctx.restore();

          if (others[1]) {
            const img2 = this.images.get(`selfie_${others[1].bitmojiAvatarId}`);
            if (img2) {
              ctx.save();
              ctx.beginPath();
              ctx.arc(cx + s / 2 + 30, y + HEADER_H / 2, s / 2, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(img2, cx + 30, y + HEADER_H / 2 - s / 2, s, s);
              ctx.restore();
            }
          }
          cx += s + 44;
        }
      } else if (avatarImg) {
        const containerW = 110;
        const imgScale = 1.3;
        const imgW = containerW * imgScale;
        const imgH = avatarImg.height * (imgW / avatarImg.width);
        const imgX = cx + (containerW - imgW) / 2;
        const imgY = y + HEADER_H - imgH;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - 10, y, containerW + 20, HEADER_H);
        ctx.clip();
        ctx.drawImage(avatarImg, imgX, imgY, imgW, imgH);
        ctx.restore();
        cx += containerW + 20;
      }
    }

    const displayName = state.chatConfig.isGroup
      ? state.chatConfig.groupName || others.map((o) => o.name).join(", ")
      : (state.chatConfig.headerName || state.chatConfig.contactName);

    const callImg = !isCropped ? this.images.get("callIcons") : null;
    const callIconsW = callImg ? callImg.width * (90 / callImg.height) + 50 : 0;
    const maxNameW = this.W - cx - callIconsW - 10;

    let nameFontSize = 50;
    ctx.font = `900 ${nameFontSize}px ${FONT_HEADER}`;
    let nameW = ctx.measureText(displayName).width;
    while (nameW > maxNameW && nameFontSize > 28) {
      nameFontSize -= 2;
      ctx.font = `900 ${nameFontSize}px ${FONT_HEADER}`;
      nameW = ctx.measureText(displayName).width;
    }

    ctx.fillStyle = "#111827";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    this.fillTextWithEmoji(ctx, displayName, cx, y + HEADER_H / 2, FONT_HEADER, nameFontSize);

    if (callImg) {
      const ih = 90;
      const iw = callImg.width * (ih / callImg.height);
      ctx.drawImage(
        callImg,
        this.W - iw - 40,
        y + (HEADER_H - ih) / 2,
        iw,
        ih,
      );
    }
  }

  private drawMessages(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    areaY: number,
    areaH: number,
  ): void {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, areaY, this.W, areaH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, areaY, this.W, areaH);
    ctx.clip();

    const isCropped = state.chatConfig.isKeyboardCropped;
    const padX = isCropped ? MSG_PAD_X_CROPPED : MSG_PAD_X;
    const maxTextW = this.W - padX - MSG_PAD_X - BAR_WIDTH - BAR_GAP;

    this.currentSnapOpenedIds = state.snapOpenedIds || new Set();
    const msgs = state.messages.filter((m) => m.type !== MessageType.PRESENCE && m.type !== MessageType.OPEN_SNAP);
    const layouts: MsgLayout[] = [];
    let totalH = 80;

    const msgFontSize = state.chatConfig.messageFontSize || MSG_FONT_SIZE;
    const msgLineH = Math.round(msgFontSize * (MSG_LINE_H / MSG_FONT_SIZE));

    ctx.font = `400 ${msgFontSize}px ${FONT_REGULAR}`;

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const prev = i > 0 ? msgs[i - 1] : null;
      const isGrouped = !!(
        prev &&
        msg.senderId === prev.senderId &&
        prev.type !== MessageType.NOTIFICATION &&
        msg.type !== MessageType.NOTIFICATION
      );
      const sender = state.cast.find((c) => c.id === msg.senderId);
      const color =
        sender?.color || (sender?.isMe ? SNAP_COLORS.ME : SNAP_COLORS.THEM);

      let h = 0;
      let lines: string[] = [];

      if (msg.type === MessageType.NOTIFICATION) {
        const notifSize = Math.round(msgFontSize * 0.6);
        ctx.font = `900 ${notifSize}px ${FONT_REGULAR}`;
        lines = this.wrapText(ctx, msg.text || "", this.W - padX * 4);
        h = 50 + lines.length * (notifSize + 10);
      } else {
        const nameSize = Math.round(msgFontSize * 0.75);
        if (!isGrouped) h += nameSize + 14;

        ctx.font = `400 ${msgFontSize}px ${FONT_REGULAR}`;

        if (msg.type === MessageType.SNAP) {
          h += 100;
        } else if (msg.type === MessageType.CONTACT_CARD) {
          h += 165;
        } else if (msg.type === MessageType.STICKER) {
          h += 200;
        } else if (msg.type === MessageType.IMAGE || msg.type === MessageType.GIF) {
          lines = msg.text ? this.wrapText(ctx, msg.text, maxTextW) : [];
          h += lines.length * msgLineH;
          const layoutImgEl = this.images.get(`media_${msg.id}`);
          const layoutVidEl = this.gifVideos.get(`media_${msg.id}`);
          const layoutW = layoutVidEl ? layoutVidEl.videoWidth : (layoutImgEl?.width ?? 0);
          const layoutH = layoutVidEl ? layoutVidEl.videoHeight : (layoutImgEl?.height ?? 0);
          if (layoutW > 0 && layoutH > 0) {
            h += Math.round(420 / (layoutW / layoutH));
          } else {
            h += msg.isVertical ? 420 : 300;
          }
          if (lines.length > 0) h += 10;
        } else {
          lines = this.wrapText(ctx, msg.text || "", maxTextW);
          h += lines.length * msgLineH;
        }

        h += isGrouped ? 6 : 10;
      }

      totalH += h;
      layouts.push({ msg, h, isGrouped, lines, sender, color });
    }

    let presenceGap: number;
    if (!this.presenceEnabled) {
      presenceGap = 40;
    } else if (state.chatConfig.isGroup) {
      const hasGroupParticipants = state.scriptParticipantIds.length > 0;
      presenceGap = hasGroupParticipants ? Math.round(55 * 2.77) : Math.round(30 * 2.77);
    } else {
      presenceGap = 90;
    }
    let drawY = areaY + areaH - presenceGap;

    const drawYs: number[] = new Array(layouts.length);
    for (let i = layouts.length - 1; i >= 0; i--) {
      drawY -= layouts[i].h;
      drawYs[i] = drawY;
    }

    for (let i = 0; i < layouts.length; i++) {
      const item = layouts[i];
      const y = drawYs[i];
      if (y + item.h < areaY - 20) continue;
      if (y > areaY + areaH + 20) continue;
      this.drawMessage(ctx, state, item, y, padX, maxTextW, false, msgFontSize, msgLineH);
    }

    for (let i = 0; i < layouts.length; i++) {
      const item = layouts[i];
      if (item.msg.type === MessageType.NOTIFICATION || item.msg.type === MessageType.IOS_NOTIFICATION) continue;

      if (item.isGrouped) continue;

      let groupEndIdx = i;
      while (
        groupEndIdx + 1 < layouts.length &&
        layouts[groupEndIdx + 1].isGrouped
      ) {
        groupEndIdx++;
      }

      const firstY = drawYs[i];
      const lastItem = layouts[groupEndIdx];
      const lastY = drawYs[groupEndIdx];
      const groupTopY = firstY + 10 + (Math.round(msgFontSize * 0.75) + 14);
      const groupBottomY = lastY + lastItem.h;

      if (groupBottomY < areaY - 20 || groupTopY > areaY + areaH + 20) continue;

      const color = item.color;
      const textBlockH = groupBottomY - groupTopY;
      const barDrawH = Math.max(textBlockH, 30);

      this.drawPillRect(ctx, padX, groupTopY, BAR_WIDTH, barDrawH, 3, color);
    }

    const todayY = drawY - 60;
    if (todayY > areaY - 20) {
      ctx.font = `900 30px ${FONT_REGULAR}`;
      ctx.fillStyle = "#D1D5DB";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("TODAY", this.W / 2, todayY + 30);
    }

    ctx.restore();
  }

  private drawMessage(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    item: MsgLayout,
    y: number,
    padX: number,
    maxTextW: number,
    drawBar: boolean = true,
    fontSize: number = MSG_FONT_SIZE,
    lineH: number = MSG_LINE_H,
  ): void {
    const { msg, isGrouped, lines, sender, color } = item;

    if (msg.type === MessageType.NOTIFICATION) {
      const notifSize = Math.round(fontSize * 0.6);
      ctx.font = `900 ${notifSize}px ${FONT_REGULAR}`;
      ctx.fillStyle = "#9CA3AF";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      let textY = y + 25;
      for (const line of lines) {
        this.fillTextWithEmoji(ctx, line, this.W / 2, textY, FONT_REGULAR, notifSize);
        textY += notifSize + 10;
      }
      return;
    }

    let curY = y + (isGrouped ? 6 : 10);

    const isFreshlySent = sender?.isMe && msg.revealedAt && (Date.now() - msg.revealedAt < 150);
    const textColor = isFreshlySent ? "#8E8E8E" : "#000000";

    if (!isGrouped) {
      const nameSize = Math.round(fontSize * 0.75);
      ctx.font = `700 ${nameSize}px ${FONT_REGULAR}`;
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      this.fillTextWithEmoji(ctx, sender?.name?.toUpperCase() || "", padX, curY, FONT_REGULAR, nameSize);
      curY += nameSize + 14;
    }

    const textStartX = padX + BAR_WIDTH + BAR_GAP;
    const barStartY = curY;

    if (msg.type === MessageType.SNAP) {
      const snapOpened = this.currentSnapOpenedIds.has(msg.id);
      const snapTapping = state.snapTappingId === msg.id;
      curY += this.drawSnapBubble(ctx, textStartX, curY, maxTextW, snapOpened, snapTapping, msg.snapLabel);
    } else if (msg.type === MessageType.CONTACT_CARD) {
      this.drawContactCard(ctx, msg, textStartX, curY, fontSize);
      curY += 155;
    } else if (msg.type === MessageType.STICKER) {
      const stickerImg = this.images.get(`media_${msg.id}`);
      if (stickerImg) {
        const sh = 180;
        const sw = stickerImg.width * (sh / stickerImg.height);
        ctx.drawImage(stickerImg, textStartX, curY, Math.min(sw, 400), sh);
        curY += sh + 10;
      } else {
        curY += 180;
      }
    } else if (msg.type === MessageType.IMAGE || msg.type === MessageType.GIF) {
      if (lines.length > 0) {
        ctx.font = `400 ${fontSize}px ${FONT_REGULAR}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for (const line of lines) {
          this.fillTextWithEmoji(ctx, line, textStartX, curY + lineH / 2, FONT_REGULAR, fontSize);
          curY += lineH;
        }
        curY += 10;
      }

      const vidEl = this.gifVideos.get(`media_${msg.id}`);
      const imgEl = this.images.get(`media_${msg.id}`);
      const mediaEl = vidEl || imgEl;
      const mediaW = vidEl ? vidEl.videoWidth : (imgEl?.width ?? 0);
      const mediaH = vidEl ? vidEl.videoHeight : (imgEl?.height ?? 0);
      if (mediaEl && mediaW > 0 && mediaH > 0) {
        const maxW = 420;
        const ratio = mediaW / mediaH;
        const drawW = maxW;
        const drawH = maxW / ratio;
        this.drawRoundedImage(ctx, mediaEl as HTMLImageElement | HTMLVideoElement, textStartX, curY, drawW, drawH, 50, false);
        curY += drawH + 10;
      } else {
        curY += msg.isVertical ? 400 : 280;
      }
    } else {
      ctx.font = `400 ${fontSize}px ${FONT_REGULAR}`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (const line of lines) {
        this.fillTextWithEmoji(ctx, line, textStartX, curY + lineH / 2, FONT_REGULAR, fontSize);
        curY += lineH;
      }
    }

    if (drawBar) {
      const barColor = isFreshlySent ? "#C0C0C0" : color;
      const barH = Math.max(curY - barStartY, 30);
      if (!isGrouped) {
        this.drawPillRect(ctx, padX, barStartY, BAR_WIDTH, barH, 3, barColor);
      } else {
        ctx.fillStyle = barColor;
        ctx.fillRect(padX, barStartY, BAR_WIDTH, barH);
      }
    }
  }

  private drawSnapBubble(
    ctx: CanvasRenderingContext2D,
    textStartX: number,
    y: number,
    maxTextW: number,
    snapOpened: boolean,
    snapTapping = false,
    snapLabel?: string,
  ): number {
    const cardH = 100;
    const cardW = Math.min(750, maxTextW);
    const cardRadius = 18;

    // Tapping: flash gray background
    const cardFill = snapTapping ? '#D1D5DB' : '#FFFFFF';

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.06)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = cardFill;
    ctx.beginPath();
    (ctx as any).roundRect(textStartX, y, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = snapTapping ? '#9CA3AF' : '#E5E7EB';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    (ctx as any).roundRect(textStartX, y, cardW, cardH, cardRadius);
    ctx.stroke();

    const fontSize = 38;
    const sqSize = 38;
    const sqRadius = 8;
    const sqX = textStartX + 22;
    const sqY = y + (cardH - sqSize) / 2;

    // Record canvas-space coordinates using current transform matrix so the
    // zoom animation works correctly regardless of uiScale / safeScale transforms.
    const m = ctx.getTransform();
    this.snapOriginRect = {
      x: m.a * sqX + m.c * sqY + m.e,
      y: m.b * sqX + m.d * sqY + m.f,
      w: m.a * sqSize,
      h: m.d * sqSize,
    };

    if (!snapOpened) {
      ctx.fillStyle = '#E8453C';
      ctx.beginPath();
      (ctx as any).roundRect(sqX, sqY, sqSize, sqSize, sqRadius);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#E8453C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      (ctx as any).roundRect(sqX, sqY, sqSize, sqSize, sqRadius);
      ctx.stroke();

      const camBtnImg = this.images.get("cameraBtn");
      const camBtnSize = 66;
      const camBtnX = textStartX + cardW - camBtnSize - 14;
      const camBtnY = y + (cardH - camBtnSize) / 2;
      if (camBtnImg) {
        ctx.drawImage(camBtnImg, camBtnX, camBtnY, camBtnSize, camBtnSize);
      }
    }

    const textX = sqX + sqSize + 16;
    const label = snapOpened ? 'Hold to replay or save' : (snapLabel || 'Tap to view');
    ctx.font = `700 ${fontSize}px ${FONT_REGULAR}`;
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, textX, y + cardH / 2);

    return cardH;
  }

  private drawSnapFullscreen(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
  ): void {
    const OPEN_DUR = 280;
    const CLOSE_DUR = 250;
    const imgCornerR = 18; // visible rounded corners on the snap image
    const sqRadius = 8;

    // t = 0: image at snap bubble square, t = 1: image fills snap area
    let t = 1;

    if (state.snapOpeningStartTime !== undefined) {
      const elapsed = state.time - state.snapOpeningStartTime;
      const raw = Math.min(Math.max(elapsed / OPEN_DUR, 0), 1);
      t = 1 - Math.pow(1 - raw, 3);
    } else if (state.snapClosingStartTime !== undefined) {
      const elapsed = state.time - state.snapClosingStartTime;
      const raw = Math.min(Math.max(elapsed / CLOSE_DUR, 0), 1);
      t = 1 - Math.pow(raw, 2);
    }

    const pr = this.phoneCanvasRect;

    // The snap stays confined to the phone area (so the video background remains
    // visible around it). The status bar is drawn so it is PIXEL-IDENTICAL to the
    // chat-mode status bar: the chat draws it with the phone scale (phoneScaleX/Y)
    // and then an extra uiScale, laying it out across `this.W / uiScale`. We
    // replicate that exact transform here. The larger bar pushes the snap image
    // down, adding the extra black space on top, exactly as requested.
    const uiScale = state.systemConfig.uiScale || 1;
    const sbScaleX = this.phoneScaleX * uiScale;
    const sbScaleY = this.phoneScaleY * uiScale;
    const statusLocalW = this.W / uiScale; // same layout width the chat uses

    // Uniform-ish scale used for the snap menu dots (small overlay)
    const scale = sbScaleX;

    // Canvas-space heights for the status bar and the snap bottom bar
    // snapChatBar image is 497×121 — maintain aspect ratio across the phone width
    const statusBarCanvasH = STATUS_BAR_H * sbScaleY;
    const snapBarCanvasH = Math.round(pr.w * (121 / 497));

    // Origin: snap bubble square (canvas-space) — animates from the phone area
    const origin = this.snapOriginRect ?? {
      x: pr.x + pr.w / 2 - 19,
      y: pr.y + pr.h / 2 - 19,
      w: 38,
      h: 38,
    };

    // Target: phone area minus status bar at top and send-bar at bottom
    const targetX = pr.x;
    const targetY = pr.y + statusBarCanvasH;
    const targetW = pr.w;
    const targetH = pr.h - statusBarCanvasH - snapBarCanvasH;

    const ix = origin.x + (targetX - origin.x) * t;
    const iy = origin.y + (targetY - origin.y) * t;
    const iw = origin.w + (targetW - origin.w) * t;
    const ih = origin.h + (targetH - origin.h) * t;
    const ir = sqRadius + (imgCornerR - sqRadius) * t;

    // Black bg clipped to phone area only
    ctx.save();
    ctx.beginPath();
    ctx.rect(pr.x, pr.y, pr.w, pr.h);
    ctx.clip();
    ctx.fillStyle = `rgba(0,0,0,${t})`;
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    ctx.restore();

    // Snap image with rounded corners, bottom-anchored within the image area
    const img = this.images.get(`snap_${state.snapFullscreenEventId}`);
    ctx.save();
    ctx.beginPath();
    (ctx as any).roundRect(ix, iy, iw, ih, Math.max(ir, 0));
    ctx.clip();

    if (img && img.width > 0 && img.height > 0) {
      const imgR = img.width / img.height;
      const canR = iw / ih;
      let dx: number, dy: number, dw: number, dh: number;
      if (imgR > canR) {
        // Wider image: fill height, clip sides; bottom of image = bottom of frame
        dh = ih; dw = ih * imgR;
        dx = ix + (iw - dw) / 2; dy = iy + ih - dh;
      } else {
        // Taller image: fill width, clip top; bottom of image = bottom of frame
        dw = iw; dh = iw / imgR;
        dx = ix; dy = iy + ih - dh;
      }
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(ix, iy, iw, ih);
    }
    ctx.restore();

    // Overlays fade in as snap opens
    const dotAlpha = t > 0.7 ? (t - 0.7) / 0.3 : 0;
    if (dotAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = dotAlpha;

      // ── White status bar — pixel-identical to the chat status bar ──────────
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.scale(sbScaleX, sbScaleY);
      this.drawStatusBar(ctx, state, 0, '#FFFFFF', statusLocalW);
      ctx.restore();

      // ── "Send a chat" bottom bar (image asset) ──────────────────────────
      const barY = pr.y + pr.h - snapBarCanvasH;
      const snapChatBarImg = this.images.get('snapChatBar');
      if (snapChatBarImg && snapChatBarImg.width > 0) {
        ctx.drawImage(snapChatBarImg, pr.x, barY, pr.w, snapBarCanvasH);
      }

      // ── 3 vertical dots ──────────────────────────────────────────────────
      const dotR = 7 * scale;
      const dotSpacing = 19 * scale;
      const dotsX = pr.x + pr.w - 38 * scale;
      const dotsStartY = pr.y + statusBarCanvasH + 36 * scale;
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(dotsX, dotsStartY + i * dotSpacing, dotR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private drawEndScreen(ctx: CanvasRenderingContext2D, state: FrameState): void {
    const FADE_DUR = 600;
    const t = Math.min(1, Math.max(0, (state.time - (state.endScreenStartTime ?? 0)) / FADE_DUR));
    const pr = this.phoneCanvasRect;

    if (this.endScreenSnapshot) {
      ctx.save();
      ctx.filter = `blur(${Math.round(30 * t)}px)`;
      ctx.globalAlpha = Math.min(1, t * 1.3);
      ctx.drawImage(this.endScreenSnapshot, 0, 0, this.W, this.H, 0, 0, this.W, this.H);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    ctx.fillStyle = `rgba(255,255,255,${t * 0.38})`;
    ctx.fillRect(0, 0, this.W, this.H);

    if (t > 0.3 && state.chatConfig.endScreenText) {
      const textAlpha = Math.min(1, (t - 0.3) / 0.45);
      ctx.save();
      ctx.globalAlpha = textAlpha;
      const fontSize = Math.round(this.W * 0.052);
      ctx.font = `900 ${fontSize}px ${FONT_HEADER}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = pr.w * 0.78;
      // Respect explicit newlines before word-wrapping each paragraph
      const paragraphs = state.chatConfig.endScreenText.split('\n');
      const lines: string[] = [];
      for (const para of paragraphs) {
        if (para === '') {
          lines.push('');
        } else {
          lines.push(...this.wrapText(ctx, para, maxW));
        }
      }
      const lineH = Math.round(fontSize * 1.35);
      const totalH = lines.length * lineH;
      const startY = pr.y + pr.h / 2 - totalH / 2 + lineH / 2;
      const textColor = state.chatConfig.endScreenTextColor ?? '#000000';
      // Shadow contrasts with text color based on luminance
      const r = parseInt(textColor.slice(1, 3), 16);
      const g = parseInt(textColor.slice(3, 5), 16);
      const b = parseInt(textColor.slice(5, 7), 16);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      ctx.shadowColor = lum > 0.5 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';
      ctx.shadowBlur = 24;
      ctx.fillStyle = textColor;
      lines.forEach((line, i) => {
        ctx.fillText(line, pr.x + pr.w / 2, startY + i * lineH);
      });
      ctx.restore();
    }
  }

  private drawContactCard(
    ctx: CanvasRenderingContext2D,
    msg: ScriptEvent,
    x: number,
    y: number,
    fontSize: number,
  ): void {
    const cardW = 510;
    const cardH = 148;
    const cardR = 28;
    const pad = 22;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.10)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    this.pillPath(ctx, x, y, cardW, cardH, cardR);
    ctx.fill();
    ctx.restore();

    const avatarSize = 90;
    const avatarX = x + pad;
    const avatarCY = y + cardH / 2;
    const avatarImg = this.images.get(`contact_${msg.id}`);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarCY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    if (avatarImg) {
      ctx.drawImage(avatarImg, avatarX, avatarCY - avatarSize / 2, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = '#E5E7EB';
      ctx.fill();
    }
    ctx.restore();

    const textX = avatarX + avatarSize + 20;
    const nameSize = Math.round(fontSize * 0.80);
    const usernameSize = Math.round(fontSize * 0.60);

    const btnW = 70;
    const btnH = 36;
    const btnGap = 10;
    const btnAreaRight = x + cardW - pad;
    const btn2X = btnAreaRight - btnW;
    const btn1X = btn2X - btnW - btnGap;
    const btnY = y + cardH / 2 - btnH / 2;
    const btnR = btnH / 2;

    const textMaxW = btn1X - textX - 10;
    const nameY = y + cardH / 2 - 6;
    ctx.save();
    ctx.font = `700 ${nameSize}px ${FONT_REGULAR}`;
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.beginPath();
    ctx.rect(textX, y, textMaxW, cardH);
    ctx.clip();
    this.fillTextWithEmoji(ctx, msg.contactCardName || 'Contact', textX, nameY, FONT_REGULAR, nameSize);
    ctx.restore();

    const usernameY = y + cardH / 2 + usernameSize + 2;
    ctx.save();
    ctx.font = `400 ${usernameSize}px ${FONT_REGULAR}`;
    ctx.fillStyle = '#9CA3AF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.beginPath();
    ctx.rect(textX, y, textMaxW, cardH);
    ctx.clip();
    ctx.fillText(msg.contactCardUsername || '', textX, usernameY);
    ctx.restore();

    for (const bx of [btn1X, btn2X]) {
      ctx.save();
      ctx.fillStyle = '#FFFC00';
      ctx.beginPath();
      this.pillPath(ctx, bx, btnY, btnW, btnH, btnR);
      ctx.fill();
      ctx.restore();
    }

    // Chat icon: Snapchat-style chat bubble SVG (viewBox 0 0 16 16)
    const chatCX = btn1X + btnW / 2;
    const chatCY = btnY + btnH / 2;
    const chatIconPath = new Path2D(
      'M3 4.353C3 3.053 4.053 2 5.353 2h5.294C11.947 2 13 3.053 13 4.353v9.854a.5.5 0 0 1-.809.393L9.202 12.25A1.176 1.176 0 0 0 8.475 12H5.353A2.353 2.353 0 0 1 3 9.647V4.353Z'
    );
    const chatIconScale = (btnH * 0.62) / 16;
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.translate(chatCX - 8 * chatIconScale, chatCY - 8 * chatIconScale);
    ctx.scale(chatIconScale, chatIconScale);
    ctx.fill(chatIconPath);
    ctx.restore();

    // Camera icon: Snapchat-style camera SVG (viewBox 0 0 70 70, evenodd)
    const camCX = btn2X + btnW / 2;
    const camCY = btnY + btnH / 2;
    const camIconScale = (btnH * 0.68) / 70;
    const camIconPath = new Path2D(
      'M35 45.118c-4.56 0-8.27-3.708-8.27-8.268 0-4.559 3.71-8.267 8.27-8.267 4.562 0 8.271 3.708 8.271 8.267 0 4.56-3.71 8.268-8.27 8.268Z' +
      'M21.317 36.85c0-7.543 6.138-13.678 13.684-13.678 7.547 0 13.684 6.135 13.684 13.678 0 7.542-6.137 13.68-13.684 13.68-7.546 0-13.684-6.138-13.684-13.68Z' +
      'M56.29 18.934c-2.052-.867-4.398-1.601-6.994-2.214a18.079 18.079 0 0 0-.675-2.078 4.97 4.97 0 0 0-2.719-2.755c-2.04-.861-5.59-1.888-10.9-1.888-5.312 0-8.862 1.027-10.904 1.888a4.975 4.975 0 0 0-2.716 2.754c-.259.65-.487 1.35-.7 2.109-2.572.583-4.92 1.317-6.972 2.184-2.188.923-3.865 2.623-4.725 4.784-1.165 2.935-2.556 7.73-2.556 13.914 0 6.376 1.47 11.278 2.7 14.266a8.738 8.738 0 0 0 4.378 4.618C16.914 58.105 23.409 60 35.002 60c11.59 0 18.084-1.894 21.493-3.483a8.74 8.74 0 0 0 4.376-4.618c1.231-2.988 2.7-7.89 2.7-14.266 0-6.184-1.39-10.98-2.556-13.912-.858-2.165-2.537-3.863-4.725-4.786Z'
    );
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.translate(camCX - 35 * camIconScale, camCY - 35 * camIconScale);
    ctx.scale(camIconScale, camIconScale);
    ctx.fill(camIconPath, 'evenodd');
    ctx.restore();
  }

  private drawTypingIndicator(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    areaBottom: number,
  ): void {
    if (!this.presenceEnabled) return;

    const isGroup = state.chatConfig.isGroup;
    const isCropped = state.chatConfig.isKeyboardCropped;
    const padLeft = isCropped ? 183 : Math.round(5 * 2.77);

    if (isGroup) {
      this.drawGroupPresence(ctx, state, areaBottom, padLeft);
    } else {
      this.drawSinglePresence(ctx, state, areaBottom, padLeft);
    }
  }

  private getPresenceAnim(
    id: string,
    isArrived: boolean,
    isTyping: boolean,
    time: number,
  ): PresenceAnimState {
    let anim = this.presenceAnims.get(id);
    if (!anim) {
      anim = {
        arrived: isArrived,
        arrivalStartTime: time,
        typing: isTyping,
        typingStartTime: time,
        hasEverArrived: isArrived,
        hasEverTyped: isTyping,
      };
      this.presenceAnims.set(id, anim);
      return anim;
    }
    if (isArrived !== anim.arrived) {
      if (isArrived) {
        anim.hasEverArrived = true;
      }
      anim.arrived = isArrived;
      anim.arrivalStartTime = time;
    }
    if (isTyping !== anim.typing) {
      if (isTyping) {
        anim.hasEverTyped = true;
      }
      anim.typing = isTyping;
      anim.typingStartTime = time;
    }
    return anim;
  }

  private easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number, t: number): number {
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;

    let guessT = t;
    for (let i = 0; i < 8; i++) {
      const currentX = ((ax * guessT + bx) * guessT + cx) * guessT;
      const currentSlope = (3 * ax * guessT + 2 * bx) * guessT + cx;
      if (Math.abs(currentSlope) < 1e-6) break;
      guessT -= (currentX - t) / currentSlope;
    }
    guessT = Math.max(0, Math.min(1, guessT));
    return ((ay * guessT + by) * guessT + cy) * guessT;
  }

  // ═══════════════════════════════════════════════════════════════
  // MANUAL ADJUSTMENT: Single-person presence (1-on-1 chat)
  // Change these values to reposition the bitmoji & typing bubble.
  // Positive X = move right, Negative X = move left.
  // Positive Y = move down, Negative Y = move up.
  // ═══════════════════════════════════════════════════════════════
  private static readonly SINGLE_PRESENCE = {
    AVATAR_OFFSET_X: 0, // Shift bitmoji left/right (px)
    AVATAR_OFFSET_Y: 0, // Shift bitmoji up/down (px)
    BUBBLE_OFFSET_X: 0, // Shift typing bubble left/right (px)
    BUBBLE_OFFSET_Y: -35, // Shift typing bubble up/down (px)
    AVATAR_WIDTH: 188, // Bitmoji container width (standard mode)
    AVATAR_WIDTH_SHORT: 105, // Bitmoji container width (short crop mode)
    TYPING_NUDGE_Y: -8, // How far bitmoji nudges up when typing
    TYPING_SCALE: 0.1, // How much bitmoji scales up when typing (0.1 = 10%)
    TYPING_SINK: 0.20, // Fraction of selfie image hidden below divider when typing (0.34 = 34%)
    BUBBLE_SIZE: 55, // Typing bubble diameter
    BUBBLE_BOTTOM_GAP: 55, // Distance from bottom to bubble (standard)
    BUBBLE_BOTTOM_GAP_SHORT: 7, // Distance from bottom to bubble (short crop)
  };

  private drawSinglePresence(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    bottom: number,
    padLeft: number,
  ): void {
    const SP = CanvasRenderer.SINGLE_PRESENCE;
    const partner = state.cast.find((c) => !c.isMe);
    if (!partner) return;

    const isArrived = state.activeParticipantIds.includes(partner.id);
    const isTyping = state.typingParticipantIds.includes(partner.id);
    const anim = this.getPresenceAnim(
      partner.id,
      isArrived,
      isTyping,
      state.time,
    );

    if (!anim.hasEverArrived) return;

    const isShort = state.chatConfig.isShortCrop;
    const isCropped = state.chatConfig.isKeyboardCropped;
    const containerW = isShort ? SP.AVATAR_WIDTH_SHORT : SP.AVATAR_WIDTH;
    const S = 2.77;

    const cameraBtnW = Math.round(34 * S);
    const cameraBtnX = isCropped ? Math.round(12 * S) : padLeft;
    const avatarCenterX = cameraBtnX + cameraBtnW / 2 + SP.AVATAR_OFFSET_X;

    const arrivalDuration = 700;
    const arrivalElapsed = state.time - anim.arrivalStartTime;
    const arrivalProgress = Math.min(arrivalElapsed / arrivalDuration, 1);
    const arrivalEased = this.easeOut(arrivalProgress);

    const alpha = isArrived ? arrivalEased : 1 - arrivalEased;
    const arrivalSlideY = isArrived
      ? (1 - arrivalEased) * 110
      : arrivalEased * 110;

    if (alpha <= 0.01) return;

    const typingDuration = isTyping ? 450 : 300;
    const typingElapsed = state.time - anim.typingStartTime;
    const typingProgress = Math.min(typingElapsed / typingDuration, 1);
    const typingEased = this.easeOut(typingProgress);

    const typingNudgeY = isTyping
      ? typingEased * SP.TYPING_NUDGE_Y
      : (1 - typingEased) * SP.TYPING_NUDGE_Y;

    const totalSlideY = arrivalSlideY + typingNudgeY + SP.AVATAR_OFFSET_Y;

    const typingFrac = isTyping
      ? typingEased
      : anim.hasEverTyped ? 1 - typingEased : 0;

    const peekingKey = `peeking_${partner.bitmojiAvatarId}`;
    const selfieKey = `selfie_${partner.bitmojiAvatarId}`;
    const peekingImg = this.images.get(peekingKey);
    const selfieImg = this.images.get(selfieKey);

    const clipLeft = avatarCenterX - containerW * 1.5;
    const clipW = containerW * 3;

    if (peekingImg && typingFrac < 1) {
      const imgW = containerW;
      const imgH = peekingImg.height * (imgW / peekingImg.width);
      const ax = avatarCenterX - imgW / 2;
      const ay = bottom - imgH + totalSlideY;

      const clipTop = Math.min(ay, bottom - imgH);

      ctx.save();
      ctx.globalAlpha = alpha * (1 - typingFrac);
      ctx.beginPath();
      ctx.rect(clipLeft, clipTop, clipW, bottom - clipTop);
      ctx.clip();
      ctx.drawImage(peekingImg, ax, ay, imgW, imgH);
      ctx.restore();
    }

    if (selfieImg && typingFrac > 0) {
      const imgW = containerW * (1.0 + typingFrac * SP.TYPING_SCALE);
      const imgH = selfieImg.height * (imgW / selfieImg.width);
      const sinkOffset = SP.TYPING_SINK * imgH;
      const ax = avatarCenterX - imgW / 2;
      const ay = bottom - imgH + totalSlideY + sinkOffset;

      const clipTop = Math.min(ay, bottom - imgH);

      ctx.save();
      ctx.globalAlpha = alpha * typingFrac;
      ctx.beginPath();
      ctx.rect(clipLeft, clipTop, clipW, bottom - clipTop);
      ctx.clip();
      ctx.drawImage(selfieImg, ax, ay, imgW, imgH);
      ctx.restore();
    }

    const bubbleCenterX = avatarCenterX + SP.BUBBLE_OFFSET_X;
    const bubbleGap = isShort
      ? SP.BUBBLE_BOTTOM_GAP_SHORT
      : SP.BUBBLE_BOTTOM_GAP;

    const bubbleY =
      bottom -
      (bubbleGap + SP.BUBBLE_SIZE) +
      totalSlideY +
      SP.BUBBLE_OFFSET_Y;

    if (isTyping && typingEased > 0) {
      const t = this.cubicBezier(0.175, 0.885, 0.32, 1.15, typingEased);
      const bScale = 0.6 + 0.4 * t;
      const bRotate = -5 * (1 - t) * (Math.PI / 180);
      const bTranslateY = (1 - t) * 10;
      const bAlpha = alpha * t;

      ctx.save();
      ctx.globalAlpha = bAlpha;
      const originX = bubbleCenterX;
      const originY = bubbleY + SP.BUBBLE_SIZE;
      ctx.translate(originX, originY);
      ctx.rotate(bRotate);
      ctx.scale(bScale, bScale);
      ctx.translate(-originX, -originY + bTranslateY);
      this.drawTypingBubble(ctx, state.time, bubbleCenterX, bubbleY, SP.BUBBLE_SIZE);
      ctx.restore();
    } else if (!isTyping && typingEased < 1 && anim.hasEverTyped) {
      const rawT = typingEased;
      const t = this.cubicBezier(0.4, 0, 1, 1, rawT);
      const bScale = 1 - 0.6 * t;
      const bRotate = t * 10 * (Math.PI / 180);
      const bAlpha = alpha * (1 - t);

      ctx.save();
      ctx.globalAlpha = bAlpha;
      const originX = bubbleCenterX;
      const originY = bubbleY + SP.BUBBLE_SIZE;
      ctx.translate(originX, originY);
      ctx.rotate(bRotate);
      ctx.scale(bScale, bScale);
      ctx.translate(-originX, -originY);
      this.drawTypingBubble(ctx, state.time, bubbleCenterX, bubbleY, SP.BUBBLE_SIZE);
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GROUP PRESENCE SETTINGS — mirrors PresencePills.tsx constants
  // All values in CSS px, converted to canvas scale (S=2.77) at runtime
  // ═══════════════════════════════════════════════════════════════
  private static readonly GROUP_PRESENCE = {
    ROW_LEFT_PADDING: 5,
    ROW_GAP: -18,
    AVATAR_CONTAINER_W: 68,
    AVATAR_CONTAINER_H: 40,
    AVATAR_AREA_H: 120,
    AVATAR_NUDGE_Y: 0,
    AVATAR_SCALE: 1.0,
    BUBBLE_SCALE: 1.0,
    BUBBLE_X: 32,
    BUBBLE_Y: 15,
    PILL_BORDER: 1.5,
    PILL_PX: 8,
    PILL_PY: 4,
    PILL_FONT_SIZE: 9.5,
    PILL_MIN_W: 68,
    PILL_GAP: 4,
    ROW_BOTTOM_MARGIN: 10,
    SHORT_CROP: {
      ROW_LEFT_PADDING: 66,
      ITEM_SCALE: 0.68,
      ITEM_WIDTH: 38,
      BUBBLE_SCALE: 0.75,
      BUBBLE_X: 16,
      BUBBLE_Y: 14,
      PILL_FONT_SIZE: 8.5,
      PILL_MIN_W: 50,
    },
  };

  private drawGroupPresence(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    bottom: number,
    padLeft: number,
  ): void {
    const GP = CanvasRenderer.GROUP_PRESENCE;
    const S = 2.77;

    const participants = state.cast.filter(
      (c) => !c.isMe && state.scriptParticipantIds.includes(c.id),
    );
    if (participants.length === 0) return;

    const sorted = [
      ...state.activeParticipantIds
        .filter((id) => participants.some((p) => p.id === id))
        .map((id) => participants.find((p) => p.id === id)!),
      ...participants.filter((p) => !state.activeParticipantIds.includes(p.id)),
    ];

    const isShort = state.chatConfig.isShortCrop;
    const isCropped = state.chatConfig.isKeyboardCropped;

    const rowLeftPad = isCropped
      ? Math.round(GP.SHORT_CROP.ROW_LEFT_PADDING * S)
      : Math.round(GP.ROW_LEFT_PADDING * S) + padLeft;

    const itemW = Math.round((isShort ? GP.SHORT_CROP.ITEM_WIDTH : GP.AVATAR_CONTAINER_W) * S);
    const rowGap = Math.round(GP.ROW_GAP * S);
    const containerH = Math.round(GP.AVATAR_CONTAINER_H * S);
    const avatarAreaH = Math.round(GP.AVATAR_AREA_H * S);
    const rowBottomMargin = Math.round(GP.ROW_BOTTOM_MARGIN * S);

    const pillFontSize = Math.round((isShort ? GP.SHORT_CROP.PILL_FONT_SIZE : GP.PILL_FONT_SIZE) * S);
    const pillMinW = Math.round((isShort ? GP.SHORT_CROP.PILL_MIN_W : GP.PILL_MIN_W) * S);
    const pillGapBase = Math.round(GP.PILL_GAP * S);

    const bubbleScaleBase = isShort ? GP.SHORT_CROP.BUBBLE_SCALE : GP.BUBBLE_SCALE;
    const baseBubbleSize = 85;

    const pillFontSizeBase = pillFontSize;
    const pillPxBase = Math.round(GP.PILL_PX * S);
    const pillPyBase = Math.round(GP.PILL_PY * S);
    const pillMinWBase = pillMinW;
    const pillBorderWBase = GP.PILL_BORDER * S;

    ctx.font = `900 ${pillFontSizeBase}px ${FONT_REGULAR}`;
    const pillWidthsBase: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const textW = ctx.measureText(sorted[i].name.toUpperCase()).width;
      pillWidthsBase.push(Math.max(textW + pillPxBase * 2, pillMinWBase));
    }

    const totalBaseWidth = pillWidthsBase.reduce((a, b) => a + b, 0) + pillGapBase * Math.max(0, sorted.length - 1);
    const rightPad = Math.round(12 * S);
    const availableWidth = this.W - rowLeftPad - rightPad;
    let scaleFactor = 1;
    if (totalBaseWidth > availableWidth && sorted.length > 1) {
      scaleFactor = Math.max(0.55, availableWidth / totalBaseWidth);
    }

    const sPillFontSize = Math.round(pillFontSizeBase * scaleFactor);
    const sPillPx = Math.round(pillPxBase * scaleFactor);
    const sPillPy = Math.round(pillPyBase * scaleFactor);
    const sPillMinW = Math.round(pillMinWBase * scaleFactor);
    const sPillBorderW = pillBorderWBase * scaleFactor;
    const sPillGap = Math.round(pillGapBase * scaleFactor);
    const sItemW = Math.round(itemW * scaleFactor);
    const sContainerH = Math.round(containerH * scaleFactor);
    const sBubbleX = Math.round((isShort ? GP.SHORT_CROP.BUBBLE_X : GP.BUBBLE_X) * S * scaleFactor);
    const sBubbleY = Math.round((isShort ? GP.SHORT_CROP.BUBBLE_Y : GP.BUBBLE_Y) * S * scaleFactor);
    const sBubbleSize = Math.round(baseBubbleSize * bubbleScaleBase * scaleFactor);

    ctx.font = `900 ${sPillFontSize}px ${FONT_REGULAR}`;
    const sPillH = sPillFontSize + sPillPy * 2;

    const pillWidths: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      ctx.font = `900 ${sPillFontSize}px ${FONT_REGULAR}`;
      const textW = ctx.measureText(sorted[i].name.toUpperCase()).width;
      pillWidths.push(Math.max(textW + sPillPx * 2, sPillMinW));
    }

    const pillBottomEdge = bottom - rowBottomMargin;
    const pillTopY = pillBottomEdge - sPillH;
    const containerBottom = pillTopY;

    const pillXs: number[] = [];
    let curX = rowLeftPad;
    for (let i = 0; i < sorted.length; i++) {
      pillXs.push(curX);
      if (i < sorted.length - 1) {
        curX += pillWidths[i] + sPillGap;
      }
    }

    for (let i = 0; i < sorted.length; i++) {
      const member = sorted[i];
      const isTyping = state.typingParticipantIds.includes(member.id);
      const hasArrived = state.activeParticipantIds.includes(member.id);
      const pillColor = hasArrived ? member.color || "#33B5FF" : "#CCCCCC";
      const anim = this.getPresenceAnim(
        member.id,
        hasArrived,
        isTyping,
        state.time,
      );

      const pillW = pillWidths[i];
      const pX = pillXs[i];
      const pY = pillTopY;
      const pillCenterX = pX + pillW / 2;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.08)";
      ctx.shadowBlur = Math.round(4 * S * scaleFactor);
      ctx.shadowOffsetY = Math.round(1 * S * scaleFactor);
      ctx.fillStyle = "#FFFFFF";
      this.drawPillRect(ctx, pX, pY, pillW, sPillH, sPillH / 2, "#FFFFFF");
      ctx.restore();

      ctx.strokeStyle = pillColor;
      ctx.lineWidth = sPillBorderW;
      ctx.beginPath();
      this.pillPath(ctx, pX, pY, pillW, sPillH, sPillH / 2);
      ctx.stroke();

      ctx.font = `900 ${sPillFontSize}px ${FONT_REGULAR}`;
      ctx.fillStyle = pillColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this.fillTextWithEmoji(ctx, member.name.toUpperCase(), pillCenterX, pY + sPillH / 2, FONT_REGULAR, sPillFontSize);

      if (anim.hasEverArrived) {
        const arrivalDuration = 500;
        const arrivalElapsed = state.time - anim.arrivalStartTime;
        const arrivalProgress = Math.min(arrivalElapsed / arrivalDuration, 1);
        const arrivalEased = this.easeOut(arrivalProgress);

        const alpha = hasArrived ? arrivalEased : 1 - arrivalEased;
        const arrivalSlideY = hasArrived
          ? (1 - arrivalEased) * Math.round(40 * S * scaleFactor)
          : arrivalEased * Math.round(40 * S * scaleFactor);

        if (alpha > 0.01) {
          const peekingKey = `peeking_${member.bitmojiAvatarId}`;
          const selfieKey = `selfie_${member.bitmojiAvatarId}`;
          const peekingImg = this.images.get(peekingKey);
          const selfieImg = this.images.get(selfieKey);

          const activeImg = isTyping ? selfieImg : peekingImg;

          if (activeImg) {
            const imgW = sItemW * GP.AVATAR_SCALE;
            const imgH = activeImg.height * (imgW / activeImg.width);
            const ax = pillCenterX - imgW / 2;
            const ay = containerBottom - imgH + arrivalSlideY;

            const clipOverflowSide = Math.round(60 * S * scaleFactor);
            const clipOverflowTop = Math.round(100 * S * scaleFactor);
            const clipLeft = pillCenterX - sItemW / 2 - clipOverflowSide;
            const clipW = sItemW + clipOverflowSide * 2;
            const clipTop = containerBottom - sContainerH - clipOverflowTop;
            const clipH = containerBottom - clipTop;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.rect(clipLeft, clipTop, clipW, clipH);
            ctx.clip();
            ctx.drawImage(activeImg, ax, ay, imgW, imgH);
            ctx.restore();
          }

          const grpBubbleX = pillCenterX - sItemW / 2 + sBubbleX;
          const grpBubbleY = containerBottom - sBubbleY - sBubbleSize;

          const typingDuration = isTyping ? 450 : 300;
          const typingElapsed = state.time - anim.typingStartTime;
          const typingProgress = Math.min(typingElapsed / typingDuration, 1);
          const typingEased = this.easeOut(typingProgress);

          if (isTyping && typingEased > 0) {
            const t = this.cubicBezier(0.175, 0.885, 0.32, 1.15, typingEased);
            const bScale = 0.6 + 0.4 * t;
            const bRotate = -5 * (1 - t) * (Math.PI / 180);
            const bTranslateY = (1 - t) * 10;
            const bAlpha = alpha * t;

            ctx.save();
            ctx.globalAlpha = bAlpha;
            const ox = grpBubbleX;
            const oy = grpBubbleY + sBubbleSize;
            ctx.translate(ox, oy);
            ctx.rotate(bRotate);
            ctx.scale(bScale, bScale);
            ctx.translate(-ox, -oy + bTranslateY);
            this.drawTypingBubble(ctx, state.time, grpBubbleX, grpBubbleY, sBubbleSize);
            ctx.restore();
          } else if (!isTyping && typingEased < 1 && anim.hasEverTyped) {
            const t = this.cubicBezier(0.4, 0, 1, 1, typingEased);
            const bScale = 1 - 0.6 * t;
            const bRotate = t * 10 * (Math.PI / 180);
            const bAlpha = alpha * (1 - t);

            ctx.save();
            ctx.globalAlpha = bAlpha;
            const ox = grpBubbleX;
            const oy = grpBubbleY + sBubbleSize;
            ctx.translate(ox, oy);
            ctx.rotate(bRotate);
            ctx.scale(bScale, bScale);
            ctx.translate(-ox, -oy);
            this.drawTypingBubble(ctx, state.time, grpBubbleX, grpBubbleY, sBubbleSize);
            ctx.restore();
          }
        }
      }
    }
  }

  private drawTypingBubble(
    ctx: CanvasRenderingContext2D,
    time: number,
    x: number,
    y: number,
    size: number = 85,
  ): void {
    const bubbleSize = size;
    const svgScale = bubbleSize / 32;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(svgScale, svgScale);

    const silhouettePath = new Path2D(
      "M13.92 1.867c-2.006 0-3.754 1.21-4.663 2.998a4.888 4.888 0 0 0-.615-.039c-2.943 0-5.33 2.604-5.33 5.816 0 1.113.287 2.153.784 3.037a6.263 6.263 0 0 0-.39 2.188c0 3.211 2.386 5.815 5.33 5.815.148 0 .295-.007.44-.02.954 1.57 2.589 2.605 4.444 2.605 1.335 0 2.555-.536 3.49-1.42a4.949 4.949 0 0 0 2.284.558c2.85 0 5.177-2.441 5.322-5.512 1.597-1.005 2.672-2.886 2.672-5.042 0-2.422-1.358-4.498-3.288-5.373-.604-2.487-2.681-4.319-5.15-4.319a4.92 4.92 0 0 0-1.674.292c-.954-.982-2.24-1.584-3.656-1.584Z",
    );
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 0.9;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fill(silhouettePath);

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const bubblePath = new Path2D(
      "M13.92 2.333c1.248 0 2.424.52 3.32 1.443l.21.217.286-.103a4.45 4.45 0 0 1 1.514-.264c2.206 0 4.13 1.636 4.695 3.962l.053.22.208.095c1.804.817 3.013 2.756 3.013 4.948 0 1.945-.951 3.702-2.454 4.647l-.206.13-.012.243c-.133 2.842-2.274 5.067-4.853 5.067a4.477 4.477 0 0 1-2.068-.506l-.296-.153-.243.229c-.877.83-1.99 1.292-3.167 1.292-1.639 0-3.144-.901-4.042-2.38l-.152-.249-.291.027a4.496 4.496 0 0 1-.4.017c-2.674 0-4.86-2.385-4.86-5.348 0-.705.123-1.39.36-2.026l.076-.202-.106-.189a5.722 5.722 0 0 1-.724-2.808c0-2.963 2.186-5.35 4.86-5.35.188 0 .374.013.557.036l.328.041.15-.293c.855-1.684 2.468-2.743 4.244-2.743Z",
    );

    const grad = ctx.createLinearGradient(5.9, 8.3, 20.3, 21.2);
    grad.addColorStop(0, "#FFFFFF");
    grad.addColorStop(1, "#E9EDF2");
    ctx.fillStyle = grad;
    ctx.fill(bubblePath);

    ctx.strokeStyle = "#474A4F";
    ctx.lineWidth = 0.933;
    ctx.stroke(bubblePath);

    ctx.restore();

    const dotCX = x + bubbleSize * 0.46;
    const dotCY = y + bubbleSize * 0.44;
    const dotGap = bubbleSize * (15 / 85);
    const dotR = bubbleSize * (3.6 / 85);

    for (let i = 0; i < 3; i++) {
      const phase = ((time / 1200) * Math.PI * 2 + i * 0.8) % (Math.PI * 2);
      const opacity = 0.3 + 0.7 * Math.max(0, Math.sin(phase));
      const scale = 1 + 0.25 * Math.max(0, Math.sin(phase));

      ctx.globalAlpha = opacity;
      ctx.fillStyle = "#474A4F";
      ctx.beginPath();
      ctx.arc(dotCX + (i - 1) * dotGap, dotCY, dotR * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private measureEmojiSegmentWidth(emojiText: string, fontSize: number): number {
    const emojiChars = splitEmojiChars(emojiText);
    let w = 0;
    const emojiSize = fontSize * 1.15;
    for (const ch of emojiChars) {
      const img = this.getEmojiImage(ch);
      if (img) {
        w += emojiSize;
      } else {
        this.ctx.font = `${fontSize}px ${FONT_EMOJI}`;
        w += this.ctx.measureText(ch).width;
      }
    }
    return w;
  }

  private measureTextWithEmoji(
    ctx: CanvasRenderingContext2D,
    text: string,
    baseFont: string,
    fontSize: number,
  ): number {
    if (!hasEmoji(text)) return ctx.measureText(text).width;
    const segments = splitEmojiSegments(text);
    let w = 0;
    const savedFont = ctx.font;
    for (const seg of segments) {
      if (seg.isEmoji) {
        w += this.measureEmojiSegmentWidth(seg.text, fontSize);
      } else {
        ctx.font = savedFont;
        w += ctx.measureText(seg.text).width;
      }
    }
    ctx.font = savedFont;
    return w;
  }

  private fillTextWithEmoji(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    baseFont: string,
    fontSize: number,
  ): number {
    if (!hasEmoji(text)) {
      ctx.fillText(text, x, y);
      return ctx.measureText(text).width;
    }
    const segments = splitEmojiSegments(text);
    const savedFont = ctx.font;
    const savedBaseline = ctx.textBaseline;
    const savedAlign = ctx.textAlign;

    let totalW = 0;
    for (const seg of segments) {
      if (seg.isEmoji) {
        totalW += this.measureEmojiSegmentWidth(seg.text, fontSize);
      } else {
        ctx.font = savedFont;
        totalW += ctx.measureText(seg.text).width;
      }
    }

    let startX = x;
    if (savedAlign === "center") {
      startX = x - totalW / 2;
    } else if (savedAlign === "right" || savedAlign === "end") {
      startX = x - totalW;
    }

    ctx.textAlign = "left";
    let cx = startX;
    const emojiSize = fontSize * 1.15;
    for (const seg of segments) {
      if (seg.isEmoji) {
        const emojiChars = splitEmojiChars(seg.text);
        for (const ch of emojiChars) {
          const img = this.getEmojiImage(ch);
          if (img) {
            let drawY: number;
            if (savedBaseline === "middle") {
              drawY = y - emojiSize / 2 - fontSize * 0.05;
            } else if (savedBaseline === "top") {
              drawY = y - (emojiSize - fontSize) / 2 - fontSize * 0.05;
            } else {
              drawY = y - emojiSize * 0.82;
            }
            ctx.drawImage(img, cx, drawY, emojiSize, emojiSize);
            cx += emojiSize;
          } else {
            ctx.font = `${fontSize}px ${FONT_EMOJI}`;
            ctx.fillText(ch, cx, y);
            cx += ctx.measureText(ch).width;
          }
        }
      } else {
        ctx.font = savedFont;
        ctx.fillText(seg.text, cx, y);
        cx += ctx.measureText(seg.text).width;
      }
    }
    ctx.font = savedFont;
    ctx.textBaseline = savedBaseline;
    ctx.textAlign = savedAlign;
    return totalW;
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxW: number,
  ): string[] {
    if (!text) return [""];
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    const textHasEmoji = hasEmoji(text);
    const fontMatch = ctx.font.match(/(\d+)px/);
    const fontSize = fontMatch ? parseInt(fontMatch[1]) : 38;

    const measure = (s: string) =>
      textHasEmoji
        ? this.measureTextWithEmoji(ctx, s, FONT_REGULAR, fontSize)
        : ctx.measureText(s).width;

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const w = measure(test);
      if (w > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
      if (measure(line) > maxW) {
        let remaining = line;
        line = "";
        for (const ch of remaining) {
          const next = line + ch;
          if (measure(next) > maxW && line) {
            lines.push(line);
            line = ch;
          } else {
            line = next;
          }
        }
      }
    }
    if (line) lines.push(line);
    return lines.length > 0 ? lines : [""];
  }

  private getInputLayout(state: FrameState) {
    const S = 2.77;
    const isCropped = state.chatConfig.isKeyboardCropped;
    const hasText = state.compositionText.length > 0;
    const rowH = Math.round(34 * S);
    const rightPad = Math.round(8 * S);
    let cx = isCropped ? 183 : Math.round(5 * S);

    if (!isCropped) {
      cx += rowH + Math.round(10 * S);
    }

    const iconSize = Math.round(18 * S);
    const iconGap = Math.round(10 * S);
    const pillToIconGap = Math.round(10 * S);
    const smileySlotW = iconSize;
    const actionSlotW = hasText ? 0 : (iconSize * 2 + iconGap * 2);
    const iconAreaW = pillToIconGap + smileySlotW + actionSlotW;
    const pillW = this.W - cx - iconAreaW - rightPad;
    const textPadL = Math.round(16 * S);
    const textPadR = Math.round(36 * S);
    const textAreaW = pillW - textPadL - textPadR;

    return { S, isCropped, hasText, rowH, rightPad, cx, iconSize, iconGap, pillToIconGap, smileySlotW, actionSlotW, iconAreaW, pillW, textPadL, textPadR, textAreaW };
  }

  private computeInputHeight(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
  ): number {
    if (!state.compositionText) return INPUT_H;

    const layout = this.getInputLayout(state);
    const fontSize = Math.round(17 * layout.S);
    ctx.font = `400 ${fontSize}px ${FONT_REGULAR}`;
    const lines = this.wrapText(ctx, state.compositionText, layout.textAreaW);
    if (lines.length <= 1) return INPUT_H;

    const lineH = Math.round(fontSize * 1.25);
    const textBlockH = lines.length * lineH;
    const vPad = Math.round(12 * layout.S);
    const pillH = textBlockH + vPad * 2;
    const outerPad = Math.round(10 * layout.S);
    return Math.max(INPUT_H, pillH + outerPad * 2);
  }

  private drawInput(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    y: number,
    totalH: number,
  ): void {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, y, this.W, totalH);
    ctx.fillStyle = "#F9FAFB";
    ctx.fillRect(0, y, this.W, 1);

    const layout = this.getInputLayout(state);
    const { S, isCropped, hasText, rowH, iconSize, iconGap, smileySlotW, iconAreaW, textPadL, textPadR } = layout;

    let cx = isCropped ? 183 : Math.round(5 * S);
    const bottomRowCenterY = y + totalH - INPUT_H / 2;
    const rowY = bottomRowCenterY - rowH / 2;

    if (!isCropped) {
      const btnImg = this.images.get(hasText ? "sendBtn" : "cameraBtn");
      if (btnImg) {
        const s = rowH;
        ctx.drawImage(btnImg, cx, rowY, s, s);
        cx += s + Math.round(10 * S);
      }
    }

    const slideDuration = 250;
    const slideElapsed = state.time - this.actionIconsTransitionTime;
    const slideProgress = Math.min(slideElapsed / slideDuration, 1);
    const eased = 1 - Math.pow(1 - slideProgress, 3);

    const actionSlotFull = iconSize * 2 + iconGap * 2;
    const visibleFraction = this.actionIconsVisible ? eased : 1 - eased;
    const currentActionSlot = actionSlotFull * visibleFraction;

    const pillToIconGap = layout.pillToIconGap;
    const rightPad = layout.rightPad;
    const animIconAreaW = pillToIconGap + smileySlotW + currentActionSlot;
    const pillW = this.W - cx - animIconAreaW - rightPad;
    const textAreaW = pillW - textPadL - textPadR;

    const fontSize = Math.round(17 * S);
    ctx.font = `400 ${fontSize}px ${FONT_REGULAR}`;
    const lines = state.compositionText ? this.wrapText(ctx, state.compositionText, textAreaW) : [];
    const lineH = Math.round(fontSize * 1.25);

    let pillH: number;
    if (lines.length > 1) {
      const vPad = Math.round(12 * S);
      pillH = lines.length * lineH + vPad * 2;
    } else {
      pillH = Math.round(32 * S);
    }
    const pillY = y + (totalH - pillH) / 2;
    const pillR = Math.round(22 * S);
    this.drawPillRect(ctx, cx, pillY, pillW, pillH, pillR, "#F2F3F5");

    if (state.compositionText && lines.length > 0) {
      ctx.fillStyle = "#000000";
      ctx.textAlign = "left";
      const textX = cx + textPadL;

      ctx.save();
      ctx.beginPath();
      ctx.rect(cx + textPadL, pillY, pillW - textPadL - textPadR, pillH);
      ctx.clip();

      if (lines.length === 1) {
        ctx.textBaseline = "middle";
        const textCenterY = pillY + pillH / 2;
        this.fillTextWithEmoji(ctx, lines[0], textX, textCenterY, FONT_REGULAR, fontSize);

        const lastLineW = this.measureTextWithEmoji(ctx, lines[0], FONT_REGULAR, fontSize);
        const cursorX = textX + lastLineW + 2;
        const cursorH = Math.round(22 * S);
        const cursorW = Math.round(1.6 * S);
        const blink = Math.floor(state.time / 500) % 2 === 0;
        if (blink || state.isMeTyping) {
          this.drawPillRect(
            ctx,
            cursorX,
            textCenterY - cursorH / 2,
            cursorW,
            cursorH,
            cursorW / 2,
            "#FF0054",
          );
        }
      } else {
        ctx.textBaseline = "middle";
        const vPad = Math.round(12 * S);
        const textStartY = pillY + vPad;

        for (let i = 0; i < lines.length; i++) {
          const lineCenterY = textStartY + i * lineH + lineH / 2;
          this.fillTextWithEmoji(ctx, lines[i], textX, lineCenterY, FONT_REGULAR, fontSize);
        }

        const lastLine = lines[lines.length - 1];
        const lastLineW = this.measureTextWithEmoji(ctx, lastLine, FONT_REGULAR, fontSize);
        const cursorX = textX + lastLineW + 2;
        const lastLineCenterY = textStartY + (lines.length - 1) * lineH + lineH / 2;
        const cursorH = Math.round(22 * S);
        const cursorW = Math.round(1.6 * S);
        const blink = Math.floor(state.time / 500) % 2 === 0;
        if (blink || state.isMeTyping) {
          this.drawPillRect(
            ctx,
            cursorX,
            lastLineCenterY - cursorH / 2,
            cursorW,
            cursorH,
            cursorW / 2,
            "#FF0054",
          );
        }
      }
      ctx.restore();

      const updownImg = this.images.get("updown");
      if (updownImg) {
        const upS = iconSize;
        const iconPillX = cx + pillW - Math.round(8 * S) - upS;
        const singlePillH = Math.round(32 * S);
        const updownY = pillY + pillH - singlePillH + (singlePillH - upS) / 2;
        ctx.drawImage(
          updownImg,
          iconPillX,
          updownY,
          upS,
          upS,
        );
      }
    } else {
      ctx.font = `400 ${fontSize}px ${FONT_REGULAR}`;
      ctx.fillStyle = "#9CA3AF";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("Chat", cx + textPadL, pillY + pillH / 2);

      const idleCursorH = Math.round(22 * S);
      const idleCursorW = Math.round(1.6 * S);
      const idleBlink = Math.floor(state.time / 500) % 2 === 0;
      if (idleBlink) {
        this.drawPillRect(
          ctx,
          cx + textPadL,
          pillY + pillH / 2 - idleCursorH / 2,
          idleCursorW,
          idleCursorH,
          idleCursorW / 2,
          "#FF0054",
        );
      }

      const micVisual = Math.round(22 * S);
      const svgS = micVisual / 24;
      const micDrawX = cx + pillW - Math.round(20 * S) - micVisual / 2;
      const micDrawY = pillY + (pillH - micVisual) / 2;
      ctx.save();
      ctx.translate(micDrawX, micDrawY);
      ctx.scale(svgS, svgS);
      ctx.strokeStyle = "#6B7280";
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const micBody = new Path2D(
        "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z",
      );
      ctx.stroke(micBody);
      const micBowl = new Path2D("M19 10v2a7 7 0 0 1-14 0v-2");
      ctx.stroke(micBowl);
      const micStand = new Path2D("M12 19L12 23");
      ctx.stroke(micStand);
      ctx.restore();
    }

    let iconX = cx + pillW + layout.pillToIconGap;
    const iconCenterY = y + totalH - INPUT_H / 2;

    const curStickerUrl = state.suggestedCustomojiUrl || null;
    if (
      curStickerUrl &&
      (!this.stickerAnim || this.stickerAnim.url !== curStickerUrl)
    ) {
      this.stickerAnim = { url: curStickerUrl, startTime: state.time };
    } else if (!curStickerUrl) {
      this.stickerAnim = null;
    }

    const stickerImg = curStickerUrl
      ? this.images.get(`sticker_${curStickerUrl}`)
      : null;
    if (stickerImg && this.stickerAnim) {
      const animDuration = 380;
      const elapsed = state.time - this.stickerAnim.startTime;
      const progress = Math.min(elapsed / animDuration, 1);

      const easeOutBack = (t: number) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      };

      const easedScale = easeOutBack(progress);
      const targetScale = 0.4 + 0.6 * easedScale;
      const scale = Math.min(targetScale, 1.0);
      const alpha = Math.min(progress * 2.5, 1.0);
      const translateY = (1 - progress) * Math.round(8 * S);

      const maxStickerH = INPUT_H - Math.round(12 * S);
      const maxStickerW = iconAreaW - Math.round(4 * S);
      const rawH = Math.round(46 * S * 1.65);
      const imgAspect = stickerImg.width / stickerImg.height;
      let stickerH = Math.min(rawH, maxStickerH);
      let stickerW = stickerH * imgAspect;
      if (stickerW > maxStickerW) {
        stickerW = maxStickerW;
        stickerH = stickerW / imgAspect;
      }
      const finalH = stickerH * scale;
      const finalW = stickerW * scale;

      const stickerCenterX = iconX + smileySlotW / 2;
      const drawX = stickerCenterX - finalW / 2;
      const drawY = iconCenterY - finalH / 2 + translateY;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(stickerImg, drawX, drawY, finalW, finalH);
      ctx.restore();
    } else {
      const smileyImg = this.images.get("smiley");
      if (smileyImg) {
        const s = iconSize;
        ctx.drawImage(
          smileyImg,
          iconX + (smileySlotW - s) / 2,
          iconCenterY - s / 2,
          s,
          s,
        );
      }
    }
    iconX += smileySlotW;

    if (!isCropped) {
      const wantVisible = !hasText;
      if (wantVisible !== this.actionIconsVisible) {
        this.actionIconsVisible = wantVisible;
        this.actionIconsTransitionTime = state.time;
      }

      if (visibleFraction > 0.01) {
        ctx.save();
        ctx.globalAlpha = visibleFraction;
        ctx.beginPath();
        ctx.rect(0, y, this.W, totalH);
        ctx.clip();

        let actionX = iconX + iconGap;
        const galleryImg = this.images.get("galleryIcon");
        if (galleryImg) {
          ctx.drawImage(galleryImg, actionX, iconCenterY - iconSize / 2, iconSize, iconSize);
        }
        actionX += iconSize + iconGap;
        const plusImg = this.images.get("plusIcon");
        if (plusImg) {
          ctx.drawImage(plusImg, actionX, iconCenterY - iconSize / 2, iconSize, iconSize);
        }

        ctx.restore();
      }
    }
  }

  private drawKeyboard(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    y: number,
    totalH: number,
  ): void {
    ctx.fillStyle = "#D1D3D9";
    ctx.fillRect(0, y, this.W, totalH);

    const isShort = state.chatConfig.isShortCrop;
    const layout = state.keyboardLayout;

    const alphaRows = [
      ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
      ["shift", "z", "x", "c", "v", "b", "n", "m", "backspace"],
    ];
    const numericRows = [
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      ["-", "/", ":", ";", "(", ")", "$", "&", "@", '"'],
      ["#+=", ".", ",", "?", "!", "'", "backspace"],
    ];
    const symbolRows = [
      ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="],
      ["_", "\\", "|", "~", "<", ">", "$", "\u00a3", "\u00a5", "\u2022"],
      ["123", ".", ",", "?", "!", "'", "backspace"],
    ];

    let rows = alphaRows;
    if (layout === "NUMERIC") rows = numericRows;
    if (layout === "SYMBOLS") rows = symbolRows;

    const keyH = 126;
    const rowGap = 30;
    const keyGap = 16;
    const sidePad = 10;
    const keyRadius = 22;
    let ky = y + (isShort ? 14 : 22);

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const rowPad = ri === 1 ? 44 : 0;
      const modifierW = 130;
      const modifiers = row.filter((k) => this.isModifierKey(k));
      const charKeys = row.filter((k) => !this.isModifierKey(k));
      const totalModW =
        modifiers.length * modifierW + modifiers.length * keyGap;
      const availW =
        this.W -
        sidePad * 2 -
        rowPad * 2 -
        totalModW -
        (charKeys.length > 0 ? (charKeys.length - 1) * keyGap : 0);
      const charKeyW = charKeys.length > 0 ? availW / charKeys.length : 0;

      let kx = sidePad + rowPad;

      for (const key of row) {
        const isModifier = this.isModifierKey(key);
        const isPressed = this.isKeyActive(key, state.activeKey);
        const w = isModifier ? modifierW : charKeyW;

        let bgColor = isModifier ? "#ACB0B8" : "#FFFFFF";
        if (isPressed) bgColor = "#D1D3D9";
        if (key === "shift" && state.isShiftActive && !isPressed)
          bgColor = "#FFFFFF";

        this.drawPillRect(ctx, kx, ky, w, keyH, keyRadius, bgColor);

        if (!isPressed) {
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.fillRect(kx + 3, ky + keyH - 1, w - 6, 2);
        }

        if (key === "shift") {
          this.drawShiftIcon(
            ctx,
            kx + w / 2,
            ky + keyH / 2,
            state.isShiftActive,
          );
        } else if (key === "backspace") {
          this.drawBackspaceIcon(ctx, kx + w / 2, ky + keyH / 2);
        } else {
          ctx.fillStyle = "#000000";
          ctx.font = isModifier
            ? `500 39px ${FONT_SYSTEM}`
            : `400 61px ${FONT_SYSTEM}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          let displayKey = key;
          if (state.isShiftActive && key.length === 1 && layout === "ALPHA") {
            displayKey = key.toUpperCase();
          }
          ctx.fillText(displayKey, kx + w / 2, ky + keyH / 2);
        }

        kx += w + keyGap;
      }
      ky += keyH + rowGap;
    }

    if (!isShort) {
      const spaceRowY = ky;
      const modW = 236;

      this.drawPillRect(ctx, sidePad, spaceRowY, modW, keyH, keyRadius, "#ACB0B8");
      ctx.fillStyle = "#000000";
      ctx.font = `500 44px ${FONT_SYSTEM}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        layout === "ALPHA" ? "123" : "ABC",
        sidePad + modW / 2,
        spaceRowY + keyH / 2,
      );

      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(sidePad + 3, spaceRowY + keyH - 1, modW - 6, 2);

      const spaceX = sidePad + modW + keyGap;
      const sendW = modW;
      const spaceW = this.W - sidePad * 2 - modW * 2 - keyGap * 2;
      const isSpacePressed = state.activeKey === " ";
      this.drawPillRect(
        ctx,
        spaceX,
        spaceRowY,
        spaceW,
        keyH,
        keyRadius,
        isSpacePressed ? "#ACB0B8" : "#FFFFFF",
      );
      ctx.fillStyle = "#000000";
      ctx.font = `400 44px ${FONT_SYSTEM}`;
      ctx.fillText("space", spaceX + spaceW / 2, spaceRowY + keyH / 2);

      if (!isSpacePressed) {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(spaceX + 3, spaceRowY + keyH - 1, spaceW - 6, 2);
      }

      const sendX = spaceX + spaceW + keyGap;
      const isSendPressed = state.activeKey === "Enter";
      this.drawPillRect(
        ctx,
        sendX,
        spaceRowY,
        sendW,
        keyH,
        keyRadius,
        isSendPressed ? "#005FC4" : "#007AFF",
      );
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `600 44px ${FONT_SYSTEM}`;
      ctx.fillText("send", sendX + sendW / 2, spaceRowY + keyH / 2);

      if (!isSendPressed) {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(sendX + 3, spaceRowY + keyH - 1, sendW - 6, 2);
      }
    }
  }

  private drawShiftIcon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    active: boolean,
  ): void {
    const s = 2.4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-13, -12);
    ctx.beginPath();
    ctx.moveTo(13, 2.5);
    ctx.lineTo(3.5, 12);
    ctx.lineTo(8.5, 12);
    ctx.lineTo(8.5, 21.5);
    ctx.lineTo(17.5, 21.5);
    ctx.lineTo(17.5, 12);
    ctx.lineTo(22.5, 12);
    ctx.closePath();
    if (active) {
      ctx.fillStyle = "#000000";
      ctx.fill();
    } else {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.4;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBackspaceIcon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
  ): void {
    const s = 2.3;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-16.5, -12);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(11, 3);
    ctx.lineTo(2.5, 12);
    ctx.lineTo(11, 21);
    ctx.lineTo(28.5, 21);
    ctx.quadraticCurveTo(30.5, 21, 30.5, 19);
    ctx.lineTo(30.5, 5);
    ctx.quadraticCurveTo(30.5, 3, 28.5, 3);
    ctx.closePath();
    ctx.stroke();
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(17.5, 8.5);
    ctx.lineTo(23.5, 14.5);
    ctx.moveTo(23.5, 8.5);
    ctx.lineTo(17.5, 14.5);
    ctx.stroke();
    ctx.restore();
  }

  private isModifierKey(key: string): boolean {
    return ["shift", "backspace", "#+=", "ABC", "123"].includes(key);
  }

  private isKeyActive(key: string, activeKey: string | null): boolean {
    if (!activeKey) return false;
    const lk = key.toLowerCase();
    const la = activeKey.toLowerCase();
    if (la === lk && key.length === 1) return true;
    if (key === "space" && activeKey === " ") return true;
    if (lk === "backspace" && la === "backspace") return true;
    if (lk === "shift" && la === "shift") return true;
    if (key === "send" && la === "enter") return true;
    return false;
  }

  private drawPillRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
  ): void {
    r = Math.min(r, w / 2, h / 2);
    ctx.fillStyle = fill;
    ctx.beginPath();
    this.pillPath(ctx, x, y, w, h, r);
    ctx.fill();
  }

  private pillPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private drawRoundedImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | HTMLVideoElement,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    cover = true,
  ): void {
    ctx.save();
    ctx.beginPath();
    this.pillPath(ctx, x, y, w, h, r);
    ctx.clip();
    const natW = img instanceof HTMLVideoElement ? img.videoWidth : img.width;
    const natH = img instanceof HTMLVideoElement ? img.videoHeight : img.height;
    const imgRatio = natW / natH;
    const boxRatio = w / h;
    let dw: number, dh: number, dx: number, dy: number;
    if (cover) {
      if (imgRatio > boxRatio) {
        dh = h;
        dw = h * imgRatio;
        dx = x + (w - dw) / 2;
        dy = y;
      } else {
        dw = w;
        dh = w / imgRatio;
        dx = x;
        dy = y + (h - dh) / 2;
      }
    } else {
      if (imgRatio > boxRatio) {
        dw = w;
        dh = w / imgRatio;
        dx = x;
        dy = y + (h - dh) / 2;
      } else {
        dh = h;
        dw = h * imgRatio;
        dx = x + (w - dw) / 2;
        dy = y;
      }
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  private static PLATFORM_COLORS: Record<string, string> = {
    'Messages': '#34C759',
    'Snapchat': '#FFFC00',
  };

  private static PLATFORM_ICONS: Record<string, string> = {
    'Messages': '\uD83D\uDCAC',
    'Snapchat': '\uD83D\uDC7B',
  };

  drawNotificationBanner(
    ctx: CanvasRenderingContext2D,
    notification: TimedNotification,
    slideProgress: number,
  ): void {
    const bannerW = this.W - 56;
    const bannerH = 170;
    const bannerX = 28;
    const bannerR = 55;
    const offscreenY = -bannerH - 20;
    const onscreenY = 20;

    const eased = slideProgress < 0.5
      ? 4 * slideProgress * slideProgress * slideProgress
      : 1 - Math.pow(-2 * slideProgress + 2, 3) / 2;

    const bannerY = offscreenY + (onscreenY - offscreenY) * eased;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 8;

    ctx.fillStyle = "rgba(245, 245, 247, 0.97)";
    ctx.beginPath();
    ctx.moveTo(bannerX + bannerR, bannerY);
    ctx.lineTo(bannerX + bannerW - bannerR, bannerY);
    ctx.quadraticCurveTo(bannerX + bannerW, bannerY, bannerX + bannerW, bannerY + bannerR);
    ctx.lineTo(bannerX + bannerW, bannerY + bannerH - bannerR);
    ctx.quadraticCurveTo(bannerX + bannerW, bannerY + bannerH, bannerX + bannerW - bannerR, bannerY + bannerH);
    ctx.lineTo(bannerX + bannerR, bannerY + bannerH);
    ctx.quadraticCurveTo(bannerX, bannerY + bannerH, bannerX, bannerY + bannerH - bannerR);
    ctx.lineTo(bannerX, bannerY + bannerR);
    ctx.quadraticCurveTo(bannerX, bannerY, bannerX + bannerR, bannerY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "transparent";

    const iconX = bannerX + 28;
    const iconY = bannerY + bannerH / 2 - 48;
    const iconSize = 96;
    const iconR = 22;

    const hasBadge = notification.platform === 'Snapchat' || notification.platform === 'Messages';
    const badgeLogoKey = notification.platform === 'Snapchat' ? 'snapLogo' : notification.platform === 'Messages' ? 'imessageLogo' : '';
    const customIcon = notification.customIconUrl ? this.images.get(`notif_icon_${notification.id}`) : null;

    if (hasBadge && customIcon) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const imgRatio = customIcon.width / customIcon.height;
      const boxRatio = 1;
      let dw: number, dh: number, dx: number, dy: number;
      if (imgRatio > boxRatio) {
        dh = iconSize; dw = iconSize * imgRatio;
        dx = iconX + (iconSize - dw) / 2; dy = iconY;
      } else {
        dw = iconSize; dh = iconSize / imgRatio;
        dx = iconX; dy = iconY + (iconSize - dh) / 2;
      }
      ctx.drawImage(customIcon, dx, dy, dw, dh);
      ctx.restore();

      const badgeLogo = this.images.get(badgeLogoKey);
      if (badgeLogo) {
        const badgeSize = 40;
        const badgeX = iconX + iconSize - badgeSize + 4;
        const badgeY = iconY + iconSize - badgeSize + 4;
        ctx.drawImage(badgeLogo, badgeX, badgeY, badgeSize, badgeSize);
      }
    } else if (customIcon) {
      this.drawRoundedImage(ctx, customIcon, iconX, iconY, iconSize, iconSize, iconR);
    } else {
      const platformColor = CanvasRenderer.PLATFORM_COLORS[notification.platform] || '#999999';
      ctx.fillStyle = platformColor;
      if (hasBadge) {
        ctx.beginPath();
        ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(iconX + iconR, iconY);
        ctx.lineTo(iconX + iconSize - iconR, iconY);
        ctx.quadraticCurveTo(iconX + iconSize, iconY, iconX + iconSize, iconY + iconR);
        ctx.lineTo(iconX + iconSize, iconY + iconSize - iconR);
        ctx.quadraticCurveTo(iconX + iconSize, iconY + iconSize, iconX + iconSize - iconR, iconY + iconSize);
        ctx.lineTo(iconX + iconR, iconY + iconSize);
        ctx.quadraticCurveTo(iconX, iconY + iconSize, iconX, iconY + iconSize - iconR);
        ctx.lineTo(iconX, iconY + iconR);
        ctx.quadraticCurveTo(iconX, iconY, iconX + iconR, iconY);
        ctx.closePath();
        ctx.fill();
      }

      const icon = CanvasRenderer.PLATFORM_ICONS[notification.platform] || '?';
      ctx.fillStyle = notification.platform === 'Snapchat' ? '#000000' : '#FFFFFF';
      ctx.font = `400 48px ${FONT_EMOJI}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, iconX + iconSize / 2, iconY + iconSize / 2);

      if (hasBadge) {
        const badgeLogo = this.images.get(badgeLogoKey);
        if (badgeLogo) {
          const badgeSize = 40;
          const badgeX = iconX + iconSize - badgeSize + 4;
          const badgeY = iconY + iconSize - badgeSize + 4;
          ctx.drawImage(badgeLogo, badgeX, badgeY, badgeSize, badgeSize);
        }
      }
    }

    const textX = iconX + iconSize + 24;
    const textMaxW = bannerX + bannerW - textX - 28;

    ctx.fillStyle = "#8E8E93";
    ctx.font = `600 28px ${FONT_SYSTEM}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(notification.platform.toUpperCase(), textX, bannerY + 24);

    ctx.fillStyle = "#8E8E93";
    ctx.font = `400 28px ${FONT_SYSTEM}`;
    ctx.textAlign = "right";
    ctx.fillText("now", bannerX + bannerW - 28, bannerY + 24);

    ctx.fillStyle = "#000000";
    ctx.font = `700 36px ${FONT_SYSTEM}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const nameY = bannerY + 58;
    const nameText = notification.senderName;
    const measuredName = ctx.measureText(nameText).width;
    if (measuredName > textMaxW) {
      const truncated = this.truncateText(ctx, nameText, textMaxW);
      ctx.fillText(truncated, textX, nameY);
    } else {
      ctx.fillText(nameText, textX, nameY);
    }

    ctx.fillStyle = "#3C3C43";
    ctx.font = `400 34px ${FONT_SYSTEM}`;
    const msgY = nameY + 44;
    const msgText = notification.message;
    const measuredMsg = ctx.measureText(msgText).width;
    if (measuredMsg > textMaxW) {
      const truncated = this.truncateText(ctx, msgText, textMaxW);
      ctx.fillText(truncated, textX, msgY);
    } else {
      ctx.fillText(msgText, textX, msgY);
    }

    ctx.restore();
  }

  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
    const ellipsis = "…";
    const ellipsisW = ctx.measureText(ellipsis).width;
    let truncated = text;
    while (ctx.measureText(truncated).width + ellipsisW > maxW && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + ellipsis;
  }

  drawActiveNotifications(ctx: CanvasRenderingContext2D, state: FrameState): void {
    const notifs = state.activeNotifications;
    if (!notifs || notifs.length === 0) return;

    for (const notif of notifs) {
      if (notif.customIconUrl && !this.images.has(`notif_icon_${notif.id}`)) {
        this.loadImg(`notif_icon_${notif.id}`, notif.customIconUrl);
      }

      const elapsed = state.time - notif.timeMs;
      const totalDuration = notif.durationMs;
      const slideInDuration = 400;
      const slideOutDuration = 350;

      let slideProgress: number;
      if (elapsed < slideInDuration) {
        slideProgress = elapsed / slideInDuration;
      } else if (elapsed < totalDuration - slideOutDuration) {
        slideProgress = 1;
      } else if (elapsed < totalDuration) {
        slideProgress = 1 - (elapsed - (totalDuration - slideOutDuration)) / slideOutDuration;
      } else {
        continue;
      }

      this.drawNotificationBanner(ctx, notif, slideProgress);
    }
  }
}
