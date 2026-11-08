import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle2, Infinity as InfinityIcon, 
  CreditCard, Check, AlertCircle, Clock, ShieldCheck, 
  ChevronDown, ChevronUp, History, MessageSquare, ExternalLink, Send, Landmark
} from 'lucide-react';
import { ProjectContract } from '../types';

interface ProjectContractViewModalProps {
  contractId: number;
  currentUserId: number;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenChat?: (projectId?: number, ideaId?: number) => void;
}

export const ProjectContractViewModal: React.FC<ProjectContractViewModalProps> = ({
  contractId,
  currentUserId,
  isOpen,
  onClose,
  onRefresh,
  onOpenChat
}) => {
  const [contract, setContract] = useState<ProjectContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && contractId) {
      fetchContract();
    }
  }, [isOpen, contractId]);

  const fetchContract = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/project-contracts/${contractId}`);
      if (!res.ok) throw new Error('契約情報の取得に失敗しました');
      const data = await res.json();
      setContract(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAgree = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/project-contracts/${contractId}/agree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId.toString()
        },
        body: JSON.stringify({ user_id: currentUserId })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '同意に失敗しました');
      }
      await fetchContract();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckout = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/project-contracts/${contractId}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId.toString()
        },
        body: JSON.stringify({ user_id: currentUserId })
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else if (data.mock) {
        // Simulated payment completed in test mode
        await fetchContract();
        if (onRefresh) onRefresh();
      }
    } catch (e: any) {
      setError(e.message || '決済の開始に失敗しました');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/project-contracts/${contractId}/simulate-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('決済シミュレーションに失敗しました');
      await fetchContract();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteService = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/project-contracts/${contractId}/complete-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId.toString()
        },
        body: JSON.stringify({ user_id: currentUserId })
      });
      if (!res.ok) throw new Error('役務完了の更新に失敗しました');
      await fetchContract();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferReward = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/project-contracts/${contractId}/transfer-reward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId.toString()
        },
        body: JSON.stringify({ user_id: currentUserId })
      });
      if (!res.ok) throw new Error('報酬送金に失敗しました');
      await fetchContract();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const isOrg = contract && currentUserId === contract.organization_account_id;
  const isInd = contract && currentUserId === contract.individual_account_id;
  const myAgreed = isOrg ? !!contract?.organization_agreed_at : !!contract?.individual_agreed_at;
  const counterpartyAgreed = isOrg ? !!contract?.individual_agreed_at : !!contract?.organization_agreed_at;

  const getStatusBadge = () => {
    if (!contract) return null;
    if (contract.contract_status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" />
          契約完了
        </span>
      );
    }
    if (contract.contract_status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
          進行中
        </span>
      );
    }
    if (contract.contract_status === 'awaiting_payment') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
          <Clock className="w-3.5 h-3.5" />
          決済待ち
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
        <ShieldCheck className="w-3.5 h-3.5" />
        合意確認中
      </span>
    );
  };

  return (
    <div id="project-contract-view-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        id="project-contract-view-card" 
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-zinc-900 dark:text-zinc-100"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              {contract?.project_contract_type === 'participation' ? (
                <Users className="w-4 h-4" />
              ) : contract?.project_contract_type === 'completion' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <InfinityIcon className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold truncate max-w-sm">{contract?.title || 'Project Contract'}</h2>
              <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                <span>Ver.{contract?.contract_version || 1}</span>
                <span>•</span>
                <span>
                  {contract?.project_contract_type === 'participation' ? '一緒に進める（Project参加型）'
                    : contract?.project_contract_type === 'completion' ? '完成させる（成果完成型）'
                    : '一緒につくる（共同事業型）'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <button 
              id="btn-close-project-contract-view"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm p-1 rounded-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400">読み込み中...</div>
          ) : contract ? (
            <>
              {/* Municipality / Off-platform Procedure Notice (Requirement 25) */}
              {(contract.requires_offplatform_procedure === 1 || contract.organization_account_type === 'municipality') && (
                <div className="p-4 bg-gradient-to-r from-purple-900/10 via-purple-900/5 to-indigo-900/10 border border-purple-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs text-purple-900 dark:text-purple-200">
                      <Landmark className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>自治体特有の契約・調達手続きについて</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-600 text-white shadow-sm shrink-0">
                      別途契約手続きが必要です
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    本Project Contractの合意は、E-hub上でのプロジェクト条件・役割分担の合意メモ（基本覚書）となります。自治体（行政）特有の地方自治法・調達規程・公募プロポーザル等の手続きに基づき、<strong className="text-purple-900 dark:text-purple-100 font-semibold">別途公募・議会承認・書面での本契約締結等の個別手続きが必要となる場合があります。</strong>
                  </p>
                </div>
              )}

              {/* Financial Highlight Card */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {isOrg ? 'お支払い総額（+5%成功報酬含）' : '個人受取金額（手数料0%）'}
                    </div>
                    <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {contract.gross_amount > 0 ? (
                        isOrg ? `¥${(contract.organization_total_amount || (contract.gross_amount + (contract.platform_fee_amount || Math.round(contract.gross_amount * 0.05)))).toLocaleString()}` : `¥${(contract.individual_net_amount || contract.gross_amount).toLocaleString()}`
                      ) : (
                        '要相談'
                      )}
                    </div>
                  </div>

                  {/* Joint business summary chip if applicable (項目70) */}
                  {contract.project_contract_type === 'joint_business' && contract.revenue_share_rate && (
                    <div className="text-right">
                      <div className="text-[11px] text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1 justify-end">
                        <InfinityIcon className="w-3.5 h-3.5" />
                        売上分配 {contract.revenue_share_rate}%
                      </div>
                      <div className="text-[10px] text-zinc-400">{contract.revenue_share_period || '条件通り'}</div>
                    </div>
                  )}
                </div>

                {/* Details toggle */}
                <button
                  type="button"
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium flex items-center gap-1"
                >
                  <span>内訳・決済詳細</span>
                  {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showBreakdown && (
                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-1.5 text-xs">
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-300">
                      <span>基本契約額:</span>
                      <span className="font-semibold">¥{contract.gross_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>個人受取額（0%手数料）:</span>
                      <span>¥{(contract.individual_net_amount || contract.gross_amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500 text-[11px]">
                      <span>発注側 成功報酬（5%）:</span>
                      <span>¥{(contract.platform_fee_amount || Math.round(contract.gross_amount * 0.05)).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-zinc-800 dark:text-zinc-200 font-bold text-xs pt-1 border-t border-zinc-200 dark:border-zinc-700">
                      <span>発注側 支払総額:</span>
                      <span>¥{(contract.organization_total_amount || (contract.gross_amount + (contract.platform_fee_amount || Math.round(contract.gross_amount * 0.05)))).toLocaleString()}</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 pt-1">
                      ※Stripe決済により安全にエスクロー保護され、役務確認後に個人アカウントへ送金されます。
                    </div>
                  </div>
                )}
              </div>

              {/* Key Terms Overview */}
              <div className="p-4 bg-white dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-700/60">
                  <div>
                    <span className="text-zinc-400 block text-[10px]">発注アカウント（法人/自治体）</span>
                    <strong className="text-zinc-800 dark:text-zinc-200">{contract.organization_name || '法人/自治体'}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">個人パートナー</span>
                    <strong className="text-zinc-800 dark:text-zinc-200">{contract.individual_name || 'パートナー'}</strong>
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-zinc-400">進め方・契約種別:</span>
                  <span className="font-medium text-right">
                    {contract.project_contract_type === 'participation' ? 'Project参加型（準委任）'
                      : contract.project_contract_type === 'completion' ? '成果完成型（請負）'
                      : '共同事業型（協業）'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-zinc-400">{contract.project_contract_type === 'completion' ? '納品予定日:' : '活動期間:'}</span>
                  <span className="font-medium">
                    {contract.project_contract_type === 'completion' ? (contract.delivery_date || '別途設定') : (contract.duration || '条件通り')}
                  </span>
                </div>

                {contract.deliverables && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">対象成果物:</span>
                    <span className="font-medium text-right">{contract.deliverables}</span>
                  </div>
                )}

                {contract.role && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">主な役割:</span>
                    <span className="font-medium text-right">{contract.role}</span>
                  </div>
                )}
              </div>

              {/* Progress & Agreements Status Box */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs space-y-2">
                <div className="font-semibold text-zinc-700 dark:text-zinc-300">合意・決済進捗</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                    contract.organization_agreed_at 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                      : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
                  }`}>
                    {contract.organization_agreed_at ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5" />}
                    <span>発注側（法人/自治体）: {contract.organization_agreed_at ? '同意済み' : '未同意'}</span>
                  </div>

                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                    contract.individual_agreed_at 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                      : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
                  }`}>
                    {contract.individual_agreed_at ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5" />}
                    <span>個人: {contract.individual_agreed_at ? '同意済み' : '未同意'}</span>
                  </div>
                </div>

                {contract.paid_at && (
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-1">
                    <Check className="w-3 h-3" />
                    <span>決済完了 ({new Date(contract.paid_at).toLocaleDateString()}) - Project Chat解放済み</span>
                  </div>
                )}
              </div>

              {/* Version History Accordion (項目73, 77) */}
              {contract.versions && contract.versions.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium flex items-center gap-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>契約変更履歴（全{contract.versions.length}版）</span>
                    {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showHistory && (
                    <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-2 text-xs">
                      {contract.versions.map((ver) => (
                        <div key={ver.id} className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-zinc-700 last:border-0 last:pb-0">
                          <div>
                            <span className="font-bold text-zinc-700 dark:text-zinc-300">第{ver.contract_version}版</span>
                            <span className="text-zinc-400 ml-2">{ver.change_summary}</span>
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {new Date(ver.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions (Context-sensitive lifecycle triggers) */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between gap-3">
          {/* Chat jump button if active (項目45) */}
          {contract?.contract_status === 'active' && onOpenChat && (
            <button
              type="button"
              id="btn-open-project-contract-chat"
              onClick={() => {
                onClose();
                onOpenChat(contract.project_id || undefined, contract.idea_id || undefined);
              }}
              className="px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Project Chat を開く
            </button>
          )}

          <div className="flex-1" />

          {/* 1. Agreement Phase (項目43: 双方同意) */}
          {contract?.contract_status === 'draft' && (
            <button
              type="button"
              id="btn-project-contract-agree"
              disabled={myAgreed || actionLoading}
              onClick={handleAgree}
              className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all ${
                myAgreed 
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {myAgreed ? (
                <>
                  <Check className="w-4 h-4" />
                  同意済み（相手の同意待ち）
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  契約条件に同意する
                </>
              )}
            </button>
          )}

          {/* 2. Payment Phase (項目39, 43, 49: 組織決済 & テスト決済) */}
          {contract?.contract_status === 'awaiting_payment' && isOrg && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-project-contract-simulate-pay"
                disabled={actionLoading}
                onClick={handleSimulatePayment}
                className="px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 rounded-lg"
                title="TEST MODE用決済シミュレーション"
              >
                テスト決済
              </button>
              <button
                type="button"
                id="btn-project-contract-stripe-checkout"
                disabled={actionLoading}
                onClick={handleCheckout}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <CreditCard className="w-4 h-4" />
                Stripeで決済する (¥{contract.gross_amount.toLocaleString()})
              </button>
            </div>
          )}

          {contract?.contract_status === 'awaiting_payment' && !isOrg && (
            <div className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              発注側（法人・自治体）の決済確認待ちです
            </div>
          )}

          {/* 3. Execution Phase (役務完了・検収確認 - 項目41) */}
          {contract?.contract_status === 'active' && !contract.service_completed_at && (
            <button
              type="button"
              id="btn-project-contract-complete-service"
              disabled={actionLoading}
              onClick={handleCompleteService}
              className="px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              成果物・役務の確認完了（検収）
            </button>
          )}

          {/* 4. Reward Transfer Phase (Stripe Connect 85%送金 - 項目42) */}
          {contract?.contract_status === 'active' && contract.service_completed_at && contract.payment_status !== 'transferred' && isOrg && (
            <button
              type="button"
              id="btn-project-contract-transfer-reward"
              disabled={actionLoading}
              onClick={handleTransferReward}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              個人へ報酬を送金する (¥{contract.individual_net_amount.toLocaleString()})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
