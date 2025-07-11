import React from 'react';

const MicrophoneIcon: React.FC<{ className?: string; isListening?: boolean }> = ({ className, isListening }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24" // Standard viewBox for Material Icons
    fill="currentColor" // Changed to fill for a solid icon
    className={className || "w-6 h-6"}
  >
    {/* 
      Standard microphone icon path (e.g., similar to Material Design Icons 'mic').
      The 'isListening' prop is available for future style tweaks if needed (e.g., subtle animation or color overlay),
      but the primary visual feedback for the listening state comes from the parent button's background color change.
    */}
    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
  </svg>
);

export default MicrophoneIcon;