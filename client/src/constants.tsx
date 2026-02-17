import React from 'react';

export const SNAP_COLORS = {
  ME: 'rgb(242, 60, 87)',
  THEM: 'rgb(14, 173, 255)',
  GRAY_TEXT: '#999999',
  SYSTEM_BG: '#FFFFFF',
  INPUT_BG: '#F2F3F5',
};

export const GROUP_COLORS = [
  'rgb(14, 173, 255)', // Blue
  'rgb(242, 60, 87)', // Red
  '#A020F0', // Purple
  '#00D26A', // Green
  '#FF9500', // Orange
  '#0084FF', // Deep Blue
];

export const SNAP_ICONS = {
  Back: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  ),
  Phone: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.11 14.61c-1.07-.27-2.14-.13-2.93.53l-1.12 1.12c-2.42-1.21-4.38-3.17-5.59-5.59l1.12-1.12c.66-.79.8-1.86.53-2.93l-.43-1.71c-.27-1.07-1.33-1.81-2.4-1.81H5.16c-1.34 0-2.54 1.2-2.54 2.54 0 10.43 8.46 18.89 18.89 18.89 1.34 0 2.54-1.2 2.54-2.54v-3.13c0-1.07-.74-2.13-1.81-2.4l-1.71-.43z" />
    </svg>
  ),
  Video: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.5 7h-9C4.12 7 3 8.12 3 9.5v5c0 1.38 1.12 2.5 2.5 2.5h9c1.38 0 2.5-1.12 2.5-2.5V11l4.5 3.5v-7L17 11V9.5C17 8.12 15.88 7 14.5 7z" />
    </svg>
  ),
  Camera: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" fill="white" />
      <circle cx="12" cy="13" r="4.5" fill="white" />
      <circle cx="12" cy="13" r="3" fill="black" />
      <circle cx="13.5" cy="11.5" r="0.8" fill="white" />
    </svg>
  ),
  Microphone: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <line x1="12" y1="19" x2="12" y2="23"></line>
    </svg>
  ),
  Gallery: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  Stickers: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 15s1.5 2 4 2 4-2 4-2" strokeLinecap="round" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
      <circle cx="15" cy="9" r="1" fill="currentColor" />
    </svg>
  ),
  Plus: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};