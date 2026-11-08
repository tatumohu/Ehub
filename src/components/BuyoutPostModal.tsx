import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import RatingModal from './RatingModal';
import { useAppContext } from '../context/AppContext';

interface BuyoutPostModalProps {
  onClose: () => void;
  onPost: () => void;
}

export default function BuyoutPostModal({ onClose, onPost }: BuyoutPostModalProps) {
  const { user, language } = useAppContext();
  const [activeTab, setActiveTab] = useState<'home' | 'completed'>('home');
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [buyoutType, setBuyoutType] = useState<'fixed' | 'auction'>('fixed');
  const [price, setPrice] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const [ideasRes, projectsRes] = await Promise.all([
          fetch(`/api/ideas?user_id=${user?.id}`),
          fetch('/api/projects')
        ]);
        const ideas = await ideasRes.json();
        const projects = await projectsRes.json();

        if (activeTab === 'home') {
          const userProjects = projects.filter((p: any) => p.author_id === user?.id && p.status !== 'completed' && !p.is_buyout);
          setItems([...userProjects].sort((a, b) => new Date((b.created_at || '') + (!(b.created_at || '').includes('Z') ? 'Z' : '')).getTime() - new Date((a.created_at || '') + (!(a.created_at || '').includes('Z') ? 'Z' : '')).getTime()));
        } else {
          const completedProjects = projects.filter((p: any) => p.author_id === user?.id && p.status === 'completed' && !p.is_buyout);
          setItems(completedProjects.sort((a, b) => new Date((b.created_at || '') + (!(b.created_at || '').includes('Z') ? 'Z' : '')).getTime() - new Date((a.created_at || '') + (!(a.created_at || '').includes('Z') ? 'Z' : '')).getTime()));
        }
      } catch (e) {
        console.error(e);
      }
    };
    if (user?.id) fetchItems();
  }, [user, activeTab]);

  const handleSubmit = async () => {
    if (!selectedItem) return;
    
    if (!price) {
      alert(language === 'ja' ? '価格を入力してください' : 'Please enter a price');
      return;
    }
    
    if (buyoutType === 'auction' && (!startDate || !endDate)) {
      alert(language === 'ja' ? '開始日時と終了日時を入力してください' : 'Please enter start and end dates');
      return;
    }
    
    setIsLoading(true);
    try {
      const isProject = 'funding_goal' in selectedItem || 'status' in selectedItem;
      const res = await fetch('/api/buyouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: isProject ? 'project' : 'idea',
          item_id: selectedItem.id,
          creator_id: user?.id,
          buyout_type: buyoutType,
          price: parseInt(price, 10),
          start_date: buyoutType === 'auction' ? new Date(startDate).toISOString() : null,
          end_date: buyoutType === 'auction' ? new Date(endDate).toISOString() : null
        })
      });
      if (res.ok) {
        setShowRatingModal(true);
      } else {
        alert(await res.text());
      }
    } catch (e) {
      console.error(e);
      alert('Error posting buyout');
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div data-ui-dialog="buyout" className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-6rem)] mt-[-2rem]">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
            {language === 'ja' ? 'バイアウトに投稿' : 'Post to Buyout'}
          </h2>
          <button aria-label="Close Buyout" onClick={onClose} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto flex-1 min-h-0">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  onClick={() => { setActiveTab('home'); setSelectedItem(null); }}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    activeTab === 'home' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {language === 'ja' ? '投稿' : 'Posts'}
                </button>
                <button
                  onClick={() => { setActiveTab('completed'); setSelectedItem(null); }}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    activeTab === 'completed' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  Completed
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {items.map(item => (
                  <div
                    key={`${item.type || (item.funding_goal !== undefined ? 'project' : 'idea')}-${item.id}`}
                    data-buyout-item="true" onClick={() => setSelectedItem(item)}
                    className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                      selectedItem?.id === item.id && (selectedItem?.type || (selectedItem?.funding_goal !== undefined ? 'project' : 'idea')) === (item.type || (item.funding_goal !== undefined ? 'project' : 'idea')) ? 'border-emerald-500 scale-95' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                      <p className="text-white text-xs font-bold line-clamp-2">{item.title}</p>
                    </div>
                    {selectedItem?.id === item.id && (selectedItem?.type || (selectedItem?.funding_goal !== undefined ? 'project' : 'idea')) === (item.type || (item.funding_goal !== undefined ? 'project' : 'idea')) && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {items.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                  {language === 'ja' ? '投稿可能なアイテムがありません' : 'No items available to post'}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setBuyoutType('fixed')}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all text-center ${
                    buyoutType === 'fixed' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                  }`}
                >
                  <div className="font-bold text-slate-900 dark:text-white mb-1">{language === 'ja' ? '固定価格方式' : 'Fixed Price'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{language === 'ja' ? '設定した価格で販売' : 'Sell at a set price'}</div>
                </button>
                <button
                  data-buyout-method="auction" onClick={() => setBuyoutType('auction')}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all text-center ${
                    buyoutType === 'auction' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                  }`}
                >
                  <div className="font-bold text-slate-900 dark:text-white mb-1">{language === 'ja' ? 'オークション方式' : 'Auction'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{language === 'ja' ? '最高額の入札者に販売' : 'Sell to highest bidder'}</div>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {buyoutType === 'fixed' ? (language === 'ja' ? '販売価格 (円)' : 'Price (JPY)') : (language === 'ja' ? '最低開始価格 (円)' : 'Minimum Starting Price (JPY)')}
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  placeholder="0"
                />

                {price && Number(price) > 0 && (
                  <div className="mt-3 p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>{language === 'ja' ? '設定価格:' : 'Listing Price:'}</span>
                      <span className="font-semibold">¥{Number(price).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>{language === 'ja' ? 'E-hubバイアウト成立手数料 (5%):' : 'E-hub Fee (5%):'}</span>
                      <span>¥{Math.round(Number(price) * 0.05).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span>{language === 'ja' ? '出品者受取予定額 (95%):' : 'Estimated Payout (95%):'}</span>
                      <span>¥{(Number(price) - Math.round(Number(price) * 0.05)).toLocaleString()}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1">
                      {language === 'ja' ? '※決済処理手数料、税その他の費用が別途発生する場合があります。' : '* Payment processing fees, taxes, and other costs may apply.'}
                    </div>
                  </div>
                )}
              </div>

              {buyoutType === 'auction' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{language === 'ja' ? '開始日時' : 'Start Date'}</label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{language === 'ja' ? '終了日時' : 'End Date'}</label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <button
            onClick={() => step === 2 ? setStep(1) : onClose()}
            className="px-6 py-2.5 rounded-full font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            {step === 2 ? (language === 'ja' ? '戻る' : 'Back') : (language === 'ja' ? 'キャンセル' : 'Cancel')}
          </button>
          
          {step === 1 ? (
            <button
              data-buyout-next="true" onClick={() => setStep(2)}
              disabled={!selectedItem}
              className="px-6 py-2.5 rounded-full font-bold bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {language === 'ja' ? '次へ' : 'Next'}
            </button>
          ) : (
            <button
              data-buyout-submit="true" onClick={handleSubmit}
              disabled={isLoading}
              className="px-8 py-2.5 rounded-full font-bold bg-emerald-500 text-white hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (language === 'ja' ? '投稿中...' : 'Posting...') : (language === 'ja' ? '投稿する' : 'Post')}
            </button>
          )}
        </div>
      </div>
      {showRatingModal && (
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => {
            setShowRatingModal(false);
            onPost();
            onClose();
          }}
          itemId={selectedItem?.id}
          itemType={'funding_goal' in selectedItem || 'status' in selectedItem ? 'project' : 'idea'}
        />
      )}
    </div>
  );
}
