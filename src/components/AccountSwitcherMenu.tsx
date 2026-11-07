import React, { useState } from 'react';
import { User, Building2, Landmark, Check, LogOut, CreditCard, UserCircle, ChevronRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import AccountTypeBadge from './AccountTypeBadge';
import { useNavigate } from 'react-router-dom';

interface AccountSwitcherMenuProps {
  onClose?: () => void;
  onOpenPricing?: () => void;
}

export default function AccountSwitcherMenu({ onClose, onOpenPricing }: AccountSwitcherMenuProps) {
  const { user, updateUser, logout, language } = useAppContext();
  const navigate = useNavigate();
  const [isSwitching, setIsSwitching] = useState(false);

  if (!user) return null;

  const currentType = user.account_type || 'individual';

  const handleAccountSwitch = async (targetType: 'individual' | 'organization' | 'municipality') => {
    if (currentType === targetType || isSwitching) return;

    try {
      setIsSwitching(true);
      const res = await fetch(`/api/users/${user.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_type: targetType, is_account_type_selected: 1 })
      });

      if (res.ok) {
        const updatedData = await res.json();
        updateUser(updatedData);
      } else {
        // Fallback local update if mock/offline
        updateUser({ ...user, account_type: targetType });
      }
    } catch (err) {
      console.error('Account switch failed:', err);
      updateUser({ ...user, account_type: targetType });
    } finally {
      setIsSwitching(false);
      if (onClose) onClose();
    }
  };

  const accountOptions = [
    {
      id: 'individual' as const,
      name: language === 'ja' ? '個人' : 'Individual',
      description: language === 'ja' ? '個人としての共創・Idea提案・作品販売' : 'Personal activity, ideas & portfolio',
      icon: User,
      borderColor: 'border-2 border-blue-500 dark:border-blue-400',
      bgGlow: 'bg-blue-500/10 text-blue-600 dark:text-cyan-400',
      activeBorder: 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/30',
      activeTagBg: 'bg-blue-500 text-white',
      isActive: currentType === 'individual'
    },
    {
      id: 'organization' as const,
      name: language === 'ja' ? '法人' : 'Corporate',
      description: language === 'ja' ? '企業課題の掲載・Project公募・スカウト' : 'Corporate projects & talent recruitment',
      icon: Building2,
      borderColor: 'border-2 border-emerald-500 dark:border-emerald-400',
      bgGlow: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      activeBorder: 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/30',
      activeTagBg: 'bg-emerald-500 text-white',
      isActive: currentType === 'organization' || currentType === 'corporate'
    },
    {
      id: 'municipality' as const,
      name: language === 'ja' ? '自治体' : 'Municipality',
      description: language === 'ja' ? '地域課題の無料公開・官民連携・共創' : 'Public regional challenges & co-creation',
      icon: Landmark,
      borderColor: 'border-2 border-purple-500 dark:border-purple-400',
      bgGlow: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      activeBorder: 'border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/30',
      activeTagBg: 'bg-purple-500 text-white',
      isActive: currentType === 'municipality'
    }
  ];

  return (
    <div className="w-[320px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 text-slate-900 dark:text-slate-100">
      {/* Current Active User Summary */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
              alt={user.username}
              className={`w-11 h-11 rounded-full object-cover shadow-sm ${
                currentType === 'municipality'
                  ? 'border-2 border-purple-500'
                  : currentType === 'organization' || currentType === 'corporate'
                  ? 'border-2 border-emerald-500'
                  : 'border-2 border-blue-500'
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm truncate">{user.username}</span>
              <AccountTypeBadge accountType={currentType} size="xs" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {(user as any).email || (language === 'ja' ? 'ログイン中' : 'Signed in')}
            </p>
          </div>
        </div>
      </div>

      {/* Account Switching Section Header */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          {language === 'ja' ? 'アカウント切り替え' : 'Switch Account'}
        </span>
      </div>

      {/* Account Type Options List */}
      <div className="p-2 space-y-1.5">
        {accountOptions.map((option) => {
          const IconComp = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              disabled={isSwitching}
              onClick={() => handleAccountSwitch(option.id)}
              className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-3 border ${
                option.isActive
                  ? `${option.activeBorder} shadow-sm`
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Icon with corresponding colored circular border */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${option.borderColor} ${option.bgGlow}`}
                >
                  <IconComp className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {option.name}
                    </span>
                    {option.isActive && (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${option.activeTagBg}`}>
                        {language === 'ja' ? 'アクティブ' : 'Active'}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {option.description}
                  </p>
                </div>
              </div>

              {option.isActive ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 opacity-50 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Navigation Footer Actions */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800 space-y-1 bg-slate-50/50 dark:bg-slate-900/50">
        <button
          type="button"
          onClick={() => {
            if (onClose) onClose();
            navigate('/profile');
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <UserCircle className="w-4 h-4 text-slate-500" />
          <span>{language === 'ja' ? 'プロフィール設定' : 'Profile Settings'}</span>
        </button>

        {onOpenPricing && (
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              onOpenPricing();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <CreditCard className="w-4 h-4 text-blue-500" />
            <span>{language === 'ja' ? '料金・プラン確認' : 'Plans & Pricing'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (onClose) onClose();
            logout();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{language === 'ja' ? 'サインアウト' : 'Sign Out'}</span>
        </button>
      </div>
    </div>
  );
}
