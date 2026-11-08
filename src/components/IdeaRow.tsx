import React, { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Heart, MessageSquare, Bookmark, Users, Lightbulb, Lock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { STAGES } from './SimpleStageIndicator';
import HashtagDisplay from './HashtagDisplay';
import PermittedUsersModal from './PermittedUsersModal';
import { getAccountTypeBorderClass } from '../utils/avatar';

export interface IdeaRowProps {
  title: string;
  items: any[];
  icon?: React.ReactNode;
  onQuoteClick: (item: { id: number; type: 'project' | 'idea' }) => void;
}

export default function IdeaRow({ title, items, icon, onQuoteClick }: IdeaRowProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useAppContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPermittedUsersModal, setShowPermittedUsersModal] = useState<number[] | null>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' 
        ? scrollLeft - clientWidth * 0.8 
        : scrollLeft + clientWidth * 0.8;
      
      scrollRef.current.scrollTo({
        left: scrollTo,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="space-y-2 sm:space-y-2.5 group/row relative">
      <div className="flex items-center gap-3 px-1 sm:px-2">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>
        </div>
        <button 
          onClick={() => navigate('/list', { state: { title, items, section: location.pathname === '/projects' ? 'project' : undefined } })}
          className="px-3 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs md:text-sm rounded-full transition-colors font-medium border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer"
        >
          {language === 'ja' ? '一覧' : 'List'}
        </button>
      </div>
      
      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-full px-2 bg-gradient-to-r from-slate-200 dark:from-slate-900 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity hidden md:flex items-center justify-center text-slate-700 dark:text-white/50 hover:text-slate-900 dark:hover:text-white"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <div 
          ref={scrollRef}
          className="flex flex-row gap-3 sm:gap-4 md:gap-5 overflow-x-auto pb-1.5 sm:pb-2 pt-0.5 sm:pt-1 px-1 sm:px-2 snap-x snap-mandatory scrollbar-hide scroll-smooth" 
          style={{ scrollbarWidth: 'none' }}
        >
          {items.length === 0 ? (
            <div className="flex w-full items-center justify-center p-8 border border-dashed border-slate-300 dark:border-slate-700/50 rounded-xl bg-slate-50 dark:bg-slate-800/20">
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {language === 'ja' ? "未設定" : "There are no entries yet"}
              </p>
            </div>
          ) : items.map((item) => {
            const isNewIdeaWithin24h = (item.latest_idea_at && (new Date().getTime() - new Date((item.latest_idea_at || '') + (!(item.latest_idea_at || '').includes('Z') ? 'Z' : '')).getTime() < 24 * 60 * 60 * 1000)) || (item.created_at && (new Date().getTime() - new Date((item.created_at || '') + (!(item.created_at || '').includes('Z') ? 'Z' : '')).getTime() < 24 * 60 * 60 * 1000));
            const targetUrl = item.type === 'project' && (item.status === 'completed' || Number(item.is_buyout) === 1) ? `/completed/${item.id}` : `/${item.type}/${item.id}`;

            return (
              <div
                key={`${item.type}-${item.id}`}
                className="w-[170px] sm:w-[210px] md:w-[250px] shrink-0 snap-start md:flex-none group"
              >
                <div className="block">
                  <Link to={targetUrl} state={{section:Number(item.is_buyout)===1?'store':location.pathname==='/projects'?'project':undefined}} className="block bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-cyan-500/20 hover:border-blue-400 dark:hover:border-cyan-500/50 rounded-2xl overflow-hidden group shadow-sm hover:shadow-md dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all hover:scale-[1.01] flex flex-col h-full">
                    <div className="relative aspect-[16/10] bg-slate-100 dark:bg-slate-900 overflow-hidden">
                      <img 
                        src={item.image || undefined} 
                        alt={item.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 dark:from-[#0b0f19] via-black/20 to-transparent opacity-80"></div>
                      
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-blue-600/80 dark:bg-cyan-500/20 backdrop-blur-md border border-blue-400/40 dark:border-cyan-500/40 text-white dark:text-cyan-300 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-md">
                          {Number(item.is_recruitment) === 1 ? 'Project' : item.type === 'project' ? 'Vision' : 'Idea'}
                        </span>
                        {Number(item.is_buyout) === 1 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold shadow-md">
                            {language === 'ja' ? 'バイアウト' : 'Buyout'}
                          </span>
                        ) : Number(item.is_recruitment) === 1 ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold shadow-md">
                            {Number(item.is_private) === 1 ? 'Proposal' : 'Project'}
                          </span>
                        ) : null}
                      </div>

                      {Number(item.unread_ideas_count) > 0 && (
                        <div className="absolute top-2 right-2 z-30 bg-blue-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-pulse">
                          <span>{item.unread_ideas_count > 99 ? '99+' : item.unread_ideas_count}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between gap-2">
                      <div>
                        {isNewIdeaWithin24h && (
                          <span className="text-[9px] font-bold text-white bg-gradient-to-r from-pink-500 to-violet-500 px-1.5 py-0.5 rounded-full mb-1 inline-block shadow-md">New Idea Inside</span>
                        )}
                        <h3 className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm md:text-base leading-snug line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-cyan-300 transition-colors mb-1">
                          {item.title}
                        </h3>

                        {(item.completed_tags || item.tags) && (
                          <div className="mb-1">
                            <HashtagDisplay tags={item.completed_tags || item.tags || ''} />
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col items-stretch gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/profile/${item.author_id}`);
                          }}
                          className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer min-w-0 max-w-full"
                        >
                          <img 
                            src={item.author_avatar || undefined} 
                            alt="" 
                            className={`w-5 h-5 rounded-full ${getAccountTypeBorderClass(item.author_account_type, 'border')} object-cover shrink-0`} 
                          />
                          <span className="font-semibold truncate text-[11px]">{item.author_name}</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px]">
                          <span className="flex items-center gap-0.5 hover:text-pink-500 transition-colors" title="Likes">
                            <Heart className="w-3.5 h-3.5 text-pink-500" />
                            <span className="font-medium text-slate-700 dark:text-slate-300">{item.likes_count || 0}</span>
                          </span>
                          <span className="flex items-center gap-0.5 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors" title="Comments">
                            <MessageSquare className="w-3.5 h-3.5 text-blue-500 dark:text-cyan-400" />
                            <span className="font-medium text-slate-700 dark:text-slate-300">{item.comments_count || 0}</span>
                          </span>
                          <span className="flex items-center gap-0.5 hover:text-emerald-500 transition-colors" title="Archives">
                            <Bookmark className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="font-medium text-slate-700 dark:text-slate-300">{item.archives_count || 0}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-full px-2 bg-gradient-to-l from-slate-900 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity hidden md:flex items-center justify-center text-white/50 hover:text-white"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>

      {showPermittedUsersModal && (
        <PermittedUsersModal 
          permittedUserIds={showPermittedUsersModal} 
          onClose={() => setShowPermittedUsersModal(null)} 
        />
      )}
    </div>
  );
}
