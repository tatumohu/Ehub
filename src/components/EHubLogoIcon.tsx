import React from 'react';

interface EHubLogoIconProps {
  className?: string;
  size?: number;
}

export const EHubLogoIcon: React.FC<EHubLogoIconProps> = ({ className = 'w-8 h-8', size }) => {
  const style = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0`}
      style={style}
    >
      {/* Outer Circle */}
      <circle
        cx="50"
        cy="50"
        r="45"
        className="stroke-slate-700 dark:stroke-slate-200"
        strokeWidth="3.5"
      />

      {/* Connecting Lines */}
      {/* Left Vertical Line: Green */}
      <line
        x1="37"
        y1="31"
        x2="37"
        y2="69"
        stroke="#059669"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Top Diagonal Line: Blue */}
      <line
        x1="37"
        y1="31"
        x2="68"
        y2="50"
        stroke="#2563EB"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Bottom Diagonal Line: Red */}
      <line
        x1="37"
        y1="69"
        x2="68"
        y2="50"
        stroke="#DC2626"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Node 1: Top-Left */}
      <circle
        cx="37"
        cy="31"
        r="7.5"
        fill="#FFFFFF"
        className="stroke-slate-700 dark:stroke-slate-200"
        strokeWidth="3.5"
      />

      {/* Node 2: Bottom-Left */}
      <circle
        cx="37"
        cy="69"
        r="7.5"
        fill="#FFFFFF"
        className="stroke-slate-700 dark:stroke-slate-200"
        strokeWidth="3.5"
      />

      {/* Node 3: Right */}
      <circle
        cx="68"
        cy="50"
        r="7.5"
        fill="#FFFFFF"
        className="stroke-slate-700 dark:stroke-slate-200"
        strokeWidth="3.5"
      />
    </svg>
  );
};

export default EHubLogoIcon;
