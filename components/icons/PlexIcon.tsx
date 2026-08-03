import React from 'react';

export const PlexIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
  >
    <path d="M12 2L2 19.5h5.5L12 10l4.5 9.5H22L12 2z" />
  </svg>
);
