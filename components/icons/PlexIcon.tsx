import React from 'react';

interface PlexIconProps {
  className?: string;
}

export const PlexIcon: React.FC<PlexIconProps> = ({ className = 'w-3.5 h-3.5' }) => {
  return (
    <svg 
      viewBox="0 0 256 256" 
      className={className} 
      aria-label="Available in Plex" 
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Available in Plex</title>
      {/* Rear dark charcoal/grey chevron */}
      <path 
        fill="#3E3E3E" 
        d="M 187 27 H 194 L 221 58 L 167 125 L 130 76 Z M 167 131 L 221 198 L 192 228 H 186 L 130 180 Z" 
      />
      {/* Front orange chevron */}
      <path 
        fill="#FF9E16" 
        d="M 60 29 H 69 L 164 128 L 70 227 H 59 L 33 198 L 89 128 L 33 58 Z" 
      />
    </svg>
  );
};

export default PlexIcon;
