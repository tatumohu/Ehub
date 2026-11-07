import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Inbox, Send as SendIcon, CheckCircle, Clock, XCircle, Search, MessageSquare, Briefcase } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';
import ScoutDetailModal from './ScoutDetailModal';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface ScoutInboxModalProps {
  onClose: () => void;
  initialTab?: string;
  initialScoutId?: number;
}

export default function ScoutInboxModal({ onClose, initialTab = 'all', initialScoutId }: ScoutInboxModalProps) {
  const { user, language } = useAppContext();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'recruitment' | 'offer' | 'direct'>('all');
  const [scouts, setScouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScout, setSelectedScout] = useState<any | null>(null);

  const isOrg = user?.account_type === 'organization';

  const fetchScouts = () => {
    if (!user) return;
    setLoading(true);
    const endpoint = isOrg ? `/api/scouts/sent?user_id=${user.id}` : `/api/scouts/received?user_id=${user.id}`;
    fetch(endpoint)
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setScouts(list);
        setLoading(false);
        if (initialScoutId) {
          const match = list.find((s: any) => s.id === Number(initialScoutId));
          if (match) {
            setSelectedScout(match);
          }
        }
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchScouts();
  }, [user, isOrg]);

  const tabs = isOrg ? [
    { id: 'all', label: language === 'ja' ? 'すべて' : 'All' },
    { id: 'draft', label: language === 'ja' ? '下書き' : 'Drafts' },
    { id: 'sent', label: language === 'ja' ? '送信済み' : 'Sent' },
    { id: 'viewed', label: language === 'ja' ? '閲覧済み' : 'Viewed' },
    { id: 'on_hold', label: language === 'ja' ? '保留中' : 'On Hold' },
    { id: 'accepted', label: language === 'ja' ? '承諾済み' : 'Accepted' },
    { id: 'declined', label: language === 'ja' ? '辞退済み' : 'Declined' },
  ] : [
    { id: 'all', label: language === 'ja' ? 'すべて' : 'All' },
    { id: 'sent', label: language === 'ja' ? '未読' : 'Unread' },
    { id: 'on_hold', label: language === 'ja' ? '保留中' : 'On Hold' },
    { id: 'accepted', label: language === 'ja' ? '承諾済み' : 'Accepted' },
    { id: 'declined', label: language === 'ja' ? '辞退済み' : 'Declined' },
  ];

  const filteredScouts = scouts.filter(s => {
    const matchesTab = activeTab === 'all' || s.status === activeTab || (activeTab === 'sent' && s.status === 'viewed' && !isOrg);
    const matchesSource = sourceFilter === 'all' || (s.source_type || 'direct') === sourceFilter;
    return matchesTab && matchesSource;
  });
  // Note: for individuals, "unread" tab is mapped to "sent". Actually we just mapped 'sent' to Unread above.
  
  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      draft: language === 'ja' ? '下書き' : 'Draft',
      sent: isOrg ? (language === 'ja' ? '送信済み' : 'Sent') : (language === 'ja' ? '未読' : 'Unread'),
      viewed: language === 'ja' ? '閲覧済み' : 'Viewed',
      on_hold: language === 'ja' ? '保留中' : 'On Hold',
      accepted: language === 'ja' ? '承諾済み' : 'Accepted',
      declined: language === 'ja' ? '辞退済み' : 'Declined',
      expired: language === 'ja' ? '期限切れ' : 'Expired',
      withdrawn: language === 'ja' ? '取り下げ' : 'Withdrawn',
      discussion: language === 'ja' ? '条件確認中' : 'Discussion',
      confirmation_requested: language === 'ja' ? '契約確認依頼中' : 'Confirmation Requested',
      confirmed: language === 'ja' ? '参加移行' : 'Confirmed',
      completed: language === 'ja' ? '完了' : 'Completed',
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'viewed': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'on_hold': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'accepted': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'confirmation_requested': return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
      case 'confirmed': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'declined': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'expired': return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              {isOrg ? <SendIcon className="w-5 h-5 text-indigo-400" /> : <Inbox className="w-5 h-5 text-indigo-400" />}
            </div>
            <h2 className="text-xl font-bold text-white">
              {isOrg ? (language === 'ja' ? '送信したスカウト' : 'Sent Scouts') : (language === 'ja' ? '受け取ったスカウト' : 'Received Scouts')}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-800 bg-slate-900/80 p-2 space-y-2">
          {/* Status Tabs */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Source Pathway Filter Sub-bar */}
          <div className="flex gap-2 pt-1 border-t border-slate-800/60 overflow-x-auto hide-scrollbar">
            <span className="text-xs text-slate-500 self-center px-1 font-medium">{language === 'ja' ? '経路:' : 'Path:'}</span>
            {[
              { id: 'all', label: language === 'ja' ? 'すべて' : 'All' },
              { id: 'recruitment', label: 'Project' },
              { id: 'offer', label: 'Proposal' },
              { id: 'direct', label: language === 'ja' ? '指名スカウト' : 'Direct' },
            ].map(source => (
              <button
                key={source.id}
                onClick={() => setSourceFilter(source.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border whitespace-nowrap ${
                  sourceFilter === source.id
                    ? 'bg-slate-800 text-indigo-400 border-indigo-500/50'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                {source.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading...</div>
          ) : filteredScouts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Inbox className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>{language === 'ja' ? '該当するスカウトがありません' : 'No scouts found'}</p>
            </div>
          ) : (
            filteredScouts.map((scout, idx) => (
              <div key={`scout-${scout.id}-${idx}`} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-indigo-500/30 transition-colors flex flex-col sm:flex-row gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {scout.source_type === 'recruitment' && (
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold rounded">Project</span>
                        )}
                        {scout.source_type === 'offer' && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded">Proposal</span>
                        )}
                        {(!scout.source_type || scout.source_type === 'direct') && (
                          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold rounded">指名スカウト</span>
                        )}
                        <h3 className="font-bold text-white text-base truncate inline-block">
                          {scout.title}
                        </h3>
                      </div>
                      {(scout.recruitment_title || scout.offer_title || scout.idea_title) && (
                        <div className="text-xs text-slate-400">
                          {scout.recruitment_title && <span>Project: <strong className="text-slate-200">{scout.recruitment_title}</strong></span>}
                          {scout.offer_title && <span>Proposal: <strong className="text-slate-200">{scout.offer_title}</strong></span>}
                          {scout.idea_title && <span className="ml-2">Idea: <strong className="text-slate-200">{scout.idea_title}</strong></span>}
                        </div>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap shrink-0 ${getStatusColor(scout.status)}`}>
                      {getStatusText(scout.status)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {isOrg ? (
                         <>
                           <img src={scout.receiver_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${scout.receiver_name}`} className={`w-6 h-6 rounded-full bg-slate-700 object-cover ${getAccountTypeBorderClass(scout.receiver_account_type || 'individual', 'border-2')}`} alt="" />
                           <span>{scout.receiver_name}</span>
                         </>
                      ) : (
                         <>
                           <img src={scout.sender_avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${scout.sender_name}`} className={`w-6 h-6 rounded-full bg-slate-700 object-cover ${getAccountTypeBorderClass(scout.sender_account_type || 'organization', 'border-2')}`} alt="" />
                           <span>{scout.sender_name}</span>
                         </>
                      )}
                    </div>
                    {scout.role && (
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4" />
                        <span>{scout.role}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(scout.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center sm:pl-4 sm:border-l border-slate-700">
                  <button 
                    onClick={() => setSelectedScout(scout)}
                    className="w-full sm:w-auto px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition-colors whitespace-nowrap"
                  >
                    {language === 'ja' ? '詳細を見る' : 'View Details'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedScout && (
        <ScoutDetailModal
          scoutId={selectedScout.id}
          onClose={() => {
            setSelectedScout(null);
            fetchScouts();
          }}
        />
      )}
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
