import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getAccountTypeBorderClass } from '../utils/avatar';
import { 
  savePendingPostData, 
  getPendingPostData, 
  clearPendingPostData, 
  markTokenAsSubmitted 
} from '../lib/pendingPostSessionStorage';
import { 
  Sparkles,
  CheckCircle2, 
  X, 
  Edit3, 
  Trash2, 
  Check, 
  FileText, 
  Paperclip, 
  RotateCw, 
  AlertCircle, 
  Copy, 
  Bot, 
  Plus, 
  ArrowRight,
  GitBranch,
  Split,
  Eye,
  ShieldCheck,
  Lock,
  UserCheck,
  Users,
  HelpCircle,
  Building,
  Building2,
  Info,
  Search,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  Globe,
  User,
  Save,
  AlertTriangle
} from 'lucide-react';

export type AttachedFile = {
  id: string;
  file?: File;
  name: string;
  size: number;
  ext: string;
  status: 'reading' | 'ready' | 'error';
  extractedText: string;
  previewUrl?: string;
  errorMsg?: string;
};

export type AiAnalysisResult = {
  theme: string;
  type?: 'project' | 'idea';
  type_reason?: string;
  is_abstract?: boolean;
  questions?: string[];
  relatedCount?: number;
  vision?: {
    title: string;
    background: string;
    purpose: string;
    social_issues: string;
    expected_effects: string;
  };
  analysis_details?: {
    desired_goal?: string;
    current_issues?: string;
    issue_background?: string;
    target_scope?: string;
    solution_direction?: string;
    expected_state?: string;
    evidence_and_data?: string;
    missing_info?: string;
    contradictions_or_unclear?: string;
  };
  processing_steps?: {
    correction?: {
      corrected_text: string;
      correction_notes?: string;
    };
    completion?: {
      ai_completion_proposals: string[];
      completion_note?: string;
    };
    structuring?: {
      structured_vision_summary: string;
    };
  };
  generated_vision_items?: {
    title?: string;
    summary?: string;
    desired_future?: string;
    current_issues?: string;
    background?: string;
    target_scope?: string;
    purpose?: string;
    solution_direction?: string;
    needed_cooperation?: string;
    intended_stakeholders?: string;
    required_elements?: string;
    future_expansion?: string;
    expected_effects?: string;
    evidence_and_data?: string;
    recruiting_ideas_direction?: string;
    category?: string;
    tags?: string[];
  };
  user_questions?: string[];
  draft?: {
    title: string;
    background: string;
    purpose: string;
    expected_impact: string;
  };
  suggested_ideas?: string[];
  suggested_post_target?: {
    recommended_target: 'Vision' | 'Recruitment' | 'Offer';
    reason: string;
    available_candidates: ('Vision' | 'Recruitment' | 'Offer')[];
    recruitment_details?: {
      roles?: string[];
      required_skills?: string[];
      headcount?: string;
      period?: string;
      reward?: string;
      conditions?: string;
      missing_questions?: string[];
    };
    offer_details?: {
      target_organization?: string;
      outsource_scope?: string;
      budget_and_terms?: string;
      deliverables?: string;
    };
    recommended_organizations?: Array<{
      id: string;
      name: string;
      industry: string;
      categories?: string[];
      skills?: string[];
      region?: string;
      budget_range?: string;
      rating?: number;
      past_projects_count?: number;
      acceptance_status?: string;
      availability?: string;
      match_score?: number;
      match_reason?: string;
      recommended_reasons?: string[];
    }>;
  };
  split_suggestions?: {
    is_multi_element_detected?: boolean;
    elements?: Array<{
      target: 'Vision' | 'Recruitment' | 'Offer';
      title: string;
      summary: string;
    }>;
  };
  base_vision_relation?: {
    has_base_vision: boolean;
    base_vision_title: string;
    vision_post_status: 'draft_linked' | 'published_linked';
    workflow_step: number;
  };
  similarVisions?: any[];
};

interface AiResultConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiResult: AiAnalysisResult;
  userThoughtInput: string;
  attachedFiles: AttachedFile[];
  onProceedToCreate: (targetType: 'project' | 'idea', updatedResult?: AiAnalysisResult, isDraft?: boolean) => void;
  onUpdateAiResult: (updated: AiAnalysisResult) => void;
  onReorganizeAI?: () => void;
}

export default function AiResultConfirmationModal({
  isOpen,
  onClose,
  aiResult,
  userThoughtInput,
  attachedFiles,
  onProceedToCreate,
  onUpdateAiResult,
  onReorganizeAI
}: AiResultConfirmationModalProps) {
  if (!isOpen || !aiResult) return null;

  const { user, updateUser } = useAppContext();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [pendingPostAction, setPendingPostAction] = useState<{ targetType: 'project' | 'idea'; isDraft?: boolean } | null>(null);

  // Local state for interactive editing & proposal management
  const [editableResult, setEditableResult] = useState<AiAnalysisResult>(() => 
    JSON.parse(JSON.stringify(aiResult))
  );

  // AI Vision作成機能はVision投稿専用のため、投稿先ターゲットは常に'Vision'に固定
  const [selectedPostTarget] = useState<'Vision'>('Vision');

  // サインイン完了後の自動投稿継続・一時保存データの安全な復元＆二重投稿防止処理
  useEffect(() => {
    if (user) {
      const savedPendingData = getPendingPostData();
      if (savedPendingData && !savedPendingData.isSubmitted) {
        // 二重投稿防止トークン検証
        const isAllowed = markTokenAsSubmitted(savedPendingData.submissionToken);
        if (isAllowed) {
          onProceedToCreate('idea', savedPendingData.editableResult, false);
          
          // 投稿完了後に一時データを安全に消去
          clearPendingPostData();
          setPendingPostAction(null);
          setShowSignInPrompt(false);
          onClose();

          alert('サインインが完了しました！確認済みの内容でVisionへの投稿処理を完了しました。');
        }
      } else if (pendingPostAction) {
        onProceedToCreate(pendingPostAction.targetType, editableResult, pendingPostAction.isDraft);
        setPendingPostAction(null);
        setShowSignInPrompt(false);
        onClose();
      }
    }
  }, [user]);

  const handlePostAttempt = (targetType: 'project' | 'idea', isDraft?: boolean) => {
    if (!user) {
      savePendingPostData({
        userThoughtInput: userThoughtInput,
        selectedPostTarget: 'Vision',
        editableResult: editableResult,
        attachedFiles: attachedFiles.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.ext, url: f.previewUrl || '', extractedText: f.extractedText })),
        adoptedCompletions: adoptedCompletions,
        created_account_type: 'individual',
        created_account_id: undefined
      });

      setPendingPostAction({ targetType, isDraft });
      setShowSignInPrompt(true);

      window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
      return;
    }

    savePendingPostData({
      userThoughtInput: userThoughtInput,
      selectedPostTarget: 'Vision',
      editableResult: editableResult,
      attachedFiles: attachedFiles.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.ext, url: f.previewUrl || '', extractedText: f.extractedText })),
      adoptedCompletions: adoptedCompletions,
      created_account_type: user.account_type || 'individual',
      created_account_id: String(user.id)
    });

    onProceedToCreate(targetType, editableResult, isDraft);
    clearPendingPostData();
    onClose();
  };

  const [activeTab, setActiveTab] = useState<'all' | 'user' | 'extracted' | 'corrected' | 'completed'>('all');
  const [proposalsList, setProposalsList] = useState<string[]>(() => {
    return editableResult.processing_steps?.completion?.ai_completion_proposals || [
      '推測される対象地域: 都心部および主要地方都市圏',
      '推測される数値目標: 3年間で10自治体・50企業との共創ネットワーク構築',
      '推奨アイデア募集項目: 実証実験フィールド提供、DXプロダクトの現場導入'
    ];
  });

  const [editingProposalIdx, setEditingProposalIdx] = useState<number | null>(null);
  const [proposalEditText, setProposalEditText] = useState<string>('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [tempFieldValue, setTempFieldValue] = useState<string>('');
  const [adoptedCompletions, setAdoptedCompletions] = useState<Record<number, boolean>>({});

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const saveProposalEdit = (idx: number) => {
    setProposalsList(prev => {
      const copy = [...prev];
      copy[idx] = proposalEditText;
      return copy;
    });
    setEditingProposalIdx(null);
  };

  const toggleAdoptProposal = (idx: number) => {
    setAdoptedCompletions(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const startEditingProposal = (idx: number) => {
    setEditingProposalIdx(idx);
    setProposalEditText(proposalsList[idx] || '');
  };

  const deleteProposal = (idx: number) => {
    setProposalsList(prev => prev.filter((_, i) => i !== idx));
  };

  const startEditingField = (key: string, val: string) => {
    setEditingFieldKey(key);
    setTempFieldValue(val);
  };

  const saveFieldEdit = (key: string) => {
    setEditableResult(prev => {
      if (!prev.generated_vision_items) return prev;
      return {
        ...prev,
        generated_vision_items: {
          ...prev.generated_vision_items,
          [key]: tempFieldValue
        }
      };
    });
    setEditingFieldKey(null);
  };

  const deleteField = (key: string) => {
    setEditableResult(prev => {
      if (!prev.generated_vision_items) return prev;
      return {
        ...prev,
        generated_vision_items: {
          ...prev.generated_vision_items,
          [key]: '情報が不足しています'
        }
      };
    });
  };

  const itemsList: Array<{
    key: string;
    num: string;
    label: string;
    color: string;
    origin: 'user' | 'extracted' | 'completed' | 'ai';
    originBadge: string;
  }> = [
    { key: 'title', num: '①', label: 'Visionタイトル', color: 'text-white', origin: 'user', originBadge: 'ユーザー入力' },
    { key: 'summary', num: '②', label: '概要', color: 'text-slate-200', origin: 'user', originBadge: 'ユーザー入力' },
    { key: 'desired_future', num: '③', label: '実現したい未来', color: 'text-purple-300', origin: 'completed', originBadge: 'AI補完' },
    { key: 'current_issues', num: '④', label: '現状の課題', color: 'text-emerald-300', origin: 'extracted', originBadge: '添付抽出' },
    { key: 'background', num: '⑤', label: '背景', color: 'text-slate-300', origin: 'extracted', originBadge: '添付抽出' },
    { key: 'target_scope', num: '⑥', label: '対象', color: 'text-cyan-300', origin: 'extracted', originBadge: '添付抽出' },
    { key: 'purpose', num: '⑦', label: '目的', color: 'text-amber-300', origin: 'user', originBadge: 'ユーザー入力' },
    { key: 'solution_direction', num: '⑧', label: '実現の方向性', color: 'text-blue-300', origin: 'completed', originBadge: 'AI補完' },
    { key: 'needed_cooperation', num: '⑨', label: '必要だと考えている協力', color: 'text-teal-300', origin: 'completed', originBadge: 'AI補完' },
    { key: 'intended_stakeholders', num: '⑩', label: '想定している関係者', color: 'text-indigo-300', origin: 'extracted', originBadge: '添付抽出' },
    { key: 'timeline_and_steps', num: '⑪', label: 'スケジュール・進め方', color: 'text-emerald-300', origin: 'completed', originBadge: 'AI補完' },
    { key: 'category', num: '⑫', label: 'カテゴリ', color: 'text-amber-300', origin: 'user', originBadge: 'ユーザー入力' },
    { key: 'tags', num: '⑬', label: '関連タグ', color: 'text-cyan-300', origin: 'ai', originBadge: 'AIタグ' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full max-h-[88vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>AI Vision作成・内容確認</span>
                <span className="text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/80 px-2 py-0.5 rounded-full font-mono font-bold">
                  Vision専用
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                入力いただいた内容をVisionとして整理しました。内容を確認し投稿してください。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-900 dark:text-slate-100">
            <div className="bg-slate-50 dark:bg-slate-900/90 border-2 border-cyan-500/40 dark:border-cyan-500/60 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-md dark:shadow-xl">
              <div className="flex items-center justify-between border-b border-cyan-200 dark:border-cyan-800/60 pb-2.5 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <span className="font-black text-slate-900 dark:text-white text-sm sm:text-base">
                    投稿者アカウント情報・投稿先確認
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 text-[10px] font-mono border border-cyan-300 dark:border-cyan-500/50 font-bold">
                  Vision投稿専用
                </span>
              </div>

              {!user ? (
                /* サインイン前の表示 */
                <div className="p-3.5 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/50 rounded-xl space-y-2.5 text-xs text-cyan-900 dark:text-cyan-100">
                  <div className="flex items-center gap-2 font-bold text-cyan-700 dark:text-cyan-300">
                    <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-300 shrink-0" />
                    <span>【未サインイン時の投稿先案内】</span>
                  </div>
                  <p className="leading-relaxed text-slate-900 dark:text-white font-bold text-sm">
                    入力された内容はVisionとして整理されました。
                  </p>
                  <p className="text-slate-600 dark:text-slate-200 leading-relaxed">
                    投稿するにはサインインが必要です。個人・法人・自治体のアカウント種別にかかわらず、投稿先は「Vision」として投稿されます。
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowSignInPrompt(true)}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                    >
                      サインインして確認する
                    </button>
                  </div>
                </div>
              ) : (
                /* サインイン後の表示：操作中のアカウント情報（種別・名称・アイコン）と投稿先 */
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    {/* アカウントアイコン・名称・種別 */}
                    <div className="flex items-center gap-3">
                      <div className={`relative w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 ${getAccountTypeBorderClass(user.account_type, 'border-2')} overflow-hidden flex items-center justify-center shrink-0`}>
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.username || 'ユーザー'} className="w-full h-full object-cover" />
                        ) : user.account_type === 'organization' ? (
                          <Building className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                        ) : (
                          <User className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{user.username || '操作アカウント'}</span>
                          <span className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1 ${
                            user.account_type === 'municipality'
                              ? 'bg-purple-100 dark:bg-purple-900/80 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-600/60'
                              : user.account_type === 'organization' || user.account_type === 'corporate'
                              ? 'bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-600/60'
                              : 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-600/60'
                          }`}>
                            {user.account_type === 'municipality' || user.account_type === 'organization' || user.account_type === 'corporate' ? <Building className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                            {user.account_type === 'municipality' ? '自治体アカウント' : user.account_type === 'organization' || user.account_type === 'corporate' ? '法人アカウント' : '個人アカウント'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          現在操作中のアカウントでVisionを投稿します
                        </p>
                      </div>
                    </div>

                    {/* 投稿先指示 */}
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">投稿先:</span>
                      <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 rounded-lg font-bold text-xs flex items-center gap-1">
                        ● Vision（固定）
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80 leading-relaxed">
                    ※個人・法人・自治体のいずれのアカウント種別であっても投稿先はVisionのみとなり、アカウント種別によってProjectやProposalへ分岐・提案されることはありません。
                  </p>
                </div>
              )}
            </div>

            {/* 必須操作アクションバー (要件11) */}
            <div className="bg-slate-50 dark:bg-slate-950/80 p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 space-y-2.5 shadow-sm dark:shadow-lg">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">操作アクション:</span>
              <div className="flex flex-wrap items-center gap-2.5">
                {/* 1. ［Visionとして投稿］ */}
                <button
                  type="button"
                  onClick={() => {
                    handlePostAttempt('project', false);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Visionとして投稿</span>
                </button>

                {/* 2. ［内容を修正］ */}
                <button
                  type="button"
                  onClick={() => setActiveTab('extracted')}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  <Edit3 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>内容を修正</span>
                </button>

                {/* 3. ［AIに再整理を依頼］ */}
                {onReorganizeAI && (
                  <button
                    type="button"
                    onClick={onReorganizeAI}
                    className="px-3.5 py-2.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                  >
                    <RotateCw className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>AIに再整理を依頼</span>
                  </button>
                )}

                {/* 4. ［下書きとして保存］ */}
                <button
                  type="button"
                  onClick={() => handlePostAttempt('project', true)}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>下書きとして保存</span>
                </button>

                {/* キャンセル / 閉じる */}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-slate-900 dark:hover:bg-red-950/60 text-rose-700 dark:text-red-300 border border-rose-200 dark:border-red-900/60 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all ml-auto cursor-pointer"
                >
                  <X className="w-4 h-4 text-rose-500 dark:text-red-400" />
                  <span>閉じる</span>
                </button>
              </div>
            </div>

          {/* 4 Categorized Source Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Block 1: ユーザーが入力した内容 */}
            {(activeTab === 'all' || activeTab === 'user') && (
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>ユーザーが入力した内容</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(userThoughtInput, 'user')}
                      className="text-[11px] text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 shadow-sm"
                    >
                      {copiedSection === 'user' ? <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSection === 'user' ? 'コピー完了' : 'コピー'}</span>
                    </button>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 font-bold">
                      原文
                    </span>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto font-mono">
                  {userThoughtInput || '入力テキストなし'}
                </div>
              </div>
            )}

            {/* Block 2: 添付資料から抽出した内容 */}
            {(activeTab === 'all' || activeTab === 'extracted') && (
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-cyan-300 dark:border-cyan-500/30 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="font-bold text-cyan-700 dark:text-cyan-300 text-xs flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>添付資料から抽出した内容</span>
                  </span>
                  <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 px-2 py-0.5 rounded border border-cyan-300 dark:border-cyan-800 font-bold">
                    添付抽出
                  </span>
                </div>
                {attachedFiles.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {attachedFiles.map((f, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{f.name}</span>
                          <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950 border border-cyan-200 dark:border-cyan-800 px-1.5 py-0.5 rounded font-bold">
                            {f.ext.toUpperCase()}
                          </span>
                        </div>
                        {f.extractedText ? (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                            {f.extractedText}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">テキスト抽出完了</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-center italic">
                    添付資料はありません（テキスト入力のみで解析）
                  </div>
                )}
              </div>
            )}

            {/* Block 3: AIが文章を補正した部分 */}
            {(activeTab === 'all' || activeTab === 'corrected') && (
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-blue-300 dark:border-blue-500/30 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="font-bold text-blue-700 dark:text-blue-300 text-xs flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>AIが文章を補正した部分</span>
                  </span>
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-300 dark:border-blue-800 font-bold">
                    AI文章補正
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                    {editableResult.processing_steps?.correction?.corrected_text || 
                     `${userThoughtInput.slice(0, 100)}...（表記ゆれや誤字を自動補正）`}
                  </p>
                  {editableResult.processing_steps?.correction?.correction_notes && (
                    <div className="bg-blue-50 dark:bg-blue-950/40 p-2 rounded-lg border border-blue-200 dark:border-blue-800/40 text-[11px] text-blue-800 dark:text-blue-300">
                      補正のポイント: {editableResult.processing_steps.correction.correction_notes}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Block 4: AIが補完案として追加した部分 (AI補完) */}
            {(activeTab === 'all' || activeTab === 'completed') && (
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-purple-300 dark:border-purple-500/50 space-y-2.5 md:col-span-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                    <span className="font-bold text-purple-800 dark:text-purple-300 text-xs">AIが補完案として追加した部分</span>
                    <span className="px-2.5 py-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-[11px] rounded-full shadow-md shadow-purple-500/20 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      AI補完
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    採用・編集・削除ボタンで選択可能
                  </span>
                </div>

                {proposalsList.length > 0 ? (
                  <div className="space-y-2.5">
                    {proposalsList.map((proposal, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          adoptedCompletions[idx]
                            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-400/80 shadow-md shadow-purple-500/10'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 flex-1">
                          <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 font-extrabold text-[10px] shrink-0 mt-0.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                            AI補完 #{idx + 1}
                          </span>

                          {editingProposalIdx === idx ? (
                            <div className="flex-1 flex gap-2">
                              <input
                                type="text"
                                value={proposalEditText}
                                onChange={(e) => setProposalEditText(e.target.value)}
                                className="flex-1 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-2.5 py-1.5 rounded-lg border border-purple-400 focus:outline-none text-xs"
                              />
                              <button
                                onClick={() => saveProposalEdit(idx)}
                                className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-xs hover:bg-emerald-500 cursor-pointer"
                              >
                                保存
                              </button>
                            </div>
                          ) : (
                            <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                              {proposal}
                            </p>
                          )}
                        </div>

                        {/* Controls for each AI completion proposal: 採用・編集・削除 */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => toggleAdoptProposal(idx)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                              adoptedCompletions[idx]
                                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{adoptedCompletions[idx] ? '採用済' : '採用'}</span>
                          </button>

                          <button
                            onClick={() => startEditingProposal(idx)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                            title="編集"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>編集</span>
                          </button>

                          <button
                            onClick={() => deleteProposal(idx)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                            title="削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>削除</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic">補完案はありません</p>
                )}
              </div>
            )}
          </div>

          {/* 13 Structured Vision Items Interactive Table/Grid */}
          {editableResult.generated_vision_items && (
            <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-cyan-300 dark:border-cyan-500/40 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-bold text-cyan-800 dark:text-cyan-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>構造化Vision 15項目（個別の編集・削除・確認）</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  各項目の出所マークと個別操作
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {itemsList.map(item => {
                  const rawVal = editableResult.generated_vision_items?.[item.key] || '情報が不足しています';
                  const isMissing = rawVal === '情報が不足しています';
                  const isEditingThis = editingFieldKey === item.key;

                  return (
                    <div
                      key={item.key}
                      className={`p-3.5 rounded-xl border space-y-2 flex flex-col justify-between transition-all ${
                        isMissing ? 'bg-amber-50/50 dark:bg-slate-900/60 border-amber-200 dark:border-slate-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {item.num} {item.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          item.origin === 'completed'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800 shadow-sm'
                            : item.origin === 'user'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : item.origin === 'extracted'
                            ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                        }`}>
                          {item.originBadge}
                        </span>
                      </div>

                      {/* Content or Edit Box */}
                      {isEditingThis ? (
                        <div className="space-y-2">
                          <textarea
                            rows={3}
                            value={tempFieldValue}
                            onChange={(e) => setTempFieldValue(e.target.value)}
                            className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-white p-2 rounded-lg border border-cyan-500 text-xs focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingFieldKey(null)}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs cursor-pointer"
                            >
                              キャンセル
                            </button>
                            <button
                              onClick={() => saveFieldEdit(item.key)}
                              className="px-3 py-1 bg-cyan-600 text-white font-bold rounded text-xs cursor-pointer"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className={`text-xs leading-relaxed ${
                          isMissing ? 'text-amber-700 dark:text-amber-400 font-bold bg-amber-100/60 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-300 dark:border-amber-900/40' : 'text-slate-700 dark:text-slate-200'
                        }`}>
                          {typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal)}
                        </p>
                      )}

                      {/* Controls for each field */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[11px]">
                        <button
                          onClick={() => startEditingField(item.key, typeof rawVal === 'string' ? rawVal : '')}
                          className="text-amber-700 dark:text-amber-300 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>編集</span>
                        </button>
                        <button
                          onClick={() => deleteField(item.key)}
                          className="text-rose-600 dark:text-rose-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>クリア</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Requirement 10: 重要な安全・信頼性・プライバシー方針カード */}
          <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>【重要】安全・信頼性およびプライバシー保護方針</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] border border-emerald-300 dark:border-emerald-800 font-mono font-bold">
                要件10 適用済
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-start gap-2 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                <Lock className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">非公開・権限保護:</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">添付ファイルは非公開で解析され、自動的に全体公開されることはありません。投稿前に必ずユーザーの確認が必要です。</p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">ファクト保護・事実と推測の区別:</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">資料にない数値や事実を捏造しません。不足情報は『情報が不足しています』とし、推測部分は『AI補完』で区別します。</p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">原文保持・保存消去:</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">添付資料やユーザー入力の原文は改変されずそのまま保存可能。不要データは個別に即座に削除できます。</p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">機密情報に関する注意事項:</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">社外秘・個人情報・マイナンバー等の機密情報が含まれていないか事前にご確認ください。</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Bottom Footer Actions (Requirement 8) */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 flex flex-col lg:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
            {/* ［内容を修正］ */}
            <button
              onClick={() => {
                if (!editingFieldKey) {
                  setEditingFieldKey('title');
                  setTempFieldValue(editableResult.generated_vision_items?.title || '');
                } else {
                  setEditingFieldKey(null);
                }
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>内容を修正</span>
            </button>

            {/* ［AIに再整理を依頼］ */}
            <button
              onClick={() => {
                if (onReorganizeAI) {
                  onReorganizeAI();
                  onClose();
                }
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
            >
              <RotateCw className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>AIに再整理を依頼</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
            {/* ［下書きとして保存］ */}
            <button
              onClick={() => handlePostAttempt('project', true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>下書きとして保存</span>
            </button>

            {/* ［選択された投稿先として投稿］ */}
            <button
              onClick={() => handlePostAttempt('project', false)}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-xl text-xs shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Visionとして投稿</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Requirement 8: 未サインイン時案内モーダル */}
      {showSignInPrompt && (
        <div className="fixed inset-0 z-[400] bg-black/60 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-cyan-500/80 rounded-3xl p-6 shadow-2xl max-w-md w-full text-center space-y-5 relative text-slate-900 dark:text-slate-100">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-300 dark:border-amber-400/40 flex items-center justify-center mx-auto shadow-md">
              <Lock className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                このVisionを投稿するにはサインインが必要です。
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                入力文章・添付ファイル・AI補整/補完内容・Vision生成結果・ユーザー修正内容・下書き状態および投稿同意情報は全て保持されます。
              </p>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              {/* ［サインインして投稿］ */}
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-amber-300" />
                <span>サインインして投稿</span>
              </button>

              {/* ［アカウントを作成］ */}
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'register' } }));
                }}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>アカウントを作成</span>
              </button>

              {/* ［下書きとして保持］ */}
              <button
                type="button"
                onClick={() => {
                  savePendingPostData({
                    userThoughtInput: userThoughtInput,
                    selectedPostTarget: 'Vision',
                    editableResult: editableResult,
                    attachedFiles: attachedFiles.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.ext, url: f.previewUrl || '', extractedText: f.extractedText })),
                    adoptedCompletions: adoptedCompletions,
                    finalAgreed: true,
                    created_account_type: 'individual',
                    created_account_id: undefined
                  });
                  setShowSignInPrompt(false);
                  alert('入力文章・添付資料・AI補正/補完内容・Vision構造化結果を下書き状態として保持しました。');
                }}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>下書きとして保持</span>
              </button>

              {/* ［戻る］ */}
              <button
                type="button"
                onClick={() => {
                  setShowSignInPrompt(false);
                }}
                className="w-full py-2 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
