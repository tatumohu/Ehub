import React, { useEffect, useState } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface IdeaQuotesModalProps {
  item: {
    id: number;
    type: 'project' | 'idea';
  };
  onClose: () => void;
}

export default function IdeaQuotesModal({ item, onClose }: IdeaQuotesModalProps) {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/items/${item.type}/${item.id}/quotes`)
      .then(res => res.json())
      .then(data => {
        setIdeas(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [item]);

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

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-slate-900 rounded-3xl w-full max-w-2xl border border-slate-700 shadow-2xl flex flex-col h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            Submitted Ideas
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ideas.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No ideas submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ideas.map((idea, idx) => {
                // Group logic visual check: check if previous idea was by the same author to draw a divider?
                // The sketch has border bottoms for each.
                return (
                  <div 
                    key={idea.id}
                    onClick={() => navigate(`/idea/${idea.id}`)}
                    className="flex gap-4 p-4 rounded-xl border border-slate-800 bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <img 
                      src={idea.author_avatar || undefined} 
                      alt={idea.author_name}
                      className={`w-10 h-10 rounded-full object-cover shrink-0 ${getAccountTypeBorderClass(idea.author_account_type || idea.account_type, 'border-2')}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-400 mb-1">{idea.author_name}</div>
                      <h3 className="text-base font-medium text-white mb-2">{idea.title}</h3>
                      <div 
                        className="text-sm text-slate-300 whitespace-nowrap overflow-hidden"
                        style={{ WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 12em), transparent 100%)', maskImage: 'linear-gradient(to right, black calc(100% - 12em), transparent 100%)' }}
                      >
                        {idea.description?.replace(/<[^>]*>?/gm, '')}
                      </div>
                      {idea.quoted_item_title && idea.quoted_item_id && idea.quoted_item_type === 'idea' && (
                        <div className="text-sm text-slate-400 mt-2">
                          Replying to Idea <Link to={`/idea/${idea.quoted_item_id}`} className="text-blue-400 hover:underline" onClick={(e) => { e.stopPropagation(); onClose(); }}>{idea.quoted_item_title}</Link>
                        </div>
                      )}
                      <div className="text-xs text-slate-500 text-right mt-3 text-right">
                        {safeFormatDistance(idea.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
