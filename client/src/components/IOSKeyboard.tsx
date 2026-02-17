import React from 'react';

export type KeyboardLayout = 'ALPHA' | 'NUMERIC' | 'SYMBOLS';

interface Props {
  activeKey: string | null;
  isShiftActive?: boolean;
  layout?: KeyboardLayout;
  isShortCrop?: boolean;
}

const ShiftIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="20" viewBox="0 0 26 24" fill={active ? "black" : "none"} xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M13 2.5L3.5 12h5v9.5h9V12h5L13 2.5Z" 
      stroke="black" 
      strokeWidth="1.4" 
      strokeLinejoin="round" 
      fill={active ? "black" : "none"}
    />
  </svg>
);

const BackspaceIcon = () => (
  <svg width="21" height="16" viewBox="0 0 32 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M11 3L2.5 12L11 21H28.5C29.6 21 30.5 20.1 30.5 19V5C30.5 3.9 29.6 3 28.5 3H11Z" 
      stroke="black" 
      strokeWidth="1.4" 
      strokeLinejoin="round"
    />
    <path d="M17.5 8.5L23.5 14.5M23.5 8.5L17.5 14.5" stroke="black" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IOSKeyboard: React.FC<Props> = ({ activeKey, isShiftActive = false, layout = 'ALPHA', isShortCrop = false }) => {
  // Define layout rows based on standard iOS keyboard design
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
    ['_', '\\', '|', '~', '<', '>', '$', '£', '¥', '•'],
    ['123', '.', ',', '?', '!', "'", 'backspace']
  ];

  let currentRows = alphaRows;
  if (layout === 'NUMERIC') currentRows = numericRows;
  if (layout === 'SYMBOLS') currentRows = symbolRows;

  const containerClasses = `bg-[#D1D3D9] select-none keyboard-font transition-all duration-300 ${
    isShortCrop 
      ? 'px-[6px] pt-[5px] pb-0 h-[140px] overflow-hidden' 
      : 'p-1.5 pt-2 pb-3'
  }`;

  return (
    <div className={containerClasses}>
      <div className="flex flex-col gap-3">
        {currentRows.map((row, i) => (
          <div key={i} className={`flex justify-center gap-1.5 ${i === 1 ? 'px-4' : ''}`}>
            {row.map((key) => {
              const lowerKey = key.toLowerCase();
              const isPressed = (activeKey?.toLowerCase() === lowerKey && key.length === 1) || 
                               (key === 'space' && activeKey === ' ') ||
                               (lowerKey === 'backspace' && activeKey === 'backspace') ||
                               (lowerKey === 'shift' && activeKey === 'shift') ||
                               (key === 'Enter' && activeKey === 'Enter') ||
                               (key === 'send' && activeKey === 'Enter');
              
              const isModifier = ['shift', 'backspace', '#+=', 'ABC', '123', 'send'].includes(lowerKey);
              
              const baseClass = "flex-1 h-11 rounded-md flex items-center justify-center shadow-[0_1.2px_0_rgba(0,0,0,0.35)] font-normal transition-all duration-75 text-black";
              
              // Modifiers have a different base gray color
              let keyStyle = isModifier ? "bg-[#ACB0B8]" : "bg-white";
              
              // Pressed keys look like the keyboard background
              if (isPressed) keyStyle = "bg-[#D1D3D9] scale-[0.98] shadow-none";

              // Shift specifically turns white when active
              if (key === 'shift' && isShiftActive) {
                keyStyle = "bg-white";
              }

              if (key === 'shift') {
                return (
                  <div key={key} className={`${baseClass} flex-1 max-w-[45px] ${keyStyle}`}>
                    <ShiftIcon active={isShiftActive} />
                  </div>
                );
              }
              
              if (key === 'backspace') {
                return (
                  <div key={key} className={`${baseClass} flex-1 max-w-[45px] ${keyStyle}`}>
                    <BackspaceIcon />
                  </div>
                );
              }

              if (key === '#+=' || key === '123' || key === 'ABC') {
                return <div key={key} className={`${baseClass} flex-1 max-w-[45px] bg-[#ACB0B8] text-[14px] font-medium tracking-tight`}>{key}</div>;
              }

              return (
                <div 
                  key={key} 
                  className={`${baseClass} ${keyStyle} text-[22px]`}
                >
                  {isShiftActive && key.length === 1 && layout === 'ALPHA' ? key.toUpperCase() : key}
                </div>
              );
            })}
          </div>
        ))}
        
        {!isShortCrop && (
          <div className="flex justify-center gap-1.5">
            <div className="w-[85px] h-11 bg-[#ACB0B8] rounded-md flex items-center justify-center text-[16px] text-black shadow-[0_1.2px_0_rgba(0,0,0,0.35)] font-medium">
              {layout === 'ALPHA' ? '123' : 'ABC'}
            </div>
            <div className={`flex-1 h-11 rounded-md flex items-center justify-center text-[16px] text-black shadow-[0_1.2px_0_rgba(0,0,0,0.35)] font-normal transition-colors ${activeKey === ' ' ? 'bg-[#ACB0B8]' : 'bg-white'}`}>
              space
            </div>
            <div className={`w-[85px] h-11 ${activeKey === 'Enter' ? 'bg-[#005FC4]' : 'bg-[#007AFF]'} rounded-md flex items-center justify-center text-[16px] text-white shadow-[0_1.2px_0_rgba(0,0,0,0.35)] font-semibold tracking-tight`}>
              send
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IOSKeyboard;