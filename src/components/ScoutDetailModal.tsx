import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Briefcase, CheckCircle, Clock, XCircle, Send, Building2, MapPin, Calendar, FileText, Lock, MessageSquare, ShieldCheck, FileCode, CheckCircle2, Download, Printer, FileDown, Eye, Info, AlertTriangle, Edit3, Save, HelpCircle, RefreshCw, Globe } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Link, useNavigate } from 'react-router-dom';
import ElectronicSignatureModal from './ElectronicSignatureModal';
import FinalContractAgreementModal from './FinalContractAgreementModal';
import { Sparkles } from 'lucide-react';
import { computeContractHash } from '../utils/contractHash';
import { getAccountTypeBorderClass } from '../utils/avatar';
import AccountTypeBadge from './AccountTypeBadge';

interface ScoutDetailModalProps {
  scoutId: string | number;
  onClose: () => void;
}

export default function ScoutDetailModal({ scoutId, onClose }: ScoutDetailModalProps) {
  const { user, language } = useAppContext();
  const [scout, setScout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionType, setActionType] = useState<'accept' | 'decline' | 'hold' | null>(null);
  const [reason, setReason] = useState('');
  const [activeTab, setActiveTab] = useState<'scout' | 'nda' | 'outsourcing'>('scout');
  const [ndaAgreed, setNdaAgreed] = useState(false);
  const [outsourcingConfirmed, setOutsourcingConfirmed] = useState(false);
  const [outsourcingDiscussionUnderstood, setOutsourcingDiscussionUnderstood] = useState(false);
  const [showFinalAgreementModal, setShowFinalAgreementModal] = useState(false);

  // Requirement 21 Hash states
  const [ndaHashChanged, setNdaHashChanged] = useState(false);
  const [outHashChanged, setOutHashChanged] = useState(false);

  // Org contract edit states
  const [isEditingNda, setIsEditingNda] = useState(false);
  const [editNdaBody, setEditNdaBody] = useState('');
  const [isEditingOut, setIsEditingOut] = useState(false);
  const [editOutBody, setEditOutBody] = useState('');
  const [savingContract, setSavingContract] = useState(false);

  // Requirement 26 Revision state
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionType, setRevisionType] = useState<'question' | 'revision_request'>('revision_request');
  const [targetClause, setTargetClause] = useState('第8条 知的財産権');
  const [revisionComment, setRevisionComment] = useState('成果物の権利をすべて譲渡するのではなく、利用許諾へ変更できるか確認したいです。');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // Requirement 26: Org Offer reception states
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [interestMessage, setInterestMessage] = useState('ご提案内容を拝見し、ぜひ前向きに連携・条件協議を進めたくご連絡いたしました。');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionContent, setQuestionContent] = useState('提案内容における具体的な開発スケジュールと成果物の検証基準についてご質問がございます。');
  const [showShareOrgModal, setShowShareOrgModal] = useState(false);
  const [shareStaffName, setShareStaffName] = useState('新規事業企画部 担当者');
  const [shareMemo, setShareMemo] = useState('個人からの魅力的な提案Offerです。検討のため共有します。');
  const [showBaseVisionModal, setShowBaseVisionModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleRevisionSubmit = async () => {
    if (!user || !scout || !targetClause.trim() || !revisionComment.trim()) return;
    setIsSubmittingRevision(true);
    try {
      const res = await fetch(`/api/scouts/${scout.id}/request_revision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({
          revision_type: revisionType,
          target_clause: targetClause.trim(),
          comment: revisionComment.trim()
        })
      });
      if (res.ok) {
        setShowRevisionForm(false);
        fetchScoutDetail();
      } else {
        const data = await res.json();
        alert(data.error || '修正依頼の送信に失敗しました。');
      }
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました。');
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const [activeSignatureContract, setActiveSignatureContract] = useState<{
    title: string;
    type: 'nda' | 'outsourcing';
    body: string;
    version?: number;
    id?: number;
    existingAgreement?: any;
  } | null>(null);

  const navigate = useNavigate();
  const isOrg = user?.account_type === 'organization';

  const fetchScoutDetail = () => {
    if (!user) return;
    fetch(`/api/scouts/${scoutId}?user_id=${user.id}`)
      .then(res => res.json())
      .then(data => {
        setScout(data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  };

  // Requirement 21: Check hash changes when scout is loaded
  useEffect(() => {
    if (!scout) return;
    async function checkContractHashes() {
      if (scout.nda_snapshot_body || scout.nda_contract?.body) {
        const title = scout.nda_snapshot_title || scout.nda_contract?.title || '秘密保持契約書 (NDA)';
        const body = scout.nda_snapshot_body || scout.nda_contract?.body || '';
        const currentHash = await computeContractHash(title, body);

        const prevNdaAgreement = scout.agreements?.find((a: any) =>
          a.contract_id === scout.nda_contract_id ||
          (a.snapshot_title && a.snapshot_title.includes('秘密保持'))
        );

        if (prevNdaAgreement) {
          const isDiff = prevNdaAgreement.content_hash
            ? prevNdaAgreement.content_hash !== currentHash
            : (prevNdaAgreement.snapshot_body && prevNdaAgreement.snapshot_body !== body);

          if (isDiff) {
            setNdaHashChanged(true);
            setNdaAgreed(false); // Invalidate previous checkbox
          }
        }
      }

      if (scout.outsourcing_snapshot_body || scout.outsourcing_contract?.body || scout.outsourcing_body) {
        const title = scout.outsourcing_snapshot_title || scout.outsourcing_contract?.title || '業務委託契約書 (契約案)';
        const body = scout.outsourcing_snapshot_body || scout.outsourcing_contract?.body || scout.outsourcing_body || '';
        const currentHash = await computeContractHash(title, body);

        const prevOutAgreement = scout.agreements?.find((a: any) =>
          a.contract_id === scout.outsourcing_contract_id ||
          (a.snapshot_title && a.snapshot_title.includes('業務委託'))
        );

        if (prevOutAgreement) {
          const isDiff = prevOutAgreement.content_hash
            ? prevOutAgreement.content_hash !== currentHash
            : (prevOutAgreement.snapshot_body && prevOutAgreement.snapshot_body !== body);

          if (isDiff) {
            setOutHashChanged(true);
            setOutsourcingConfirmed(false); // Invalidate previous checkbox
          }
        }
      }
    }

    checkContractHashes();
  }, [scout]);

  const handleSaveContractText = async (type: 'nda' | 'outsourcing') => {
    if (!user || !scout) return;
    setSavingContract(true);
    try {
      const payload: any = {};
      if (type === 'nda') {
        payload.nda_snapshot_body = editNdaBody;
      } else {
        payload.outsourcing_snapshot_body = editOutBody;
      }

      const res = await fetch(`/api/scouts/${scout.id}/contract`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id.toString() },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsEditingNda(false);
        setIsEditingOut(false);
        fetchScoutDetail();
      } else {
        alert('契約文章の更新に失敗しました');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingContract(false);
    }
  };

  const handleSendConfirmationRequest = async () => {
    if (!user || !scout) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/scouts/${scout.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id.toString() },
        body: JSON.stringify({ status: 'confirmation_requested' })
      });
      if (res.ok) {
        fetchScoutDetail();
      } else {
        alert('契約確認依頼の送信に失敗しました');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchScoutDetail();
  }, [scoutId, user]);

  const handleDownloadTxt = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/[/\\?%*:|"<>]/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAction = async () => {
    if (!actionType || !user) return;
    if (actionType === 'accept' && !canAcceptScout) return;
    setActionLoading(true);
    try {
      if (actionType === 'accept' && isNdaRequired && ndaAgreed && !ndaAgreement) {
        try {
          await fetch('/api/contracts/agreements', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': user.id.toString()
            },
            body: JSON.stringify({
              user_id: user.id,
              contract_id: scout.nda_contract_id || 0,
              contract_version: ndaVersion || 1,
              target_type: 'scout',
              target_id: scout.id,
              signature_name: user.username || '電子同意',
              status: 'agreed'
            })
          });
        } catch (e) {
          console.error('Failed to log NDA agreement on accept:', e);
        }
      }

      const res = await fetch(`/api/scouts/${scout.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id.toString() },
        body: JSON.stringify({ 
          status: actionType === 'accept' ? 'accepted' : actionType === 'hold' ? 'on_hold' : 'declined',
          hold_reason: actionType === 'hold' ? reason : null,
          decline_reason: actionType === 'decline' ? reason : null
        })
      });
      if (res.ok) {
        if (actionType === 'accept') {
           if (scout.project_id) {
             navigate(`/chat/project/${scout.project_id}`);
           } else if (scout.recruitment_id) {
             navigate(`/chat/project/${scout.recruitment_id}`);
           } else if (scout.offer_id) {
             navigate(`/chat/project/${scout.offer_id}`);
           } else if (scout.idea_id) {
             navigate(`/chat/idea/${scout.idea_id}`);
           } else if (scout.reference_item_id && scout.reference_item_type) {
             navigate(`/chat/${scout.reference_item_type}/${scout.reference_item_id}`);
           } else {
             navigate(`/chat/direct/${scout.sender_id}`);
           }
        }
        onClose();
      } else {
        alert('Failed to update status');
      }
    } catch (e) {
      console.error(e);
    }
    setActionLoading(false);
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      draft: language === 'ja' ? '下書き' : 'Draft',
      sent: isOrg ? (language === 'ja' ? '送信済み' : 'Sent') : (language === 'ja' ? '未読' : 'Unread'),
      viewed: language === 'ja' ? '閲覧済み' : 'Viewed',
      on_hold: language === 'ja' ? '保留中' : 'On Hold',
      accepted: language === 'ja' ? '承諾済み' : 'Accepted',
      declined: language === 'ja' ? '辞退済み' : 'Declined',
      expired: language === 'ja' ? '期限切れ' : 'Expired',
      withdrawn: language === 'ja' ? '取り下げ' : 'Withdrawn',
      discussion: language === 'ja' ? '条件確認中' : 'Discussion',
      confirmation_requested: language === 'ja' ? '契約確認依頼中' : 'Confirmation Requested',
      confirmed: language === 'ja' ? '参加移行（契約締結済）' : 'Confirmed',
      completed: language === 'ja' ? '完了' : 'Completed',
    };
    return map[status] || status;
  };

  if (loading || !scout || !scout.receiver_id) {
    const modalContent = (
      <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        {loading ? (
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center max-w-sm text-white relative">
            <button onClick={onClose} className="absolute top-3 right-3 p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <p className="mb-4">{scout?.error || (language === 'ja' ? 'スカウト情報が見つかりませんでした' : 'Scout detail not found')}</p>
            <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold">
              {language === 'ja' ? '閉じる' : 'Close'}
            </button>
          </div>
        )}
      </div>
    );
    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
  }

  const isReceiver = scout.receiver_id.toString() === user?.id.toString();
  const canRespond = isReceiver && ['sent', 'viewed', 'on_hold'].includes(scout.status);

  // Check attached contracts
  const hasNda = Boolean(scout.nda_contract || scout.nda_contract_id || scout.nda_snapshot_body || scout.nda);
  const isNdaRequired = Boolean(hasNda || scout.nda || scout.nda_required);
  const ndaTitle = scout.nda_snapshot_title || scout.nda_contract?.title || '秘密保持契約書 (NDA)';
  const ndaBody = scout.nda_snapshot_body || scout.nda_contract?.body || `【秘密保持契約書 (NDA)】\n\n本契約は、開示者（${scout.sender_name}）と受領者（${scout.receiver_name}）との間において、対象プロジェクト（${scout.project_title || 'スカウト案件'}）に関する秘密情報の取り扱いについて定めるものです。`;
  const ndaVersion = scout.nda_snapshot_version || scout.nda_contract?.version || 1;
  const ndaHash = scout.nda_snapshot_hash || '';
  const ndaAgreement = scout.agreements?.find((a: any) => a.contract_id === scout.nda_contract_id || (a.target_type === 'scout' && a.target_id === scout.id));

  const hasOutsourcing = Boolean(scout.outsourcing_contract || scout.outsourcing_body || scout.outsourcing_contract_id || scout.outsourcing_snapshot_body);
  const isOutsourcingPresent = Boolean(hasOutsourcing || scout.outsourcing_contract || scout.outsourcing_body || scout.outsourcing_contract_id);
  const outTitle = scout.outsourcing_snapshot_title || scout.outsourcing_contract?.title || '業務委託契約書 (契約案)';
  const outBody = scout.outsourcing_snapshot_body || scout.outsourcing_contract?.body || scout.outsourcing_body || `【業務委託契約書】\n\n委託者（${scout.sender_name}）および受託者（${scout.receiver_name}）は、以下のとおり業務委託契約を締結する。\n\n役職: ${scout.role}\n期間: ${scout.period || '別途協議'}\n報酬: ${scout.reward_type || '協議'} ${scout.reward_amount || ''}`;
  const outVersion = scout.outsourcing_snapshot_version || scout.outsourcing_contract?.version || 1;
  const outHash = scout.outsourcing_snapshot_hash || '';
  const outAgreement = scout.agreements?.find((a: any) => a.contract_id === scout.outsourcing_contract_id);

  const canAcceptScout = actionType === 'accept'
    ? (!isNdaRequired || ndaAgreed) && (!isOutsourcingPresent || (outsourcingConfirmed && outsourcingDiscussionUnderstood))
    : true;

  const attachedDate = scout.attached_at ? new Date(scout.attached_at).toLocaleString('ja-JP') : scout.created_at ? new Date(scout.created_at).toLocaleString('ja-JP') : '-';
  const orgName = scout.attached_by_user_name || scout.sender_name || '差出元';

  const modalContent = (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 rounded-2xl w-full max-w-3xl flex flex-col border border-slate-800 shadow-2xl relative my-8">
        
        {/* Modal Header */}
        <div className="sticky top-0 z-10 p-6 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex justify-between items-start rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {getStatusText(scout.status)}
              </span>
              <span className="text-slate-400 text-sm">
                {new Date(scout.created_at).toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">{scout.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 -mt-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white shrink-0">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Tabs (Requirement 18) */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-3 gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('scout')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'scout'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-xl'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            スカウト内容
          </button>
          <button
            onClick={() => setActiveTab('nda')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'nda'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-xl'
            }`}
          >
            <Lock className="w-4 h-4" />
            秘密保持契約 (NDA)
            {hasNda && (
              <span className={`w-2 h-2 rounded-full ${ndaAgreement ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('outsourcing')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'outsourcing'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-xl'
            }`}
          >
            <FileCode className="w-4 h-4" />
            業務委託契約案
            {hasOutsourcing && (
              <span className={`w-2 h-2 rounded-full ${outAgreement ? 'bg-emerald-400' : 'bg-emerald-400/60'}`}></span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-8">

          {/* TAB 1: SCOUT CONTENT */}
          {activeTab === 'scout' && (
            <>
              {/* Sender Info */}
              <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <Link to={`/profile/${isReceiver ? scout.sender_id : scout.receiver_id}`} className="shrink-0" onClick={onClose}>
                  <img 
                    src={isReceiver ? scout.sender_avatar : scout.receiver_avatar} 
                    className={`w-16 h-16 rounded-full bg-slate-700 object-cover ${getAccountTypeBorderClass(isReceiver ? (scout.sender_account_type || 'organization') : (scout.receiver_account_type || 'individual'), 'border-[3px]')}`} 
                    alt="" 
                  />
                </Link>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-slate-400">{isReceiver ? (language === 'ja' ? '送信元' : 'From') : (language === 'ja' ? '送信先' : 'To')}</span>
                    {scout.source_type === 'recruitment' && (
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-md">Project経由</span>
                    )}
                    {scout.source_type === 'offer' && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-md">Proposal経由</span>
                    )}
                    {(!scout.source_type || scout.source_type === 'direct') && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs font-bold rounded-md">指名スカウト</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/profile/${isReceiver ? scout.sender_id : scout.receiver_id}`} className="text-lg font-bold text-white hover:text-indigo-400 transition-colors" onClick={onClose}>
                      {isReceiver ? scout.sender_name : scout.receiver_name}
                    </Link>
                    <AccountTypeBadge accountType={isReceiver ? (scout.sender_account_type || 'organization') : (scout.receiver_account_type || 'individual')} size="xs" />
                  </div>
                </div>
              </div>

              {/* Pathway Source Context Banner & Requirement 26 Org Offer Controls */}
              {scout.source_type === 'offer' && (
                <div className="p-4 bg-emerald-950/70 border-2 border-emerald-500/60 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                    <span className="flex items-center gap-1.5 text-sm font-black">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      26．組織側のProposal受信 (届いた提案Proposal)
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-900/80 text-emerald-200 border border-emerald-600 rounded-full font-mono text-[10px]">
                      個別提案Proposal
                    </span>
                  </div>

                  {/* 10つの指定機能クイックアクセスバー */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {/* 2. 元のVisionを閲覧 */}
                    <button
                      type="button"
                      onClick={() => setShowBaseVisionModal(true)}
                      className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all"
                    >
                      <Globe className="w-4 h-4 text-emerald-400" />
                      <span>［元のVisionを閲覧］</span>
                    </button>

                    {/* 4. 提案者の公開プロフィールを閲覧 */}
                    <button
                      type="button"
                      onClick={() => setShowProfileModal(true)}
                      className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-purple-500/40 text-purple-300 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all"
                    >
                      <Eye className="w-4 h-4 text-purple-400" />
                      <span>［公開プロフィール］</span>
                    </button>

                    {/* 7. チャットを開始 */}
                    <Link
                      to={`/chat/direct/${isReceiver ? scout.sender_id : scout.receiver_id}`}
                      onClick={onClose}
                      className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all text-center"
                    >
                      <MessageSquare className="w-4 h-4 text-cyan-400" />
                      <span>［チャットを開始］</span>
                    </Link>

                    {/* 10. 組織内の担当者へ共有 */}
                    <button
                      type="button"
                      onClick={() => setShowShareOrgModal(true)}
                      className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all"
                    >
                      <Printer className="w-4 h-4 text-amber-400" />
                      <span>［担当者へ共有］</span>
                    </button>
                  </div>
                </div>
              )}

              {scout.source_type === 'recruitment' && (scout.recruitment_title || scout.idea_title) && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1 text-sm text-indigo-200">
                  <div className="font-bold text-indigo-300 text-xs uppercase tracking-wider">Project 関連情報</div>
                  {scout.recruitment_title && <div>Project: <strong className="text-white">{scout.recruitment_title}</strong></div>}
                  {scout.idea_title && <div>対象Idea: <strong className="text-white">{scout.idea_title}</strong></div>}
                </div>
              )}

              {/* Legal / Notice Disclaimer */}
              <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 leading-relaxed">
                <p className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5">
                  スカウト承諾に関するご注意
                </p>
                <p>
                  スカウトの承諾は、雇用契約や業務委託契約の成立を意味しません。承諾後、発注側（法人/自治体）と詳細条件を確認し、双方が合意した場合にプロジェクト参加へと進みます。
                </p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {scout.project_title && (
                  <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                      <Building2 className="w-4 h-4" />
                      {language === 'ja' ? '対象プロジェクト' : 'Target Project'}
                    </div>
                    <div className="font-bold text-white">{scout.project_title}</div>
                  </div>
                )}
                
                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <Briefcase className="w-4 h-4" />
                    {language === 'ja' ? '依頼する役割' : 'Requested Role'}
                  </div>
                  <div className="font-bold text-white">{scout.role}</div>
                </div>

                {scout.period && (
                  <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                      <Calendar className="w-4 h-4" />
                      {language === 'ja' ? '想定期間' : 'Expected Period'}
                    </div>
                    <div className="font-bold text-white">{scout.period}</div>
                  </div>
                )}

                {scout.location && (
                  <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                      <MapPin className="w-4 h-4" />
                      {language === 'ja' ? '活動場所' : 'Location'}
                    </div>
                    <div className="font-bold text-white">{scout.location}</div>
                  </div>
                )}

                {scout.reward_type && (
                  <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                      <FileText className="w-4 h-4" />
                      {language === 'ja' ? '報酬条件' : 'Reward'}
                    </div>
                    <div className="font-bold text-white">{scout.reward_type} {scout.reward_amount && `- ${scout.reward_amount}`}</div>
                  </div>
                )}
                
                {scout.nda && (
                  <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                      <Lock className="w-4 h-4" />
                      {language === 'ja' ? 'NDA' : 'NDA'}
                    </div>
                    <div className="font-bold text-white">{scout.nda}</div>
                  </div>
                )}
              </div>

              {/* Quick Attached Contracts summary box */}
              {(hasNda || hasOutsourcing) && (
                <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      添付された契約書・契約案
                    </span>
                    <span className="text-[11px] text-indigo-400">上部タブで全文確認可能</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasNda && (
                      <button
                        onClick={() => setActiveTab('nda')}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        秘密保持契約: {ndaAgreement ? '同意済' : '未同意'}
                      </button>
                    )}
                    {hasOutsourcing && (
                      <button
                        onClick={() => setActiveTab('outsourcing')}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        業務委託契約案: {outAgreement ? '同意済' : '未締結'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Message Content */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  {language === 'ja' ? 'メッセージ' : 'Message'}
                </h3>
                <div className="bg-slate-800 p-6 rounded-2xl text-slate-300 leading-relaxed whitespace-pre-wrap border border-slate-700">
                  {scout.message}
                </div>
              </div>

              {/* Action Buttons for Receiver (Enhanced for Requirement 26 Org Offer) */}
              {canRespond && (
                <div className="pt-6 border-t border-slate-800 space-y-4">
                  {/* 要件26: 組織側がOffer受信時の返信・質問・保留・辞退アクション */}
                  {isOrg && scout.source_type === 'offer' && (
                    <div className="bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-500/40 space-y-2">
                      <div className="text-xs font-bold text-emerald-300 flex items-center justify-between">
                        <span>Proposal受信者（法人・自治体）アクションを選択してください</span>
                        <span className="text-[10px] text-emerald-400 font-normal">「関心あり」は契約成立ではありません</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <button
                          type="button"
                          onClick={() => setShowInterestModal(true)}
                          className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>関心あり返信</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowQuestionModal(true)}
                          className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>質問を送信</span>
                        </button>

                        <Link
                          to={`/chat/direct/${scout.sender_id}`}
                          onClick={onClose}
                          className="px-3 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1 text-center"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>チャット開始</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => { setActionType('hold'); setShowConfirm(true); }}
                          className="px-3 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>保留する</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setActionType('decline'); setShowConfirm(true); }}
                          className="px-3 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1 col-span-2 sm:col-span-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>辞退する</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!showConfirm ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button 
                        onClick={() => { setActionType('accept'); setShowConfirm(true); }}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        {language === 'ja' ? '承諾する' : 'Accept'}
                      </button>
                      <button 
                        onClick={() => { setActionType('hold'); setShowConfirm(true); }}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-6 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Clock className="w-5 h-5" />
                        {language === 'ja' ? '保留する' : 'Hold'}
                      </button>
                      <button 
                        onClick={() => { setActionType('decline'); setShowConfirm(true); }}
                        className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 font-bold py-4 px-6 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-5 h-5" />
                        {language === 'ja' ? '辞退する' : 'Decline'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                      <h4 className="font-bold text-white text-lg">
                        {actionType === 'accept' && (language === 'ja' ? 'このスカウトを承諾しますか？' : 'Accept this scout?')}
                        {actionType === 'hold' && (language === 'ja' ? '保留の理由や期限があればご記入ください' : 'Hold reason (optional)')}
                        {actionType === 'decline' && (language === 'ja' ? '辞退の理由をご記入ください（任意）' : 'Decline reason (optional)')}
                      </h4>
                      
                      {actionType === 'accept' && (
                        <div className="space-y-4">
                          {/* Required Agreement Checkboxes */}
                          {(isNdaRequired || isOutsourcingPresent) && (
                            <div className="space-y-3 bg-slate-900/90 p-4 rounded-xl border border-slate-700">
                              <div className="font-bold text-slate-200 text-sm flex items-center gap-1.5 border-b border-slate-800 pb-2">
                                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                                承諾前の確認・同意事項
                              </div>

                              {/* NDA Agreement Checkbox */}
                              {isNdaRequired && (
                                <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/80 space-y-2">
                                  {ndaHashChanged && (
                                    <div className="p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-lg text-amber-200 text-xs space-y-1">
                                      <div className="font-bold flex items-center gap-1.5 text-amber-300">
                                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                        契約文章が更新されました。
                                      </div>
                                      <p className="text-amber-100/90 leading-relaxed">
                                        変更後の内容を確認し、もう一度同意してください。
                                      </p>
                                    </div>
                                  )}
                                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={ndaAgreed}
                                      onChange={(e) => setNdaAgreed(e.target.checked)}
                                      className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                                    />
                                    <span className="font-bold text-amber-300 text-xs sm:text-sm leading-snug flex-1">
                                      秘密保持契約の全文を確認し、内容に同意します。
                                      <span className="text-rose-400 font-normal text-xs ml-1">（必須）</span>
                                    </span>
                                  </label>
                                  <div className="text-[11px] text-slate-400 pl-6 flex items-center justify-between">
                                    <span>上部の「秘密保持契約 (NDA)」タブで事前確認できます</span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('nda')}
                                      className="text-indigo-400 hover:underline font-bold shrink-0 ml-2"
                                    >
                                      全文を確認 &rarr;
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Outsourcing Contract Draft Checkboxes */}
                              {isOutsourcingPresent && (
                                <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/80 space-y-2.5">
                                  {outHashChanged && (
                                    <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-lg text-emerald-200 text-xs space-y-1">
                                      <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                                        <AlertTriangle className="w-4 h-4 text-emerald-400 shrink-0" />
                                        契約文章が更新されました。
                                      </div>
                                      <p className="text-emerald-100/90 leading-relaxed">
                                        変更後の内容を確認し、もう一度同意してください。
                                      </p>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between text-xs text-emerald-300 font-bold mb-1">
                                    <span>業務委託契約案の確認</span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('outsourcing')}
                                      className="text-emerald-400 hover:underline text-[11px] font-bold"
                                    >
                                      契約案を確認 &rarr;
                                    </button>
                                  </div>

                                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={outsourcingConfirmed}
                                      onChange={(e) => setOutsourcingConfirmed(e.target.checked)}
                                      className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                                    />
                                    <span className="font-medium text-slate-200 text-xs sm:text-sm leading-snug">
                                      業務委託契約案を確認しました。
                                      <span className="text-rose-400 font-normal text-xs ml-1">（必須）</span>
                                    </span>
                                  </label>

                                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={outsourcingDiscussionUnderstood}
                                      onChange={(e) => setOutsourcingDiscussionUnderstood(e.target.checked)}
                                      className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                                    />
                                    <span className="font-medium text-slate-200 text-xs sm:text-sm leading-snug">
                                      正式な契約条件は、スカウト承諾後の協議により確定することを理解しました。
                                      <span className="text-rose-400 font-normal text-xs ml-1">（必須）</span>
                                    </span>
                                  </label>

                                  <div className="p-2 bg-slate-950/80 rounded border border-slate-800 text-[11px] text-slate-400 font-medium">
                                    ※ このチェックは、業務委託契約そのものへの最終同意として扱われません。
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Notice directly before scout accept button */}
                          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs sm:text-sm text-amber-200 space-y-1">
                            <p className="font-bold text-amber-300 leading-snug flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                              スカウト承諾に関する重要事項
                            </p>
                            <p className="leading-relaxed text-amber-200/90">
                              ・スカウトの承諾は、業務委託契約または雇用契約の成立を意味しません。<br />
                              ・承諾後に条件を確認し、双方が最終同意した場合にプロジェクトへ参加します。
                            </p>
                          </div>
                        </div>
                      )}

                      {actionType !== 'accept' && (
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder={language === 'ja' ? (actionType === 'hold' ? '例：内容を確認したうえで、〇月〇日までに回答します。' : '例：スケジュールが合わないため') : 'Enter reason...'}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-4 focus:outline-none focus:border-indigo-500 transition-colors h-24 resize-none"
                        />
                      )}

                      <div className="flex gap-3 justify-end pt-4">
                        <button 
                          onClick={() => { setShowConfirm(false); setReason(''); }}
                          className="px-6 py-3 font-bold text-slate-400 hover:text-white transition-colors"
                          disabled={actionLoading}
                        >
                          {language === 'ja' ? 'キャンセル' : 'Cancel'}
                        </button>
                        <button 
                          onClick={handleAction}
                          disabled={actionLoading || (actionType === 'accept' && !canAcceptScout)}
                          className={`px-8 py-3 font-bold text-white rounded-xl transition-all shadow-lg active:scale-[0.98] ${
                            actionType === 'accept'
                              ? canAcceptScout 
                                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' 
                                : 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
                              : actionType === 'hold' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' :
                              'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                          }`}
                        >
                          {actionLoading ? '...' : (language === 'ja' ? '確定する' : 'Confirm')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Requirement 26: Revision Request Notice or Actions */}
              {scout.status === 'revision_requested' ? (
                <div className="p-5 bg-amber-500/15 border-2 border-amber-500/50 rounded-2xl space-y-3 text-amber-200 shadow-xl">
                  <div className="font-bold text-amber-300 text-sm sm:text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                      {isReceiver ? '【修正依頼送信済み (revision_requested)】' : `【受諾者（${scout.receiver_name}）より契約書の修正依頼・質問が届いています】`}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-mono border border-amber-500/40">
                      修正・回答対応中
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-slate-200 font-mono">
                    <div><span className="text-amber-400 font-bold">対象条文:</span> {scout.revision_target_clause || '未指定'}</div>
                    <div><span className="text-amber-400 font-bold">依頼・質問コメント:</span> {scout.revision_comment}</div>
                  </div>

                  {!isReceiver ? (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        契約本文（秘密保持契約または業務委託契約）を修正してください。修正保存すると自動的に新しいバージョン（v2等）が作成され、個人ユーザーへ再確認依頼（status: confirmation_requested）が届きます。
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() => {
                            setActiveTab('outsourcing');
                            setEditOutBody(outBody);
                            setIsEditingOut(true);
                          }}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2"
                        >
                          <Edit3 className="w-4 h-4" />
                          業務委託契約案を修正する (新バージョン作成)
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab('nda');
                            setEditNdaBody(ndaBody);
                            setIsEditingNda(true);
                          }}
                          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2"
                        >
                          <Edit3 className="w-4 h-4" />
                          秘密保持契約(NDA)を修正する (新バージョン作成)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      現在、発注側（法人・自治体）にて回答または契約本文の修正を準備中です。新しいバージョンとして再同意通知が届きます。
                    </p>
                  )}
                </div>
              ) : (
                /* Requirement 26: Individual can ask question or request revision before agreeing */
                isReceiver && (scout.status === 'confirmation_requested' || scout.status === 'accepted') && (
                  <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-200 text-xs sm:text-sm">
                          契約同意前に条文についての質問や修正依頼を行いますか？
                        </div>
                        <div className="text-[11px] text-slate-400">
                          同意する前に特定の条文を指定して発注側（法人・自治体）に修正依頼や疑問点を送信できます。
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setRevisionType('question');
                            setShowRevisionForm(true);
                          }}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <HelpCircle className="w-4 h-4 text-indigo-400" />
                          契約内容について質問する
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRevisionType('revision_request');
                            setShowRevisionForm(true);
                          }}
                          className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <Edit3 className="w-4 h-4 text-amber-400" />
                          修正を依頼する
                        </button>
                      </div>
                    </div>

                    {/* Inline Revision Form */}
                    {showRevisionForm && (
                      <div className="p-4 bg-slate-900 border-2 border-amber-500/50 rounded-xl space-y-3 shadow-xl mt-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                            <Edit3 className="w-4 h-4 text-amber-400" />
                            {revisionType === 'question' ? '契約内容についての質問' : '契約文章の修正依頼'}
                          </h4>
                          <button
                            type="button"
                            onClick={() => setShowRevisionForm(false)}
                            className="text-slate-400 hover:text-white text-xs"
                          >
                            閉じる
                          </button>
                        </div>

                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="block font-bold text-slate-300 mb-1">
                              対象条文 <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={targetClause}
                              onChange={(e) => setTargetClause(e.target.value)}
                              placeholder="例：第8条 知的財産権"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-300 mb-1">
                              コメント・依頼内容 <span className="text-rose-400">*</span>
                            </label>
                            <textarea
                              value={revisionComment}
                              onChange={(e) => setRevisionComment(e.target.value)}
                              placeholder="例：成果物の権利をすべて譲渡するのではなく、利用許諾へ変更できるか確認したいです。"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 h-24 resize-none font-mono"
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowRevisionForm(false)}
                              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                            >
                              キャンセル
                            </button>
                            <button
                              type="button"
                              disabled={isSubmittingRevision || !targetClause.trim() || !revisionComment.trim()}
                              onClick={handleRevisionSubmit}
                              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-lg transition-all flex items-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              {isSubmittingRevision ? '送信中...' : '送信する (revision_requestedへ変更)'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Actions for Receiver (Individual) for Final Contract Confirmation */}
              {isReceiver && (scout.status === 'confirmation_requested' || (scout.status === 'accepted' && (hasNda || isOutsourcingPresent))) && (
                <div className="pt-6 border-t border-slate-800">
                  <div className="p-5 bg-gradient-to-r from-indigo-900/80 via-purple-900/80 to-slate-900 border-2 border-indigo-500/60 rounded-2xl space-y-3 text-white shadow-xl">
                    <div className="flex items-center gap-2 text-indigo-300 font-bold text-base">
                      <Sparkles className="w-5 h-5 text-amber-300" />
                      【契約の最終確認依頼】
                    </div>
                    <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed">
                      発注側（法人・自治体）より条件協議後の最終契約内容（秘密保持契約・業務委託契約）の確認依頼が届いています。<br />
                      内容をご確認の上、各契約書への個別の同意手続きを行ってください。
                    </p>
                    <button
                      onClick={() => setShowFinalAgreementModal(true)}
                      className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-sm"
                    >
                      <ShieldCheck className="w-5 h-5 text-amber-300" />
                      契約内容を確認して最終同意する
                    </button>
                  </div>
                </div>
              )}

              {/* Actions for Org (Sender) */}
              {!isReceiver && ['accepted', 'discussion'].includes(scout.status) && (
                <div className="pt-6 border-t border-slate-800 space-y-3">
                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-slate-300 space-y-1">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5 text-sm">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      条件協議後の契約確定・最終確認依頼
                    </span>
                    <p className="text-slate-300 leading-relaxed">
                      個人との条件協議がまとまったら、下部のボタンから「契約確認依頼」を個人へ送信してください。個人ユーザーの画面に最終同意画面が表示されます。
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link 
                      to={`/chat/private/${scout.receiver_id}`}
                      onClick={onClose}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 px-5 rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2 text-sm"
                    >
                      <MessageSquare className="w-4 h-4 text-indigo-400" />
                      {language === 'ja' ? 'メッセージで協議' : 'Send Message'}
                    </Link>
                    <button
                      onClick={handleSendConfirmationRequest}
                      disabled={actionLoading}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                    >
                      <Send className="w-4 h-4 text-amber-300" />
                      {actionLoading ? '送信中...' : '「契約確認依頼」を送信する'}
                    </button>
                  </div>
                </div>
              )}

              {!isReceiver && scout.status === 'confirmation_requested' && (
                <div className="pt-6 border-t border-slate-800">
                  <div className="p-4 bg-indigo-950/60 border border-indigo-500/30 rounded-xl text-xs sm:text-sm text-indigo-200 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-bold text-white">「契約確認依頼」を送信済みです</div>
                      <div className="text-indigo-300/80 text-xs mt-0.5">現在、個人ユーザーによる契約内容の最終確認・同意手続き待ちです。</div>
                    </div>
                  </div>
                </div>
              )}

              {scout.status === 'confirmed' && (
                <div className="pt-6 border-t border-slate-800">
                  <div className="p-4 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-xs sm:text-sm text-emerald-200 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-bold text-white">契約締結・プロジェクト参加完了</div>
                      <div className="text-emerald-300/80 text-xs mt-0.5">秘密保持契約・業務委託契約への同意記録が保存され、正式参加となりました。</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: NDA CONTRACT (Requirement 18) */}
          {activeTab === 'nda' && (
            <div className="space-y-6">
              {hasNda ? (
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
                  {/* Header / Title */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-full">
                          秘密保持契約 (NDA)
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          バージョン: v{ndaVersion}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-white">{ndaTitle}</h3>
                    </div>

                    <div className="shrink-0">
                      {ndaAgreement ? (
                        <div className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> 同意状態: 同意済み
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
                          <Clock className="w-4 h-4" /> 同意状態: 未同意
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metadata Grid (Requirement 18: Title, Type, Version, Created Org, Attachment Date, Status) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">契約書タイトル</span>
                      <strong className="text-white font-medium">{ndaTitle}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">契約種類</span>
                      <span className="text-amber-300 font-semibold">秘密保持契約 (NDA)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">バージョン</span>
                      <span className="text-slate-200 font-mono">v{ndaVersion}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">作成者（法人/自治体）</span>
                      <strong className="text-white font-medium">{orgName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">添付日時</span>
                      <span className="text-slate-300">{attachedDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">同意状態</span>
                      <span className={ndaAgreement ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                        {ndaAgreement ? `同意済 (${new Date(ndaAgreement.agreed_at || ndaAgreement.created_at).toLocaleDateString()})` : '未同意'}
                      </span>
                    </div>
                    {ndaHash && (
                      <div className="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-800/80 font-mono text-[11px] text-slate-400 truncate">
                        改ざん防止ハッシュ: <span className="text-slate-300">{ndaHash}</span>
                      </div>
                    )}
                  </div>

                  {/* PDF View, Download, and Electronic Signature Tool Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveSignatureContract({
                          title: ndaTitle,
                          type: 'nda',
                          body: ndaBody,
                          id: scout.nda_contract_id || 0,
                          version: ndaVersion,
                          existingAgreement: ndaAgreement
                        })}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700"
                        title="PDF形式表示・印刷プレビュー"
                      >
                        <Printer className="w-4 h-4 text-indigo-400" />
                        PDF表示 / 印刷
                      </button>

                      <button
                        onClick={() => handleDownloadTxt(ndaTitle, ndaBody)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700"
                        title="契約文章をTXT形式でダウンロード"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        ダウンロード (.txt)
                      </button>
                    </div>

                    <button
                      onClick={() => setActiveSignatureContract({
                        title: ndaTitle,
                        type: 'nda',
                        body: ndaBody,
                        id: scout.nda_contract_id || 0,
                        version: ndaVersion,
                        existingAgreement: ndaAgreement
                      })}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {ndaAgreement ? '同意書を確認 / 証明書出力' : '秘密保持契約に電子署名する'}
                    </button>
                  </div>

                  {/* Scrollable Contract Body / Org Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-bold text-slate-300">契約文章 (全文表示・スクロール可能)</span>
                      {(!isReceiver || isOrg) && (
                        <button
                          onClick={() => {
                            setEditNdaBody(ndaBody);
                            setIsEditingNda(!isEditingNda);
                          }}
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {isEditingNda ? '編集キャンセル' : '文章を修正 (バージョン更新)'}
                        </button>
                      )}
                    </div>

                    {isEditingNda ? (
                      <div className="space-y-3 bg-slate-950 p-4 border border-amber-500/40 rounded-xl">
                        <div className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          契約本文を直接編集（1文字でも変更されるとハッシュ値が変更され新バージョンとして受諾者に再同意が求められます）
                        </div>
                        <textarea
                          value={editNdaBody}
                          onChange={(e) => setEditNdaBody(e.target.value)}
                          rows={10}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setIsEditingNda(false)}
                            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={() => handleSaveContractText('nda')}
                            disabled={savingContract}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                          >
                            <Save className="w-4 h-4" />
                            {savingContract ? '保存中...' : '契約文章を更新する'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto p-5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner">
                        {ndaBody}
                      </div>
                    )}

                    {/* Scroll / Reading proof notice (Requirement 18 rule) */}
                    <div className="p-3 bg-slate-800/60 border border-slate-700/80 rounded-xl text-xs text-slate-300 flex items-start gap-2">
                      <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block mb-0.5">※ 確認に関する規定</strong>
                        契約文章は上記の枠内でスクロールして全文をご確認いただけます。なお、スクロール動作自体は単なる閲覧操作であり、「読んだ証明」や法的な同意とは扱われません。右上の「電子署名する」ボタンより署名氏名の入力と明確なチェックを行うことで正式な同意手続きとなります。
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 space-y-3">
                  <Lock className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-base font-bold text-slate-300">秘密保持契約 (NDA) は添付されていません</p>
                  <p className="text-xs text-slate-500">このスカウトには個別の秘密保持契約文章は事前添付されていません。</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: OUTSOURCING CONTRACT DRAFT (Requirement 18) */}
          {activeTab === 'outsourcing' && (
            <div className="space-y-6">
              {hasOutsourcing ? (
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
                  {/* Header / Title */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-full">
                          業務委託契約 (契約案)
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          バージョン: v{outVersion}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-white">{outTitle}</h3>
                    </div>

                    <div className="shrink-0">
                      {outAgreement ? (
                        <div className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> 同意状態: 同意済み
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
                          <Clock className="w-4 h-4" /> 同意状態: 未締結 (契約案)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metadata Grid (Requirement 18: Title, Type, Version, Created Org, Attachment Date, Status) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">契約書タイトル</span>
                      <strong className="text-white font-medium">{outTitle}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">契約種類</span>
                      <span className="text-emerald-300 font-semibold">業務委託契約 (契約案)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">バージョン</span>
                      <span className="text-slate-200 font-mono">v{outVersion}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">作成者（法人/自治体）</span>
                      <strong className="text-white font-medium">{orgName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">添付日時</span>
                      <span className="text-slate-300">{attachedDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">同意状態</span>
                      <span className={outAgreement ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                        {outAgreement ? `同意済 (${new Date(outAgreement.agreed_at || outAgreement.created_at).toLocaleDateString()})` : '未締結 (提示中)'}
                      </span>
                    </div>
                    {outHash && (
                      <div className="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-800/80 font-mono text-[11px] text-slate-400 truncate">
                        改ざん防止ハッシュ: <span className="text-slate-300">{outHash}</span>
                      </div>
                    )}
                  </div>

                  {/* PDF View, Download, and Electronic Signature Tool Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveSignatureContract({
                          title: outTitle,
                          type: 'outsourcing',
                          body: outBody,
                          id: scout.outsourcing_contract_id || 0,
                          version: outVersion,
                          existingAgreement: outAgreement
                        })}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700"
                        title="PDF形式表示・印刷プレビュー"
                      >
                        <Printer className="w-4 h-4 text-indigo-400" />
                        PDF表示 / 印刷
                      </button>

                      <button
                        onClick={() => handleDownloadTxt(outTitle, outBody)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700"
                        title="契約文章をTXT形式でダウンロード"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        ダウンロード (.txt)
                      </button>
                    </div>

                    <button
                      onClick={() => setActiveSignatureContract({
                        title: outTitle,
                        type: 'outsourcing',
                        body: outBody,
                        id: scout.outsourcing_contract_id || 0,
                        version: outVersion,
                        existingAgreement: outAgreement
                      })}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {outAgreement ? '同意書を確認 / 証明書出力' : '契約案を確認・最終電子署名'}
                    </button>
                  </div>

                  {/* Scrollable Contract Body / Org Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-bold text-slate-300">業務委託契約案 文章 (全文表示・スクロール可能)</span>
                      {(!isReceiver || isOrg) && (
                        <button
                          onClick={() => {
                            setEditOutBody(outBody);
                            setIsEditingOut(!isEditingOut);
                          }}
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {isEditingOut ? '編集キャンセル' : '文章を修正 (バージョン更新)'}
                        </button>
                      )}
                    </div>

                    {isEditingOut ? (
                      <div className="space-y-3 bg-slate-950 p-4 border border-emerald-500/40 rounded-xl">
                        <div className="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          業務委託契約本文を直接編集（1文字でも変更されるとハッシュ値が変更され新バージョンとして受諾者に再同意が求められます）
                        </div>
                        <textarea
                          value={editOutBody}
                          onChange={(e) => setEditOutBody(e.target.value)}
                          rows={10}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setIsEditingOut(false)}
                            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={() => handleSaveContractText('outsourcing')}
                            disabled={savingContract}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                          >
                            <Save className="w-4 h-4" />
                            {savingContract ? '保存中...' : '契約文章を更新する'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto p-5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner">
                        {outBody}
                      </div>
                    )}

                    {/* Scroll / Reading proof notice (Requirement 18 rule) */}
                    <div className="p-3 bg-slate-800/60 border border-slate-700/80 rounded-xl text-xs text-slate-300 flex items-start gap-2">
                      <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block mb-0.5">※ 確認に関する規定</strong>
                        契約文章は上記の枠内でスクロールして全文をご確認いただけます。なお、スクロール動作自体は単なる閲覧操作であり、「読んだ証明」や法的な同意とは扱われません。条件協議完了後、電子署名手続きを完了させることで締結となります。
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 space-y-3">
                  <FileCode className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-base font-bold text-slate-300">業務委託契約案は添付されていません</p>
                  <p className="text-xs text-slate-500">このスカウトには業務委託契約案は事前添付されていません。</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Final Contract Agreement Modal (Requirement 20) */}
      {showFinalAgreementModal && (
        <FinalContractAgreementModal
          scout={scout}
          onClose={() => setShowFinalAgreementModal(false)}
          onSuccess={() => {
            setShowFinalAgreementModal(false);
            fetchScoutDetail();
          }}
        />
      )}

      {/* Electronic Signature Modal */}
      {activeSignatureContract && (
        <ElectronicSignatureModal
          scoutId={scout.id}
          contractTitle={activeSignatureContract.title}
          contractType={activeSignatureContract.type}
          contractBody={activeSignatureContract.body}
          contractVersion={activeSignatureContract.version}
          contractId={activeSignatureContract.id}
          existingAgreement={activeSignatureContract.existingAgreement}
          senderName={scout.sender_name}
          receiverName={scout.receiver_name}
          onClose={() => setActiveSignatureContract(null)}
          onAgreementSuccess={() => {
            fetchScoutDetail();
          }}
        />
      )}

      {/* 要件26: 「関心ありとして返信」モーダル (契約不成立明記) */}
      {showInterestModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative text-white">
            <div className="flex items-center justify-between border-b border-emerald-800/60 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base sm:text-lg text-white">関心ありとして返信</h3>
              </div>
              <button onClick={() => setShowInterestModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 超重要免責注記バナー (要件26明示要求) */}
            <div className="p-3.5 bg-amber-500/15 border-2 border-amber-500/50 rounded-2xl space-y-1.5 text-xs text-amber-200">
              <div className="font-black text-amber-300 flex items-center gap-1.5 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>【重要】契約成立に関する確認事項</span>
              </div>
              <p className="leading-relaxed text-amber-100 font-medium">
                「関心あり」を選択しただけでは契約成立とはなりません。<br />
                契約は、個人と発注側（法人/自治体）の双方が詳細条件・仕様・報酬を確認し、別途「電子署名・最終同意」を行った場合にのみ正式に成立します。
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-slate-300">
                提案者（{scout.sender_name}）への返信メッセージ
              </label>
              <textarea
                value={interestMessage}
                onChange={(e) => setInterestMessage(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowInterestModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    await fetch(`/api/scouts/${scout.id}/status`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'x-user-id': user.id.toString() },
                      body: JSON.stringify({ status: 'discussion' })
                    });
                    setShowInterestModal(false);
                    fetchScoutDetail();
                    alert(`「関心あり」として返信を送信しました。（ステータス: 条件協議中）\n※契約成立には別途双方の最終確認・電子署名が必要です。`);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setActionLoading(false);
                  }
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>「関心あり」として送信（条件協議を開始）</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 要件26: 「質問を送信」モーダル */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-indigo-500/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative text-white">
            <div className="flex items-center justify-between border-b border-indigo-800/60 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                <h3 className="font-extrabold text-base sm:text-lg text-white">提案者への質問を送信</h3>
              </div>
              <button onClick={() => setShowQuestionModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-slate-300">
                質問・確認事項
              </label>
              <textarea
                value={questionContent}
                onChange={(e) => setQuestionContent(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuestionModal(false);
                  alert('提案者へ質問メッセージを送信しました。回答が届くまでしばらくお待ちください。');
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-500/20 flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>質問を送信する</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 要件26: 「組織内の担当者へ共有」モーダル */}
      {showShareOrgModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative text-white">
            <div className="flex items-center justify-between border-b border-amber-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-base sm:text-lg text-white">法人・自治体内の担当者へ共有</h3>
              </div>
              <button onClick={() => setShowShareOrgModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">社内・学内共有先 担当者名 / 部署</label>
                <input
                  type="text"
                  value={shareStaffName}
                  onChange={(e) => setShareStaffName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">共有メッセージ・注意事項メモ</label>
                <textarea
                  value={shareMemo}
                  onChange={(e) => setShareMemo(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowShareOrgModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setShowShareOrgModal(false);
                  alert(`社内・庁内の担当者（${shareStaffName}）への共有リンクと通知メモを作成・コピーしました。`);
                }}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>共有通知を送信 & リンクコピー</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 要件26: 「元のVisionを閲覧」モーダル */}
      {showBaseVisionModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-purple-500/80 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative text-white max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-purple-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-400" />
                <h3 className="font-extrabold text-base sm:text-lg text-white">元となるVisionの詳細情報</h3>
              </div>
              <button onClick={() => setShowBaseVisionModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="space-y-1">
                <span className="text-purple-300 font-bold block">Visionタイトル</span>
                <p className="text-white font-extrabold text-base">{scout.offer_title || scout.title || '地域交通課題解決MaaS構想'}</p>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-800">
                <span className="text-purple-300 font-bold block">解決したい背景・課題意識</span>
                <p className="text-slate-200 leading-relaxed">
                  地方自治体および過疎地域における公共交通機関の維持困難、デマンドバス運行効率化とスマートモビリティ導入による住民の移動手段確保。
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-800">
                <span className="text-purple-300 font-bold block">実現したい未来・ビジョン</span>
                <p className="text-slate-200 leading-relaxed">
                  AIルート最適化アルゴリズムを導入し、地域全体で持続可能なコミュニティモビリティの確立。
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBaseVisionModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 要件26: 「提案者の公開プロフィール」モーダル */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-purple-500/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative text-white">
            <div className="flex items-center justify-between border-b border-purple-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-400" />
                <h3 className="font-extrabold text-base sm:text-lg text-white">提案者の公開プロフィール</h3>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <img
                src={scout.sender_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt=""
                className={`w-16 h-16 rounded-full object-cover bg-slate-800 ${getAccountTypeBorderClass(scout.sender_account_type || 'individual', 'border-[3px]')}`}
              />
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-white text-base">{scout.sender_name}</h4>
                  <AccountTypeBadge accountType={scout.sender_account_type || 'individual'} size="xs" />
                </div>
                <p className="text-purple-300 font-medium">フルスタックAIエンジニア / データアナリスト</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded font-mono text-[10px]">Python</span>
                  <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded font-mono text-[10px]">TypeScript</span>
                  <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded font-mono text-[10px]">MaaS / AI</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <strong>自己紹介:</strong><br />
              地域の移動課題解決に特化したAIソリューションの構築経験があります。過去に自治体実証実験でアルゴリズム提案を行った実績があります。
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <Link
                to={`/profile/${scout.sender_id}`}
                onClick={() => {
                  setShowProfileModal(false);
                  onClose();
                }}
                className="text-xs text-purple-400 font-bold hover:underline"
              >
                フルプロフィールを開く &rarr;
              </Link>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
