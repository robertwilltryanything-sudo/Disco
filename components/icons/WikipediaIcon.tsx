import React from 'react';

export const WikipediaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 100 100" 
    fill="currentColor" 
    {...props}
  >
    {/* Thin outer circle border matching the uploaded reference */}
    <circle 
      cx="50" 
      cy="50" 
      r="44" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      opacity="0.3" 
    />
    
    {/* Mathematically centered serif 'W' scaled to sit comfortably inside the circle */}
    <path 
      d="M71.5,37.5c-1.2-0.3-2.4-0.4-3.5-0.4c-2.2,0-3.8,1-4.6,3.1l-8.8,26.5L47,42.6c-0.6-1.9-1.7-3.1-3.3-3.5
      c-1.2-0.3-2.4-0.4-3.5-0.4c-2.2,0-3.8,1-4.6,3.1L26.5,68.2l-4.1-12.5c-0.6-1.7-1.5-2.8-2.8-3c-1-0.2-1.9-0.4-2.8-0.4
      c-0.6,0-1.1,0.4-1.1,0.9c0,0.6,0.6,0.8,1.6,1c1.4,0.2,2.6,1.3,3.4,4l6.4,18.8c0.5,1.3,1.2,1.8,2.2,1.8c1,0,1.7-0.6,2.2-1.8l8.9-25.6
      l7.9,25.6c0.4,1.3,1.1,1.8,2.1,1.8s1.7-0.6,2.2-1.8l12.4-37.1c0.7-2.4,1.9-3.5,3.6-3.5c0.7,0,1.6,0.2,2.6,0.5c0.6,0.2,1-0.3,1-0.9
      C72.4,37.9,72,37.6,71.5,37.5z" 
      transform="translate(50, 48) scale(0.92) translate(-50, -50)"
    />
  </svg>
);