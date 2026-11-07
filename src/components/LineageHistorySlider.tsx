import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Network as NetworkIconLucide, ChevronLeft, ChevronRight, Heart, MessageSquare, Bookmark, CheckCircle, List } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getAccountTypeBorderClass } from '../utils/avatar';

export default function LineageHistorySlider({ lineage, currentId, currentType, size = 'normal' }: { lineage: any[], currentId?: number, currentType?: 'project' | 'idea', size?: 'normal' | 'small' }) {
  const navigate = useNavigate();
  const { language } = useAppContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!lineage || lineage.length === 0) return null;

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
    <div className={`bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden group/row relative ${size === "small" ? "p-3 md:p-4" : "p-4 md:p-8"}`}>
      <div className="absolute top-3 right-3 md:top-4 md:right-4 z-20">
        <button 
          onClick={() => navigate('/list', { state: { title: 'Lineage Path', items: lineage } })}
          className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs md:text-sm rounded-full transition-colors font-medium border border-slate-700 hover:border-slate-600 flex items-center gap-1.5"
        >
          <List className="w-4 h-4" />
          {language === 'ja' ? '一覧' : 'List'}
        </button>
      </div>
      
      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-full px-2 bg-gradient-to-r from-slate-900 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity hidden md:flex items-center justify-center text-white/50 hover:text-white"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <div 
          ref={scrollRef}
          className="flex items-start gap-6 overflow-x-auto pb-6 scrollbar-hide scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
        >
          {lineage.map((item, i) => {
            const prevItem = i === 0 ? null : lineage[i - 1];
            const isNextFromPrev = prevItem ? (item.author_id === prevItem.author_id) : true;
            const isProject = item.type === 'project';
            const isCurrent = currentId !== undefined && currentType !== undefined 
              ? (item.id === currentId && item.type === currentType)
              : (i === lineage.length - 1);

            return (
              <React.Fragment key={`lineage-node-wrapper-${item.type}-${item.id}-${i}`}>
                <div key={`lineage-node-${item.type}-${item.id}-${i}`} className="flex items-start gap-4 md:gap-6 shrink-0 snap-start">
                  
                  {/* Visual Arrow / Connection Indicator */}
                  {i > 0 && (
                    <div className="flex flex-col items-center gap-1 md:gap-1.5 shrink-0 self-center">
                      <div className={`flex ${isNextFromPrev ? "text-blue-400" : "text-slate-600"}`}>
                        {isNextFromPrev && <ChevronRight className="w-5 h-5 md:w-6 md:h-6 -mr-2 md:-mr-3" />}
                        <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tighter text-slate-500">
                        {isNextFromPrev ? 'Next' : 'Quote'}
                      </span>
                    </div>
                  )}

                  {/* Main Card */}
                  <div className={`shrink-0 transition-all duration-300 hover:scale-[1.02] ${size === "small" ? "w-[120px] md:w-[160px]" : "w-[180px] md:w-[300px]"} shrink-0 transition-all duration-300 hover:scale-[1.02] ${isCurrent ? 'drop-shadow-[0_0_0_3px_#3b82f6] md:drop-shadow-[0_0_10px_rgba(59,130,246,1)]' : 'drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]'}`}>
                    {/* Card Body Link */}
                    <Link to={`/${item.type}/${item.id}`} className="block relative">
                      <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden rounded-2xl shadow-sm border border-slate-200">
                        <img 
                          src={item.image || undefined} 
                          alt="" 
                          className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
                          referrerPolicy="no-referrer" 
                        />
                        <div className="absolute top-2 left-2 z-20 bg-white/95 backdrop-blur-md px-2.5 py-1 flex items-center shadow-sm rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-800 tracking-wide">
                            {isProject ? 'Vision' : 'Idea'}
                          </span>
                        </div>
                        <div className={`absolute bottom-0 left-0 right-0 pt-12 bg-gradient-to-t from-black/90 via-black/40 to-transparent ${size === "small" ? "p-2" : "p-4"}`}>
                          <h3 className={`text-white font-bold leading-tight line-clamp-1 ${size === "small" ? "text-sm md:text-base" : "text-base md:text-xl"}`}>{item.title}</h3>
                        </div>
                      </div>
                    </Link>

                    <div className="mt-4 px-2 space-y-3">
                      <Link to={`/profile/${item.author_id}`} className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors w-fit">
                        <img src={item.author_avatar || undefined} alt="" className={`w-8 h-8 rounded-full object-cover ${getAccountTypeBorderClass(item.author_account_type || item.account_type, 'border-2')}`} />
                        <span className="text-sm font-bold truncate">{item.author_name}</span>
                      </Link>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Heart className="w-4 h-4" />
                            <span className="text-xs font-medium">{item.likes_count || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-xs font-medium">{item.comments_count || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Bookmark className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-medium">{item.archives_count || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </React.Fragment>
            );
          })}

          {/* Render Completed Cards at the end */}
          {lineage.filter(item => item.status === 'completed').map((item, i) => {
            let coverImg = item.image;
            if (item.images) {
              try {
                const imgArr = JSON.parse(item.images);
                if (imgArr.length > 0) coverImg = imgArr[0];
              } catch(e) {}
            }
            
            return (
              <div key={`lineage-node-completed-end-${item.type}-${item.id}-${i}`} className="flex items-start gap-4 md:gap-6 shrink-0 snap-start">
                {/* Visual Arrow / Connection Indicator */}
                <div className="flex flex-col items-center gap-1 md:gap-1.5 shrink-0 self-center">
                  <div className="flex text-emerald-400">
                    <ChevronRight className="w-5 h-5 md:w-6 md:h-6 -mr-2 md:-mr-3" />
                    <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tighter text-emerald-500">
                    Completed
                  </span>
                </div>

                {/* Completed Card Style */}
                <Link
                  to={`/completed/${item.id}`}
                  className={`block shrink-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group hover:border-emerald-500/50 transition-colors drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)] ${size === "small" ? "w-[120px] md:w-[160px]" : "w-[180px] md:w-[300px]"}`}
                >
                  <div className="aspect-[16/10] relative overflow-hidden">
                    <img 
                      src={coverImg || undefined} 
                      alt={item.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg z-10">
                      <CheckCircle className="w-3 h-3" />
                      RELEASED
                    </div>
                  </div>
                  
                  <div className={size === "small" ? "p-2" : "p-4"}>
                    <h3 className="font-bold text-white mb-1 md:mb-2 text-sm md:text-base line-clamp-1">{item.title}</h3>
                    <p className="text-slate-400 text-sm mb-4 line-clamp-2 min-h-[40px]">
                      {item.description ? item.description.replace(/<[^>]*>/g, '') : "No description"}
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <img src={item.author_avatar || undefined} alt="" className={`w-5 h-5 rounded-full object-cover ${getAccountTypeBorderClass(item.author_account_type || item.account_type, 'border-2')}`} />
                        <span className="text-xs text-slate-300 truncate">{item.author_name}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-slate-500 text-xs shrink-0">
                        <div className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5" />
                          <span>{item.likes_count || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
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
    </div>
  );
}
