import { Link, useLocation } from 'react-router-dom';
import { Sparkles, Users, MessageCircle, Store, User } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function BottomNav() {
  const { totalUnreadCount } = useAppContext();
  const location = useLocation();
  const section = location.state?.section;
  const creating = location.pathname === '/create';
  const creatingProject = creating && ['recruitment','offer'].includes(new URLSearchParams(location.search).get('type') || '');
  const items = [
    { label: 'Vision', to: '/vision', icon: Sparkles, active: location.pathname.startsWith('/vision') || location.pathname === '/' || (creating && !creatingProject) || (['/idea/', '/project/'].some(p=>location.pathname.startsWith(p)) && !section) },
    { label: 'Project', to: '/projects', icon: Users, active: location.pathname === '/projects' || creatingProject || section === 'project' },
    { label: 'Chat', to: '/chat', icon: MessageCircle, active: location.pathname.startsWith('/chat') },
    { label: 'Store', to: '/store', icon: Store, active: location.pathname === '/store' || location.pathname.startsWith('/completed') || ['/cart','/purchases'].includes(location.pathname) || section === 'store' },
    { label: 'Profile', to: '/profile', icon: User, active: location.pathname.startsWith('/profile') },
  ];
  return <nav aria-label="Primary navigation" data-testid="primary-navigation" className="z-[100] shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
    <div className="max-w-2xl mx-auto grid grid-cols-5 h-16 md:h-20">
      {items.map(({label,to,icon:Icon,active})=><Link key={label} to={to} aria-current={active?'page':undefined} onClick={()=>{if(label==='Profile')window.dispatchEvent(new Event('reset-profile-view'));}} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] sm:text-xs ${active?'font-bold text-blue-600':'text-slate-500 hover:text-blue-600'}`}>
        <span className="relative"><Icon className="w-6 h-6"/>{label==='Chat'&&totalUnreadCount>0&&<span className="absolute -top-2 -right-3 min-w-4 rounded-full bg-blue-600 px-1 text-[9px] text-white">{totalUnreadCount>99?'99+':totalUnreadCount}</span>}</span>{label}
      </Link>)}
    </div>
  </nav>;
}
