import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Triangle, Sparkles, Users, Lightbulb, Lock, Briefcase, ShoppingCart, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { STAGES } from '../components/SimpleStageIndicator';
import IdeaQuotesModal from '../components/IdeaQuotesModal';
import IdeaRow from '../components/IdeaRow';
import { getAccountTypeBorderClass } from '../utils/avatar';

type Idea = {
  id: number;
  title: string;
  description: string;
  image: string;
  author_id: number;
  author_name: string;
  author_avatar: string;
  author_account_type?: string;
  account_type?: string;
  created_at: string;
  type: 'idea' | 'project';
  quoted_item_id?: number | null;
  likes_count?: number;
  archives_count?: number;
  comments_count?: number;
  follows_count?: number;
  quotes_count?: number;
  stage?: number;
  is_recruitment?: number;
  is_buyout?: number;
  buyout_price?: number;
  latest_idea_id?: number;
  latest_idea_at?: string;
  is_private?: number;
  permitted_users?: string;
  tags?: string;
  status?: string;
  completed_tags?: string;
};

export default function Search() {
  const navigate = useNavigate();
  const { user, language } = useAppContext();
  const [items, setItems] = useState<Idea[]>([]);
  const [recommendedItems, setRecommendedItems] = useState<Idea[]>([]);
  const [regionItems, setRegionItems] = useState<Idea[]>([]);
  const [recruitmentItems, setRecruitmentItems] = useState<Idea[]>([]);
  const [offerItems, setOfferItems] = useState<Idea[]>([]);
  const [buyoutItems, setBuyoutItems] = useState<Idea[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [direction, setDirection] = useState(0);
  const [activeQuotesItem, setActiveQuotesItem] = useState<{id: number, type: 'project' | 'idea'} | null>(null);
  const [heroTouchStart, setHeroTouchStart] = useState<number | null>(null);

  const trendingItems = useMemo(() => items.slice(0, 5), [items]);

  const latestVisions = useMemo(() => items.filter(i => i.type === 'project'), [items]);
  const latestIdeas = useMemo(() => items.filter(i => i.type === 'idea'), [items]);

  const displayTrendingItems = useMemo(() => {
    if (trendingItems.length === 0) return [];
    return Array(7).fill(trendingItems).flat();
  }, [trendingItems]);

  useEffect(() => {
    if (trendingItems.length > 0 && currentSlide === 0) {
      setCurrentSlide(trendingItems.length * 3);
    }
  }, [trendingItems.length, currentSlide]);

  useEffect(() => {
    if (trendingItems.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => {
        const len = trendingItems.length;
        if (len === 0) return 0;
        const next = prev + 1;
        if (next >= len * 6) {
          return len * 3;
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [trendingItems.length]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const fetchJson = async (url: string) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return [];
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) return [];
            return await res.json();
          } catch (e: any) {
            console.error("fetchJson error for", url, e);
            return [];
          }
        };

        const [projectsData, recommendedData, regionData, allIdeasData] = await Promise.all([
          fetchJson(`/api/projects${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`),
          fetchJson(`/api/ideas/recommended${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`),
          user ? fetchJson(`/api/ideas/region_recommended?user_id=${encodeURIComponent(user.id)}`) : Promise.resolve([]),
          fetchJson(`/api/ideas${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`)
        ]);

        const filterVisible = (item: any) => {
          if (item.status && item.status !== 'active') return false;
          if (!item.is_private) return true;
          if (user && item.author_id === user.id) return true;
          try {
            const permitted = JSON.parse(item.permitted_users || '[]');
            if (user && permitted.includes(user.id)) return true;
          } catch (e) {}
          return false;
        };

        const projectsWithType = (Array.isArray(projectsData) ? projectsData : []).filter(filterVisible).map((item: any) => ({ ...item, type: 'project' }));
        const recommendedVisible = (Array.isArray(recommendedData) ? recommendedData : []).filter(filterVisible);
        const ideasWithType = (Array.isArray(allIdeasData) ? allIdeasData : []).filter(filterVisible).map((item: any) => ({ ...item, type: 'idea' }));
        
        setItems(projectsWithType);
        setRecommendedItems(recommendedVisible);
        const regionVisible = (Array.isArray(regionData) ? regionData : []).filter(filterVisible);
        setRegionItems(regionVisible);
        const rawRecruitmentItems = [
          ...ideasWithType.filter((item: Idea) => Number(item.is_recruitment) === 1 && Number(item.is_private) !== 1),
          ...projectsWithType.filter((item: Idea) => Number(item.is_recruitment) === 1 && Number(item.is_private) !== 1)
        ];
        
        rawRecruitmentItems.sort((a, b) => {
          const aTime = new Date((a.created_at || '') + (!(a.created_at || '').includes('Z') ? 'Z' : '')).getTime();
          const bTime = new Date((b.created_at || '') + (!(b.created_at || '').includes('Z') ? 'Z' : '')).getTime();
          return bTime - aTime;
        });

        setRecruitmentItems(rawRecruitmentItems);

        const rawOfferItems = projectsWithType.filter((item: Idea) => Number(item.is_recruitment) === 1 && Number(item.is_private) === 1);
        rawOfferItems.sort((a, b) => new Date((b.created_at || '') + (!(b.created_at || '').includes('Z') ? 'Z' : '')).getTime() - new Date((a.created_at || '') + (!(a.created_at || '').includes('Z') ? 'Z' : '')).getTime());
        setOfferItems(rawOfferItems);

        const rawBuyoutProjects = projectsWithType.filter((item: Idea) => Number(item.is_buyout) === 1);
        const rawBuyoutItems = [...rawBuyoutProjects];
        rawBuyoutItems.sort((a, b) => new Date((b.created_at || '') + (!(b.created_at || '').includes('Z') ? 'Z' : '')).getTime() - new Date((a.created_at || '') + (!(a.created_at || '').includes('Z') ? 'Z' : '')).getTime());
        setBuyoutItems(rawBuyoutItems);
      } catch (err) {
        console.error("Failed to fetch vision items:", err);
      }
    };

    fetchItems();
  }, [user]);

  const paginate = (newDirection: number) => {
    if (!isTransitioning) setIsTransitioning(true);
    setDirection(newDirection);
    setCurrentSlide(prev => prev + newDirection);
  };

  return (
    <div className="w-full bg-[#F8FAFC] dark:bg-[#020617] min-h-screen pb-20">
      {/* Hero Slider Section */}
      {trendingItems.length > 0 && (() => {
        return (
          <div 
            className="relative w-full h-[22vh] min-h-[190px] md:h-[28vh] md:min-h-[240px] xl:h-[34vh] xl:min-h-[280px] overflow-hidden group pt-2 md:pt-3"
            onTouchStart={(e) => setHeroTouchStart(e.targetTouches[0].clientX)}
            onTouchEnd={(e) => {
              if (!heroTouchStart) return;
              const touchEnd = e.changedTouches[0].clientX;
              const diff = heroTouchStart - touchEnd;
              if (Math.abs(diff) > 50) {
                paginate(diff > 0 ? 1 : -1);
              }
              setHeroTouchStart(null);
            }}
          >
            <div 
              className={`w-full h-full flex ${isTransitioning ? 'transition-transform duration-700 ease-out' : 'transition-none'}`}
              style={{ transform: `translateX(calc(-${currentSlide * 80}% + 10%))` }}
            >
              {displayTrendingItems.map((slideItem, idx) => {
                const slideWithin24h = (slideItem.latest_idea_at && (new Date().getTime() - new Date((slideItem.latest_idea_at || '') + (!(slideItem.latest_idea_at || '').includes('Z') ? 'Z' : '')).getTime() < 24 * 60 * 60 * 1000)) || (slideItem.created_at && (new Date().getTime() - new Date((slideItem.created_at || '') + (!(slideItem.created_at || '').includes('Z') ? 'Z' : '')).getTime() < 24 * 60 * 60 * 1000));
                const slideUrl = slideItem.type === 'project' && (slideItem.status === 'completed' || Number(slideItem.is_buyout) === 1) ? `/completed/${slideItem.id}` : `/${slideItem.type}/${slideItem.id}`;
                const isActive = currentSlide === idx;

                return (
                  <div 
                    key={idx}
                    className={`w-[80%] h-full shrink-0 px-0.5 md:px-1 ${isTransitioning ? 'transition-all duration-700 ease-out' : 'transition-none'}`}
                    style={{
                      opacity: isActive ? 1 : 0.4,
                      transform: isActive ? 'scale(1)' : 'scale(0.95)'
                    }}
                  >
                    <div className="relative w-full h-full rounded-md md:rounded-xl overflow-hidden shadow-2xl bg-slate-900 flex items-center justify-center">
                      <img 
                        src={slideItem.image || undefined} 
                        alt={slideItem.title} 
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-40'}`}
                        referrerPolicy="no-referrer"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`}></div>
                      <div className={`absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`}></div>
                      
                      <div className={`absolute inset-0 flex flex-col justify-end p-3 pb-8 md:p-6 md:pb-10 xl:p-8 xl:pb-12 z-20 transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="px-2 py-0.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-md border bg-blue-500/20 text-blue-400 border-blue-500/30">
                            {language === 'ja' ? 'トレンド' : 'Trending'}
                          </span>
                          {Number(slideItem.is_buyout) === 1 ? (
                            <span className="px-2 py-0.5 text-[10px] md:text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-full border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                              {language === 'ja' ? 'バイアウト' : 'Buyout'}
                            </span>
                          ) : Number(slideItem.is_recruitment) === 1 ? (
                            <span className="px-2 py-0.5 text-[10px] md:text-xs font-bold text-white bg-gradient-to-r from-red-600 to-red-500 rounded-full border border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                              {Number(slideItem.is_private) === 1 ? 'Offer' : 'Recruitment'}
                            </span>
                          ) : null}
                          {slideWithin24h && (
                            <span className="px-2 py-0.5 text-[10px] md:text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-violet-500 rounded-md border border-pink-400/30 shadow-[0_0_15px_rgba(236,72,153,0.3)] animate-pulse">
                              {language === 'ja' ? '新しいアイデアあり' : 'New Idea Inside'}
                            </span>
                          )}
                          {slideItem.stage ? (
                            <span className="px-2 py-0.5 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-md border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
                              {STAGES[Math.max(1, Math.min(6, slideItem.stage)) - 1]}
                            </span>
                          ) : null}
                          <Link to={`/profile/${slideItem.author_id}`} className="text-slate-400 text-[10px] md:text-xs font-medium flex items-center gap-1.5 hover:text-white transition-colors pointer-events-auto">
                            <img src={slideItem.author_avatar || undefined} alt="" className={`w-4 h-4 rounded-full object-cover ${getAccountTypeBorderClass(slideItem.author_account_type || slideItem.account_type, 'border')}`} />
                            {slideItem.author_name}
                          </Link>
                        </div>
                        
                        <Link to={slideUrl} className="block group/title w-fit pointer-events-auto">
                          <h1 className={`text-lg md:text-2xl lg:text-3xl font-bold text-white mb-1 leading-tight tracking-tight group-hover/title:text-blue-400 transition-colors flex items-center gap-2 md:gap-3 ${slideWithin24h ? 'drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]' : ''}`}>
                            {slideItem.is_private ? <Lock className="w-5 h-5 md:w-7 md:h-7 shrink-0 text-slate-300" /> : null}
                            <span className="line-clamp-1">{slideItem.title}</span>
                          </h1>
                        </Link>
                        
                        <p className="text-xs md:text-sm lg:text-base text-slate-300 mb-0 max-w-2xl line-clamp-1 leading-relaxed">
                          {slideItem.description.replace(/<[^>]*>/g, '')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation Triangles */}
            <button
              onClick={() => paginate(-1)}
              className="absolute left-1 md:left-4 top-1/2 -translate-y-1/2 z-30 p-2 md:p-4 text-white/40 hover:text-white transition-all hover:scale-110 focus:outline-none"
            >
              <Triangle className="-rotate-90 fill-current w-8 h-8 md:w-12 md:h-12 drop-shadow-xl" />
            </button>
            <button
              onClick={() => paginate(1)}
              className="absolute right-1 md:right-4 top-1/2 -translate-y-1/2 z-30 p-2 md:p-4 text-white/40 hover:text-white transition-all hover:scale-110 focus:outline-none"
            >
              <Triangle className="rotate-90 fill-current w-8 h-8 md:w-12 md:h-12 drop-shadow-xl" />
            </button>

            {/* Slide Indicators */}
            <div className="absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 z-30 flex gap-2 md:gap-3">
              {trendingItems.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (!isTransitioning) setIsTransitioning(true);
                    const targetIdx = Math.floor(currentSlide / trendingItems.length) * trendingItems.length + idx;
                    setDirection(targetIdx > currentSlide ? 1 : -1);
                    setCurrentSlide(targetIdx);
                  }}
                  className={`transition-all duration-300 h-1.5 rounded-full relative overflow-hidden ${idx === (currentSlide % trendingItems.length) ? 'w-8 md:w-12 bg-white' : 'w-2 md:w-3 bg-white/30 hover:bg-white/50'}`}
                >
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Vision Rows */}
      <div className="relative z-10 px-4 md:px-8 lg:px-12 pt-3 sm:pt-4 space-y-4 sm:space-y-5 md:space-y-6">
        {recommendedItems.length > 0 && (
          <IdeaRow 
            title={user ? (language === 'ja' ? "あなたへのおすすめ" : "Recommended for You") : (language === 'ja' ? "人気" : "Popular")} 
            items={recommendedItems} 
            icon={<Sparkles className="w-5 h-5 text-yellow-500" />}
            onQuoteClick={(item) => setActiveQuotesItem(item)}
          />
        )}
        {latestVisions.length > 0 && (
          <IdeaRow 
            title={language === 'ja' ? "最新Vision" : "Latest Vision"} 
            items={latestVisions} 
            icon={<Sparkles className="w-5 h-5 text-blue-500" />}
            onQuoteClick={(item) => setActiveQuotesItem(item)}
          />
        )}
        {latestIdeas.length > 0 && (
          <IdeaRow 
            title={language === 'ja' ? "最新Idea" : "Latest Idea"} 
            items={latestIdeas} 
            icon={<Lightbulb className="w-5 h-5 text-purple-500" />}
            onQuoteClick={(item) => setActiveQuotesItem(item)}
          />
        )}
        {regionItems.length > 0 && (
          <IdeaRow 
            title={language === 'ja' ? "地域内でのおすすめ" : "Recommendations in your region"}
            items={regionItems}
            icon={<Sparkles className="w-5 h-5 text-indigo-500" />}
            onQuoteClick={(item) => setActiveQuotesItem(item)}
          />
        )}
        <IdeaRow 
          title={language === 'ja' ? "Project" : "Project"} 
          items={recruitmentItems} 
          icon={<Users className="w-5 h-5 text-emerald-500" />}
          onQuoteClick={(item) => setActiveQuotesItem(item)}
        />
        {offerItems.length > 0 && (
          <IdeaRow 
            title={language === 'ja' ? "Proposal" : "Proposal"} 
            items={offerItems} 
            icon={<Briefcase className="w-5 h-5 text-pink-500" />}
            onQuoteClick={(item) => setActiveQuotesItem(item)}
          />
        )}
        {buyoutItems.length > 0 && (
          <IdeaRow 
            title={language === 'ja' ? "バイアウト" : "Buyout"} 
            items={buyoutItems} 
            icon={<ShoppingCart className="w-5 h-5 text-emerald-600" />}
            onQuoteClick={(item) => setActiveQuotesItem(item)}
          />
        )}
        <IdeaRow 
          title={language === 'ja' ? "テクノロジーとイノベーション" : "Technology & Innovation"} 
          items={items.slice().reverse()}
          onQuoteClick={(item) => setActiveQuotesItem(item)}
        />
        <IdeaRow 
          title={language === 'ja' ? "デザインとクリエイティビティ" : "Design & Creativity"} 
          items={items.slice(1).concat(items.slice(0, 1))} 
          onQuoteClick={(item) => setActiveQuotesItem(item)}
        />
      </div>

      {/* Floating Create Button */}
      <button
        onClick={() => navigate('/create')}
        className="fixed bottom-20 right-6 md:bottom-24 md:right-10 z-40 w-14 h-14 md:w-16 md:h-16 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-blue-600/40 transition-transform duration-300 hover:scale-110 active:scale-95 focus:outline-none"
        title={language === 'ja' ? '投稿する' : 'Post'}
      >
        <Plus className="w-8 h-8 md:w-9 md:h-9" />
      </button>

      {activeQuotesItem && (
        <IdeaQuotesModal 
          item={activeQuotesItem} 
          onClose={() => setActiveQuotesItem(null)} 
        />
      )}
    </div>
  );
}
