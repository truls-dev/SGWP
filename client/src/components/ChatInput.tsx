import React, { useState, useEffect, useRef } from 'react';
import { SNAP_ICONS } from '../constants';

interface Props {
  compositionText: string;
  isTyping: boolean;
  suggestedCustomojiUrl?: string | null;
  onCustomojiSelect?: () => void;
  onCompositionChange?: (text: string) => void;
  onSend?: () => void;
  isPlaybackMode?: boolean;
  isKeyboardCropped?: boolean;
}

const SCCB_EMPTY = "https://raw.githubusercontent.com/truls-dev/images/main/sccb_empty.png";
const SCCB_TEXT = "https://raw.githubusercontent.com/truls-dev/images/main/sccb_text.png";
const UPDOWN_ICON = "https://raw.githubusercontent.com/truls-dev/images/main/updown-removebg-preview.png";
const GALLERY_ICON = "https://raw.githubusercontent.com/truls-dev/images/main/images.png";
const PLUS_ICON = "https://raw.githubusercontent.com/truls-dev/images/main/plus.png";
const SMILEY_ICON = "https://raw.githubusercontent.com/truls-dev/images/main/smiley.png";

const ChatInput: React.FC<Props> = ({ 
  compositionText, 
  isTyping, 
  suggestedCustomojiUrl, 
  onCustomojiSelect,
  onCompositionChange,
  onSend,
  isPlaybackMode = false,
  isKeyboardCropped = false
}) => {
  const [isImgLoaded, setIsImgLoaded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (suggestedCustomojiUrl) {
      const img = new Image();
      img.src = suggestedCustomojiUrl;
      img.onload = () => setIsImgLoaded(true);
      img.onerror = () => setIsImgLoaded(false);
    } else {
      setIsImgLoaded(false);
    }
  }, [suggestedCustomojiUrl]);

  // Auto-resize textarea logic for manual mode
  useEffect(() => {
    if (textareaRef.current && !isPlaybackMode) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [compositionText, isPlaybackMode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onCompositionChange) {
      onCompositionChange(e.target.value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (onSend && compositionText.trim()) {
        onSend();
      }
    }
  };

  const hasText = compositionText.length > 0;

  return (
    <div className={`bg-white pt-1.5 pb-2 pr-3 snap-font-regular border-t border-gray-50 relative transition-all duration-300 h-auto ${isKeyboardCropped ? 'pl-[66px]' : 'pl-3'}`}>
      <style>{`
        @keyframes stickerPopIn {
          0% { transform: scale(0.4) translateY(8px); opacity: 0; }
          60% { transform: scale(1.15) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0px); opacity: 1; }
        }
        .sticker-pop {
          animation: stickerPopIn 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes sharpCursorBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .animate-sharp-blink {
          animation: sharpCursorBlink 1s step-end infinite;
        }
      `}</style>
      
      <div className="flex items-center gap-2.5 min-h-[34px] h-auto">
        
        {/* Dynamic Camera/Chat Button */}
        {!isKeyboardCropped && (
          <div className="flex-shrink-0 w-[34px] h-[34px] cursor-pointer active:scale-95 transition-all duration-200 relative">
             <img 
              src={SCCB_EMPTY} 
              alt="Camera" 
              className={`absolute inset-0 w-full h-full object-contain transition-all duration-300 ease-in-out ${hasText ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`} 
             />
             <img 
              src={SCCB_TEXT} 
              alt="Send" 
              className={`absolute inset-0 w-full h-full object-contain transition-all duration-300 ease-in-out ${hasText ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`} 
             />
          </div>
        )}
        
        {/* Input Pill */}
        <div className="flex-1 relative flex items-center bg-[#F2F3F5] rounded-[22px] pl-4 pr-1 min-h-[32px] h-auto py-0 gap-2 border border-transparent focus-within:bg-white focus-within:border-[#F2F3F5] transition-all duration-400 overflow-hidden">
            <div className="flex-1 min-w-0 relative self-center py-[5px]">
                {!isPlaybackMode ? (
                  <textarea 
                    ref={textareaRef}
                    value={compositionText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder={!isTyping ? "Chat" : ""}
                    className="w-full bg-transparent text-[17px] text-black font-normal outline-none placeholder-gray-400 resize-none leading-[1.2] block py-0 no-scrollbar"
                    spellCheck={false}
                    autoComplete="off"
                  />
                ) : (
                  <div className="w-full text-[17px] text-black font-normal leading-[1.2] py-0 break-words relative min-h-[20px] whitespace-pre-wrap" style={{ fontFamily: "'Avenir Next LT Pro', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif" }}>
                    {compositionText === '' && (
                      <span className="absolute left-0 top-[2px] text-gray-400 opacity-80 pointer-events-none">Chat</span>
                    )}
                    {compositionText}
                    <span 
                      className={`inline-block w-[2.2px] h-[17.5px] bg-[#FF0054] rounded-full translate-y-[3.2px] ml-[0.5px] ${!isTyping ? 'animate-sharp-blink' : ''}`}
                    />
                  </div>
                )}
            </div>

            {/* Suffix Icon Container (Microphone / UpDown) */}
            <div className="relative w-9 h-7 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <div className={`transition-all duration-300 ease-in-out absolute flex items-center justify-center ${hasText ? 'opacity-0 -translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'}`}>
                   <div className="text-gray-500 cursor-pointer">
                    <SNAP_ICONS.Microphone />
                   </div>
                </div>
                
                <div className={`transition-all duration-400 ease-out absolute flex items-center justify-center ${hasText ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
                   <img 
                    src={UPDOWN_ICON} 
                    alt="Up Down" 
                    className="w-[24px] h-auto object-contain cursor-pointer active:scale-90 transition-transform" 
                   />
                </div>
            </div>
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-0 pr-1 flex-shrink-0 h-[34px]">
            {/* Sticker Suggestion Button */}
            <div 
              className="cursor-pointer relative w-[28px] h-full flex items-center justify-center transition-all duration-400"
              onClick={isImgLoaded ? onCustomojiSelect : undefined}
            >
                {/* Smiley Image Icon - Resized to 21px to match visual weight */}
                <div 
                  className={`transition-all duration-300 transform flex items-center justify-center ${isImgLoaded ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}
                >
                  <img 
                    src={SMILEY_ICON} 
                    alt="Emoji Picker" 
                    className="h-[17px] w-auto object-contain active:scale-90 transition-transform" 
                  />
                </div>

                {/* Suggested Sticker Preview */}
                {suggestedCustomojiUrl && isImgLoaded && (
                  <div 
                    key={suggestedCustomojiUrl} 
                    className="absolute h-full flex items-center justify-center pointer-events-none sticker-pop"
                  >
                    <img 
                        src={suggestedCustomojiUrl} 
                        className="h-full w-auto max-h-[46px] object-contain drop-shadow-md select-none" 
                        alt="Sticker Suggestion"
                        style={{ transform: 'scale(1.65)' }}
                    />
                  </div>
                )}
            </div>
            
            {/* Action Group (Gallery + Plus) - Collapse when typing to allow pill expansion */}
            {!isKeyboardCropped && (
              <div 
                className={`flex items-center gap-[7px] transition-all duration-400 ease-in-out overflow-hidden ${hasText ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}
              >
                 <img 
                   src={GALLERY_ICON} 
                   alt="Gallery" 
                   className="h-[17px] w-[17px] object-contain cursor-pointer active:scale-90 transition-transform" 
                 />
                 <img 
                   src={PLUS_ICON} 
                   alt="Plus" 
                   className="h-[17px] w-[17px] object-contain cursor-pointer active:scale-90 transition-transform" 
                 />
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;