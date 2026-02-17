import React from 'react';
import { ChatConfig, CastMember } from '../types';
import { SNAP_ICONS } from '../constants';
import { getSelfieUrlForAvatar } from '../services/bitmojiService';

interface Props {
  config: ChatConfig;
  cast: CastMember[];
  isKeyboardCropped?: boolean;
}

const CALL_ICONS_URL = "https://raw.githubusercontent.com/truls-dev/images/main/sccicons.png";

/**
 * --- HEADER LAYOUT ADJUSTMENTS ---
 * Nudge: Positive X = Right, Negative X = Left.
 * Nudge: Positive Y = Down, Negative Y = Up.
 * Size: Use SCALE for icons/containers, FONT_SIZE for text.
 */
const HEADER_ADJUSTMENTS = {
  // Back Arrow Button
  BACK_ARROW_X: -15,
  BACK_ARROW_Y: 0,
  BACK_ARROW_SCALE: 0.7,
  
  // Profile Picture (Avatar)
  AVATAR_X: -23,
  AVATAR_Y: 0,
  AVATAR_SCALE: 1.0,
  
  // Participant/Group Name
  NAME_X: -25,
  NAME_Y: 0,
  NAME_FONT_SIZE: 18, 

  // Call and Video Icons (Top Right)
  CALL_ICONS_X: 0,
  CALL_ICONS_Y: 2, 
  CALL_ICONS_SCALE: 1.2,
};

/**
 * --- BITMOJI SELFIE SETTINGS (1-on-1 MODE) ---
 * Fine-tune the bitmoji position INSIDE its container.
 */
const AVATAR_SETTINGS = {
  SCALE: 1.3,           // 1.0 is original size.
  NUDGE_X: 0,            // Horizontal nudge inside crop.
  NUDGE_Y: 0,            // Vertical nudge inside crop.
  ORIGIN: "bottom center" // Anchor point for scaling.
};

const ChatHeader: React.FC<Props> = ({ config, cast, isKeyboardCropped = false }) => {
  const others = cast.filter(c => !c.isMe);
  const displayName = config.isGroup ? (config.groupName || others.map(o => o.name).join(', ')) : config.contactName;

  return (
    <div className="flex items-center justify-between px-1 bg-white border-b border-gray-100 shadow-sm z-10 h-[42px] snap-font-regular">
      <div className={`flex items-center h-full max-w-[85%] transition-all duration-300 ${isKeyboardCropped ? 'pl-[66px] gap-0' : 'pl-0 gap-0'}`}>
        {!isKeyboardCropped && (
          <div 
            className="text-gray-400 p-2 cursor-pointer hover:bg-gray-50 rounded-full transition"
            style={{ 
                transform: `translate(${HEADER_ADJUSTMENTS.BACK_ARROW_X}px, ${HEADER_ADJUSTMENTS.BACK_ARROW_Y}px) scale(${HEADER_ADJUSTMENTS.BACK_ARROW_SCALE})` 
            }}
          >
            <SNAP_ICONS.Back />
          </div>
        )}
        
        {/* Alignment container for Avatar + Name */}
        <div className="flex items-center gap-2 h-full overflow-visible">
            {/* Avatar Container */}
            <div 
                className="relative w-10 h-full flex items-center justify-center shrink-0 overflow-visible"
                style={{ 
                    transform: `translate(${HEADER_ADJUSTMENTS.AVATAR_X}px, ${HEADER_ADJUSTMENTS.AVATAR_Y}px) scale(${HEADER_ADJUSTMENTS.AVATAR_SCALE})` 
                }}
            >
                {config.isGroup ? (
                  config.groupIconUrl ? (
                    // Custom Group Icon
                    <img 
                      src={config.groupIconUrl} 
                      alt="Group Icon" 
                      className="w-9 h-9 rounded-full object-cover shadow-sm"
                    />
                  ) : (
                    // Default Overlapping Bitmojis
                    <div className="relative w-full h-8 flex items-center">
                      {others[0] && (
                        <img 
                          src={getSelfieUrlForAvatar(others[0].bitmojiAvatarId)} 
                          className="w-7 h-7 rounded-full border-2 border-white absolute left-0 z-20 bg-gray-100 shadow-sm object-contain"
                          alt="Member 1"
                        />
                      )}
                      {(others[1] || others[0]) && (
                        <img 
                          src={getSelfieUrlForAvatar(others[1]?.bitmojiAvatarId || others[0].bitmojiAvatarId)} 
                          className="w-7 h-7 rounded-full border-2 border-white absolute right-0 z-10 bg-gray-100 shadow-sm object-contain"
                          alt="Member 2"
                        />
                      )}
                    </div>
                  )
                ) : (
                  // Individual bitmoji 1-on-1 - Uses AVATAR_SETTINGS defined above
                  <div className="w-full h-full flex items-end justify-center overflow-visible">
                    {others[0] && (
                      <img 
                          src={getSelfieUrlForAvatar(others[0].bitmojiAvatarId)} 
                          alt="Avatar" 
                          className="w-full h-auto object-contain"
                          style={{ 
                            transform: `scale(${AVATAR_SETTINGS.SCALE}) translate(${AVATAR_SETTINGS.NUDGE_X}px, ${AVATAR_SETTINGS.NUDGE_Y}px)`,
                            transformOrigin: AVATAR_SETTINGS.ORIGIN 
                          }}
                      />
                    )}
                  </div>
                )}
            </div>
            
            {/* Name Container */}
            <div 
                className="flex flex-col justify-center h-full overflow-hidden"
                style={{ 
                    transform: `translate(${HEADER_ADJUSTMENTS.NAME_X}px, ${HEADER_ADJUSTMENTS.NAME_Y}px)` 
                }}
            >
                <h1 
                  className="snap-header-name text-gray-900 leading-none tracking-tight truncate"
                  style={{ fontSize: `${HEADER_ADJUSTMENTS.NAME_FONT_SIZE}px` }}
                >
                    {displayName}
                </h1>
            </div>
        </div>
      </div>
      
      {!isKeyboardCropped && (
        <div className="flex items-center pr-3.5 h-full">
          <img 
            src={CALL_ICONS_URL} 
            alt="Call and Video Icons" 
            className="h-[28px] w-auto object-contain cursor-pointer active:opacity-70 transition-opacity" 
            style={{ 
                transform: `translate(${HEADER_ADJUSTMENTS.CALL_ICONS_X}px, ${HEADER_ADJUSTMENTS.CALL_ICONS_Y}px) scale(${HEADER_ADJUSTMENTS.CALL_ICONS_SCALE})` 
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ChatHeader;