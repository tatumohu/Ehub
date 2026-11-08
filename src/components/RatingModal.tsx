import React, { useState, useEffect } from 'react';
import { X, Star } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getAccountTypeBorderClass } from '../utils/avatar';

export default function RatingModal({
  isOpen,
  onClose,
  itemId,
  itemType, // 'project' | 'idea'
}: {
  isOpen: boolean;
  onClose: () => void;
  itemId: number;
  itemType: 'project' | 'idea';
}) {
  const { user, language } = useAppContext();
  const [usersToRate, setUsersToRate] = useState<any[]>([]);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [role, setRole] = useState<'author' | 'follower' | 'none'>('none');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user && itemId) {
      setIsLoading(true);
      fetch(`/api/items/${itemType}/${itemId}/rateable_users?current_user_id=${user.id}`)
        .then(res => res.json())
        .then(data => {
          setRole(data.role);
          setUsersToRate(data.usersToRate || []);
          setIsLoading(false);
        })
        .catch(console.error);
    }
  }, [isOpen, user, itemId, itemType]);

  const handleSubmit = () => {
    if (!user) return;
    const ratingsArray = usersToRate.map(u => ({
      to_user_id: u.id,
      rating: ratings[u.id] || 0
    })).filter(r => r.rating > 0);

    if (ratingsArray.length === 0) return onClose();

    fetch(`/api/items/${itemType}/${itemId}/ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_user_id: user.id, ratings: ratingsArray })
    }).then(() => {
      onClose();
    }).catch(console.error);
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md p-8 flex justify-center shadow-xl">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (role === 'none' || usersToRate.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md p-6 text-center relative shadow-xl">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
            {language === 'ja' ? '評価済み' : 'Already Rated'}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            {language === 'ja' ? '評価対象のユーザーはいません。' : 'No users available to rate.'}
          </p>
          <button onClick={onClose} className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold py-3 rounded-xl transition-all">
            {language === 'ja' ? '閉じる' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {language === 'ja' ? 'ユーザーを評価する' : 'Evaluate Users'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            usersToRate.map(u => (
              <div key={u.id} className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <img src={u.avatar} alt={u.username} className={`w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 object-cover ${getAccountTypeBorderClass(u.account_type, 'border-2')}`} />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{u.username}</div>
                    {u.title && <div className="text-xs text-slate-500 dark:text-slate-400">{u.title}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRatings(prev => ({ ...prev, [u.id]: star }))}
                      className="p-1 focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          (ratings[u.id] || 0) >= star
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-slate-300 dark:text-slate-600 stroke-2'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleSubmit}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors shadow-md"
          >
            {language === 'ja' ? '確定' : 'Submit Ratings'}
          </button>
        </div>
      </div>
    </div>
  );
}
