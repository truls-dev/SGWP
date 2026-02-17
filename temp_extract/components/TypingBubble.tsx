import React, { useState, useEffect } from 'react';

interface Props {
  className?: string;
  style?: React.CSSProperties; // Added to allow nudging from parent
  visible?: boolean;
  scale?: number;
}

const TypingBubble: React.FC<Props> = ({ className = "", style = {}, visible = true, scale = 1 }) => {
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
    } else {
      // Delay unmounting to allow the exit animation to play
      const timer = setTimeout(() => setShouldRender(false), 450);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!shouldRender) return null;

  return (
    <div className={`relative ${className}`} style={{ ...style, transform: `scale(${scale})`, transformOrigin: 'bottom center' }}>
      <style>{`
        .snap-typing-wrapper {
          position: relative;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          transform-origin: bottom left;
          will-change: transform, opacity;
          overflow: visible;
        }

        .bubble-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          overflow: visible;
        }

        .dots-container {
          position: absolute;
          left: 46%;
          top: 44%;
          transform: translate(-50%, -50%);
          display: flex;
          gap: 2.8px;
          z-index: 2;
          pointer-events: none;
        }

        .typing-dot {
          /* ADJUST DOT SIZE HERE */
          width: 2.6px; 
          height: 2.6px;
          background: #474A4F;
          border-radius: 999px;
          opacity: 0.3;
          animation: typing-dot-pulse 1.2s infinite ease-in-out;
          will-change: opacity, transform;
        }

        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        .animate-snap-emerge {
          animation: snap-emerge-keyframes 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.15) forwards;
        }

        .animate-snap-exit {
          animation: snap-exit-keyframes 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
        }

        @keyframes snap-emerge-keyframes {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.6) rotate(-5deg);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(0deg);
          }
        }

        @keyframes snap-exit-keyframes {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.4) rotate(10deg);
          }
        }

        @keyframes typing-dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.25); }
        }
      `}</style>
      
      <div className={`snap-typing-wrapper ${visible ? 'animate-snap-emerge' : 'animate-snap-exit'}`}>
        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="bubble-svg">
          <defs>
            <linearGradient id="pill_gradient_typing" x1="5.905" y1="8.322" x2="20.255" y2="21.223" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff"/>
              <stop offset="1" stopColor="#E9EDF2"/>
            </linearGradient>

            <filter id="shadow_typing" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
              <feFlood floodOpacity="0"/>
              <feColorMatrix in="SourceAlpha"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 127 0"/>
              <feOffset dy="0.9"/>
              <feGaussianBlur stdDeviation="1.4"/>
              <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 .2 0"/>
              <feBlend in2="SourceGraphic" mode="normal"/>
            </filter>
          </defs>

          <g filter="url(#shadow_typing)">
            <path d="M13.92 1.867c-2.006 0-3.754 1.21-4.663 2.998a4.888 4.888 0 0 0-.615-.039c-2.943 0-5.33 2.604-5.33 5.816 0 1.113.287 2.153.784 3.037a6.263 6.263 0 0 0-.39 2.188c0 3.211 2.386 5.815 5.33 5.815.148 0 .295-.007.44-.02.954 1.57 2.589 2.605 4.444 2.605 1.335 0 2.555-.536 3.49-1.42a4.949 4.949 0 0 0 2.284.558c2.85 0 5.177-2.441 5.322-5.512 1.597-1.005 2.672-2.886 2.672-5.042 0-2.422-1.358-4.498-3.288-5.373-.604-2.487-2.681-4.319-5.15-4.319a4.92 4.92 0 0 0-1.674.292c-.954-.982-2.24-1.584-3.656-1.584Z" fill="#000"/>
          </g>

          <path fillRule="evenodd" clipRule="evenodd"
            d="M13.92 2.333c1.248 0 2.424.52 3.32 1.443l.21.217.286-.103a4.45 4.45 0 0 1 1.514-.264c2.206 0 4.13 1.636 4.695 3.962l.053.22.208.095c1.804.817 3.013 2.756 3.013 4.948 0 1.945-.951 3.702-2.454 4.647l-.206.13-.012.243c-.133 2.842-2.274 5.067-4.853 5.067a4.477 4.477 0 0 1-2.068-.506l-.296-.153-.243.229c-.877.83-1.99 1.292-3.167 1.292-1.639 0-3.144-.901-4.042-2.38l-.152-.249-.291.027a4.496 4.496 0 0 1-.4.017c-2.674 0-4.86-2.385-4.86-5.348 0-.705.123-1.39.36-2.026l.076-.202-.106-.189a5.722 5.722 0 0 1-.724-2.808c0-2.963 2.186-5.35 4.86-5.35.188 0 .374.013.557.036l.328.041.15-.293c.855-1.684 2.468-2.743 4.244-2.743Z"
            fill="url(#pill_gradient_typing)"
            stroke="#474A4F"
            strokeWidth="0.933"
          />
        </svg>

        <div className="dots-container">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
        </div>
      </div>
    </div>
  );
};

export default TypingBubble;