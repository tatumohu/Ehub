import React from 'react';
import { useAppContext } from '../context/AppContext';

type OrgBadgeProps = {
  plan?: string | null;
  accountType?: string | null;
};

export default function OrgBadge({ plan, accountType }: OrgBadgeProps) {
  const { language } = useAppContext();
  const normalizedPlan = plan === 'basic' || !plan ? 'light' : plan;
  
  const isGov = accountType === 'municipality';
  let planLabel = '';
  let bgClass = '';
  
  switch (normalizedPlan) {
    case 'enterprise':
      planLabel = language === 'ja' ? 'エンタープライズ' : 'Enterprise';
      bgClass = isGov 
        ? 'bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.4)]' 
        : 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]';
      break;
    case 'standard':
      planLabel = language === 'ja' ? 'スタンダード' : 'Standard';
      bgClass = isGov 
        ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.4)]' 
        : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]';
      break;
    case 'light':
    default:
      planLabel = language === 'ja' ? 'ライト' : 'Light';
      bgClass = isGov 
        ? 'bg-amber-600 shadow-[0_0_8px_rgba(217,119,6,0.4)]' 
        : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
      break;
  }

  const prefix = isGov 
    ? (language === 'ja' ? '自治体' : 'Gov')
    : (language === 'ja' ? '法人' : 'Corp');

  return (
    <span 
      className={`inline-flex items-center justify-center h-5 px-1.5 rounded-md text-white font-bold text-[10px] uppercase shrink-0 mr-1.5 ${bgClass}`} 
      title={`${prefix} ${planLabel} Account`}
    >
      {prefix} {planLabel}
    </span>
  );
}
