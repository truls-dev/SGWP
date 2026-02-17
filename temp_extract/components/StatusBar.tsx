import React from 'react';
import { SystemConfig } from '../types';

interface Props {
  config: SystemConfig;
}

// Using high-fidelity assets for system status bar components
const WIFI_ICON_URL = "https://raw.githubusercontent.com/truls-dev/images/main/wifi.png";
const BATTERY_ICON_URL = "https://raw.githubusercontent.com/truls-dev/images/main/battery.100.png";
const SIGNAL_BARS_URL = "https://raw.githubusercontent.com/truls-dev/images/main/signalbarsblack.png";

const StatusBar: React.FC<Props> = ({ config }) => {
  return (
    <div className="relative flex items-center h-[15px] px-2 w-full bg-white select-none">
      {/* Left Group: Signal Bars and Carrier Label */}
      <div className="flex items-center gap-1 z-10 h-full">
        {/* Signal Bars Container */}
        <div className="flex items-center h-full shrink-0">
          {/* Signal Bars - Adjust the 'translate-y-[0px]' value below to nudge up/down (e.g., -1px or 1px) */}
          <img 
            src={SIGNAL_BARS_URL} 
            alt="Signal" 
            className="h-[8px] w-auto object-contain brightness-0 relative translate-y-[1px]" 
          />
        </div>
        
        {/* Carrier Text - Adjust the 'translate-y-[0px]' value below to nudge up/down independently */}
        <span className="keyboard-font text-[10px] font-bold text-black tracking-tight leading-none ml-0.5 relative inline-block translate-y-[0px]">
          {config.carrier}
        </span>
      </div>

      {/* Center: System Time (Absolute Centered) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="keyboard-font text-[11px] font-bold text-black leading-none tracking-tight relative translate-y-[0px]">
          {config.time}
        </span>
      </div>

      {/* Right Group: WiFi and Battery Icons */}
      <div className="flex-1 flex justify-end items-center gap-1.5 z-10">
        <div className="flex items-center">
          <img 
            src={WIFI_ICON_URL} 
            alt="WiFi" 
            className="h-[9px] w-auto object-contain relative translate-y-[0px]" 
          />
        </div>
        <div className="flex items-center">
          <img 
            src={BATTERY_ICON_URL} 
            alt="Battery" 
            className="h-[8.5px] w-auto object-contain relative translate-y-[0px]" 
          />
        </div>
      </div>
    </div>
  );
};

export default StatusBar;