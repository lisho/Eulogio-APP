
import React from 'react';

const LoadingDots: React.FC = () => {
  return (
    <div className="flex space-x-1 items-center">
      <span className="text-xs text-gray-500">Elaborando</span>
      {/* Using a slightly lighter shade from the theme for dots, or a contrasting one */}
      <div className="w-1.5 h-1.5 bg-[#881337] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-1.5 h-1.5 bg-[#881337] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-1.5 h-1.5 bg-[#881337] rounded-full animate-bounce"></div>
    </div>
  );
};

export default LoadingDots;