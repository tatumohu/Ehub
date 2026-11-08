import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, FileText, Check, Plus, RefreshCw, AlertCircle, Edit3, History, Shield, Info, Lock, Search, Filter, Send, Bot, UserCheck, Bookmark, Clock, Eye, Copy, Zap } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import PlanUpgradeModal from './PlanUpgradeModal';
import { AiContractChatView } from './AiContractChatView';

interface ContractSelectorModalProps {
  onClose: () => void;
  type: 'nda' | 'outsourcing';
  category?: 'recruitment' | 'offer' | 'scout' | 'common';
  onSelectContract: (contract: { id?: number; title: string; body: string }) => void;
  initialTitle?: string;
  initialBody?: string;
  targetProjectTitle?: string;
  targetRole?: string;
  initialTab?: 'templates' | 'ai' | 'custom';
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export default function ContractSelectorModal({
  onClose,
  type,
  category = 'common',
  onSelectContract,
  initialTitle,
  initialBody,
  targetProjectTitle,
  targetRole,
  initialTab = 'templates'
}: ContractSelectorModalProps) {
  const { user, language } = useAppContext();
  const [tab, setTab] = useState<'templates' | 'ai' | 'custom'>(initialTab);

  // Template List State
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // AI Interactive Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `作成したい契約文章について教えてください。\n\n【入力例】\n「3か月間のWebアプリ開発について、個人エンジニアへ業務を委託する契約書を作成したいです。\n成果物の知的財産権は発注側へ譲渡し、報酬は月額30万円を想定しています。」\n\nご要望を自由な自然文で入力いただければ、契約種類（業務委託、秘密保持等）に応じた必要事項（業務範囲・報酬・権利帰属等）を確認・ヒアリングしながら、AIが契約書文章を自動作成いたします。`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiGeneratedBody, setAiGeneratedBody] = useState<string>(initialBody || '');
  const [aiGeneratedTitle, setAiGeneratedTitle] = useState<string>(initialTitle || (type === 'nda' ? '秘密保持契約書 (NDA)' : '業務委託契約書 (契約案)'));
  const [previousAiBody, setPreviousAiBody] = useState<string>('');
  const [isDiffView, setIsDiffView] = useState<boolean>(false);
  const [isEditingGenerated, setIsEditingGenerated] = useState<boolean>(false);
  const [editableAiBody, setEditableAiBody] = useState<string>(initialBody || '');
  const [editableAiTitle, setEditableAiTitle] = useState<string>(initialTitle || (type === 'nda' ? '秘密保持契約書 (NDA)' : '業務委託契約書 (契約案)'));
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState<boolean>(false);
  const [aiLimitInfo, setAiLimitInfo] = useState<{ used_count: number; max_limit: number; remaining: number; plan?: string; plan_label?: string } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSubTab, setAiSubTab] = useState<'chat' | 'preview'>('chat');
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Custom Edit state
  const [customTitle, setCustomTitle] = useState(initialTitle || (type === 'nda' ? '秘密保持契約書' : '業務委託契約書'));
  const [customBody, setCustomBody] = useState(initialBody || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  useEffect(() => {
    fetchTemplates();
    fetchAiLimits();
  }, [user, type, category, statusFilter]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchTemplates = () => {
    if (!user) return;
    setLoading(true);
    const query = new URLSearchParams({
      user_id: user.id.toString(),
      type: type,
      category: category,
      status: statusFilter,
      keyword: searchKeyword
    });

    fetch(`/api/contracts?${query.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTemplates(data);
          if (data.length > 0 && !customBody) {
            setSelectedTemplateId(data[0].id);
            setCustomTitle(data[0].title);
            setCustomBody(data[0].body);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchAiLimits = () => {
    if (!user) return;
    fetch(`/api/contracts/ai-limits?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setAiLimitInfo(data);
        }
      })
      .catch(console.error);
  };

  const handleSwitchPlan = async (newPlan: 'light' | 'standard' | 'enterprise') => {
    if (!user) return;
    try {
      const res = await fetch('/api/users/plan', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({ user_id: user.id, plan: newPlan })
      });
      if (res.ok) {
        fetchAiLimits();
        setAiError(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendChatMessage = async (presetText?: string) => {
    const textToSend = presetText || inputMessage;
    if (!textToSend.trim() || isAiProcessing || !user) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    if (!presetText) setInputMessage('');
    setIsAiProcessing(true);
    setAiError(null);

    // Identify if this is a revision within the current session
    // If chatMessages has more than 1 message (initial AI prompt already sent) OR aiGeneratedBody exists, it is a revision.
    const isRevision = chatMessages.length > 1 || Boolean(aiGeneratedBody);

    try {
      const res = await fetch('/api/contracts/chat-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({
          user_id: user.id,
          type,
          category,
          projectTitle: targetProjectTitle,
          role: targetRole,
          is_revision: isRevision,
          messages: newMessages.map(m => ({ sender: m.sender, text: m.text }))
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setAiError(data.message || 'AI生成に失敗しました。');
      } else {
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: data.replyMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, aiMsg]);
        if (data.contractBody) {
          setPreviousAiBody(aiGeneratedBody);
          setAiGeneratedBody(data.contractBody);
          setEditableAiBody(data.contractBody);
        }
        if (data.contractTitle) {
          setAiGeneratedTitle(data.contractTitle);
          setEditableAiTitle(data.contractTitle);
        }
        if (data.remaining !== undefined) {
          setAiLimitInfo({
            used_count: data.used_count,
            max_limit: data.max_limit,
            remaining: data.remaining,
            plan: data.plan,
            plan_label: data.plan_label
          });
        }
      }
    } catch (e) {
      console.error(e);
      setAiError('通信エラーが発生しました。');
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Requirement 12: Save as Template
  const handleSaveAsTemplate = async () => {
    const finalTitle = editableAiTitle || aiGeneratedTitle;
    const finalBody = editableAiBody || aiGeneratedBody;
    if (!user || !finalBody.trim()) return;

    setIsSavingTemplate(true);
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({
          title: finalTitle,
          type: type,
          category: category,
          description: 'AI対話生成および手修正により保存された社内共通契約テンプレート',
          body: finalBody,
          tags: 'AI作成,社内テンプレート',
          sharing_scope: 'all',
          is_template: true,
          author_id: user.id
        })
      });

      if (res.ok) {
        setTemplateSaveSuccess(true);
        fetchTemplates();
        setTimeout(() => setTemplateSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save template:', e);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Requirement 12: Discard generated content
  const handleDiscard = () => {
    if (window.confirm('AI生成された文章を破棄してクリアしますか？')) {
      setAiGeneratedBody('');
      setPreviousAiBody('');
      setEditableAiBody('');
      setIsEditingGenerated(false);
      setIsDiffView(false);
    }
  };

  const handleApplyContract = (contractTitle: string, contractBody: string, id?: number) => {
    onSelectContract({
      id,
      title: contractTitle,
      body: contractBody
    });
    onClose();
  };

  // Simple diff line calculator
  const lineDiffs = React.useMemo(() => {
    const currentBody = isEditingGenerated ? editableAiBody : aiGeneratedBody;
    if (!previousAiBody || previousAiBody === currentBody) return [];

    const oldLines = previousAiBody.split('\n');
    const newLines = currentBody.split('\n');
    const diffs: { type: 'added' | 'removed' | 'unchanged'; text: string }[] = [];

    let i = 0;
    let j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        diffs.push({ type: 'unchanged', text: oldLines[i] });
        i++;
        j++;
      } else if (j < newLines.length && (!oldLines.includes(newLines[j]) || (i < oldLines.length && oldLines[i] !== newLines[j]))) {
        diffs.push({ type: 'added', text: newLines[j] });
        j++;
      } else if (i < oldLines.length) {
        diffs.push({ type: 'removed', text: oldLines[i] });
        i++;
      }
    }
    return diffs;
  }, [previousAiBody, aiGeneratedBody, editableAiBody, isEditingGenerated]);

  const modalContent = (
    <div className="fixed inset-0 z-[120] bg-black/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden my-auto flex flex-col h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${type === 'nda' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'}`}>
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                {type === 'nda' ? '秘密保持契約書 (NDA) の選択・AI作成' : '業務委託契約書の選択・AI作成'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                スカウト作成画面へ契約文面を個別コピーして編集できます（自動送信・自動締結はありません）
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/90 px-4 pt-3 gap-2 shrink-0">
          <button
            onClick={() => setTab('templates')}
            className={`px-4 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm flex items-center gap-2 border-t border-x transition-colors ${
              tab === 'templates'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 border-b-transparent'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            保存済み文章から選択
          </button>
          <button
            onClick={() => setTab('ai')}
            className={`px-4 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm flex items-center gap-2 border-t border-x transition-colors relative ${
              tab === 'ai'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 border-slate-200 dark:border-slate-700 border-b-transparent'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-indigo-600 dark:hover:text-indigo-300'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-300 animate-pulse" />
            AIによる自動生成 (チャット形式)
            {aiLimitInfo && (
              <span className="text-[10px] bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full border border-indigo-500/30 font-bold">
                残{aiLimitInfo.remaining}回
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('custom')}
            className={`px-4 py-2.5 rounded-t-xl font-bold text-xs sm:text-sm flex items-center gap-2 border-t border-x transition-colors ${
              tab === 'custom'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 border-b-transparent'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            直接入力・確認
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col">
          {tab === 'templates' && (
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Filter & Search Bar */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={e => setSearchKeyword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && fetchTemplates()}
                      placeholder="タイトル・本文・作成者で検索..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    onClick={fetchTemplates}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-white rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1.5"
                  >
                    <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    検索実行
                  </button>
                </div>

                {/* Filter Tags */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-bold mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" />
                    絞り込み:
                  </span>
                  {[
                    { id: 'all', label: 'すべて' },
                    { id: 'nda', label: '秘密保持契約' },
                    { id: 'outsourcing', label: '業務委託契約' },
                    { id: 'available', label: '利用可能' },
                    { id: 'draft', label: '下書き' },
                    { id: 'archived', label: 'アーカイブ' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id)}
                      className={`px-2.5 py-1 rounded-md font-bold transition-colors text-[11px] ${
                        statusFilter === f.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {loading ? (
                  <div className="py-16 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span>テンプレート一覧を読み込んでいます...</span>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-300">該当する契約書テンプレートが見つかりません</p>
                    <p className="text-xs text-slate-500 mt-1">「AIによる自動生成」または「直接入力」でお好みを作成できます</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5">
                    {templates.map(tpl => {
                      const updatedDate = tpl.updated_at ? new Date(tpl.updated_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '未設定';
                      const isNda = tpl.type === 'nda';
                      const statusLabel = tpl.status === 'draft' ? '下書き' : tpl.status === 'archived' ? 'アーカイブ' : '利用可能';
                      const statusBg = tpl.status === 'draft' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/30' : tpl.status === 'archived' ? 'bg-slate-200 dark:bg-slate-700/50 text-slate-700 dark:text-slate-400' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30';

                      return (
                        <div
                          key={tpl.id}
                          className="p-4 rounded-xl border bg-slate-50/60 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
                        >
                          {/* Header Line */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isNda ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'}`}>
                                {isNda ? '秘密保持契約 (NDA)' : '業務委託契約'}
                              </span>
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white">{tpl.title}</h4>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-300 dark:border-slate-700">
                                v{tpl.version || 1}.0
                              </span>
                            </div>
                            <button
                              onClick={() => handleApplyContract(tpl.title, tpl.body, tpl.id)}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-1.5 shrink-0"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              この文章をスカウトにコピー
                            </button>
                          </div>

                          {/* Detail Metadata Grid (Req 4.B Item checklist) */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono">
                            <div>
                              <span className="text-slate-500 block">最終更新日:</span>
                              <strong className="text-slate-800 dark:text-slate-200">{updatedDate}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">作成者:</span>
                              <strong className="text-slate-800 dark:text-slate-200">{tpl.author_name || '社内管理者'}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">使用回数:</span>
                              <strong className="text-slate-800 dark:text-slate-200">{tpl.usage_count || 0} 回</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">ステータス:</span>
                              <span className={`inline-block px-1.5 py-0.2 rounded font-bold border ${statusBg}`}>
                                {statusLabel}
                              </span>
                            </div>
                          </div>

                          {/* Contract Body Snippet */}
                          <div className="text-xs text-slate-800 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap font-mono bg-slate-100/60 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800/80 leading-relaxed">
                            {tpl.body}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'ai' && (
            <div className="flex flex-col h-full space-y-3 flex-1 overflow-hidden">
              {/* Requirement 14: Light Plan Guidance Modal View */}
              {aiLimitInfo?.plan === 'light' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-6 my-auto max-w-2xl mx-auto shadow-xl">
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                    <Sparkles className="w-10 h-10 text-amber-500 dark:text-amber-300" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                      契約文章のAI自動生成は、Standardプラン以上で利用できます。
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line max-w-lg mx-auto">
                      チャット形式で条件を入力すると、秘密保持契約や業務委託契約の文章案を作成できます。{"\n"}
                      生成後は自由に編集・保存できます。
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
                    <button
                      type="button"
                      onClick={() => setShowUpgradeModal(true)}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                      プランを確認する
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('templates')}
                      className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 font-bold text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 transition-all"
                    >
                      閉じる
                    </button>
                  </div>

                  {/* Demo Plan Switcher */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 w-full flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>プラン切り替えテスト:</span>
                    <button
                      onClick={() => handleSwitchPlan('standard')}
                      className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-600/30 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-500/40 rounded-lg font-bold transition-all"
                    >
                      Standardプランへ切替 (月1回)
                    </button>
                    <button
                      onClick={() => handleSwitchPlan('enterprise')}
                      className="px-2.5 py-1 bg-amber-50 dark:bg-amber-600/30 hover:bg-amber-100 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40 rounded-lg font-bold transition-all"
                    >
                      Enterpriseプランへ切替 (無制限)
                    </button>
                  </div>
                </div>
              ) : aiLimitInfo?.plan === 'standard' && (aiLimitInfo?.used_count >= aiLimitInfo?.max_limit) ? (
                /* Requirement 15: Standard Plan Limit Reached Modal View */
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-6 my-auto max-w-2xl mx-auto shadow-xl">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl">
                    <AlertCircle className="w-10 h-10 text-amber-500 dark:text-amber-300" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                      今月の契約文章AI生成枠を使用しました。
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line max-w-lg mx-auto">
                      Enterpriseプランでは、契約文章のAI生成を無制限で利用できます。{"\n"}
                      来月まで待つか、プランをご確認ください。
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
                    <button
                      type="button"
                      onClick={() => setShowUpgradeModal(true)}
                      className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg hover:shadow-amber-500/25 transition-all flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
                      Enterpriseプランを確認する
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('templates')}
                      className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 font-bold text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 transition-all"
                    >
                      閉じる
                    </button>
                  </div>

                  <div className="p-3.5 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 text-left w-full space-y-1">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 block">閲覧・編集・保存機能は引き続きご利用いただけます</span>
                    <p>過去に生成・保存した契約文章の閲覧、編集、複製、およびスカウトへの添付利用は可能です。AIによる新規生成のみが制限されています。</p>
                  </div>

                  {/* Demo Plan Switcher */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 w-full flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>プラン切り替えテスト:</span>
                    <button
                      onClick={() => handleSwitchPlan('enterprise')}
                      className="px-2.5 py-1 bg-amber-50 dark:bg-amber-600/30 hover:bg-amber-100 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40 rounded-lg font-bold transition-all"
                    >
                      Enterpriseプランへ切替
                    </button>
                    <button
                      onClick={() => handleSwitchPlan('light')}
                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg font-bold transition-all"
                    >
                      Lightプランへ切替
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Requirement 11 Warning Banner */}
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2 shrink-0 shadow-sm mb-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="leading-relaxed text-[11px]">
                      <strong className="text-amber-900 dark:text-amber-300 font-bold block mb-0.5">【ご注意（契約書たたき台の利用について）】</strong>
                      AIが生成する文章は契約書のたたき台です。実際に使用する前に、契約当事者および必要に応じて弁護士などの専門家が内容を確認してください。
                    </div>
                  </div>

                  <AiContractChatView
                    aiSubTab={aiSubTab}
                    setAiSubTab={setAiSubTab}
                    aiLimitInfo={aiLimitInfo}
                    handleSwitchPlan={handleSwitchPlan}
                    chatMessages={chatMessages}
                    isAiProcessing={isAiProcessing}
                    chatBottomRef={chatBottomRef}
                    chatInputRef={chatInputRef}
                    inputMessage={inputMessage}
                    setInputMessage={setInputMessage}
                    handleSendChatMessage={handleSendChatMessage}
                    aiGeneratedTitle={aiGeneratedTitle}
                    aiGeneratedBody={aiGeneratedBody}
                    editableAiTitle={editableAiTitle}
                    setEditableAiTitle={setEditableAiTitle}
                    editableAiBody={editableAiBody}
                    setEditableAiBody={setEditableAiBody}
                    previousAiBody={previousAiBody}
                    isDiffView={isDiffView}
                    setIsDiffView={setIsDiffView}
                    isEditingGenerated={isEditingGenerated}
                    setIsEditingGenerated={setIsEditingGenerated}
                    lineDiffs={lineDiffs}
                    templateSaveSuccess={templateSaveSuccess}
                    handleSaveAsTemplate={handleSaveAsTemplate}
                    handleDiscard={handleDiscard}
                    handleApplyContract={handleApplyContract}
                    isSavingTemplate={isSavingTemplate}
                  />

            </div>
          )}
      </div>
    )}

          {tab === 'custom' && (
            <div className="space-y-3 flex-1 flex flex-col">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">契約書タイトル</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex-1 flex flex-col min-h-[250px]">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">契約書本文（テキストエリアへ直接入力・貼り付け対応）</label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">文字数: <strong className="text-slate-900 dark:text-white">{customBody.length}</strong> 文字</span>
                </div>
                <textarea
                  value={customBody}
                  onChange={e => setCustomBody(e.target.value)}
                  rows={12}
                  placeholder="ここに契約文章を直接入力または貼り付け（ペースト）してください..."
                  className="w-full flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-mono leading-relaxed focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => handleApplyContract(customTitle, customBody, selectedTemplateId || undefined)}
                  disabled={!customTitle || !customBody}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  編集内容で決定・スカウトにコピー
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showUpgradeModal && (
        <PlanUpgradeModal
          onClose={() => {
            setShowUpgradeModal(false);
            fetchAiLimits();
            fetchTemplates();
          }}
        />
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

