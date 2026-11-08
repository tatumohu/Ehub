import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Heart, Plus, X, Search, Filter } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { projectCache } from '../projectCache';
import { safeFetchJson } from '../lib/api';
import HashtagDisplay from '../components/HashtagDisplay';
import Cart from './Cart';
import PurchaseHistory from './PurchaseHistory';
import { getAccountTypeBorderClass } from '../utils/avatar';

type Project = {
  id: number;
  title: string;
  description: string;
  image: string;
  images?: string;
  author_name: string;
  author_avatar: string;
  author_account_type?: string;
  account_type?: string;
  likes_count?: number;
  views_count?: number;
  archives_count?: number;
  follows_count?: number;
  tags?: string;
  completed_tags?: string;
  created_at?: string;
  funding_goal?: number;
  funding_current?: number;
  funding_tiers?: string;
};

const industriesEn = [
  "Agriculture & Forestry", "Fisheries", "Mining", "Construction", 
  "Food & Beverage", "Textiles", "Pulp & Paper", "Chemicals",
  "Pharmaceuticals", "Oil & Coal", "Rubber & Glass", "Steel",
  "Non-ferrous Metals", "Metal Products", "Machinery", "Electric Appliances",
  "Transportation Equipment", "Precision Instruments", "Other Products",
  "Electric & Gas Utilities", "Land Transportation", "Marine Transportation",
  "Air Transportation", "Warehousing", "Information & Communication",
  "Wholesale Trade", "Retail Trade", "Banks", "Securities & Commodities",
  "Insurance", "Other Financials", "Real Estate", "Services"
];

const industriesJa = [
  "農林水産業", "水産業", "鉱業", "建設業",
  "食料品", "繊維製品", "パルプ・紙", "化学",
  "医薬品", "石油・石炭製品", "ゴム・ガラス", "鉄鋼",
  "非鉄金属", "金属製品", "機械", "電気機器",
  "輸送用機器", "精密機器", "その他製品",
  "電気・ガス業", "陸運業", "海運業",
  "空運業", "倉庫・運輸関連", "情報通信業",
  "卸売業", "小売業", "銀行業", "証券・商品",
  "保険業", "その他金融業", "不動産業", "サービス業"
];

const TABS = [
  { id: 'new', labelEn: 'New', labelJa: '新着' },
  { id: 'ranking', labelEn: 'Ranking', labelJa: 'ランキング' },
  { id: 'category', labelEn: 'Category', labelJa: 'カテゴリー' },
  { id: 'purchase', labelEn: 'Purchase History', labelJa: '購入履歴' },
  { id: 'cart', labelEn: 'Cart', labelJa: 'カート' }
];

const ADS = [
  ["Ad Campaign A1", "Ad Campaign A2", "Ad Campaign A3"],
  ["Ad Campaign B1", "Ad Campaign B2", "Ad Campaign B3"],
  ["Ad Campaign C1", "Ad Campaign C2", "Ad Campaign C3"]
];

export default function CompletedProjects() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get('tab') as 'default' | 'new' | 'ranking' | 'category' | 'category_results' | 'purchase' | 'cart' | null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [showSelectEMA, setShowSelectEMA] = useState(false);
  const [myEMAs, setMyEMAs] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<'default' | 'new' | 'ranking' | 'category' | 'category_results' | 'purchase' | 'cart'>(tabFromUrl || 'default');
  
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    } else {
      setActiveTab('default');
    }
  }, [tabFromUrl]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as any);
    if (tabId === 'default') {
      navigate('/store');
    } else {
      navigate(`/store?tab=${tabId}`);
    }
  };
  
  const [adIndex, setAdIndex] = useState(0);

  // Category Search State
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);

  const navigate = useNavigate();
  const { user, language } = useAppContext();

  useEffect(() => {
    safeFetchJson(`/api/completed${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`, undefined, [])
      .then(data => {
        if (Array.isArray(data)) {
          setProjects(data);
          data.forEach((p: any) => projectCache.set(p.id, p));
        }
      });
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setAdIndex(prev => (prev + 1) % ADS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);
  
  const handleOpenSelect = () => {
    if (!user) return;
    safeFetchJson(`/api/users/${user.id}/projects`, undefined, [])
      .then(data => {
        if (Array.isArray(data)) {
          setMyEMAs(data.filter((p: any) => p.status !== 'completed'));
          setShowSelectEMA(true);
        }
      });
  };

  const currentAds = ADS[adIndex];
  const industries = language === 'ja' ? industriesJa : industriesEn;

  // Compute stats
  const getScore = (p: Project) => (p.views_count || 0) + (p.likes_count || 0);
  
  const top3 = [...projects].sort((a,b) => getScore(b) - getScore(a)).slice(0, 3);
  
  let displayedProjects = [...projects];
  if (activeTab === 'new') {
    displayedProjects.sort((a,b) => new Date((b.created_at || '') + (!(b.created_at || '').includes('Z') ? 'Z' : '')).getTime() - new Date((a.created_at || '') + (!(a.created_at || '').includes('Z') ? 'Z' : '')).getTime());
  } else if (activeTab === 'ranking') {
    displayedProjects.sort((a,b) => getScore(b) - getScore(a));
  } else if (activeTab === 'category_results') {
    displayedProjects = displayedProjects.filter(p => {
      const allTags = ((p.completed_tags || '') + ' ' + (p.tags || '')).toLowerCase();
      // Match industries
      const matchInd = selectedIndustries.length === 0 || selectedIndustries.some(ind => allTags.includes(ind.toLowerCase()));
      const matchHash = selectedHashtags.length === 0 || selectedHashtags.some(tag => allTags.includes(tag.toLowerCase()));
      return matchInd && matchHash;
    });
  }

  // Extract all unique terms from tags
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  useEffect(() => {
    const tagSet = new Set<string>();
    projects.forEach(p => {
      const allTags = ((p.completed_tags || '') + ' ' + (p.tags || '')).toLowerCase();
      const tagsArray: string[] = allTags.match(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g) || [];
      tagsArray.forEach(t => tagSet.add(t.replace('#', '')));
    });
    setAvailableTags(Array.from(tagSet));
  }, [projects]);

  const displayedTagSuggestions = hashtagInput.length > 0 
    ? availableTags.filter(t => t.includes(hashtagInput.toLowerCase()) && !selectedHashtags.includes(t))
    : [];

  const handleHashtagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hashtagInput.trim()) {
      if (!selectedHashtags.includes(hashtagInput.trim())) {
        setSelectedHashtags([...selectedHashtags, hashtagInput.trim()]);
      }
      setHashtagInput('');
    }
  };

  const addHashtagFromSuggest = (tag: string) => {
    if (!selectedHashtags.includes(tag)) {
        setSelectedHashtags([...selectedHashtags, tag]);
    }
    setHashtagInput('');
  };

  const removeHashtag = (tag: string) => {
    setSelectedHashtags(selectedHashtags.filter(t => t !== tag));
  };

  const toggleIndustry = (ind: string) => {
    if (selectedIndustries.includes(ind)) {
      setSelectedIndustries(selectedIndustries.filter(i => i !== ind));
    } else {
      setSelectedIndustries([...selectedIndustries, ind]);
    }
  };

  const renderCard = (project: Project, size: 'large' | 'small' | 'grid') => {
    let coverImg = project.image;
    if (project.images) {
      try {
        const imgArr = JSON.parse(project.images);
        if (imgArr.length > 0) coverImg = imgArr[0];
      } catch(e) {}
    }

    const isLarge = size === 'large';
    const isGrid = size === 'grid';
    const isSmall = size === 'small';

    if (size === 'small') {
      return (
        <div
          key={`${size}-${project.id}`}
          onClick={() => navigate(`/completed/${project.id}`)}
          className={`flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden group hover:border-emerald-500/50 transition-colors cursor-pointer drop-shadow-md h-full flex-1 min-h-0`}
        >
          <div className="w-2/5 relative overflow-hidden shrink-0">
            <img 
              src={coverImg || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop"} 
              alt={project.title} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-2 left-2 bg-emerald-500/90 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-lg z-10">
              <CheckCircle className="w-2.5 h-2.5 shrink-0" />
              RELEASED
            </div>
          </div>
          
          <div className="w-3/5 p-2 md:p-3 flex flex-col justify-center min-w-0">
            <h3 className="text-xs md:text-sm font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">{project.title}</h3>
            
            {(project.funding_goal ?? 0) > 0 && (
              <div className="mb-2 w-full">
                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                  <span>¥{(project.funding_current || 0).toLocaleString()}</span>
                  <span>{Math.round(((project.funding_current || 0) / (project.funding_goal || 1)) * 100)}%</span>
                </div>
                <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500" 
                    style={{ width: `${Math.min(100, ((project.funding_current || 0) / (project.funding_goal || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <img src={project.author_avatar || undefined} alt="" className={`w-4 h-4 rounded-full shrink-0 object-cover ${getAccountTypeBorderClass(project.author_account_type || project.account_type, 'border')}`} />
                <span className="text-[10px] md:text-xs text-slate-700 dark:text-slate-300 truncate font-medium">{project.author_name}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[10px] md:text-xs shrink-0">
                <Heart className="w-3 h-3 md:w-3.5 md:h-3.5" />
                <span>{project.likes_count || 0}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={`${size}-${project.id}`}
        onClick={() => navigate(`/completed/${project.id}`)}
        className={`flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden group hover:border-emerald-500/50 transition-colors cursor-pointer drop-shadow-md h-full min-h-0`}
      >
        <div className={`${isLarge ? 'flex-1 min-h-0' : 'aspect-[4/3] md:aspect-[16/10]'} relative overflow-hidden shrink-0`}>
          <img 
            src={coverImg || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop"} 
            alt={project.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-2 left-2 bg-emerald-500/90 backdrop-blur-sm text-white px-2 py-0.5 rounded-md text-[10px] md:text-xs font-bold flex items-center gap-1 shadow-lg z-10">
            <CheckCircle className="w-2.5 h-2.5 shrink-0" />
            RELEASED
          </div>
        </div>
        
        <div className={`p-2 md:p-3 flex flex-col ${isLarge ? 'shrink-0' : 'flex-1'}`}>
          <h3 className={`${isLarge ? 'text-sm md:text-lg' : 'text-xs md:text-sm'} font-bold text-slate-900 dark:text-white mb-1 line-clamp-1`}>{project.title}</h3>
          
          {(project.funding_goal ?? 0) > 0 && (
            <div className="mt-1 mb-2 w-full">
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                <span>¥{(project.funding_current || 0).toLocaleString()} / ¥{(project.funding_goal || 0).toLocaleString()}</span>
                <span>{Math.round(((project.funding_current || 0) / (project.funding_goal || 1)) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500" 
                  style={{ width: `${Math.min(100, ((project.funding_current || 0) / (project.funding_goal || 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between mt-auto pt-2">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <img src={project.author_avatar || undefined} alt="" className={`${isLarge ? 'w-5 h-5 md:w-6 md:h-6' : 'w-4 h-4 md:w-5 md:h-5'} rounded-full shrink-0 object-cover ${getAccountTypeBorderClass(project.author_account_type || project.account_type, 'border')}`} />
              <span className={`${isLarge ? 'text-xs md:text-sm' : 'text-[10px] md:text-xs'} text-slate-700 dark:text-slate-300 truncate font-medium`}>{project.author_name}</span>
            </div>
            
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[10px] md:text-xs shrink-0">
              <Heart className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>{project.likes_count || 0}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAds = (currentAds: string[]) => (
    <div className="grid grid-cols-3 gap-2 md:gap-4 my-6">
      {currentAds.map((ad, i) => (
        <div key={i} className="bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg aspect-[5/2] flex items-center justify-center p-2 text-center transition-all duration-500">
          <span className="text-slate-600 dark:text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest break-words w-full line-clamp-2">{ad}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div className="flex items-center gap-3 mb-4 md:mb-0 cursor-pointer" onClick={() => handleTabChange('default')}>
          <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{language === 'ja' ? '作品・商品' : 'Works & products'}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-6 md:mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
        {TABS.map(tab => (
          <button
            key={tab.id}
            data-store-tab={tab.id} onClick={() => handleTabChange(tab.id)}
            className={`text-xs md:text-sm font-semibold px-2 py-1 transition-colors whitespace-nowrap ${activeTab === tab.id || (activeTab === 'category_results' && tab.id === 'category') ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {language === 'ja' ? tab.labelJa : tab.labelEn}
          </button>
        ))}
      </div>

      {activeTab === 'default' && projects.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">{language === 'ja' ? '販売中の作品はまだありません。Buyoutの出品もご覧いただけます。' : 'No works are on sale yet. You can also browse Buyout listings.'}</p>}
      {activeTab === 'default' && projects.length > 0 && (
        <>
          {/* Top 3 Area */}
          {top3.length > 0 && (
            <div className="grid grid-cols-2 gap-2 md:gap-4 mb-6 md:mb-8 items-stretch h-[200px] md:h-[260px]">
              {/* Left Large */}
              <div className="col-span-1 flex flex-col min-h-0">
                {top3[0] && renderCard(top3[0], 'large')}
              </div>
              {/* Right Small 2-rows */}
              <div className="col-span-1 flex flex-col gap-2 md:gap-4 min-h-0">
                {top3[1] && renderCard(top3[1], 'small')}
                {top3[2] && renderCard(top3[2], 'small')}
              </div>
            </div>
          )}

          {renderAds(currentAds)}

          {/* Grid 3 cols */}
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            {projects.filter(p => !top3.find(t => t.id === p.id)).slice(0, 9).map(p => renderCard(p, 'grid'))}
          </div>

          {renderAds(ADS[(adIndex + 1) % ADS.length])}
        </>
      )}

      {(activeTab === 'new' || activeTab === 'ranking' || activeTab === 'category_results') && (
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          {displayedProjects.length === 0 ? (
            <div className="col-span-3 text-center py-20 text-slate-400">
              No results found.
            </div>
          ) : (
            displayedProjects.map(p => renderCard(p, 'grid'))
          )}
        </div>
      )}

      {activeTab === 'category' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 md:p-6 rounded-xl">
          <div className="mb-8">
            <h3 className="text-sm md:text-lg font-bold text-slate-900 dark:text-white mb-4">{language === 'ja' ? 'その他の検索（#）' : 'Hashtag Search'}</h3>
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 md:w-5 md:h-5 text-slate-400 dark:text-slate-500" />
              </div>
              <input
                type="text"
                value={hashtagInput}
                onChange={e => setHashtagInput(e.target.value)}
                onKeyDown={handleHashtagAdd}
                placeholder={language === 'ja' ? 'キーワード入力してEnter...' : 'Type keyword and press Enter...'}
                className="w-full text-sm md:text-base bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg pl-9 md:pl-10 pr-4 py-2.5 md:py-3 outline-none focus:border-emerald-500 transition-colors placeholder-slate-400"
              />
              {displayedTagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg mt-1 z-20 max-h-48 overflow-y-auto">
                  {displayedTagSuggestions.map(tag => (
                    <div 
                      key={tag}
                      onClick={() => addHashtagFromSuggest(tag)}
                      className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm text-slate-900 dark:text-white"
                    >
                      #{tag}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Selected Hashtags */}
            <div className="flex flex-wrap gap-2">
              {selectedHashtags.map(tag => (
                <span key={tag} className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm flex items-center gap-1.5">
                  #{tag}
                  <button onClick={() => removeHashtag(tag)} className="hover:text-slate-900 dark:hover:text-white"><X className="w-3 h-3 md:w-3.5 md:h-3.5" /></button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm md:text-lg font-bold text-slate-900 dark:text-white mb-4">{language === 'ja' ? '産業・カテゴリー（複数選択可）' : 'Categories / Industries'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
              {industries.map(ind => (
                <label key={ind} className="flex items-center gap-2 text-[10px] md:text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                  <div className={`w-3.5 h-3.5 md:w-4 md:h-4 rounded border flex items-center justify-center shrink-0 ${selectedIndustries.includes(ind) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800'}`}>
                    {selectedIndustries.includes(ind) && <CheckCircle className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />}
                  </div>
                  <input type="checkbox" className="hidden" checked={selectedIndustries.includes(ind)} onChange={() => toggleIndustry(ind)} />
                  <span className="line-clamp-1">{ind}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => handleTabChange('category_results')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 md:px-8 py-2 md:py-3 rounded-lg text-sm md:text-base font-bold transition-all shadow-lg shadow-emerald-500/20"
            >
              {language === 'ja' ? '次へ' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'purchase' && (
        <div className="w-full">
          <PurchaseHistory isEmbedded={true} />
        </div>
      )}

      {activeTab === 'cart' && (
        <div className="w-full">
          <Cart isEmbedded={true} />
        </div>
      )}

      {/* Select Vision Floating Button */}
      {user && (
        <div className="fixed bottom-24 right-4 md:right-8 lg:right-12 z-40">
          <button 
            data-product-create="true" onClick={handleOpenSelect}
            className="w-12 h-12 md:w-14 md:h-14 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105"
          >
            <Plus className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      )}

      {/* Select Vision Modal */}
      {showSelectEMA && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-3 sm:p-6">
          <div data-ui-dialog="product" className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 max-w-2xl w-full max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-4 md:mb-6 shrink-0">
              <h2 className="text-lg md:text-xl font-bold text-slate-900">Select Vision to Complete</h2>
              <button aria-label="Close product selection" onClick={() => setShowSelectEMA(false)} className="shrink-0 rounded-lg p-2 text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
            
            <div className="min-h-0 overflow-y-auto space-y-3 md:space-y-4">
              {myEMAs.length === 0 ? (
                 <p className="text-slate-500 text-center py-8">No active Visions found.</p>
              ) : myEMAs.map(ema => (
                 <button
                   data-product-item="true" key={ema.id}
                   onClick={() => navigate(`/completed/post/${ema.id}`)}
                   className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 p-3 md:p-4 rounded-xl flex items-center gap-3 md:gap-4 transition-colors text-left"
                 >
                   {ema.image && <img src={ema.image} alt={ema.title} className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover" />}
                   <div className="flex-1 min-w-0">
                     <h3 className="text-sm md:text-base font-bold text-slate-900 line-clamp-1">{ema.title}</h3>
                     <p className="text-xs md:text-sm text-slate-500 line-clamp-1">{ema.description.replace(/<[^>]*>/g, '')}</p>
                   </div>
                 </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
