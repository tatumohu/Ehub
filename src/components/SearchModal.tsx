import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Sparkles, Lightbulb, Users, ArrowRight, Tag, Clock, TrendingUp, User as UserIcon, Building2, Landmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import AccountTypeBadge from './AccountTypeBadge';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

type SearchItem = {
  id: number;
  title: string;
  description: string;
  image?: string;
  type: 'project' | 'idea' | 'user';
  author_name?: string;
  author_avatar?: string;
  author_account_type?: string;
  account_type?: string;
  tags?: string;
  is_recruitment?: number;
  is_buyout?: number;
  created_at?: string;
  user_id?: number;
};

const POPULAR_TAGS = ['AI', 'Web3', 'SaaS', 'EC', 'ヘルスケア', '地方創生', '教育', 'フードテック', 'マッチング'];

export default function SearchModal({ isOpen, onClose, initialQuery = '' }: SearchModalProps) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<'all' | 'project' | 'idea' | 'recruitment' | 'user'>('all');
  const [activeAccountFilter, setActiveAccountFilter] = useState<'all' | 'individual' | 'corporate' | 'municipality'>('all');
  const [allProjects, setAllProjects] = useState<SearchItem[]>([]);
  const [allIdeas, setAllIdeas] = useState<SearchItem[]>([]);
  const [allUsers, setAllUsers] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const navigate = useNavigate();
  const { language, user } = useAppContext();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('ehub_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      fetchData();
    }
  }, [isOpen, initialQuery]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pRes, iRes, uRes] = await Promise.all([
        fetch(`/api/projects${user ? `?user_id=${user.id}` : ''}`).then(r => r.ok ? r.json() : []),
        fetch(`/api/ideas${user ? `?user_id=${user.id}` : ''}`).then(r => r.ok ? r.json() : []),
        fetch('/api/users').then(r => r.ok ? r.json() : [])
      ]);

      const projectsFormatted: SearchItem[] = (Array.isArray(pRes) ? pRes : []).map((p: any) => ({ ...p, type: 'project' }));
      const ideasFormatted: SearchItem[] = (Array.isArray(iRes) ? iRes : []).map((i: any) => ({ ...i, type: 'idea' }));
      const usersFormatted: SearchItem[] = (Array.isArray(uRes) ? uRes : []).map((u: any) => ({
        id: u.id,
        title: u.company_name || u.username,
        description: u.title || u.department_name || (u.account_type === 'municipality' ? '自治体アカウント' : u.account_type === 'corporate' || u.account_type === 'organization' ? '法人アカウント' : '個人アカウント'),
        image: u.avatar,
        type: 'user',
        author_name: u.username,
        author_avatar: u.avatar,
        author_account_type: u.account_type || 'individual',
        account_type: u.account_type || 'individual',
        tags: u.tags,
        user_id: u.id
      }));

      setAllProjects(projectsFormatted);
      setAllIdeas(ideasFormatted);
      setAllUsers(usersFormatted);
    } catch (e) {
      console.error('Failed to fetch search items:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('ehub_recent_searches', JSON.stringify(updated));
  };

  const handleSearchSubmit = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const searchTerm = (customQuery !== undefined ? customQuery : query).trim();
    if (searchTerm) {
      saveRecentSearch(searchTerm);
      onClose();
      navigate(`/list?q=${encodeURIComponent(searchTerm)}`);
    } else {
      onClose();
      navigate('/list');
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('ehub_recent_searches');
  };

  const allItems = [...allProjects, ...allIdeas, ...allUsers];

  const filteredItems = allItems.filter(item => {
    // Filter by content type tab
    if (activeFilter === 'project' && item.type !== 'project') return false;
    if (activeFilter === 'idea' && item.type !== 'idea') return false;
    if (activeFilter === 'recruitment' && Number(item.is_recruitment) !== 1) return false;
    if (activeFilter === 'user' && item.type !== 'user') return false;

    // Filter by account type
    const accType = item.author_account_type || item.account_type || 'individual';
    if (activeAccountFilter === 'individual') {
      if (accType === 'municipality' || accType === 'corporate' || accType === 'organization') return false;
    } else if (activeAccountFilter === 'corporate') {
      if (accType !== 'corporate' && accType !== 'organization') return false;
    } else if (activeAccountFilter === 'municipality') {
      if (accType !== 'municipality') return false;
    }

    if (!query.trim()) return true;

    const q = query.toLowerCase();
    const text = `${item.title || ''} ${item.description || ''} ${item.tags || ''} ${item.author_name || ''}`.toLowerCase();
    return text.includes(q);
  }).slice(0, 10);

  const modalContent = (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-12 md:pt-20 px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      {/* Modal backdrop click */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main dialog */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        
        {/* Search Bar Input Header */}
        <form onSubmit={handleSearchSubmit} className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="w-5 h-5 text-blue-600 dark:text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={language === 'ja' ? 'Vision、Idea、Project、キーワードで検索...' : 'Search Visions, Ideas, Projects, keywords...'}
            className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-base md:text-lg focus:outline-none font-medium"
          />
          {query && (
            <button 
              type="button" 
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </form>

        {/* Filter Category Tabs & Account Type Filters */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-[#0f172a] space-y-2 shrink-0">
          {/* Content Type Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap mr-1">種別:</span>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${activeFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              {language === 'ja' ? 'すべて' : 'All'}
            </button>
            <button
              onClick={() => setActiveFilter('project')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0 ${activeFilter === 'project' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>Vision</span>
            </button>
            <button
              onClick={() => setActiveFilter('idea')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0 ${activeFilter === 'idea' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              <Lightbulb className="w-3 h-3 text-yellow-400" />
              <span>Idea</span>
            </button>
            <button
              onClick={() => setActiveFilter('recruitment')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0 ${activeFilter === 'recruitment' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              <Users className="w-3 h-3 text-emerald-400" />
              <span>Project</span>
            </button>
            <button
              onClick={() => setActiveFilter('user')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0 ${activeFilter === 'user' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              <UserIcon className="w-3 h-3 text-purple-400" />
              <span>{language === 'ja' ? 'ユーザー' : 'User'}</span>
            </button>
          </div>

          {/* Account Type Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap mr-1">属性:</span>
            {[
              { id: 'all', label: 'すべて', icon: null },
              { id: 'individual', label: '個人', icon: UserIcon },
              { id: 'corporate', label: '法人', icon: Building2 },
              { id: 'municipality', label: '自治体', icon: Landmark }
            ].map((acc) => {
              const Icon = acc.icon;
              const isActive = activeAccountFilter === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setActiveAccountFilter(acc.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0 border ${
                    isActive
                      ? acc.id === 'municipality'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : acc.id === 'corporate'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : acc.id === 'individual'
                        ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  <span>{acc.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6">
          {/* Quick Tags / Trending */}
          {!query && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{language === 'ja' ? '人気のキーワード' : 'Popular Keywords'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {POPULAR_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setQuery(tag);
                      handleSearchSubmit(undefined, tag);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 text-xs font-medium border border-slate-200/60 dark:border-slate-700/60 transition-colors flex items-center gap-1"
                  >
                    <Tag className="w-3 h-3 text-slate-400" />
                    <span>#{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{language === 'ja' ? '最近の検索履歴' : 'Recent Searches'}</span>
                </div>
                <button 
                  onClick={clearRecentSearches}
                  className="text-[11px] text-slate-400 hover:text-red-500 transition-colors font-normal lowercase"
                >
                  {language === 'ja' ? '履歴を消去' : 'Clear history'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setQuery(term);
                      handleSearchSubmit(undefined, term);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-medium border border-slate-200/50 dark:border-slate-700/50 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {query 
                  ? (language === 'ja' ? `検索結果 (${filteredItems.length}件)` : `Results (${filteredItems.length})`)
                  : (language === 'ja' ? 'おすすめコンテンツ' : 'Recommended Content')
                }
              </span>
              {query && (
                <button
                  onClick={() => handleSearchSubmit()}
                  className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>{language === 'ja' ? '一覧で見る' : 'View in List'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-400 text-sm animate-pulse">
                {language === 'ja' ? '検索中...' : 'Searching...'}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                {language === 'ja' ? '該当する項目が見つかりませんでした。' : 'No items found.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => {
                  const accType = item.author_account_type || item.account_type;
                  const borderClass = getAccountTypeBorderClass(accType, 'border-2');

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => {
                        saveRecentSearch(query || item.title);
                        onClose();
                        if (item.type === 'user') {
                          navigate(`/profile/${item.id}`);
                        } else {
                          navigate(`/${item.type}/${item.id}`);
                        }
                      }}
                      className="group p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 hover:bg-blue-50/80 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/50 transition-all cursor-pointer flex items-center gap-3.5"
                    >
                      {item.type === 'user' ? (
                        <img 
                          src={item.image || undefined} 
                          alt="" 
                          className={`w-12 h-12 rounded-full object-cover shrink-0 ${borderClass}`}
                        />
                      ) : item.image ? (
                        <div className="relative shrink-0">
                          <img 
                            src={item.image} 
                            alt="" 
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200/80 dark:border-slate-700"
                          />
                          {item.author_avatar && (
                            <img 
                              src={item.author_avatar} 
                              alt="" 
                              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full object-cover ${borderClass}`} 
                            />
                          )}
                        </div>
                      ) : (
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                            {item.title.substring(0, 1)}
                          </div>
                          {item.author_avatar && (
                            <img 
                              src={item.author_avatar} 
                              alt="" 
                              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full object-cover ${borderClass}`} 
                            />
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                            item.type === 'project' 
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-cyan-300' 
                              : item.type === 'idea'
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300'
                              : 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                          }`}>
                            {item.type === 'project' ? 'Vision' : item.type === 'idea' ? 'Idea' : 'User'}
                          </span>
                          {Number(item.is_recruitment) === 1 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300">
                              Project
                            </span>
                          )}
                          <AccountTypeBadge accountType={accType} size="xs" />
                          {item.author_name && item.type !== 'user' && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                              by {item.author_name}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {item.description.replace(/<[^>]*>/g, '')}
                        </p>
                      </div>

                      <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 shrink-0 flex items-center justify-between text-xs text-slate-400">
          <span>{language === 'ja' ? 'Enterキーで一覧検索' : 'Press Enter to view all results'}</span>
          <button
            type="button"
            onClick={() => handleSearchSubmit()}
            className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>{language === 'ja' ? '検索を確定' : 'Search'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
