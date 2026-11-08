import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Users, Contact } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface User {
  id: number;
  username: string;
  avatar: string;
  account_type?: any;
}

interface AddMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string | number;
  itemType: 'idea' | 'project';
  onMembersAdded: () => void;
}

export default function AddMembersModal({ isOpen, onClose, itemId, itemType, onMembersAdded }: AddMembersModalProps) {
  const { user } = useAppContext();
  const [activeTab, setActiveTab] = useState<'followers' | 'contacts'>('followers');
  const [followers, setFollowers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchFollowers();
      fetchContacts();
    }
  }, [isOpen, user, itemId, itemType]);

  const fetchFollowers = async () => {
    const res = await fetch(`/api/${itemType === 'idea' ? 'ideas' : 'projects'}/${itemId}/followers`);
    const data = await res.json();
    setFollowers(data);
  };

  const fetchContacts = async () => {
    const res = await fetch(`/api/users/${user?.id}/contacts?item_id=${itemId}&item_type=${itemType}`);
    const data = await res.json();
    setContacts(data);
  };

  const toggleUserSelection = (userId: number) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUserIds(newSelection);
  };

  const handleAddMembers = async () => {
    if (selectedUserIds.size === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/${itemType === 'idea' ? 'ideas' : 'projects'}/${itemId}/members/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: Array.from(selectedUserIds) })
      });
      if (res.ok) {
        onMembersAdded();
        onClose();
        setSelectedUserIds(new Set());
      }
    } catch (error) {
      console.error('Error adding members:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentList = activeTab === 'followers' ? followers : contacts;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        data-ui-dialog="project-members" role="dialog" aria-modal="true" className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Add Members</h2>
          <button aria-label="Close members" onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex flex-wrap gap-2 items-center justify-between mb-6 bg-slate-50/50 p-1 rounded-2xl">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('followers')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'followers' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                Followers
              </button>
              <button
                onClick={() => setActiveTab('contacts')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'contacts' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Contact className="w-4 h-4" />
                Contacts
              </button>
            </div>
            <button
               data-testid="project-members-add" onClick={handleAddMembers}
               disabled={selectedUserIds.size === 0 || loading}
               className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  selectedUserIds.size > 0
                     ? 'bg-white text-slate-900 hover:bg-slate-200'
                     : 'bg-slate-100 text-slate-500 cursor-not-allowed'
               }`}
            >
               {loading ? 'Adding...' : `Add (${selectedUserIds.size})`}
            </button>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {currentList.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500">No {activeTab} found</p>
              </div>
            ) : (
              currentList.map((u) => (
                <div
                  key={u.id}
                  data-member-candidate={u.id}
                  onClick={() => toggleUserSelection(u.id)}
                  className="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 hover:border-slate-200 bg-slate-50/30 cursor-pointer transition-all group"
                >
                  <button
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      selectedUserIds.has(u.id)
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    {selectedUserIds.has(u.id) ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </button>
                  <img src={u.avatar || undefined} alt={u.username} className={`w-10 h-10 rounded-full object-cover ${getAccountTypeBorderClass(u.account_type, 'border-2')}`} />
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{u.username}</p>
                    <div className="h-0.5 w-12 bg-slate-100 rounded-full mt-1 group-hover:bg-blue-500/50 transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
