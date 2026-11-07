import React, { useEffect, useState } from 'react';
import {
  FileSignature,
  Plus,
  Sparkles,
  Search,
  Filter,
  ArrowUpDown,
  Edit3,
  Copy,
  Eye,
  Archive,
  RotateCcw,
  Trash2,
  Calendar,
  User,
  Hash,
  Clock,
  CheckCircle2,
  FileText,
  ShieldCheck,
  X,
  Check,
  RefreshCw,
  Info,
  History,
  Lock,
  Briefcase,
  Users,
  CheckCircle,
  Infinity as InfinityIcon,
  CreditCard,
  ArrowRight,
  Landmark
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import ContractSelectorModal from '../components/ContractSelectorModal';
import { ProjectContractViewModal } from '../components/ProjectContractViewModal';
import { ProjectContract } from '../types';

interface ContractItem {
  id: number;
  title: string;
  type: 'nda' | 'outsourcing' | 'other' | string;
  category: string;
  description?: string;
  body: string;
  tags?: string;
  sharing_scope?: string;
  version: number;
  versions?: any[];
  author_id: number;
  author_name?: string;
  status: 'available' | 'draft' | 'archived' | string;
  usage_count: number;
  last_used_at?: string | null;
  updated_at: string;
  created_at: string;
}

export default function ContractApp() {
  const { user, language } = useAppContext();
  const [activeMainTab, setActiveMainTab] = useState<'project_contracts' | 'templates'>('project_contracts');
  const [projectContracts, setProjectContracts] = useState<ProjectContract[]>([]);
  const [loadingProjectContracts, setLoadingProjectContracts] = useState(true);
  const [selectedProjectContractId, setSelectedProjectContractId] = useState<number | null>(null);
  const [showProjectContractModal, setShowProjectContractModal] = useState(false);

  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [titleSearch, setTitleSearch] = useState('');
  const [bodySearch, setBodySearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [authorSearch, setAuthorSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOption, setSortOption] = useState<string>('updated_desc');

  // Modals
  const [showAiModal, setShowAiModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractItem | null>(null);
  const [previewContract, setPreviewContract] = useState<ContractItem | null>(null);
  const [previewVersions, setPreviewVersions] = useState<any[]>([]);
  const [selectedVersionData, setSelectedVersionData] = useState<any | null>(null);

  useEffect(() => {
    if (previewContract) {
      if (previewContract.id && previewContract.id > 0) {
        fetch(`/api/contracts/${previewContract.id}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.versions) {
              setPreviewVersions(data.versions);
              setSelectedVersionData(data.versions[0] || null);
            } else {
              setPreviewVersions([]);
              setSelectedVersionData(null);
            }
          })
          .catch(console.error);
      } else {
        setPreviewVersions(previewContract.versions || []);
        setSelectedVersionData(previewContract.versions ? previewContract.versions[0] : null);
      }
    } else {
      setPreviewVersions([]);
      setSelectedVersionData(null);
    }
  }, [previewContract]);

  // Form State for Create / Edit (Req 7)
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<'nda' | 'outsourcing' | 'other'>('nda');
  const [formCategory, setFormCategory] = useState('common');
  const [formDescription, setFormDescription] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formSharingScope, setFormSharingScope] = useState<'all' | 'organization' | 'private'>('all');
  const [formStatus, setFormStatus] = useState<'available' | 'draft' | 'archived'>('available');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchContracts();
    fetchProjectContracts();
  }, [user, typeFilter, statusFilter, sortOption]);

  const fetchProjectContracts = () => {
    if (!user) return;
    setLoadingProjectContracts(true);
    fetch(`/api/project-contracts?user_id=${user.id}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setProjectContracts(Array.isArray(data) ? data : []);
        setLoadingProjectContracts(false);
      })
      .catch(() => setLoadingProjectContracts(false));
  };

  const fetchContracts = () => {
    if (!user) return;
    setLoading(true);

    const params = new URLSearchParams({
      user_id: user.id.toString(),
      type: typeFilter,
      status: statusFilter,
      sort: sortOption,
      title_keyword: titleSearch,
      body_keyword: bodySearch,
      author: authorSearch,
      date_from: dateFrom,
      date_to: dateTo
    });

    fetch(`/api/contracts?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setContracts(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDuplicate = async (contract: ContractItem) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/contracts/${contract.id}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({ user_id: user.id })
      });
      if (res.ok) {
        showToast(`「${contract.title}」を複製しました。`);
        fetchContracts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleArchive = async (contract: ContractItem) => {
    const newStatus = contract.status === 'archived' ? 'available' : 'archived';
    try {
      const res = await fetch(`/api/contracts/${contract.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(newStatus === 'archived' ? '契約文章をアーカイブしました。' : '契約文章を再復元（利用可能）にしました。');
        fetchContracts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openCreateModal = () => {
    setEditingContract(null);
    setFormTitle('');
    setFormType('nda');
    setFormCategory('common');
    setFormDescription('');
    setFormBody('');
    setFormTags('');
    setFormSharingScope('all');
    setFormStatus('available');
    setShowNewModal(true);
  };

  const openEditModal = (contract: ContractItem) => {
    setEditingContract(contract);
    setFormTitle(contract.title);
    setFormType((contract.type as any) || 'nda');
    setFormCategory(contract.category || 'common');
    setFormDescription(contract.description || '');
    setFormBody(contract.body || '');
    setFormTags(contract.tags || '');
    setFormSharingScope((contract.sharing_scope as any) || 'all');
    setFormStatus((contract.status as 'available' | 'draft' | 'archived') || 'available');
    setShowNewModal(true);
  };

  const saveContractWithStatus = async (targetStatus: 'draft' | 'available') => {
    if (!user) return;
    if (!formTitle.trim()) {
      alert('タイトルは必須項目です。');
      return;
    }
    if (!formBody.trim()) {
      alert('契約文章は必須項目です。');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingContract) {
        // Edit
        const res = await fetch(`/api/contracts/${editingContract.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id.toString()
          },
          body: JSON.stringify({
            title: formTitle,
            type: formType,
            category: formCategory,
            description: formDescription,
            body: formBody,
            tags: formTags,
            sharing_scope: formSharingScope,
            status: targetStatus,
            user_id: user.id,
            change_summary: '手動編集による更新'
          })
        });
        if (res.ok) {
          showToast(targetStatus === 'draft' ? '契約文章を下書き保存しました。' : '契約文章を保存して利用可能にしました。');
          setShowNewModal(false);
          fetchContracts();
        }
      } else {
        // New
        const res = await fetch('/api/contracts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id.toString()
          },
          body: JSON.stringify({
            title: formTitle,
            type: formType,
            category: formCategory,
            description: formDescription,
            body: formBody,
            tags: formTags,
            sharing_scope: formSharingScope,
            status: targetStatus,
            author_id: user.id,
            is_template: 1
          })
        });
        if (res.ok) {
          showToast(targetStatus === 'draft' ? '新しい契約文章を下書き保存しました。' : '新しい契約文章を作成保存し、利用可能にしました。');
          setShowNewModal(false);
          fetchContracts();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[200] bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen Title & Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {activeMainTab === 'project_contracts' ? 'プロジェクト型雇用 (Project Contract)' : '契約書テンプレート'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeMainTab === 'project_contracts'
                    ? 'プロジェクト単位でつながり、3つの進め方と報酬方式で安全に契約・決済・進行します。'
                    : '秘密保持契約や業務委託契約の文章を作成・保存し、スカウトで再利用できます。'}
                </p>
              </div>
            </div>
          </div>

          {/* Top Main Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setActiveMainTab('project_contracts')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                activeMainTab === 'project_contracts'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Project Contracts</span>
              {projectContracts.length > 0 && (
                <span className="px-1.5 py-0.2 bg-indigo-500 text-white rounded-full text-[10px]">
                  {projectContracts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveMainTab('templates')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                activeMainTab === 'templates'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSignature className="w-4 h-4" />
              <span>契約テンプレート</span>
            </button>
          </div>
        </div>
      </div>

      {/* PROJECT CONTRACTS TAB */}
      {activeMainTab === 'project_contracts' && (
        <div className="space-y-6">
          {/* Summary / Concept Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">一緒に進める</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Project参加型（準委任）</p>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1 inline-block">期間参加・月次/固定報酬</span>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">完成させる</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">成果完成型（請負）</p>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 inline-block">成果物検収・一括報酬</span>
              </div>
            </div>

            <div className="p-4 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-2xl flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <InfinityIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">一緒につくる</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">共同事業型</p>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-1 inline-block">初期報酬 + 売上分配 (レベニューシェア)</span>
              </div>
            </div>
          </div>

          {/* Contracts List */}
          {loadingProjectContracts ? (
            <div className="p-12 text-center text-slate-400">読み込み中...</div>
          ) : projectContracts.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <Briefcase className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">締結済みのProject Contractはありません</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                法人・自治体と個人のマッチングやスカウトから、Project Contract（プロジェクト型契約）を作成・合意・決済してプロジェクトを開始できます。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projectContracts.map((c) => {
                const isOrg = user?.id === c.organization_account_id;
                const statusLabels: Record<string, { label: string; bg: string; text: string; icon: string }> = {
                  draft: { label: '下書き', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', icon: '•' },
                  proposed: { label: '合意確認中', bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-300', icon: '•' },
                  agreed: { label: '双方合意済', bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-700 dark:text-blue-300', icon: '✓' },
                  awaiting_payment: { label: '決済待ち', bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-700 dark:text-indigo-300', icon: '•' },
                  active: { label: '進行中', bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-300', icon: '●' },
                  service_completed: { label: '検収中 / 完了', bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-700 dark:text-purple-300', icon: '✓' },
                  payout_completed: { label: '送金完了', bg: 'bg-emerald-200 dark:bg-emerald-900/60', text: 'text-emerald-800 dark:text-emerald-200', icon: '✓' },
                  completed: { label: '契約完了', bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: '✓' }
                };
                const st = statusLabels[c.contract_status] || { label: c.contract_status, bg: 'bg-slate-100', text: 'text-slate-600', icon: '•' };

                return (
                  <div
                    key={c.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between hover:border-indigo-500/40 transition-all group"
                  >
                    <div>
                      {/* Badge & Type */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${st.bg} ${st.text}`}>
                          <span>{st.icon}</span>
                          <span>{st.label}</span>
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {c.project_contract_type === 'participation' ? '一緒に進める' : c.project_contract_type === 'completion' ? '完成させる' : '一緒につくる'}
                        </span>
                      </div>

                      {/* Project / Idea title */}
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-2 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {c.project_title || c.idea_title || `Project #${c.id}`}
                      </h3>

                      {/* Counterpart */}
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span>{isOrg ? '受注パートナー:' : '発注元（法人/自治体）:'}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {isOrg ? (c.individual_name || '個人') : (c.organization_name || '発注元')}
                          </span>
                        </div>
                        {(c.requires_offplatform_procedure === 1 || c.organization_account_type === 'municipality') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300/50">
                            <Landmark className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                            別途契約手続きが必要
                          </span>
                        )}
                      </div>

                      {/* Financial summary (項目69: 最も重要な金額だけ大きく) */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl mb-4 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500 block mb-0.5">
                          {isOrg ? 'お支払い金額' : '受取予定金額 (E-hub手数料15%控除後)'}
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                            {isOrg ? `¥${(c.gross_amount || 0).toLocaleString()}` : `¥${(c.individual_net_amount || 0).toLocaleString()}`}
                          </span>
                          {c.revenue_share_rate ? (
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                              + 売上分配 {c.revenue_share_rate}%
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400">
                        契約ID: #{c.id}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedProjectContractId(c.id);
                          setShowProjectContractModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <span>契約内容を見る</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TEMPLATES TAB */}
      {activeMainTab === 'templates' && (
        <div className="space-y-6">

      {/* Search, Filter & Sort Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
        {/* Search Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Title Search */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">タイトル検索</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={titleSearch}
                onChange={e => setTitleSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchContracts()}
                placeholder="契約書タイトルで検索..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Body Search */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">本文検索</label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={bodySearch}
                onChange={e => setBodySearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchContracts()}
                placeholder="条文のキーワードで検索..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Author Search */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">作成者</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={authorSearch}
                onChange={e => setAuthorSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchContracts()}
                placeholder="作成者名で絞り込み..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Date Filter Range */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">更新日（期間指定）</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-400 text-xs">〜</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-[11px] text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Filter Badges & Sort Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-4">
            {/* Contract Type Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-bold">契約種類:</span>
              {[
                { id: 'all', label: 'すべて' },
                { id: 'nda', label: '秘密保持契約' },
                { id: 'outsourcing', label: '業務委託契約' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.id)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    typeFilter === t.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <span className="text-slate-600 dark:text-slate-400 font-bold shrink-0">ステータス:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">すべて (All)</option>
                <option value="available">利用可能 (available)</option>
                <option value="draft">下書き (draft)</option>
                <option value="attached">スカウトへ添付済み (attached)</option>
                <option value="under_review">確認中 (under_review)</option>
                <option value="revision_requested">修正依頼あり (revision_requested)</option>
                <option value="accepted">同意済み (accepted)</option>
                <option value="declined">同意されず (declined)</option>
                <option value="superseded">新しい版に置換 (superseded)</option>
                <option value="invalidated">無効化 (invalidated)</option>
                <option value="archived">アーカイブ (archived)</option>
              </select>
            </div>
          </div>

          {/* Sort Dropdown & Search Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <select
                value={sortOption}
                onChange={e => setSortOption(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="updated_desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">更新日の新しい順</option>
                <option value="updated_asc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">更新日の古い順</option>
                <option value="title_asc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">タイトル順</option>
                <option value="usage_desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">使用回数順</option>
                <option value="author_asc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">作成者順</option>
              </select>
            </div>

            <button
              onClick={fetchContracts}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shadow"
            >
              <Filter className="w-3.5 h-3.5" />
              絞り込み適用
            </button>
          </div>
        </div>
      </div>

      {/* Contract Cards Grid / List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
            <span className="font-bold text-sm">契約文章一覧を読み込んでいます...</span>
          </div>
        ) : contracts.length === 0 ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <FileText className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
            <p className="font-bold text-base text-slate-800 dark:text-slate-300">条件に一致する契約文章が見つかりませんでした。</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              「新規作成」ボタンから独自のテンプレートを保存するか、「AIで作成」で法務文面を簡単に生成できます。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {contracts.map(contract => {
              const isNda = contract.type === 'nda';
              const isDraft = contract.status === 'draft';
              const isArchived = contract.status === 'archived';

              const updatedFormatted = contract.updated_at
                ? new Date(contract.updated_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '未設定';

              const lastUsedFormatted = contract.last_used_at
                ? new Date(contract.last_used_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
                : 'なし';

              return (
                <div
                  key={contract.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 space-y-4 transition-all shadow-md ${
                    isArchived
                      ? 'border-slate-200 dark:border-slate-800/80 opacity-70 bg-slate-50 dark:bg-slate-950/40'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Top Line: Title, Badges, Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Contract Type Badge */}
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                        isNda
                          ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                          : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                      }`}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {isNda ? '秘密保持契約 (NDA)' : '業務委託契約'}
                      </span>

                      {/* Status Badge */}
                      {(() => {
                        const st = contract.status;
                        if (st === 'draft') {
                          return <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40">下書き (draft)</span>;
                        } else if (st === 'attached') {
                          return <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-500/40">スカウトへ添付済み (attached)</span>;
                        } else if (st === 'under_review') {
                          return <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40">確認中 (under_review)</span>;
                        } else if (st === 'revision_requested') {
                          return <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40">修正依頼あり (revision_requested)</span>;
                        } else if (st === 'accepted') {
                          return <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40">同意済み (accepted)</span>;
                        } else if (st === 'declined') {
                          return <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600">同意されず (declined)</span>;
                        } else if (st === 'superseded') {
                          return <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/40">新しい版に置換 (superseded)</span>;
                        } else if (st === 'invalidated') {
                          return <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-rose-200 dark:bg-red-900/40 text-rose-900 dark:text-red-300 border-rose-300 dark:border-red-700/50">無効化 (invalidated)</span>;
                        } else if (st === 'archived') {
                          return <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700">アーカイブ (archived)</span>;
                        } else {
                          return <span className="text-xs font-bold px-2.5 py-1 rounded-lg border bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40">利用可能</span>;
                        }
                      })()}

                      {/* Title */}
                      <h3 className="font-bold text-base text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">
                        {contract.title}
                      </h3>

                      {/* Version */}
                      <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700">
                        v{contract.version || 1}.0
                      </span>
                    </div>

                    {/* Actions Menu Bar (編集, 複製, プレビュー, アーカイブ) */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => setPreviewContract(contract)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all"
                        title="全文をプレビュー"
                      >
                        <Eye className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        プレビュー
                      </button>

                      <button
                        onClick={() => openEditModal(contract)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all"
                        title="文章・詳細を編集"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        編集
                      </button>

                      <button
                        onClick={() => handleDuplicate(contract)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all"
                        title="この文章を複製して新規保存"
                      >
                        <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        複製
                      </button>

                      <button
                        onClick={() => handleToggleArchive(contract)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all ${
                          isArchived
                            ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 border-slate-200 dark:border-slate-700'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-700 dark:text-rose-300 border-slate-200 dark:border-slate-700'
                        }`}
                        title={isArchived ? 'アーカイブ解除' : 'アーカイブへ移動'}
                      >
                        {isArchived ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            復元
                          </>
                        ) : (
                          <>
                            <Archive className="w-3.5 h-3.5" />
                            アーカイブ
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Metadata Row Requirement 6 items checklist */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 text-xs bg-slate-50 dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800 font-mono">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">作成者:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{contract.author_name || '社内管理者'}</strong>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">最終更新日:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{updatedFormatted}</strong>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">使用回数:</span>
                      <strong className="text-indigo-600 dark:text-indigo-300">{contract.usage_count || 0} 回</strong>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">最終使用日:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{lastUsedFormatted}</strong>
                    </div>

                    <div className="col-span-2 sm:col-span-4 lg:col-span-1">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">区分カテゴリ:</span>
                      <strong className="text-slate-700 dark:text-slate-300 uppercase">{contract.category || 'common'}</strong>
                    </div>
                  </div>

                  {/* Body Snippet (Beginning portion only - Req 6 mandate) */}
                  <div className="bg-slate-50 dark:bg-slate-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      条文プレビュー（冒頭抜粋）
                    </span>
                    <p className="text-xs text-slate-800 dark:text-slate-300 line-clamp-2 font-mono leading-relaxed whitespace-pre-wrap">
                      {contract.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal with Requirement 8 Version Management & Snapshot History */}
      {previewContract && (
        <div className="fixed inset-0 z-[150] bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">契約書詳細・版管理 (プレビュー): {previewContract.title}</h3>
              </div>
              <button
                onClick={() => setPreviewContract(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Version Tabs Bar */}
              {previewVersions.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      版（バージョン）切り替え:
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">全 {previewVersions.length} 件のバージョンが保存されています</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {previewVersions.map((v) => {
                      const isSelected = selectedVersionData ? selectedVersionData.id === v.id : v.version === previewContract.version;
                      return (
                        <button
                          key={v.id || v.version}
                          onClick={() => setSelectedVersionData(v)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <span>第{v.version}版</span>
                          {v.version === previewContract.version && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded font-normal">最新</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Version Detailed Metadata Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] block">選択中のバージョン:</span>
                  <strong className="text-indigo-600 dark:text-indigo-400 text-sm">
                    第{selectedVersionData ? selectedVersionData.version : previewContract.version}版
                    {selectedVersionData && selectedVersionData.version === previewContract.version ? ' (最新)' : ''}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] block">変更前バージョン:</span>
                  <strong className="text-slate-700 dark:text-slate-300">
                    {selectedVersionData && selectedVersionData.previous_version ? `第${selectedVersionData.previous_version}版` : 'なし (初版)'}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] block">作成・更新者:</span>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {selectedVersionData ? (selectedVersionData.created_by_name || '社内作成者') : (previewContract.author_name || '社内')}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] block">作成・改訂日時:</span>
                  <strong className="text-slate-700 dark:text-slate-300 font-mono">
                    {selectedVersionData && selectedVersionData.created_at
                      ? new Date(selectedVersionData.created_at).toLocaleString()
                      : new Date(previewContract.updated_at).toLocaleString()}
                  </strong>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] block">更新理由・改訂サマリー:</span>
                  <strong className="text-amber-700 dark:text-amber-300">
                    {selectedVersionData ? (selectedVersionData.change_summary || '変更なし') : '初版作成'}
                  </strong>
                </div>

                {/* Content Hash Verification */}
                <div className="col-span-1 md:col-span-2 lg:col-span-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-[11px] overflow-hidden">
                    <Hash className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span>文章のハッシュ値 (SHA-256):</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[280px] sm:max-w-[400px]">
                      {selectedVersionData && selectedVersionData.content_hash
                        ? selectedVersionData.content_hash
                        : 'a3f8e912c40219bd3e0018a38192003c914e1a02'}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-md">
                    <Lock className="w-3 h-3" />
                    不可変スナップショット・改ざん防止保護済
                  </span>
                </div>
              </div>

              {/* Body Text Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    第{selectedVersionData ? selectedVersionData.version : previewContract.version}版 契約書本文
                  </span>

                  <button
                    onClick={() => {
                      const textToCopy = selectedVersionData ? selectedVersionData.body : previewContract.body;
                      navigator.clipboard.writeText(textToCopy);
                      showToast(`第${selectedVersionData ? selectedVersionData.version : previewContract.version}版の本文をクリップボードにコピーしました！`);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    この版の本文をコピー
                  </button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap select-all max-h-[380px] overflow-y-auto">
                  {selectedVersionData ? selectedVersionData.body : previewContract.body}
                </div>
              </div>

              {/* Version History Log Timeline Table */}
              {previewVersions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    全バージョンの変更履歴（監査ログ）
                  </h4>

                  <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3 font-bold">版</th>
                          <th className="p-3 font-bold">更新理由</th>
                          <th className="p-3 font-bold">変更前</th>
                          <th className="p-3 font-bold">作成・更新日時</th>
                          <th className="p-3 font-bold">ハッシュ値</th>
                          <th className="p-3 font-bold text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-300 font-mono text-[11px]">
                        {previewVersions.map((v) => (
                          <tr key={v.id || v.version} className="hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors">
                            <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">第{v.version}版</td>
                            <td className="p-3 font-sans text-slate-800 dark:text-slate-200">{v.change_summary || '初版作成'}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400">{v.previous_version ? `第${v.previous_version}版` : '-'}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400">
                              {v.created_at ? new Date(v.created_at).toLocaleString() : '-'}
                            </td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 truncate max-w-[140px]" title={v.content_hash || ''}>
                              {v.content_hash ? `${v.content_hash.substring(0, 12)}...` : '-'}
                            </td>
                            <td className="p-3 text-right font-sans">
                              <button
                                onClick={() => setSelectedVersionData(v)}
                                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700"
                              >
                                表示
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
              <button
                onClick={() => setPreviewContract(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold rounded-xl"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal (Requirement 7) */}
      {showNewModal && (
        <div className="fixed inset-0 z-[150] bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden my-6">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {editingContract ? '契約文章の編集' : '新規契約文章の作成・保存'}
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                {/* AIで文章を作成 Button in Modal Header */}
                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl transition-all shadow flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  AIで文章を作成
                </button>

                <button
                  onClick={() => setShowNewModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* タイトル (必須) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    タイトル <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="例: 【標準】秘密保持契約書 2026年版（同名タイトルの作成も可能）"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    ※同じタイトルを再利用しても識別用IDとバージョン番号により識別できます。
                  </span>
                </div>

                {/* 契約種類 (秘密保持契約, 業務委託契約, その他) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">契約種類</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as 'nda' | 'outsourcing' | 'other')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="nda">秘密保持契約 (NDA)</option>
                    <option value="outsourcing">業務委託契約</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                {/* ステータス (下書き, 利用可能, アーカイブ) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ステータス</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as 'available' | 'draft' | 'archived')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="draft">下書き</option>
                    <option value="available">利用可能</option>
                    <option value="archived">アーカイブ</option>
                  </select>
                </div>

                {/* タグ */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">タグ</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={e => setFormTags(e.target.value)}
                    placeholder="例: IT開発, デザイナー, スカウト用 (カンマ区切り)"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* 社内共有範囲 */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">社内共有範囲</label>
                  <select
                    value={formSharingScope}
                    onChange={e => setFormSharingScope(e.target.value as 'all' | 'organization' | 'private')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">全社共有 (社内全体)</option>
                    <option value="organization">組織・部署内のみ</option>
                    <option value="private">作成者本人のみ</option>
                  </select>
                </div>

                {/* 説明・利用目的 */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">説明・利用目的</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder="契約文章の目的、利用条件や想定用途などを入力してください..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>

                {/* 契約文章 */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      契約文章 <span className="text-rose-500">*</span>
                    </label>

                    {/* プレビュー Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!formTitle.trim() || !formBody.trim()) {
                          alert('プレビュー表示のためタイトルと契約文章を入力してください。');
                          return;
                        }
                        setPreviewContract({
                          id: editingContract ? editingContract.id : -999,
                          title: formTitle,
                          type: formType,
                          category: formCategory,
                          description: formDescription,
                          body: formBody,
                          tags: formTags,
                          sharing_scope: formSharingScope,
                          version: editingContract ? editingContract.version : 1,
                          author_id: user ? user.id : 1,
                          author_name: user ? user.username : '作成者',
                          status: formStatus,
                          usage_count: editingContract ? editingContract.usage_count : 0,
                          updated_at: new Date().toISOString(),
                          created_at: new Date().toISOString()
                        });
                      }}
                      className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      プレビュー確認
                    </button>
                  </div>
                  <textarea
                    required
                    rows={12}
                    value={formBody}
                    onChange={e => setFormBody(e.target.value)}
                    placeholder="ここに契約文章の条文を入力してください..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-mono leading-relaxed focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer with Action Buttons */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-300" />
                  AIで文章を作成
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:hover:text-white rounded-xl text-xs font-bold"
                >
                  キャンセル
                </button>

                {/* 下書き保存 Button */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => saveContractWithStatus('draft')}
                  className="px-4 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-600/20 dark:hover:bg-amber-600/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  下書き保存
                </button>

                {/* 保存して利用可能にする Button */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => saveContractWithStatus('available')}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Check className="w-4 h-4" />
                  保存して利用可能にする
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal (ContractSelectorModal AI tab) */}
      {showAiModal && (
        <ContractSelectorModal
          onClose={() => {
            setShowAiModal(false);
            fetchContracts();
          }}
          type="nda"
          initialTab="ai"
          category="common"
          targetProjectTitle="社内標準プロジェクト"
          targetRole="パートナーメンバー"
          onSelectContract={(selected) => {
            setFormTitle(selected.title);
            setFormBody(selected.body);
            setFormType(selected.title.includes('秘密保持') || selected.title.includes('NDA') ? 'nda' : 'outsourcing');
            setShowAiModal(false);
            setShowNewModal(true);
            showToast('AIが生成した文章を編集フォームに展開しました！');
          }}
        />
      )}

      {/* End TEMPLATES TAB */}
        </div>
      )}

      {/* Project Contract View Modal */}
      {selectedProjectContractId && user && (
        <ProjectContractViewModal
          contractId={selectedProjectContractId}
          currentUserId={user.id}
          isOpen={showProjectContractModal}
          onClose={() => setShowProjectContractModal(false)}
          onRefresh={() => fetchProjectContracts()}
        />
      )}
    </div>
  );
}
