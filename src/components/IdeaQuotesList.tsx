import React, { useEffect, useState } from 'react';
import { Lightbulb, Sparkles, Loader2, Send, Bookmark, Check, X, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAppContext } from '../context/AppContext';
import ScoutMessageModal from './ScoutMessageModal';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface IdeaQuotesListProps {
  item: {
    id: number;
    type: 'project' | 'idea';
    title?: string;
  };
  isAuthor?: boolean;
}

export default function IdeaQuotesList({ item, isAuthor }: IdeaQuotesListProps) {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompileSelect, setShowCompileSelect] = useState(false);
  const [selectedCompileIdeas, setSelectedCompileIdeas] = useState<number[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [scoutTarget, setScoutTarget] = useState<any | null>(null);
  const navigate = useNavigate();
  const { user, language } = useAppContext();

  const isOrg = user?.account_type === 'organization';

  const fetchIdeas = () => {
    if (isOrg) {
      // Fetch ideas with selection status for recruitment
      fetch(`/api/recruitment/${item.id}/ideas?org_id=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setIdeas(data);
            setLoading(false);
            return;
          }
          // Fallback
          fetchStandardQuotes();
        })
        .catch(() => fetchStandardQuotes());
    } else {
      fetchStandardQuotes();
    }
  };

  const fetchStandardQuotes = () => {
    fetch(`/api/items/${item.type}/${item.id}/quotes${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`)
      .then(res => res.json())
      .then(data => {
        setIdeas(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchIdeas();
  }, [item, user, isOrg]);

  const updateSelectionStatus = async (ideaId: number, status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const res = await fetch(`/api/recruitment/${item.id}/ideas/${ideaId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id.toString() },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, selection_status: status } : i));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAISummarize = async () => {
    if (selectedCompileIdeas.length === 0) return;
    setIsSummarizing(true);
    try {
      const selectedContent = ideas
        .filter(i => selectedCompileIdeas.includes(i.id))
        .map(i => `Title: ${i.title}\nDescription: ${i.description}`)
        .join('\n\n---\n\n');

      const res = await fetch('/api/ideas/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedContent })
      });
      if (res.ok) {
        const data = await res.json();
        navigate(`/compile/${item.id}`, {
          state: {
            selectedIdeas: ideas.filter(i => selectedCompileIdeas.includes(i.id)),
            aiSummary: data.result
          }
        });
      } else {
        alert('Failed to summarize ideas');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to summarize ideas');
    } finally {
      setIsSummarizing(false);
    }
  };

  const safeFormatDistance = (dateStr: string) => {
    try {
      if (!dateStr) return 'some time ago';
      const date = new Date((dateStr || '') + (!(dateStr || '').includes('Z') ? 'Z' : ''));
      if (isNaN(date.getTime())) return 'some time ago';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'some time ago';
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status || status === 'unreviewed') return <span className="px-2 py-0.5 bg-slate-50 text-slate-600 text-xs rounded border border-slate-200 font-medium">未選考</span>;
    if (status === 'shortlisted') return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-700 text-xs rounded border border-amber-500/30 font-bold">候補</span>;
    if (status === 'scouted') return <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-700 text-xs rounded border border-indigo-500/30 font-bold">スカウト送信済み</span>;
    if (status === 'accepted') return <span className="px-2 py-0.5 bg-green-500/20 text-green-700 text-xs rounded border border-green-500/30 font-bold">承諾済み</span>;
    if (status === 'declined') return <span className="px-2 py-0.5 bg-rose-500/20 text-rose-700 text-xs rounded border border-rose-500/30 font-bold">辞退済み</span>;
    if (status === 'not_selected') return <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-xs rounded border border-slate-200 font-medium">対象外</span>;
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 flex justify-center items-center h-32 mb-6">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (ideas.length === 0) return null;

  return (
    <div id="idea-quotes-list" className="bg-white rounded-3xl border border-slate-200 flex flex-col shadow-xl mb-6 relative">
      <div className="p-6 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          投稿されたIdea ({ideas.length})
        </h2>
        {isAuthor && item.type === 'project' && (
          <button
            onClick={() => setShowCompileSelect(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg transition-colors"
          >
            Compile
          </button>
        )}
      </div>

      <div className="p-6 space-y-4">
        {ideas.map((idea) => (
          <div
            key={idea.id}
            onClick={() => navigate(`/idea/${idea.id}`)}
            className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50/70 transition-all cursor-pointer space-y-3"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={idea.author_avatar || undefined}
                  alt={idea.author_name}
                  className={`w-10 h-10 rounded-full object-cover shrink-0 ${getAccountTypeBorderClass(idea.author_account_type || idea.account_type, 'border-2')}`}
                />
                <div>
                  <div className="text-sm font-bold text-slate-900">{idea.author_name}</div>
                  <div className="text-xs text-slate-500">{safeFormatDistance(idea.created_at)}</div>
                </div>
              </div>
              {isOrg && isAuthor && getStatusBadge(idea.selection_status)}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">{idea.title}</h3>
              <div className="text-sm text-slate-700 line-clamp-2">
                {idea.description?.replace(/<[^>]*>?/gm, '')}
              </div>
            </div>

            {/* Selection Actions for Org / Recruitment Author */}
            {isOrg && isAuthor && (
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => updateSelectionStatus(idea.id, 'shortlisted', e)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      idea.selection_status === 'shortlisted'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-50 hover:bg-slate-100 text-amber-700 border border-amber-500/30'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    候補として保存
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setScoutTarget(idea);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    スカウトする
                  </button>

                  <button
                    onClick={(e) => updateSelectionStatus(idea.id, 'not_selected', e)}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-medium transition-colors"
                  >
                    今回は選択しない
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <Link
                    to={`/profile/${idea.author_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    プロフィール
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {scoutTarget && (
        <ScoutMessageModal
          sourceType="recruitment"
          recruitmentId={item.id}
          recruitmentTitle={item.title}
          ideaId={scoutTarget.id}
          ideaTitle={scoutTarget.title}
          targetUserIds={[scoutTarget.author_id.toString()]}
          targetUserNames={[scoutTarget.author_name]}
          onClose={() => setScoutTarget(null)}
        />
      )}

      {showCompileSelect && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div data-ui-dialog="project-compile" role="dialog" aria-modal="true" className="bg-white max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl w-full max-w-lg border border-slate-200 p-6 md:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-900">Select Ideas to Compile</h3>
              <button
                onClick={handleAISummarize}
                disabled={selectedCompileIdeas.length === 0 || isSummarizing}
                className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="AI Compile"
              >
                {isSummarizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              </button>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto mb-8 pr-2 custom-scrollbar">
              {ideas.map((idea) => (
                <label key={idea.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-slate-300 bg-white text-blue-500 focus:ring-blue-500 focus:ring-offset-white"
                    checked={selectedCompileIdeas.includes(idea.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedCompileIdeas([...selectedCompileIdeas, idea.id]);
                      else setSelectedCompileIdeas(selectedCompileIdeas.filter(id => id !== idea.id));
                    }}
                  />
                  <div className="flex-1 min-w-0">
                     <div className="text-sm font-bold text-slate-900 truncate">{idea.title}</div>
                     <div className="text-xs text-slate-600 mt-1 truncate">{idea.description?.replace(/<[^>]*>?/gm, '').substring(0, 80)}...</div>
                  </div>
                  <img src={idea.author_avatar || undefined} alt="" className={`w-8 h-8 rounded-full object-cover shrink-0 ${getAccountTypeBorderClass(idea.author_account_type || idea.account_type, 'border-2')}`} />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-4">
              <button
                className="px-6 py-2.5 text-slate-600 hover:text-slate-900 font-medium transition-colors"
                onClick={() => setShowCompileSelect(false)}
              >
                Cancel
              </button>
              <button
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-full font-bold shadow-lg transition-all"
                onClick={() => {
                  navigate(`/compile/${item.id}`, { state: { selectedIdeas: ideas.filter(i => selectedCompileIdeas.includes(i.id)) } });
                }}
                disabled={selectedCompileIdeas.length === 0}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
