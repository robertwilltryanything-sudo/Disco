import React from 'react';

export const VinylIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    {...props}
  >
    <circle cx="12" cy="12" r="11" />
    <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.2" />
    <circle cx="12" cy="12" r="8" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.15" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.1" />
    <circle cx="12" cy="12" r="4" fill="white" />
    <circle cx="12" cy="12" r="1" fill="black" />
  </svg>
);