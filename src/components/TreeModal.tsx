import React, { useState, useEffect } from 'react';
import { X, Plus, Heart, MessageSquare, Bookmark, Layers, GitBranch, ArrowRight, List, Sparkles, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface TreeItem {
  id: number;
  title: string;
  description: string;
  image?: string;
  stage: number;
  author_name: string;
  author_avatar?: string;
  author_account_type?: string;
  account_type?: string;
  quoted_item_id?: number | null;
  quoted_item_type?: string | null;
  likes_count?: number;
  comments_count?: number;
  archives_count?: number;
  version?: number;
  status?: string;
  children?: TreeItem[];
}

interface TreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentItem: {
    id: number;
    title: string;
    type: 'idea' | 'project';
    quoted_item_id?: number | null;
    quoted_item_type?: string | null;
  };
  onNewProposal?: (parentId: number, parentType: 'idea' | 'project') => void;
}

export default function TreeModal({
  isOpen,
  onClose,
  currentItem,
  onNewProposal
}: TreeModalProps) {
  const [treeData, setTreeData] = useState<TreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number>(currentItem.id);

  useEffect(() => {
    if (isOpen && currentItem.id) {
      setLoading(true);
      // Fetch full lineage & children tree for this item
      const itemType = currentItem.type;
      fetch(`/api/lineage?id=${currentItem.id}&type=${itemType}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setTreeData(data);
          } else if (data.nodes) {
            setTreeData(data.nodes);
          } else {
            setTreeData([]);
          }
        })
        .catch(err => console.error("Error fetching tree data:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, currentItem.id, currentItem.type]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        data-ui-dialog="project-tree" role="dialog" aria-modal="true" className="bg-white border border-slate-200 rounded-3xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="p-5 px-6 border-b border-slate-200 flex items-center justify-between bg-white/60">
          <div className="flex items-center gap-3">
            <button
              aria-label="Close tree" onClick={onClose}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>戻る</span>
            </button>
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span>Idea ツリー構造</span>
                <span className="text-xs font-normal text-slate-600 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200">
                  横型ダイアグラム
                </span>
              </h3>
              <p className="text-xs text-slate-600">
                アイデアの派生・編集履歴をビジュアルに確認できます
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // List view toggle feedback
              }}
              className="px-3 py-1.5 bg-slate-50/80 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <List className="w-4 h-4 text-blue-600" />
              ≡ 一覧
            </button>
            <button
              aria-label="Close tree" onClick={onClose}
              className="p-2 bg-slate-50/80 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tree Container (Horizontal Scrollable Canvas) */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-8 flex items-center bg-radial-pattern bg-[length:24px_24px] bg-white/80">
          {loading ? (
            <div className="w-full text-center py-20 text-slate-500 text-sm">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
              ツリー構造を読み込み中...
            </div>
          ) : treeData.length === 0 ? (
            /* Fallback layout with current item if tree endpoint empty */
            <div className="flex items-center gap-6 min-w-max mx-auto py-10">
              <TreeCard
                item={{
                  id: currentItem.id,
                  title: currentItem.title,
                  description: '選択されたアクティブ項目',
                  stage: 1,
                  author_name: '投稿者',
                  version: 1
                }}
                isActive={true}
                isEma={currentItem.type === 'project'}
              />
              <div className="flex items-center text-blue-600 gap-1 font-black text-xs px-2 animate-pulse">
                <span>&gt;&gt;</span>
                <span className="tracking-widest">NEXT</span>
              </div>
              <AddProposalNode
                parentId={currentItem.id}
                parentType={currentItem.type}
                onNewProposal={onNewProposal}
              />
            </div>
          ) : (
            <div className="flex items-center gap-6 min-w-max px-4 py-8">
              {treeData.map((node, index) => {
                const isActive = node.id === currentItem.id;
                const isLast = index === treeData.length - 1;
                return (
                  <React.Fragment key={node.id}>
                    <TreeCard
                      item={node}
                      isActive={isActive}
                      isEma={node.quoted_item_type === 'project' || index === 0}
                    />

                    <div className="flex items-center text-blue-600/80 gap-1 font-black text-xs px-1">
                      <span>&gt;&gt;</span>
                      <span className="tracking-widest text-[10px]">NEXT</span>
                    </div>

                    {isLast && (
                      <AddProposalNode
                        parentId={node.id}
                        parentType="idea"
                        onNewProposal={onNewProposal}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-4 px-6 border-t border-slate-200 bg-white/80 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500" />
              青枠 glow: 現在選択中のIdea
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              ヘッダー多角形: Vision（元の親課題）
            </span>
          </div>

          <div className="text-slate-500 text-[11px]">
            ※ 各カードの「＋ 新しいIdeaを提案」をクリックすると親を固定して作成できます
          </div>
        </div>
      </div>
    </div>
  );
}

function TreeCard({ item, isActive, isEma }: { item: TreeItem; isActive: boolean; isEma?: boolean }) {
  return (
    <div className={`relative w-72 rounded-2xl transition-all transform hover:-translate-y-1 duration-200 ${
      isActive
        ? 'ring-2 ring-blue-500 shadow-[0_10px_30px_rgba(59,130,246,0.35)] bg-white'
        : 'bg-white/80 border border-slate-200 hover:border-slate-200'
    }`}>
      {/* Top Banner Header (Vision styling vs Standard Idea styling) */}
      <div className={`p-3 px-4 rounded-t-2xl flex items-center justify-between border-b ${
        isEma
          ? 'bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border-blue-500/30 text-blue-300'
          : 'bg-slate-50/50 border-slate-200 text-slate-700'
      }`}>
        <span className="text-[11px] font-bold tracking-wide flex items-center gap-1.5">
          {isEma ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Vision (課題領域)</span>
            </>
          ) : (
            <>
              <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
              <span>Idea v{item.version || 1}</span>
            </>
          )}
        </span>
        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 font-bold">
          Stage {item.stage || 1}
        </span>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3">
        {item.image && (
          <div className="h-28 w-full rounded-xl overflow-hidden border border-slate-200/80">
            <img src={item.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        )}

        <div>
          <h4 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug mb-1">
            {item.title}
          </h4>
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {item.description?.replace(/<[^>]*>?/gm, '') || ''}
          </p>
        </div>

        {/* Footer Meta */}
        <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <div className={`w-5 h-5 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center font-bold text-[10px] text-slate-700 shrink-0 ${getAccountTypeBorderClass(item.author_account_type || item.account_type, 'border-2')}`}>
              {item.author_avatar ? (
                <img src={item.author_avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                item.author_name?.charAt(0) || 'U'
              )}
            </div>
            <span className="truncate max-w-[90px]">{item.author_name}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-600">
            <span className="flex items-center gap-0.5">
              <Heart className="w-3 h-3 text-rose-700" />
              {item.likes_count || 0}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageSquare className="w-3 h-3 text-blue-600" />
              {item.comments_count || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddProposalNode({ parentId, parentType, onNewProposal }: { parentId: number; parentType: 'idea' | 'project'; onNewProposal?: (id: number, type: 'idea' | 'project') => void }) {
  return (
    <button
      onClick={() => {
        if (onNewProposal) {
          onNewProposal(parentId, parentType);
        } else {
          window.location.href = `/create-idea?quoted_item_id=${parentId}&quoted_item_type=${parentType}&from_tree=1`;
        }
      }}
      className="w-64 h-56 rounded-2xl border-2 border-dashed border-blue-500/40 hover:border-blue-400 bg-blue-500/5 hover:bg-blue-500/10 transition-all flex flex-col items-center justify-center gap-3 p-6 text-center group cursor-pointer shadow-lg"
    >
      <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/30">
        <Plus className="w-6 h-6 stroke-[3]" />
      </div>
      <div>
        <span className="font-bold text-sm text-blue-300 group-hover:text-slate-900 block mb-1">
          ＋ 新しいIdeaを提案
        </span>
        <span className="text-[11px] text-slate-600 block">
          このノードから新しいIdeaを分岐提案します
        </span>
      </div>
    </button>
  );
}
