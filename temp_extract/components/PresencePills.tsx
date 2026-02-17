import React, { useMemo } from 'react';
import { CastMember } from '../types';
import { getPeekingUrlForAvatar, getSelfieUrlForAvatar } from '../services/bitmojiService';
import TypingBubble from './TypingBubble';

/**
 * --- MANUAL ADJUSTMENT PARAMETERS FOR GROUP MODE ---
 * Use these values to fine-tune the alignment of presence pills and typing bubbles.
 */
const GROUP_PRESENCE_SETTINGS = {
  // Overall Row Layout
  ROW_LEFT_PADDING: 0,      // Standard mode left padding (px)
  ROW_GAP: -18,                // Spacing between pills (Supports negative values for overlapping!)
  
  // Bitmoji Head Position
  AVATAR_CONTAINER_W: 68,    // Width of the avatar area (px)
  AVATAR_NUDGE_Y: 0,         // Vertical nudge for the head (positive = down)
  AVATAR_SCALE: 1.0,         // Overall scale of the bitmoji
  
  // Typing Bubble Positioning (Relative to the avatar container)
  BUBBLE_SCALE: 1.0,         // Size of the typing bubble (1.0 = original)
  BUBBLE_X: 32,              // Horizontal position (px from left)
  BUBBLE_Y: 15,              // Vertical position (px from bottom)

  // Short Crop specific overrides
  SHORT_CROP: {
    ROW_LEFT_PADDING: 66,    // Padding when keyboard crop is active
    ITEM_SCALE: 0.68,        // Overall scale of the individual item
    ITEM_WIDTH: 38,          // Width of the peeking container
    BUBBLE_SCALE: 0.75,      // Scale of bubble in short crop
    BUBBLE_X: 16,            // Bubble horizontal position in short crop
    BUBBLE_Y: 14             // Bubble vertical position in short crop
  }
};

interface Props {
  participants: CastMember[];
  typingParticipantIds: string[];
  activeParticipantIds: string[]; // Participants who are "Arrived" and colored
  isKeyboardCropped?: boolean;
  isShortCrop?: boolean;
}

const PresencePills: React.FC<Props> = ({ 
  participants, 
  typingParticipantIds, 
  activeParticipantIds, 
  isKeyboardCropped = false,
  isShortCrop = false 
}) => {
  const sortedParticipants = useMemo(() => {
    const active = activeParticipantIds
      .filter(id => participants.some(p => p.id === id))
      .map(id => participants.find(p => p.id === id)!);
    
    const inactive = participants.filter(p => !activeParticipantIds.includes(p.id));

    return [...active, ...inactive];
  }, [participants, activeParticipantIds]);

  // Determine active layout constants
  const activePadding = isKeyboardCropped 
    ? GROUP_PRESENCE_SETTINGS.SHORT_CROP.ROW_LEFT_PADDING 
    : GROUP_PRESENCE_SETTINGS.ROW_LEFT_PADDING;

  return (
    <div 
      className="flex flex-wrap items-end justify-start mb-2.5 select-none pointer-events-none transition-all duration-300"
      style={{ 
        paddingLeft: `${activePadding}px`
      }}
    >
      {sortedParticipants.map((member, index) => {
        const isTyping = typingParticipantIds.includes(member.id);
        const hasArrived = activeParticipantIds.includes(member.id);
        const pillColor = hasArrived ? (member.color || '#33B5FF') : '#CCCCCC';

        const avatarUrl = isTyping 
          ? getSelfieUrlForAvatar(member.bitmojiAvatarId) 
          : getPeekingUrlForAvatar(member.bitmojiAvatarId);

        // Resolve coordinates based on mode
        const itemWidth = isShortCrop ? GROUP_PRESENCE_SETTINGS.SHORT_CROP.ITEM_WIDTH : GROUP_PRESENCE_SETTINGS.AVATAR_CONTAINER_W;
        const bubbleX = isShortCrop ? GROUP_PRESENCE_SETTINGS.SHORT_CROP.BUBBLE_X : GROUP_PRESENCE_SETTINGS.BUBBLE_X;
        const bubbleY = isShortCrop ? GROUP_PRESENCE_SETTINGS.SHORT_CROP.BUBBLE_Y : GROUP_PRESENCE_SETTINGS.BUBBLE_Y;
        const bubbleScale = isShortCrop ? GROUP_PRESENCE_SETTINGS.SHORT_CROP.BUBBLE_SCALE : GROUP_PRESENCE_SETTINGS.BUBBLE_SCALE;
        const itemScale = isShortCrop ? `scale(${GROUP_PRESENCE_SETTINGS.SHORT_CROP.ITEM_SCALE})` : 'scale(1)';

        return (
          <div 
            key={member.id} 
            className={`relative flex flex-col items-center transition-all duration-700 ease-in-out origin-bottom`}
            style={{ 
              clipPath: 'inset(-100px -60px 0px -60px)',
              transform: itemScale,
              marginLeft: index === 0 ? 0 : `${GROUP_PRESENCE_SETTINGS.ROW_GAP}px`,
              zIndex: sortedParticipants.length - index // Ensures correct stacking order for overlapping items
            }}
          >
            {/* The Peeking Container */}
            <div className="relative h-[40px] overflow-visible" style={{ width: `${itemWidth}px` }}>
              
              <div 
                className={`absolute left-0 w-full h-[120px] flex flex-col justify-end z-0 transition-all duration-500 ease-out`} 
                style={{ 
                  bottom: '0px',
                  opacity: hasArrived ? 1 : 0,
                  transform: hasArrived ? 'translateY(0)' : 'translateY(40px)',
                  transitionDelay: hasArrived ? '0.2s' : '0s'
                }}
              >
                <div 
                  className={`w-full transition-all duration-500 ease-out flex justify-center ${
                    isTyping ? 'translate-y-[8px] scale-110' : 'translate-y-[0px] scale-100'
                  }`}
                  style={{ transform: `translateY(${GROUP_PRESENCE_SETTINGS.AVATAR_NUDGE_Y}px) scale(${GROUP_PRESENCE_SETTINGS.AVATAR_SCALE})` }}
                >
                  <img 
                    src={avatarUrl} 
                    className="w-full object-contain" 
                    alt="Participant Bitmoji" 
                  />
                </div>
              </div>

              {/* Typing Bubble */}
              {hasArrived && (
                <TypingBubble 
                  visible={isTyping}
                  className="absolute z-30"
                  style={{ 
                    left: `${bubbleX}px`, 
                    bottom: `${bubbleY}px` 
                  }}
                  scale={bubbleScale}
                />
              )}
            </div>

            {/* Pill */}
            <div 
              className={`bg-white border-[2px] px-2 py-1 rounded-full z-10 flex items-center justify-center shadow-sm relative transition-colors duration-500`}
              style={{ 
                borderColor: pillColor,
                transitionDelay: hasArrived ? '0s' : '0.2s',
                minWidth: isShortCrop ? '50px' : '68px'
              }}
            >
              <span 
                className={`${isShortCrop ? 'text-[8.5px]' : 'text-[9.5px]'} font-black uppercase tracking-[0.02em] snap-font-bold leading-none truncate transition-colors duration-500`}
                style={{ 
                  color: pillColor,
                  transitionDelay: hasArrived ? '0s' : '0.2s'
                }}
              >
                {member.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PresencePills;