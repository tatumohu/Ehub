import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface JoinProjectModalProps {
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  projectName: string;
}

export default function JoinProjectModal({ onClose, onSubmit, projectName }: JoinProjectModalProps) {
  const { language } = useAppContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form fields
  const [reason, setReason] = useState('');
  const [skills, setSkills] = useState('');
  const [role, setRole] = useState('');
  const [period, setPeriod] = useState('');
  const [hours, setHours] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ reason, skills, role, period, hours, message });
      onClose();
    } catch (err) {
      console.error(err);
      alert(language === 'ja' ? '参加申請に失敗しました。' : 'Failed to submit join request.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 pb-24">
      <div className="bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80dvh] md:max-h-[85vh]">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 backdrop-blur-md shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" />
              {language === 'ja' ? 'プロジェクト参加申請' : 'Project Join Request'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {language === 'ja' ? '「' + projectName + '」への参加申請を送信します。' : 'Send join request for "' + projectName + '".'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form id="join-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">{language === 'ja' ? '参加理由' : 'Reason for joining'}</label>
              <textarea 
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={language === 'ja' ? 'なぜこのプロジェクトに参加したいですか？' : 'Why do you want to join this project?'}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-blue-500 transition-colors h-24 resize-none"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{language === 'ja' ? '貢献できるスキル' : 'Skills you can contribute'}</label>
                <input 
                  type="text" 
                  value={skills}
                  onChange={e => setSkills(e.target.value)}
                  placeholder={language === 'ja' ? '例：UIデザイン、React' : 'e.g., UI Design, React'}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{language === 'ja' ? '希望する役割' : 'Desired Role'}</label>
                <input 
                  type="text" 
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder={language === 'ja' ? '例：エンジニア、リサーチャー' : 'e.g., Engineer, Researcher'}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{language === 'ja' ? '参加可能な期間' : 'Available Period'}</label>
                <input 
                  type="text" 
                  value={period}
                  onChange={e => setPeriod(e.target.value)}
                  placeholder={language === 'ja' ? '例：3ヶ月、未定' : 'e.g., 3 months, TBD'}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{language === 'ja' ? '週当たりの参加可能時間' : 'Available Hours per Week'}</label>
                <input 
                  type="text" 
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  placeholder={language === 'ja' ? '例：週10時間' : 'e.g., 10 hours/week'}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">{language === 'ja' ? '補足メッセージ' : 'Additional Message'}</label>
              <textarea 
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={language === 'ja' ? 'その他伝えたいことがあればご記入ください' : 'Any other information you want to share'}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3 focus:outline-none focus:border-blue-500 transition-colors h-24 resize-none"
              />
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end gap-3 shrink-0">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isSubmitting}
            className="px-6 py-3 font-bold text-slate-400 hover:text-white transition-colors"
          >
            {language === 'ja' ? 'キャンセル' : 'Cancel'}
          </button>
          <button 
            type="submit"
            form="join-form"
            disabled={isSubmitting}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {language === 'ja' ? '申請する' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
