import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle2, Infinity as InfinityIcon, 
  ArrowRight, ArrowLeft, Sparkles, AlertCircle, 
  HelpCircle, ChevronDown, ChevronUp, FileText, Check, Landmark
} from 'lucide-react';
import { ProjectContractType, CompensationType } from '../types';
import { useAppContext } from '../context/AppContext';

interface ProjectContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (contractId: number) => void;
  projectId?: number;
  ideaId?: number;
  organizationId: number;
  individualId: number;
  organizationName?: string;
  individualName?: string;
  organizationAccountType?: string;
  projectTitle?: string;
  ideaTitle?: string;
}

export const ProjectContractModal: React.FC<ProjectContractModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  ideaId,
  organizationId,
  individualId,
  organizationName = '発注元',
  individualName = 'パートナー',
  organizationAccountType,
  projectTitle = 'プロジェクト',
  ideaTitle
}) => {
  const { user } = useAppContext();
  const isMunicipality = user?.account_type === 'municipality' || organizationAccountType === 'municipality';

  // Step 1: 進め方 (Way of working)
  // Step 2: 条件 (Role, Deliverables, Duration)
  // Step 3: 報酬 (Compensation & Money)
  // Step 4: 確認 (Review & Propose)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [contractType, setContractType] = useState<ProjectContractType>('participation');
  const [title, setTitle] = useState(`${projectTitle} - Project Contract`);
  const [role, setRole] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [duration, setDuration] = useState('3ヶ月');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [activityScale, setActivityScale] = useState('週10〜15時間程度');
  const [requiresOffplatformProcedure, setRequiresOffplatformProcedure] = useState<boolean>(false);
  
  // Compensation
  const [compensationTypes, setCompensationTypes] = useState<CompensationType[]>(['fixed']);
  const [grossAmount, setGrossAmount] = useState<number>(300000);
  const [initialRewardAmount, setInitialRewardAmount] = useState<number>(100000);
  const [revenueShareRate, setRevenueShareRate] = useState<number>(3);
  const [revenueSharePeriod, setRevenueSharePeriod] = useState('リリース後12ヶ月間');
  const [isConsultation, setIsConsultation] = useState(false);

  // Details expand toggle
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ndaRequired, setNdaRequired] = useState(false);
  const [ndaBody, setNdaBody] = useState('業務上知り得た機密情報を第三者に開示・漏洩しないものとします。');
  const [inspectionConditions, setInspectionConditions] = useState('成果物提出後5営業日以内に確認・検収を行います。');

  // AI Assistance
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    recommended_type?: ProjectContractType;
    recommendation_reason?: string;
    missing_field?: string;
    missing_question?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate Fee model: Org +5% success fee, Individual 0% platform fee (100% net)
  const orgFeeRate = 0.05;
  const orgFeeAmount = Math.round((grossAmount || 0) * orgFeeRate);
  const organizationTotalAmount = (grossAmount || 0) + orgFeeAmount;
  const individualNetAmount = grossAmount || 0;

  // Set default requiresOffplatformProcedure when modal opens or if municipality
  useEffect(() => {
    if (isOpen) {
      if (isMunicipality) {
        setRequiresOffplatformProcedure(true);
      }
      fetchAiSuggestion();
    }
  }, [isOpen, contractType, isMunicipality]);

  const fetchAiSuggestion = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/project-contracts/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_title: projectTitle,
          idea_title: ideaTitle,
          selected_type: contractType,
          current_form: {
            duration,
            delivery_date: deliveryDate,
            gross_amount: grossAmount,
            deliverables,
            revenue_share_rate: revenueShareRate,
            compensation_types: compensationTypes,
            project_contract_type: contractType
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestion(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const toggleCompensationType = (type: CompensationType) => {
    if (type === 'negotiable') {
      setIsConsultation(!isConsultation);
      if (!isConsultation) {
        setCompensationTypes(['negotiable']);
      } else {
        setCompensationTypes(['fixed']);
      }
      return;
    }

    if (contractType === 'joint_business') {
      // Allow multiple combinations for joint business (項目70, 77)
      if (compensationTypes.includes(type)) {
        if (compensationTypes.length > 1) {
          setCompensationTypes(compensationTypes.filter(t => t !== type));
        }
      } else {
        setCompensationTypes([...compensationTypes.filter(t => t !== 'negotiable'), type]);
      }
    } else {
      setCompensationTypes([type]);
    }
  };

  const handleCreateContract = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        project_id: projectId || null,
        idea_id: ideaId || null,
        organization_account_id: organizationId,
        individual_account_id: individualId,
        project_contract_type: contractType,
        title,
        role: role || (contractType === 'participation' ? 'プロジェクト推進メンバー' : contractType === 'completion' ? '成果物制作者' : '共同事業パートナー'),
        scope_of_work: role || title,
        deliverables: contractType === 'completion' ? deliverables : undefined,
        delivery_date: contractType === 'completion' ? deliveryDate : undefined,
        duration: contractType !== 'completion' ? duration : undefined,
        activity_scale: activityScale,
        compensation_types: isConsultation ? ['negotiable'] : compensationTypes,
        gross_amount: isConsultation ? 0 : grossAmount,
        initial_reward_amount: compensationTypes.includes('revenue_share') ? initialRewardAmount : 0,
        revenue_share_rate: compensationTypes.includes('revenue_share') ? revenueShareRate : 0,
        revenue_share_period: compensationTypes.includes('revenue_share') ? revenueSharePeriod : '',
        inspection_conditions: inspectionConditions,
        nda_required: ndaRequired ? 1 : 0,
        nda_body: ndaRequired ? ndaBody : '',
        requires_offplatform_procedure: requiresOffplatformProcedure ? 1 : 0,
        currency: 'jpy'
      };

      const res = await fetch('/api/project-contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': organizationId.toString()
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '契約案の作成に失敗しました');
      }

      const created = await res.json();
      onSuccess(created.id);
      onClose();
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="project-contract-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        id="project-contract-modal-card" 
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-zinc-900 dark:text-zinc-100"
      >
        {/* Header with 4-Step Progress Indicator (項目68) */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Project Contract の作成
            </h2>
            <button 
              id="btn-close-project-contract-modal"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm p-1 rounded-lg"
            >
              ✕
            </button>
          </div>

          {/* Simple Step Breadcrumb */}
          <div className="flex items-center justify-between text-xs font-medium">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 1 ? 'bg-indigo-600 text-white' : step > 1 ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>1</span>
              進め方
            </div>
            <div className="h-[1px] flex-1 mx-2 bg-zinc-200 dark:bg-zinc-800" />
            <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 2 ? 'bg-indigo-600 text-white' : step > 2 ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>2</span>
              条件
            </div>
            <div className="h-[1px] flex-1 mx-2 bg-zinc-200 dark:bg-zinc-800" />
            <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 3 ? 'bg-indigo-600 text-white' : step > 3 ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>3</span>
              報酬
            </div>
            <div className="h-[1px] flex-1 mx-2 bg-zinc-200 dark:bg-zinc-800" />
            <div className={`flex items-center gap-1.5 ${step >= 4 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 4 ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>4</span>
              確認
            </div>
          </div>
        </div>

        {/* AI Mini Assistant Banner (項目71, 72: 簡潔・1行質問) */}
        {aiSuggestion?.missing_question && (
          <div className="px-6 py-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{aiSuggestion.missing_question}</span>
            </div>
            <button 
              onClick={fetchAiSuggestion}
              disabled={aiLoading}
              className="text-[11px] underline text-indigo-600 dark:text-indigo-400 shrink-0 hover:opacity-80"
            >
              更新
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: 進め方の選択 (3カード形式 - 項目60, 61, 74) */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">どう進めますか？</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  プロジェクトの目的や関わり方に合わせた最適な契約方式を選択してください。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. 一緒に進める (Project参加型) */}
                <div
                  id="card-contract-type-participation"
                  onClick={() => setContractType('participation')}
                  className={`cursor-pointer p-4 rounded-xl border transition-all text-left relative flex flex-col justify-between ${
                    contractType === 'participation'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                  }`}
                >
                  {contractType === 'participation' && (
                    <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-sm">一緒に進める</div>
                    <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mb-1">Project参加型</div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      一定期間プロジェクトに参加し、業務推進や知見提供を行います。
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400">
                    法形式: 準委任契約
                  </div>
                </div>

                {/* 2. 完成させる (成果完成型) */}
                <div
                  id="card-contract-type-completion"
                  onClick={() => setContractType('completion')}
                  className={`cursor-pointer p-4 rounded-xl border transition-all text-left relative flex flex-col justify-between ${
                    contractType === 'completion'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                  }`}
                >
                  {contractType === 'completion' && (
                    <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-sm">完成させる</div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mb-1">成果完成型</div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      設計書やモジュール、デザイン等の明確な成果物を完成・納品します。
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400">
                    法形式: 請負契約
                  </div>
                </div>

                {/* 3. 一緒につくる (共同事業型) */}
                <div
                  id="card-contract-type-joint"
                  onClick={() => setContractType('joint_business')}
                  className={`cursor-pointer p-4 rounded-xl border transition-all text-left relative flex flex-col justify-between ${
                    contractType === 'joint_business'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                  }`}
                >
                  {contractType === 'joint_business' && (
                    <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                      <InfinityIcon className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-sm">一緒につくる</div>
                    <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mb-1">共同事業型</div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      初期報酬＋売上分配など、事業成長の果実をパートナーと共有します。
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400">
                    法形式: 共同事業・協業合意
                  </div>
                </div>
              </div>

              {/* Counterparty summary badge */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                <span>契約相手: <strong className="text-zinc-900 dark:text-zinc-100">{individualName}</strong></span>
                <span>対象: <strong className="text-zinc-900 dark:text-zinc-100">{projectTitle}</strong></span>
              </div>

              {/* 自治体特有・別途契約手続き設定 (Requirement 25) */}
              <div className="p-3.5 bg-gradient-to-r from-purple-900/10 via-slate-900/10 to-indigo-900/10 border border-purple-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-purple-900 dark:text-purple-200">
                    <Landmark className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>自治体特有の契約・調達手続き設定</span>
                  </div>
                  {isMunicipality && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white">
                      自治体アカウント
                    </span>
                  )}
                </div>
                
                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={requiresOffplatformProcedure}
                    onChange={(e) => setRequiresOffplatformProcedure(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      別途契約手続きが必要です（自治体調達・委託契約等の特記事項を明示）
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      地方自治法や独自の調達規程・公募プロポーザル等が必要となる場合、E-hub上のProject Contractは「条件合意メモ（覚書）」扱いとし、別途オフライン・書面等での正式契約手続きが必要であることを双方に表示します。
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: 条件の設定 (役務・成果物・期間) */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">契約の条件</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  担当役割や期間、納品物を設定します。
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">契約タイトル</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="例: フロントエンド開発支援"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                    {contractType === 'completion' ? '具体的な成果物（納品内容）' : '主な役割・担当業務'}
                  </label>
                  <input
                    type="text"
                    value={contractType === 'completion' ? deliverables : role}
                    onChange={(e) => contractType === 'completion' ? setDeliverables(e.target.value) : setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={contractType === 'completion' ? '例: UIデザイン一式 (Figma) 及びReactコンポーネント' : '例: AI機能のアーキテクチャ設計および技術検証'}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                      {contractType === 'completion' ? '納品予定日' : '想定期間'}
                    </label>
                    {contractType === 'completion' ? (
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="1ヶ月">1ヶ月</option>
                        <option value="2ヶ月">2ヶ月</option>
                        <option value="3ヶ月">3ヶ月</option>
                        <option value="6ヶ月">6ヶ月</option>
                        <option value="1年間">1年間</option>
                        <option value="プロジェクト終了まで">プロジェクト終了まで</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">想定活動目安</label>
                    <input
                      type="text"
                      value={activityScale}
                      onChange={(e) => setActivityScale(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="例: 週10時間程度 / 月2回の定例参加"
                    />
                  </div>
                </div>

                {/* Advanced options accordion (NDA, 検収条件) */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium text-xs"
                  >
                    <span>詳細規約（機密保持・検収）</span>
                    {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl space-y-3 text-xs">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="nda-checkbox"
                          checked={ndaRequired}
                          onChange={(e) => setNdaRequired(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="nda-checkbox" className="font-medium text-zinc-700 dark:text-zinc-300">
                          機密保持（NDA）条項を有効にする
                        </label>
                      </div>

                      <div>
                        <label className="block font-medium mb-1 text-zinc-600 dark:text-zinc-400">検収・確認条件</label>
                        <input
                          type="text"
                          value={inspectionConditions}
                          onChange={(e) => setInspectionConditions(e.target.value)}
                          className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 報酬の設定 (金額UI & 組織5%加算・個人0%全額受取 - 項目34, 38) */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">報酬の設定</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  報酬方式と金額を設定します。個人側は手数料0%（全額受取）、発注側（法人・自治体）は成約時に5%のプラットフォーム成功報酬が適用されます。
                </p>
              </div>

              {/* Reward Type Chips */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleCompensationType('fixed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    compensationTypes.includes('fixed') && !isConsultation
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  固定報酬
                </button>
                <button
                  type="button"
                  onClick={() => toggleCompensationType('performance')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    compensationTypes.includes('performance') && !isConsultation
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  成果報酬
                </button>
                <button
                  type="button"
                  onClick={() => toggleCompensationType('revenue_share')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    compensationTypes.includes('revenue_share') && !isConsultation
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  売上分配
                </button>
                <button
                  type="button"
                  onClick={() => toggleCompensationType('negotiable')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isConsultation
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  要相談
                </button>
              </div>

              {!isConsultation ? (
                <div className="space-y-4">
                  {/* Revenue Share Specifics */}
                  {compensationTypes.includes('revenue_share') && (
                    <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 rounded-xl space-y-3 text-xs">
                      <div className="font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                        <InfinityIcon className="w-4 h-4" />
                        共同事業・売上分配設定
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-zinc-600 dark:text-zinc-400 mb-1">売上分配率（%）</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0.1"
                              max="100"
                              step="0.5"
                              value={revenueShareRate}
                              onChange={(e) => setRevenueShareRate(Number(e.target.value))}
                              className="w-full px-3 py-1.5 pr-8 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
                            />
                            <span className="absolute right-3 top-1.5 text-zinc-400">%</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-zinc-600 dark:text-zinc-400 mb-1">対象期間</label>
                          <input
                            type="text"
                            value={revenueSharePeriod}
                            onChange={(e) => setRevenueSharePeriod(e.target.value)}
                            className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Amount Input */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                      {compensationTypes.includes('revenue_share') ? '初期着手報酬（税込）' : '契約総額（税込）'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-zinc-400 font-bold">¥</span>
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        value={grossAmount}
                        onChange={(e) => setGrossAmount(Number(e.target.value))}
                        className="w-full pl-8 pr-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 font-bold text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="300000"
                      />
                    </div>
                  </div>

                  {/* Large Financial Breakdown Card (項目34, 38: 組織5%加算・個人0%全額受取) */}
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                    <div className="grid grid-cols-2 gap-4 divide-x divide-zinc-200 dark:divide-zinc-700">
                      {/* Organization view */}
                      <div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">発注側（法人・自治体）お支払い総額（+5%）</div>
                        <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-0.5">
                          ¥{organizationTotalAmount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-1">
                          契約額 ¥{grossAmount.toLocaleString()} + 成功報酬(5%) ¥{orgFeeAmount.toLocaleString()}
                        </div>
                      </div>

                      {/* Individual view */}
                      <div className="pl-4">
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">個人受取予定（手数料 0%）</div>
                        <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          ¥{individualNetAmount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                          E-hub手数料 0%（契約報酬の100%を受取）
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <div className="font-semibold mb-1">【要相談】</div>
                  Project開始後に具体的な役割分担や成果定義を詰めながら報酬を決定します。
                </div>
              )}
            </div>
          )}

          {/* STEP 4: 最終確認 (Review & Summary) */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">契約内容の確認</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  内容を確認して契約提案を送信します。双方が同意し発注側（法人・自治体）が決済を完了すると正式成立します。
                </p>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3 text-xs">
                <div className="flex justify-between pb-2 border-b border-zinc-200 dark:border-zinc-700">
                  <span className="text-zinc-500">進め方</span>
                  <span className="font-bold">
                    {contractType === 'participation' ? '一緒に進める（Project参加型）' : contractType === 'completion' ? '完成させる（成果完成型）' : '一緒につくる（共同事業型）'}
                  </span>
                </div>

                <div className="flex justify-between pb-2 border-b border-zinc-200 dark:border-zinc-700">
                  <span className="text-zinc-500">タイトル</span>
                  <span className="font-medium text-right">{title}</span>
                </div>

                <div className="flex justify-between pb-2 border-b border-zinc-200 dark:border-zinc-700">
                  <span className="text-zinc-500">{contractType === 'completion' ? '納品物' : '役割'}</span>
                  <span className="font-medium text-right">{contractType === 'completion' ? deliverables || '条件通り' : role || 'プロジェクト推進'}</span>
                </div>

                <div className="flex justify-between pb-2 border-b border-zinc-200 dark:border-zinc-700">
                  <span className="text-zinc-500">期間・期日</span>
                  <span className="font-medium">{contractType === 'completion' ? deliveryDate || '別途調整' : duration}</span>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-zinc-500 font-medium">契約金額</span>
                  <div className="text-right">
                    <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                      {isConsultation ? '要相談' : `¥${grossAmount.toLocaleString()}`}
                    </div>
                    {!isConsultation && (
                      <div className="text-[10px] text-zinc-400">
                        法人・自治体支払総額: ¥{organizationTotalAmount.toLocaleString()} (+5%) / 個人受取: ¥{individualNetAmount.toLocaleString()} (100%)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {requiresOffplatformProcedure && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>特記事項：別途契約手続きが必要です</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    本E-hub契約案はプロジェクト条件・意思の合意メモです。自治体等の規程に基づき、別途公募・議会承認・書面での本契約手続き等が必要となる場合があります。
                  </p>
                </div>
              )}

              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/40 p-3 rounded-xl flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <span>
                  ※送信後、相手方（{individualName}）に通知されます。双方が合意後、発注側（法人・自治体）決済を経てProject Chatが利用可能になります。
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as any)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              戻る
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              id="btn-project-contract-next-step"
              onClick={() => setStep((step + 1) as any)}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
            >
              次へ
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              id="btn-project-contract-submit"
              onClick={handleCreateContract}
              disabled={submitting}
              className="px-6 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-2 transition-all"
            >
              {submitting ? '提案送信中...' : '契約案を送信する'}
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
