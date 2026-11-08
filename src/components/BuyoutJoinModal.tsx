import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface BuyoutJoinModalProps {
  buyout: any;
  onClose: () => void;
  onJoin: () => void;
}

export default function BuyoutJoinModal({ buyout, onClose, onJoin }: BuyoutJoinModalProps) {
  const { user, language } = useAppContext();
  const [message, setMessage] = useState('');
  const [minPrice, setMinPrice] = useState(buyout.price + 1);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const isAuction = buyout.buyout_type === 'auction';
      const endpoint = isAuction 
        ? `/api/buyouts/${buyout.id}/auction/join` 
        : `/api/buyouts/${buyout.id}/join`;
      
      const body = isAuction
        ? { user_id: user?.id, min_price: minPrice }
        : { user_id: user?.id, message };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        onJoin();
        onClose();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-6rem)] mt-[-2rem]">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
          <h2 className="text-xl font-black text-white">
            {language === 'ja' ? 'バイアウトに参加' : 'Join Buyout'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <div className="text-sm text-slate-400 mb-1">
              {buyout.buyout_type === 'fixed' 
                ? (language === 'ja' ? '設定価格' : 'Fixed Price')
                : (language === 'ja' ? '最低開始価格' : 'Minimum Starting Price')}
            </div>
            <div className="text-3xl font-black text-emerald-400">
              ¥{buyout.price?.toLocaleString()}
            </div>
          </div>

          {buyout.buyout_type === 'fixed' ? (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {language === 'ja' ? 'このVisionをバイアウトしたい想い' : 'Why do you want to buyout this Vision?'}
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 min-h-[120px] resize-none"
                placeholder={language === 'ja' ? '想いを記入してください...' : 'Write your passion here...'}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {language === 'ja' ? 'あなたの最低開始価格 (円)' : 'Your Minimum Starting Price (JPY)'}
              </label>
              <input
                type="number"
                value={minPrice}
                onChange={e => setMinPrice(parseInt(e.target.value, 10))}
                min={buyout.price + 1}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
              <div className="text-xs text-slate-500 mt-2">
                {language === 'ja' 
                  ? '設定された最低開始価格より高い金額を入力してください。' 
                  : 'Must be higher than the creator\'s minimum starting price.'}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {language === 'ja' ? 'キャンセル' : 'Cancel'}
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={isLoading || (buyout.buyout_type === 'auction' && minPrice <= buyout.price) || (buyout.buyout_type === 'fixed' && !message)}
            className="px-8 py-2 rounded-full font-bold bg-emerald-500 text-white hover:bg-emerald-400 transition-colors disabled:opacity-50"
          >
            {isLoading ? (language === 'ja' ? '送信中...' : 'Sending...') : (language === 'ja' ? '参加する' : 'Join')}
          </button>
        </div>
      </div>
    </div>
  );
}
