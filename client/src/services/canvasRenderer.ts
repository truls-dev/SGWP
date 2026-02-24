import {
  ScriptEvent,
  SystemConfig,
  ChatConfig,
  CastMember,
  MessageType,
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
const MSG_PAD_X = 44;
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
  private emojiImages = new Map<string, HTMLImageElement>();
  private stickerAnim: StickerAnimState | null = null;
  private presenceAnims = new Map<string, PresenceAnimState>();
  private presenceEnabled = false;
  private actionIconsVisible = true;
  private actionIconsTransitionTime = -Infinity;

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
        promises.push(this.loadImg(`media_${e.id}`, e.mediaUrl));
      }
    }

    if (chatConfig?.exportBackgroundUrl) {
      promises.push(this.loadImg("exportBg", chatConfig.exportBackgroundUrl));
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
      const oy = (this.H - phoneH) / 2;

      ctx.save();
      const cr = state.chatConfig.topCornerRadius * (phoneW / 390);
      ctx.beginPath();
      ctx.moveTo(ox + cr, oy);
      ctx.lineTo(ox + phoneW - cr, oy);
      ctx.quadraticCurveTo(ox + phoneW, oy, ox + phoneW, oy + cr);
      ctx.lineTo(ox + phoneW, oy + phoneH);
      ctx.lineTo(ox, oy + phoneH);
      ctx.lineTo(ox, oy + cr);
      ctx.quadraticCurveTo(ox, oy, ox + cr, oy);
      ctx.closePath();
      ctx.clip();

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
          dh = this.H;
          dw = this.H * imgR;
          dx = (this.W - dw) / 2;
          dy = 0;
        } else {
          dw = this.W;
          dh = this.W / imgR;
          dx = 0;
          dy = (this.H - dh) / 2;
        }
        ctx.drawImage(exportBg, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, this.W, this.H);
      }

      if (state.chatConfig.isShortCrop) {
        const phoneH = this.H * 0.75;
        const phoneY = (this.H - phoneH) / 2;
        const cr = state.chatConfig.topCornerRadius * 2.77;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cr, phoneY);
        ctx.lineTo(this.W - cr, phoneY);
        ctx.quadraticCurveTo(this.W, phoneY, this.W, phoneY + cr);
        ctx.lineTo(this.W, phoneY + phoneH);
        ctx.lineTo(0, phoneY + phoneH);
        ctx.lineTo(0, phoneY + cr);
        ctx.quadraticCurveTo(0, phoneY, cr, phoneY);
        ctx.closePath();
        ctx.clip();
        ctx.translate(0, phoneY);
        this.drawPhoneUI(ctx, state, kbH);
        ctx.restore();
      } else {
        this.drawPhoneUI(ctx, state, kbH);
      }
    }

    return this.canvas;
  }

  private drawPhoneUI(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    kbH: number,
  ): void {
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

    this.drawKeyboard(ctx, state, kbYInCanvas, kbH);
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

  private drawStatusBar(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    y: number,
  ): void {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, y, this.W, STATUS_BAR_H);

    ctx.fillStyle = "#000000";
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
    ctx.fillStyle = "#000000";

    ctx.fill(new Path2D("M22.959 16.9531H25.332C25.9375 16.9531 26.3477 16.5234 26.3477 15.8887V1.06445C26.3477 0.429688 25.9375 0 25.332 0H22.959C22.3535 0 21.9336 0.429688 21.9336 1.06445V15.8887C21.9336 16.5234 22.3535 16.9531 22.959 16.9531Z"));
    ctx.fill(new Path2D("M15.6543 16.9531H18.0078C18.6133 16.9531 19.0332 16.5234 19.0332 15.8887V4.92188C19.0332 4.28711 18.6133 3.85742 18.0078 3.85742H15.6543C15.0391 3.85742 14.6289 4.28711 14.6289 4.92188V15.8887C14.6289 16.5234 15.0391 16.9531 15.6543 16.9531Z"));
    ctx.fill(new Path2D("M8.33984 16.9531H10.6934C11.3086 16.9531 11.7188 16.5234 11.7188 15.8887V8.45703C11.7188 7.82227 11.3086 7.39258 10.6934 7.39258H8.33984C7.72461 7.39258 7.31445 7.82227 7.31445 8.45703V15.8887C7.31445 16.5234 7.72461 16.9531 8.33984 16.9531Z"));
    ctx.fill(new Path2D("M1.02539 16.9531H3.37891C3.99414 16.9531 4.4043 16.5234 4.4043 15.8887V11.5039C4.4043 10.8691 3.99414 10.4492 3.37891 10.4492H1.02539C0.410156 10.4492 0 10.8691 0 11.5039V15.8887C0 16.5234 0.410156 16.9531 1.02539 16.9531Z"));

    ctx.restore();

    ctx.fillStyle = "#000000";
    this.fillTextWithEmoji(ctx, state.systemConfig.carrier, signalX + signalW + 8, carrierY, FONT_SYSTEM, 28);

    ctx.font = `bold 30px ${FONT_SYSTEM}`;
    ctx.textAlign = "center";
    this.fillTextWithEmoji(ctx, state.systemConfig.time, this.W / 2, y + STATUS_BAR_H / 2, FONT_SYSTEM, 30);

    let rx = this.W - 22;
    const batteryImg = this.images.get("battery");
    if (batteryImg) {
      const ih = 24;
      const iw = batteryImg.width * (ih / batteryImg.height);
      rx -= iw;
      ctx.drawImage(batteryImg, rx, y + (STATUS_BAR_H - ih) / 2, iw, ih);
      rx -= 14;
    }

    const wifiImg = this.images.get("wifi");
    if (wifiImg) {
      const ih = 25;
      const iw = wifiImg.width * (ih / wifiImg.height);
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
      cx += 50;
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
          cx += s + 16;
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
          cx += s + 40;
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
        cx += containerW + 10;
      }
    }

    const displayName = state.chatConfig.isGroup
      ? state.chatConfig.groupName || others.map((o) => o.name).join(", ")
      : state.chatConfig.contactName;

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

    const msgs = state.messages.filter((m) => m.type !== MessageType.PRESENCE);
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
        if (!isGrouped) h += NAME_FONT_SIZE + 14;

        ctx.font = `400 ${msgFontSize}px ${FONT_REGULAR}`;

        if (msg.type === MessageType.STICKER) {
          h += 200;
        } else if (msg.type === MessageType.IMAGE) {
          lines = msg.text ? this.wrapText(ctx, msg.text, maxTextW) : [];
          h += lines.length * msgLineH;
          h += msg.isVertical ? 420 : 300;
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
      this.drawMessage(ctx, item, y, padX, maxTextW, false, msgFontSize, msgLineH);
    }

    for (let i = 0; i < layouts.length; i++) {
      const item = layouts[i];
      if (item.msg.type === MessageType.NOTIFICATION) continue;

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
      const groupTopY = firstY + 10 + (NAME_FONT_SIZE + 14);
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
      ctx.font = `700 ${NAME_FONT_SIZE}px ${FONT_REGULAR}`;
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      this.fillTextWithEmoji(ctx, sender?.name?.toUpperCase() || "", padX, curY, FONT_REGULAR, NAME_FONT_SIZE);
      curY += NAME_FONT_SIZE + 14;
    }

    const textStartX = padX + BAR_WIDTH + BAR_GAP;
    const barStartY = curY;

    if (msg.type === MessageType.STICKER) {
      const stickerImg = this.images.get(`media_${msg.id}`);
      if (stickerImg) {
        const sh = 180;
        const sw = stickerImg.width * (sh / stickerImg.height);
        ctx.drawImage(stickerImg, textStartX, curY, Math.min(sw, 400), sh);
        curY += sh + 10;
      } else {
        curY += 180;
      }
    } else if (msg.type === MessageType.IMAGE) {
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

      const imgEl = this.images.get(`media_${msg.id}`);
      if (imgEl) {
        const imgH = msg.isVertical ? 400 : 280;
        const imgW = msg.isVertical ? 230 : 420;
        this.drawRoundedImage(ctx, imgEl, textStartX, curY, imgW, imgH, 50);
        curY += imgH + 10;
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

  private drawTypingIndicator(
    ctx: CanvasRenderingContext2D,
    state: FrameState,
    areaBottom: number,
  ): void {
    if (!this.presenceEnabled) return;

    const isGroup = state.chatConfig.isGroup;
    const isCropped = state.chatConfig.isKeyboardCropped;
    const padLeft = isCropped ? 183 : 6;

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
        hasEverArrived: false,
        hasEverTyped: false,
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
    AVATAR_OFFSET_X: 28, // Shift bitmoji left/right (px)
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
    ROW_LEFT_PADDING: 12,
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
            const drawY = y - emojiSize * 0.82;
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
    let cx = isCropped ? 183 : Math.round(12 * S);

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

    let cx = isCropped ? 183 : Math.round(12 * S);
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
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.save();
    ctx.beginPath();
    this.pillPath(ctx, x, y, w, h, r);
    ctx.clip();
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let dw: number, dh: number, dx: number, dy: number;
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
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }
}
