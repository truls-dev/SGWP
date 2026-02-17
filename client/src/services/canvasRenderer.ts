import { ScriptEvent, SystemConfig, ChatConfig, CastMember, MessageType } from '../types';
import { KeyboardLayout } from '../components/IOSKeyboard';
import { getSelfieUrlForAvatar, getPeekingUrlForAvatar } from './bitmojiService';
import { SNAP_COLORS } from '../constants';

export interface FrameState {
  messages: ScriptEvent[];
  compositionText: string;
  isMeTyping: boolean;
  activeKey: string | null;
  isShiftActive: boolean;
  keyboardLayout: KeyboardLayout;
  typingParticipantIds: string[];
  activeParticipantIds: string[];
  systemConfig: SystemConfig;
  chatConfig: ChatConfig;
  cast: CastMember[];
  time: number;
  backgroundVideo?: HTMLVideoElement | null;
}

const FONT_REGULAR = "'Avenir Next LT Pro', sans-serif";
const FONT_HEADER = "'Avenir Black', sans-serif";
const FONT_SYSTEM = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const STATUS_BAR_H = 42;
const HEADER_H = 116;
const INPUT_H = 100;
const KEYBOARD_H = 520;
const KEYBOARD_SHORT_H = 390;

const MSG_FONT_SIZE = 56;
const MSG_LINE_H = 68;
const NAME_FONT_SIZE = 36;
const NOTIF_FONT_SIZE = 33;
const BAR_WIDTH = 6;
const BAR_GAP = 28;
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

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  async preload(cast: CastMember[], events: ScriptEvent[], chatConfig?: ChatConfig): Promise<void> {
    const staticUrls: [string, string][] = [
      ['signal', 'https://raw.githubusercontent.com/truls-dev/images/main/signalbarsblack.png'],
      ['wifi', 'https://raw.githubusercontent.com/truls-dev/images/main/wifi.png'],
      ['battery', 'https://raw.githubusercontent.com/truls-dev/images/main/battery.100.png'],
      ['callIcons', 'https://raw.githubusercontent.com/truls-dev/images/main/sccicons.png'],
      ['cameraBtn', 'https://raw.githubusercontent.com/truls-dev/images/main/sccb_empty.png'],
      ['sendBtn', 'https://raw.githubusercontent.com/truls-dev/images/main/sccb_text.png'],
      ['smiley', 'https://raw.githubusercontent.com/truls-dev/images/main/smiley.png'],
      ['actionIcons', 'https://raw.githubusercontent.com/truls-dev/images/main/twoicons.png'],
      ['updown', 'https://raw.githubusercontent.com/truls-dev/images/main/updown-removebg-preview.png'],
    ];

    const promises: Promise<void>[] = [];
    for (const [key, url] of staticUrls) {
      promises.push(this.loadImg(key, url));
    }

    for (const m of cast) {
      promises.push(this.loadImg(`selfie_${m.bitmojiAvatarId}`, getSelfieUrlForAvatar(m.bitmojiAvatarId)));
      promises.push(this.loadImg(`peeking_${m.bitmojiAvatarId}`, getPeekingUrlForAvatar(m.bitmojiAvatarId)));
    }

    for (const e of events) {
      if (e.mediaUrl) {
        promises.push(this.loadImg(`media_${e.id}`, e.mediaUrl));
      }
    }

    if (chatConfig?.exportBackgroundUrl) {
      promises.push(this.loadImg('exportBg', chatConfig.exportBackgroundUrl));
    }
    if (chatConfig?.groupIconUrl) {
      promises.push(this.loadImg('groupIcon', chatConfig.groupIconUrl));
    }

    await Promise.all(promises);
    await document.fonts.ready;
  }

  private loadImg(key: string, url: string): Promise<void> {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { this.images.set(key, img); resolve(); };
      img.onerror = () => {
        const img2 = new Image();
        img2.onload = () => { this.images.set(key, img2); resolve(); };
        img2.onerror = () => resolve();
        img2.src = url;
      };
      img.src = url;
    });
  }

  renderFrame(state: FrameState): HTMLCanvasElement {
    const ctx = this.ctx;
    const isVideoMode = state.chatConfig.isVideoBackgroundMode;
    const kbH = state.chatConfig.isShortCrop ? KEYBOARD_SHORT_H : KEYBOARD_H;

    if (isVideoMode && state.backgroundVideo) {
      this.drawVideoBackground(ctx, state.backgroundVideo);
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
      const exportBg = this.images.get('exportBg');
      if (exportBg) {
        const imgR = exportBg.width / exportBg.height;
        const canR = this.W / this.H;
        let dw: number, dh: number, dx: number, dy: number;
        if (imgR > canR) {
          dh = this.H; dw = this.H * imgR; dx = (this.W - dw) / 2; dy = 0;
        } else {
          dw = this.W; dh = this.W / imgR; dx = 0; dy = (this.H - dh) / 2;
        }
        ctx.drawImage(exportBg, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = '#000000';
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

  private drawPhoneUI(ctx: CanvasRenderingContext2D, state: FrameState, kbH: number): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, this.W, this.H);

    let y = 0;
    this.drawStatusBar(ctx, state, y);
    y += STATUS_BAR_H;

    this.drawHeader(ctx, state, y);
    y += HEADER_H;

    const msgAreaH = this.H - y - INPUT_H - kbH;
    this.drawMessages(ctx, state, y, msgAreaH);
    this.drawTypingIndicator(ctx, state, y + msgAreaH);
    y += msgAreaH;

    this.drawInput(ctx, state, y);
    y += INPUT_H;

    this.drawKeyboard(ctx, state, y, kbH);
  }

  private drawVideoBackground(ctx: CanvasRenderingContext2D, vid: HTMLVideoElement): void {
    if (!vid.videoWidth) return;
    const vidR = vid.videoWidth / vid.videoHeight;
    const canR = this.W / this.H;
    let dw: number, dh: number, dx: number, dy: number;
    if (vidR > canR) {
      dh = this.H; dw = this.H * vidR; dx = (this.W - dw) / 2; dy = 0;
    } else {
      dw = this.W; dh = this.W / vidR; dx = 0; dy = (this.H - dh) / 2;
    }
    ctx.drawImage(vid, dx, dy, dw, dh);
  }

  private drawStatusBar(ctx: CanvasRenderingContext2D, state: FrameState, y: number): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, y, this.W, STATUS_BAR_H);

    const signalImg = this.images.get('signal');
    if (signalImg) {
      const ih = 22;
      const iw = signalImg.width * (ih / signalImg.height);
      ctx.save();
      ctx.filter = 'brightness(0)';
      ctx.drawImage(signalImg, 22, y + (STATUS_BAR_H - ih) / 2 + 2, iw, ih);
      ctx.restore();
    }

    ctx.fillStyle = '#000000';
    ctx.font = `bold 28px ${FONT_SYSTEM}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.systemConfig.carrier, 65, y + STATUS_BAR_H / 2);

    ctx.font = `bold 30px ${FONT_SYSTEM}`;
    ctx.textAlign = 'center';
    ctx.fillText(state.systemConfig.time, this.W / 2, y + STATUS_BAR_H / 2);

    let rx = this.W - 22;
    const batteryImg = this.images.get('battery');
    if (batteryImg) {
      const ih = 24;
      const iw = batteryImg.width * (ih / batteryImg.height);
      rx -= iw;
      ctx.drawImage(batteryImg, rx, y + (STATUS_BAR_H - ih) / 2, iw, ih);
      rx -= 14;
    }

    const wifiImg = this.images.get('wifi');
    if (wifiImg) {
      const ih = 25;
      const iw = wifiImg.width * (ih / wifiImg.height);
      rx -= iw;
      ctx.drawImage(wifiImg, rx, y + (STATUS_BAR_H - ih) / 2, iw, ih);
    }
  }

  private drawHeader(ctx: CanvasRenderingContext2D, state: FrameState, y: number): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, y, this.W, HEADER_H);
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(0, y + HEADER_H - 1, this.W, 1);

    const isCropped = state.chatConfig.isKeyboardCropped;
    let cx = isCropped ? 183 : 8;

    if (!isCropped) {
      ctx.strokeStyle = '#9CA3AF';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 38, y + HEADER_H / 2 - 16);
      ctx.lineTo(cx + 22, y + HEADER_H / 2);
      ctx.lineTo(cx + 38, y + HEADER_H / 2 + 16);
      ctx.stroke();
      cx += 50;
    }

    const others = state.cast.filter(c => !c.isMe);
    if (others[0]) {
      const avatarImg = this.images.get(`selfie_${others[0].bitmojiAvatarId}`);
      if (state.chatConfig.isGroup) {
        const groupIconImg = this.images.get('groupIcon');
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
        cx += containerW - 20;
      }
    }

    const displayName = state.chatConfig.isGroup
      ? (state.chatConfig.groupName || others.map(o => o.name).join(', '))
      : state.chatConfig.contactName;

    ctx.fillStyle = '#111827';
    ctx.font = `900 50px ${FONT_HEADER}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayName, cx, y + HEADER_H / 2);

    if (!isCropped) {
      const callImg = this.images.get('callIcons');
      if (callImg) {
        const ih = 90;
        const iw = callImg.width * (ih / callImg.height);
        ctx.drawImage(callImg, this.W - iw - 40, y + (HEADER_H - ih) / 2, iw, ih);
      }
    }
  }

  private drawMessages(ctx: CanvasRenderingContext2D, state: FrameState, areaY: number, areaH: number): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, areaY, this.W, areaH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, areaY, this.W, areaH);
    ctx.clip();

    const isCropped = state.chatConfig.isKeyboardCropped;
    const padX = isCropped ? MSG_PAD_X_CROPPED : MSG_PAD_X;
    const maxTextW = this.W - padX - MSG_PAD_X - BAR_WIDTH - BAR_GAP;

    const msgs = state.messages.filter(m => m.type !== MessageType.PRESENCE);
    const layouts: MsgLayout[] = [];
    let totalH = 80;

    ctx.font = `400 ${MSG_FONT_SIZE}px ${FONT_REGULAR}`;

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const prev = i > 0 ? msgs[i - 1] : null;
      const isGrouped = !!(prev && msg.senderId === prev.senderId &&
        prev.type !== MessageType.NOTIFICATION && msg.type !== MessageType.NOTIFICATION);
      const sender = state.cast.find(c => c.id === msg.senderId);
      const color = sender?.color || (sender?.isMe ? SNAP_COLORS.ME : SNAP_COLORS.THEM);

      let h = 0;
      let lines: string[] = [];

      if (msg.type === MessageType.NOTIFICATION) {
        ctx.font = `900 ${NOTIF_FONT_SIZE}px ${FONT_REGULAR}`;
        lines = this.wrapText(ctx, msg.text || '', this.W - padX * 4);
        h = 50 + lines.length * (NOTIF_FONT_SIZE + 10);
      } else {
        if (!isGrouped) h += NAME_FONT_SIZE + 14;

        ctx.font = `400 ${MSG_FONT_SIZE}px ${FONT_REGULAR}`;

        if (msg.type === MessageType.STICKER) {
          h += 200;
        } else if (msg.type === MessageType.IMAGE) {
          lines = msg.text ? this.wrapText(ctx, msg.text, maxTextW) : [];
          h += lines.length * MSG_LINE_H;
          h += msg.isVertical ? 420 : 300;
          if (lines.length > 0) h += 10;
        } else {
          lines = this.wrapText(ctx, msg.text || '', maxTextW);
          h += lines.length * MSG_LINE_H;
        }

        h += isGrouped ? 6 : 10;
      }

      totalH += h;
      layouts.push({ msg, h, isGrouped, lines, sender, color });
    }

    let drawY = areaY + areaH - 120;

    for (let i = layouts.length - 1; i >= 0; i--) {
      const item = layouts[i];
      drawY -= item.h;
      if (drawY + item.h < areaY - 20) break;
      if (drawY < areaY + areaH + 20) {
        this.drawMessage(ctx, item, drawY, padX, maxTextW);
      }
    }

    const todayY = drawY - 60;
    if (todayY > areaY - 20) {
      ctx.font = `900 30px ${FONT_REGULAR}`;
      ctx.fillStyle = '#D1D5DB';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TODAY', this.W / 2, todayY + 30);
    }

    ctx.restore();
  }

  private drawMessage(ctx: CanvasRenderingContext2D, item: MsgLayout, y: number, padX: number, maxTextW: number): void {
    const { msg, isGrouped, lines, sender, color } = item;

    if (msg.type === MessageType.NOTIFICATION) {
      ctx.font = `900 ${NOTIF_FONT_SIZE}px ${FONT_REGULAR}`;
      ctx.fillStyle = '#9CA3AF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      let textY = y + 25;
      for (const line of lines) {
        ctx.fillText(line, this.W / 2, textY);
        textY += NOTIF_FONT_SIZE + 10;
      }
      return;
    }

    let curY = y + (isGrouped ? 6 : 10);

    if (!isGrouped) {
      ctx.font = `700 ${NAME_FONT_SIZE}px ${FONT_REGULAR}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(sender?.name?.toUpperCase() || '', padX, curY);
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
        ctx.font = `400 ${MSG_FONT_SIZE}px ${FONT_REGULAR}`;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        for (const line of lines) {
          ctx.fillText(line, textStartX, curY);
          curY += MSG_LINE_H;
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
      ctx.font = `400 ${MSG_FONT_SIZE}px ${FONT_REGULAR}`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (const line of lines) {
        ctx.fillText(line, textStartX, curY);
        curY += MSG_LINE_H;
      }
    }

    const barH = Math.max(curY - barStartY, 30);
    if (!isGrouped) {
      this.drawPillRect(ctx, padX, barStartY, BAR_WIDTH, barH, 3, color);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(padX, barStartY, BAR_WIDTH, barH);
    }
  }

  private drawTypingIndicator(ctx: CanvasRenderingContext2D, state: FrameState, areaBottom: number): void {
    const isGroup = state.chatConfig.isGroup;
    const isCropped = state.chatConfig.isKeyboardCropped;
    const padLeft = isCropped ? 183 : 6;

    if (isGroup) {
      this.drawGroupPresence(ctx, state, areaBottom, padLeft);
    } else {
      this.drawSinglePresence(ctx, state, areaBottom, padLeft);
    }
  }

  private drawSinglePresence(ctx: CanvasRenderingContext2D, state: FrameState, bottom: number, padLeft: number): void {
    const partner = state.cast.find(c => !c.isMe);
    if (!partner) return;

    const isArrived = state.activeParticipantIds.includes(partner.id);
    if (!isArrived) return;

    const isTyping = state.typingParticipantIds.includes(partner.id);
    const isShort = state.chatConfig.isShortCrop;
    const containerW = isShort ? 105 : 188;

    const avatarKey = isTyping ? `selfie_${partner.bitmojiAvatarId}` : `peeking_${partner.bitmojiAvatarId}`;
    const avatarImg = this.images.get(avatarKey);

    if (avatarImg) {
      const imgW = containerW;
      const imgH = avatarImg.height * (imgW / avatarImg.width);
      const ax = padLeft;
      const ay = bottom - imgH * 0.55;

      ctx.save();
      ctx.beginPath();
      ctx.rect(padLeft - 10, bottom - 120, containerW + 60, 125);
      ctx.clip();
      ctx.drawImage(avatarImg, ax, ay, imgW, imgH);
      ctx.restore();
    }

    if (isTyping) {
      this.drawTypingBubble(ctx, state.time, padLeft + (isShort ? 36 : 88), bottom - (isShort ? 25 : 77));
    }
  }

  private drawGroupPresence(ctx: CanvasRenderingContext2D, state: FrameState, bottom: number, padLeft: number): void {
    const participants = state.cast.filter(c => !c.isMe && state.messages.some(m => m.senderId === c.id));
    if (participants.length === 0) return;

    const sorted = [
      ...state.activeParticipantIds.filter(id => participants.some(p => p.id === id)).map(id => participants.find(p => p.id === id)!),
      ...participants.filter(p => !state.activeParticipantIds.includes(p.id))
    ];

    const isShort = state.chatConfig.isShortCrop;
    const itemW = isShort ? 105 : 188;
    const overlap = 50;
    let px = padLeft;

    for (let i = 0; i < sorted.length; i++) {
      const member = sorted[i];
      const isTyping = state.typingParticipantIds.includes(member.id);
      const hasArrived = state.activeParticipantIds.includes(member.id);
      const pillColor = hasArrived ? (member.color || '#33B5FF') : '#CCCCCC';

      if (hasArrived) {
        const avatarKey = isTyping ? `selfie_${member.bitmojiAvatarId}` : `peeking_${member.bitmojiAvatarId}`;
        const avatarImg = this.images.get(avatarKey);
        if (avatarImg) {
          const imgW = itemW * 0.8;
          const imgH = avatarImg.height * (imgW / avatarImg.width);
          ctx.save();
          ctx.beginPath();
          ctx.rect(px - 5, bottom - 120, itemW + 10, 90);
          ctx.clip();
          ctx.drawImage(avatarImg, px + (itemW - imgW) / 2, bottom - imgH * 0.55 - 30, imgW, imgH);
          ctx.restore();
        }

        if (isTyping) {
          this.drawTypingBubble(ctx, state.time, px + itemW * 0.5, bottom - 60);
        }
      }

      const pillH = 36;
      const pillW = Math.max(ctx.measureText(member.name.toUpperCase()).width + 24, isShort ? 138 : 188);
      const pillX = px + (itemW - Math.min(pillW, itemW)) / 2;
      const pillY = bottom - pillH - 8;

      ctx.fillStyle = '#FFFFFF';
      this.drawPillRect(ctx, pillX, pillY, Math.min(pillW, itemW), pillH, pillH / 2, '#FFFFFF');
      ctx.strokeStyle = pillColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      this.pillPath(ctx, pillX, pillY, Math.min(pillW, itemW), pillH, pillH / 2);
      ctx.stroke();

      ctx.font = `900 ${isShort ? 23 : 26}px ${FONT_REGULAR}`;
      ctx.fillStyle = pillColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(member.name.toUpperCase(), pillX + Math.min(pillW, itemW) / 2, pillY + pillH / 2);

      px += itemW - overlap;
    }
  }

  private drawTypingBubble(ctx: CanvasRenderingContext2D, time: number, x: number, y: number): void {
    const w = 80;
    const h = 56;

    ctx.fillStyle = '#F5F6F8';
    ctx.strokeStyle = '#474A4F';
    ctx.lineWidth = 2.5;
    this.drawPillRect(ctx, x, y, w, h, h / 2, '#F5F6F8');
    ctx.beginPath();
    this.pillPath(ctx, x, y, w, h, h / 2);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const phase = ((time / 1200) * Math.PI * 2 + i * 0.8) % (Math.PI * 2);
      const opacity = 0.3 + 0.7 * Math.max(0, Math.sin(phase));
      const scale = 1 + 0.2 * Math.max(0, Math.sin(phase));

      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#474A4F';
      ctx.beginPath();
      ctx.arc(x + 20 + i * 15, y + h / 2, 5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawInput(ctx: CanvasRenderingContext2D, state: FrameState, y: number): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, y, this.W, INPUT_H);
    ctx.fillStyle = '#F9FAFB';
    ctx.fillRect(0, y, this.W, 1);

    const isCropped = state.chatConfig.isKeyboardCropped;
    const hasText = state.compositionText.length > 0;
    let cx = isCropped ? 183 : 33;

    if (!isCropped) {
      const btnImg = this.images.get(hasText ? 'sendBtn' : 'cameraBtn');
      if (btnImg) {
        const s = 82;
        ctx.drawImage(btnImg, cx, y + (INPUT_H - s) / 2, s, s);
        cx += s + 16;
      }
    }

    const rightPad = hasText ? 80 : 200;
    const pillW = this.W - cx - rightPad;
    const pillH = 76;
    const pillY = y + (INPUT_H - pillH) / 2;
    this.drawPillRect(ctx, cx, pillY, pillW, pillH, pillH / 2, '#F2F3F5');

    if (state.compositionText) {
      ctx.font = `400 46px ${FONT_REGULAR}`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      ctx.save();
      ctx.beginPath();
      ctx.rect(cx + 28, pillY, pillW - 56, pillH);
      ctx.clip();
      ctx.fillText(state.compositionText, cx + 28, pillY + pillH / 2);

      const textW = ctx.measureText(state.compositionText).width;
      const cursorX = cx + 28 + textW + 3;
      const blink = Math.floor(state.time / 500) % 2 === 0;
      if (blink || state.isMeTyping) {
        this.drawPillRect(ctx, cursorX, pillY + 18, 6, pillH - 36, 3, '#FF0054');
      }
      ctx.restore();
    } else {
      ctx.font = `400 46px ${FONT_REGULAR}`;
      ctx.fillStyle = '#9CA3AF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Chat', cx + 28, pillY + pillH / 2);

      ctx.save();
      ctx.strokeStyle = '#9CA3AF';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const micX = cx + pillW - 50;
      const micY = pillY + pillH / 2;
      ctx.beginPath();
      ctx.arc(micX, micY - 6, 7, Math.PI, 0);
      ctx.lineTo(micX + 7, micY + 6);
      ctx.arc(micX, micY + 6, 7, 0, Math.PI);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(micX, micY + 6, 14, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(micX, micY + 20);
      ctx.lineTo(micX, micY + 28);
      ctx.stroke();
      ctx.restore();
    }

    if (!hasText) {
      const smileyImg = this.images.get('smiley');
      if (smileyImg) {
        const s = 46;
        ctx.drawImage(smileyImg, this.W - 200, y + (INPUT_H - s) / 2, s, s);
      }

      if (!isCropped) {
        const actionImg = this.images.get('actionIcons');
        if (actionImg) {
          const ah = 64;
          const aw = actionImg.width * (ah / actionImg.height);
          ctx.drawImage(actionImg, this.W - 120, y + (INPUT_H - ah) / 2, aw, ah);
        }
      }
    } else {
      const updownImg = this.images.get('updown');
      if (updownImg) {
        const s = 50;
        ctx.drawImage(updownImg, this.W - 120, y + (INPUT_H - s) / 2, s, s);
      }
    }
  }

  private drawKeyboard(ctx: CanvasRenderingContext2D, state: FrameState, y: number, totalH: number): void {
    ctx.fillStyle = '#D1D3D9';
    ctx.fillRect(0, y, this.W, totalH);

    const isShort = state.chatConfig.isShortCrop;
    const layout = state.keyboardLayout;

    const alphaRows = [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace']
    ];
    const numericRows = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
      ['#+=', '.', ',', '?', '!', "'", 'backspace']
    ];
    const symbolRows = [
      ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
      ['_', '\\', '|', '~', '<', '>', '$', '\u00a3', '\u00a5', '\u2022'],
      ['123', '.', ',', '?', '!', "'", 'backspace']
    ];

    let rows = alphaRows;
    if (layout === 'NUMERIC') rows = numericRows;
    if (layout === 'SYMBOLS') rows = symbolRows;

    const keyH = isShort ? 90 : 100;
    const rowGap = isShort ? 16 : 20;
    const keyGap = 10;
    const sidePad = isShort ? 16 : 22;
    let ky = y + (isShort ? 14 : 22);

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const rowPad = ri === 1 ? 44 : 0;
      const modifierW = 110;
      const modifiers = row.filter(k => this.isModifierKey(k));
      const charKeys = row.filter(k => !this.isModifierKey(k));
      const totalModW = modifiers.length * modifierW + modifiers.length * keyGap;
      const availW = this.W - sidePad * 2 - rowPad * 2 - totalModW - (charKeys.length > 0 ? (charKeys.length - 1) * keyGap : 0);
      const charKeyW = charKeys.length > 0 ? availW / charKeys.length : 0;

      let kx = sidePad + rowPad;

      for (const key of row) {
        const isModifier = this.isModifierKey(key);
        const isPressed = this.isKeyActive(key, state.activeKey);
        const w = isModifier ? modifierW : charKeyW;

        let bgColor = isModifier ? '#ACB0B8' : '#FFFFFF';
        if (isPressed) bgColor = '#D1D3D9';
        if (key === 'shift' && state.isShiftActive && !isPressed) bgColor = '#FFFFFF';

        this.drawPillRect(ctx, kx, ky, w, keyH, 16, bgColor);

        if (!isPressed) {
          ctx.fillStyle = 'rgba(0,0,0,0.30)';
          ctx.fillRect(kx + 4, ky + keyH - 3, w - 8, 3);
        }

        if (key === 'shift') {
          this.drawShiftIcon(ctx, kx + w / 2, ky + keyH / 2, state.isShiftActive);
        } else if (key === 'backspace') {
          this.drawBackspaceIcon(ctx, kx + w / 2, ky + keyH / 2);
        } else {
          ctx.fillStyle = '#000000';
          ctx.font = isModifier ? `500 36px ${FONT_SYSTEM}` : `400 56px ${FONT_SYSTEM}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          let displayKey = key;
          if (state.isShiftActive && key.length === 1 && layout === 'ALPHA') {
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
      const modW = 210;

      this.drawPillRect(ctx, sidePad, spaceRowY, modW, keyH, 16, '#ACB0B8');
      ctx.fillStyle = '#000000';
      ctx.font = `500 40px ${FONT_SYSTEM}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(layout === 'ALPHA' ? '123' : 'ABC', sidePad + modW / 2, spaceRowY + keyH / 2);

      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(sidePad + 4, spaceRowY + keyH - 3, modW - 8, 3);

      const spaceX = sidePad + modW + keyGap;
      const sendW = modW;
      const spaceW = this.W - sidePad * 2 - modW * 2 - keyGap * 2;
      const isSpacePressed = state.activeKey === ' ';
      this.drawPillRect(ctx, spaceX, spaceRowY, spaceW, keyH, 16, isSpacePressed ? '#ACB0B8' : '#FFFFFF');
      ctx.fillStyle = '#000000';
      ctx.font = `400 40px ${FONT_SYSTEM}`;
      ctx.fillText('space', spaceX + spaceW / 2, spaceRowY + keyH / 2);

      if (!isSpacePressed) {
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.fillRect(spaceX + 4, spaceRowY + keyH - 3, spaceW - 8, 3);
      }

      const sendX = spaceX + spaceW + keyGap;
      const isSendPressed = state.activeKey === 'Enter';
      this.drawPillRect(ctx, sendX, spaceRowY, sendW, keyH, 16, isSendPressed ? '#005FC4' : '#007AFF');
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `600 40px ${FONT_SYSTEM}`;
      ctx.fillText('send', sendX + sendW / 2, spaceRowY + keyH / 2);

      if (!isSendPressed) {
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.fillRect(sendX + 4, spaceRowY + keyH - 3, sendW - 8, 3);
      }
    }
  }

  private drawShiftIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, active: boolean): void {
    const s = 1.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-4.5, 0);
    ctx.lineTo(-4.5, 7);
    ctx.lineTo(4.5, 7);
    ctx.lineTo(4.5, 0);
    ctx.lineTo(9, 0);
    ctx.closePath();
    if (active) {
      ctx.fillStyle = '#000000';
      ctx.fill();
    } else {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBackspaceIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const s = 1.8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-6, 8);
    ctx.lineTo(10, 8);
    ctx.lineTo(10, -8);
    ctx.closePath();
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1, -3);
    ctx.lineTo(5, 3);
    ctx.moveTo(5, -3);
    ctx.lineTo(-1, 3);
    ctx.stroke();
    ctx.restore();
  }

  private isModifierKey(key: string): boolean {
    return ['shift', 'backspace', '#+=', 'ABC', '123'].includes(key);
  }

  private isKeyActive(key: string, activeKey: string | null): boolean {
    if (!activeKey) return false;
    const lk = key.toLowerCase();
    const la = activeKey.toLowerCase();
    if (la === lk && key.length === 1) return true;
    if (key === 'space' && activeKey === ' ') return true;
    if (lk === 'backspace' && la === 'backspace') return true;
    if (lk === 'shift' && la === 'shift') return true;
    if (key === 'send' && la === 'enter') return true;
    return false;
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
    if (!text) return [''];
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.length > 0 ? lines : [''];
  }

  private drawPillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
    r = Math.min(r, w / 2, h / 2);
    ctx.fillStyle = fill;
    ctx.beginPath();
    this.pillPath(ctx, x, y, w, h, r);
    ctx.fill();
  }

  private pillPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private drawRoundedImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number): void {
    ctx.save();
    ctx.beginPath();
    this.pillPath(ctx, x, y, w, h, r);
    ctx.clip();
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let dw: number, dh: number, dx: number, dy: number;
    if (imgRatio > boxRatio) {
      dh = h; dw = h * imgRatio; dx = x + (w - dw) / 2; dy = y;
    } else {
      dw = w; dh = w / imgRatio; dx = x; dy = y + (h - dh) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }
}
