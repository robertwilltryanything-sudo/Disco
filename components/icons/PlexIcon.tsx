import React from 'react';

interface PlexIconProps {
  className?: string;
}

export const PlexIcon: React.FC<PlexIconProps> = ({ className = 'w-3.5 h-3.5 text-[#e5a00d]' }) => {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      aria-label="Available in Plex"
      role="img"
    >
      <title>Available in Plex</title>
      <path d="M11.643 0H4.68l7.095 12-7.095 12h6.963L18.738 12 11.643 0zm7.677 0h-4.32l4.897 8.277L24 0h-4.68zM15 15.723 19.897 24H24l-4.103-8.277H15z" />
    </svg>
  );
};

export default PlexIcon;
