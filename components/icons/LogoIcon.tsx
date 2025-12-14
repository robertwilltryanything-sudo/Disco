

import React from 'react';

export const LogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    {...props}
  >
    <circle cx="50" cy="50" r="45" />
    <circle cx="50" cy="50" r="15" />
    <circle cx="50" cy="50" r="2" fill="currentColor" stroke="none" />
  </svg>
);