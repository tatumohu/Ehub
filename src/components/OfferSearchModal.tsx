import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, Filter } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { INDUSTRIES_EN, INDUSTRIES_JA } from './HashtagInput';
import { useNavigate } from 'react-router-dom';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface User {
  id: number;
  username: string;
  title: string;
  avatar: string;
  account_type: 'individual' | 'organization' | 'corporate' | 'municipality';
  tags: string;
}

export default function OfferSearchModal({ 
  onClose, 
  onNext,
  initialSearch = '',
  initialSearchIndustries = [],
  initialSelectedIds = []
}: { 
  onClose: () => void; 
  onNext: (selectedUserIds: number[]) => void;
  initialSearch?: string;
  initialSearchIndustries?: string[];
  initialSelectedIds?: number[];
}) {
  const [mounted, setMounted] = useState(false);
  const { language } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState(initialSearch);
  const [searchIndustries, setSearchIndustries] = useState<string[]>(initialSearchIndustries);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);
  const [loading, setLoading] = useState(true);
  
  // Tag Filter state
  const [isIndustryModalOpen, setIsIndustryModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      // Only organizations / municipalities can be selected
      const orgUsers = data.filter((u: User) => u.account_type === 'organization' || u.account_type === 'corporate' || u.account_type === 'municipality');
      setUsers(orgUsers);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const industries = language === 'en' ? INDUSTRIES_EN : INDUSTRIES_JA;

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username?.toLowerCase().includes(search.toLowerCase());
    const tags = user.tags ? user.tags : '';
    const matchesTag = searchIndustries.length > 0 ? searchIndustries.some(ind => tags.includes(`#${ind}`)) : true;
    return matchesSearch && matchesTag;
  });

  const toggleUser = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(userId => userId !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredUsers.length && filteredUsers.length > 0) {
      // Deselect all
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map(u => u.id));
    }
  };

  const handleNext = () => {
    onNext(selectedIds);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div data-ui-dialog="proposal-search" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-widest uppercase">
            {language === 'ja' ? '提案先（法人・自治体）の検索' : 'Search Corporate / Municipality'}
          </h3>
          <button type="button" onClick={onClose} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 shrink-0">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder={language === 'ja' ? '法人・自治体・組織名で検索...' : 'Search organization or name...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <div 
              onClick={() => setIsIndustryModalOpen(true)}
              className={`w-full flex items-center gap-2 pl-3 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none text-left transition-colors cursor-pointer ${
                searchIndustries.length > 0 ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Filter className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">
                {searchIndustries.length > 0 ? searchIndustries.map(i => `#${i}`).join(' ') : (language === 'ja' ? '産業ラベルで絞り込み' : 'Filter by industry tag')}
              </span>
              {searchIndustries.length > 0 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchIndustries([]);
                  }}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md"
                >
                  <X className="w-3 h-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 pb-2 flex justify-between items-center text-sm shrink-0">
          <span className="text-slate-500 dark:text-slate-400">
            {filteredUsers.length} {language === 'ja' ? '件' : 'results'}
          </span>
          {filteredUsers.length > 0 && (
            <button onClick={selectAll} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              {selectedIds.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {loading ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading...</div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map(u => (
              <div key={u.id} className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 overflow-hidden">
                <div 
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => toggleUser(u.id)}
                >
                  <div data-proposal-recipient="true" className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                    selectedIds.includes(u.id) ? 'bg-blue-500 border-blue-500' : 'bg-transparent border-slate-300 dark:border-slate-600'
                  }`}>
                    {selectedIds.includes(u.id) && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <img 
                    src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} 
                    alt={u.username} 
                    className={`w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 object-cover shrink-0 ${getAccountTypeBorderClass(u.account_type, 'border-2')}`} 
                  />
                  <div className="flex-1 min-w-0 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${u.id}`, { state: { fromOfferSearch: true, search, searchIndustries, selectedIds } }); onClose(); }}>
                    <div className="font-bold text-slate-900 dark:text-white truncate hover:underline">{u.username}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.title || (u.account_type === 'municipality' ? '自治体' : '法人')}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 rounded-xl">
              {language === 'ja' ? '該当するユーザーがいません。' : 'No matching users found.'}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <button 
            type="button"
            data-proposal-next="true" onClick={handleNext}
            disabled={selectedIds.length === 0}
            className={`w-full py-3 font-bold rounded-xl transition-all ${
              selectedIds.length > 0 
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {language === 'ja' ? '次へ' : 'Next'} ({selectedIds.length})
          </button>
        </div>
      </div>

      {isIndustryModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg max-h-[80dvh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{language === 'ja' ? '業種を選択' : 'Select Industry'}</h3>
              <button type="button" onClick={() => setIsIndustryModalOpen(false)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-2">
              {industries.map(industry => {
                const isSelected = searchIndustries.includes(industry);
                return (
                <button
                  key={industry}
                  onClick={() => {
                    setSearchIndustries(prev => 
                      isSelected ? prev.filter(i => i !== industry) : [...prev, industry]
                    );
                  }}
                  className={`p-2.5 text-xs md:text-sm rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {industry}
                </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-2">
               <button 
                  onClick={() => { setSearchIndustries([]); }}
                  className="flex-1 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800/50"
               >
                  Clear
               </button>
               <button 
                  onClick={() => setIsIndustryModalOpen(false)}
                  className="flex-1 py-2 text-white border border-blue-600 bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
               >
                  {language === 'ja' ? '完了' : 'Done'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (!mounted) return null;
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
