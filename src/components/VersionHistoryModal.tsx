import React, { useState, useEffect } from 'react';
import { History, X, Clock, User, CheckCircle2, ChevronRight, FileText } from 'lucide-react';

interface VersionItem {
  id: number;
  idea_id: number;
  version: number;
  title: string;
  description: string;
  image: string;
  author_name?: string;
  author_avatar?: string;
  proposer_name?: string;
  proposer_avatar?: string;
  approver_name?: string;
  approver_avatar?: string;
  change_reason?: string;
  created_at: string;
  approved_at: string;
  status: string;
}

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  ideaId: number;
  currentTitle?: string;
  currentVersion?: number;
}

export default function VersionHistoryModal({
  isOpen,
  onClose,
  ideaId,
  currentTitle,
  currentVersion = 1
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionItem | null>(null);

  useEffect(() => {
    if (isOpen && ideaId) {
      setLoading(true);
      fetch(`/api/ideas/${ideaId}/versions`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setVersions(data);
            if (data.length > 0) setSelectedVersion(data[0]);
          }
        })
        .catch(err => console.error("Error fetching versions:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, ideaId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        data-ui-dialog="project-versions" role="dialog" aria-modal="true" className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl relative overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-600">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">バージョン履歴 (Version History)</h3>
              <p className="text-xs text-slate-600 truncate max-w-md">
                {currentTitle || `Idea #${ideaId}`} (現在: v{currentVersion})
              </p>
            </div>
          </div>
          <button
            aria-label="Close versions" onClick={onClose}
            className="p-2 bg-slate-50/80 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Version List Sidebar */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto p-4 space-y-3 bg-white/30">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                履歴を取得中...
              </div>
            ) : versions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                バージョン履歴が登録されていません (v1のみ)
              </div>
            ) : (
              versions.map((ver) => {
                const isSelected = selectedVersion?.id === ver.id;
                return (
                  <button
                    key={ver.id}
                    onClick={() => setSelectedVersion(ver)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-lg'
                        : 'bg-slate-50/40 border-slate-200 hover:bg-slate-50/80 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        v{ver.version}
                      </span>
                      <span className="text-[10px] text-slate-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ver.approved_at || ver.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm truncate mb-1">{ver.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-1">{ver.change_reason || '更新提案承認'}</p>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                      <span>提案: {ver.proposer_name || ver.author_name || '不明'}</span>
                      {ver.approver_name && <span>承認: {ver.approver_name}</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Version Detail */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedVersion ? (
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-1">
                      Version v{selectedVersion.version} Details
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedVersion.title}</h2>
                  </div>
                  <div className="text-right text-xs text-slate-600">
                    <p>作成・承認日: {new Date(selectedVersion.approved_at || selectedVersion.created_at).toLocaleString()}</p>
                    <p className="text-emerald-700 font-medium mt-1">承認者: {selectedVersion.approver_name || '管理者'}</p>
                  </div>
                </div>

                {selectedVersion.image && (
                  <div className="aspect-video w-full max-h-64 rounded-2xl overflow-hidden mb-6 border border-slate-200">
                    <img
                      src={selectedVersion.image}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <div className="bg-slate-50/40 border border-slate-200 rounded-2xl p-5 mb-6">
                  <h3 className="text-xs font-bold uppercase text-slate-600 mb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    変更・作成内容
                  </h3>
                  <div
                    className="text-slate-200 text-sm leading-relaxed prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedVersion.description || '内容なし' }}
                  />
                </div>

                {selectedVersion.change_reason && (
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-xs text-blue-300">
                    <span className="font-bold block mb-1">変更理由・メモ:</span>
                    {selectedVersion.change_reason}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                左側のリストからバージョンを選択してください
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
