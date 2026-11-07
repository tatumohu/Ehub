import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Bot, Loader2, AlertTriangle, Briefcase, FileText, Lock, Sparkles, ArrowRight, ShieldCheck, FileCode, Check, BookmarkPlus, Eye, EyeOff, CheckCircle2, Maximize2, Minimize2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import PlanUpgradeModal from './PlanUpgradeModal';
import ScoutDetailModal from './ScoutDetailModal';
import ContractSelectorModal from './ContractSelectorModal';

interface ScoutMessageModalProps {
  onClose: () => void;
  targetUserIds?: string[];
  targetUserNames?: string[];
  targetItemType?: 'idea' | 'project';
  targetItemId?: string;
  targetItemTitle?: string;

  // Pathway specific props
  sourceType?: 'recruitment' | 'offer' | 'direct';
  recruitmentId?: string | number;
  recruitmentTitle?: string;
  recruitmentContent?: string;
  offerId?: string | number;
  offerTitle?: string;
  offerContent?: string;
  ideaId?: string | number;
  ideaTitle?: string;
  ideaDescription?: string;
}

export default function ScoutMessageModal({ 
  onClose, 
  targetUserIds, 
  targetUserNames,
  targetItemType,
  targetItemId,
  targetItemTitle,
  sourceType = 'direct',
  recruitmentId,
  recruitmentTitle,
  recruitmentContent,
  offerId,
  offerTitle,
  offerContent,
  ideaId,
  ideaTitle,
  ideaDescription
}: ScoutMessageModalProps) {
  const { user, language } = useAppContext();
  const [step, setStep] = useState<1 | 2>(1);
  const [isSending, setIsSending] = useState(false);
  
  // Form fields
  const [projectId, setProjectId] = useState<string>(
    sourceType === 'direct' && targetItemType === 'project' ? targetItemId?.toString() || '' : ''
  );
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [role, setRole] = useState('');
  const [period, setPeriod] = useState('');
  const [rewardType, setRewardType] = useState('');
  const [rewardAmount, setRewardAmount] = useState('');
  const [location, setLocation] = useState('');
  const [nda, setNda] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Attached Contracts State
  const [ndaTitle, setNdaTitle] = useState('秘密保持契約書 (NDA)');
  const [ndaBody, setNdaBody] = useState(`【秘密保持契約書 (NDA)】\n\n本契約は、開示者（甲）と受領者（乙）との間において、本プロジェクトに関する秘密情報の取り扱いについて定めるものです。\n\n第1条（目的）\n乙は、甲から開示された秘密情報を、本プロジェクトの検討・実施の目的のみに使用し、他の目的に使用してはならない。\n\n第2条（秘密情報の定義）\n「秘密情報」とは、甲が乙に対し、書面、口頭、電子データ等により開示する技術上、営業上その他の事業に関する一切の情報をいう。\n\n第3条（秘密保持義務）\n乙は、甲の事前の書面による承諾を得ない限り、秘密情報を第三者に開示・漏洩してはならない。\n\n第4条（契約期間）\n本契約の有効期間は、同意の日から2年間とする。`);
  const [ndaAttach, setNdaAttach] = useState(false);
  const [ndaMandatory, setNdaMandatory] = useState(true);
  const [ndaPreviewOpen, setNdaPreviewOpen] = useState(false);
  const [ndaSaveMessage, setNdaSaveMessage] = useState<string | null>(null);
  const [ndaContractId, setNdaContractId] = useState<number | undefined>(undefined);

  const [outsourcingTitle, setOutsourcingTitle] = useState('業務委託契約書 (契約案)');
  const [outsourcingBody, setOutsourcingBody] = useState(`【業務委託契約書】\n\n委託者（甲）および受託者（乙）は、以下のとおり業務委託契約を締結する。\n\n第1条（委託業務の内容）\n甲は乙に対し、本スカウト条件記載の役務・業務を委託し、乙はこれを引き受ける。\n\n第2条（委託料および支払方法）\n委託料および支払時期・方法は、スカウト条件および双方の合意事項に基づき支払うものとする。\n\n第3条（成果物の著作権・知的財産権）\n本業務により生じた成果物の著作権その他知的財産権は、委託料の完済をもって甲に移転するものとする。\n\n第4条（契約解除）\n当事者の一方が本契約に違反した場合、相手方は本契約を解除することができる。`);
  const [outsourcingAttach, setOutsourcingAttach] = useState(false);
  const [outsourcingMandatory, setOutsourcingMandatory] = useState(true);
  const [outsourcingPreviewOpen, setOutsourcingPreviewOpen] = useState(false);
  const [outsourcingSaveMessage, setOutsourcingSaveMessage] = useState<string | null>(null);
  const [outsourcingContractId, setOutsourcingContractId] = useState<number | undefined>(undefined);

  const [activeContractModal, setActiveContractModal] = useState<{ type: 'nda' | 'outsourcing'; tab: 'templates' | 'ai' } | null>(null);
  
  // Modals & Duplicate Checks
  const [duplicateScout, setDuplicateScout] = useState<any | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showPlanUpgradeModal, setShowPlanUpgradeModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Data
  const [orgProjects, setOrgProjects] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  useEffect(() => {
    if (user?.id) {
      fetch(`/api/projects?user_id=${user.id}`)
        .then(res => res.json())
        .then(data => {
          const orgP = data.filter((p: any) => p.author_id.toString() === user.id.toString());
          setOrgProjects(orgP);
        });
    }
    
    // Auto fill based on pathway
    if (sourceType === 'recruitment') {
      setTitle(language === 'ja' ? `【Project】「${ideaTitle || targetItemTitle || 'Idea'}」に関するスカウト` : `Scout for Idea: ${ideaTitle || targetItemTitle || ''}`);
    } else if (sourceType === 'offer') {
      setTitle(language === 'ja' ? `【Proposal】提案いただいた「${offerTitle || targetItemTitle || 'Vision'}」についてのスカウト` : `Scout for Proposal: ${offerTitle || targetItemTitle || ''}`);
    } else if (targetItemTitle && targetItemType) {
      setTitle(language === 'ja' ? `「${targetItemTitle}」に関するご相談` : `Regarding your ${targetItemType}: ${targetItemTitle}`);
    }

    // Check duplicate on mount if target userId and pathway exist
    if (user?.id && targetUserIds && targetUserIds.length === 1) {
      const query = new URLSearchParams({
        sender_id: user.id.toString(),
        receiver_id: targetUserIds[0],
        source_type: sourceType,
        ...(recruitmentId ? { recruitment_id: recruitmentId.toString() } : {}),
        ...(offerId ? { offer_id: offerId.toString() } : {}),
        ...(projectId ? { project_id: projectId.toString() } : {})
      });
      fetch(`/api/scouts/check-duplicate?${query}`)
        .then(res => res.json())
        .then(data => {
          if (data.exists) {
            setDuplicateScout(data.scout);
            setShowDuplicateModal(true);
          }
        })
        .catch(console.error);
    }
  }, [user, sourceType, recruitmentTitle, offerTitle, ideaTitle, targetItemTitle]);

  const handleSaveAsTemplate = async (type: 'nda' | 'outsourcing') => {
    if (!user) return;
    const titleVal = type === 'nda' ? ndaTitle : outsourcingTitle;
    const bodyVal = type === 'nda' ? ndaBody : outsourcingBody;

    if (!titleVal.trim() || !bodyVal.trim()) {
      alert('契約書タイトルと本文を入力してください。');
      return;
    }

    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({
          title: titleVal.trim(),
          body: bodyVal.trim(),
          type,
          category: sourceType,
          is_template: 1,
          author_id: user.id
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (type === 'nda') {
          setNdaContractId(data.id);
          setNdaSaveMessage('テンプレートとして保存しました！');
          setTimeout(() => setNdaSaveMessage(null), 3000);
        } else {
          setOutsourcingContractId(data.id);
          setOutsourcingSaveMessage('テンプレートとして保存しました！');
          setTimeout(() => setOutsourcingSaveMessage(null), 3000);
        }
      } else {
        alert('保存に失敗しました。');
      }
    } catch (e) {
      console.error(e);
      alert('通信エラーが発生しました。');
    }
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/scouts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername: targetUserNames?.join(', '),
          targetRole: role,
          period,
          reward: rewardType + ' ' + rewardAmount,
          orgName: user?.username,
          language
        })
      });
      const data = await res.json();
      if (data.text) {
        setMessage(data.text);
      }
    } catch (e) {
      console.error(e);
    }
    setIsGenerating(false);
  };

  const handleSubmit = async () => {
    setIsSending(true);
    setErrorMessage(null);
    try {
      let finalNdaId = ndaContractId;
      if (ndaAttach && !finalNdaId && ndaBody.trim()) {
        try {
          const cRes = await fetch('/api/contracts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id.toString() || '' },
            body: JSON.stringify({
              title: ndaTitle.trim() || '秘密保持契約書 (NDA)',
              body: ndaBody.trim(),
              type: 'nda',
              category: sourceType,
              is_template: 0,
              author_id: user?.id
            })
          });
          if (cRes.ok) {
            const cData = await cRes.json();
            finalNdaId = cData.id;
          }
        } catch (err) {
          console.error(err);
        }
      }

      let finalOutsourcingId = outsourcingContractId;
      if (outsourcingAttach && !finalOutsourcingId && outsourcingBody.trim()) {
        try {
          const cRes = await fetch('/api/contracts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id.toString() || '' },
            body: JSON.stringify({
              title: outsourcingTitle.trim() || '業務委託契約書 (契約案)',
              body: outsourcingBody.trim(),
              type: 'outsourcing',
              category: sourceType,
              is_template: 0,
              author_id: user?.id
            })
          });
          if (cRes.ok) {
            const cData = await cRes.json();
            finalOutsourcingId = cData.id;
          }
        } catch (err) {
          console.error(err);
        }
      }

      const res = await fetch('/api/scouts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user?.id.toString() || ''
        },
        body: JSON.stringify({
          targetUserIds,
          project_id: projectId || null,
          reference_item_type: targetItemType,
          reference_item_id: targetItemId,
          reference_item_title: targetItemTitle,
          title,
          message,
          role,
          period,
          reward_type: rewardType,
          reward_amount: rewardAmount,
          location,
          nda: ndaAttach ? `添付あり (${ndaTitle})` : (nda || '不要'),
          source_type: sourceType,
          recruitment_id: recruitmentId || null,
          offer_id: offerId || null,
          idea_id: ideaId || null,
          nda_contract_id: ndaAttach ? finalNdaId || null : null,
          nda_title: ndaAttach ? ndaTitle : null,
          nda_body: ndaAttach ? ndaBody : null,
          outsourcing_contract_id: outsourcingAttach ? finalOutsourcingId || null : null,
          outsourcing_title: outsourcingAttach ? outsourcingTitle : null,
          outsourcing_body: outsourcingAttach ? outsourcingBody : null
        })
      });

      const d = await res.json();

      if (res.ok) {
        alert(language === 'ja' ? 'スカウトを送信しました。' : 'Scout sent successfully.');
        onClose();
      } else {
        if (d.error === 'monthly_limit_exceeded') {
          setShowPlanUpgradeModal(true);
        } else if (d.error === 'duplicate_scout') {
          const msg = d.message || (language === 'ja' ? 'このユーザーには、同じ内容のスカウトがすでに送信されています。' : 'Scout already sent to this user.');
          setErrorMessage(msg);
          alert(msg);
        } else {
          const msg = d.error || d.message || 'Failed to send scout';
          setErrorMessage(msg);
          alert(msg);
        }
      }
    } catch (e) {
      console.error(e);
      const msg = language === 'ja' ? 'エラーが発生しました' : 'An error occurred';
      setErrorMessage(msg);
      alert(msg);
    }
    setIsSending(false);
  };

  if (!user || user.account_type !== 'organization') return null;

  const modalContent = (
    <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 rounded-3xl w-full max-w-4xl flex flex-col border border-slate-800 shadow-2xl relative max-h-[92vh]">
        
        {/* Header */}
        <div className="sticky top-0 z-10 p-6 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex justify-between items-center rounded-t-3xl shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {sourceType === 'recruitment' && (
                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold rounded-full">
                  {language === 'ja' ? 'Project経由' : 'Via Project'}
                </span>
              )}
              {sourceType === 'offer' && (
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-full">
                  {language === 'ja' ? 'Proposal経由' : 'Via Proposal'}
                </span>
              )}
              {sourceType === 'direct' && (
                <span className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-bold rounded-full">
                  {language === 'ja' ? '指名スカウト' : 'Direct Scout'}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Send className="w-6 h-6 text-indigo-400" />
              {step === 1 
                ? (language === 'ja' ? 'スカウトの作成' : 'Create Scout') 
                : (language === 'ja' ? 'スカウト内容の確認' : 'Confirm Scout')}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Duplicate Warning Modal Inside */}
        {showDuplicateModal && duplicateScout && (
          <div className="p-6 bg-amber-500/10 border-b border-amber-500/20 space-y-3 shrink-0">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div className="font-bold text-sm">
                {language === 'ja' ? 'このユーザーには、同じ内容のスカウトがすでに送信されています。' : 'A scout with the same details has already been sent to this user.'}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowDetailModal(true);
                }}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 transition-colors"
              >
                {language === 'ja' ? '既存スカウトの詳細を見る' : 'View Existing Scout Details'}
              </button>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Pathway Guidance Display */}
          {sourceType === 'recruitment' && (
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-2 text-sm text-indigo-200">
              <div className="font-bold text-indigo-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {language === 'ja' ? 'このIdeaの投稿者にスカウトを送ります' : 'Sending scout to this Idea author'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400">{language === 'ja' ? '選択したIdea:' : 'Selected Idea:'}</span> <strong className="text-white">{ideaTitle || targetItemTitle}</strong></div>
                <div><span className="text-slate-400">{language === 'ja' ? '投稿者:' : 'Author:'}</span> <strong className="text-white">{targetUserNames?.join(', ')}さん</strong></div>
              </div>
            </div>
          )}

          {sourceType === 'offer' && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2 text-sm text-emerald-200">
              <div className="font-bold text-emerald-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {language === 'ja' ? 'このProposalの投稿者にスカウトを送ります' : 'Sending scout to this Proposal author'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400">{language === 'ja' ? '提案されたVision:' : 'Proposed Vision:'}</span> <strong className="text-white">{offerTitle || targetItemTitle}</strong></div>
                <div><span className="text-slate-400">{language === 'ja' ? '投稿者:' : 'Author:'}</span> <strong className="text-white">{targetUserNames?.join(', ')}さん</strong></div>
              </div>
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-6">
              {/* Target User */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">{language === 'ja' ? 'スカウト対象者' : 'Target Users'}</label>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-white font-bold">
                  {targetUserNames?.join(', ')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{language === 'ja' ? '想定・紐付けるプロジェクト' : 'Target Project'}</label>
                  <select 
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">{language === 'ja' ? '選択してください（任意）' : 'Select Project (Optional)'}</option>
                    {orgProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{language === 'ja' ? '依頼したい役割' : 'Requested Role'} <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder={language === 'ja' ? '例：プロジェクトリーダー、エンジニア' : 'e.g. Project Leader'}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">{language === 'ja' ? 'スカウト件名' : 'Scout Title'} <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={language === 'ja' ? '例：プロジェクト参画に関するご提案' : 'e.g. Invitation to project'}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{language === 'ja' ? '想定期間' : 'Expected Period'}</label>
                  <input 
                    type="text" 
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    placeholder={language === 'ja' ? '例：2026年10月〜' : 'e.g. Oct 2026 - TBD'}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{language === 'ja' ? '活動場所' : 'Location'}</label>
                  <input 
                    type="text" 
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder={language === 'ja' ? '例：フルリモート、東京都内' : 'e.g. Remote, Tokyo'}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{language === 'ja' ? '報酬形態' : 'Reward Type'}</label>
                  <select 
                    value={rewardType}
                    onChange={e => setRewardType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">{language === 'ja' ? '選択してください' : 'Select'}</option>
                    <option value="固定報酬">{language === 'ja' ? '固定報酬' : 'Fixed'}</option>
                    <option value="成果報酬">{language === 'ja' ? '成果報酬' : 'Performance'}</option>
                    <option value="売上分配">{language === 'ja' ? '売上分配' : 'Revenue Share'}</option>
                    <option value="要相談">{language === 'ja' ? '要相談' : 'Negotiable'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{language === 'ja' ? 'NDA締結' : 'NDA Required'}</label>
                  <select 
                    value={nda}
                    onChange={e => setNda(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">{language === 'ja' ? '選択してください' : 'Select'}</option>
                    <option value="必要">{language === 'ja' ? '必要' : 'Yes'}</option>
                    <option value="不要">{language === 'ja' ? '不要' : 'No'}</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-medium text-slate-400">{language === 'ja' ? 'スカウトメッセージ' : 'Message'} <span className="text-rose-500">*</span></label>
                  {user.org_plan === 'enterprise' && (
                    <button 
                      onClick={handleGenerateAI}
                      disabled={isGenerating || !role}
                      className="text-xs font-bold bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors"
                    >
                      {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                      {language === 'ja' ? 'AIで下書き作成' : 'AI Draft'}
                    </button>
                  )}
                </div>
                <textarea 
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={language === 'ja' ? '興味を持った理由や具体的な協議内容について記載してください...' : 'Write your message...'}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-4 focus:outline-none focus:border-indigo-500 transition-colors h-40 resize-none text-sm"
                />
              </div>

              {/* 秘密保持契約 (NDA) セクション */}
              <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm sm:text-base">秘密保持契約 (NDA)</h4>
                      <p className="text-[11px] text-slate-400">事前選択および即時本文入力・AI自動生成可能</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveContractModal({ type: 'nda', tab: 'templates' })}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-slate-700 shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      保存済み文章
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveContractModal({ type: 'nda', tab: 'ai' })}
                      className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-indigo-500/30 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      AIで自動生成
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">契約書タイトル</label>
                    <input
                      type="text"
                      value={ndaTitle}
                      onChange={e => setNdaTitle(e.target.value)}
                      placeholder="例: 秘密保持契約書 (NDA)"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-300">契約文章（直接入力・編集可能）</label>
                      <span className="text-[11px] text-slate-400 font-mono">現在の文字数: <strong className="text-white">{ndaBody.length}</strong> 文字</span>
                    </div>
                    <textarea
                      value={ndaBody}
                      onChange={e => setNdaBody(e.target.value)}
                      rows={7}
                      placeholder="秘密保持契約の本文を入力してください..."
                      className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setNdaPreviewOpen(!ndaPreviewOpen)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                      >
                        {ndaPreviewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {ndaPreviewOpen ? 'プレビューを非表示' : 'プレビューを表示'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveAsTemplate('nda')}
                        className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 border border-slate-700"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
                        テンプレートとして保存
                      </button>
                      {ndaSaveMessage && (
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> {ndaSaveMessage}
                        </span>
                      )}
                    </div>
                  </div>

                  {ndaPreviewOpen && (
                    <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <span className="font-bold text-xs text-amber-300">【プレビュー】{ndaTitle}</span>
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto p-2 bg-slate-950 rounded border border-slate-800">
                        {ndaBody}
                      </pre>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-slate-800/60">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ndaAttach}
                        onChange={e => setNdaAttach(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
                      />
                      <span className="text-xs text-slate-200 font-bold">このスカウトに秘密保持契約書を添付する</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer pl-6">
                      <input
                        type="checkbox"
                        checked={ndaMandatory}
                        onChange={e => setNdaMandatory(e.target.checked)}
                        disabled={!ndaAttach}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 disabled:opacity-50"
                      />
                      <span className={`text-xs ${ndaAttach ? 'text-slate-300' : 'text-slate-500'}`}>
                        スカウト承諾（または条件協議開始）前の電子同意を必須にする設定
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 業務委託契約 セクション */}
              <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm sm:text-base">業務委託契約</h4>
                      <p className="text-[11px] text-slate-400">事前選択および即時本文入力・AI自動生成可能（※契約案扱い）</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveContractModal({ type: 'outsourcing', tab: 'templates' })}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-slate-700 shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      保存済み文章
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveContractModal({ type: 'outsourcing', tab: 'ai' })}
                      className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-indigo-500/30 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      AIで自動生成
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">契約書タイトル</label>
                    <input
                      type="text"
                      value={outsourcingTitle}
                      onChange={e => setOutsourcingTitle(e.target.value)}
                      placeholder="例: 業務委託契約書 (契約案)"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-300">契約文章（直接入力・編集可能）</label>
                      <span className="text-[11px] text-slate-400 font-mono">現在の文字数: <strong className="text-white">{outsourcingBody.length}</strong> 文字</span>
                    </div>
                    <textarea
                      value={outsourcingBody}
                      onChange={e => setOutsourcingBody(e.target.value)}
                      rows={7}
                      placeholder="業務委託契約の本文を入力してください..."
                      className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setOutsourcingPreviewOpen(!outsourcingPreviewOpen)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                      >
                        {outsourcingPreviewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {outsourcingPreviewOpen ? 'プレビューを非表示' : 'プレビューを表示'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveAsTemplate('outsourcing')}
                        className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 border border-slate-700"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                        テンプレートとして保存
                      </button>
                      {outsourcingSaveMessage && (
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> {outsourcingSaveMessage}
                        </span>
                      )}
                    </div>
                  </div>

                  {outsourcingPreviewOpen && (
                    <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <span className="font-bold text-xs text-emerald-300">【プレビュー】{outsourcingTitle}</span>
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto p-2 bg-slate-950 rounded border border-slate-800">
                        {outsourcingBody}
                      </pre>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-slate-800/60">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={outsourcingAttach}
                        onChange={e => setOutsourcingAttach(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
                      />
                      <span className="text-xs text-slate-200 font-bold">このスカウトに業務委託契約（契約案）を添付する</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer pl-6">
                      <input
                        type="checkbox"
                        checked={outsourcingMandatory}
                        onChange={e => setOutsourcingMandatory(e.target.checked)}
                        disabled={!outsourcingAttach}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 disabled:opacity-50"
                      />
                      <span className={`text-xs ${outsourcingAttach ? 'text-slate-300' : 'text-slate-500'}`}>
                        正式プロジェクト参加前の同意を必須にする設定
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-400 pl-6">
                      ※ スカウト承諾のみでは締結されません。条件協議後に最終確認して正式参加前に署名するフローです。
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button onClick={onClose} className="px-6 py-3 font-bold text-slate-400 hover:text-white transition-colors">
                  {language === 'ja' ? 'キャンセル' : 'Cancel'}
                </button>
                <button 
                  onClick={() => setStep(2)}
                  disabled={!title || !role || !message}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.98]"
                >
                  {language === 'ja' ? '確認画面へ' : 'Review'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Review Step */}
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 space-y-6">
                <div>
                  <p className="text-sm text-slate-400 mb-1">{language === 'ja' ? 'スカウト対象者' : 'To'}</p>
                  <p className="font-bold text-white text-lg">{targetUserNames?.join(', ')}</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">{language === 'ja' ? 'スカウト件名' : 'Title'}</p>
                    <p className="font-bold text-white">{title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">{language === 'ja' ? '依頼する役割' : 'Role'}</p>
                    <p className="font-bold text-white">{role}</p>
                  </div>
                  {period && (
                    <div>
                      <p className="text-sm text-slate-400 mb-1">{language === 'ja' ? '想定期間' : 'Period'}</p>
                      <p className="font-bold text-white">{period}</p>
                    </div>
                  )}
                  {rewardType && (
                    <div>
                      <p className="text-sm text-slate-400 mb-1">{language === 'ja' ? '報酬' : 'Reward'}</p>
                      <p className="font-bold text-white">{rewardType} {rewardAmount}</p>
                    </div>
                  )}
                </div>

                {/* Attached Contracts Summary in Review */}
                <div className="p-4 bg-slate-900 border border-slate-700/60 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-slate-400">添付契約書の有無</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-slate-300">NDA: </span>
                      {ndaAttach ? (
                        <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          添付あり ({ndaTitle}) - {ndaMandatory ? '承諾前同意必須' : '任意'}
                        </span>
                      ) : (
                        <span className="text-slate-500">添付なし</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-300">業務委託: </span>
                      {outsourcingAttach ? (
                        <span className="text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          添付あり ({outsourcingTitle}) - {outsourcingMandatory ? '正式参加前同意必須' : '任意'}
                        </span>
                      ) : (
                        <span className="text-slate-500">添付なし</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-2">{language === 'ja' ? 'メッセージ' : 'Message'}</p>
                  <div className="bg-slate-900 p-4 rounded-xl text-slate-300 whitespace-pre-wrap border border-slate-700 text-sm">
                    {message}
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button 
                  onClick={() => setStep(1)} 
                  disabled={isSending}
                  className="px-6 py-3 font-bold text-slate-400 hover:text-white transition-colors"
                >
                  {language === 'ja' ? '内容を修正する' : 'Edit'}
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={isSending}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center gap-2"
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {language === 'ja' ? 'スカウトを送信する' : 'Send Scout'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPlanUpgradeModal && (
        <PlanUpgradeModal onClose={() => setShowPlanUpgradeModal(false)} />
      )}

      {showDetailModal && duplicateScout && (
        <ScoutDetailModal
          scoutId={duplicateScout.id}
          onClose={() => setShowDetailModal(false)}
        />
      )}

      {activeContractModal && (
        <ContractSelectorModal
          type={activeContractModal.type}
          initialTab={activeContractModal.tab}
          category={sourceType === 'direct' ? 'scout' : (sourceType as 'recruitment' | 'offer' | 'scout')}
          targetProjectTitle={title || targetItemTitle || '対象プロジェクト'}
          targetRole={role || 'メンバー'}
          initialTitle={activeContractModal.type === 'nda' ? ndaTitle : outsourcingTitle}
          initialBody={activeContractModal.type === 'nda' ? ndaBody : outsourcingBody}
          onClose={() => setActiveContractModal(null)}
          onSelectContract={(contract) => {
            if (activeContractModal.type === 'nda') {
              setNdaTitle(contract.title);
              setNdaBody(contract.body);
              setNdaAttach(true);
              if (contract.id) setNdaContractId(contract.id);
            } else {
              setOutsourcingTitle(contract.title);
              setOutsourcingBody(contract.body);
              setOutsourcingAttach(true);
              if (contract.id) setOutsourcingContractId(contract.id);
            }
          }}
        />
      )}
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
