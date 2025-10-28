import React from 'react';

export type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

const base = (size?: number) => ({ width: size ?? 18, height: size ?? 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const);

export const IconCog: React.FC<IconProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/>
    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 8 8 0 0 1-2.3.9 1 1 0 0 0-.8.9V21a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.8-.9 8 8 0 0 1-2.3-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 8 8 0 0 1-.9-2.3 1 1 0 0 0-.9-.8H3a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.8 8 8 0 0 1 .9-2.3 1 1 0 0 0-.2-1.1l-.1-.1A2 2 0 1 1 7.4 3l.1.1a1 1 0 0 0 1.1.2 8 8 0 0 1 2.3-.9 1 1 0 0 0 .8-.9V3a2 2 0 1 1 4 0v.2a1 1 0 0 0 .8.9 8 8 0 0 1 2.3.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 8 8 0 0 1 .9 2.3 1 1 0 0 0 .9.8H21a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.8 8 8 0 0 1-.9 2.3Z"/>
  </svg>
);

export const IconBriefcase: React.FC<IconProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Z"/>
    <path d="M9 5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"/>
    <path d="M3 10h18"/>
  </svg>
);

export const IconDatabase: React.FC<IconProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <ellipse cx="12" cy="5" rx="7" ry="3"/>
    <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/>
    <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>
  </svg>
);

export const IconWrench: React.FC<IconProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M14.7 6.3a4.5 4.5 0 0 0-5.8 5.8l-5.6 5.6a2 2 0 1 0 2.8 2.8l5.6-5.6a4.5 4.5 0 0 0 5.8-5.8l-2.1 2.1-3-3 2.1-2.1Z"/>
  </svg>
);

export const IconBolt: React.FC<IconProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8Z"/>
  </svg>
);

export const IconRefresh: React.FC<IconProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M3 12a9 9 0 0 0 15 6l3-3M21 12A9 9 0 0 0 6 6L3 9"/>
  </svg>
);

export const IconTrash: React.FC<IconProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M3 6h18"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
  </svg>
);

export const IconLightBulb: React.FC<IconProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M9 18h6"/>
    <path d="M10 22h4"/>
    <path d="M2 10a10 10 0 1 1 20 0c0 3-1.5 5-3 6.5-.6.6-1 1.3-1 2.1H6c0-.8-.4-1.5-1-2.1C3.5 15 2 13 2 10Z"/>
  </svg>
);

export const IconClock: React.FC<IconProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3 3"/>
  </svg>
);

export const IconCheckCircle: React.FC<IconProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);
