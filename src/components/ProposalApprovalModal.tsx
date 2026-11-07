import React from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface ProposalApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export default function ProposalApprovalModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false
}: ProposalApprovalModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 text-blue-400">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <h3 className="text-lg font-bold">編集提案の承認確認</h3>
        </div>

        <div className="space-y-3 text-sm text-slate-300 mb-6 bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
          <p className="font-bold text-white text-base">この変更内容を承認しますか？</p>
          <p className="text-slate-400 leading-relaxed">
            承認すると、現在公開されているIdeaが新しい内容に更新されます。
            <br />
            以前の内容は履歴として保存されます。
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            承認する
          </button>
        </div>
      </div>
    </div>
  );
}
