import React from 'react';

export const MusicianIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    {/* UserIcon body - head shifted down to make room for hat */}
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
    />
    {/* Fedora-style hat */}
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.5 6.75h9v-1.5a3 3 0 00-3-3h-3a3 3 0 00-3 3v1.5z"
    />
  </svg>
);
