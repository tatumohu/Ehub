import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { UserCircle, Inbox, Search as SearchIcon, Search, Bell, ChevronDown, Home, Lightbulb, Briefcase, User, Sparkles, Users, ShoppingCart } from 'lucide-react';
import PlanUpgradeModal from './PlanUpgradeModal';
import ScoutChatModal from './ScoutChatModal';
import ScoutInboxModal from './ScoutInboxModal';
import SearchModal from './SearchModal';
import AccountSwitcherMenu from './AccountSwitcherMenu';
import { getAccountTypeBorderClass } from '../utils/avatar';
import { EHubLogoIcon } from './EHubLogoIcon';
import React, { useState, useEffect, useRef } from 'react';

export default function Navbar() {
  const { user, login, logout, socket, language, unreadOfferCount, unreadRecruitmentCount, unreadNotificationsCount } = useAppContext();
  const [showLogin, setShowLogin] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [modalMode, setModalMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(localStorage.getItem('ehub_last_email') || '');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [accountType, setAccountType] = useState<'individual' | 'organization'>('individual');
  const [verificationTokenResult, setVerificationTokenResult] = useState<string | null>(null);
  const [simulatingEmail, setSimulatingEmail] = useState(false);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const location = useLocation();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [activeSubTab, setActiveSubTab] = useState<'recruitment' | 'offer' | 'buyout'>('recruitment');
  const [showPlanUpgradeModal, setShowPlanUpgradeModal] = useState(false);
  const [showScoutChatModal, setShowScoutChatModal] = useState(false);
  const [showScoutInboxModal, setShowScoutInboxModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOpenScout = () => setShowScoutChatModal(true);
    const handleOpenAuth = (e: any) => {
      if (e?.detail?.mode === 'register') {
        setModalMode('register');
      } else {
        setModalMode('login');
      }
      setShowLogin(true);
    };
    window.addEventListener('open-scout-chat', handleOpenScout);
    window.addEventListener('open-auth-modal', handleOpenAuth);
    return () => {
      window.removeEventListener('open-scout-chat', handleOpenScout);
      window.removeEventListener('open-auth-modal', handleOpenAuth);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !username.trim()) return;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username, account_type: accountType })
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationTokenResult(data.token);
        setSimulatingEmail(true);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        login(data);
        setShowLogin(false);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const simulateEmailVerification = async () => {
    if (!verificationTokenResult) return;
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationTokenResult })
      });
      const data = await res.json();
      if (res.ok) {
        login(data);
        setShowLogin(false);
        setSimulatingEmail(false);
        setVerificationTokenResult(null);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      .then(res => {
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) return { error: 'Invalid token' };
        return res.json();
      })
      .then(data => {
        if (data && !data.error) {
           login(data);
           // remove token from url
           window.history.replaceState({}, document.title, window.location.pathname);
        }
      })
      .catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      const loadNotifications = () => {
        fetch(`/api/users/${user.id}/notifications`)
          .then(res => {
            const ct = res.headers.get('content-type') || '';
            if (!res.ok || !ct.includes('application/json')) return [];
            return res.json();
          })
          .then(data => setNotifications(Array.isArray(data) ? data : []))
          .catch(() => setNotifications([]));
      };

      loadNotifications();

      if (socket) {
        socket.on('notification', () => {
          loadNotifications();
        });
      }
    }
  }, [user, socket]);

  const handleGoogleLogin = async () => {
    try {
      const response = await fetch('/api/auth/google/url');
      const ct = response.headers.get('content-type') || '';
      if (!response.ok || !ct.includes('application/json')) {
        throw new Error('Failed to get auth URL');
      }
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Please allow popups for this site to connect your account.');
      }
    } catch (error) {
      console.error('OAuth error:', error);
    }
  };

  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || isSigningIn) return;
    setAuthError('');
    setIsSigningIn(true);
    try {
      const res = await fetch('/api/login/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
        signal: AbortSignal.timeout(15000)
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Invalid server response');
      }
      const data = await res.json();
      if (res.ok && data.id) {
        login(data);
        setShowLogin(false);
      } else {
        setAuthError(data.error || (language === 'ja' ? 'ログインできませんでした。' : 'Unable to sign in.'));
      }
    } catch {
      setAuthError(language === 'ja'
        ? 'サーバーに接続できません。E-hubが起動していることを確認して、もう一度お試しください。'
        : 'Cannot connect to the server. Make sure E-hub is running, then try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin loosely given AI Studio environments
      if (!event.origin.includes('localhost') && !event.origin.includes('.run.app')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.user) {
        login(event.data.user);
        setShowLogin(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [login]);

  const qFromParams = searchParams.get('q');

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/list?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/list');
    }
  };

  const acceptFollow = async (followId: number) => {
    await fetch(`/api/follows/${followId}/accept`, { method: 'POST' });
    setNotifications(notifications.filter(n => n.id !== followId));
  };

  return (
    <>
      <div className="z-[100] w-full shrink-0 flex flex-col relative">
        <nav className="w-full bg-white/90 dark:bg-[#0b0f19]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 relative z-50 shadow-sm transition-colors">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16 gap-1.5 sm:gap-4">
              <div className="flex items-center shrink-0">
                <Link to="/" className="flex items-center gap-1.5 sm:gap-2.5 group">
                  <EHubLogoIcon className="w-8 h-8 sm:w-9 sm:h-9 transition-transform group-hover:scale-105" />
                  <span className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight shrink-0">E-hub</span>
                </Link>
              </div>

              <div className="flex-1 min-w-0 px-1 sm:px-4">
                <button 
                  type="button"
                  data-testid="open-search"
                  onClick={() => setShowSearchModal(true)}
                  className="relative w-full text-left group"
                >
                  <SearchIcon className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors" />
                  <div className="w-full bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-full pl-8 sm:pl-11 pr-2 sm:pr-4 py-1.5 sm:py-2.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-inner truncate flex items-center justify-between">
                    <span className="truncate">{searchQuery || (language === 'ja' ? 'キーワード検索...' : 'Search...')}</span>
                    <span className="hidden sm:inline-block text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono">⌘K</span>
                  </div>
                </button>
              </div>

              <div className="flex items-center shrink-0 justify-end gap-1 sm:gap-3 relative">
                <button
                  onClick={() => navigate('/notifications')}
                  className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 relative transition-colors shrink-0"
                  title="通知"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-blue-600 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
                  )}
                </button>

                {user ? (
                  <div className="relative shrink-0" ref={accountMenuRef}>
                    <button
                      type="button"
                      id="btn-user-account-menu"
                      onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
                      className="flex items-center gap-1 sm:gap-2 p-0.5 sm:p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                      title={language === 'ja' ? 'アカウントメニュー・切り替え' : 'Account Menu & Switcher'}
                    >
                      <img 
                        src={user.avatar || undefined} 
                        alt={user.username} 
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ${getAccountTypeBorderClass(user.account_type, 'border-2')} group-hover:scale-105 transition-all shadow-sm`} 
                      />
                      <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-transform duration-200 hidden sm:block ${showAccountSwitcher ? 'rotate-180' : ''}`} />
                    </button>

                    {showAccountSwitcher && (
                      <div data-account-popover="true" className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 z-50 animate-scale-in max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-2xl">
                        <AccountSwitcherMenu
                          onClose={() => setShowAccountSwitcher(false)}
                          onOpenPricing={() => setShowPlanUpgradeModal(true)}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <button 
                    data-testid="open-login"
                    onClick={() => { setAuthError(''); setShowLogin(true); }}
                    className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-all shadow-md shadow-blue-600/20 shrink-0"
                  >
                    <UserCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">{language === 'ja' ? 'サインイン' : 'Sign In'}</span>
                  </button>
                )}


              </div>
            </div>
          </div>
        </nav>
        

      </div>

      {showScoutInboxModal && (
        <ScoutInboxModal onClose={() => setShowScoutInboxModal(false)} />
      )}
      {showPlanUpgradeModal && (
        <PlanUpgradeModal onClose={() => setShowPlanUpgradeModal(false)} />
      )}
      {showScoutChatModal && (
        <ScoutChatModal onClose={() => setShowScoutChatModal(false)} />
      )}
      {showLogin && !simulatingEmail && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm overflow-y-auto pb-20">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-800 shadow-2xl mt-8 mb-[10vh] transition-colors">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                {modalMode === 'login' ? (language === 'ja' ? 'ログイン' : 'Login') : (language === 'ja' ? 'E-hubへようこそ' : 'Welcome to E-hub')}
              </h2>
              <form data-testid="login-form" onSubmit={handleUsernameLogin} className="space-y-4">
                {authError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{authError}</p>}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'ja' ? 'ユーザー名' : 'Username'}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm"
                    placeholder={language === 'ja' ? 'ユーザー名を入力' : 'Enter your username'}
                    required
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={isSigningIn}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl transition-colors shadow-sm"
                >
                  {isSigningIn ? (language === 'ja' ? 'ログイン中…' : 'Signing in…') : (language === 'ja' ? 'サインイン' : 'Sign In')}
                </button>
                
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowLogin(false)}
                    className="flex-1 px-4 py-3 rounded-xl font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    {language === 'ja' ? 'キャンセル' : 'Cancel'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showLogin && simulatingEmail && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm overflow-y-auto pb-20">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-800 shadow-2xl mt-8 mb-[10vh] transition-colors">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">📧 Email Sent (Simulation)</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              An email was sent to <strong className="text-slate-900 dark:text-white">{email}</strong> with a login link. For this demo, click the button below to simulate clicking the email link.
              <br/><br/>
              Link: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700">/?token={verificationTokenResult}</code>
            </p>
            <div className="flex gap-3">
              <button 
                onClick={simulateEmailVerification}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
              >
                Click Link & Login
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

      <SearchModal 
        isOpen={showSearchModal} 
        onClose={() => setShowSearchModal(false)} 
        initialQuery={searchQuery} 
      />
  </>
  );
}
