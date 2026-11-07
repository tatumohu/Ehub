import React, { useEffect, useState, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface AuctionChatModalProps {
  buyout: any;
  onClose: () => void;
}

export default function AuctionChatModal({ buyout, onClose }: AuctionChatModalProps) {
  const { user, language } = useAppContext();
  const [bids, setBids] = useState<any[]>([]);
  const [bidAmount, setBidAmount] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/buyouts/${buyout.id}/bids`)
      .then(res => res.json())
      .then(data => {
        setBids(data);
        if (data.length > 0) {
          setBidAmount(data[data.length - 1].amount + 100);
        } else {
          setBidAmount(buyout.price + 100);
        }
      });
      
    // Polling for bids in a real app, you'd use websockets
    const interval = setInterval(() => {
      fetch(`/api/buyouts/${buyout.id}/bids`)
        .then(res => res.json())
        .then(data => setBids(data));
    }, 3000);
    
    return () => clearInterval(interval);
  }, [buyout.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [bids]);

  const handleBid = async () => {
    if (!bidAmount || isNaN(Number(bidAmount))) return;
    const currentMax = bids.length > 0 ? bids[bids.length - 1].amount : buyout.price;
    if (Number(bidAmount) <= currentMax) {
      alert(language === 'ja' ? '現在の最高額より高い金額を入力してください' : 'Bid must be higher than current max bid');
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/buyouts/${buyout.id}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, amount: Number(bidAmount) })
      });
      if (res.ok) {
        setBidAmount(Number(bidAmount) + 100);
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-[600px] max-h-[calc(100vh-6rem)] mt-[-2rem] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            {language === 'ja' ? 'オークションチャット' : 'Auction Chat'}
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">Live</span>
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          <div className="text-center text-slate-500 text-sm my-4">
            {language === 'ja' ? `オークションが開始されました！開始価格: ¥${buyout.price.toLocaleString()}` : `Auction has started! Starting price: ¥${buyout.price.toLocaleString()}`}
          </div>
          
          {(() => {
            const bidderMap = new Map();
            let letterCode = 65; // 'A'
            return bids.map(bid => {
              const isMe = bid.user_id === user?.id;
              const isCreator = buyout.creator_id === user?.id;
              
              let displayName = bid.username || (language === 'ja' ? 'ユーザー' : 'User');
              let displayAvatar = bid.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
              
              
              
              return (
                <div key={bid.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <img src={displayAvatar} alt="" className={`w-8 h-8 rounded-full object-cover shrink-0 ${getAccountTypeBorderClass(bid.account_type, 'border-[3px]')}`} />
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-slate-500 mb-1">{displayName}</span>
                    <div className={`px-4 py-2 rounded-2xl ${isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'}`}>
                      <span className="font-bold text-lg">¥{bid.amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {buyout.status === 'active' && (!buyout.end_date || new Date() < new Date(buyout.end_date)) ? (
          <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">¥</span>
              <input
                type="number"
                value={bidAmount}
                onChange={e => setBidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-3 text-white focus:outline-none focus:border-emerald-500 font-bold"
                placeholder={language === 'ja' ? '入札額を入力' : 'Enter bid amount'}
              />
              <button
                onClick={handleBid}
                disabled={isLoading || !bidAmount}
                className="p-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full transition-colors disabled:opacity-50 shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t border-slate-800 bg-slate-800/50 text-center text-emerald-400 font-bold shrink-0">
            {language === 'ja' ? 'オークションは終了しました' : 'Auction has ended'}
          </div>
        )}
      </div>
    </div>
  );
}
