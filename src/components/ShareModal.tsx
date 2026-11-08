import React, { useState, useEffect } from 'react';
import { X, Search, Send, Check, Users, User } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: number;
    type: 'idea' | 'project';
    title: string;
    image: string;
    author_name: string;
  };
}

export default function ShareModal({ isOpen, onClose, item }: ShareModalProps) {
  const { user, socket } = useAppContext();
  const [search, setSearch] = useState('');
  const [recipients, setRecipients] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // e.g. "user:1", "idea:2"
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      const fetchRecipients = async () => {
        setLoading(true);
        try {
          // Fetch following users
          const subsRes = await fetch(`/api/users/${user.id}/subscriptions`);
          const subs = await subsRes.json();

          // Fetch memberships (Groups/Direct chats)
          const memsRes = await fetch(`/api/users/${user.id}/memberships`);
          const mems = await memsRes.json();

          // Combine and deduplicate
          const formattedRecipients = [
            ...subs.map((u: any) => ({
              id: `user:${u.id}`,
              realId: u.id,
              name: u.username,
              avatar: u.avatar,
              type: 'direct'
            })),
            ...mems.filter((m: any) => m.type !== 'direct').map((m: any) => ({
              id: `${m.type}:${m.id}`,
              realId: m.id,
              name: m.title,
              avatar: m.image,
              type: m.type
            }))
          ];

          // Deduplicate by id
          const uniqueRecipients = Array.from(new Map(formattedRecipients.map(r => [r.id, r])).values());
          setRecipients(uniqueRecipients);
        } catch (e) {
          console.error('Failed to fetch recipients', e);
        } finally {
          setLoading(false);
        }
      };
      fetchRecipients();
    }
  }, [isOpen, user]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSend = () => {
    if (!user || !socket || selectedIds.length === 0) return;

    selectedIds.forEach(id => {
      const [type, realId] = id.split(':');
      const messageData: any = {
        user_id: user.id,
        content: `Shared ${item.type}: ${item.title}`,
        type: 'shared_item',
        metadata: JSON.stringify({
          id: item.id,
          type: item.type,
          title: item.title,
          image: item.image,
          author_name: item.author_name
        })
      };

      if (type === 'user') {
        messageData.recipient_id = parseInt(realId);
      } else if (type === 'idea') {
        messageData.idea_id = parseInt(realId);
      } else if (type === 'project') {
        messageData.project_id = parseInt(realId);
      }

      socket.emit('send_message', messageData);
    });

    onClose();
    setSelectedIds([]);
  };

  const filteredRecipients = recipients.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

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
        data-ui-dialog="project-share" role="dialog" aria-modal="true" className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        <div className="shrink-0 p-6 border-b border-slate-200 flex items-center justify-between bg-white/50 backdrop-blur-md">
          <h2 className="text-xl font-bold text-slate-900">Share</h2>
          <button aria-label="Close share" onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="shrink-0 p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search recipients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRecipients.length === 0 ? (
            <p className="text-center py-8 text-slate-500 text-sm">No recipients found</p>
          ) : (
            filteredRecipients.map(r => {
              const isSelected = selectedIds.includes(r.id);
              return (
                <div
                  key={r.id}
                  data-share-recipient={r.id}
                  onClick={() => toggleSelection(r.id)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500/50'
                      : 'bg-slate-50/30 border-slate-200 hover:border-slate-200'
                  }`}
                >
                  <div className="relative">
                    <img src={r.avatar || undefined} alt="" className={`w-10 h-10 rounded-full object-cover ${getAccountTypeBorderClass(r.account_type, 'border-2')}`} />
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-slate-200">
                      {r.type === 'direct' ? (
                        <User className="w-3 h-3 text-blue-600" />
                      ) : (
                        <Users className="w-3 h-3 text-emerald-700" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{r.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {r.type === 'direct' ? 'Direct Message' : `${r.type} Group`}
                    </p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-slate-200 text-transparent group-hover:border-slate-500'
                  }`}>
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 p-6 border-t border-slate-200 bg-white/50 backdrop-blur-md">
          <button
            data-testid="project-share-send" onClick={handleSend}
            disabled={selectedIds.length === 0}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Send className="w-5 h-5" />
            Send to {selectedIds.length} {selectedIds.length === 1 ? 'recipient' : 'recipients'}
          </button>
        </div>
      </div>
    </div>
  );
}
