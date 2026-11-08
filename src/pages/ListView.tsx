import useVisionRevision from '../components/vision/useVisionRevision';
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Heart, MessageSquare, Bookmark, Users, Lightbulb, Lock, Plus, ShoppingCart, Sparkles, Briefcase, Flame, User as UserIcon, Building2, Landmark } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import OfferSearchModal from '../components/OfferSearchModal';
import BuyoutPostModal from '../components/BuyoutPostModal';
import { safeFetchJson } from '../lib/api';
import IdeaRow from '../components/IdeaRow';
import IdeaQuotesModal from '../components/IdeaQuotesModal';
import HashtagDisplay from '../components/HashtagDisplay';
import AccountTypeBadge from '../components/AccountTypeBadge';
import { getAccountTypeBorderClass } from '../utils/avatar';

export default function ListView({ mode }: { mode?: string } = {}) {
  const location = useLocation();
  const revision=useVisionRevision();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, language, unreadRecruitmentCount, refreshUnreadRecruitmentCount } = useAppContext();

  const state = location.state as { title?: string, items?: any[] };
  const typeParam = mode || searchParams.get('type');

  const [items, setItems] = useState<any[]>(state?.items || []);
  const [loading, setLoading] = useState(!state?.items);
  const [title, setTitle] = useState<string>(state?.title || '');
  const [showOfferSearch, setShowOfferSearch] = useState(false);

  const [activeBuyoutTab, setActiveBuyoutTab] = useState<'fixed' | 'auction'>('fixed');
  const [showBuyoutPost, setShowBuyoutPost] = useState(false);
  const [activeQuotesItem, setActiveQuotesItem] = useState<{ id: number; type: 'project' | 'idea' } | null>(null);

  const [showMyEmas, setShowMyEmas] = useState(false);
  const [myEmas, setMyEmas] = useState<any[]>([]);
  const [loadingMyEmas, setLoadingMyEmas] = useState(false);

  const fetchMyEmas = async () => {
    if (!user) return;
    setLoadingMyEmas(true);
    try {
      const data = await safeFetchJson(`/api/users/${user.id}/recruitment_my_emas`);
      setMyEmas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch my recruitment visions:', e);
    } finally {
      setLoadingMyEmas(false);
    }
  };

  useEffect(() => {
    if (user && typeParam === 'recruitment') {
      fetchMyEmas();
      refreshUnreadRecruitmentCount();
    }
  }, [user, typeParam]);

  const [recruitmentSections, setRecruitmentSections] = useState<{
    recommended: any[];
    region: any[];
    newItems: any[];
    popular: any[];
    offers: any[];
    tech: any[];
    design: any[];
  }>({
    recommended: [],
    region: [],
    newItems: [],
    popular: [],
    offers: [],
    tech: [],
    design: []
  });

  useEffect(() => {
    if (location.state?.openOfferSearch) {
      setShowOfferSearch(true);
      // Clean up the state so it doesn't reopen if refreshed
      navigate(location.pathname + location.search, { replace: true, state: { ...location.state, openOfferSearch: false } });
    }
  }, [location.state, navigate, location.pathname, location.search]);

  const qParam = searchParams.get('q');

  useEffect(() => {
    if (!state?.items) {
      const fetchData = async () => {
        setLoading(true);
        try {
          // Default labels based on language and type.
          if (qParam) {
             setTitle(language === 'ja' ? `「${qParam}」の検索結果` : `Search results for "${qParam}"`);
          } else if (typeParam === 'recruitment') {
             setTitle(language === 'ja' ? 'Project' : 'Project');
          } else if (typeParam === 'project-hub') {
             setTitle('Project');
          } else if (typeParam === 'offer') {
             setTitle(language === 'ja' ? 'Proposal' : 'Proposal');
          } else if (typeParam === 'buyout') {
             setTitle(language === 'ja' ? 'バイアウト' : 'Buyout');
          } else {
             setTitle(language === 'ja' ? '一覧' : 'List');
          }

          const [projectsData, allIdeasData, buyoutsData, recommendedData, regionData] = await Promise.all([
            safeFetchJson(`/api/projects${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`),
            safeFetchJson(`/api/ideas${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`),
            typeParam === 'buyout' ? safeFetchJson('/api/buyouts') : Promise.resolve([]),
            typeParam === 'recruitment' ? safeFetchJson(`/api/ideas/recommended${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`) : Promise.resolve([]),
            typeParam === 'recruitment' && user ? safeFetchJson(`/api/ideas/region_recommended?user_id=${encodeURIComponent(user.id)}`) : Promise.resolve([])
          ]);

          const filterVisible = (item: any) => {
            if (!item.is_private) return true;
            if (user && item.author_id === user.id) return true;
            if (user && item.permitted_users) {
              try {
                const permittedUrls = JSON.parse(item.permitted_users);
                if (Array.isArray(permittedUrls) && permittedUrls.includes(user.id)) return true;
              } catch (e) {
                if (typeof item.permitted_users === 'object' && Object.keys(item.permitted_users).includes(user.id.toString())) return true;
              }
            }
            return false;
          };

          const projectsWithType = (Array.isArray(projectsData) ? projectsData : []).filter(filterVisible).map((item: any) => ({ ...item, type: 'project' }));
          const ideasWithType = (Array.isArray(allIdeasData) ? allIdeasData : []).filter(filterVisible).map((item: any) => ({ ...item, type: 'idea' }));

          if (typeParam === 'recruitment') {
            const rawRecruitmentItems = [
              ...ideasWithType.filter((item: any) => Number(item.is_recruitment) === 1 && Number(item.is_private) !== 1),
              ...projectsWithType.filter((item: any) => Number(item.is_recruitment) === 1 && Number(item.is_private) !== 1)
            ];

            // New items: sorted by created_at DESC
            const newRecruitmentItems = [...rawRecruitmentItems].sort((a, b) => {
              const aTime = new Date((a.created_at || '') + (!(a.created_at || '').includes('Z') ? 'Z' : '')).getTime();
              const bTime = new Date((b.created_at || '') + (!(b.created_at || '').includes('Z') ? 'Z' : '')).getTime();
              return bTime - aTime;
            });

            // Popular items: sorted by engagement DESC
            const popularRecruitmentItems = [...rawRecruitmentItems].sort((a, b) => {
              const scoreA = (a.likes_count || 0) * 2 + (a.comments_count || 0) * 2 + (a.quotes_count || 0) * 3 + (a.follows_count || 0);
              const scoreB = (b.likes_count || 0) * 2 + (b.comments_count || 0) * 2 + (b.quotes_count || 0) * 3 + (b.follows_count || 0);
              return scoreB - scoreA;
            });

            // Recommended items
            const recRaw = (Array.isArray(recommendedData) ? recommendedData : []).filter(filterVisible).filter((item: any) => Number(item.is_recruitment) === 1);
            const recMap = new Map();
            recRaw.forEach((item: any) => recMap.set(`${item.type}-${item.id}`, item));

            // Fill recommended if short
            popularRecruitmentItems.forEach((item: any) => {
              if (recMap.size < 6 && !recMap.has(`${item.type}-${item.id}`)) {
                recMap.set(`${item.type}-${item.id}`, item);
              }
            });
            const recommendedRecruitment = Array.from(recMap.values());

            // Region items
            const regionRecruitment = (Array.isArray(regionData) ? regionData : []).filter(filterVisible).filter((item: any) => Number(item.is_recruitment) === 1);

            // Offers (private recruitment)
            const offerRecruitment = [
              ...ideasWithType.filter((item: any) => Number(item.is_recruitment) === 1 && Number(item.is_private) === 1),
              ...projectsWithType.filter((item: any) => Number(item.is_recruitment) === 1 && Number(item.is_private) === 1)
            ];

            // Tech and Design categories
            const techItems = rawRecruitmentItems.filter((i: any) => {
              const str = `${i.title} ${i.description} ${i.tags || ''}`.toLowerCase();
              return str.includes('tech') || str.includes('テック') || str.includes('ai') || str.includes('アプリ') || str.includes('システム') || str.includes('web');
            });
            const designItems = rawRecruitmentItems.filter((i: any) => {
              const str = `${i.title} ${i.description} ${i.tags || ''}`.toLowerCase();
              return str.includes('design') || str.includes('デザイン') || str.includes('アート') || str.includes('クリエイティブ') || str.includes('画面');
            });

            setRecruitmentSections({
              recommended: recommendedRecruitment,
              region: regionRecruitment,
              newItems: newRecruitmentItems,
              popular: popularRecruitmentItems,
              offers: offerRecruitment,
              tech: techItems.length > 0 ? techItems : rawRecruitmentItems.slice().reverse(),
              design: designItems.length > 0 ? designItems : rawRecruitmentItems.slice(1).concat(rawRecruitmentItems.slice(0, 1))
            });

            setItems(rawRecruitmentItems);
          } else if (typeParam === 'offer') {
            setItems([...projectsWithType, ...ideasWithType].filter(item => Number(item.is_recruitment) === 1 && Number(item.is_private) === 1));
          } else if (typeParam === 'project-hub') {
            setItems([...projectsWithType, ...ideasWithType].filter(item => Number(item.is_recruitment) === 1));
          } else if (typeParam === 'buyout') {
             const rawBuyoutProjects = projectsWithType.filter((item: any) => Number(item.is_buyout) === 1);
             let allBuyouts = [...rawBuyoutProjects, ...ideasWithType.filter(item => Number(item.is_buyout) === 1)];
             allBuyouts = allBuyouts.map(item => {
               const buyoutInfo = buyoutsData.find((b: any) => Number(b.item_id) === Number(item.id) && b.item_type === item.type);
               return { ...item, buyoutInfo };
             }).filter(item => item.buyoutInfo);
             allBuyouts.sort((a, b) => new Date((b.created_at || '') + (!(b.created_at || '').includes('Z') ? 'Z' : '')).getTime() - new Date((a.created_at || '') + (!(a.created_at || '').includes('Z') ? 'Z' : '')).getTime());
             setItems(allBuyouts);
          } else {
             const allCombined = [...ideasWithType, ...projectsWithType];
             if (qParam) {
               const queryLower = qParam.toLowerCase();
               const filtered = allCombined.filter((item: any) => {
                 const text = `${item.title || ''} ${item.description || ''} ${item.author_name || ''} ${item.tags || ''}`.toLowerCase();
                 return text.includes(queryLower);
               });
               setItems(filtered);
             } else {
               setItems(allCombined);
             }
          }
        } catch (err) {
          console.error("Failed to fetch data:", err);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [state?.items, typeParam, qParam, user, language,revision]);

  const [accountFilter, setAccountFilter] = useState<'all' | 'individual' | 'corporate' | 'municipality'>('all');

  const filteredItems = items.filter((item: any) => {
    if (typeParam === 'buyout' && item.buyoutInfo?.buyout_type !== activeBuyoutTab) {
      return false;
    }
    if (accountFilter !== 'all') {
      const accType = item.author_account_type || item.account_type || 'individual';
      if (accountFilter === 'individual' && (accType === 'municipality' || accType === 'corporate' || accType === 'organization')) return false;
      if (accountFilter === 'corporate' && (accType !== 'corporate' && accType !== 'organization')) return false;
      if (accountFilter === 'municipality' && accType !== 'municipality') return false;
    }
    return true;
  });

  if (loading) {
    return <div className="p-8 text-slate-900  min-h-[50vh] flex justify-center items-center">Loading...</div>;
  }

  // Home-like categorized view for Recruitment page
  if (typeParam === 'recruitment' && !state?.items) {
    return (
      <div className="w-full bg-[#F8FAFC]  min-h-screen pb-20 text-slate-900 ">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 pt-3 md:pt-4">
          <div className="flex items-center justify-between mb-4 md:mb-5">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900   transition-colors cursor-pointer">
              <ChevronLeft className="w-6 h-6" />
              <span className="text-xl md:text-2xl font-bold text-slate-900 ">{language === 'ja' ? '戻る' : 'Back'}</span>
            </button>

            {user && (
              <button
                onClick={() => {
                  const nextShow = !showMyEmas;
                  setShowMyEmas(nextShow);
                  if (nextShow) fetchMyEmas();
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm shadow-md transition-all hover:scale-105 relative border cursor-pointer ${showMyEmas ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-white  border-slate-200  text-slate-700  hover:text-slate-900  shadow-sm'}`}
              >
                <span>Project</span>
                {(user?.account_type === 'organization' || user?.account_type === 'corporate' || user?.account_type === 'municipality') && unreadRecruitmentCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-md animate-pulse">
                    {unreadRecruitmentCount > 99 ? '99+' : unreadRecruitmentCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 space-y-4 sm:space-y-5 md:space-y-6">
          {showMyEmas && user ? (
            <div className="space-y-3">
              <div className="bg-white  p-4 rounded-2xl border border-slate-200  shadow-sm ">
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-slate-900  flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-500 " />
                    {user.account_type === 'organization' || user.account_type === 'corporate' || user.account_type === 'municipality'
                      ? (language === 'ja' ? '投稿したProject Vision' : 'My Project Visions')
                      : (language === 'ja' ? 'Ideaを投稿したProject Vision' : 'Submitted Project Visions')}
                  </h2>
                  <p className="text-xs text-slate-500  mt-0.5">
                    {user.account_type === 'organization' || user.account_type === 'corporate' || user.account_type === 'municipality'
                      ? (language === 'ja' ? '投稿したProject Visionと届いたIdeaの通知数です。' : 'Project Visions you posted and received Idea notification counts.')
                      : (language === 'ja' ? 'あなたがIdeaを投稿したProject Visionの一覧です。' : 'List of Project Visions where you submitted an Idea.')}
                  </p>
                </div>
              </div>

              {loadingMyEmas ? (
                <div className="p-8 text-center text-slate-500 ">Loading...</div>
              ) : myEmas.length === 0 ? (
                <div className="bg-white  border border-slate-200  rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-slate-500  text-sm">
                    {user.account_type === 'organization' || user.account_type === 'corporate' || user.account_type === 'municipality'
                      ? (language === 'ja' ? '投稿したProject Visionはまだありません' : 'No Project Visions posted yet.')
                      : (language === 'ja' ? 'Ideaを投稿したProject Visionはまだありません' : 'No Project Visions submitted to yet.')}
                  </p>
                </div>
              ) : (
                <IdeaRow
                  title={user.account_type === 'organization' || user.account_type === 'corporate' || user.account_type === 'municipality'
                    ? (language === 'ja' ? "投稿済みProject Vision" : "Posted Project Visions")
                    : (language === 'ja' ? "Idea投稿済みProject Vision" : "Submitted Project Visions")}
                  items={myEmas}
                  icon={<Briefcase className="w-5 h-5 text-blue-500 " />}
                  onQuoteClick={(item) => setActiveQuotesItem(item)}
                />
              )}
            </div>
          ) : (
            <>
              {/* 1. Recommended for You */}
              <IdeaRow
                title={user ? (language === 'ja' ? "あなたへのおすすめ" : "Recommended for You") : (language === 'ja' ? "おすすめのProject" : "Recommended Projects")}
                items={recruitmentSections.recommended}
                icon={<Sparkles className="w-5 h-5 md:w-6 md:h-6 text-amber-500 " />}
                onQuoteClick={(item) => setActiveQuotesItem(item)}
              />

          {/* 2. Region Recommendations (if any) */}
          {recruitmentSections.region.length > 0 && (
            <IdeaRow
              title={language === 'ja' ? "地域内のおすすめ" : "Recommendations in Your Region"}
              items={recruitmentSections.region}
              icon={<Sparkles className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 " />}
              onQuoteClick={(item) => setActiveQuotesItem(item)}
            />
          )}

          {/* 3. New Projects */}
          <IdeaRow
            title={language === 'ja' ? "新着のProject" : "New Projects"}
            items={recruitmentSections.newItems}
            icon={<Users className="w-5 h-5 md:w-6 md:h-6 text-emerald-600 " />}
            onQuoteClick={(item) => setActiveQuotesItem(item)}
          />

          {/* 4. Popular Projects */}
          {recruitmentSections.popular.length > 0 && (
            <IdeaRow
              title={language === 'ja' ? "人気のProject" : "Popular Projects"}
              items={recruitmentSections.popular}
              icon={<Flame className="w-5 h-5 md:w-6 md:h-6 text-orange-500 " />}
              onQuoteClick={(item) => setActiveQuotesItem(item)}
            />
          )}

          {/* 5. Proposals (Private Projects) */}
          {recruitmentSections.offers.length > 0 && (
            <IdeaRow
              title={language === 'ja' ? "Proposal" : "Proposals"}
              items={recruitmentSections.offers}
              icon={<Briefcase className="w-5 h-5 md:w-6 md:h-6 text-pink-500 " />}
              onQuoteClick={(item) => setActiveQuotesItem(item)}
            />
          )}

          {/* 6. Technology & Innovation */}
          {recruitmentSections.tech.length > 0 && (
            <IdeaRow
              title={language === 'ja' ? "テクノロジーとイノベーション" : "Technology & Innovation"}
              items={recruitmentSections.tech}
              icon={<Lightbulb className="w-5 h-5 md:w-6 md:h-6 text-blue-600 " />}
              onQuoteClick={(item) => setActiveQuotesItem(item)}
            />
          )}

          {/* 7. Design & Creativity */}
          {recruitmentSections.design.length > 0 && (
            <IdeaRow
              title={language === 'ja' ? "デザインとクリエイティビティ" : "Design & Creativity"}
              items={recruitmentSections.design}
              icon={<Sparkles className="w-5 h-5 md:w-6 md:h-6 text-purple-600 " />}
              onQuoteClick={(item) => setActiveQuotesItem(item)}
            />
          )}
            </>
          )}
        </div>

        {/* Floating Create Button for Recruitment */}
        {(user?.account_type === 'organization' || user?.account_type === 'corporate' || user?.account_type === 'municipality') && !showMyEmas && (
          <button
            onClick={() => navigate('/create?type=recruitment')}
            className="fixed bottom-24 right-6 md:bottom-28 md:right-12 z-[110] w-14 h-14 md:w-16 md:h-16 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-transform hover:scale-110"
            title={language === 'ja' ? 'Projectを作成' : 'Create Project'}
          >
            <Plus className="w-8 h-8" />
          </button>
        )}

        {activeQuotesItem && (
          <IdeaQuotesModal
            item={activeQuotesItem}
            onClose={() => setActiveQuotesItem(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]  text-slate-900 ">
      <div className={mode ? "max-w-7xl mx-auto px-4 pb-8 pt-2" : "max-w-3xl mx-auto p-4 py-8"}>
        {!mode && (
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900   mb-8">
          <ChevronLeft className="w-6 h-6" />
          <span className="text-xl font-bold">{title}</span>
        </button>)}

        {typeParam === 'buyout' && (
          <div className="flex gap-2 mb-8 bg-white  p-1.5 rounded-xl border border-slate-200  shadow-sm">
            <button
              onClick={() => setActiveBuyoutTab('fixed')}
              className={`flex-1 py-2.5 md:py-3 text-sm md:text-base font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeBuyoutTab === 'fixed' ? 'bg-slate-100  text-slate-900  shadow-sm' : 'text-slate-500  hover:text-slate-800  hover:bg-slate-50 '
              }`}
            >
              <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
              {language === 'ja' ? '固定価格方式' : 'Fixed Price'}
            </button>
            <button
              onClick={() => setActiveBuyoutTab('auction')}
              className={`flex-1 py-2.5 md:py-3 text-sm md:text-base font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeBuyoutTab === 'auction' ? 'bg-slate-100  text-slate-900  shadow-sm' : 'text-slate-500  hover:text-slate-800  hover:bg-slate-50 '
              }`}
            >
              <Lightbulb className="w-4 h-4 md:w-5 md:h-5" />
              {language === 'ja' ? 'オークション方式' : 'Auction'}
            </button>
          </div>
        )}

        {/* Account Type Filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-bold text-slate-600  shrink-0">絞り込み:</span>
          {[
            { id: 'all', label: 'すべて', icon: null },
            { id: 'individual', label: '個人', icon: UserIcon },
            { id: 'corporate', label: '法人', icon: Building2 },
            { id: 'municipality', label: '自治体', icon: Landmark }
          ].map((acc) => {
            const Icon = acc.icon;
            const isActive = accountFilter === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setAccountFilter(acc.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 border ${
                  isActive
                    ? acc.id === 'municipality'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : acc.id === 'corporate'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : acc.id === 'individual'
                      ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                      : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white  text-slate-600  border-slate-200  hover:bg-slate-50 '
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{acc.label}</span>
              </button>
            );
          })}
        </div>

        {(!filteredItems || filteredItems.length === 0) ? (
          <div className="p-8 text-center text-slate-500  border border-slate-200  rounded-2xl bg-white  shadow-sm">
            {language === 'ja' ? 'データがありません' : 'No data available'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {filteredItems.map((item: any) => {
              const targetUrl = item.type === 'project' && (item.status === 'completed' || Number(item.is_buyout) === 1) ? `/completed/${item.id}` : `/${item.type}/${item.id}`;
              const isNewIdeaWithin24h = item.type === 'idea' && item.created_at && (new Date().getTime() - new Date((item.created_at || '') + (!(item.created_at || '').includes('Z') ? 'Z' : '')).getTime() < 24 * 60 * 60 * 1000);

              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={targetUrl}
                  state={{section:typeParam==='buyout'?'store':mode?'project':location.state?.section}}
                  className="block bg-white  border border-slate-200  hover:border-blue-400  rounded-2xl overflow-hidden group shadow-sm hover:shadow-md  transition-all hover:scale-[1.01] flex flex-col"
                >
                  <div className="relative aspect-[16/10] bg-slate-100  overflow-hidden">
                    <img
                      src={item.image || undefined}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white/20  via-black/20 to-transparent opacity-80"></div>

                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-blue-600/80  backdrop-blur-md border border-blue-400/40  text-white  text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-md">
                        {Number(item.is_recruitment) === 1 ? 'Project' : item.type === 'project' ? 'Vision' : 'Idea'}
                      </span>
                      {item.status === 'completed' && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold shadow-md">
                          RELEASED
                        </span>
                      )}
                      {Number(item.is_buyout) === 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold shadow-md">
                          {language === 'ja' ? 'バイアウト' : 'Buyout'}
                        </span>
                      )}
                      {Number(item.is_recruitment) === 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold shadow-md">
                          {Number(item.is_private) === 1 ? 'Offer' : 'Recruitment'}
                        </span>
                      )}
                    </div>

                    {isNewIdeaWithin24h && (
                      <div className="absolute top-2 right-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md">
                        New
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between gap-2">
                    <div>
                      <h3 className="text-slate-900  font-bold text-xs sm:text-sm md:text-base leading-snug line-clamp-1 group-hover:text-blue-600  transition-colors mb-1">
                        {item.title}
                      </h3>

                      {(item.completed_tags || item.tags) && (
                        <div className="mb-1">
                          <HashtagDisplay tags={item.completed_tags || item.tags || ''} />
                        </div>
                      )}

                      {typeParam === 'buyout' && item.buyoutInfo && (
                        <div className="mt-1 text-[11px] space-y-1">
                          <div className="font-bold text-emerald-600  bg-emerald-50  inline-block px-2 py-0.5 rounded-full border border-emerald-200 ">
                            {item.buyoutInfo.applications_count || 0} {language === 'ja' ? '名参加' : 'participants'}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100  flex flex-col items-stretch gap-2 text-[11px] text-slate-500 ">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${item.author_id}`);
                        }}
                        className="flex items-center gap-1.5 hover:text-slate-900  transition-colors cursor-pointer min-w-0 max-w-full"
                      >
                        <img
                          src={item.author_avatar || undefined}
                          alt=""
                          className={`w-5 h-5 rounded-full ${getAccountTypeBorderClass(item.author_account_type, 'border-2')} object-cover shrink-0`}
                        />
                        <span className="font-semibold truncate text-[11px]">{item.author_name}</span>
                        <AccountTypeBadge accountType={item.author_account_type} size="xs" />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px]">
                        <span className="flex items-center gap-0.5 hover:text-pink-500 transition-colors" title="Likes">
                          <Heart className="w-3.5 h-3.5 text-pink-500" />
                          <span className="font-medium text-slate-700 ">{item.likes_count || 0}</span>
                        </span>
                        <span className="flex items-center gap-0.5 hover:text-blue-600  transition-colors" title="Comments">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-500 " />
                          <span className="font-medium text-slate-700 ">{item.comments_count || 0}</span>
                        </span>
                        <span className="flex items-center gap-1 hover:text-emerald-500 transition-colors" title="Archives">
                          <Bookmark className="w-4 h-4 text-emerald-500" />
                          <span className="font-medium text-slate-700 ">{item.archives_count || 0}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Create Button for Buyouts */}
      {typeParam === 'buyout' && (
        <button
          onClick={() => setShowBuyoutPost(true)}
          className="fixed bottom-24 right-6 md:bottom-28 md:right-12 z-[110] w-14 h-14 md:w-16 md:h-16 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-transform hover:scale-110"
          title={language === 'ja' ? 'バイアウトに投稿' : 'Post to Buyout'}
        >
          <Plus className="w-8 h-8" />
        </button>
      )}

      {/* Floating Create Button for Offers */}
      {typeParam === 'offer' && (user?.account_type === 'individual' || !user?.account_type) && (
        <button
          onClick={() => setShowOfferSearch(true)}
          className="fixed bottom-24 right-6 md:bottom-28 md:right-12 z-[110] w-14 h-14 md:w-16 md:h-16 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-transform hover:scale-110"
          title={language === 'ja' ? 'Proposalを作成' : 'Create Proposal'}
        >
          <Plus className="w-8 h-8" />
        </button>
      )}

      {/* Floating Create Button for Recruitment */}
      {typeParam === 'recruitment' && (user?.account_type === 'organization' || user?.account_type === 'corporate' || user?.account_type === 'municipality') && (
        <button
          onClick={() => navigate('/create?type=recruitment')}
          className="fixed bottom-24 right-6 md:bottom-28 md:right-12 z-[110] w-14 h-14 md:w-16 md:h-16 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-transform hover:scale-110"
          title={language === 'ja' ? 'Projectを作成' : 'Create Project'}
        >
          <Plus className="w-8 h-8" />
        </button>
      )}

      {showOfferSearch && (
        <OfferSearchModal
          onClose={() => setShowOfferSearch(false)}
          onNext={(selectedIds) => {
            setShowOfferSearch(false);
            navigate(`/create?type=offer&permitted_users=${selectedIds.join(',')}`);
          }}
          initialSearch={location.state?.search}
          initialSearchIndustries={location.state?.searchIndustries}
          initialSelectedIds={location.state?.selectedIds}
        />
      )}

      {showBuyoutPost && (
        <BuyoutPostModal
          onClose={() => setShowBuyoutPost(false)}
          onPost={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
