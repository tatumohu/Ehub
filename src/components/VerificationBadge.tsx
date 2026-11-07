import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export type VerificationBadgeProps = {
  accountType?: string | null;
  verificationStatus?: string | null;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
};

export default function VerificationBadge({
  accountType,
  verificationStatus = 'verified',
  size = 'sm',
  showLabel = false,
  className = '',
}: VerificationBadgeProps) {
  const { language } = useAppContext();
  const isJa = language === 'ja';

  const isGov = accountType === 'municipality';
  const isCorp = accountType === 'corporate' || accountType === 'organization';

  // Only render if accountType is municipality or corporate, and verificationStatus is 'verified'
  if ((!isGov && !isCorp) || (verificationStatus && verificationStatus !== 'verified')) {
    return null;
  }

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  }[size];

  const textSizes = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm font-semibold',
  }[size];

  const labelText = isGov
    ? (isJa ? '自治体認証済み' : 'Verified Municipality')
    : (isJa ? '法人認証済み' : 'Verified Corporate');

  const badgeStyle = isGov
    ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30'
    : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30';

  const iconStyle = isGov
    ? 'fill-sky-500/20 text-sky-600 dark:text-sky-400'
    : 'fill-blue-500/20 text-blue-600 dark:text-blue-400';

  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 rounded-full shrink-0 select-none ${badgeStyle} ${className}`}
      title={labelText}
    >
      <ShieldCheck className={`${iconSizes} ${iconStyle} shrink-0`} />
      {showLabel && <span className={`${textSizes} font-medium`}>{labelText}</span>}
    </span>
  );
}
