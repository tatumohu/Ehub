import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Bell, MessageCircle, Store, User, Sparkles, Users, Briefcase, ShoppingCart } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getAccountTypeBorderClass } from '../utils/avatar';

export default function BottomNav() {
  const { user, totalUnreadCount, unreadNotificationsCount, language } = useAppContext();
  const [showPopover, setShowPopover] = useState(false);
  const [showChatPopover, setShowChatPopover] = useState(false);
  const [isTypingActive, setIsTypingActive] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const chatPopoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClassChange = () => {
      setIsTypingActive(document.body.classList.contains('mobile-typing-active'));
    };
    const observer = new MutationObserver(handleClassChange);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false);
      }
      if (chatPopoverRef.current && !chatPopoverRef.current.contains(event.target as Node)) {
        setShowChatPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (path: string) => {
    setShowPopover(false);
    setShowChatPopover(false);
    navigate(path);
  };

  const isMainActive = location.pathname === '/' || location.pathname === '/search' || location.search.includes('type=');
  const isChatActive = location.pathname.startsWith('/chat');

  return (
    <div className={`z-[100] w-full bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)] shrink-0 shadow-lg relative transition-all duration-300 ${
      isTypingActive ? 'translate-y-full opacity-0 pointer-events-none md:translate-y-0 md:opacity-100 md:pointer-events-auto' : 'translate-y-0 opacity-100'
    }`}>
      <div className="max-w-2xl mx-auto flex items-center justify-around h-16 md:h-20">
        {/* メイン (Main) */}
        <div className="relative flex-1 h-full flex items-center justify-center">
          <button
            onClick={() => { setShowPopover(!showPopover); setShowChatPopover(false); }}
            className={`flex flex-col items-center justify-center w-full h-full transition-all ${
              isMainActive || showPopover ? 'text-blue-600 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Home className="w-6 h-6 md:w-7 md:h-7" />
            <span className="text-[10px] md:text-xs mt-1">{language === 'ja' ? 'メイン' : 'Main'}</span>
          </button>

          {/* Popover Menu for Main */}
          {showPopover && (
            <div 
              ref={popoverRef}
              className="absolute bottom-full left-2 sm:left-1/2 sm:-translate-x-1/2 mb-3 w-56 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                {language === 'ja' ? 'メニュー' : 'Menu'}
              </div>
              <button
                onClick={() => handleNavClick('/')}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-left font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors ${location.pathname === '/' ? 'text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-950/40' : 'text-slate-700 dark:text-slate-300'}`}
              >
                <Home className="w-4 h-4 text-blue-500 dark:text-cyan-400" />
                <span>ホーム</span>
              </button>
              <button
                onClick={() => handleNavClick('/search')}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-left font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors ${location.pathname === '/search' ? 'text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-950/40' : 'text-slate-700 dark:text-slate-300'}`}
              >
                <Sparkles className="w-4 h-4 text-blue-500 dark:text-cyan-400" />
                <span>Vision</span>
              </button>
              <button
                onClick={() => handleNavClick('/list?type=recruitment')}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-left font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors ${location.search.includes('type=recruitment') ? 'text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-950/40' : 'text-slate-700 dark:text-slate-300'}`}
              >
                <Users className="w-4 h-4 text-emerald-500" />
                <span>Project</span>
              </button>
              <button
                onClick={() => handleNavClick('/list?type=offer')}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-left font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors ${location.search.includes('type=offer') ? 'text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-950/40' : 'text-slate-700 dark:text-slate-300'}`}
              >
                <Briefcase className="w-4 h-4 text-pink-500" />
                <span>Proposal</span>
              </button>
              <button
                onClick={() => handleNavClick('/list?type=buyout')}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-left font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors ${location.search.includes('type=buyout') ? 'text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-950/40' : 'text-slate-700 dark:text-slate-300'}`}
              >
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                <span>Buyout</span>
              </button>
            </div>
          )}
        </div>

        {/* チャット (Chat) */}
        <div className="relative flex-1 h-full flex items-center justify-center">
          <button
            onClick={() => { setShowChatPopover(!showChatPopover); setShowPopover(false); }}
            className={`flex flex-col items-center justify-center w-full h-full transition-all relative ${
              isChatActive || showChatPopover ? 'text-blue-600 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="relative">
              <MessageCircle className="w-6 h-6 md:w-7 md:h-7" />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md">
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] md:text-xs mt-1">{language === 'ja' ? 'チャット' : 'Chat'}</span>
          </button>

          {/* Popover Menu for Chat */}
          {showChatPopover && (
            <div 
              ref={chatPopoverRef}
              className="absolute bottom-full left-2 sm:left-1/2 sm:-translate-x-1/2 mb-3 w-56 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                {language === 'ja' ? 'メニュー' : 'Menu'}
              </div>
              <button
                onClick={() => handleNavClick('/chat')}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-left font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors ${location.pathname === '/chat' && !location.search.includes('tab=direct') ? 'text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-950/40' : 'text-slate-700 dark:text-slate-300'}`}
              >
                <Users className="w-4 h-4 text-blue-500 dark:text-cyan-400" />
                <span>{language === 'ja' ? 'プロジェクトチャット' : 'Project Chat'}</span>
              </button>
              <button
                onClick={() => handleNavClick('/chat?tab=direct')}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-left font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors ${location.search.includes('tab=direct') ? 'text-blue-600 dark:text-cyan-400 bg-blue-50/50 dark:bg-cyan-950/40' : 'text-slate-700 dark:text-slate-300'}`}
              >
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                <span>{language === 'ja' ? 'チャット' : 'Chat'}</span>
              </button>
            </div>
          )}
        </div>

        {/* ストア (Store) */}
        <div className="flex-1 h-full flex items-center justify-center">
          <NavLink
            to="/completed"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full transition-all ${
                isActive ? 'text-blue-600 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`
            }
          >
            <Store className="w-6 h-6 md:w-7 md:h-7" />
            <span className="text-[10px] md:text-xs mt-1">{language === 'ja' ? 'ストア' : 'Store'}</span>
          </NavLink>
        </div>

        {/* 通知 (Notifications) */}
        <div className="flex-1 h-full flex items-center justify-center">
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full transition-all relative ${
                isActive ? 'text-blue-600 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`
            }
          >
            <div className="relative">
              <Bell className="w-6 h-6 md:w-7 md:h-7" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] md:text-xs mt-1">{language === 'ja' ? '通知' : 'Notifications'}</span>
          </NavLink>
        </div>

        {/* プロフィール (Profile) */}
        <div className="flex-1 h-full flex items-center justify-center">
          <NavLink
            to="/profile"
            onClick={() => {
              window.dispatchEvent(new Event('reset-profile-view'));
            }}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full transition-all ${
                isActive ? 'text-blue-600 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {user ? (
                  <div className="relative">
                    <img 
                      src={user.avatar || undefined} 
                      alt="" 
                      className={`w-6 h-6 md:w-7 md:h-7 rounded-full ${getAccountTypeBorderClass(user.account_type, 'border-2')} ${isActive ? 'ring-2 ring-white/50 scale-105' : ''} transition-all`} 
                    />
                    {(user.show_activity_status === 1 || user.show_activity_status === true || user.show_activity_status === undefined) && (
                      <div className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 bg-emerald-500 border border-white dark:border-slate-900 rounded-full" title="Online"></div>
                    )}
                  </div>
                ) : (
                  <User className="w-6 h-6 md:w-7 md:h-7" />
                )}
                <span className="text-[10px] md:text-xs mt-1">{language === 'ja' ? 'プロフィール' : 'Profile'}</span>
              </>
            )}
          </NavLink>
        </div>
      </div>
    </div>
  );
}
