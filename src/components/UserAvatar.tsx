import React from 'react';
import { getAccountTypeBorderClass } from '../utils/avatar';

export interface UserAvatarProps {
  src?: string | null;
  alt?: string;
  username?: string;
  accountType?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  className?: string;
  borderWidth?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const sizeClasses = {
  xs: 'w-5 h-5',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12',
  '2xl': 'w-16 h-16',
  custom: '',
};

export default function UserAvatar({
  src,
  alt = '',
  username = 'user',
  accountType,
  size = 'md',
  className = '',
  borderWidth = 'border-2',
  onClick,
}: UserAvatarProps) {
  const borderClass = getAccountTypeBorderClass(accountType, borderWidth);
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  
  const fallbackSrc = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username || 'user')}`;
  const displaySrc = src || fallbackSrc;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 ${borderClass} ${sizeClass} ${className}`}
      title={alt || username}
    >
      <img
        src={displaySrc}
        alt={alt || username}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = fallbackSrc;
        }}
      />
    </div>
  );
}
