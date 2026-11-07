import React, { useState, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface User {
  id: number;
  username: string;
  avatar: string | null;
  account_type?: any;
}

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: number[];
  onConfirm: (users: number[]) => void;
}

const PrivacyModal: React.FC<PrivacyModalProps> = ({
  isOpen,
  onClose,
  selectedUsers,
  onConfirm
}) => {
  const { user: currentUser, language } = useAppContext();
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>('following');
  const [subscribers, setSubscribers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [localSelected, setLocalSelected] = useState<number[]>(selectedUsers);

  useEffect(() => {
    if (isOpen) {
      setLocalSelected(selectedUsers);
      fetchUsers();
    }
  }, [isOpen, selectedUsers]);

  const fetchUsers = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [subsRes, subingRes] = await Promise.all([
        fetch(`/api/users/${currentUser.id}/subscribers`),
        fetch(`/api/users/${currentUser.id}/subscriptions`)
      ]);
      const subs = await subsRes.json();
      const subing = await subingRes.json();
      setSubscribers(subs);
      setSubscriptions(subing);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const users = activeTab === 'followers' ? subscribers : subscriptions;

  const toggleUser = (userId: number) => {
    setLocalSelected(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl flex flex-col max-h-[80vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Select Users for Private Viewing</h2>
          <button 
            onClick={onClose}
            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${
              activeTab === 'following' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {language === 'ja' ? 'フォロー中' : 'Following'}
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${
              activeTab === 'followers' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {language === 'ja' ? 'フォロワー' : 'Followers'}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center p-8 text-slate-400 dark:text-slate-500">Loading...</div>
          ) : users.length > 0 ? (
            <div className="space-y-1">
              {users.map(u => (
                <div 
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full ${getAccountTypeBorderClass(u.account_type, 'border-2')} overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0`}>
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 dark:text-white font-bold truncate">{u.username}</div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                    localSelected.includes(u.id) 
                      ? 'bg-blue-500 border-blue-500 text-white' 
                      : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-transparent'
                  }`}>
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 flex-col gap-2">
              <p>No users found here.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/90">
          <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {localSelected.length} selected
          </div>
          <button
            onClick={() => onConfirm(localSelected)}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20"
          >
            OK
          </button>
        </div>

      </div>
    </div>
  );
};

export default PrivacyModal;
