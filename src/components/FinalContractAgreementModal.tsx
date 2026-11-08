import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, FileText, CheckCircle2, Lock, AlertCircle, AlertTriangle, UserCheck, Sparkles, HelpCircle, Edit3, RefreshCw, Send } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { computeContractHash } from '../utils/contractHash';

interface FinalContractAgreementModalProps {
  scout: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FinalContractAgreementModal({ scout, onClose, onSuccess }: FinalContractAgreementModalProps) {
  const { user, language } = useAppContext();
  const [currentScout, setCurrentScout] = useState(scout);

  // Requirement 26 State
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionType, setRevisionType] = useState<'question' | 'revision_request'>('revision_request');
  const [targetClause, setTargetClause] = useState('第8条 知的財産権');
  const [revisionComment, setRevisionComment] = useState('成果物の権利をすべて譲渡するのではなく、利用許諾へ変更できるか確認したいです。');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // Contract details
  const hasNda = Boolean(currentScout.nda_contract || currentScout.nda_contract_id || currentScout.nda_snapshot_body || currentScout.nda);
  const isNdaRequired = Boolean(hasNda || currentScout.nda || currentScout.nda_required);
  const ndaTitle = currentScout.nda_snapshot_title || currentScout.nda_contract?.title || '秘密保持契約書 (NDA)';
  const ndaBody = currentScout.nda_snapshot_body || currentScout.nda_contract?.body || `【秘密保持契約書 (NDA)】\n\n本契約は、開示者（${currentScout.sender_name || '発注側（法人/自治体）'}）と受領者（${currentScout.receiver_name || user?.username || '受諾者'}）との間において、対象プロジェクト（${currentScout.project_title || currentScout.title || 'スカウト案件'}）に関する秘密情報の取り扱いについて定めるものです。\n\n第1条（目的）\n受領者は、開示者から開示された秘密情報を、本プロジェクトの検討および実施の目的のみに使用し、他のいかなる目的にも使用しない。\n\n第2条（秘密保持義務）\n受領者は、開示者の事前の書面による承諾なしに、秘密情報を第三者に開示または漏洩してはならない。\n\n第3条（有効期間）\n本契約の有効期間は、契約締結日から本プロジェクト終了後1年間とする。`;
  const ndaVersion = currentScout.nda_snapshot_version || currentScout.nda_contract?.version || 1;

  const hasOutsourcing = Boolean(currentScout.outsourcing_contract || currentScout.outsourcing_body || currentScout.outsourcing_contract_id || currentScout.outsourcing_snapshot_body);
  const isOutsourcingPresent = Boolean(hasOutsourcing || currentScout.outsourcing_contract || currentScout.outsourcing_body || currentScout.outsourcing_contract_id);
  const outTitle = currentScout.outsourcing_snapshot_title || currentScout.outsourcing_contract?.title || '業務委託契約書 (確定案)';
  const outBody = currentScout.outsourcing_snapshot_body || currentScout.outsourcing_contract?.body || currentScout.outsourcing_body || `【業務委託契約書】\n\n委託者（${currentScout.sender_name || '発注側（法人/自治体）'}）および受託者（${currentScout.receiver_name || user?.username || '受託者'}）は、以下のとおり業務委託契約を締結する。\n\n第1条（業務内容）\n受託者は、委託者の指示に従い、${currentScout.role || '指定業務'}に関する業務を行う。\n\n第2条（契約期間）\n期間: ${currentScout.period || '条件協議に基づき確定'}\n\n第3条（委託料および支払方法）\n報酬: ${currentScout.reward_type || '月額/一括'} ${currentScout.reward_amount || ''}\n\n第4条（成果物の権利帰属）\n本業務において作成された成果物の著作権（著作権法第27条及び第28条の権利を含む）は、対価の支払完了をもって委託者に移転するものとする。`;
  const outVersion = currentScout.outsourcing_snapshot_version || currentScout.outsourcing_contract?.version || 1;

  // Checkbox states (SEPARATE for each contract)
  const [ndaAgreed, setNdaAgreed] = useState(false);
  const [outsourcingAgreed, setOutsourcingAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState(user?.username || '');

  // Hash check states for Requirement 21
  const [ndaHashChanged, setNdaHashChanged] = useState(false);
  const [outHashChanged, setOutHashChanged] = useState(false);
  const [currentNdaHash, setCurrentNdaHash] = useState('');
  const [currentOutHash, setCurrentOutHash] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Requirement 21: Calculate hashes and check if contract text was modified compared to previous agreement
  useEffect(() => {
    async function checkHashes() {
      if (isNdaRequired) {
        const hashNda = await computeContractHash(ndaTitle, ndaBody);
        setCurrentNdaHash(hashNda);

        const prevNdaAgreement = scout.agreements?.find((a: any) =>
          a.contract_id === scout.nda_contract_id ||
          (a.snapshot_title && a.snapshot_title.includes('秘密保持'))
        );

        if (prevNdaAgreement) {
          const isDiff = prevNdaAgreement.content_hash
            ? prevNdaAgreement.content_hash !== hashNda
            : (prevNdaAgreement.snapshot_body && prevNdaAgreement.snapshot_body !== ndaBody);

          if (isDiff) {
            setNdaHashChanged(true);
            setNdaAgreed(false); // Invalidate previous agreement check
          }
        }
      }

      if (isOutsourcingPresent) {
        const hashOut = await computeContractHash(outTitle, outBody);
        setCurrentOutHash(hashOut);

        const prevOutAgreement = scout.agreements?.find((a: any) =>
          a.contract_id === scout.outsourcing_contract_id ||
          (a.snapshot_title && a.snapshot_title.includes('業務委託'))
        );

        if (prevOutAgreement) {
          const isDiff = prevOutAgreement.content_hash
            ? prevOutAgreement.content_hash !== hashOut
            : (prevOutAgreement.snapshot_body && prevOutAgreement.snapshot_body !== outBody);

          if (isDiff) {
            setOutHashChanged(true);
            setOutsourcingAgreed(false); // Invalidate previous agreement check
          }
        }
      }
    }

    checkHashes();
  }, [scout, ndaTitle, ndaBody, outTitle, outBody, isNdaRequired, isOutsourcingPresent]);

  // Validation: Both required contracts must be checked separately
  const canSubmit = (!isNdaRequired || ndaAgreed) && (!isOutsourcingPresent || outsourcingAgreed) && signatureName.trim().length > 0;

  const handleFinalSubmit = async () => {
    if (!user || !canSubmit || isSubmitting) return;

    // Requirement 20: ボタンを押す前に、確認ダイアログを表示してください。
    // メッセージ：「表示されている契約書の内容に同意しますか？」
    const confirmMessage = '表示されている契約書の内容に同意しますか？';
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create Agreement Record for NDA (if NDA is required/present)
      if (isNdaRequired) {
        const ndaRes = await fetch('/api/contracts/agreements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id.toString()
          },
          body: JSON.stringify({
            user_id: user.id,
            contract_id: scout.nda_contract_id || -1,
            contract_version: ndaVersion,
            snapshot_title: ndaTitle,
            snapshot_body: ndaBody,
            target_type: 'scout',
            target_id: scout.id,
            signature_name: signatureName.trim(),
            status: 'agreed'
          })
        });

        if (!ndaRes.ok) {
          const data = await ndaRes.json();
          throw new Error(data.error || '秘密保持契約の同意記録保存に失敗しました。');
        }
      }

      // 2. Create Agreement Record for Outsourcing Contract (if Outsourcing is present)
      if (isOutsourcingPresent) {
        const outRes = await fetch('/api/contracts/agreements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id.toString()
          },
          body: JSON.stringify({
            user_id: user.id,
            contract_id: scout.outsourcing_contract_id || -2,
            contract_version: outVersion,
            snapshot_title: outTitle,
            snapshot_body: outBody,
            target_type: 'scout',
            target_id: scout.id,
            signature_name: signatureName.trim(),
            status: 'agreed'
          })
        });

        if (!outRes.ok) {
          const data = await outRes.json();
          throw new Error(data.error || '業務委託契約の同意記録保存に失敗しました。');
        }
      }

      // 3. Update scout status to confirmed (参加移行・締結完了)
      const statusRes = await fetch(`/api/scouts/${scout.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({
          status: 'confirmed'
        })
      });

      if (!statusRes.ok) {
        const data = await statusRes.json();
        throw new Error(data.error || 'スカウトステータスの更新に失敗しました。');
      }

      onSuccess();
    } catch (e: any) {
      console.error(e);
      setError(e.message || '契約同意処理中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevisionSubmit = async () => {
    if (!user || !targetClause.trim() || !revisionComment.trim()) return;
    setIsSubmittingRevision(true);
    setError(null);
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
        const updated = await res.json();
        setCurrentScout(updated);
        setShowRevisionForm(false);
        if (onSuccess) onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || '修正依頼の送信に失敗しました。');
      }
    } catch (e: any) {
      console.error(e);
      setError('エラーが発生しました。');
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl text-slate-100 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                契約内容の最終確認・同意
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  最終同意段階
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                発注側（法人・自治体）より提示された最終契約内容をご確認の上、個別にチェックを入れて同意してください。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Revision Requested Status Notice if status === 'revision_requested' */}
          {currentScout.status === 'revision_requested' && (
            <div className="p-4 bg-amber-500/15 border-2 border-amber-500/40 rounded-xl space-y-2 text-amber-200 shadow-lg">
              <div className="font-bold flex items-center justify-between text-amber-300 text-sm">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  【修正依頼中 (status: revision_requested)】発注側（法人・自治体）へ修正確認を依頼しました
                </span>
                <span className="text-xs px-2.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-mono border border-amber-500/40">
                  発注側（法人・自治体）の回答待ち
                </span>
              </div>
              <div className="text-xs bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1 text-slate-300">
                <div><span className="text-slate-400 font-bold">対象条文:</span> {currentScout.revision_target_clause || '未指定'}</div>
                <div><span className="text-slate-400 font-bold">コメント:</span> {currentScout.revision_comment}</div>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                ※ 発注側（法人・自治体）が契約書を修正した場合、新しいバージョン（v2など）が作成され、再確認・再同意が求められます。
              </p>
            </div>
          )}

          {/* Requirement 26: Questions and Revision Request Buttons */}
          {currentScout.status !== 'revision_requested' && (
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-200 text-xs sm:text-sm">
                    契約同意前に質問や修正依頼がありますか？
                  </div>
                  <div className="text-[11px] text-slate-400">
                    契約内容について発注側（法人・自治体）へ問い合わせたり、条文の修正を依頼できます。
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setRevisionType('question');
                      setShowRevisionForm(true);
                      if (!targetClause) setTargetClause('第8条 知的財産権');
                      if (!revisionComment) setRevisionComment('成果物の権利をすべて譲渡するのではなく、利用許諾へ変更できるか確認したいです。');
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    契約内容について質問する
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRevisionType('revision_request');
                      setShowRevisionForm(true);
                      if (!targetClause) setTargetClause('第8条 知的財産権');
                      if (!revisionComment) setRevisionComment('成果物の権利をすべて譲渡するのではなく、利用許諾へ変更できるか確認したいです。');
                    }}
                    className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    修正を依頼する
                  </button>
                </div>
              </div>

              {/* Requirement 26 Revision Request Form */}
              {showRevisionForm && (
                <div className="p-4 bg-slate-900 border-2 border-amber-500/50 rounded-xl space-y-3 shadow-xl mt-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-amber-400" />
                      {revisionType === 'question' ? '契約内容についての質問送信' : '契約文章の修正依頼 (revision_requested)'}
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        コメント・理由 <span className="text-rose-400">*</span>
                      </label>
                      <textarea
                        value={revisionComment}
                        onChange={(e) => setRevisionComment(e.target.value)}
                        placeholder="例：成果物の権利をすべて譲渡するのではなく、利用許諾へ変更できるか確認したいです。"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 h-24 resize-none"
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
                        {isSubmittingRevision ? '送信中...' : '修正依頼を送信する'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Project Summary Banner */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between gap-3 text-xs sm:text-sm">
            <div>
              <div className="text-slate-400 text-xs">対象スカウト案件</div>
              <div className="font-bold text-white text-base mt-0.5">{scout.project_title || scout.title || 'スカウト案件'}</div>
              <div className="text-slate-400 mt-1">
                差出元（法人/自治体）: <span className="text-indigo-300 font-medium">{scout.sender_name || '差出元'}</span> | 担当役職: <span className="text-amber-300 font-medium">{scout.role || 'メンバー'}</span>
              </div>
            </div>
            <div className="text-right sm:self-center shrink-0 text-xs text-slate-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center gap-1.5 text-indigo-400 font-mono font-bold">
                <Lock className="w-3.5 h-3.5" />
                不可変スナップショット保護
              </div>
              <div className="mt-0.5">電子同意ログ（IP・タイムスタンプ）を保持</div>
            </div>
          </div>

          {/* Separate Contract Sections */}
          <div className="space-y-6">

            {/* 1. Non-Disclosure Agreement (秘密保持契約書) */}
            {isNdaRequired && (
              <div className="bg-slate-950/90 rounded-xl border border-amber-500/30 overflow-hidden shadow-lg">
                <div className="bg-amber-500/10 px-4 py-3 border-b border-amber-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-amber-300 text-sm">{ndaTitle}</span>
                    <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                      v{ndaVersion}
                    </span>
                  </div>
                  <span className="text-xs text-amber-400/80 font-medium">※個別同意が必須です</span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Requirement 21 Warning Notice if NDA text changed */}
                  {ndaHashChanged && (
                    <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-200 text-xs space-y-1 shadow-inner">
                      <div className="font-bold flex items-center gap-1.5 text-amber-300 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        契約文章が更新されました。
                      </div>
                      <p className="text-amber-100/90 leading-relaxed font-medium">
                        変更後の内容を確認し、もう一度同意してください。
                      </p>
                    </div>
                  )}

                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 max-h-52 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                    {ndaBody}
                  </div>

                  {/* SEPARATE Checkbox 1 */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={ndaAgreed}
                        onChange={(e) => setNdaAgreed(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                      />
                      <span className="font-bold text-amber-300 text-sm leading-snug">
                        秘密保持契約の全文を確認し、内容に同意します。
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Outsourcing Contract (業務委託契約書) */}
            {isOutsourcingPresent && (
              <div className="bg-slate-950/90 rounded-xl border border-emerald-500/30 overflow-hidden shadow-lg">
                <div className="bg-emerald-500/10 px-4 py-3 border-b border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-400" />
                    <span className="font-bold text-emerald-300 text-sm">{outTitle}</span>
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                      v{outVersion}
                    </span>
                  </div>
                  <span className="text-xs text-emerald-400/80 font-medium">※個別同意が必須です</span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Requirement 21 Warning Notice if Outsourcing text changed */}
                  {outHashChanged && (
                    <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs space-y-1 shadow-inner">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-300 text-sm">
                        <AlertTriangle className="w-4 h-4 text-emerald-400 shrink-0" />
                        契約文章が更新されました。
                      </div>
                      <p className="text-emerald-100/90 leading-relaxed font-medium">
                        変更後の内容を確認し、もう一度同意してください。
                      </p>
                    </div>
                  )}

                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 max-h-52 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                    {outBody}
                  </div>

                  {/* SEPARATE Checkbox 2 */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={outsourcingAgreed}
                        onChange={(e) => setOutsourcingAgreed(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                      />
                      <span className="font-bold text-emerald-300 text-sm leading-snug">
                        業務委託契約の全文を確認し、内容に同意します。
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Electronic Signature Name Input */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-400" />
              電子署名者氏名（同意者のお名前）
            </label>
            <input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="氏名を入力してください"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-400">
              ※ 電子署名法および電子契約ログに基づき、上記氏名・タイムスタンプ・IPアドレスが同意記録に保存されます。
            </p>
          </div>

          {/* Important Notice */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200/90 leading-relaxed space-y-1">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              契約同意に関する規定事項
            </div>
            <div>
              ・秘密保持契約および業務委託契約のそれぞれについて、内容の個別同意が必要です。<br />
              ・「契約内容に同意してプロジェクトへ参加する」ボタンを押すと確認ダイアログが表示されます。<br />
              ・同意完了後、両契約書の同意記録が独立して作成され、プロジェクトへ正式参加となります。
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            {!canSubmit ? (
              <span className="text-amber-400">※ すべての契約書の個別同意チェックボックスにチェックを入れてください。</span>
            ) : (
              <span className="text-emerald-400 font-medium">✓ すべての条件を満たしています。確認ボタンを押して同意してください。</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition-colors text-sm"
            >
              キャンセル
            </button>

            {/* Requirement 20: 最終ボタン: 「契約内容に同意してプロジェクトへ参加する」 */}
            <button
              onClick={handleFinalSubmit}
              disabled={!canSubmit || isSubmitting}
              className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                canSubmit && !isSubmitting
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20 active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none'
              }`}
            >
              {isSubmitting ? (
                <span>処理中...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>契約内容に同意してプロジェクトへ参加する</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
