import React, { useState, useEffect } from 'react';
import { UserPlus, UserCheck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface SubscribeButtonProps {
  authorId: number;
  authorName: string;
}

export default function SubscribeButton({ authorId, authorName }: SubscribeButtonProps) {
  const { user, language } = useAppContext();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && authorId) {
      fetch(`/api/users/${authorId}?current_user_id=${encodeURIComponent(user.id)}`)
        .then(res => res.json())
        .then(data => {
          setIsSubscribed(data.isSubscribed);
        });
    }
  }, [user, authorId]);

  const handleSubscribe = async () => {
    if (!user) return alert('Please login first');
    if (user.id === authorId) return alert(language === 'ja' ? '自分自身はフォローできません' : 'You cannot follow yourself');
    
    setIsLoading(true);
    try {
      const endpoint = isSubscribed ? 'unsubscribe' : 'subscribe';
      const res = await fetch(`/api/users/${authorId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriber_id: user.id })
      });
      
      if (res.ok) {
        setIsSubscribed(!isSubscribed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handleSubscribe}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${
        isSubscribed 
          ? 'bg-slate-800 text-slate-400 border border-slate-700' 
          : 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20'
      }`}
    >
      {isSubscribed ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
      <span>{isSubscribed ? (language === 'ja' ? 'フォロー中' : 'Following') : (language === 'ja' ? 'フォローする' : 'Follow')}</span>
    </button>
  );
}
