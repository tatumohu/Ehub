import React, { useState } from 'react';
import { RotateCcw, X, AlertCircle } from 'lucide-react';

interface ProposalRemandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: string; requestedChanges: string; notes: string }) => void;
  loading?: boolean;
}

export default function ProposalRemandModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false
}: ProposalRemandModalProps) {
  const [reason, setReason] = useState('');
  const [requestedChanges, setRequestedChanges] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('差し戻し理由を入力してください。');
      return;
    }
    if (!requestedChanges.trim()) {
      setError('修正してほしい内容を入力してください。');
      return;
    }

    setError('');
    onSubmit({
      reason: reason.trim(),
      requestedChanges: requestedChanges.trim(),
      notes: notes.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-2 text-amber-400">
          <RotateCcw className="w-6 h-6 shrink-0" />
          <h3 className="text-lg font-bold">提案の差し戻し</h3>
        </div>
        <p className="text-xs text-slate-400 mb-6">
          提案者へ修正コメントを添えて差し戻します。元のIdeaは変更されません。
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              差し戻し理由 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例: 技術的な実現方法を、もう少し具体的に記載してください。"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              修正してほしい内容 <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              value={requestedChanges}
              onChange={(e) => setRequestedChanges(e.target.value)}
              placeholder="具体的修正指示を入力してください..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              補足コメント (任意)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="アドバイスや補足など..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              差し戻す
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
