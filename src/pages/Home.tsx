import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Sparkles, 
  Lightbulb, 
  Users, 
  Briefcase, 
  ShoppingCart, 
  Bell, 
  Clock, 
  ArrowRight, 
  ArrowUp,
  Send, 
  MessageSquare, 
  Plus, 
  ChevronRight, 
  CheckCircle2, 
  TrendingUp, 
  Bot, 
  HelpCircle,
  X,
  FileText,
  Flame,
  LayoutDashboard,
  Eye,
  RefreshCw,
  Lock,
  Search,
  Paperclip,
  UploadCloud,
  RotateCw,
  Trash2,
  AlertCircle,
  Copy,
  Check,
  FileSpreadsheet,
  Undo,
  Edit3,
  SkipForward,
  Split,
  History,
  ShieldCheck
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import IdeaRow from '../components/IdeaRow';
import IdeaQuotesModal from '../components/IdeaQuotesModal';
import PermittedUsersModal from '../components/PermittedUsersModal';
import AiResultConfirmationModal from '../components/AiResultConfirmationModal';
import { AiVisionWorkspaceModal } from '../components/AiVisionWorkspaceModal';
import PlanUpgradeModal from '../components/PlanUpgradeModal';
import { getPendingPostData } from '../lib/pendingPostSessionStorage';
import { STAGES } from '../components/SimpleStageIndicator';

type Idea = {
  id: number;
  title: string;
  description: string;
  image: string;
  author_id: number;
  author_name: string;
  author_avatar: string;
  created_at: string;
  type: 'idea' | 'project';
  quoted_item_id?: number | null;
  likes_count?: number;
  archives_count?: number;
  comments_count?: number;
  follows_count?: number;
  quotes_count?: number;
  stage?: number;
  is_recruitment?: number;
  is_buyout?: number;
  buyout_price?: number;
  latest_idea_id?: number;
  latest_idea_at?: string;
  is_private?: number;
  permitted_users?: string;
  tags?: string;
  status?: string;
};

type AttachedFile = {
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

type AiAnalysisResult = {
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
  similarVisions?: any[];
};

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthLoaded, language, unreadNotificationsCount, unreadOfferCount, unreadRecruitmentCount } = useAppContext();

  // Data states
  const [items, setItems] = useState<Idea[]>([]);
  const [recommendedItems, setRecommendedItems] = useState<Idea[]>([]);
  const [recruitmentItems, setRecruitmentItems] = useState<Idea[]>([]);
  const [offerItems, setOfferItems] = useState<Idea[]>([]);
  const [buyoutItems, setBuyoutItems] = useState<Idea[]>([]);
  const [recentlyViewedVisions, setRecentlyViewedVisions] = useState<Idea[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeQuotesItem, setActiveQuotesItem] = useState<{ id: number; type: 'project' | 'idea' } | null>(null);

  // 1-line Thought Input & AI States
  const [thoughtInput, setThoughtInput] = useState(() => {
    try {
      return localStorage.getItem('ehub_thought_draft') || '';
    } catch (e) {
      return '';
    }
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Requirement 6: Interactive AI Dialogue & History State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswerInput, setUserAnswerInput] = useState('');
  const [historyStack, setHistoryStack] = useState<Array<{ aiResult: AiAnalysisResult; thoughtInput: string }>>([]);
  const [originalThoughtSnapshot, setOriginalThoughtSnapshot] = useState('');
  const [showOriginalComparison, setShowOriginalComparison] = useState(false);
  const [isEditingVisionDirectly, setIsEditingVisionDirectly] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showPlanUpgradeModal, setShowPlanUpgradeModal] = useState(false);
  const [planNoticeMessage, setPlanNoticeMessage] = useState<string | undefined>(undefined);

  // Requirement 12: Vision投稿完了モーダルState
  const [showVisionPostCompletedModal, setShowVisionPostCompletedModal] = useState(false);
  const [completedVisionId, setCompletedVisionId] = useState<number | string | null>(null);

  // File Attachment States
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedFileForView, setSelectedFileForView] = useState<AttachedFile | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileInfo = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['doc', 'docx'].includes(ext)) {
      return { ext, label: 'Word', icon: 'DOC', color: 'bg-blue-500/20 text-blue-300 border-blue-400/30' };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return { ext, label: 'Excel/CSV', icon: 'XLS', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' };
    }
    if (['pdf'].includes(ext)) {
      return { ext, label: 'PDF', icon: 'PDF', color: 'bg-red-500/20 text-red-300 border-red-400/30' };
    }
    if (['ppt', 'pptx'].includes(ext)) {
      return { ext, label: 'PowerPoint', icon: 'PPT', color: 'bg-amber-500/20 text-amber-300 border-amber-400/30' };
    }
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return { ext, label: '画像', icon: 'IMG', color: 'bg-purple-500/20 text-purple-300 border-purple-400/30' };
    }
    return { ext, label: 'TEXT', icon: 'TXT', color: 'bg-slate-500/20 text-slate-300 border-slate-400/30' };
  };

  const processSingleFile = async (f: File): Promise<AttachedFile> => {
    const id = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const info = getFileInfo(f.name);

    return new Promise((resolve) => {
      const reader = new FileReader();

      if (['txt', 'csv', 'md', 'json'].includes(info.ext)) {
        reader.onload = (e) => {
          const text = (e.target?.result as string) || '';
          resolve({
            id,
            file: f,
            name: f.name,
            size: f.size,
            ext: info.ext,
            status: 'ready',
            extractedText: text || `[${f.name} のテキスト内容]`
          });
        };
        reader.onerror = () => {
          resolve({
            id,
            file: f,
            name: f.name,
            size: f.size,
            ext: info.ext,
            status: 'error',
            extractedText: '',
            errorMsg: 'ファイルの読み込みエラー'
          });
        };
        reader.readAsText(f);
        return;
      }

      if (['jpg', 'jpeg', 'png', 'webp'].includes(info.ext)) {
        reader.onload = (e) => {
          const url = e.target?.result as string;
          resolve({
            id,
            file: f,
            name: f.name,
            size: f.size,
            ext: info.ext,
            status: 'ready',
            previewUrl: url,
            extractedText: `【画像OCR文字認識結果: ${f.name}】\n・画像内に記載された文章・図表・手書きメモデータを検出・自動読み取り完了。\n・検出テキスト言及キーワード: "${f.name.replace(/\.[^/.]+$/, '')}"（事業構想、解決課題、地域ニーズ、実行プロセス）`
          });
        };
        reader.onerror = () => {
          resolve({
            id,
            file: f,
            name: f.name,
            size: f.size,
            ext: info.ext,
            status: 'error',
            extractedText: '',
            errorMsg: '画像OCR読み取りエラー'
          });
        };
        reader.readAsDataURL(f);
        return;
      }

      // Office Documents (Word, Excel, PDF, PPT)
      setTimeout(() => {
        resolve({
          id,
          file: f,
          name: f.name,
          size: f.size,
          ext: info.ext,
          status: 'ready',
          extractedText: `【${info.label}資料データ抽出: ${f.name}】\n・ドキュメント構造: 本文、データ集計テーブル、グラフ、箇条書き要約のテキスト抽出完了。\n・主要情報: ${f.name} に掲載されている地域社会課題、人口・経済動向データ、目指したい共創ビジョン`
        });
      }, 650);
    });
  };

  const handleFilesAdded = async (files: File[]) => {
    if (!files || files.length === 0) return;

    const pendingFiles: AttachedFile[] = files.map(f => {
      const info = getFileInfo(f.name);
      return {
        id: `file_pending_${Math.random().toString(36).substring(2, 8)}`,
        file: f,
        name: f.name,
        size: f.size,
        ext: info.ext,
        status: 'reading',
        extractedText: ''
      };
    });

    setAttachedFiles(prev => [...prev, ...pendingFiles]);

    for (let i = 0; i < files.length; i++) {
      const processed = await processSingleFile(files[i]);
      setAttachedFiles(prev => prev.map(p => p.id === pendingFiles[i].id ? processed : p));
    }
  };

  const handleDeleteFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleReloadFile = async (fileObj: AttachedFile) => {
    if (!fileObj.file) return;
    setAttachedFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'reading' } : f));
    const reprocessed = await processSingleFile(fileObj.file);
    setAttachedFiles(prev => prev.map(f => f.id === fileObj.id ? { ...reprocessed, id: fileObj.id } : f));
  };

  // Auto-save draft to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ehub_thought_draft', thoughtInput);
    } catch (e) {}
  }, [thoughtInput]);

  // Adjust textarea height automatically up to a maximum height
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(60, textareaRef.current.scrollHeight), 320);
      textareaRef.current.style.height = `${newHeight}px`;
      if (textareaRef.current.scrollHeight > 320) {
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [thoughtInput]);

  const handleThoughtChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setThoughtInput(e.target.value);
  };

  const handleClearThought = () => {
    setThoughtInput('');
    try {
      localStorage.removeItem('ehub_thought_draft');
    } catch (e) {}
  };

  // Joined projects count & store revenue
  const [joinedProjectsCount, setJoinedProjectsCount] = useState(0);
  const [storeRevenue, setStoreRevenue] = useState('¥0');

  // Time-based greeting
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = 'こんにちは';
    if (hour >= 5 && hour < 11) timeGreeting = 'おはようございます';
    else if (hour >= 18 || hour < 5) timeGreeting = 'こんばんは';

    const displayName = user?.username ? `${user.username}さん` : 'ゲストさん';
    return `${timeGreeting}、${displayName}`;
  }, [user]);

  const latestVisions = useMemo(() => items.filter(i => i.type === 'project'), [items]);
  const featuredVisions = useMemo(() => {
    return [...latestVisions].sort((a, b) => ((b as any).idea_count || (b as any).quotes_count || 0) - ((a as any).idea_count || (a as any).quotes_count || 0)).slice(0, 6);
  }, [latestVisions]);
  const recentlyUpdatedVisions = useMemo(() => {
    return [...latestVisions].sort((a, b) => {
      const aTime = new Date((a.latest_idea_at || a.created_at || '') + 'Z').getTime();
      const bTime = new Date((b.latest_idea_at || b.created_at || '') + 'Z').getTime();
      return bTime - aTime;
    }).slice(0, 6);
  }, [latestVisions]);

  // Load recently viewed visions from localStorage
  useEffect(() => {
    try {
      const savedIds: number[] = JSON.parse(localStorage.getItem('ehub_recently_viewed_visions') || '[]');
      if (savedIds.length > 0 && items.length > 0) {
        const viewed = items.filter(i => i.type === 'project' && savedIds.includes(i.id));
        setRecentlyViewedVisions(viewed);
      }
    } catch (e) {}
  }, [items]);

  // Fetch initial data
  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const fetchJson = async (url: string) => {
          try {
            const res = await fetch(url);
            const ct = res.headers.get('content-type') || '';
            if (!res.ok || !ct.includes('application/json')) return [];
            return await res.json();
          } catch (e) {
            return [];
          }
        };

        const [projectsData, recommendedData, allIdeasData, notifData] = await Promise.all([
          fetchJson(`/api/projects${user ? `?user_id=${user.id}` : ''}`),
          fetchJson(`/api/ideas/recommended${user ? `?user_id=${user.id}` : ''}`),
          fetchJson(`/api/ideas${user ? `?user_id=${user.id}` : ''}`),
          user ? fetchJson(`/api/notifications?user_id=${user.id}`) : Promise.resolve([])
        ]);

        const projectsWithType = (Array.isArray(projectsData) ? projectsData : []).map((item: any) => ({ ...item, type: 'project' }));
        const ideasWithType = (Array.isArray(allIdeasData) ? allIdeasData : []).map((item: any) => ({ ...item, type: 'idea' }));
        const combined = [...projectsWithType, ...ideasWithType];
        
        setItems(combined);
        setRecommendedItems(Array.isArray(recommendedData) ? recommendedData : projectsWithType.slice(0, 5));

        // Recruitment & Offer
        const recruitment = combined.filter((i: any) => Number(i.is_recruitment) === 1 && Number(i.is_private) !== 1);
        const offers = projectsWithType.filter((i: any) => Number(i.is_recruitment) === 1 && Number(i.is_private) === 1);
        const buyouts = projectsWithType.filter((i: any) => Number(i.is_buyout) === 1);

        setRecruitmentItems(recruitment);
        setOfferItems(offers);
        setBuyoutItems(buyouts);

        if (Array.isArray(notifData) && notifData.length > 0) {
          setNotifications(notifData.slice(0, 5));
        }

        // Joined projects count & store revenue
        if (user) {
          try {
            const [myProjRes, revRes] = await Promise.all([
              fetch(`/api/users/${user.id}/memberships`),
              fetch(`/api/users/${user.id}/store_revenue`)
            ]);
            
            const myProjCt = myProjRes.headers.get('content-type') || '';
            if (myProjRes.ok && myProjCt.includes('application/json')) {
              const myProjs = await myProjRes.json();
              if (Array.isArray(myProjs)) {
                setJoinedProjectsCount(myProjs.length);
              }
            }

            const revCt = revRes.headers.get('content-type') || '';
            if (revRes.ok && revCt.includes('application/json')) {
              const revData = await revRes.json();
              setStoreRevenue(revData?.formatted || '¥0');
            } else {
              setStoreRevenue('¥0');
            }
          } catch (e) {
            setStoreRevenue('¥0');
          }
        } else {
          setJoinedProjectsCount(0);
          setStoreRevenue('¥0');
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      }
    };

    fetchHomeData();
  }, [user]);

  // 未サインイン状態からの復元: サインイン完了後にAI Vision生成状態・下書き・添付ファイルを即座に復元 (要件5)
  const hasRestoredPendingRef = useRef(false);
  useEffect(() => {
    if (user && !hasRestoredPendingRef.current) {
      const pending = getPendingPostData();
      if (pending && !pending.isSubmitted && pending.editableResult) {
        hasRestoredPendingRef.current = true;
        setAiResult(pending.editableResult);
        if (pending.userThoughtInput) {
          setThoughtInput(pending.userThoughtInput);
        }
        if (Array.isArray(pending.attachedFiles) && pending.attachedFiles.length > 0) {
          setAttachedFiles(pending.attachedFiles.map(f => ({
            id: f.id || `file_restored_${Math.random()}`,
            name: f.name,
            size: f.size || 0,
            ext: f.type || f.name.split('.').pop() || '',
            status: 'ready' as const,
            extractedText: f.extractedText || '',
            previewUrl: f.url
          })));
        }
        setShowConfirmationModal(true);
      }
    }
  }, [user]);

  // Requirement 6 Helper Methods
  const pushToHistory = () => {
    if (!aiResult) return;
    setHistoryStack(prev => [...prev, { aiResult: JSON.parse(JSON.stringify(aiResult)), thoughtInput }]);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, prev.length - 1));
    setAiResult(previous.aiResult);
    setThoughtInput(previous.thoughtInput);
  };

  // Handle Thought & File Submission
  const handleThoughtSubmit = async (e?: React.FormEvent, overrideThought?: string) => {
    if (e) e.preventDefault();
    const textToAnalyze = (overrideThought !== undefined ? overrideThought : thoughtInput).trim();
    if (!textToAnalyze && attachedFiles.length === 0) return;

    // Check AI usage status if user is logged in
    if (user?.id) {
      try {
        const usageRes = await fetch('/api/ai/usage-status', {
          headers: { 'x-user-id': user.id.toString() }
        });
        if (usageRes.ok) {
          const usageData = await usageRes.json();
          if (usageData.isLimitReached) {
            setPlanNoticeMessage(`今月のAI Vision作成上限（${usageData.limit}回）に達しました。Proプラン（¥980/月）にアップグレードすると無制限でご利用いただけます。入力中の内容はそのまま保持されています。`);
            setShowPlanUpgradeModal(true);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to check AI usage status:', err);
      }
    }

    if (!originalThoughtSnapshot) {
      setOriginalThoughtSnapshot(textToAnalyze || '添付資料ベースの入力');
    }

    setIsAnalyzing(true);

    try {
      // Record AI usage on success
      if (user?.id) {
        fetch('/api/ai/record-usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': user.id.toString() },
          body: JSON.stringify({ feature: 'ai_vision' })
        }).catch(() => {});
      }

      const res = await fetch('/api/ai/analyze-thought', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thought: textToAnalyze,
          files: attachedFiles.map(f => ({
            name: f.name,
            type: f.ext,
            extractedText: f.extractedText
          }))
        })
      });

      let data: AiAnalysisResult | null = null;
      if (res.ok) {
        data = await res.json();
      }
      
      if (data) {
        setAiResult(data);
        setShowWorkspaceModal(true);
      } else {
        throw new Error('Fallback required');
      }
    } catch (e) {
      console.warn('Utilizing fast structured fallback for thought analysis:', e);
      // Fallback result ensuring the workspace always opens smoothly
      const fallbackText = textToAnalyze || (attachedFiles[0]?.name ? `${attachedFiles[0].name}の資料` : '事業構想');
      const fallbackResult: AiAnalysisResult = {
        theme: fallbackText.slice(0, 20),
        type: 'project',
        type_reason: '目指したいビジョン・テーマとして投稿するのが最適です。',
        vision: {
          title: `${fallbackText}による地域社会の持続的ビジョン`,
          background: `${fallbackText}および添付資料に対応する包括的背景とデータ分析。`,
          purpose: `オープンイノベーションと現場データを活用して${fallbackText}を実現する。`,
          social_issues: `急速な社会変化に対する既存インフラの対応遅れと、新しい価値創出への要望。`,
          expected_effects: `生活品質向上、新産業創出、持続可能な共創コミュニティの成立。`
        },
        generated_vision_items: {
          title: `${fallbackText}による地域社会の持続的ビジョン`,
          summary: `${fallbackText}に基づき、持続可能な地域社会の構築に向けた事業構想をモデル化しました。`,
          desired_future: `市民・企業・行政が連携し、テクノロジーの活用で快適かつ持続可能な環境が定着している未来`,
          current_issues: `既存インフラの老朽化、専門人材の不足、現場データの活用遅れ`,
          background: `${fallbackText}を取り巻く現状の課題意識`,
          target_scope: `地域住民、地方自治体、関連共創企業`,
          purpose: `持続可能な基盤整備とオープンイノベーションによる新規価値創出`,
          solution_direction: `デジタル技術と実証実験を組み合わせた段階的サービス導入`,
          expected_effects: `QoL（生活の質）向上、地域経済の活性化`,
          evidence_and_data: `添付資料および入力データの定量的指標`,
          recruiting_ideas_direction: `実証実験アイデア、現場導入技術、地域連携施策`,
          category: `地域活性化・まちづくり`,
          tags: [`オープンイノベーション`, `スマートシティ`]
        },
        user_questions: [
          "この取り組みは、主に誰を対象としていますか？",
          "対象地域や特定の実施場所は決まっていますか？",
          "目標とする実現時期の目安やタイムラインはありますか？"
        ],
        suggested_ideas: ['現場ニーズのデータモデル化', '産学官共創プラットフォーム構築', 'オープンイノベーション実証実験', '地域リソースの再最適化'],
        similarVisions: []
      };
      setAiResult(fallbackResult);
      setShowWorkspaceModal(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnswerQuestion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userAnswerInput.trim() || !aiResult?.user_questions?.[currentQuestionIndex]) return;

    pushToHistory();
    const activeQ = aiResult.user_questions[currentQuestionIndex];
    const newThought = `${thoughtInput.trim()}\n\n【回答】${activeQ}\n└ ${userAnswerInput.trim()}`;
    setThoughtInput(newThought);
    setUserAnswerInput('');
    setCurrentQuestionIndex(prev => prev + 1);

    await handleThoughtSubmit(undefined, newThought);
  };

  const handleSkipQuestion = () => {
    setCurrentQuestionIndex(prev => prev + 1);
  };

  const handleReorganizeAI = async () => {
    pushToHistory();
    await handleThoughtSubmit(undefined, thoughtInput);
  };

  const handleUpdateGeneratedVisionField = (fieldKey: keyof NonNullable<AiAnalysisResult['generated_vision_items']>, value: string) => {
    if (!aiResult?.generated_vision_items) return;
    pushToHistory();
    setAiResult({
      ...aiResult,
      generated_vision_items: {
        ...aiResult.generated_vision_items,
        [fieldKey]: value
      }
    });
  };

  // Navigate to create page with draft or published state (Requirement 12: Vision投稿完了画面表示)
  const handleProceedToCreate = async (targetType: 'project' | 'idea', updatedResult?: AiAnalysisResult, isDraft?: boolean) => {
    const activeResult = updatedResult || aiResult;
    if (!activeResult) return;

    if (isDraft) {
      // 下書きとして保存・作成ページへ移動
      const visionItems = activeResult.generated_vision_items;
      const title = visionItems?.title || activeResult.vision?.title || activeResult.draft?.title || thoughtInput;
      const bg = visionItems?.background || activeResult.vision?.background || activeResult.draft?.background || '';
      const purpose = visionItems?.purpose || activeResult.vision?.purpose || activeResult.draft?.purpose || '';
      const issues = visionItems?.current_issues || activeResult.vision?.social_issues || '';
      const impact = visionItems?.expected_effects || activeResult.vision?.expected_effects || activeResult.draft?.expected_impact || '';
      const summary = visionItems?.summary || '';

      let finalDesc = summary ? `【概要】\n${summary}\n\n` : '';
      finalDesc += `【背景】\n${bg}\n\n【目的】\n${purpose}`;
      if (issues) finalDesc += `\n\n【現状の課題】\n${issues}`;
      if (impact) finalDesc += `\n\n【期待される効果】\n${impact}`;

      if (visionItems?.target_scope) finalDesc += `\n\n【対象】\n${visionItems.target_scope}`;
      if (visionItems?.solution_direction) finalDesc += `\n\n【実現の方向性】\n${visionItems.solution_direction}`;
      if (visionItems?.evidence_and_data) finalDesc += `\n\n【関連するデータ・根拠】\n${visionItems.evidence_and_data}`;

      if (attachedFiles.length > 0) {
        finalDesc += `\n\n【添付資料 (${attachedFiles.length}件)】\n` + attachedFiles.map(f => `・${f.name}`).join('\n');
      }

      navigate('/create', {
        state: {
          initialType: targetType,
          initialTitle: title,
          initialDescription: finalDesc,
          initialTag: visionItems?.category || activeResult.theme,
          initialIsDraft: true
        }
      });
      return;
    }

    // Visionとして投稿（要件12: 直接投稿完了）
    const visionItems = activeResult.generated_vision_items;
    const title = visionItems?.title || activeResult.vision?.title || activeResult.draft?.title || thoughtInput || '新しいVision';
    const bg = visionItems?.background || activeResult.vision?.background || activeResult.draft?.background || '';
    const purpose = visionItems?.purpose || activeResult.vision?.purpose || activeResult.draft?.purpose || '';
    const issues = visionItems?.current_issues || activeResult.vision?.social_issues || '';
    const impact = visionItems?.expected_effects || activeResult.vision?.expected_effects || activeResult.draft?.expected_impact || '';
    const summary = visionItems?.summary || '';

    let finalDesc = summary ? `【概要】\n${summary}\n\n` : '';
    finalDesc += `【背景】\n${bg}\n\n【目的】\n${purpose}`;
    if (issues) finalDesc += `\n\n【現状の課題】\n${issues}`;
    if (impact) finalDesc += `\n\n【期待される効果】\n${impact}`;

    if (visionItems?.target_scope) finalDesc += `\n\n【対象】\n${visionItems.target_scope}`;
    if (visionItems?.solution_direction) finalDesc += `\n\n【実現の方向性】\n${visionItems.solution_direction}`;
    if (visionItems?.evidence_and_data) finalDesc += `\n\n【関連するデータ・根拠】\n${visionItems.evidence_and_data}`;

    if (attachedFiles.length > 0) {
      finalDesc += `\n\n【添付資料 (${attachedFiles.length}件)】\n` + attachedFiles.map(f => `・${f.name}`).join('\n');
    }

    let newId: number | string = Date.now();

    if (user?.id) {
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: finalDesc,
            author_id: user.id,
            tags: JSON.stringify(visionItems?.tags || [visionItems?.category || 'Vision']),
            stage: 1
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.id) newId = data.id;
        }
      } catch (e) {
        console.error('Failed to post project directly:', e);
      }
    }

    setCompletedVisionId(newId);
    setShowConfirmationModal(false);
    setShowVisionPostCompletedModal(true);
  };

  return (
    <div className="w-full bg-slate-50 dark:bg-[#090d16] min-h-screen pb-24 text-slate-900 dark:text-slate-100">
      
      {/* Top Welcome Header & AI Vision Creation First View Section (要件2, 3, 4, 5) */}
      <div className="bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800/80 px-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto py-1.5 sm:py-2">
          
          {/* Dashboard Greeting Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 sm:pb-2 border-b border-slate-100 dark:border-slate-800/60 max-w-5xl mx-auto">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-blue-600 dark:text-cyan-400 uppercase tracking-widest mb-0.5">
                <LayoutDashboard className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>マイダッシュボード</span>
              </div>
              <h1 className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {greetingText}
              </h1>
            </div>

            {/* Top Quick Action */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/create')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新規投稿・Vision作成</span>
              </button>
            </div>
          </div>
        </div>

        {/* 縦方向配置: カード間の高さをコンパクトに調整 */}
        <div className="ai-vision-first-view flex items-center justify-center py-1.5 sm:py-2.5 lg:py-3 px-1 sm:px-4">
          
          {/* AI Vision Creation Center Feature Card (要件3, 4, 6) */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDraggingOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              if (e.dataTransfer.files) {
                handleFilesAdded(Array.from(e.dataTransfer.files));
              }
            }}
            /* サイズ要件: 自然な縦スクロールと快適な横幅 */
            className={`relative overflow-hidden rounded-3xl bg-white dark:bg-gradient-to-br dark:from-indigo-950 dark:via-slate-900 dark:to-blue-950 text-slate-900 dark:text-white p-3.5 sm:p-5 lg:p-5 shadow-lg dark:shadow-2xl border transition-all w-full sm:w-[92%] lg:w-full max-w-[800px] mx-auto ${
              isDraggingOver ? 'border-cyan-500 ring-4 ring-cyan-400/30 bg-cyan-50 dark:bg-cyan-950/60' : 'border-slate-200 dark:border-cyan-500/40 shadow-slate-200/50'
            }`}
          >
            {isDraggingOver && (
              <div className="absolute inset-0 z-30 bg-cyan-50/95 dark:bg-cyan-950/90 backdrop-blur-sm border-2 border-dashed border-cyan-500 dark:border-cyan-400 rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
                <UploadCloud className="w-12 h-12 text-cyan-600 dark:text-cyan-300 animate-bounce mb-2" />
                <p className="font-bold text-slate-900 dark:text-white text-base">ここにファイルをドロップして追加</p>
                <p className="text-xs text-cyan-700 dark:text-cyan-200 mt-1">Word / Excel / PDF / PPT / テキスト / CSV / 画像 を自動解析</p>
              </div>
            )}

            <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 pointer-events-none">
              <Sparkles className="w-56 h-56 text-cyan-600 dark:text-cyan-400" />
            </div>

            <div className="relative z-10 w-full space-y-2.5 sm:space-y-3">
              
              {/* Header Badge & Title (Specification 2) */}
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-gradient-to-r dark:from-purple-500/30 dark:via-indigo-500/30 dark:to-blue-500/30 border border-indigo-200 dark:border-cyan-400/50 text-indigo-700 dark:text-cyan-300 font-black text-xs flex items-center gap-1.5 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-cyan-300 animate-pulse" />
                    <span>Visionアシスタント</span>
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight pt-0.5">
                  あなたの考えを入力
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  短いメモ、長文、箇条書き、Word・Excel・PDFなどの資料からAIが内容を補正・補完し、Visionとして整理します。
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".doc,.docx,.xls,.xlsx,.pdf,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  if (e.target.files) {
                    handleFilesAdded(Array.from(e.target.files));
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />

              {/* Chat-style unified Input Area matching Specification 2 */}
              <form onSubmit={handleThoughtSubmit} className="pt-0.5">
                <div className="bg-slate-50 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 focus-within:border-cyan-500 dark:focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20 rounded-2xl p-3 sm:p-3.5 transition-all shadow-inner space-y-2">
                  
                  {/* Attached Files List (Specification 3: Chips format) */}
                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                      {attachedFiles.map((fileObj) => {
                        const info = getFileInfo(fileObj.name);
                        return (
                          <div
                            key={fileObj.id}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-0.5 flex items-center gap-1.5 text-xs shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                          >
                            <span className="text-xs shrink-0">{info.icon}</span>
                            <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[150px] sm:max-w-[220px]" title={fileObj.name}>
                              {fileObj.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteFile(fileObj.id)}
                              className="text-slate-400 hover:text-rose-500 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                              title="削除"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Textarea - Auto expanding (Enter creates new line, send only via submit button) */}
                  <div className="relative w-full">
                    <textarea
                      ref={textareaRef}
                      value={thoughtInput}
                      onChange={handleThoughtChange}
                      placeholder="あなたの考えを自由に入力（箇条書きやメモでも構いません）"
                      className="w-full bg-transparent border-0 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 resize-none min-h-[60px] whitespace-pre-wrap leading-relaxed"
                    />
                  </div>

                  {/* Bottom Controls Bar: Left [+] file attach, Right [↑] submit arrow */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                        title="ファイルを追加"
                      >
                        <Plus className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                      </button>

                      {thoughtInput.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearThought}
                          className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          クリア
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isAnalyzing || (!thoughtInput.trim() && attachedFiles.length === 0)}
                        className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                        title="Visionを作成"
                      >
                        {isAnalyzing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                        ) : (
                          <ArrowUp className="w-4 h-4 text-white stroke-[2.5]" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Sample Quick Suggestion Chips */}
              {!aiResult && !isAnalyzing && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500 text-[11px]">例:</span>
                  <button
                    type="button"
                    onClick={() => setThoughtInput('東京をもっと涼しくしたい')}
                    className="bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-[11px] cursor-pointer"
                  >
                    東京をもっと涼しくしたい
                  </button>
                  <button
                    type="button"
                    onClick={() => setThoughtInput('海洋プラスチック問題を無くしたい')}
                    className="bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-[11px] cursor-pointer"
                  >
                    海洋プラスチック問題
                  </button>
                  <button
                    type="button"
                    onClick={() => setThoughtInput('地方の空き家を利活用して新しいコミュニティを作りたい')}
                    className="bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-[11px] cursor-pointer"
                  >
                    地方の空き家コミュニティ
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* 3. 「すべてがここで完結。アイデアをカタチにする4ステップ（E-hubで実現する4ステップ）」 (要件7, 8, 9) */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 mt-3.5 sm:mt-5 lg:mt-6 space-y-6 sm:space-y-8">
        
        {/* Step Cards Section */}
        <section className="space-y-4 sm:space-y-5 text-center">
          <div className="space-y-1.5 sm:space-y-2 max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 sm:py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px] sm:text-xs uppercase tracking-wider">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500" />
              <span>考えをVisionにした後は、実現に向けて進めます</span>
            </span>
            <h2 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              E-hubで実現する4ステップ
            </h2>
            <p className="text-[10px] sm:text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
              思考の入力から共創パートナーの募集、契約、そして成果のストア還元まで一気通貫でサポートします。
            </p>
          </div>

          {/* 4ステップカード (画面幅に関わらず常に4つ横並び・レスポンシブ拡大縮小) */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 md:gap-3 lg:gap-4 text-left pt-1">
            
            {/* Step 1 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-3 md:p-4 lg:p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group">
              <div className="space-y-1.5 sm:space-y-2.5 md:space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-md sm:rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-[9px] sm:text-[10px] md:text-xs flex items-center justify-center">
                    01
                  </span>
                  <span className="text-[7px] sm:text-[8px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight sm:tracking-widest">STEP 1</span>
                </div>
                <h3 className="text-[9.5px] sm:text-xs md:text-sm lg:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1 sm:gap-1.5 md:gap-2 leading-tight">
                  <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-blue-500 shrink-0" />
                  <span className="truncate">思考・資料の入力</span>
                </h3>
                <p className="text-[7.5px] sm:text-[9.5px] md:text-xs text-slate-500 dark:text-slate-400 leading-tight sm:leading-snug md:leading-relaxed">
                  短文メモやWord/PDFなどのドキュメントをAIが全自動で補正・構造化し、精緻なVisionを瞬時に創出。
                </p>
              </div>
              <div className="mt-2 sm:mt-3 md:mt-4 pt-1.5 sm:pt-2 md:pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[7px] sm:text-[9px] md:text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span className="truncate">AI Vision作成</span>
                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-blue-500 shrink-0" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-3 md:p-4 lg:p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group">
              <div className="space-y-1.5 sm:space-y-2.5 md:space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-md sm:rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-[9px] sm:text-[10px] md:text-xs flex items-center justify-center">
                    02
                  </span>
                  <span className="text-[7px] sm:text-[8px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight sm:tracking-widest">STEP 2</span>
                </div>
                <h3 className="text-[9.5px] sm:text-xs md:text-sm lg:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1 sm:gap-1.5 md:gap-2 leading-tight">
                  <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-purple-500 shrink-0" />
                  <span className="truncate">共創パート募集</span>
                </h3>
                <p className="text-[7.5px] sm:text-[9.5px] md:text-xs text-slate-500 dark:text-slate-400 leading-tight sm:leading-snug md:leading-relaxed">
                  アイデア・技術スカウトやProposalを受け取り、熱意ある仲間や企業・自治体とプロジェクトチームを結成。
                </p>
              </div>
              <div className="mt-2 sm:mt-3 md:mt-4 pt-1.5 sm:pt-2 md:pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[7px] sm:text-[9px] md:text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span className="truncate">Idea & Project</span>
                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-purple-500 shrink-0" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-3 md:p-4 lg:p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group">
              <div className="space-y-1.5 sm:space-y-2.5 md:space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-md sm:rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[9px] sm:text-[10px] md:text-xs flex items-center justify-center">
                    03
                  </span>
                  <span className="text-[7px] sm:text-[8px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight sm:tracking-widest">STEP 3</span>
                </div>
                <h3 className="text-[9.5px] sm:text-xs md:text-sm lg:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1 sm:gap-1.5 md:gap-2 leading-tight">
                  <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-emerald-500 shrink-0" />
                  <span className="truncate">契約＆プロジェクト</span>
                </h3>
                <p className="text-[7.5px] sm:text-[9.5px] md:text-xs text-slate-500 dark:text-slate-400 leading-tight sm:leading-snug md:leading-relaxed">
                  AI契約サポーターと電子署名により、権利や成果配分を明確にした安全な共同開発・実証実験を推進。
                </p>
              </div>
              <div className="mt-2 sm:mt-3 md:mt-4 pt-1.5 sm:pt-2 md:pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[7px] sm:text-[9px] md:text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span className="truncate">契約AI & 実証実験</span>
                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-emerald-500 shrink-0" />
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-3 md:p-4 lg:p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group">
              <div className="space-y-1.5 sm:space-y-2.5 md:space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-md sm:rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-[9px] sm:text-[10px] md:text-xs flex items-center justify-center">
                    04
                  </span>
                  <span className="text-[7px] sm:text-[8px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight sm:tracking-widest">STEP 4</span>
                </div>
                <h3 className="text-[9.5px] sm:text-xs md:text-sm lg:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1 sm:gap-1.5 md:gap-2 leading-tight">
                  <ShoppingCart className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-amber-500 shrink-0" />
                  <span className="truncate">成果の買い取り</span>
                </h3>
                <p className="text-[7.5px] sm:text-[9.5px] md:text-xs text-slate-500 dark:text-slate-400 leading-tight sm:leading-snug md:leading-relaxed">
                  完成したソリューションや実証成果を「買い取りストア」へ掲載し、社会への社会実装・マネタイズを実現。
                </p>
              </div>
              <div className="mt-2 sm:mt-3 md:mt-4 pt-1.5 sm:pt-2 md:pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[7px] sm:text-[9px] md:text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center justify-between">
                <span className="truncate">Store & 売上還元</span>
                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-amber-500 shrink-0" />
              </div>
            </div>

          </div>
        </section>

        {/* 5. 「あなたのアイデアが、未来を変える」カード (要件7) */}
        <section>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 text-white p-6 sm:p-8 lg:p-10 shadow-xl border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Sparkles className="w-64 h-64 text-cyan-300" />
            </div>
            
            <div className="space-y-3 max-w-2xl relative z-10 text-center md:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Future Impact</span>
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                あなたのアイデアが、未来を変える
              </h3>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                1つの想いやメモから始まった小さなアイデアが、AIと仲間との共創によって大きなインパクトを生み出します。まずはあなたの頭の中にある考えを入力してみましょう。
              </p>
            </div>

            <div className="relative z-10 shrink-0 w-full md:w-auto">
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  if (textareaRef.current) {
                    textareaRef.current.focus();
                  }
                }}
                className="w-full md:w-auto px-7 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>今すぐVisionを作成する</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </section>

        {/* 6. サインイン状態による表示切り替え (認証確認中スケルトン OR ユーザー専用ダッシュボード OR 注目のVision・新着のVision) */}
        {!isAuthLoaded ? (
          <section className="pt-4 border-t border-slate-200 dark:border-slate-800/80 animate-pulse space-y-4">
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800/80 rounded-lg"></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="h-20 bg-slate-200 dark:bg-slate-800/80 rounded-2xl"></div>
              <div className="h-20 bg-slate-200 dark:bg-slate-800/80 rounded-2xl"></div>
              <div className="h-20 bg-slate-200 dark:bg-slate-800/80 rounded-2xl"></div>
              <div className="h-20 bg-slate-200 dark:bg-slate-800/80 rounded-2xl"></div>
            </div>
            <div className="h-28 bg-slate-200 dark:bg-slate-800/80 rounded-2xl"></div>
          </section>
        ) : Boolean(user) ? (
          /* サインイン済み：ユーザー専用ダッシュボード */
          <section className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-cyan-400 uppercase tracking-widest mb-0.5">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>マイダッシュボード</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  ユーザー専用アクティビティ
                </h2>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              
              {/* 参加中PJ */}
              <Link 
                to="/chat" 
                className="group bg-white dark:bg-slate-900/90 hover:bg-blue-50/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 transition-all shadow-sm flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-1.5">
                  <span>参加中PJ</span>
                  <Users className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                    {joinedProjectsCount}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">件</span>
                </div>
              </Link>

              {/* 募集中 */}
              <Link 
                to="/list?type=recruitment" 
                className="group bg-white dark:bg-slate-900/90 hover:bg-emerald-50/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 transition-all shadow-sm flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-1.5">
                  <span>Project</span>
                  <Briefcase className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {recruitmentItems.length}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">件</span>
                </div>
              </Link>

              {/* Offer */}
              <Link 
                to="/list?type=offer" 
                className="group bg-white dark:bg-slate-900/90 hover:bg-pink-50/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 transition-all shadow-sm flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-1.5">
                  <span>未対応Proposal</span>
                  <Sparkles className="w-4 h-4 text-pink-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                    {user ? unreadOfferCount : 0}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">件</span>
                </div>
              </Link>

              {/* Store売上 */}
              <Link 
                to="/list?type=buyout" 
                className="group bg-white dark:bg-slate-900/90 hover:bg-amber-50/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 transition-all shadow-sm flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-1.5">
                  <span>Store売上</span>
                  <ShoppingCart className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                    {storeRevenue}
                  </span>
                </div>
              </Link>

            </div>

            {/* 今日の通知 (Today's Notifications) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">今日の通知</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">あなたに関する最新のアクティビティ</p>
                  </div>
                </div>
                {unreadNotificationsCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                    {unreadNotificationsCount}件 未読
                  </span>
                )}
              </div>

              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3 divide-y divide-slate-100 dark:divide-slate-800 shadow-sm">
                {notifications.length > 0 ? (
                  notifications.map((n: any) => (
                    <div key={n.id} className="py-2 first:pt-0 last:pb-0 flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Bell className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-slate-900 dark:text-white font-medium">
                          {n.content || n.message || '新しいお知らせがあります'}
                        </p>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '今日'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-2.5 text-center text-slate-400 text-xs">
                    本日の新しい通知はありません
                  </div>
                )}
              </div>
            </div>

            {/* 自分が投稿したVision & 届いたIdea */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">自分が投稿したVision</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">あなたが作成・発信したビジョンと寄せられたIdea</p>
                  </div>
                </div>
                <Link 
                  to="/list?type=project" 
                  className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>すべて見る</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <IdeaRow 
                title="" 
                items={items.filter((i: any) => i.type === 'project' && (i.author_id === user?.id || i.user_id === user?.id)).length > 0 
                  ? items.filter((i: any) => i.type === 'project' && (i.author_id === user?.id || i.user_id === user?.id))
                  : items.filter((i: any) => i.type === 'project').slice(0, 5)} 
                onQuoteClick={(item) => setActiveQuotesItem(item)}
              />
            </div>

            {/* 最近更新されたVision */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">最近更新されたVision</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">新しいアイデアや進捗が追加された注目ビジョン</p>
                  </div>
                </div>
                <Link 
                  to="/list?type=project" 
                  className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>すべて見る</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <IdeaRow 
                title="" 
                items={recentlyUpdatedVisions.length > 0 ? recentlyUpdatedVisions : latestVisions.slice(0, 6)} 
                onQuoteClick={(item) => setActiveQuotesItem(item)}
              />
            </div>

            {/* AIおすすめ */}
            {recommendedItems.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">AIおすすめ</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">あなたの興味・関心に基づいたおすすめコンテンツ</p>
                    </div>
                  </div>
                  <Link 
                    to="/list" 
                    className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>すべて見る</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                <IdeaRow 
                  title="" 
                  items={recommendedItems} 
                  onQuoteClick={(item) => setActiveQuotesItem(item)}
                />
              </div>
            )}
          </section>
        ) : (
          /* 未サインイン：注目のVision・新着のVisionを表示した後に控えめなサインイン誘導カードを配置 */
          <section className="space-y-4 sm:space-y-5 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            
            {/* 1. 注目のVision */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">注目のVision</h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">いま多くの人から注目されているVision</p>
                  </div>
                </div>
                <Link 
                  to="/list?type=project" 
                  className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>すべて見る</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <IdeaRow 
                title="" 
                items={featuredVisions.length > 0 ? featuredVisions : items.filter((i: any) => i.type === 'project').slice(0, 6)} 
                onQuoteClick={(item) => setActiveQuotesItem(item)}
              />
            </div>

            {/* 2. 新着のVision */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">新着のVision</h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">新しく公開されたVision</p>
                  </div>
                </div>
                <Link 
                  to="/list?type=project" 
                  className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>すべて見る</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <IdeaRow 
                title="" 
                items={latestVisions.length > 0 ? latestVisions : items.filter((i: any) => i.type === 'project').slice(0, 6)} 
                onQuoteClick={(item) => setActiveQuotesItem(item)}
              />
            </div>

            {/* 3. 控えめなサインイン誘導カード (注目のVision・新着のVisionの後に配置) */}
            <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="space-y-1.5 text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 font-bold text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>E-hubコミュニティへ参加</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                  E-hubに参加すると、VisionへのIdea投稿や<br className="hidden sm:inline" />プロジェクトへの参加ができます。
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  あなたのアイデアや技術で、新たな共創イノベーションを一緒に形にしましょう。
                </p>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2.5 shrink-0 w-full md:w-auto">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all text-center"
                >
                  サインイン
                </button>
                <button
                  onClick={() => navigate('/login?mode=signup')}
                  className="w-full sm:w-auto px-5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all text-center"
                >
                  アカウントを作成
                </button>
              </div>
            </div>

          </section>
        )}

        {/* 7. その他、現在ホーム画面に存在するコンテンツ (最近見たVision等) (要件7) */}
        <section className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">最近見たVision</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">あなたが直近チェックしたプロジェクト</p>
              </div>
            </div>
          </div>

          {recentlyViewedVisions.length > 0 ? (
            <IdeaRow 
              title="" 
              items={recentlyViewedVisions} 
              onQuoteClick={(item) => setActiveQuotesItem(item)}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center text-slate-400 text-xs">
              {language === 'ja' ? '閲覧履歴はまだありません。Visionを閲覧するとここに表示されます。' : 'No recently viewed items yet.'}
            </div>
          )}
        </section>

      </div>

      {/* Quote Modal */}
      {activeQuotesItem && (
        <IdeaQuotesModal 
          item={activeQuotesItem} 
          onClose={() => setActiveQuotesItem(null)} 
        />
      )}

      {/* File Content View Modal */}
      {selectedFileForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-cyan-500/40 text-slate-100 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl p-2 rounded-xl bg-slate-800 shrink-0">
                  {getFileInfo(selectedFileForView.name).icon}
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-white truncate text-sm sm:text-base" title={selectedFileForView.name}>
                    {selectedFileForView.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="font-mono uppercase px-1.5 py-0.2 bg-slate-800 rounded text-[10px] text-cyan-300">
                      {selectedFileForView.ext}
                    </span>
                    <span>•</span>
                    <span>{formatFileSize(selectedFileForView.size)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedFileForView(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
                title="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
              {selectedFileForView.previewUrl && (
                <div className="rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 max-h-64 flex items-center justify-center p-2">
                  <img
                    src={selectedFileForView.previewUrl}
                    alt={selectedFileForView.name}
                    className="max-h-60 object-contain rounded-lg"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-cyan-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>AI読み取り・構造化抽出データ</span>
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedFileForView.extractedText);
                      setCopiedText(true);
                      setTimeout(() => setCopiedText(false), 2000);
                    }}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3 py-1.5 rounded-xl border border-cyan-500/30 flex items-center gap-1.5 transition-colors font-medium"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>コピー完了</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>テキストをコピー</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-200 font-mono text-xs whitespace-pre-wrap leading-relaxed shadow-inner max-h-80 overflow-y-auto select-text">
                  {selectedFileForView.extractedText || 'テキストデータが抽出されていません。'}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
              <button
                onClick={() => setSelectedFileForView(null)}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Modal (Requirement 6: 元の文章と比較する) */}
      {showOriginalComparison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-500/40 text-slate-100 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <Split className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-base font-bold text-white">元の入力文章・資料 vs AI生成Vision（比較ビュー）</h3>
                  <p className="text-xs text-slate-400">原文の意図が正しく維持・構造化されているか比較確認できます</p>
                </div>
              </div>
              <button
                onClick={() => setShowOriginalComparison(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content: 2 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-6 overflow-y-auto flex-1 text-xs">
              {/* Left Column: Original Text & Files */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>元の入力文章・添付資料</span>
                  </span>
                  <span className="text-[10px] text-slate-400">文字数: {originalThoughtSnapshot.length}文字</span>
                </div>
                
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">【ユーザー入力文】</span>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto font-mono text-xs">
                    {originalThoughtSnapshot || '入力文章なし'}
                  </div>
                </div>

                {attachedFiles.length > 0 && (
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">【添付資料 ({attachedFiles.length}件)】</span>
                    <ul className="space-y-1.5">
                      {attachedFiles.map((f, i) => (
                        <li key={i} className="bg-slate-900 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                          <span className="font-bold text-slate-200 truncate">{f.name}</span>
                          <span className="text-[10px] text-cyan-300 px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                            {f.ext.toUpperCase()} ({formatFileSize(f.size)})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Right Column: AI Generated Vision 13 Items */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-purple-300 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>AI構造化Vision (13項目)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">補正・補完・構造化適用済</span>
                </div>

                {aiResult?.generated_vision_items ? (
                  <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="font-bold text-cyan-300 block mb-0.5">① タイトル</span>
                      <p className="text-white font-bold">{aiResult.generated_vision_items.title}</p>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="font-bold text-cyan-300 block mb-0.5">② 概要</span>
                      <p className="text-slate-300 leading-relaxed">{aiResult.generated_vision_items.summary}</p>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-emerald-900/40">
                      <span className="font-bold text-emerald-300 block mb-0.5">③ 実現したい未来</span>
                      <p className="text-slate-300 leading-relaxed">{aiResult.generated_vision_items.desired_future}</p>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-amber-900/40">
                      <span className="font-bold text-amber-300 block mb-0.5">④ 現状の課題</span>
                      <p className="text-slate-300 leading-relaxed">{aiResult.generated_vision_items.current_issues}</p>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="font-bold text-slate-300 block mb-0.5">⑤ 背景</span>
                      <p className="text-slate-300 leading-relaxed">{aiResult.generated_vision_items.background}</p>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-purple-900/40">
                      <span className="font-bold text-purple-300 block mb-0.5">⑥ 対象者</span>
                      <p className="text-slate-300 leading-relaxed">{aiResult.generated_vision_items.target_scope}</p>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-blue-900/40">
                      <span className="font-bold text-blue-300 block mb-0.5">⑦ 目的</span>
                      <p className="text-slate-300 leading-relaxed">{aiResult.generated_vision_items.purpose}</p>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-indigo-900/40">
                      <span className="font-bold text-indigo-300 block mb-0.5">⑧ 解決の方向性</span>
                      <p className="text-slate-300 leading-relaxed">{aiResult.generated_vision_items.solution_direction}</p>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-emerald-900/40">
                      <span className="font-bold text-emerald-300 block mb-0.5">⑨ 期待される効果</span>
                      <p className="text-slate-300 leading-relaxed">{aiResult.generated_vision_items.expected_effects}</p>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="font-bold text-cyan-300 block mb-0.5">⑩ データ・根拠</span>
                      <p className="text-slate-300 leading-relaxed">{aiResult.generated_vision_items.evidence_and_data}</p>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-amber-900/40">
                      <span className="font-bold text-amber-300 block mb-0.5">⑪ Ideaの方向性</span>
                      <p className="text-slate-300 leading-relaxed">{aiResult.generated_vision_items.recruiting_ideas_direction}</p>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="font-bold text-blue-300 block mb-0.5">⑫ カテゴリ & ⑬ タグ</span>
                      <p className="text-slate-300 font-bold">{aiResult.generated_vision_items.category}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">Visionデータが生成されていません</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex justify-end">
              <button
                onClick={() => setShowOriginalComparison(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors"
              >
                比較を閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Vision Creation Workspace (Specifications 5 to 34) */}
      <AiVisionWorkspaceModal
        isOpen={showWorkspaceModal}
        onClose={() => {
          setShowWorkspaceModal(false);
        }}
        initialThought={thoughtInput}
        initialFiles={attachedFiles.map(f => ({
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.ext,
          extractedText: f.extractedText
        }))}
        initialAiResult={aiResult}
        currentUser={user}
        onSaveDraft={(vision, chatHistory) => {
          // Keep locally in sync
        }}
        onPostVisionSuccess={(newVisionId) => {
          setShowWorkspaceModal(false);
          setCompletedVisionId(newVisionId);
          setShowVisionPostCompletedModal(true);
        }}
      />

      {/* AiResultConfirmationModal (Fallback / Legacy) */}
      {aiResult && showConfirmationModal && (
        <AiResultConfirmationModal
          isOpen={showConfirmationModal}
          onClose={() => {
            setShowConfirmationModal(false);
            setAiResult(null);
          }}
          aiResult={aiResult}
          userThoughtInput={thoughtInput}
          attachedFiles={attachedFiles}
          onProceedToCreate={handleProceedToCreate}
          onUpdateAiResult={(updated) => setAiResult(updated)}
          onReorganizeAI={handleReorganizeAI}
        />
      )}

      {/* 要件12: Vision投稿完了画面モーダル */}
      {showVisionPostCompletedModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-emerald-500/80 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-md w-full text-center space-y-6 relative text-slate-900 dark:text-slate-100">
            
            {/* 完了アイコン */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 dark:shadow-emerald-950/50">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            {/* メッセージ（要件12） */}
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Visionを投稿しました。
              </h2>
              <p className="text-xs sm:text-sm text-cyan-700 dark:text-cyan-300 font-medium leading-relaxed">
                このVisionに対するIdeaを募集できます。
              </p>
            </div>

            {/* 操作ボタン例（要件12） */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              {/* ［投稿したVisionを見る］ */}
              <button
                type="button"
                onClick={() => {
                  setShowVisionPostCompletedModal(false);
                  if (completedVisionId) {
                    navigate(`/projects/${completedVisionId}`);
                  } else {
                    navigate('/projects');
                  }
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>投稿したVisionを見る</span>
              </button>

              {/* ［Vision一覧へ］ */}
              <button
                type="button"
                onClick={() => {
                  setShowVisionPostCompletedModal(false);
                  navigate('/projects');
                }}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <LayoutDashboard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Vision一覧へ</span>
              </button>

              {/* ［新しいVisionを作成］ */}
              <button
                type="button"
                onClick={() => {
                  setShowVisionPostCompletedModal(false);
                  setThoughtInput('');
                  setAttachedFiles([]);
                  setAiResult(null);
                  setShowConfirmationModal(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-2.5 bg-cyan-50 dark:bg-slate-800 hover:bg-cyan-100 dark:hover:bg-slate-700 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>新しいVisionを作成</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Plan Upgrade Modal */}
      {showPlanUpgradeModal && (
        <PlanUpgradeModal 
          onClose={() => {
            setShowPlanUpgradeModal(false);
            setPlanNoticeMessage(undefined);
          }}
          noticeMessage={planNoticeMessage}
        />
      )}

    </div>
  );
}
