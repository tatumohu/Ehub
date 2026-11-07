import React from 'react';
import { User, Building2, Landmark } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import VerificationBadge from './VerificationBadge';

export type AccountTypeBadgeProps = {
  accountType?: string | null;
  verificationStatus?: string | null;
  plan?: string | null;
  showIcon?: boolean;
  showVerification?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
};

export default function AccountTypeBadge({
  accountType,
  verificationStatus = 'verified',
  plan,
  showIcon = true,
  showVerification = false,
  size = 'sm',
  className = '',
}: AccountTypeBadgeProps) {
  const { language } = useAppContext();
  const isJa = language === 'ja';

  const type = accountType || 'individual';
  const isGov = type === 'municipality';
  const isCorp = type === 'organization' || type === 'corporate';
  const isIndiv = !isGov && !isCorp;

  let label = isJa ? '個人' : 'Personal';
  let badgeColor = 'bg-[var(--account-individual-bg)] text-[var(--account-individual-text)] border-[var(--account-individual-border)]';
  let Icon = User;

  if (isGov) {
    label = isJa ? '自治体' : 'Municipality';
    badgeColor = 'bg-[var(--account-municipality-bg)] text-[var(--account-municipality-text)] border-[var(--account-municipality-border)]';
    Icon = Landmark;
  } else if (isCorp) {
    label = isJa ? '法人' : 'Corporate';
    badgeColor = 'bg-[var(--account-corporate-bg)] text-[var(--account-corporate-text)] border-[var(--account-corporate-border)]';
    Icon = Building2;
  }

  // Size styling
  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.2 rounded',
    sm: 'text-[11px] px-2 py-0.5 rounded-md',
    md: 'text-xs px-2.5 py-1 rounded-md font-bold',
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  }[size];

  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <span
        className={`inline-flex items-center gap-1 font-semibold border shrink-0 tracking-wide select-none ${badgeColor} ${sizeClasses} ${className}`}
        title={label}
      >
        {showIcon && <Icon className={`${iconSizes} shrink-0 opacity-85`} />}
        <span>{label}</span>
        {plan && (
          <span className="opacity-75 text-[9px] font-normal uppercase ml-0.5">
            {plan}
          </span>
        )}
      </span>
      {showVerification && (isGov || isCorp) && (
        <VerificationBadge accountType={accountType} verificationStatus={verificationStatus} size={size} />
      )}
    </span>
  );
}

