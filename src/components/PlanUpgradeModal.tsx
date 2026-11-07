import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Info, 
  HelpCircle,
  ExternalLink,
  Crown,
  Building,
  Landmark,
  FileText,
  CreditCard,
  Receipt,
  Calendar,
  Download,
  Printer,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { TransactionFeeModal } from './TransactionFeeModal';
import { InvoiceQuoteViewerModal, QuoteData } from './InvoiceQuoteViewerModal';

interface PlanItem {
  id: string;
  name: string;
  price: string;
  period?: string;
  description: string;
  targets?: string[];
  features: string[];
  recommended?: boolean;
  isQuote?: boolean;
}

interface PlanUpgradeModalProps {
  onClose: () => void;
  defaultTab?: 'individual' | 'corporate' | 'municipality' | 'organization';
  noticeMessage?: string;
}

export default function PlanUpgradeModal({ onClose, defaultTab, noticeMessage }: PlanUpgradeModalProps) {
  const { language, user, updateUser } = useAppContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isGovUser = user?.account_type === 'municipality';
  const isCorpUser = user?.account_type === 'corporate' || user?.account_type === 'organization';

  const getInitialTab = (): 'individual' | 'corporate' | 'municipality' => {
    if (defaultTab === 'municipality' || defaultTab === 'corporate' || defaultTab === 'individual') {
      return defaultTab;
    }
    if (defaultTab === 'organization') {
      return isGovUser ? 'municipality' : 'corporate';
    }
    if (isGovUser) return 'municipality';
    if (isCorpUser) return 'corporate';
    return 'individual';
  };

  const [selectedTab, setSelectedTab] = useState<'individual' | 'corporate' | 'municipality'>(getInitialTab());
  
  // 契約サイクル・支払い方法（自治体・法人向け）
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'invoice' | 'quote'>('invoice');

  // 見積書・請求書ビューア
  const [activeViewerData, setActiveViewerData] = useState<QuoteData | null>(null);

  // 料金カードの機能一覧の展開状態 (5〜6個以上を折りたたみ)
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});
  const toggleExpandPlan = (planKey: string) => {
    setExpandedPlans(prev => ({
      ...prev,
      [planKey]: !prev[planKey]
    }));
  };

  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    orgName: (user as any)?.company_name || (user as any)?.name || user?.username || '',
    department: '',
    contactName: (user as any)?.name || user?.username || '',
    email: (user as any)?.email || '',
    phone: '',
    message: ''
  });

  const [pricingConfig, setPricingConfig] = useState<any>({
    freeAiVisionMonthlyLimit: 5,
    proMonthlyFee: 980,
    orgLightMonthlyFee: 3000,
    orgStandardMonthlyFee: 9800,
    orgEnterpriseMonthlyFee: 29800,
    govBasicMonthlyFee: 0,
    govStandardMonthlyFee: 19800,
    govEnterpriseMonthlyFee: 'custom',
    projectOrgFeeRate: 0.05,
    projectIndFeeRate: 0.00,
    storeFeeRate: 0.10,
    buyoutFeeRate: 0.05
  });

  useEffect(() => {
    fetch('/api/platform/pricing-config')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setPricingConfig(data);
      })
      .catch(() => {});
  }, []);

  const currentPlan = (() => {
    if (selectedTab === 'municipality') {
      return user?.account_type === 'municipality' ? (user?.org_plan || 'basic') : '';
    }
    if (selectedTab === 'corporate') {
      return isCorpUser ? (user?.org_plan || 'light') : '';
    }
    return user?.plan || 'free';
  })();

  const [openedCheckoutUrl, setOpenedCheckoutUrl] = useState<string | null>(null);
  const [activeTargetPlan, setActiveTargetPlan] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // 見積書の即時プレビュー・発行
  const handleGenerateQuote = async (targetPlan: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/billing/invoices/generate-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id?.toString() || ''
        },
        body: JSON.stringify({
          target_plan: targetPlan,
          billing_cycle: billingCycle,
          account_type: selectedTab,
          org_name: quoteForm.orgName || (user as any)?.company_name || (selectedTab === 'municipality' ? '〇〇市役所' : '〇〇株式会社'),
          department: quoteForm.department || (selectedTab === 'municipality' ? '企画創生課 / 官民連携推進室' : '事業開発部'),
          contact_name: quoteForm.contactName || user?.username || 'ご担当者様'
        })
      });

      const data = await res.json();
      if (res.ok && data.quoteNumber) {
        setActiveViewerData({ ...data, documentType: 'quote' });
      } else {
        throw new Error(data.error || '見積書の生成に失敗しました');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || '見積書の生成エラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 請求書払い（翌月末銀行振込・公金支出・年間契約）での申請・即時適用
  const handleInvoiceApply = async (targetPlan: string) => {
    if (!user) {
      alert(language === 'ja' ? 'ログインまたはアカウント作成が必要です。' : 'Please sign in or create an account.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/contracts/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({
          target_plan: targetPlan,
          billing_cycle: billingCycle,
          payment_method: 'invoice',
          request_type: billingCycle === 'yearly' ? 'annual_contract' : 'invoice_payment',
          org_name: quoteForm.orgName || (user as any)?.company_name || (selectedTab === 'municipality' ? '〇〇市役所' : '〇〇株式会社'),
          department: quoteForm.department || (selectedTab === 'municipality' ? '企画創生課' : '総務部'),
          contact_name: quoteForm.contactName || user.username,
          email: quoteForm.email || (user as any)?.email || '',
          phone: quoteForm.phone,
          custom_notes: '請求書払い（公金・翌月末銀行振込）でのお申し込み'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const updatedUser = data.user ? { ...user, ...data.user } : {
          ...user,
          plan: targetPlan,
          org_plan: targetPlan
        };
        updateUser(updatedUser);
        setSuccessToast(data.message || (language === 'ja' ? '請求書払いでのお申し込みが完了しました！' : 'Application submitted successfully!'));
        
        // 見積書・請求書ビューアも用意
        handleGenerateQuote(targetPlan);
      } else {
        throw new Error(data.error || '請求書払いのお申し込みに失敗しました');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'お申し込み処理中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-Click Instant Upgrade (デモ・テスト・即時有効化用)
  const handleDirectUpgrade = async (targetPlan: string) => {
    if (!user) {
      alert(language === 'ja' ? 'ログインまたはアカウント作成が必要です。' : 'Please sign in or create an account.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${user.id}/update-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({
          plan: targetPlan,
          billing_cycle: billingCycle,
          payment_method: paymentMethod,
          user_id: user.id
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const updatedUser = data.user ? { ...user, ...data.user } : { 
          ...user, 
          plan: targetPlan, 
          org_plan: ['light', 'standard', 'enterprise', 'basic'].includes(targetPlan) ? targetPlan : (user.org_plan || 'basic')
        };
        updateUser(updatedUser);
        setSuccessToast(language === 'ja' ? `プランを「${targetPlan.toUpperCase()}」に更新しました！` : `Plan updated to ${targetPlan.toUpperCase()}!`);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        throw new Error(data.error || 'プラン更新に失敗しました');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'プラン更新エラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle plan purchase via Stripe Checkout / Subscription API
  const handleUpgrade = async (targetPlan: string, isQuote?: boolean) => {
    if (isQuote) {
      setShowQuoteModal(true);
      return;
    }

    if (paymentMethod === 'quote') {
      handleGenerateQuote(targetPlan);
      return;
    }

    if (paymentMethod === 'invoice') {
      handleInvoiceApply(targetPlan);
      return;
    }

    if (!user) {
      alert(language === 'ja' ? 'ログインまたはアカウント作成が必要です。' : 'Please sign in or create an account.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/stripe/create-subscription-checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({
          target_plan: targetPlan,
          billing_cycle: billingCycle,
          return_path: window.location.pathname
        })
      });

      const data = await res.json();

      if (data.url) {
        // AI Studio iframeの制約を避けるため、別タブ・別ウィンドウでStripe Checkoutを開く
        setActiveTargetPlan(targetPlan);
        setOpenedCheckoutUrl(data.url);
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else if (data.mock && data.success) {
        // Test Mode immediate update
        const updatedUser = { 
          ...user, 
          plan: targetPlan, 
          org_plan: ['light', 'standard', 'enterprise', 'basic'].includes(targetPlan) ? targetPlan : user.org_plan 
        };
        updateUser(updatedUser);
        setSuccessToast(data.message || (language === 'ja' ? 'プランが更新されました！' : 'Plan updated!'));
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        throw new Error(data.error || 'Failed to initiate checkout');
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || '決済の開始に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Customer Portal for Subscription Management & Cancellation
  const handleManageSubscription = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        }
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else if (data.mock && data.success) {
        updateUser({ ...user, plan: 'free', org_plan: 'free' });
        alert(data.message);
        onClose();
      }
    } catch (e: any) {
      alert(e.message || 'ポータルの起動に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 年間契約割引計算ヘルパー
  const getDisplayPrice = (monthlyFee: number) => {
    if (monthlyFee === 0) return '¥0';
    if (billingCycle === 'yearly') {
      const discountedYearly = Math.round(monthlyFee * 12 * 0.9);
      return `¥${discountedYearly.toLocaleString()}`;
    }
    return `¥${monthlyFee.toLocaleString()}`;
  };

  const getDisplayPeriod = (monthlyFee: number) => {
    if (monthlyFee === 0) return '';
    if (billingCycle === 'yearly') {
      return language === 'ja' ? '/ 年 (10%OFF)' : '/ year (10% OFF)';
    }
    return language === 'ja' ? '/ 月' : '/ month';
  };

  const individualPlans: PlanItem[] = [
    {
      id: 'free',
      name: language === 'ja' ? 'Free' : 'Free',
      price: '¥0',
      description: language === 'ja' ? 'すべての基本機能を利用できる個人向けプラン' : 'Free forever for individuals & creators',
      features: [
        language === 'ja' ? 'Vision投稿・閲覧・共創' : 'Vision Posting & Co-creation',
        language === 'ja' ? 'Idea投稿・引用・発展' : 'Idea Posting & Forking',
        language === 'ja' ? 'Project契約への応募・参加（成功報酬0%）' : 'Apply to Projects (0% Fee)',
        language === 'ja' ? '人とつながる・Chat・Project Chat' : 'Connect, Direct & Project Chat',
        language === 'ja' ? `AI Vision作成（月${pricingConfig.freeAiVisionMonthlyLimit}回まで）` : `AI Vision Builder (${pricingConfig.freeAiVisionMonthlyLimit}/mo)`,
        language === 'ja' ? '成果物販売（Store 10%手数料）' : 'Sell digital assets (10% Fee)',
        language === 'ja' ? 'Buyout売買（5%手数料）' : 'Buyout Transactions (5% Fee)',
        language === 'ja' ? 'ポートフォリオ・実績公開' : 'Portfolio & Work History'
      ]
    },
    {
      id: 'pro',
      name: language === 'ja' ? 'Pro' : 'Pro Plan',
      price: getDisplayPrice(pricingConfig.proMonthlyFee),
      period: getDisplayPeriod(pricingConfig.proMonthlyFee),
      description: language === 'ja' ? 'AIによって創造・分析・発展を加速するプラン' : 'Accelerate creation and analysis with AI superpowers',
      features: [
        language === 'ja' ? 'Freeの全機能' : 'All Free Features',
        language === 'ja' ? 'AI Vision作成（拡張・無制限）' : 'AI Vision Builder (Unlimited)',
        language === 'ja' ? 'AI画像生成（無制限）' : 'AI Image Generation (Unlimited)',
        language === 'ja' ? 'AIによる市場・競合分析' : 'AI Market & Competitor Analysis',
        language === 'ja' ? 'AIプロジェクト設計・提案書作成' : 'AI Project & Proposal Generator',
        language === 'ja' ? '非公開Visionの作成・管理' : 'Private Vision Creation & Management',
        language === 'ja' ? 'NDAプロジェクト参加' : 'NDA Project Access',
        language === 'ja' ? '詳細アクセス分析・優先表示' : 'Deep Analytics & Priority Exposure'
      ],
      recommended: true
    }
  ];

  const corpPlans: PlanItem[] = [
    {
      id: 'light',
      name: language === 'ja' ? '法人 Light' : 'Corp Light',
      price: getDisplayPrice(pricingConfig.orgLightMonthlyFee),
      period: getDisplayPeriod(pricingConfig.orgLightMonthlyFee),
      description: language === 'ja' ? '小規模企業が法人Projectを運営する基本プラン' : 'Basic plan for corporate projects',
      features: [
        language === 'ja' ? '公開Projectの作成・運営' : 'Public Project Creation & Ops',
        language === 'ja' ? '応募者の閲覧・管理' : 'Applicant Review & Management',
        language === 'ja' ? 'Project契約の締結（5%成功報酬）' : 'Project Contracts (5% Platform Fee)',
        language === 'ja' ? 'AIによる課題改善・募集文作成' : 'AI Issue & Requirement Refinement',
        language === 'ja' ? 'AI応募者要約' : 'AI Applicant Summarization',
        language === 'ja' ? '基本ダッシュボード' : 'Basic Project Dashboard'
      ]
    },
    {
      id: 'standard',
      name: language === 'ja' ? '法人 Standard' : 'Corp Standard',
      price: getDisplayPrice(pricingConfig.orgStandardMonthlyFee),
      period: getDisplayPeriod(pricingConfig.orgStandardMonthlyFee),
      description: language === 'ja' ? '成長企業向け。非公開Project・AI候補者推薦・チーム編成・スカウト' : 'For growing companies with private projects & AI talent search',
      features: [
        language === 'ja' ? 'Light機能すべて' : 'All Light Features',
        language === 'ja' ? '非公開Project & NDA Project' : 'Private & NDA Projects',
        language === 'ja' ? '指名スカウト機能' : 'Direct Scout Messaging',
        language === 'ja' ? 'AI候補者推薦・自動マッチング' : 'AI Candidate Recommendation',
        language === 'ja' ? 'AIチーム編成支援' : 'AI Team Assembly',
        language === 'ja' ? 'AIプロジェクト管理・成果分析' : 'AI Project Management & Analytics',
        language === 'ja' ? 'AI画像生成（無制限）' : 'AI Image Generation (Unlimited)',
        language === 'ja' ? '担当者アカウント追加' : 'Multiple Team Members'
      ],
      recommended: true
    },
    {
      id: 'enterprise',
      name: language === 'ja' ? '法人 Enterprise' : 'Corp Enterprise',
      price: getDisplayPrice(pricingConfig.orgEnterpriseMonthlyFee),
      period: getDisplayPeriod(pricingConfig.orgEnterpriseMonthlyFee),
      description: language === 'ja' ? '大規模組織向け。高度AI、SSO、API、権限管理、監査、CS' : 'Comprehensive suite for large organizations with SSO & API',
      features: [
        language === 'ja' ? 'Standard機能すべて' : 'All Standard Features',
        language === 'ja' ? 'AI専用モデル' : 'Dedicated AI Models',
        language === 'ja' ? 'API連携 & SSO（シングルサインオン）' : 'API & SSO Integration',
        language === 'ja' ? 'ロール別権限管理・監査ログ' : 'Role-based Access & Audit Logs',
        language === 'ja' ? '契約書カスタマイズ & 知財監査' : 'Custom Contracts & IP Audit',
        language === 'ja' ? '専任カスタマーサクセス & SLA保証' : 'Dedicated CS & SLA Guarantee'
      ]
    }
  ];

  const govPlans: PlanItem[] = [
    {
      id: 'basic',
      name: language === 'ja' ? 'Basic' : 'Basic',
      price: '¥0',
      period: '',
      description: language === 'ja' ? 'まず地域課題を公開' : 'Publish regional challenges & co-create',
      features: [
        language === 'ja' ? '地域課題の公開・Idea募集' : 'Publish regional challenges',
        language === 'ja' ? '市民・法人からのアイデア受付' : 'Receive ideas from citizens & corps',
        language === 'ja' ? 'Vision投稿・閲覧' : 'Vision posting & browsing',
        language === 'ja' ? '基本Chat・Project管理' : 'Basic Chat & Project Ops'
      ]
    },
    {
      id: 'standard',
      name: language === 'ja' ? 'Standard' : 'Standard',
      price: getDisplayPrice(pricingConfig.govStandardMonthlyFee ?? 19800),
      period: getDisplayPeriod(pricingConfig.govStandardMonthlyFee ?? 19800),
      description: language === 'ja' ? '地域のProjectを本格運営' : 'Full-scale operation of regional projects',
      features: [
        language === 'ja' ? 'Basicのすべて' : 'All Basic features',
        language === 'ja' ? '非公開・限定公開Project' : 'Private & restricted projects',
        language === 'ja' ? 'AIによるIdea整理・分類' : 'AI Idea organizing & sorting',
        language === 'ja' ? 'AI候補者・法人パートナー推薦' : 'AI Candidate & Partner match',
        language === 'ja' ? '担当者追加・複数部署管理' : 'Team members & multi-department',
        language === 'ja' ? 'NDA機能・レポート出力' : 'NDA agreements & reports'
      ],
      recommended: true
    },
    {
      id: 'enterprise',
      name: language === 'ja' ? 'Enterprise' : 'Enterprise',
      price: language === 'ja' ? 'お問い合わせ' : 'Contact Us',
      period: '',
      description: language === 'ja' ? '組織全体で共創' : 'Organization-wide co-creation',
      features: [
        language === 'ja' ? 'Standardのすべて' : 'All Standard features',
        language === 'ja' ? 'SSO・API連携' : 'SSO & API integrations',
        language === 'ja' ? '全庁・大規模組織利用' : 'Gov-wide & large org deployment',
        language === 'ja' ? '監査ログ・高度権限管理' : 'Audit logs & role access',
        language === 'ja' ? '専任サポート・契約書カスタマイズ' : 'Dedicated support & custom contracts'
      ],
      isQuote: true
    }
  ];

  const plans: PlanItem[] = selectedTab === 'municipality' ? govPlans : (selectedTab === 'corporate' ? corpPlans : individualPlans);

  return (
    <>
      <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/60 backdrop-blur-md" onClick={onClose}>
        <div className="min-h-screen px-4 py-8 flex items-start justify-center">
          <div 
            className="bg-white dark:bg-[#18191c] text-slate-900 dark:text-white w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl relative border border-slate-200 dark:border-slate-800 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors z-20"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Notice Message Banner if present */}
            {noticeMessage && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 text-sm font-medium flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  <span>{noticeMessage}</span>
                </div>
              </div>
            )}

            {/* Success Toast */}
            {successToast && (
              <div className="bg-emerald-600 text-white px-6 py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <span>{successToast}</span>
              </div>
            )}

            {/* Stripe Checkout Opened in New Tab Info Banner */}
            {openedCheckoutUrl && (
              <div className="m-6 p-4 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />
                      <span>{language === 'ja' ? 'Stripe決済画面を別タブで開きました' : 'Stripe Checkout opened in a new tab'}</span>
                    </div>
                    <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80">
                      {language === 'ja' 
                        ? '別タブでの決済完了後、自動的に反映されます。ポップアップがブロックされた場合は再オープンしてください。' 
                        : 'Your plan will be updated automatically after checkout. Re-open if blocked.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <a
                      href={openedCheckoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{language === 'ja' ? '決済タブを開く' : 'Open Checkout Tab'}</span>
                    </a>
                    {activeTargetPlan && (
                      <button
                        onClick={() => handleDirectUpgrade(activeTargetPlan)}
                        disabled={isSubmitting}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{language === 'ja' ? '即時有効化（テスト）' : 'Instant Activate (Test)'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="p-6 md:p-10 pb-6 text-center border-b border-slate-200 dark:border-slate-800">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-cyan-400 text-xs font-bold mb-3 border border-blue-200/50 dark:border-blue-700/50">
                <Crown className="w-3.5 h-3.5" />
                <span>{language === 'ja' ? 'E-hub プラン・料金' : 'E-hub Plans & Pricing'}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
                {language === 'ja' ? '目的に合わせた柔軟なプラン・契約' : 'Flexible Plans for Everyone'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto mb-6">
                {language === 'ja' 
                  ? '個人クリエイターから成長企業、地域課題を解決する自治体まで最適なプランをお選びいただけます。' 
                  : 'Tailored pricing for creators, growing businesses, and municipal co-creators.'}
              </p>

              {/* Tabs */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 max-w-full overflow-x-auto shadow-inner">
                  <button
                    id="pricing-tab-individual"
                    onClick={() => setSelectedTab('individual')}
                    className={`px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                      selectedTab === 'individual'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-cyan-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {language === 'ja' ? '個人' : 'Individual'}
                  </button>
                  <button
                    id="pricing-tab-corporate"
                    onClick={() => setSelectedTab('corporate')}
                    className={`px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                      selectedTab === 'corporate'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-cyan-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {language === 'ja' ? '法人' : 'Corporate'}
                  </button>
                  <button
                    id="pricing-tab-municipality"
                    onClick={() => setSelectedTab('municipality')}
                    className={`px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                      selectedTab === 'municipality'
                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {language === 'ja' ? '自治体' : 'Municipality'}
                  </button>
                </div>
              </div>

              {/* 契約期間 & 支払い方法セレクター（自治体・法人タブ時） */}
              {(selectedTab === 'municipality' || selectedTab === 'corporate') && (
                <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 text-left pt-2 pb-2">
                  {/* 1. 契約期間 */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>{language === 'ja' ? '契約サイクル' : 'Contract Term'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBillingCycle('monthly')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                          billingCycle === 'monthly'
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div>{language === 'ja' ? '月額契約' : 'Monthly'}</div>
                        <div className="text-[10px] text-slate-500">{language === 'ja' ? '月々のお支払い' : 'Billed monthly'}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBillingCycle('yearly')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all relative ${
                          billingCycle === 'yearly'
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-bold shadow">
                          {language === 'ja' ? '10% OFF' : '10% OFF'}
                        </span>
                        <div>{language === 'ja' ? '年間契約' : 'Annual'}</div>
                        <div className="text-[10px] text-slate-500">{language === 'ja' ? '年度一括・公金対応' : 'Gov fiscal year'}</div>
                      </button>
                    </div>
                  </div>

                  {/* 2. お支払い・契約方法 */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>{language === 'ja' ? 'お支払い・書類発行方法' : 'Payment & Documents'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('invoice')}
                        className={`p-2 rounded-xl border text-[11px] font-semibold text-center transition-all flex flex-col items-center justify-center gap-1 ${
                          paymentMethod === 'invoice'
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{language === 'ja' ? '請求書払い' : 'Invoice'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('quote')}
                        className={`p-2 rounded-xl border text-[11px] font-semibold text-center transition-all flex flex-col items-center justify-center gap-1 ${
                          paymentMethod === 'quote'
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{language === 'ja' ? '見積書発行' : 'Quote'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('credit_card')}
                        className={`p-2 rounded-xl border text-[11px] font-semibold text-center transition-all flex flex-col items-center justify-center gap-1 ${
                          paymentMethod === 'credit_card'
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{language === 'ja' ? 'カード決済' : 'Card'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Municipality Pricing Policy Banner */}
              {selectedTab === 'municipality' && (
                <div className="mt-4 max-w-3xl mx-auto p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-left">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 shrink-0 mt-0.5">
                      <Building className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white">
                          {language === 'ja' ? '自治体向け料金の考え方' : 'Municipality Pricing Policy'}
                        </span>
                        <span className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                          {language === 'ja' ? 'E-hubの地域課題・共創プラットフォームとしての普及を最優先' : 'Prioritizing Regional Revitalization & Open Co-creation'}
                        </span>
                      </div>
                      <p className="text-xs text-purple-950/80 dark:text-purple-300/90 leading-relaxed">
                        {language === 'ja' ? (
                          <>
                            「Project投稿のための必須課金」はありません。自治体がまずE-hubを使って地域課題を公開できるよう、<strong className="text-purple-900 dark:text-purple-100 font-bold">参加・Vision投稿・地域課題の公開・Idea募集・市民/法人からのIdea受付はすべて無料（¥0）</strong>で開始できます。<br />
                            高度な管理・AI・セキュリティ・複数部署・高度分析は、<strong className="text-purple-900 dark:text-purple-100 font-bold">年間契約・月額契約・請求書払い・銀行振込・見積書発行</strong>に対応した有料プラン（Standard / Enterprise）としてご利用いただけます。
                          </>
                        ) : (
                          'No mandatory fees to publish projects. Municipalities can freely publish regional challenges, collect ideas from citizens and companies at ¥0. Advanced features are available via annual/monthly contracts, invoices, and bank transfer.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Plans Grid */}
            <div className="p-6 md:p-10 bg-slate-50/50 dark:bg-[#18191c]">
              <div className={`grid grid-cols-1 ${plans.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'md:grid-cols-3'} gap-6`}>
                {plans.map(plan => {
                  const isCurrent = currentPlan === plan.id;
                  
                  return (
                    <div 
                      key={plan.id}
                      className={`flex flex-col p-6 md:p-8 rounded-2xl border-2 transition-all duration-300 relative shadow-sm ${
                        isCurrent 
                          ? 'border-slate-300 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-800/30' 
                          : plan.recommended 
                            ? (selectedTab === 'municipality' ? 'border-purple-500 bg-purple-50/40 dark:bg-purple-500/10 ring-2 ring-purple-500/30 shadow-lg' : 'border-blue-500 bg-blue-50/60 dark:bg-blue-500/10 ring-2 ring-blue-500/30 shadow-lg')
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60'
                      }`}
                    >
                      {plan.recommended && (
                        <div className={`absolute -top-3.5 right-6 text-white px-3.5 py-1 rounded-full text-xs font-bold tracking-wider shadow-md flex items-center gap-1 ${
                          selectedTab === 'municipality' ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                        }`}>
                          <Sparkles className="w-3 h-3 text-cyan-300" />
                          <span>{language === 'ja' ? 'おすすめ' : 'Recommended'}</span>
                        </div>
                      )}

                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 min-h-[40px] mb-4 leading-relaxed">
                        {plan.description}
                      </p>

                      {plan.targets && plan.targets.length > 0 && (
                        <div className="mb-5 p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                          <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300 mb-1.5 flex items-center gap-1">
                            <span>{language === 'ja' ? '【主な対象】' : 'Target:'}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {plan.targets.map((t, idx) => (
                              <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border border-purple-200/60 dark:border-purple-800/50">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-baseline gap-1 mb-6">
                        <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">{plan.price}</span>
                        {plan.price !== '¥0' && plan.period && <span className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm">{plan.period}</span>}
                      </div>

                      <div className="mb-6 mt-auto">
                        {isCurrent ? (
                          <div className="space-y-2">
                            <button 
                              disabled
                              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-default flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span>{language === 'ja' ? 'ご利用中のプラン' : 'Current Plan'}</span>
                            </button>
                            {plan.id !== 'free' && plan.id !== 'basic' && (
                              <button
                                onClick={handleManageSubscription}
                                disabled={isSubmitting}
                                className="w-full text-center text-xs text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 py-1 transition-colors flex items-center justify-center gap-1"
                              >
                                <span>{language === 'ja' ? 'プランの管理・解約手続き' : 'Manage Subscription / Cancel'}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <button 
                              onClick={() => handleUpgrade(plan.id, plan.isQuote)}
                              disabled={isSubmitting}
                              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                                (plan as any).isQuote
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
                                  : plan.recommended 
                                    ? (selectedTab === 'municipality' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/20' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/20')
                                    : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900'
                              }`}
                            >
                              {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (plan as any).isQuote ? (
                                <>
                                  <span>{language === 'ja' ? '個別見積・ご相談' : 'Request Quote & Inquire'}</span>
                                  <ArrowRight className="w-4 h-4" />
                                </>
                              ) : paymentMethod === 'quote' && plan.price !== '¥0' ? (
                                <>
                                  <FileText className="w-4 h-4" />
                                  <span>{language === 'ja' ? '見積書を即時発行' : 'Generate Quote'}</span>
                                </>
                              ) : paymentMethod === 'invoice' && plan.price !== '¥0' ? (
                                <>
                                  <Receipt className="w-4 h-4" />
                                  <span>{language === 'ja' ? '請求書払いで申し込む' : 'Apply with Invoice'}</span>
                                </>
                              ) : (
                                <>
                                  <span>{language === 'ja' ? `${plan.name}で始める` : `Get Started with ${plan.name}`}</span>
                                  <ArrowRight className="w-4 h-4" />
                                </>
                              )}
                            </button>

                            {/* 見積書即時発行のクイックリンク（有料プラン時） */}
                            {plan.id !== 'free' && plan.id !== 'basic' && !(plan as any).isQuote && paymentMethod !== 'quote' && (
                              <button
                                onClick={() => handleGenerateQuote(plan.id)}
                                disabled={isSubmitting}
                                className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-dashed border-purple-300 dark:border-purple-800/60 transition-colors flex items-center justify-center gap-1"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>{language === 'ja' ? '稟議用 見積書プレビュー' : 'Preview Official Quote'}</span>
                              </button>
                            )}

                            {plan.id !== 'free' && !(plan as any).isQuote && (
                              <button
                                onClick={() => handleDirectUpgrade(plan.id)}
                                disabled={isSubmitting}
                                className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/60 dark:border-emerald-800/40 transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Sparkles className="w-3 h-3 text-emerald-500" />
                                <span>{language === 'ja' ? 'テスト・即時有効化（カード不要）' : 'Instant Activate (No Card)'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Feature List (5〜6個程度を表示し、それ以上は展開) */}
                      {(() => {
                        const MAX_VISIBLE = 5;
                        const planKey = `${selectedTab}-${plan.id}`;
                        const isExpanded = !!expandedPlans[planKey];
                        const hasMore = plan.features.length > MAX_VISIBLE;
                        const visibleFeatures = isExpanded ? plan.features : plan.features.slice(0, MAX_VISIBLE);

                        return (
                          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="space-y-2.5">
                              {visibleFeatures.map((feature, i) => (
                                <div key={i} className="flex items-start gap-2.5">
                                  <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${selectedTab === 'municipality' ? 'text-purple-500 dark:text-purple-400' : 'text-blue-500 dark:text-cyan-400'}`} />
                                  <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-snug">{feature}</span>
                                </div>
                              ))}
                            </div>

                            {hasMore && (
                              <button
                                type="button"
                                id={`btn-expand-features-${planKey}`}
                                onClick={() => toggleExpandPlan(planKey)}
                                className={`w-full pt-2 pb-1 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                                  selectedTab === 'municipality'
                                    ? 'text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300'
                                    : 'text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300'
                                }`}
                              >
                                <span>
                                  {isExpanded
                                    ? (language === 'ja' ? '主要機能のみ表示' : 'Show less')
                                    : (language === 'ja' ? `すべての機能を見る (${plan.features.length})` : `See all features (${plan.features.length})`)}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Transaction Fees Banner & Modal Trigger (項目34, 35) */}
              <div className="mt-8 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{language === 'ja' ? '取引手数料について' : 'Transaction Fees'}</span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                        {language === 'ja' ? '個人契約 0%' : 'Ind. Contract 0%'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'ja' 
                        ? 'Project契約・Store販売・Buyout成立時の明確な手数料率をご確認いただけます。' 
                        : 'Review our simple fee schedule for Contracts, Store sales, and Buyouts.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowFeeModal(true)}
                  className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-cyan-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200/50 dark:border-blue-700/50 transition-colors flex items-center gap-1.5"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>{language === 'ja' ? '手数料詳細を見る' : 'View Fee Details'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Fee Detail Modal (項目34) */}
      <TransactionFeeModal 
        isOpen={showFeeModal} 
        onClose={() => setShowFeeModal(false)} 
      />

      {/* 見積書・請求書ビューアモーダル */}
      {activeViewerData && (
        <InvoiceQuoteViewerModal
          data={activeViewerData}
          onClose={() => setActiveViewerData(null)}
        />
      )}

      {/* Municipality / Enterprise Quote Modal */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowQuoteModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {language === 'ja' ? '自治体 Enterprise プラン個別見積・相談' : 'Municipality Enterprise Quote & Consultation'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'ja' ? '全庁利用・専用環境・セキュリティ設定・契約書カスタマイズ等のご相談' : 'Inquire about gov-wide rollout, dedicated environment, security & agreements'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowQuoteModal(false)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {quoteSent ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  {language === 'ja' ? 'お問い合わせを送信しました' : 'Inquiry Submitted'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {language === 'ja' ? '担当コンサルタントより1営業日以内にご案内・お見積りを送付いたします。' : 'Our team will contact you within 1 business day.'}
                </p>
                <button
                  onClick={() => {
                    setShowQuoteModal(false);
                    setQuoteSent(false);
                  }}
                  className="mt-4 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl"
                >
                  {language === 'ja' ? '閉じる' : 'Close'}
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setQuoteSent(true);
                }}
                className="space-y-3.5"
              >
                <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 text-[11px] text-purple-900 dark:text-purple-300 leading-relaxed">
                  {language === 'ja' 
                    ? '※ 全庁・複数部署での運用、SSO/API連携、高度なセキュリティ設定、将来的なLGWAN等の閉域網要件への拡張対応についてご相談いただけます。' 
                    : '* Tailored for gov-wide deployment, SSO/API, dedicated security, and future extensible network requirements.'}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'ja' ? '自治体名 / 部署名' : 'Municipality / Department'}
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteForm.orgName}
                    onChange={e => setQuoteForm({ ...quoteForm, orgName: e.target.value })}
                    placeholder={language === 'ja' ? '例: ○○市役所 企画創生課' : 'e.g., Shibuya City Planning Div'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'ja' ? 'ご担当者様氏名' : 'Contact Person'}
                    </label>
                    <input
                      type="text"
                      required
                      value={quoteForm.contactName}
                      onChange={e => setQuoteForm({ ...quoteForm, contactName: e.target.value })}
                      placeholder={language === 'ja' ? '山田 太郎' : 'Taro Yamada'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'ja' ? 'ご連絡先メール' : 'Email'}
                    </label>
                    <input
                      type="email"
                      required
                      value={quoteForm.email}
                      onChange={e => setQuoteForm({ ...quoteForm, email: e.target.value })}
                      placeholder="info@city.example.jp"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'ja' ? 'ご要望・検討内容（任意）' : 'Message / Requirements (Optional)'}
                  </label>
                  <textarea
                    rows={3}
                    value={quoteForm.message}
                    onChange={e => setQuoteForm({ ...quoteForm, message: e.target.value })}
                    placeholder={language === 'ja' ? '例: 全庁でのアカウント導入、SSO連携、契約書カスタマイズ、セキュリティ要件（将来的なLGWAN拡張相談含む）など' : 'Details regarding gov-wide rollout, multi-department use, SSO, custom contracts, security, etc.'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQuoteModal(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {language === 'ja' ? 'キャンセル' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20"
                  >
                    {language === 'ja' ? '見積・相談を送信' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
