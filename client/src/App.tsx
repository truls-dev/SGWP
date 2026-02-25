import React, { useState, useEffect, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AppState, CastMember, ScriptEvent, MessageType, TimedSoundEffect, TimedNotification, NotificationPlatform } from './types';
import StatusBar from './components/StatusBar';
import ChatHeader from './components/ChatHeader';
import ChatInput from './components/ChatInput';
import IOSKeyboard, { KeyboardLayout } from './components/IOSKeyboard';
import PresencePills from './components/PresencePills';
import TypingBubble from './components/TypingBubble';
import { SNAP_COLORS, GROUP_COLORS } from './constants';
import { soundService, MUSIC_TRACKS } from './services/soundService';
import { CanvasRenderer, FrameState } from './services/canvasRenderer';
import { 
  getRandomAvatarId,
  getSelfieUrlForAvatar,
  getPeekingUrlForAvatar
} from './services/bitmojiService';
import { findCustomojiSuggestion, getCustomojiUrl, preloadImage, initCatalog } from './services/customojiService';

const MIN_STICKER_DISPLAY_TIME = 500; 

function createWorkerTimer() {
  const blob = new Blob([`
    const timers = {};
    let nextId = 1;
    self.onmessage = (e) => {
      const { type, ms, id } = e.data;
      if (type === 'set') {
        const tid = nextId++;
        timers[tid] = setTimeout(() => { delete timers[tid]; self.postMessage({ type: 'fire', id: tid }); }, ms);
        self.postMessage({ type: 'ack', id: tid, reqId: id });
      } else if (type === 'clear') {
        if (timers[id]) { clearTimeout(timers[id]); delete timers[id]; }
      } else if (type === 'clearAll') {
        Object.keys(timers).forEach(k => { clearTimeout(timers[k]); delete timers[k]; });
      }
    };
  `], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(blob));
  const pending = new Map<number, () => void>();
  let reqCounter = 0;
  const ackMap = new Map<number, (timerId: number) => void>();

  worker.onmessage = (e) => {
    const { type, id, reqId } = e.data;
    if (type === 'fire') {
      const cb = pending.get(id);
      if (cb) { pending.delete(id); cb(); }
    } else if (type === 'ack') {
      const resolver = ackMap.get(reqId);
      if (resolver) { ackMap.delete(reqId); resolver(id); }
    }
  };

  return {
    delay(ms: number): Promise<void> {
      return new Promise(resolve => {
        const reqId = ++reqCounter;
        ackMap.set(reqId, (timerId) => { pending.set(timerId, resolve); });
        worker.postMessage({ type: 'set', ms, id: reqId });
      });
    },
    setTimeout(cb: () => void, ms: number): Promise<number> {
      return new Promise(resolve => {
        const reqId = ++reqCounter;
        ackMap.set(reqId, (timerId) => { pending.set(timerId, cb); resolve(timerId); });
        worker.postMessage({ type: 'set', ms, id: reqId });
      });
    },
    clearAll() {
      worker.postMessage({ type: 'clearAll' });
      pending.forEach(cb => cb());
      pending.clear();
      ackMap.forEach(resolver => resolver(-1));
      ackMap.clear();
    },
    terminate() {
      pending.forEach(cb => cb());
      pending.clear();
      ackMap.forEach(resolver => resolver(-1));
      ackMap.clear();
      worker.terminate();
    }
  };
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    cast: [
      { id: 'me', name: 'ME', bitmojiAvatarId: getRandomAvatarId(), isMe: true, color: GROUP_COLORS[1] },
      { id: 'kenny', name: 'Kenny Lin', bitmojiAvatarId: getRandomAvatarId(), isMe: false, color: GROUP_COLORS[0] },
    ],
    script: [
      { id: 's1', type: MessageType.TEXT, senderId: 'kenny', text: 'Helloooooo' },
      { id: 's2', type: MessageType.NOTIFICATION, text: 'YOU TOOK A SCREENSHOT OF CHAT!' },
      { id: 's3', type: MessageType.TEXT, senderId: 'me', text: 'Hows it going!!' },
    ],
    system: {
      carrier: 'ROGERS',
      time: '1:15',
      battery: 88,
      connectionType: '5G',
      signalStrength: 4,
      isSoundEnabled: true,
      uiScale: 1.50 
    },
    chat: {
      contactName: 'Kenny Lin',
      isGroup: false,
      groupName: 'The Squad',
      typingSpeed: 1,
      messageDelay: 500,
      groupIconUrl: undefined,
      isKeyboardCropped: false,
      isShortCrop: true,
      shortCropHeight: 850,
      topCornerRadius: 10,
      exportBackgroundUrl: undefined,
      isVideoBackgroundMode: true,
      exportBackgroundVideoUrl: undefined,
      videoModeScale: 0.78,
      messageFontSize: 40
    }
  });

  const [playbackMode, setPlaybackMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playbackItems, setPlaybackItems] = useState<ScriptEvent[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isShiftActive, setIsShiftActive] = useState(true);
  const [compositionText, setCompositionText] = useState<string>('');
  const [keyboardLayout, setKeyboardLayout] = useState<KeyboardLayout>('ALPHA');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportValue, setBulkImportValue] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'cast' | 'script'>('script');
  
  const [typingParticipantIds, setTypingParticipantIds] = useState<string[]>([]);
  const [activeParticipantIds, setActiveParticipantIds] = useState<string[]>([]);
  const [preArrivedIds, setPreArrivedIds] = useState<string[]>([]);
  const [isMeTyping, setIsMeTyping] = useState(false);
  const [showRecInstructions, setShowRecInstructions] = useState(false);

  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const [musicTrack, setMusicTrack] = useState<string>('');
  const [musicVolume, setMusicVolume] = useState(0.15);
  const [isMusicPreviewing, setIsMusicPreviewing] = useState(false);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  const [sfxVolume, setSfxVolume] = useState(0.15);
  const [timedSoundEffects, setTimedSoundEffects] = useState<TimedSoundEffect[]>([]);
  const [timedNotifications, setTimedNotifications] = useState<TimedNotification[]>([]);

  const [appendOutro, setAppendOutro] = useState(false);
  const outroVideoElRef = useRef<HTMLVideoElement | null>(null);
  const outroActiveRef = useRef(false);

  const [suggestedUrl, setSuggestedUrl] = useState<string | null>(null);
  const lastStickerChangeTimeRef = useRef<number>(0);
  const stickerTimeoutRef = useRef<number | null>(null);

  const runningStatusRef = useRef<'idle' | 'previewing' | 'recording'>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentToRecordRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  
  const videoEncoderRef = useRef<any>(null);
  const audioEncoderRef = useRef<any>(null);
  const muxerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canvasRendererRef = useRef<CanvasRenderer | null>(null);
  const previewCanvasContainerRef = useRef<HTMLDivElement>(null);
  const staticPreviewRendererRef = useRef<CanvasRenderer | null>(null);
  const staticPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticPreviewContainerRef = useRef<HTMLDivElement>(null);
  const previewAnimFrameRef = useRef<number | null>(null);
  const timedSfxTimeoutsRef = useRef<number[]>([]);
  const workerTimerRef = useRef<ReturnType<typeof createWorkerTimer> | null>(null);
  const frameStateRef = useRef<FrameState>({
    messages: [],
    compositionText: '',
    isMeTyping: false,
    activeKey: null,
    isShiftActive: true,
    keyboardLayout: 'ALPHA',
    typingParticipantIds: [],
    activeParticipantIds: [],
    scriptParticipantIds: [],
    systemConfig: state.system,
    chatConfig: state.chat,
    cast: state.cast,
    time: 0,
    backgroundVideo: null,
    suggestedCustomojiUrl: null,
  });

  const groupIconInputRef = useRef<HTMLInputElement>(null);
  const exportBgInputRef = useRef<HTMLInputElement>(0 as any);
  const exportBgVideoInputRef = useRef<HTMLInputElement>(0 as any);
  const timelineImageInputRef = useRef<HTMLInputElement>(0 as any);
  const activeTimelineEventIdRef = useRef<string | null>(null);

  const messagesToRender = playbackMode ? playbackItems : state.script;
  const [scriptParticipantIds, setScriptParticipantIds] = useState<string[]>([]);

  useEffect(() => {
    initCatalog();
    soundService.prepare();
    soundService.setSfxVolume(0.15);
  }, []);

  useEffect(() => {
    frameStateRef.current = {
      ...frameStateRef.current,
      messages: playbackMode ? playbackItems : state.script,
      compositionText,
      isMeTyping,
      activeKey,
      isShiftActive,
      keyboardLayout,
      ...(playbackMode ? {} : { typingParticipantIds, activeParticipantIds }),
      scriptParticipantIds,
      systemConfig: state.system,
      chatConfig: state.chat,
      cast: state.cast,
      backgroundVideo: previewVideoRef.current,
      suggestedCustomojiUrl: suggestedUrl,
      activeNotifications: timedNotifications.filter(n => {
        const elapsed = frameStateRef.current.time - n.timeMs;
        return elapsed >= -50 && elapsed < n.durationMs;
      }),
    };
  });

  useEffect(() => {
    const ids = Array.from(new Set(
      state.script
        .filter(s => s.senderId && s.senderId !== 'me')
        .map(s => s.senderId as string)
    ));
    setScriptParticipantIds(ids);

    if (!playbackMode) {
      setActiveParticipantIds(ids);
    }
  }, [state.script, playbackMode]);

  useEffect(() => {
    if (!compositionText.trim()) return;

    const match = findCustomojiSuggestion(compositionText);
    if (!match) return;

    const me = state.cast.find(c => c.isMe);
    if (!me) return;

    const other = state.cast.find(c => !c.isMe);
    const newUrl = getCustomojiUrl(match, me.bitmojiAvatarId, other?.bitmojiAvatarId);

    if (newUrl === suggestedUrl) return;

    const performUpdate = () => {
      setSuggestedUrl(newUrl);
      preloadImage(newUrl);
      lastStickerChangeTimeRef.current = Date.now();
      stickerTimeoutRef.current = null;
    };

    const now = Date.now();
    const timeSinceLast = now - lastStickerChangeTimeRef.current;

    if (stickerTimeoutRef.current) {
      clearTimeout(stickerTimeoutRef.current);
    }

    if (timeSinceLast >= MIN_STICKER_DISPLAY_TIME) {
      performUpdate();
    } else {
      stickerTimeoutRef.current = window.setTimeout(performUpdate, MIN_STICKER_DISPLAY_TIME - timeSinceLast);
    }
  }, [compositionText, state.cast, suggestedUrl]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [playbackItems, playbackMode, compositionText, typingParticipantIds, state.script, isMeTyping]);

  useEffect(() => {
    if (playbackMode || isRecording) return;
    if (!staticPreviewRendererRef.current) {
      staticPreviewRendererRef.current = new CanvasRenderer();
    }
    const renderer = staticPreviewRendererRef.current;
    renderer.preload(state.cast, state.script, state.chat);
    const renderPreview = () => {
      const canvasEl = renderer.renderFrame(frameStateRef.current);
      staticPreviewCanvasRef.current = canvasEl;
      const container = staticPreviewContainerRef.current;
      if (container) {
        container.innerHTML = '';
        canvasEl.style.maxWidth = '100%';
        canvasEl.style.maxHeight = '100%';
        canvasEl.style.display = 'block';
        container.appendChild(canvasEl);
      }
    };
    renderPreview();
    const t1 = setTimeout(renderPreview, 500);
    const t2 = setTimeout(renderPreview, 1500);
    const t3 = setTimeout(renderPreview, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [state, compositionText, isMeTyping, activeKey, isShiftActive, keyboardLayout, typingParticipantIds, activeParticipantIds, scriptParticipantIds, playbackMode, isRecording, suggestedUrl]);

  const toggleGroupMode = () => {
    setState(prev => ({
      ...prev,
      chat: { ...prev.chat, isGroup: !prev.chat.isGroup }
    }));
  };

  const safePlayVideo = (videoEl: HTMLVideoElement | null) => {
    if (!videoEl) return;
    videoEl.play().catch(() => {});
  };

  const resetSimulationState = () => {
    const preShownItems: ScriptEvent[] = [];
    const preShownActiveIds: string[] = [];
    for (let i = 0; i < state.script.length; i++) {
      if (!state.script[i].isPreShown) break;
      const preEvent = state.script[i];
      if (preEvent.type === MessageType.PRESENCE && preEvent.senderId) {
        if (preEvent.presenceAction === 'ENTER') {
          if (!preShownActiveIds.includes(preEvent.senderId)) preShownActiveIds.push(preEvent.senderId);
        }
      } else if (preEvent.type !== MessageType.NOTIFICATION && preEvent.senderId && preEvent.senderId !== 'me') {
        if (!preShownActiveIds.includes(preEvent.senderId)) preShownActiveIds.push(preEvent.senderId);
      }
      if ((preEvent.type === MessageType.TEXT || preEvent.type === MessageType.STICKER || preEvent.type === MessageType.IMAGE || preEvent.type === MessageType.NOTIFICATION) && !preEvent.isBackspaced) {
        preShownItems.push({ ...preEvent, instanceId: uuidv4() });
      }
    }

    setPlaybackItems(preShownItems);
    setCompositionText('');
    setTypingParticipantIds([]);
    setActiveParticipantIds(preShownActiveIds);
    setPreArrivedIds([...preShownActiveIds]);
    setIsMeTyping(false);
    setActiveKey(null);
    setIsShiftActive(true);
    setSuggestedUrl(null);
    setKeyboardLayout('ALPHA');
    frameStateRef.current.activeParticipantIds = preShownActiveIds;
    frameStateRef.current.typingParticipantIds = [];
    frameStateRef.current.compositionText = '';
    frameStateRef.current.isMeTyping = false;
    if (canvasRendererRef.current) {
      canvasRendererRef.current.resetAnimations();
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = 0;
      if (playbackMode) {
        safePlayVideo(previewVideoRef.current);
      }
    }
  };

  const handleNewChat = () => {
    runningStatusRef.current = 'idle';
    setPlaybackMode(false);
    setIsRecording(false);
    
    setState(prev => {
      const me = prev.cast.find(c => c.isMe)!;
      return {
        ...prev,
        cast: [
          me,
          { id: 'kenny', name: 'Kenny Lin', bitmojiAvatarId: getRandomAvatarId(), isMe: false, color: GROUP_COLORS[0] }
        ], 
        script: [], 
        chat: {
          ...prev.chat,
          contactName: 'Kenny Lin',
          groupName: 'The Squad',
          groupIconUrl: undefined,
          isKeyboardCropped: false,
          isShortCrop: true,
          shortCropHeight: 850,
          topCornerRadius: 10,
          exportBackgroundUrl: undefined,
          isVideoBackgroundMode: false,
          exportBackgroundVideoUrl: undefined,
          videoModeScale: 0.78,
          messageFontSize: 40
        }
      };
    });
    
    resetSimulationState();
  };

  const handleGroupIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result;
        if (typeof result === 'string') {
          updateChat('groupIconUrl', result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result;
        if (typeof result === 'string') {
          updateChat('exportBackgroundUrl', result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportBgVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateChat('exportBackgroundVideoUrl', url);
    }
  };

  const OUTRO_WEBM_URL = 'https://raw.githubusercontent.com/truls-dev/images/main/animationsubscribe.webm';

  const handleTimelineImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeTimelineEventIdRef.current) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result;
        if (typeof result === 'string') {
          const eventId = activeTimelineEventIdRef.current;
          
          const img = new Image();
          img.onload = () => {
            const isVertical = img.naturalHeight > img.naturalWidth;
            setState(prev => ({
              ...prev,
              script: prev.script.map(s => s.id === eventId ? { ...s, mediaUrl: result, isVertical } : s)
            }));
          };
          img.src = result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBulkImport = () => {
    if (!bulkImportValue.trim()) return;

    const lines = bulkImportValue.split('\n').filter(l => l.trim().includes(':'));
    const newScriptEvents: ScriptEvent[] = [];
    let updatedCast = [...state.cast];

    lines.forEach(line => {
      const parts = line.split(':');
      const rawName = parts[0].trim();
      const messageText = parts.slice(1).join(':').trim();
      const cleanText = messageText.toLowerCase().replace(/[\*\_\s]/g, '');

      let sender = updatedCast.find(c => c.name.toLowerCase() === rawName.toLowerCase());
      
      if (!sender) {
        if (!state.chat.isGroup && updatedCast.length >= 2) {
          sender = updatedCast.find(c => !c.isMe);
        } else {
          sender = {
            id: uuidv4(),
            name: rawName,
            bitmojiAvatarId: getRandomAvatarId(),
            isMe: false,
            color: GROUP_COLORS[updatedCast.length % GROUP_COLORS.length]
          };
          updatedCast.push(sender);
        }
      }

      if (cleanText === 'arrival') {
        newScriptEvents.push({ id: uuidv4(), type: MessageType.PRESENCE, senderId: sender?.id, presenceAction: 'ENTER' });
      } else if (cleanText === 'departure') {
        newScriptEvents.push({ id: uuidv4(), type: MessageType.PRESENCE, senderId: sender?.id, presenceAction: 'LEAVE' });
      } else if (cleanText === 'image') {
        newScriptEvents.push({ id: uuidv4(), type: MessageType.IMAGE, senderId: sender?.id, text: '', isVertical: false });
      } else {
        newScriptEvents.push({ id: uuidv4(), type: MessageType.TEXT, senderId: sender?.id, text: messageText });
      }
    });

    setState(prev => {
        const firstOther = updatedCast.find(c => !c.isMe);
        return {
            ...prev,
            cast: updatedCast,
            script: [...prev.script, ...newScriptEvents],
            chat: (!prev.chat.isGroup && firstOther) 
                ? { ...prev.chat, contactName: firstOther.name }
                : prev.chat
        };
    });
    setBulkImportValue('');
    setShowBulkImport(false);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newScript = [...state.script];
    const [draggedItem] = newScript.splice(draggedItemIndex, 1);
    newScript.splice(index, 0, draggedItem);

    setState(prev => ({ ...prev, script: newScript }));
    setDraggedItemIndex(null);
  };

  const addCastMember = (name: string = 'New Friend'): CastMember | null => {
    if (!state.chat.isGroup && state.cast.filter(c => !c.isMe).length >= 1) {
      alert("1-on-1 mode supports only one partner. Toggle 'Group Message' to add more members.");
      return null;
    }

    const newMember: CastMember = {
      id: uuidv4(),
      name,
      bitmojiAvatarId: getRandomAvatarId(),
      isMe: false,
      color: state.chat.isGroup
        ? GROUP_COLORS[state.cast.length % GROUP_COLORS.length]
        : SNAP_COLORS.THEM
    };
    setState(prev => ({ 
        ...prev, 
        cast: [...prev.cast, newMember],
        chat: (!prev.chat.isGroup && prev.cast.filter(c => !c.isMe).length === 0)
            ? { ...prev.chat, contactName: newMember.name }
            : prev.chat
    }));
    return newMember;
  };

  const removeCastMember = (memberId: string) => {
    setState(prev => {
      const memberToRemove = prev.cast.find(c => c.id === memberId);
      if (!memberToRemove || memberToRemove.isMe) return prev;
      const newCast = prev.cast.filter(c => c.id !== memberId);
      const newScript = prev.script.filter(s => s.senderId !== memberId); 
      
      const nextOther = newCast.find(c => !c.isMe);
      return { 
        ...prev, 
        cast: newCast, 
        script: newScript,
        chat: (!prev.chat.isGroup && memberId === prev.cast.find(c => !c.isMe)?.id)
            ? { 
                ...prev.chat, 
                contactName: nextOther?.name || 'New Chat'
              }
            : prev.chat
      };
    });
  };

  const addScriptItem = (type: MessageType, senderId?: string) => {
    const newItem: ScriptEvent = {
      id: uuidv4(),
      type,
      senderId: senderId || (type === MessageType.PRESENCE ? state.cast.find(c => !c.isMe)?.id : state.cast[0].id),
      text: type === MessageType.NOTIFICATION ? 'NEW NOTIFICATION' : (type === MessageType.PRESENCE ? '' : (type === MessageType.IMAGE ? '' : 'New message')),
      presenceAction: type === MessageType.PRESENCE ? 'ENTER' : undefined,
      isVertical: false,
      isBackspaced: false
    };
    setState(prev => ({ ...prev, script: [...prev.script, newItem] }));
  };

  const removeScriptItem = (id: string) => {
    setState(prev => {
      const itemToRemove = prev.script.find(s => s.id === id);
      return { ...prev, script: prev.script.filter(s => s.id !== id) };
    });
  };

  const cycleAvatar = (memberId: string) => {
    setState(prev => {
      const memberObj = prev.cast.find(c => c.id === memberId);
      if (!memberObj) return prev;
      
      const newCast = prev.cast.map(c => c.id === memberId ? { 
        ...c, 
        bitmojiAvatarId: getRandomAvatarId()
      } : c);
      
      return {
        ...prev,
        cast: newCast
      };
    });
  };

  const randomizeAllBitmojis = () => {
    setState(prev => ({
      ...prev,
      cast: prev.cast.map(c => ({
        ...c,
        bitmojiAvatarId: getRandomAvatarId()
      }))
    }));
  };

  const updateSystem = (key: keyof typeof state.system, value: any) => {
    setState(prev => ({ ...prev, system: { ...prev.system, [key]: value } }));
  };

  const updateChat = (key: keyof typeof state.chat, value: any) => {
    setState(prev => ({ ...prev, chat: { ...prev.chat, [key]: value } }));
  };

  const handleCustomojiSelect = () => {
    if (!suggestedUrl) return;
    const me = state.cast.find(c => c.isMe);
    const newSticker: ScriptEvent = {
      id: uuidv4(),
      type: MessageType.STICKER,
      senderId: me?.id || 'me',
      mediaUrl: suggestedUrl
    };
    
    setState(prev => ({
      ...prev,
      script: [...prev.script, newSticker]
    }));
    
    if (playbackMode) {
      setPlaybackItems(prev => [...prev, { ...newSticker, instanceId: uuidv4(), revealedAt: Date.now() }]);
    }
    
    setCompositionText('');
    setIsShiftActive(true);
  };

  const handleManualSend = () => {
    if (!compositionText.trim()) return;
    const me = state.cast.find(c => c.isMe);
    const newMsg: ScriptEvent = {
      id: uuidv4(),
      type: MessageType.TEXT,
      senderId: me?.id || 'me',
      text: compositionText 
    };
    
    setState(prev => ({
      ...prev,
      script: [...prev.script, newMsg]
    }));
    
    if (playbackMode) {
      setPlaybackItems(prev => [...prev, { ...newMsg, instanceId: uuidv4(), revealedAt: Date.now() }]);
    }
    
    setCompositionText('');
    setIsShiftActive(true);
  };

  const runPlaybackLoop = async (isRecordingMode: boolean) => {
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = 0;
      safePlayVideo(previewVideoRef.current);
    }

    const wt = isRecordingMode ? workerTimerRef.current : null;
    const delay = (ms: number) => wt ? wt.delay(ms) : new Promise<void>(r => setTimeout(r, ms));

    // TRACK STATE LOCALLY TO AVOID CLOSURE STALENESS
    let localActiveParticipantIds: string[] = [...frameStateRef.current.activeParticipantIds];
    let localTypingParticipantIds: string[] = [];
    let hasPlayedFirstNotif = false;
    
    const updateActiveIds = (newIds: string[]) => {
      localActiveParticipantIds = newIds;
      setActiveParticipantIds(newIds);
      frameStateRef.current.activeParticipantIds = newIds;
    };
    
    const updateTypingIds = (newIds: string[]) => {
      localTypingParticipantIds = newIds;
      setTypingParticipantIds(newIds);
      frameStateRef.current.typingParticipantIds = newIds;
    };

    await delay(300);

    timedSfxTimeoutsRef.current.forEach(t => clearTimeout(t));
    timedSfxTimeoutsRef.current = [];
    if (state.system.isSoundEnabled && timedSoundEffects.length > 0) {
      for (const tse of timedSoundEffects) {
        if (wt) {
          wt.setTimeout(() => {
            if ((runningStatusRef.current as string) !== 'idle') {
              soundService.playEffect(tse.effectName);
            }
          }, tse.timeMs);
        } else {
          const tid = window.setTimeout(() => {
            if ((runningStatusRef.current as string) !== 'idle') {
              soundService.playEffect(tse.effectName);
            }
          }, tse.timeMs);
          timedSfxTimeoutsRef.current.push(tid);
        }
      }
    }

    const scriptToPlay = state.script;

    let startIdx = 0;
    for (let i = 0; i < scriptToPlay.length; i++) {
      if (!scriptToPlay[i].isPreShown) break;
      startIdx = i + 1;
    }

    for (let idx = startIdx; idx < scriptToPlay.length; idx++) {
      const event = scriptToPlay[idx];
      if ((runningStatusRef.current as string) === 'idle') break;
      
      if (event.type === MessageType.TEXT && event.senderId === 'me') {
        const firstChar = event.text?.[0];
        setIsShiftActive(firstChar ? /[A-Z]/.test(firstChar) : true);
      } else {
        setIsShiftActive(true);
      }

      await delay(300);

      if (event.type === MessageType.PRESENCE && event.senderId) {
        if (event.presenceAction === 'ENTER') {
          updateActiveIds(Array.from(new Set([event.senderId as string, ...localActiveParticipantIds])));
        } else {
          updateActiveIds(localActiveParticipantIds.filter(id => id !== event.senderId));
        }
        await delay(500);
        continue; 
      }

      // If it's the other person sending, ensure they "arrive" before typing/sending
      if (event.senderId && event.senderId !== 'me' && (event.type === MessageType.TEXT || event.type === MessageType.IMAGE || event.type === MessageType.STICKER)) {
        if (!localActiveParticipantIds.includes(event.senderId)) {
           updateActiveIds(Array.from(new Set([event.senderId as string, ...localActiveParticipantIds])));
           await delay(600);
        }
      }

      if (event.type === MessageType.NOTIFICATION) {
        if (!event.isBackspaced) {
          setPlaybackItems(prev => [...prev, { ...event, instanceId: uuidv4(), revealedAt: Date.now() }]);
        }
        if (state.system.isSoundEnabled && event.soundEffect) {
          await soundService.playEffect(event.soundEffect);
        }
        await delay(1000);
      } else if (event.type === MessageType.STICKER || event.type === MessageType.IMAGE) {
        const sender = state.cast.find(c => c.id === event.senderId);
        if (!sender) continue;
        
        if (!sender.isMe) {
            updateTypingIds(Array.from(new Set([...localTypingParticipantIds, sender.id])));
            await delay(state.chat.messageDelay);
            updateTypingIds(localTypingParticipantIds.filter(id => id !== sender.id));
        }

        if (!event.isBackspaced) {
          setPlaybackItems(prev => [...prev, { ...event, instanceId: uuidv4(), revealedAt: Date.now() }]);
        }

        // POST-SEND REALISM: Arrival logic for "Kenny" reacting to "Me"
        if (sender.isMe && !state.chat.isGroup) {
           const them = state.cast.find(c => !c.isMe);
           if (them && !localActiveParticipantIds.includes(them.id)) {
              await delay(500);
              updateActiveIds(Array.from(new Set([...localActiveParticipantIds, them.id])));
              await delay(400); 
           }
        }
        
        if (state.system.isSoundEnabled) {
          if (event.soundEffect) {
            await soundService.playEffect(event.soundEffect);
          } else if (!sender.isMe && !event.isBackspaced) {
            if (!hasPlayedFirstNotif) {
              soundService.playNotification();
              hasPlayedFirstNotif = true;
            } else {
              soundService.playClick();
              soundService.playSubsequentNotification();
            }
          }
        }
        await delay(800);
      } else if (event.type === MessageType.TEXT) {
        const sender = state.cast.find(c => c.id === event.senderId);
        if (!sender) continue;

        if (sender.isMe) {
          setIsMeTyping(true);
          const chars = Array.from(event.text || "");
          let currentString = "";
          let currentLayout: KeyboardLayout = 'ALPHA';

          for (let i = 0; i < chars.length; i++) {
            if ((runningStatusRef.current as string) === 'idle') break;
            
            const char = chars[i];
            const isAlpha = /[a-zA-Z]/.test(char);
            const isSpace = char === ' ';
            const isNumericOrSymbol = !isAlpha && !isSpace;
            
            if (isNumericOrSymbol && currentLayout !== 'NUMERIC') {
                setKeyboardLayout('NUMERIC');
                currentLayout = 'NUMERIC';
                await delay(80);
            } 
            else if (isAlpha && currentLayout !== 'ALPHA') {
                setKeyboardLayout('ALPHA');
                currentLayout = 'ALPHA';
                await delay(80);
            }

            if (isAlpha && char !== char.toLowerCase() && char === char.toUpperCase()) {
              setIsShiftActive(true);
            } else {
              setIsShiftActive(false);
            }
            
            setActiveKey(char);
            if (state.system.isSoundEnabled) soundService.playClick();
            await delay(70);
            setActiveKey(null);
            
            currentString += char; 
            setCompositionText(currentString);
            await delay(i === 0 ? 0 : state.chat.typingSpeed);
          }

          if ((runningStatusRef.current as string) === 'idle') break;
          
          if (event.isBackspaced) {
            if (currentLayout !== 'ALPHA') {
              setKeyboardLayout('ALPHA');
              currentLayout = 'ALPHA';
              await delay(80);
            }

            await delay(300);
            let graphemes = Array.from(currentString);
            for (let i = graphemes.length; i > 0; i--) {
                if ((runningStatusRef.current as string) === 'idle') break;
                
                setActiveKey('backspace');
                if (state.system.isSoundEnabled) soundService.playBackspace();
                await delay(70);
                setActiveKey(null);
                
                graphemes.pop();
                currentString = graphemes.join('');
                setCompositionText(currentString);
                await delay(state.chat.typingSpeed);
            }
            setCompositionText('');
            setIsMeTyping(false);
            setIsShiftActive(true); 
            await delay(400);
          } else {
            if (currentLayout !== 'ALPHA') {
              setKeyboardLayout('ALPHA');
              currentLayout = 'ALPHA';
              await delay(300);
            }

            await delay(120);
            setActiveKey('Enter');
            setIsShiftActive(false);
            if (state.system.isSoundEnabled) soundService.playClick();
            await delay(70);
            setActiveKey(null);
            
            setPlaybackItems(prev => [...prev, { ...event, text: currentString, instanceId: uuidv4(), revealedAt: Date.now() }]);
            setCompositionText(''); 
            setIsMeTyping(false);
            setIsShiftActive(true); 

            if (state.system.isSoundEnabled) {
              if (event.soundEffect) {
                await soundService.playEffect(event.soundEffect);
              } else {
                soundService.playSubsequentNotification();
              }
            }

            // POST-SEND REALISM: Arrival logic for Them noticing my text
            if (!state.chat.isGroup) {
              const them = state.cast.find(c => !c.isMe);
              if (them && !localActiveParticipantIds.includes(them.id)) {
                 await delay(500);
                 updateActiveIds(Array.from(new Set([...localActiveParticipantIds, them.id])));
                 await delay(400);
              }
            }
            await delay(400);
          }
        } else {
          // PARTNER SENDER
          updateTypingIds(Array.from(new Set([...localTypingParticipantIds, sender.id])));
          await delay(state.chat.messageDelay);
          updateTypingIds(localTypingParticipantIds.filter(id => id !== sender.id));
          
          if (!event.isBackspaced) {
            setPlaybackItems(prev => [...prev, { ...event, instanceId: uuidv4(), revealedAt: Date.now() }]);
          }

          if (state.system.isSoundEnabled) {
            if (event.soundEffect) {
              await soundService.playEffect(event.soundEffect);
            } else if (!event.isBackspaced) {
              if (!hasPlayedFirstNotif) {
                soundService.playNotification();
                hasPlayedFirstNotif = true;
              } else {
                soundService.playClick();
                soundService.playSubsequentNotification();
              }
            }
          }
          await delay(800);
        }
      }
    }

    if (isRecordingMode && runningStatusRef.current === 'recording') {
      await delay(3000);
      stopRecordingSession();
    } else {
      if (previewAnimFrameRef.current) {
        cancelAnimationFrame(previewAnimFrameRef.current);
        previewAnimFrameRef.current = null;
      }
      if (previewCanvasContainerRef.current) {
        previewCanvasContainerRef.current.innerHTML = '';
      }
      canvasRendererRef.current = null;
      setPlaybackMode(false);
      runningStatusRef.current = 'idle';
      setIsShiftActive(true); 
      if (previewVideoRef.current) previewVideoRef.current.pause();
    }
  };

  const startPlaybackSequence = async (recording: boolean = false) => {
    if (recording) {
      const win = window as any;
      if (!win.VideoEncoder || !win.AudioEncoder) {
          alert("Your browser does not support high-fidelity video export (WebCodecs). Please use Chrome or Edge.");
          return;
      }
      setShowRecInstructions(true);
    } else {
        soundService.stopMusicPreview();
        setIsMusicPreviewing(false);
        setPlaybackMode(true);
        runningStatusRef.current = 'previewing';
        await soundService.prepare();
        soundService.setRecordingSyncDelay(0);

        if (previewAnimFrameRef.current) {
          cancelAnimationFrame(previewAnimFrameRef.current);
          previewAnimFrameRef.current = null;
        }

        const renderer = new CanvasRenderer();
        canvasRendererRef.current = renderer;
        await renderer.preload(state.cast, state.script, state.chat);
        renderer.enablePresence();
        if (frameStateRef.current.activeParticipantIds.length > 0) {
          renderer.preArriveParticipants(frameStateRef.current.activeParticipantIds);
        }

        const canvasEl = renderer.getCanvas();
        canvasEl.style.maxWidth = '100%';
        canvasEl.style.maxHeight = '100%';
        canvasEl.style.display = 'block';

        if (previewCanvasContainerRef.current) {
          previewCanvasContainerRef.current.innerHTML = '';
          previewCanvasContainerRef.current.appendChild(canvasEl);
        }

        const startTime = performance.now();
        const previewRenderLoop = () => {
          if (runningStatusRef.current !== 'previewing') return;
          const now = performance.now();
          const currentFrameState: FrameState = {
            ...frameStateRef.current,
            time: now - startTime,
          };
          renderer.renderFrame(currentFrameState);
          previewAnimFrameRef.current = requestAnimationFrame(previewRenderLoop);
        };
        previewAnimFrameRef.current = requestAnimationFrame(previewRenderLoop);

        runPlaybackLoop(false);
    }
  };

  const stopPlayback = () => {
    runningStatusRef.current = 'idle';
    setPlaybackMode(false);
    setIsRecording(false);
    resetSimulationState();
    soundService.stopMusicPreview();
    setIsMusicPreviewing(false);

    outroActiveRef.current = false;
    if (outroVideoElRef.current) {
      outroVideoElRef.current.pause();
      outroVideoElRef.current.src = '';
      outroVideoElRef.current = null;
    }

    timedSfxTimeoutsRef.current.forEach(t => clearTimeout(t));
    timedSfxTimeoutsRef.current = [];

    if (workerTimerRef.current) {
      workerTimerRef.current.terminate();
      workerTimerRef.current = null;
    }
    
    if (previewAnimFrameRef.current) {
      cancelAnimationFrame(previewAnimFrameRef.current);
      previewAnimFrameRef.current = null;
    }
    if (previewCanvasContainerRef.current) {
      previewCanvasContainerRef.current.innerHTML = '';
    }
    
    if (videoEncoderRef.current) { try { videoEncoderRef.current.close(); } catch(e){} videoEncoderRef.current = null; }
    if (audioEncoderRef.current) { try { audioEncoderRef.current.close(); } catch(e){} audioEncoderRef.current = null; }
    
    canvasRendererRef.current = null;
    
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (previewVideoRef.current) previewVideoRef.current.pause();
    
    const win = window as any;
    if (win.finishWebCodecsExport) delete win.finishWebCodecsExport;
  };

  const cancelExport = () => {
    soundService.stopRecordingMode();
    stopPlayback();
  };

  const initiateRecording = async () => {
    setShowRecInstructions(false);
    const win = window as any;
    try {
      resetSimulationState();
      setPlaybackMode(true);

      const MuxerLib = await import('mp4-muxer');
      const { Muxer, ArrayBufferTarget } = MuxerLib;

      await soundService.prepare();
      soundService.setRecordingSyncDelay(0);
      soundService.stopMusicPreview();
      setIsMusicPreviewing(false);
      if (musicTrack) {
        await soundService.loadMusicTrack(musicTrack);
      }
      soundService.startRecordingMode();

      if (workerTimerRef.current) workerTimerRef.current.terminate();
      workerTimerRef.current = createWorkerTimer();

      const renderer = new CanvasRenderer();
      canvasRendererRef.current = renderer;
      await renderer.preload(state.cast, state.script, state.chat);
      renderer.enablePresence();
      if (frameStateRef.current.activeParticipantIds.length > 0) {
        renderer.preArriveParticipants(frameStateRef.current.activeParticipantIds);
      }

      const canvas = renderer.getCanvas();
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '100%';
      canvas.style.display = 'block';
      if (previewCanvasContainerRef.current) {
        previewCanvasContainerRef.current.innerHTML = '';
        previewCanvasContainerRef.current.appendChild(canvas);
      }

      setIsRecording(true);
      await new Promise(r => setTimeout(r, 500));

      runningStatusRef.current = 'recording';

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: canvas.width,
          height: canvas.height
        },
        audio: {
          codec: 'aac',
          sampleRate: 48000,
          numberOfChannels: 2
        },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset'
      });
      muxerRef.current = muxer;

      const videoEncoder = new win.VideoEncoder({
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: any) => console.error("VideoEncoder error:", e)
      });

      videoEncoder.configure({
        codec: 'avc1.640033',
        width: canvas.width,
        height: canvas.height,
        bitrate: 10_000_000,
        framerate: 60,
        latencyMode: 'quality'
      });
      videoEncoderRef.current = videoEncoder;

      const audioEncoder = new win.AudioEncoder({
        output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
        error: (e: any) => console.error("AudioEncoder error:", e)
      });
      audioEncoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 192_000
      });
      audioEncoderRef.current = audioEncoder;

      let isFinished = false;

      soundService.resetRecordingStartTime();
      const startTime = performance.now();
      const fps = 60;
      const frameDurationUs = 1000000 / fps;
      let frameCount = 0;

      const renderLoop = async () => {
        if (runningStatusRef.current !== 'recording' || isFinished) return;

        const now = performance.now();
        const elapsedUs = (now - startTime) * 1000;
        const targetFrames = Math.floor(elapsedUs / frameDurationUs);

        const maxBatch = 120;
        let rendered = 0;
        while (frameCount <= targetFrames && rendered < maxBatch) {
            const currentFrameState: FrameState = {
              ...frameStateRef.current,
              time: now - startTime,
            };
            renderer.renderFrame(currentFrameState);

            if (outroActiveRef.current && outroVideoElRef.current) {
              const outroVid = outroVideoElRef.current;
              const ctx = canvas.getContext('2d');
              if (ctx && outroVid.videoWidth > 0 && outroVid.videoHeight > 0) {
                const dx = (canvas.width - outroVid.videoWidth) / 2;
                const dy = canvas.height - outroVid.videoHeight;
                ctx.drawImage(outroVid, dx, dy, outroVid.videoWidth, outroVid.videoHeight);
              }
            }

            const frameTimestamp = Math.floor(frameCount * frameDurationUs);
            const frame = new win.VideoFrame(canvas, { timestamp: frameTimestamp });

            if (videoEncoder.state === 'configured') {
                const keyFrame = frameCount % 120 === 0;
                videoEncoder.encode(frame, { keyFrame });
            }
            frame.close();
            frameCount++;
            rendered++;
        }
        setTimeout(renderLoop, 0);
      };

      setTimeout(renderLoop, 0);

      if (appendOutro) {
        const outroVideo = document.createElement('video');
        outroVideo.muted = true;
        outroVideo.playsInline = true;
        outroVideo.preload = 'auto';
        outroVideo.crossOrigin = 'anonymous';
        outroVideo.src = OUTRO_WEBM_URL;
        outroVideo.onloadeddata = () => {
          outroVideoElRef.current = outroVideo;
          const outroDurationMs = (outroVideo.duration || 4) * 1000;
          const outroStartMs = Math.max(0, estimatedDurationMs - outroDurationMs);
          const elapsedSinceStart = performance.now() - startTime;
          const remainingDelay = Math.max(0, outroStartMs - elapsedSinceStart);
          console.log(`[Outro] Pre-loaded in ${(elapsedSinceStart / 1000).toFixed(1)}s. Will start overlay in ${(remainingDelay / 1000).toFixed(1)}s`);
          const wt = workerTimerRef.current;
          const scheduleOutro = wt ? wt.setTimeout.bind(wt) : (fn: () => void, ms: number) => window.setTimeout(fn, ms);
          scheduleOutro(() => {
            if (runningStatusRef.current === 'recording' && outroVideoElRef.current) {
              outroActiveRef.current = true;
              outroVideoElRef.current.play().catch(() => {});
              console.log('[Outro] Overlay started');
            }
          }, remainingDelay);
          outroVideo.onended = () => {
            outroActiveRef.current = false;
            console.log('[Outro] Overlay animation finished');
          };
        };
        outroVideo.onerror = () => console.warn('[Outro] Failed to pre-load outro video');
      }

      runPlaybackLoop(true);

      win.finishWebCodecsExport = async () => {
        if (isFinished) return;
        isFinished = true;
        try {
            const totalDurationMs = performance.now() - startTime;
            const soundEvents = soundService.stopRecordingMode();

            await videoEncoder.flush();

            const mainVideoFrameDurationMs = (frameCount * frameDurationUs) / 1000;
            const totalVideoMs = mainVideoFrameDurationMs;

            const offlineAudio = await soundService.renderOffline(
              soundEvents,
              mainVideoFrameDurationMs,
              musicTrack || undefined,
              musicVolume
            );
            const audioSampleRate = offlineAudio.sampleRate;
            const left = offlineAudio.left;
            const right = offlineAudio.right;

            const numberOfChannels = 2;
            const chunkSize = 4800;
            const totalSamples = left.length;

            console.log(`[AudioEncode] Encoding ${totalSamples} samples at ${audioSampleRate}Hz`);

            for (let offset = 0; offset < totalSamples; offset += chunkSize) {
              const len = Math.min(chunkSize, totalSamples - offset);
              const planarData = new Float32Array(len * numberOfChannels);
              planarData.set(left.subarray(offset, offset + len), 0);
              planarData.set(right.subarray(offset, offset + len), len);
              const audioData = new win.AudioData({
                format: 'f32-planar',
                sampleRate: audioSampleRate,
                numberOfFrames: len,
                numberOfChannels: numberOfChannels,
                timestamp: Math.round((offset / audioSampleRate) * 1_000_000),
                data: planarData,
              });
              if (audioEncoder.state === 'configured') {
                audioEncoder.encode(audioData);
              }
              audioData.close();
            }

            await audioEncoder.flush();
            muxer.finalize();

            const buffer = muxer.target.buffer;
            const blob = new Blob([buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SnapGen_HD_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            console.error("Finalization failed:", e);
        }
        stopPlayback();
      };

    } catch (err) {
      console.error("Recording error:", err);
      alert("Failed to start recording. Please try again.");
      soundService.stopRecordingMode();
      stopPlayback();
    }
  };

  const stopRecordingSession = () => {
    const win = window as any;
    if (win.finishWebCodecsExport) {
        win.finishWebCodecsExport();
    }
  };

  const estimatedDurationMs = useMemo(() => {
    let totalMs = 0;
    const { script, cast, chat } = state;
    const isGroup = chat.isGroup;
    const activeIds: string[] = [];

    let estStartIdx = 0;
    for (let i = 0; i < script.length; i++) {
      if (!script[i].isPreShown) break;
      estStartIdx = i + 1;
    }
    

    for (let idx = estStartIdx; idx < script.length; idx++) {
      const event = script[idx];
      totalMs += 300;

      if (event.type === MessageType.PRESENCE) {
        if (event.presenceAction === 'ENTER' && event.senderId) activeIds.push(event.senderId);
        totalMs += 500;
        continue;
      }

      const sender = cast.find(c => c.id === event.senderId);
      if (!sender && event.type !== MessageType.NOTIFICATION) continue;

      if (event.senderId && event.senderId !== 'me' && (event.type === MessageType.TEXT || event.type === MessageType.IMAGE || event.type === MessageType.STICKER)) {
        if (!activeIds.includes(event.senderId)) {
          activeIds.push(event.senderId);
          totalMs += 600;
        }
      }

      if (event.type === MessageType.NOTIFICATION) {
        totalMs += 1000;
      } else if (event.type === MessageType.STICKER || event.type === MessageType.IMAGE) {
        if (sender && !sender.isMe) {
          totalMs += chat.messageDelay;
        }
        if (sender?.isMe && !isGroup) {
          const them = cast.find(c => !c.isMe);
          if (them && !activeIds.includes(them.id)) {
            activeIds.push(them.id);
            totalMs += 900;
          }
        }
        totalMs += 800;
      } else if (event.type === MessageType.TEXT) {
        if (sender?.isMe) {
          const chars = Array.from(event.text || "");
          let currentLayout = 'ALPHA';
          for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            const isAlpha = /[a-zA-Z]/.test(char);
            const isSpace = char === ' ';
            const isNumericOrSymbol = !isAlpha && !isSpace;
            if (isNumericOrSymbol && currentLayout !== 'NUMERIC') {
              currentLayout = 'NUMERIC';
              totalMs += 80;
            } else if (isAlpha && currentLayout !== 'ALPHA') {
              currentLayout = 'ALPHA';
              totalMs += 80;
            }
            totalMs += 70;
            totalMs += (i === 0 ? 0 : chat.typingSpeed);
          }
          if (event.isBackspaced) {
            if (currentLayout !== 'ALPHA') totalMs += 80;
            totalMs += 300;
            for (let i = chars.length; i > 0; i--) {
              totalMs += 70 + chat.typingSpeed;
            }
            totalMs += 400;
          } else {
            if (currentLayout !== 'ALPHA') totalMs += 300;
            totalMs += 120 + 70;
            if (!isGroup) {
              const them = cast.find(c => !c.isMe);
              if (them && !activeIds.includes(them.id)) {
                activeIds.push(them.id);
                totalMs += 900;
              }
            }
            totalMs += 400;
          }
        } else {
          totalMs += chat.messageDelay;
          totalMs += 800;
        }
      }
    }
    totalMs += 3000;
    return totalMs;
  }, [state.script, state.cast, state.chat.messageDelay, state.chat.typingSpeed, state.chat.isGroup]);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const scale = state.system.uiScale || 1;
  const partnerMember = state.cast.find(c => !c.isMe);
  const isPartnerTyping = partnerMember && typingParticipantIds.includes(partnerMember.id);
  const isPartnerArrived = partnerMember && activeParticipantIds.includes(partnerMember.id);
  const isPartnerPreArrived = partnerMember && preArrivedIds.includes(partnerMember.id);
  const partnerAvatarUrl = partnerMember 
    ? (isPartnerTyping ? getSelfieUrlForAvatar(partnerMember.bitmojiAvatarId) : getPeekingUrlForAvatar(partnerMember.bitmojiAvatarId))
    : null;

  const isVideoMode = state.chat.isVideoBackgroundMode;
  const previewInterfaceScaleFactor = isVideoMode ? state.chat.videoModeScale : 1;
  const phoneAspect = !playbackMode && !isRecording ? '9 / 16' : '9 / 19.5';
  const basePhoneWidth = `calc((${isRecording ? '100vh' : '98vh'}) * ${phoneAspect} * ${previewInterfaceScaleFactor})`;

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] overflow-hidden text-white font-sans">
      <div 
        className={`w-[480px] border-r border-white/10 bg-[#121212] flex flex-col transition-all duration-700 ease-in-out ${
          'ml-0 opacity-100'
        }`}
      >
        <div className="shrink-0 px-6 pt-4 pb-3 bg-[#121212] border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black mb-0 flex items-center gap-2">
                <span className="text-[#FFFC00] drop-shadow-[0_0_10px_rgba(255,252,0,0.3)]">👻</span> 
                SnapGen Pro
              </h2>
              <button 
                onClick={() => setShowInfoModal(true)}
                className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-[#33B5FF] hover:border-[#33B5FF]/50 transition-all active:scale-90"
              >
                <i className="fa-solid fa-circle-info text-sm"></i>
              </button>
            </div>
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-bold">Studio Dashboard</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 no-scrollbar">

        <div className="flex bg-white/5 rounded-2xl border border-white/10 p-1 gap-1">
          {(['script', 'cast', 'settings'] as const).map(tab => (
            <button
              key={tab}
              data-testid={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-[#33B5FF] text-white shadow-lg shadow-[#33B5FF]/20' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {tab === 'script' ? 'Script' : tab === 'cast' ? 'Cast' : 'Settings'}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-10">
          {activeTab === 'settings' && (
          <>
          <section className="space-y-4">
            <div className="flex items-center justify-between bg-white/5 p-5 rounded-3xl border border-white/10">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Group Message</span>
                  <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Multi-Cast Mode</span>
                </div>
                <button 
                  onClick={toggleGroupMode}
                  className={`w-14 h-7 rounded-full transition-all relative ${state.chat.isGroup ? 'bg-[#33B5FF]' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${state.chat.isGroup ? 'right-1' : 'left-1'}`} />
                </button>
            </div>
          </section>

          <div className="space-y-10">
            <section className="space-y-6">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Simulation & Performance</h3>
              <div className="bg-white/5 p-6 rounded-[32px] border border-white/5 space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                     <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Typing Speed</label>
                        <span className="text-[10px] font-black text-[#33B5FF]">{state.chat.typingSpeed}ms</span>
                     </div>
                     <input 
                      type="range" min="1" max="300" step="1" 
                      value={state.chat.typingSpeed} 
                      onChange={e => updateChat('typingSpeed', parseInt(e.target.value))}
                      className="w-full accent-[#33B5FF] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                     />
                  </div>
                  <div className="space-y-4">
                     <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Wait</label>
                        <span className="text-[10px] font-black text-[#33B5FF]">{state.chat.messageDelay}ms</span>
                     </div>
                     <input 
                      type="range" min="500" max="4000" step="100" 
                      value={state.chat.messageDelay} 
                      onChange={e => updateChat('messageDelay', parseInt(e.target.value))}
                      className="w-full accent-[#33B5FF] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                     />
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Message Font Size</label>
                      <span className="text-[10px] font-black text-[#33B5FF]">{state.chat.messageFontSize}px</span>
                   </div>
                   <input 
                    data-testid="input-message-font-size"
                    type="range" min="30" max="80" step="1" 
                    value={state.chat.messageFontSize} 
                    onChange={e => updateChat('messageFontSize', parseInt(e.target.value))}
                    className="w-full accent-[#33B5FF] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                   />
                </div>

                <div className="space-y-3 px-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">SFX Volume</label>
                    <span className="text-[10px] font-black text-[#33B5FF]">{Math.round(sfxVolume * 100)}%</span>
                  </div>
                  <input
                    data-testid="input-sfx-volume"
                    type="range" min="0" max="100" step="1"
                    value={Math.round(sfxVolume * 100)}
                    onChange={e => {
                      const vol = parseInt(e.target.value) / 100;
                      setSfxVolume(vol);
                      soundService.setSfxVolume(vol);
                    }}
                    className="w-full accent-[#33B5FF] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-3 px-1 pt-2 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Timed Sound Effects</label>
                    <button
                      data-testid="button-add-timed-sfx"
                      onClick={() => setTimedSoundEffects(prev => [...prev, { id: uuidv4(), effectName: 'Bruh', timeMs: 0 }])}
                      className="text-[10px] font-black text-[#33B5FF] hover:text-white transition-colors flex items-center gap-1"
                    >
                      <i className="fa-solid fa-plus text-[8px]"></i> Add
                    </button>
                  </div>
                  {timedSoundEffects.length === 0 && (
                    <p className="text-[9px] text-gray-600 italic">No timed effects. Add one to play a sound at a specific timestamp.</p>
                  )}
                  {timedSoundEffects.map((tse, idx) => (
                    <div key={tse.id} data-testid={`timed-sfx-row-${idx}`} className="flex items-center gap-2">
                      <select
                        data-testid={`select-timed-sfx-effect-${idx}`}
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none cursor-pointer focus:border-[#33B5FF]"
                        value={tse.effectName}
                        onChange={e => {
                          const updated = [...timedSoundEffects];
                          updated[idx] = { ...updated[idx], effectName: e.target.value };
                          setTimedSoundEffects(updated);
                        }}
                      >
                        <option value="Bruh">Bruh</option>
                        <option value="Crickets">Crickets</option>
                        <option value="Rizz">Rizz</option>
                        <option value="Shocked">Shocked</option>
                        <option value="Shocking">Shocking</option>
                      </select>
                      <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5">
                        <span className="text-[9px] text-gray-500">@</span>
                        <input
                          data-testid={`input-timed-sfx-time-${idx}`}
                          type="number"
                          min="0"
                          step="0.1"
                          value={(tse.timeMs / 1000).toFixed(1)}
                          onChange={e => {
                            const updated = [...timedSoundEffects];
                            updated[idx] = { ...updated[idx], timeMs: Math.max(0, parseFloat(e.target.value || '0') * 1000) };
                            setTimedSoundEffects(updated);
                          }}
                          className="w-[48px] bg-transparent text-[10px] font-bold outline-none text-center"
                        />
                        <span className="text-[9px] text-gray-500">s</span>
                      </div>
                      <button
                        data-testid={`button-remove-timed-sfx-${idx}`}
                        onClick={() => setTimedSoundEffects(prev => prev.filter(t => t.id !== tse.id))}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1"
                      >
                        <i className="fa-solid fa-xmark text-[10px]"></i>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 px-1 pt-2 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Timed Notifications</label>
                    <button
                      data-testid="button-add-timed-notif"
                      onClick={() => setTimedNotifications(prev => [...prev, { id: uuidv4(), platform: 'Messages' as NotificationPlatform, senderName: 'Jane', message: "I'm on my way!", timeMs: 0, durationMs: 2500 }])}
                      className="text-[10px] font-black text-[#33B5FF] hover:text-white transition-colors flex items-center gap-1"
                    >
                      <i className="fa-solid fa-plus text-[8px]"></i> Add
                    </button>
                  </div>
                  {timedNotifications.length === 0 && (
                    <p className="text-[9px] text-gray-600 italic">No timed notifications. Add one to show an iPhone notification banner during the video.</p>
                  )}
                  {timedNotifications.map((tn, idx) => (
                    <div key={tn.id} data-testid={`timed-notif-row-${idx}`} className="bg-black/20 rounded-xl p-3 space-y-2 border border-white/5">
                      <div className="flex items-center gap-2">
                        <select
                          data-testid={`select-notif-platform-${idx}`}
                          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none cursor-pointer focus:border-[#33B5FF]"
                          value={tn.platform}
                          onChange={e => {
                            const updated = [...timedNotifications];
                            updated[idx] = { ...updated[idx], platform: e.target.value as NotificationPlatform };
                            setTimedNotifications(updated);
                          }}
                        >
                          <option value="Messages">Messages</option>
                          <option value="Snapchat">Snapchat</option>
                        </select>
                        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5">
                          <span className="text-[9px] text-gray-500">@</span>
                          <input
                            data-testid={`input-notif-time-${idx}`}
                            type="number"
                            min="0"
                            step="0.1"
                            value={(tn.timeMs / 1000).toFixed(1)}
                            onChange={e => {
                              const updated = [...timedNotifications];
                              updated[idx] = { ...updated[idx], timeMs: Math.max(0, parseFloat(e.target.value || '0') * 1000) };
                              setTimedNotifications(updated);
                            }}
                            className="w-[48px] bg-transparent text-[10px] font-bold outline-none text-center"
                          />
                          <span className="text-[9px] text-gray-500">s</span>
                        </div>
                        <button
                          data-testid={`button-remove-notif-${idx}`}
                          onClick={() => setTimedNotifications(prev => prev.filter(t => t.id !== tn.id))}
                          className="text-gray-500 hover:text-red-400 transition-colors p-1"
                        >
                          <i className="fa-solid fa-xmark text-[10px]"></i>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          data-testid={`input-notif-sender-${idx}`}
                          type="text"
                          placeholder="Sender name"
                          value={tn.senderName}
                          onChange={e => {
                            const updated = [...timedNotifications];
                            updated[idx] = { ...updated[idx], senderName: e.target.value };
                            setTimedNotifications(updated);
                          }}
                          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:border-[#33B5FF]"
                        />
                        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5">
                          <input
                            data-testid={`input-notif-duration-${idx}`}
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={(tn.durationMs / 1000).toFixed(1)}
                            onChange={e => {
                              const updated = [...timedNotifications];
                              updated[idx] = { ...updated[idx], durationMs: Math.max(500, parseFloat(e.target.value || '2') * 1000) };
                              setTimedNotifications(updated);
                            }}
                            className="w-[36px] bg-transparent text-[10px] font-bold outline-none text-center"
                          />
                          <span className="text-[9px] text-gray-500">s dur</span>
                        </div>
                      </div>
                      <input
                        data-testid={`input-notif-message-${idx}`}
                        type="text"
                        placeholder="Notification message"
                        value={tn.message}
                        onChange={e => {
                          const updated = [...timedNotifications];
                          updated[idx] = { ...updated[idx], message: e.target.value };
                          setTimedNotifications(updated);
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:border-[#33B5FF]"
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-[9px] text-gray-500 shrink-0">Profile pic:</label>
                        <input
                          data-testid={`input-notif-icon-${idx}`}
                          type="file"
                          accept="image/*"
                          className="text-[9px] text-gray-400 min-w-0 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[9px] file:font-bold file:bg-white/10 file:text-gray-300 hover:file:bg-white/20"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = URL.createObjectURL(file);
                              const updated = [...timedNotifications];
                              updated[idx] = { ...updated[idx], customIconUrl: url };
                              setTimedNotifications(updated);
                            }
                          }}
                        />
                        <button
                          data-testid={`button-notif-bitmoji-${idx}`}
                          onClick={() => {
                            const avatarId = getRandomAvatarId();
                            const url = getSelfieUrlForAvatar(avatarId);
                            const updated = [...timedNotifications];
                            updated[idx] = { ...updated[idx], customIconUrl: url };
                            setTimedNotifications(updated);
                          }}
                          className="shrink-0 bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-[9px] font-black uppercase text-gray-300 hover:bg-[#33B5FF] hover:text-white transition-all active:scale-95"
                        >
                          <i className="fa-solid fa-wand-sparkles mr-1"></i>Bitmoji
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Carrier</label>
                    <input type="text" value={state.system.carrier} onChange={e => updateSystem('carrier', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[#33B5FF]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Time</label>
                    <input type="text" value={state.system.time} onChange={e => updateSystem('time', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[#33B5FF]" />
                  </div>
                </div>

                <div className="space-y-6 pt-2 border-t border-white/10">
                   <div className="space-y-3">
                     <div className="flex flex-col gap-1 px-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Global UI Scale</label>
                          <span className="text-[10px] font-black text-[#33B5FF]">{state.system.uiScale.toFixed(2)}x</span>
                        </div>
                        <span className="text-[9px] text-gray-500 italic">Optimal scale with keyboard: 1.50x / Without keyboard: 1.80x</span>
                     </div>
                     <input 
                      type="range" min="0.8" max="2.5" step="0.05" 
                      value={state.system.uiScale} 
                      onChange={e => updateSystem('uiScale', parseFloat(e.target.value))}
                      className="w-full accent-[#33B5FF] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                     />
                   </div>

                   <div className="space-y-3 border-t border-white/10 pt-4">
                     <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Top Corner Radius</label>
                        <span className="text-[10px] font-black text-[#33B5FF]">{state.chat.topCornerRadius}px</span>
                     </div>
                     <input 
                      type="range" min="0" max="100" step="1" 
                      value={state.chat.topCornerRadius} 
                      onChange={e => updateChat('topCornerRadius', parseInt(e.target.value))}
                      className="w-full accent-[#33B5FF] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                     />
                   </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Keyboard crop</span>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">TikTok Side Frame</span>
                  </div>
                  <button 
                    onClick={() => updateChat('isKeyboardCropped', !state.chat.isKeyboardCropped)}
                    className={`w-14 h-7 rounded-full transition-all relative ${state.chat.isKeyboardCropped ? 'bg-[#33B5FF]' : 'bg-gray-600'}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${state.chat.isKeyboardCropped ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex flex-col pt-2 border-t border-white/10 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">Short Crop</span>
                      <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Vertical Center Frame</span>
                    </div>
                    <button 
                      onClick={() => updateChat('isShortCrop', !state.chat.isShortCrop)}
                      className={`w-14 h-7 rounded-full transition-all relative ${state.chat.isShortCrop ? 'bg-[#33B5FF]' : 'bg-gray-600'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${state.chat.isShortCrop ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                  
                  {state.chat.isShortCrop && (
                    <div className="space-y-3 px-1 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Crop Height</label>
                        <span className="text-[10px] font-black text-[#33B5FF]">{state.chat.shortCropHeight}px</span>
                      </div>
                      <input 
                        type="range" min="400" max="1100" step="5" 
                        value={state.chat.shortCropHeight} 
                        onChange={e => updateChat('shortCropHeight', parseInt(e.target.value))}
                        className="w-full accent-[#33B5FF] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col pt-2 border-t border-white/10 gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">Video Background Mode</span>
                      <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest text-[#FF0054]">Pro Cinematic Mode</span>
                    </div>
                    <button 
                      onClick={() => {
                        const nextVal = !state.chat.isVideoBackgroundMode;
                        setState(prev => ({
                          ...prev,
                          chat: { 
                            ...prev.chat, 
                            isVideoBackgroundMode: nextVal,
                            isShortCrop: nextVal ? true : prev.chat.isShortCrop 
                          }
                        }));
                      }}
                      className={`w-14 h-7 rounded-full transition-all relative ${state.chat.isVideoBackgroundMode ? 'bg-[#FF0054]' : 'bg-gray-600'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${state.chat.isVideoBackgroundMode ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  {state.chat.isVideoBackgroundMode && (
                    <div className="space-y-6 animate-in slide-in-from-top-2 duration-300 px-1">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Phone Interface Scale</label>
                            <span className="text-[10px] font-black text-[#FF0054]">{state.chat.videoModeScale.toFixed(2)}x</span>
                        </div>
                        <input 
                          type="range" min="0.4" max="1.0" step="0.01" 
                          value={state.chat.videoModeScale} 
                          onChange={e => updateChat('videoModeScale', parseFloat(e.target.value))}
                          className="w-full accent-[#FF0054] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Background MP4 Video</label>
                        <button 
                          onClick={() => exportBgVideoInputRef.current?.click()}
                          className="w-full bg-white/5 border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase text-gray-200 hover:bg-[#FF0054] hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <i className="fa-solid fa-video"></i> {state.chat.exportBackgroundVideoUrl ? 'Change Video' : 'Upload BG Video'}
                        </button>
                        <input 
                          type="file" 
                          ref={exportBgVideoInputRef} 
                          className="hidden" 
                          accept="video/*" 
                          onChange={handleExportBgVideoUpload}
                        />
                        {state.chat.exportBackgroundVideoUrl && (
                          <button 
                            onClick={() => updateChat('exportBackgroundVideoUrl', undefined)}
                            className="text-[9px] text-red-400 hover:text-red-300 font-bold uppercase underline"
                          >
                            Remove Video
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {!state.chat.isVideoBackgroundMode && (
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Export Background Image</label>
                      <button 
                        onClick={() => exportBgInputRef.current?.click()}
                        className="w-full bg-white/5 border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase text-gray-200 hover:bg-[#33B5FF] hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <i className="fa-solid fa-image"></i> {state.chat.exportBackgroundUrl ? 'Change Background' : 'Upload Background'}
                      </button>
                      <input 
                        type="file" 
                        ref={exportBgInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleExportBgUpload}
                      />
                      {state.chat.exportBackgroundUrl && (
                        <button 
                          onClick={() => updateChat('exportBackgroundUrl', undefined)}
                          className="text-[9px] text-red-400 hover:text-red-300 font-bold uppercase underline"
                        >
                          Remove Background
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Music Track</label>
                    <select
                      data-testid="select-music-track"
                      value={musicTrack}
                      onChange={e => {
                        const val = e.target.value;
                        soundService.stopMusicPreview();
                        setIsMusicPreviewing(false);
                        setMusicTrack(val);
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-[#33B5FF] appearance-none cursor-pointer"
                    >
                      <option value="">None</option>
                      {MUSIC_TRACKS.map(t => (
                        <option key={t.filename} value={t.filename}>{t.name}</option>
                      ))}
                    </select>

                    {musicTrack && (
                      <div className="space-y-4 pt-2 animate-in fade-in duration-300">
                        <button
                          data-testid="button-preview-music"
                          disabled={isMusicLoading}
                          onClick={async () => {
                            if (isMusicPreviewing) {
                              soundService.stopMusicPreview();
                              setIsMusicPreviewing(false);
                            } else {
                              setIsMusicLoading(true);
                              await soundService.previewMusic(musicTrack, musicVolume);
                              setIsMusicLoading(false);
                              setIsMusicPreviewing(true);
                            }
                          }}
                          className="w-full bg-white/5 border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase text-gray-200 hover:bg-[#33B5FF] hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                          {isMusicLoading ? (
                            <><i className="fa-solid fa-spinner fa-spin"></i> Loading...</>
                          ) : isMusicPreviewing ? (
                            <><i className="fa-solid fa-stop"></i> Stop Preview</>
                          ) : (
                            <><i className="fa-solid fa-play"></i> Preview Track</>
                          )}
                        </button>

                        <div className="space-y-3 px-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Music Volume</label>
                            <span className="text-[10px] font-black text-[#33B5FF]">{Math.round(musicVolume * 100)}%</span>
                          </div>
                          <input
                            data-testid="input-music-volume"
                            type="range" min="0" max="100" step="1"
                            value={Math.round(musicVolume * 100)}
                            onChange={e => {
                              const vol = parseInt(e.target.value) / 100;
                              setMusicVolume(vol);
                              if (isMusicPreviewing) {
                                soundService.setPreviewVolume(vol);
                              }
                            }}
                            className="w-full accent-[#33B5FF] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <button 
            onClick={handleNewChat}
            className="w-full bg-red-600/20 border border-red-500/30 text-red-400 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600/30 transition-all active:scale-95"
          >
            <i className="fa-solid fa-trash-can mr-2"></i> Reset Studio
          </button>
          </>
          )}

          {activeTab === 'cast' && (
          <>
          <div className="space-y-10">
            {state.chat.isGroup && (
            <section className="space-y-6">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Group Settings</h3>
              <div className="space-y-5 bg-white/5 p-6 rounded-[32px] border border-white/5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Group Name</label>
                      <input 
                        type="text" value={state.chat.groupName} 
                        onChange={e => updateChat('groupName', e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-[#33B5FF]"
                      />
                    </div>
                    <div className="space-y-2 pt-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Group Icon</label>
                      <button 
                        onClick={() => groupIconInputRef.current?.click()}
                        className="w-full bg-white/5 border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase text-gray-200 hover:bg-[#33B5FF] hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <i className="fa-solid fa-cloud-arrow-up"></i> {state.chat.groupIconUrl ? 'Change Group Icon' : 'Upload Group Icon'}
                      </button>
                      <input 
                        type="file" 
                        ref={groupIconInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleGroupIconUpload}
                      />
                    </div>
                    <button 
                      onClick={randomizeAllBitmojis}
                      className="w-full bg-white/5 border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase text-gray-200 hover:bg-[#33B5FF] hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <i className="fa-solid fa-shuffle"></i> Randomize All Cast Bitmojis
                    </button>
              </div>
            </section>
            )}

            <section className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">The Cast</h3>
                <button onClick={() => addCastMember()} className="bg-[#33B5FF] text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition hover:scale-105 active:scale-95 shadow-lg shadow-[#33B5FF]/20">+ Add Member</button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {state.cast.map(member => (
                  <div key={member.id} className="bg-white/5 p-5 rounded-[28px] border border-white/5 relative group transition-all hover:bg-white/[0.08]">
                    {!member.isMe && (
                      <button onClick={() => removeCastMember(member.id)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white">
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    )}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-[#FFFC00] overflow-hidden border-2 border-transparent flex items-center justify-center shrink-0" style={{ borderColor: member.color }}>
                        <img src={getSelfieUrlForAvatar(member.bitmojiAvatarId)} className="w-full h-full object-contain scale-[1.3]" alt="Bitmoji" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <input 
                          className={`bg-transparent text-[13px] font-bold w-full focus:text-[#33B5FF] outline-none truncate ${member.isMe ? 'pointer-events-none' : ''}`}
                          value={member.name}
                          readOnly={member.isMe}
                          onChange={e => {
                            if (member.isMe) return;
                            const val = e.target.value;
                            setState(prev => {
                              const newCast = prev.cast.map(c => c.id === member.id ? { ...c, name: val } : c);
                              const firstOther = newCast.find(c => !c.isMe);
                              if (firstOther && firstOther.id === member.id && !prev.chat.isGroup) {
                                return { ...prev, cast: newCast, chat: { ...prev.chat, contactName: val } };
                              }
                              return { ...prev, cast: newCast };
                            });
                          }}
                        />
                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{member.isMe ? 'Main User (You)' : 'Participant'}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => cycleAvatar(member.id)}
                      className="w-full bg-white/5 border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase text-gray-200 hover:bg-[#33B5FF] hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <i className="fa-solid fa-wand-sparkles"></i> Randomize Bitmoji
                    </button>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter Bitmoji ID"
                        data-testid={`input-bitmoji-id-${member.id}`}
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-gray-200 placeholder-gray-600 outline-none focus:border-[#33B5FF]"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val) {
                              setState(prev => ({
                                ...prev,
                                cast: prev.cast.map(c => c.id === member.id ? { ...c, bitmojiAvatarId: val } : c)
                              }));
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                      <button
                        data-testid={`button-set-bitmoji-${member.id}`}
                        onClick={e => {
                          const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement;
                          const val = input?.value.trim();
                          if (val) {
                            setState(prev => ({
                              ...prev,
                              cast: prev.cast.map(c => c.id === member.id ? { ...c, bitmojiAvatarId: val } : c)
                            }));
                            input.value = '';
                          }
                        }}
                        className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-[10px] font-black uppercase text-gray-200 hover:bg-[#33B5FF] hover:text-white transition-all active:scale-95"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          </>
          )}

          {activeTab === 'script' && (
          <>
          <div className="space-y-10">
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Story Timeline</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setState(prev => ({ ...prev, script: [] })); }}
                    className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-white/20 text-gray-400 hover:border-red-500/50 hover:text-red-400 transition-all"
                    data-testid="button-clear-script"
                  >
                    Clear Script
                  </button>
                  <button 
                    onClick={() => setShowBulkImport(!showBulkImport)} 
                    className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${showBulkImport ? 'bg-white text-black border-white' : 'border-white/20 text-gray-400 hover:border-white/50'}`}
                  >
                    {showBulkImport ? 'Manual Edit' : 'Bulk Import'}
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                {showBulkImport ? (
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                    <textarea 
                      className="w-full h-48 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-medium outline-none focus:border-[#33B5FF] resize-none placeholder-gray-700"
                      placeholder="Name: Message&#10;Name: *arrival*&#10;Name: *IMAGE*"
                      value={bulkImportValue}
                      onChange={e => setBulkImportValue(e.target.value)}
                    />
                    <button 
                      onClick={handleBulkImport}
                      className="w-full bg-[#33B5FF] text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-[#33B5FF]/10 active:scale-[0.98] transition-all"
                    >
                      Process Script
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {state.script.map((item, idx) => (
                        <div 
                          key={item.id} 
                          draggable 
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={(e) => handleDrop(e, idx)}
                          onDragEnd={() => setDraggedItemIndex(null)}
                          className={`bg-black/30 border ${item.type === MessageType.PRESENCE ? 'border-[#33B5FF]/30 bg-[#33B5FF]/5' : 'border-white/10'} p-4 rounded-2xl relative transition-all hover:border-white/20 cursor-grab active:cursor-grabbing ${draggedItemIndex === idx ? 'opacity-40 grayscale scale-95' : 'opacity-100'}`}
                        >
                          <div className="flex justify-between items-center mb-2.5 pointer-events-none">
                            <div className="flex gap-2 items-center pointer-events-auto">
                              <div className="text-gray-600 px-1"><i className="fa-solid fa-grip-vertical"></i></div>
                              <select 
                                className="bg-[#1a1a1a] border border-white/10 text-[10px] font-bold rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:bg-black transition-colors" 
                                value={item.type === MessageType.NOTIFICATION ? 'SYSTEM' : (item.type === MessageType.PRESENCE ? 'PRESENCE' : item.senderId)} 
                                onChange={e => {
                                  const val = e.target.value;
                                  const newScript = [...state.script];
                                  if (val === 'SYSTEM') {
                                      newScript[idx] = { ...item, type: MessageType.NOTIFICATION, senderId: undefined };
                                  } else if (val === 'PRESENCE') {
                                      newScript[idx] = { ...item, type: MessageType.PRESENCE, senderId: state.cast.find(c => !c.isMe)?.id, presenceAction: 'ENTER' };
                                  } else {
                                      newScript[idx] = { ...item, type: item.type === MessageType.NOTIFICATION || item.type === MessageType.PRESENCE ? MessageType.TEXT : item.type, senderId: val };
                                  }
                                  setState(prev => ({ ...prev, script: newScript }));
                                }}
                              >
                                <option value="SYSTEM">Alert / Notification</option>
                                <option value="PRESENCE">Presence Event</option>
                                {state.cast.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div className="flex items-center gap-2 pointer-events-auto">
                               <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                                 <i className="fa-solid fa-volume-high text-[10px] text-gray-500"></i>
                                 <select
                                   className="bg-transparent border-none text-[10px] font-bold outline-none cursor-pointer hover:text-[#33B5FF] transition-colors"
                                   value={item.soundEffect || ""}
                                   onChange={e => {
                                      const newScript = [...state.script];
                                      newScript[idx].soundEffect = e.target.value || undefined;
                                      setState(prev => ({ ...prev, script: newScript }));
                                   }}
                                 >
                                   <option value="">No Sound</option>
                                   <option value="Bruh">Bruh</option>
                                   <option value="Crickets">Crickets</option>
                                   <option value="Rizz">Rizz</option>
                                   <option value="Shocked">Shocked</option>
                                   <option value="Shocking">Shocking</option>
                                 </select>
                               </div>
                               {item.type === MessageType.IMAGE && (
                                  <button 
                                    onClick={() => { activeTimelineEventIdRef.current = item.id; (timelineImageInputRef.current as any)?.click(); }}
                                    className="text-[10px] font-black uppercase text-[#33B5FF] hover:text-white transition-colors flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md"
                                  >
                                    <i className="fa-solid fa-camera"></i> {item.mediaUrl ? 'Swap Image' : 'Upload'}
                                  </button>
                               )}
                               <button
                                 title={item.isPreShown ? "Will show at start" : "Show at start"}
                                 onClick={() => {
                                   const newScript = [...state.script];
                                   newScript[idx] = { ...item, isPreShown: !item.isPreShown };
                                   setState(prev => ({ ...prev, script: newScript }));
                                 }}
                                 className={`text-[10px] transition-all ${item.isPreShown ? 'text-green-400' : 'text-gray-600 hover:text-gray-400'}`}
                               >
                                 <i className={`fa-solid ${item.isPreShown ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                               </button>
                               <button onClick={() => removeScriptItem(item.id)} className="text-gray-600 hover:text-red-500 transition-colors"><i className="fa-solid fa-circle-xmark"></i></button>
                            </div>
                          </div>
                          
                          <div className="pointer-events-auto">
                            {item.type === MessageType.PRESENCE ? (
                               <div className="space-y-3 mt-1">
                                   <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/5">
                                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest pl-1">Participant:</span>
                                      <select 
                                        className="bg-transparent border-none text-[10px] font-bold outline-none cursor-pointer hover:text-[#33B5FF] transition-colors flex-1"
                                        value={item.senderId || ""}
                                        onChange={e => {
                                          const newScript = [...state.script];
                                          newScript[idx] = { ...item, senderId: e.target.value };
                                          setState(prev => ({ ...prev, script: newScript }));
                                        }}
                                      >
                                        {state.cast.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                      </select>
                                   </div>
                                   <div className="flex items-center gap-3">
                                       <button onClick={() => { const newScript = [...state.script]; newScript[idx].presenceAction = 'ENTER'; setState(prev => ({ ...prev, script: newScript })); }} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${item.presenceAction === 'ENTER' ? 'bg-[#33B5FF] text-white' : 'bg-white/5 text-gray-400'}`}>Arrival</button>
                                       <button onClick={() => { const newScript = [...state.script]; newScript[idx].presenceAction = 'LEAVE'; setState(prev => ({ ...prev, script: newScript })); }} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${item.presenceAction === 'LEAVE' ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-400'}`}>Departure</button>
                                   </div>
                               </div>
                            ) : item.type === MessageType.STICKER ? (
                              <div className="space-y-2">
                                <div className="flex justify-center p-2 bg-white/5 rounded-xl border border-white/5">
                                  <img src={item.mediaUrl} className="h-16 object-contain" alt="Sticker" />
                                </div>
                                <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-2">
                                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Changed mind mode</span>
                                  <button 
                                    onClick={() => {
                                      const newScript = [...state.script];
                                      newScript[idx] = { ...item, isBackspaced: !item.isBackspaced };
                                      setState(prev => ({ ...prev, script: newScript }));
                                    }}
                                    className={`w-8 h-4 rounded-full relative transition-all ${item.isBackspaced ? 'bg-[#FF0054]' : 'bg-gray-600'}`}
                                  >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${item.isBackspaced ? 'right-0.5' : 'left-0.5'}`} />
                                  </button>
                                </div>
                              </div>
                            ) : item.type === MessageType.IMAGE ? (
                              <div className="space-y-3">
                                {item.mediaUrl && (
                                   <div className="w-full h-32 overflow-hidden rounded-xl border border-white/10">
                                      <img src={item.mediaUrl} className="w-full h-full object-cover" alt="Uploaded Preview" />
                                   </div>
                                )}
                                <textarea rows={2} className="bg-transparent w-full text-xs font-medium focus:outline-none resize-none placeholder-gray-600 border-t border-white/5 pt-2" value={item.text} placeholder="Add optional caption..." onChange={e => { const newScript = [...state.script]; newScript[idx].text = e.target.value; setState(prev => ({ ...prev, script: newScript })); }} />
                                <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-2">
                                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Changed mind mode</span>
                                  <button 
                                    onClick={() => {
                                      const newScript = [...state.script];
                                      newScript[idx] = { ...item, isBackspaced: !item.isBackspaced };
                                      setState(prev => ({ ...prev, script: newScript }));
                                    }}
                                    className={`w-8 h-4 rounded-full relative transition-all ${item.isBackspaced ? 'bg-[#FF0054]' : 'bg-gray-600'}`}
                                  >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${item.isBackspaced ? 'right-0.5' : 'left-0.5'}`} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <textarea rows={2} className="bg-transparent w-full text-xs font-medium focus:outline-none resize-none placeholder-gray-600" value={item.text} placeholder="Enter chat message content..." onChange={e => { const newScript = [...state.script]; newScript[idx].text = e.target.value; setState(prev => ({ ...prev, script: newScript })); }} />
                                {state.cast.find(c => c.id === item.senderId)?.isMe && (
                                  <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-2">
                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Backspace mode</span>
                                    <button 
                                      onClick={() => {
                                        const newScript = [...state.script];
                                        newScript[idx] = { ...item, isBackspaced: !item.isBackspaced };
                                        setState(prev => ({ ...prev, script: newScript }));
                                      }}
                                      className={`w-8 h-4 rounded-full relative transition-all ${item.isBackspaced ? 'bg-[#FF0054]' : 'bg-gray-600'}`}
                                    >
                                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${item.isBackspaced ? 'right-0.5' : 'left-0.5'}`} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <input 
                      type="file" 
                      ref={timelineImageInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleTimelineImageUpload}
                    />

                    <div className="flex gap-2 pt-4">
                      <button onClick={() => addScriptItem(MessageType.TEXT)} className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition hover:bg-white/10 active:scale-95">+ MSG</button>
                      <button onClick={() => addScriptItem(MessageType.IMAGE)} className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition hover:bg-white/10 active:scale-95">+ IMG</button>
                      <button onClick={() => addScriptItem(MessageType.NOTIFICATION)} className="flex-1 bg-white/5 border border-white/10 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition hover:bg-white/10 active:scale-95">+ ALERT</button>
                      <button onClick={() => addScriptItem(MessageType.PRESENCE)} className="flex-1 bg-[#33B5FF]/10 border border-[#33B5FF]/20 text-[#33B5FF] py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition hover:bg-[#33B5FF]/20 active:scale-95">+ PRESENCE</button>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
          </>
          )}
        </div>
        </div>

        <div className="shrink-0 bg-[#121212] px-6 pt-4 pb-4 border-t border-white/10 flex flex-col gap-3">
          {state.script.length > 0 && (
            <div data-testid="text-estimated-duration" className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              Est. Duration: <span className="text-white/70">{formatDuration(estimatedDurationMs)}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={playbackMode ? stopPlayback : () => startPlaybackSequence(false)} className={`flex-1 ${playbackMode ? 'bg-orange-500/20 text-orange-400 border-orange-500/20' : 'bg-white/5 border-white/10'} border py-3.5 rounded-[20px] font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95`}>
              {playbackMode ? 'Stop' : 'Preview'}
            </button>
            <button onClick={() => startPlaybackSequence(true)} disabled={isRecording} className="flex-1 bg-[#FFFC00] text-black py-3.5 rounded-[20px] font-black text-[10px] uppercase tracking-[0.15em] shadow-[0_10px_40px_rgba(255,252,0,0.15)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
              Export
            </button>
            <button
              data-testid="button-toggle-outro"
              onClick={() => setAppendOutro(!appendOutro)}
              className={`flex items-center gap-1.5 px-3 py-3.5 rounded-[20px] border-2 transition-all text-[10px] font-black uppercase tracking-wider ${appendOutro ? 'bg-[#FFFC00]/10 border-[#FFFC00] text-[#FFFC00]' : 'border-gray-600 text-gray-400 bg-transparent'}`}
            >
              {appendOutro && <i className="fa-solid fa-check text-[8px]"></i>}
              Overlay
            </button>
          </div>
        </div>
      </div>

      <div ref={contentToRecordRef} className={`flex-1 flex items-center justify-center bg-black relative overflow-hidden transition-all duration-700 ease-in-out ${isRecording ? 'w-screen h-screen' : ''}`}>
        {isRecording && (
          <button
            data-testid="button-cancel-export"
            onClick={cancelExport}
            className="absolute top-6 right-6 z-[9999] bg-red-600/90 hover:bg-red-500 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_4px_20px_rgba(239,68,68,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 backdrop-blur-sm"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
            Cancel Export
          </button>
        )}
        {isVideoMode && state.chat.exportBackgroundVideoUrl && (
            <div className="absolute inset-0 z-0">
                <video 
                  ref={previewVideoRef}
                  src={state.chat.exportBackgroundVideoUrl} 
                  className="w-full h-full object-cover" 
                  loop 
                  muted 
                  playsInline
                />
            </div>
        )}
        
        {state.chat.exportBackgroundUrl && !isVideoMode && (
            <div className="absolute inset-0 z-0">
                <img src={state.chat.exportBackgroundUrl} className="w-full h-full object-cover" alt="Background" />
            </div>
        )}

        <div
          ref={staticPreviewContainerRef}
          className="absolute inset-0 z-[60]"
          style={{ background: 'black', display: !playbackMode && !isRecording ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center' }}
        />

        <div
          ref={previewCanvasContainerRef}
          className="absolute inset-0 z-[60]"
          style={{ background: 'black', display: playbackMode || isRecording ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center' }}
        />

        <div 
          className={`relative flex flex-row transition-all duration-700 ease-in-out z-10 bg-transparent ${
            isRecording || isVideoMode ? 'shadow-none' : 'shadow-[0_30px_120px_rgba(0,0,0,0.9)]'
          } ${state.chat.isShortCrop || isVideoMode ? '' : 'outline outline-[14px] outline-[#1a1a1a]'}`} 
          style={{ 
            width: isVideoMode ? `calc(100vh * 9 / 19.5 * ${previewInterfaceScaleFactor})` : basePhoneWidth,
            height: state.chat.isShortCrop ? `${state.chat.shortCropHeight * previewInterfaceScaleFactor}px` : (isRecording ? '100vh' : '98vh'),
            borderBottomLeftRadius: isRecording || isVideoMode ? '0' : '10px',
            borderBottomRightRadius: isRecording || isVideoMode ? '0' : '10px',
            flexBasis: isVideoMode ? `calc(100vh * 9 / 19.5 * ${previewInterfaceScaleFactor})` : 'auto',
            display: 'none',
          }}
        >

          {!isVideoMode && <div style={{ width: `calc(10px * ${previewInterfaceScaleFactor})`, backgroundColor: (state.chat.exportBackgroundUrl) ? 'transparent' : 'black' }} className="h-full shrink-0" />}

          <div className="flex-1 relative overflow-hidden" style={{ 
              borderTopLeftRadius: `${state.chat.topCornerRadius}px`,
              borderTopRightRadius: `${state.chat.topCornerRadius}px`,
          }}>
            <div className="flex flex-col bg-white select-none absolute top-0 left-0 overflow-hidden snap-font-regular h-full w-full" style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: `${100 / scale}%`, height: `${100 / scale}%` }}>
                <StatusBar config={state.system} />
                <ChatHeader config={state.chat} cast={state.cast} isKeyboardCropped={state.chat.isKeyboardCropped} />
                
                <div className="flex-1 relative overflow-hidden bg-white">
                <div ref={scrollRef} className="h-full overflow-y-auto no-scrollbar relative flex flex-col">
                    <div className="flex-grow min-h-full flex flex-col justify-end py-2">
                    <div className="text-center py-4"><span className="text-[11px] font-black text-gray-300 uppercase tracking-[0.25em]">Today</span></div>
                    {messagesToRender.filter(i => i.type !== MessageType.PRESENCE).map((item, idx) => {
                        const key = item.instanceId || item.id;
                        const filteredMessages = messagesToRender.filter(i => i.type !== MessageType.PRESENCE);
                        const prevItem = idx > 0 ? filteredMessages[idx - 1] : null;
                        const isGroupedWithPrev = prevItem && (prevItem.type === MessageType.TEXT || prevItem.type === MessageType.STICKER || prevItem.type === MessageType.IMAGE) && item.senderId === prevItem.senderId;
                        
                        if (item.type === MessageType.NOTIFICATION) {
                        return (
                            <div key={key} className="text-center py-6 px-12 animate-in fade-in zoom-in-95 duration-500">
                            <span className="text-[12px] font-black text-gray-400 tracking-[0.1em] uppercase leading-relaxed text-balance">{item.text}</span>
                            </div>
                        );
                        }

                        const sender = state.cast.find(c => c.id === item.senderId);
                        const color = sender?.color || (sender?.isMe ? SNAP_COLORS.ME : SNAP_COLORS.THEM);
                        const cropOffsetClass = state.chat.isKeyboardCropped ? 'pl-[66px] pr-4' : 'px-4';
                        
                        if (item.type === MessageType.STICKER) {
                        return (
                            <div key={key} className={`${cropOffsetClass} animate-in slide-in-from-bottom-2 fade-in duration-300 ${isGroupedWithPrev ? 'pt-0' : 'pt-[12px]'} pb-0`}>
                            <div className="flex flex-col items-start">
                                {!isGroupedWithPrev && (
                                    <span className="text-[13px] font-bold mb-1 tracking-tight snap-font-bold" style={{ color }}>
                                    {sender?.name.toUpperCase()}
                                    </span>
                                )}
                                <div className="flex items-start gap-3 w-full">
                                    <div className={`w-[2px] h-auto min-h-[40px] self-stretch transition-all ${!isGroupedWithPrev ? 'rounded-t-full' : ''}`} style={{ backgroundColor: color }} />
                                    <div className="flex-1 max-w-[200px]">
                                    <img src={item.mediaUrl} className="w-full h-auto object-contain rounded-lg shadow-sm" alt="Sticker" />
                                    </div>
                                </div>
                            </div>
                            </div>
                        );
                        }

                        if (item.type === MessageType.IMAGE) {
                        const imageContainerWidth = item.isVertical ? 'max-w-[140px]' : 'max-w-[240px]';
                        
                        return (
                            <div key={key} className={`${cropOffsetClass} animate-in slide-in-from-bottom-2 fade-in duration-300 ${isGroupedWithPrev ? 'pt-0' : 'pt-[12px]'} pb-1`}>
                            <div className="flex flex-col items-start">
                                {!isGroupedWithPrev && (
                                    <span className="text-[13px] font-bold mb-1 tracking-tight snap-font-bold" style={{ color }}>
                                    {sender?.name.toUpperCase()}
                                    </span>
                                )}
                                <div className="flex items-start gap-3 w-full">
                                <div className={`w-[2px] h-auto min-h-[28px] self-stretch transition-all ${!isGroupedWithPrev ? 'rounded-t-full' : ''}`} style={{ backgroundColor: color }} />
                                <div className="flex-1 flex flex-col gap-2">
                                    {item.text && <span className="snap-font-regular text-[21px] text-black leading-[1.3] tracking-tight block text-balance break-all">{item.text}</span>}
                                    <div className={`${imageContainerWidth} w-full`}>
                                        {item.mediaUrl ? (
                                            <img 
                                            src={item.mediaUrl} 
                                            className="w-full h-auto rounded-[20px] object-contain shadow-sm border border-gray-100/10" 
                                            alt="Chat Image" 
                                            />
                                        ) : (
                                            <div className="w-full h-40 bg-gray-100 rounded-[20px] flex items-center justify-center border-2 border-dashed border-gray-300">
                                            <span className="text-gray-400 text-xs text-center px-2">No image selected</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                </div>
                            </div>
                            </div>
                        );
                        }

                        return (
                        <div key={key} className={`${cropOffsetClass} animate-in slide-in-from-bottom-2 fade-in duration-300 ${isGroupedWithPrev ? 'pt-0' : 'pt-[3px]'} pb-0`}>
                            <div className="flex flex-col items-start">
                            {!isGroupedWithPrev && (
                                <span className="text-[13px] font-bold mb-1 tracking-tight snap-font-bold" style={{ color }}>
                                {sender?.name.toUpperCase()}
                                </span>
                            )}
                            <div className="flex items-start gap-3 w-full">
                                <div className={`w-[2px] h-auto min-h-[28px] self-stretch transition-all ${!isGroupedWithPrev ? 'rounded-t-full' : ''}`} style={{ backgroundColor: color }} />
                                <div className="flex-1">
                                <span className="snap-font-regular text-[21px] text-black leading-[1.3] tracking-tight block text-balance break-all">{item.text}</span>
                                </div>
                            </div>
                            </div>
                        </div>
                        );
                    })}
                    <div className={`${(isPartnerPreArrived && isPartnerArrived) || state.chat.isGroup ? '' : 'transition-all duration-400 ease-out'} shrink-0`} style={{ height: (state.chat.isGroup ? (scriptParticipantIds.length > 0 ? '80px' : '45px') : (isPartnerArrived ? '70px' : '45px')) }} />
                    </div>
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
                    {state.chat.isGroup ? (
                    <PresencePills participants={state.cast.filter(c => scriptParticipantIds.includes(c.id))} typingParticipantIds={typingParticipantIds} activeParticipantIds={activeParticipantIds} isKeyboardCropped={state.chat.isKeyboardCropped} isShortCrop={state.chat.isShortCrop} preArrivedIds={preArrivedIds} />
                    ) : (
                    <div className={`flex items-end transition-all duration-300 ease-out ${state.chat.isKeyboardCropped ? 'pl-[66px]' : 'pl-1.5'}`}>
                        {(() => {
                          const SHORT_SCALE = "scale-[1.35]";       
                          const SHORT_WIDTH = "w-[38px]";          
                          const BUBBLE_POS = "bottom-[9px] left-[13px]"; 
                          const BUBBLE_SCALE = 0.5;               
                          
                          return (
                            <div className={`relative ${state.chat.isShortCrop ? `${SHORT_WIDTH} ${SHORT_SCALE} origin-bottom-left` : 'w-[68px]'} h-[40px]`} style={{ clipPath: 'inset(-100px -60px 0px 0px)' }}>
                              <div className="absolute left-0 w-full h-[120px] flex flex-col justify-end z-0" style={{ bottom: '0px' }}>
                                  <div 
                                    className={`w-full ${isPartnerPreArrived && isPartnerArrived ? '' : 'transition-all duration-700 ease-out'} flex justify-center ${
                                      !isPartnerArrived ? 'translate-y-[40px] opacity-0' :
                                      isPartnerTyping ? 'translate-y-[8px] scale-110' : 'translate-y-[-1px] scale-100 opacity-100'
                                    }`}
                                  >
                                  {partnerAvatarUrl && (
                                      <img src={partnerAvatarUrl} className="w-full object-contain" alt="Avatar" />
                                  )}
                                  </div>
                              </div>
                              <TypingBubble 
                                  visible={isPartnerTyping}
                                  className={`absolute ${state.chat.isShortCrop ? BUBBLE_POS : 'bottom-[28px] left-[32px]'} z-30`}
                                  scale={state.chat.isShortCrop ? BUBBLE_SCALE : 1}
                              />
                            </div>
                          );
                        })()}
                    </div>
                    )}
                </div>
                </div>
                
                <ChatInput 
                compositionText={compositionText} 
                isTyping={isMeTyping} 
                suggestedCustomojiUrl={suggestedUrl}
                onCustomojiSelect={handleCustomojiSelect}
                onCompositionChange={setCompositionText}
                onSend={handleManualSend}
                isPlaybackMode={playbackMode}
                isKeyboardCropped={state.chat.isKeyboardCropped}
                />
                <IOSKeyboard activeKey={activeKey} isShiftActive={isShiftActive} layout={keyboardLayout} isShortCrop={state.chat.isShortCrop} />
            </div>
          </div>

          {!isVideoMode && <div style={{ width: `calc(10px * ${previewInterfaceScaleFactor})`, backgroundColor: (state.chat.exportBackgroundUrl) ? 'transparent' : 'black', display: playbackMode || isRecording ? undefined : 'none' }} className="h-full shrink-0" />}
        </div>
      </div>
      
      {showRecInstructions && (
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-8">
           <div className="bg-[#1a1a1a] border border-white/10 rounded-[48px] p-12 max-w-xl w-full text-center space-y-8 animate-in zoom-in-95 duration-500 shadow-2xl">
              <div className="w-24 h-24 bg-[#FFFC00] text-black rounded-[32px] mx-auto flex items-center justify-center text-5xl shadow-[0_0_50px_rgba(255,252,0,0.3)]"><i className="fa-solid fa-clapperboard"></i></div>
              <div className="space-y-3">
                <h2 className="text-3xl font-black uppercase tracking-tight">Ready for Export</h2>
                <p className="text-gray-400 text-lg leading-relaxed px-4">Your video will be rendered at native <span className="text-white font-bold underline decoration-[#FFFC00]">1080x1920 HD</span> resolution directly on canvas. No screen capture required.</p>
              </div>
              <div className="flex gap-4 pt-4">
                 <button onClick={() => setShowRecInstructions(false)} className="flex-1 bg-white/5 py-6 rounded-[28px] font-black uppercase tracking-[0.2em] text-xs transition hover:bg-white/10">Discard</button>
                 <button onClick={initiateRecording} className="flex-1 bg-[#FFFC00] text-black py-6 rounded-[28px] font-black uppercase tracking-[0.2em] text-xs shadow-[0_10px_30px_rgba(255,252,0,0.2)] hover:scale-[1.03] active:scale-95 transition-all">Start Export</button>
              </div>
           </div>
        </div>
      )}

      {showInfoModal && (
        <div className="fixed inset-0 z-[11000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-[40px] max-w-3xl w-full p-8 sm:p-12 relative animate-in fade-in zoom-in-95 duration-300 shadow-2xl my-auto">
            <button 
              onClick={() => setShowInfoModal(false)}
              className="absolute top-8 right-8 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-gray-400 hover:text-white"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
            
            <div className="space-y-10">
              <div className="text-center">
                <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 flex items-center justify-center gap-3">
                   <span className="text-[#FFFC00]">👻</span> SnapGen Pro Guide
                </h2>
                <div className="h-1 w-20 bg-[#33B5FF] mx-auto rounded-full"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-[#33B5FF] uppercase tracking-[0.2em]">Simulation Performance</h4>
                  <ul className="space-y-4 text-xs font-bold text-gray-300">
                    <li className="flex gap-3">
                      <i className="fa-solid fa-keyboard text-[#33B5FF] mt-0.5"></i>
                      <span><b className="text-white">Typing Speed:</b> Controls how fast characters are typed when "Me" is the sender.</span>
                    </li>
                    <li className="flex gap-3">
                      <i className="fa-solid fa-hourglass-half text-[#33B5FF] mt-0.5"></i>
                      <span><b className="text-white">Msg Wait:</b> The duration the typing bubble stays visible before a message is received from others.</span>
                    </li>
                    <li className="flex gap-3">
                      <i className="fa-solid fa-expand text-[#33B5FF] mt-0.5"></i>
                      <span><b className="text-white">UI Scale:</b> Global zoom. Use ~1.5x with keyboard and ~1.8x without for the cleanest "full screen" look.</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-[#33B5FF] uppercase tracking-[0.2em]">Exclusive Features</h4>
                  <ul className="space-y-4 text-xs font-bold text-gray-300">
                    <li className="flex gap-3">
                      <i className="fa-solid fa-delete-left text-[#33B5FF] mt-0.5"></i>
                      <span><b className="text-white">Backspace Mode:</b> Simulation Types the message, pauses, then deletes it character-by-character with realistic audio. Ideal for "story-telling" tension.</span>
                    </li>
                    <li className="flex gap-3">
                      <i className="fa-solid fa-crop-simple text-[#33B5FF] mt-0.5"></i>
                      <span><b className="text-white">Keyboard Crop:</b> Vertically aligns the chat and removes side padding. Designed specifically for TikTok and Reels overlays.</span>
                    </li>
                    <li className="flex gap-3">
                      <i className="fa-solid fa-users text-[#33B5FF] mt-0.5"></i>
                      <span><b className="text-white">Presence Events:</b> Use "Arrival" and "Departure" to make participants peek into the chat or leave, updating the Presence Pills.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-white/5 border border-white/5 p-6 rounded-3xl space-y-3">
                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">How to Export</h4>
                <p className="text-xs text-gray-400 lordship-relaxed font-medium">Click <b className="text-[#FFFC00]">Export Video</b> to enter Fullscreen mode. When prompted by your browser, select <b className="text-white">"Entire Screen"</b> or the browser window. The app will automatically crop the recording to a perfect 9:16 vertical aspect ratio, synchronize the audio, and trigger a high-quality download once the timeline finishes.</p>
              </div>

              <button 
                onClick={() => setShowInfoModal(false)}
                className="w-full bg-[#33B5FF] text-white py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-xs hover:bg-[#33B5FF]/90 transition-all active:scale-95 shadow-xl shadow-[#33B5FF]/10"
              >
                Let's Build
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes typingDots { 0%, 60%, 100% { transform: scale(1); opacity: 0.4; } 30% { transform: scale(1.15); opacity: 1; } }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; background: white; border-radius: 50%; cursor: pointer; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
      `}</style>
    </div>
  );
};

export default App;