import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Send, 
  ArrowUp, 
  Plus, 
  Paperclip, 
  FileText, 
  Undo2, 
  History, 
  Check, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  LayoutDashboard, 
  Layers, 
  Tag, 
  Eye, 
  HelpCircle,
  Clock,
  User,
  ArrowRight,
  ChevronRight,
  FolderOpen
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface VisionData {
  title: string;
  summary: string;
  desired_future: string;
  current_issues: string;
  background: string;
  target_scope: string;
  purpose: string;
  solution_direction: string;
  needed_cooperation: string;
  intended_stakeholders: string;
  expected_effects: string;
  evidence_and_data: string;
  recruiting_ideas_direction: string;
  category: string;
  tags: string[];
}

export interface AttachedFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  extractedText?: string;
  content?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modifiedFields?: string[];
  snapshotBefore?: VisionData;
  suggestedQuestions?: string[];
}

export interface HistoryItem {
  id: string;
  version: number;
  timestamp: string;
  authorType: 'ai' | 'user';
  summary: string;
  data: VisionData;
}

interface AiVisionWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialThought: string;
  initialFiles: AttachedFileItem[];
  initialAiResult?: any;
  currentUser?: any;
  onSaveDraft?: (vision: VisionData, chatHistory: ChatMessage[]) => void;
  onPostVisionSuccess?: (createdVisionId: string) => void;
}

const DEFAULT_VISION_DATA: VisionData = {
  title: '',
  summary: '',
  desired_future: '',
  current_issues: '',
  background: '',
  target_scope: '',
  purpose: '',
  solution_direction: '',
  needed_cooperation: '',
  intended_stakeholders: '',
  expected_effects: '',
  evidence_and_data: '',
  recruiting_ideas_direction: '',
  category: '地域活性化・まちづくり',
  tags: ['オープンイノベーション', '共創']
};

export const AiVisionWorkspaceModal: React.FC<AiVisionWorkspaceModalProps> = ({
  isOpen,
  onClose,
  initialThought,
  initialFiles,
  initialAiResult,
  currentUser,
  onSaveDraft,
  onPostVisionSuccess
}) => {
  const navigate = useNavigate();

  // Mobile Tab state ('chat' | 'vision')
  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'vision'>('chat');
  const [hasUnreadVisionUpdates, setHasUnreadVisionUpdates] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Vision Live State
  const [visionData, setVisionData] = useState<VisionData>(DEFAULT_VISION_DATA);
  const [provenanceMap, setProvenanceMap] = useState<Record<string, 'user' | 'ai' | 'file'>>({});

  // Chat & History State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isAiResponding, setIsAiResponding] = useState<boolean>(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>(initialFiles || []);
  
  // Undo & Multi-step History Stack
  const [historyStack, setHistoryStack] = useState<HistoryItem[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState<boolean>(false);

  // Inline Direct Editing State
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // Real-time Visual Highlight State (field keys currently highlighted)
  const [highlightedFields, setHighlightedFields] = useState<Record<string, boolean>>({});

  // Save / Submit State
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isPostingVision, setIsPostingVision] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [showPostSuccessModal, setShowPostSuccessModal] = useState<boolean>(false);
  const [createdVisionId, setCreatedVisionId] = useState<string | null>(null);

  // Refs
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize workspace when opened or initial props change
  useEffect(() => {
    if (!isOpen) return;

    // Load initial data
    let initialVision: VisionData = { ...DEFAULT_VISION_DATA };
    let initialProvenance: Record<string, 'user' | 'ai' | 'file'> = {};

    if (initialAiResult) {
      const generated = initialAiResult.generated_vision_items || {};
      const legacyVision = initialAiResult.vision || {};

      initialVision = {
        title: generated.title || legacyVision.title || (initialThought.slice(0, 30) ? `${initialThought.slice(0, 30)}の実現` : '新規事業構想Vision'),
        summary: generated.summary || initialAiResult.theme || initialThought || '入力内容に基づきVisionを整理しました。',
        desired_future: generated.desired_future || legacyVision.expected_effects || '市民・企業・行政が連携し、テクノロジーで持続可能な環境が定着している未来',
        current_issues: generated.current_issues || legacyVision.social_issues || '既存インフラの老朽化、専門人材不足、現場データの活用遅れ',
        background: generated.background || legacyVision.background || '環境変化の加速とユーザーニーズ多様化に伴う課題',
        target_scope: generated.target_scope || '地域住民、地方自治体、関連共創企業',
        purpose: generated.purpose || legacyVision.purpose || '持続可能な基盤整備とオープンイノベーションによる新規価値創出',
        solution_direction: generated.solution_direction || 'デジタル技術と実証実験を組み合わせた段階的サービス導入',
        needed_cooperation: generated.needed_cooperation || '技術提供企業、フィールド提供自治体、実証参加モニター',
        intended_stakeholders: generated.intended_stakeholders || '自治体、地域事業者、住民コミュニティ',
        expected_effects: generated.expected_effects || legacyVision.expected_effects || 'QoL向上、地域活性化、運用コスト削減',
        evidence_and_data: generated.evidence_and_data || (initialFiles.length > 0 ? `添付資料（${initialFiles.map(f => f.name).join(', ')}）抽出データ` : '現状ヒアリング数値および市場指標'),
        recruiting_ideas_direction: generated.recruiting_ideas_direction || '実証実験アイデア、現場導入技術、地域連携施策、UXデザイン提案',
        category: generated.category || '地域活性化・まちづくり',
        tags: Array.isArray(generated.tags) && generated.tags.length > 0 ? generated.tags : ['オープンイノベーション', '共創']
      };

      initialProvenance = {
        title: 'ai',
        summary: initialThought ? 'user' : 'ai',
        desired_future: 'ai',
        current_issues: initialThought ? 'user' : 'ai',
        background: 'ai',
        target_scope: 'ai',
        purpose: initialThought ? 'user' : 'ai',
        solution_direction: 'ai',
        needed_cooperation: 'ai',
        intended_stakeholders: 'ai',
        expected_effects: 'ai',
        evidence_and_data: initialFiles.length > 0 ? 'file' : 'ai',
        recruiting_ideas_direction: 'ai',
        category: 'ai',
        tags: 'ai'
      };
    } else {
      initialVision.title = initialThought ? `${initialThought.slice(0, 25)}に関するVision` : '新規事業構想Vision';
      initialVision.summary = initialThought || '入力内容に基づきAIがVisionを整理します。';
    }

    setVisionData(initialVision);
    setProvenanceMap(initialProvenance);
    setAttachedFiles(initialFiles || []);

    // Initial History
    const firstHistory: HistoryItem = {
      id: `hist_${Date.now()}_1`,
      version: 1,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      authorType: 'ai',
      summary: '初期VisionのAI整理',
      data: initialVision
    };
    setHistoryStack([firstHistory]);

    // Initial Chat Messages
    const initialMsgs: ChatMessage[] = [];
    if (initialThought || initialFiles.length > 0) {
      initialMsgs.push({
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: initialThought || (initialFiles.length > 0 ? `【資料添付】${initialFiles.map(f => f.name).join(', ')}` : 'Visionの作成をお願いします'),
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      });
    }

    const firstAiQuestion = initialAiResult?.user_questions?.[0] || 'この取り組みは、主に誰を対象としていますか？';
    initialMsgs.push({
      id: `msg_${Date.now()}_ai`,
      role: 'assistant',
      content: `入力いただいた内容をもとに、最初のVision案を右側の投稿内容へ整理しました！\n\nより具体的で魅力的なVisionにするために、会話しながら一緒にブラッシュアップしていきましょう。\n\n**質問**: ${firstAiQuestion}`,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      suggestedQuestions: [
        '地方に住む高齢者です',
        '全国の地域住民と観光客が対象です',
        'タイトルをもっと短くして',
        '目的をもっと具体的にして'
      ]
    });

    setChatMessages(initialMsgs);
    setHasUnsavedChanges(false);
  }, [isOpen]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeMobileTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAiResponding, activeMobileTab]);

  // Auto-save draft to localStorage debounce
  useEffect(() => {
    if (!isOpen || !visionData.title) return;

    const timer = setTimeout(() => {
      try {
        const draftPayload = {
          visionData,
          chatMessages,
          attachedFiles,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem('ehub_vision_workspace_draft', JSON.stringify(draftPayload));
        if (currentUser?.id && onSaveDraft) {
          onSaveDraft(visionData, chatMessages);
        }
      } catch (e) {}
    }, 1200);

    return () => clearTimeout(timer);
  }, [visionData, chatMessages, attachedFiles, isOpen]);

  // Highlight helper: triggers 1.5s visual feedback on fields
  const triggerFieldHighlight = (fieldKeys: string[]) => {
    const newHL: Record<string, boolean> = {};
    fieldKeys.forEach(k => {
      newHL[k] = true;
    });
    setHighlightedFields(prev => ({ ...prev, ...newHL }));

    setTimeout(() => {
      setHighlightedFields(prev => {
        const updated = { ...prev };
        fieldKeys.forEach(k => {
          delete updated[k];
        });
        return updated;
      });
    }, 1800);
  };

  // Push new snapshot to history
  const pushHistory = (newVision: VisionData, authorType: 'ai' | 'user', summary: string) => {
    const nextVer = historyStack.length + 1;
    const newHistItem: HistoryItem = {
      id: `hist_${Date.now()}_${nextVer}`,
      version: nextVer,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      authorType,
      summary,
      data: { ...newVision }
    };
    setHistoryStack(prev => [...prev, newHistItem]);
    setHasUnsavedChanges(true);
  };

  // Rollback to specific history item (Undo functionality)
  const handleRollbackToHistory = (item: HistoryItem) => {
    const previous = { ...item.data };
    setVisionData(previous);
    setShowHistoryDropdown(false);
    
    // Add AI notification in chat
    const rollbackMsg: ChatMessage = {
      id: `msg_${Date.now()}_rollback`,
      role: 'assistant',
      content: `↩ **Version ${item.version}（${item.summary}）** の状態に戻しました。右側の投稿内容も復元されています。`,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, rollbackMsg]);
    triggerFieldHighlight(Object.keys(previous));

    setStatusNotification(`Version ${item.version} に復元しました`);
    setTimeout(() => setStatusNotification(null), 2500);
  };

  // Undo specific AI operation
  const handleUndoSingleAiTurn = (snapshotBefore?: VisionData) => {
    if (!snapshotBefore) return;
    setVisionData({ ...snapshotBefore });
    pushHistory(snapshotBefore, 'user', '直前のAI変更を元に戻す');
    triggerFieldHighlight(Object.keys(snapshotBefore));

    const undoMsg: ChatMessage = {
      id: `msg_${Date.now()}_undo`,
      role: 'assistant',
      content: '↩ 直前のAI変更を元に戻しました。投稿内容が前の状態に復元されています。',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, undoMsg]);
  };

  // Handle Chat Submit
  const handleSendChatMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text && attachedFiles.length === 0) return;
    if (isAiResponding) return;

    setChatInput('');
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto';
    }

    const snapshotBeforeThisTurn = { ...visionData };

    // Append user message
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setIsAiResponding(true);

    try {
      const response = await fetch('/api/ai/vision-workspace-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          currentVision: visionData,
          newInstruction: text,
          attachedFiles
        })
      });

      if (!response.ok) {
        throw new Error('AI response failed');
      }

      const resData = await response.json();
      const updatedVision: VisionData = resData.updatedVision || visionData;
      const modifiedFields: string[] = resData.modifiedFields || [];

      // Update Live Vision state
      setVisionData(updatedVision);

      // Record Provenance
      if (resData.provenanceMap) {
        setProvenanceMap(prev => ({ ...prev, ...resData.provenanceMap }));
      }

      // Visual highlight on updated fields (Specification 9, 10, 17)
      if (modifiedFields.length > 0) {
        triggerFieldHighlight(modifiedFields);
        pushHistory(updatedVision, 'ai', resData.modifiedSummary || 'AIによる対話修正');

        // If user is on mobile chat tab, indicate unread update in vision tab (Specification 22)
        if (activeMobileTab === 'chat') {
          setHasUnreadVisionUpdates(true);
          setUnreadCount(prev => prev + modifiedFields.length);
        }
      }

      // Add AI reply message
      const aiMsg: ChatMessage = {
        id: `msg_${Date.now()}_ai`,
        role: 'assistant',
        content: resData.replyMessage || '変更を反映しました。他に修正したい項目はありますか？',
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        modifiedFields,
        snapshotBefore: snapshotBeforeThisTurn,
        suggestedQuestions: resData.suggestedQuestions || []
      };

      setChatMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.warn('Network or AI service notice, utilizing client-side smart update fallback:', err);
      // Fallback local update
      const textLower = text.toLowerCase();
      const updated = { ...visionData };
      const modifiedFields: string[] = [];

      if (/短|短縮|タイト/.test(textLower) && updated.title) {
        updated.title = updated.title.split('における')[0] || updated.title.slice(0, 22);
        modifiedFields.push('title');
      } else if (/対象|誰|ターゲット/.test(textLower)) {
        updated.target_scope = text.replace(/対象を?|に?変更|して/g, '').trim() || text;
        modifiedFields.push('target_scope');
      } else if (/目的|なぜ/.test(textLower)) {
        updated.purpose = text.replace(/目的を?|に?変更|して/g, '').trim() || text;
        modifiedFields.push('purpose');
      } else if (/課題|問題/.test(textLower)) {
        updated.current_issues = text.replace(/課題を?|に?変更|して/g, '').trim() || text;
        modifiedFields.push('current_issues');
      } else {
        modifiedFields.push('summary');
        updated.summary = (updated.summary || '') + `\n（反映内容: ${text}）`;
      }

      setVisionData(updated);
      triggerFieldHighlight(modifiedFields);
      pushHistory(updated, 'ai', `${modifiedFields.join(', ')}の更新`);

      const fallbackAiMsg: ChatMessage = {
        id: `msg_${Date.now()}_ai_fb`,
        role: 'assistant',
        content: `ご指示いただいた内容を投稿内容（**${modifiedFields.map(m => getFieldLabel(m)).join('・')}**）に反映しました。\n\n他に修正や具体化したい箇所はありますか？`,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        modifiedFields,
        snapshotBefore: snapshotBeforeThisTurn,
        suggestedQuestions: [
          'この取り組みは、主に誰を対象としていますか？',
          'どのようなパートナーからの協力を求めたいですか？'
        ]
      };
      setChatMessages(prev => [...prev, fallbackAiMsg]);
    } finally {
      setIsAiResponding(false);
    }
  };

  // Handle Direct Manual Inline Editing (Specification 12)
  const handleStartEditing = (fieldKey: string, currentValue: string) => {
    setEditingField(fieldKey);
    setEditingValue(currentValue);
  };

  const handleSaveInlineEdit = (fieldKey: string) => {
    if (editingField !== fieldKey) return;
    
    const updated = {
      ...visionData,
      [fieldKey]: editingValue
    };
    setVisionData(updated);
    setProvenanceMap(prev => ({ ...prev, [fieldKey]: 'user' }));
    pushHistory(updated, 'user', `手動編集: ${fieldKey}`);
    setEditingField(null);

    // Notify in chat context
    const editNotice: ChatMessage = {
      id: `msg_${Date.now()}_edit`,
      role: 'assistant',
      content: `ユーザーによる手動編集を反映しました（項目: **${getFieldLabel(fieldKey)}**）。以降の会話もこの最新内容を前提に行います。`,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, editNotice]);
    triggerFieldHighlight([fieldKey]);
  };

  // Handle File Upload inside Workspace (Specification 19)
  const handleFileUploadInsideWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AttachedFileItem[] = [];
    Array.from(files).forEach((f) => {
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      newFiles.push({
        id: fileId,
        name: f.name,
        size: f.size,
        type: f.type,
        extractedText: `【添付資料: ${f.name}】\nファイルサイズ: ${(f.size / 1024).toFixed(1)} KB`
      });
    });

    const combined = [...attachedFiles, ...newFiles];
    setAttachedFiles(combined);

    // Add interactive file notice message from AI
    const fileNotice: ChatMessage = {
      id: `msg_${Date.now()}_file_added`,
      role: 'assistant',
      content: `資料「**${newFiles.map(f => f.name).join(', ')}**」を受け取りました！\n\nこの資料の内容をVisionの該当項目（現状の課題、背景、関連データなど）へ反映しますか？`,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      suggestedQuestions: [
        '資料の内容をVision全体に反映して',
        '資料の数値を「関連データ」に追加して',
        '課題の部分だけ資料に基づいて書き直して'
      ]
    };
    setChatMessages(prev => [...prev, fileNotice]);
  };

  // Save Draft Handler (Specification 26, 29)
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      const draftPayload = {
        visionData,
        chatMessages,
        attachedFiles,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('ehub_vision_workspace_draft', JSON.stringify(draftPayload));
      
      if (currentUser?.id) {
        // Also call server draft endpoint if available
        try {
          await fetch('/api/projects/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.id,
              type: 'vision',
              data: visionData,
              chatMessages
            })
          });
        } catch (e) {}
      }

      setHasUnsavedChanges(false);
      setStatusNotification('下書きとして安全に保存しました（非公開）');
      setTimeout(() => setStatusNotification(null), 3000);
    } catch (e) {
      console.error(e);
      setStatusNotification('下書き保存に失敗しました');
      setTimeout(() => setStatusNotification(null), 3000);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Post Vision Handler (Specification 26, 27, 34)
  const handlePostVision = async () => {
    if (!visionData.title.trim()) {
      alert('Visionタイトルを入力してください。');
      return;
    }

    if (!currentUser) {
      // Must prompt sign-in, preserving all draft data
      alert('Visionを投稿するにはサインインが必要です。下書きとチャット履歴は安全に保持されています。');
      navigate('/login?redirect=vision-workspace');
      return;
    }

    setIsPostingVision(true);
    try {
      // Assemble full structured description
      const fullStructuredDescription = [
        visionData.summary,
        `\n\n### 実現したい未来\n${visionData.desired_future}`,
        `\n\n### 現状の課題\n${visionData.current_issues}`,
        `\n\n### 背景\n${visionData.background}`,
        `\n\n### 対象\n${visionData.target_scope}`,
        `\n\n### 目的\n${visionData.purpose}`,
        `\n\n### 実現の方向性\n${visionData.solution_direction}`,
        `\n\n### 必要だと考えている協力\n${visionData.needed_cooperation}`,
        `\n\n### 想定している関係者\n${visionData.intended_stakeholders}`,
        `\n\n### 期待される効果\n${visionData.expected_effects}`,
        `\n\n### 関連するデータ・根拠\n${visionData.evidence_and_data}`,
        `\n\n### 募集したいIdeaの方向性\n${visionData.recruiting_ideas_direction}`
      ].join('');

      const postPayload = {
        title: visionData.title,
        description: fullStructuredDescription,
        category: visionData.category || '地域活性化・まちづくり',
        tags: Array.isArray(visionData.tags) ? JSON.stringify(visionData.tags) : (visionData.tags || JSON.stringify(['オープンイノベーション', '共創'])),
        author_id: currentUser.id,
        user_id: currentUser.id,
        userId: currentUser.id,
        author_name: currentUser.name || currentUser.organizationName || '匿名ユーザー',
        post_type: 'vision',
        status: 'open',
        image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=1200',
        metadata: {
          aiGenerated: true,
          visionData,
          attachedFiles
        }
      };

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.error('Error posting vision response:', res.status, errJson);
        throw new Error(errJson.error || 'Failed to post vision');
      }

      const result = await res.json();
      const newId = result.id || result.projectId || 'latest';
      setCreatedVisionId(String(newId));

      // Clear draft upon successful post
      localStorage.removeItem('ehub_vision_workspace_draft');
      setHasUnsavedChanges(false);

      if (onPostVisionSuccess) {
        onPostVisionSuccess(String(newId));
      }
      setShowPostSuccessModal(true);
    } catch (err: any) {
      console.error(err);
      alert('Visionの投稿に失敗しました。もう一度お試しください。');
    } finally {
      setIsPostingVision(false);
    }
  };

  // Close Guard Handler (Specification 28)
  const handleAttemptClose = () => {
    if (hasUnsavedChanges) {
      setShowLeaveConfirmModal(true);
    } else {
      onClose();
    }
  };

  const getFieldLabel = (key: string): string => {
    const map: Record<string, string> = {
      title: 'Visionタイトル',
      summary: '概要',
      desired_future: '実現したい未来',
      current_issues: '現状の課題',
      background: '背景',
      target_scope: '対象',
      purpose: '目的',
      solution_direction: '実現の方向性',
      needed_cooperation: '必要だと考えている協力',
      intended_stakeholders: '想定している関係者',
      expected_effects: '期待される効果',
      evidence_and_data: '関連するデータ・根拠',
      recruiting_ideas_direction: '募集したいIdeaの方向性',
      category: 'カテゴリ',
      tags: '関連タグ'
    };
    return map[key] || key;
  };

  const renderProvenanceBadge = (fieldKey: string) => {
    const prov = provenanceMap[fieldKey] || 'ai';
    if (prov === 'user') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
          <User className="w-2.5 h-2.5" />
          <span>ユーザー入力</span>
        </span>
      );
    }
    if (prov === 'file') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
          <Paperclip className="w-2.5 h-2.5" />
          <span>添付資料</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
        <Sparkles className="w-2.5 h-2.5 text-amber-500" />
        <span>AI補完</span>
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-sm flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUploadInsideWorkspace}
        className="hidden"
      />

      {/* TOP HEADER (Specification 30, 31, 32) */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-cyan-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-cyan-300 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>AI Vision ワークスペース</span>
          </span>

          {statusNotification && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
              {statusNotification}
            </span>
          )}
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2">
          {/* History Dropdown Trigger (Specification 15) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="変更履歴・元に戻す"
            >
              <History className="w-3.5 h-3.5 text-indigo-600 dark:text-cyan-400" />
              <span>履歴 (v{historyStack.length})</span>
            </button>

            {/* History Menu */}
            {showHistoryDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-50 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white">変更履歴 (Undo/Rollback)</span>
                  <span className="text-[10px] text-slate-400">クリックで復元</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {historyStack.slice().reverse().map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleRollbackToHistory(item)}
                      className="w-full text-left p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800 border border-transparent hover:border-indigo-200 dark:hover:border-slate-700 transition-all flex flex-col gap-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-700 dark:text-cyan-300">
                          v{item.version} {item.authorType === 'ai' ? 'AI変更' : '手動編集'}
                        </span>
                        <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                        {item.summary}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Close Button (Specification 28) */}
          <button
            type="button"
            onClick={handleAttemptClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="ワークスペースを閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* MOBILE SEGMENTED TAB BAR (Specification 20, 22) */}
      <div className="md:hidden bg-slate-100 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
        <div className="bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 flex w-full max-w-sm shadow-sm">
          <button
            type="button"
            onClick={() => setActiveMobileTab('chat')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMobileTab === 'chat'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>チャット</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMobileTab('vision');
              setHasUnreadVisionUpdates(false);
              setUnreadCount(0);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 relative cursor-pointer ${
              activeMobileTab === 'vision'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>投稿内容</span>
            {hasUnreadVisionUpdates && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE BODY (Specification 6, 25, 31, 32) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden bg-slate-50 dark:bg-slate-950">
        
        {/* LEFT COLUMN: AI CHAT (42% on desktop, tab on mobile) */}
        <div
          className={`md:col-span-5 lg:col-span-5 h-full flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden ${
            activeMobileTab === 'chat' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Chat Messages Scroll Container */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
            
            {/* Context Info Banner */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-cyan-300">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>AI Vision 共創セッション</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                AIとのチャット内容は右側のVision投稿内容へリアルタイムに差分反映されます。指示や回答を入力してください。
              </p>
            </div>

            {/* Attached files chips inside chat header */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-bold">参照資料:</span>
                {attachedFiles.map((file) => (
                  <span
                    key={file.id}
                    className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    {file.name}
                  </span>
                ))}
              </div>
            )}

            {/* Message Bubble List */}
            {chatMessages.map((msg) => {
              const isAi = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAi ? 'items-start' : 'items-end'} space-y-1.5`}
                >
                  <div className="flex items-center gap-1.5 px-1 text-[10px] text-slate-400">
                    <span>{isAi ? 'AIアシスタント' : 'あなた'}</span>
                    <span>・</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[88%] sm:max-w-[85%] rounded-3xl p-4 text-xs sm:text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                      isAi
                        ? 'bg-slate-50 dark:bg-slate-800/95 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Undo Button on AI messages (Specification 14) */}
                  {isAi && msg.snapshotBefore && (
                    <button
                      type="button"
                      onClick={() => handleUndoSingleAiTurn(msg.snapshotBefore)}
                      className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-300 flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Undo2 className="w-3 h-3" />
                      <span>この変更を元に戻す</span>
                    </button>
                  )}

                  {/* Suggested Question Chips (Specification 8) */}
                  {isAi && msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5 max-w-[90%]">
                      {msg.suggestedQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendChatMessage(q)}
                          className="text-[11px] font-medium text-indigo-700 dark:text-cyan-300 bg-indigo-50/80 dark:bg-slate-800/90 hover:bg-indigo-100 dark:hover:bg-slate-700 border border-indigo-200 dark:border-slate-700 rounded-full px-3 py-1 transition-all text-left shadow-xs cursor-pointer"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isAiResponding && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-cyan-400 p-3 bg-indigo-50/50 dark:bg-slate-800/50 rounded-2xl border border-indigo-100 dark:border-slate-800 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>AIがVisionをブラッシュアップ中...</span>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* CHAT INPUT FIXED FOOTER (Specification 2, 3, 4, 19, 23) */}
          <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700/80 focus-within:border-cyan-500 dark:focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20 rounded-2xl p-2.5 transition-all shadow-inner space-y-2"
            >
              {/* Textarea (Enter creates new line, send only via submit button) */}
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  if (chatInputRef.current) {
                    chatInputRef.current.style.height = 'auto';
                    chatInputRef.current.style.height = `${Math.min(160, chatInputRef.current.scrollHeight)}px`;
                  }
                }}
                placeholder="AIに修正指示や質問への回答を入力（例: 対象を高専生と若手研究者に変更して）"
                className="w-full bg-transparent border-0 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 resize-none min-h-[50px] max-h-[160px] leading-relaxed"
              />

              {/* Bottom control bar inside input */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-800/80">
                {/* Left [+] File Attach */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                  title="追加資料を添付"
                >
                  <Plus className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>

                <div className="flex items-center gap-2">
                  {/* Right [↑] Send Button */}
                  <button
                    type="submit"
                    disabled={isAiResponding || (!chatInput.trim() && attachedFiles.length === 0)}
                    className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-sm flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                    title="送信"
                  >
                    {isAiResponding ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <ArrowUp className="w-4 h-4 text-white stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: VISION LIVE POST CONTENT & INLINE EDITING (58% on desktop, tab on mobile) */}
        <div
          className={`md:col-span-7 lg:col-span-7 h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden ${
            activeMobileTab === 'vision' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Top Preview Status Bar */}
          <div className="bg-white dark:bg-slate-900 px-4 sm:px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />
                <span>Vision投稿プレビュー</span>
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>リアルタイム同期中</span>
              </span>
            </div>

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              項目クリックで直接編集可能
            </span>
          </div>

          {/* Scrollable Vision Fields Container (Specification 11, 12, 18, 30) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">

            {/* FIELD: Visionタイトル */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border transition-all duration-300 ${
                highlightedFields.title
                  ? 'border-l-4 border-l-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/20 border-cyan-300 dark:border-cyan-700'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-slate-200">Visionタイトル</span>
                  {renderProvenanceBadge('title')}
                  {highlightedFields.title && (
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-300 animate-pulse">
                      AI更新
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleStartEditing('title', visionData.title)}
                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-300 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="直接編集"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="pt-2">
                {editingField === 'title' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="w-full text-base sm:text-lg font-bold bg-slate-50 dark:bg-slate-800 border border-cyan-500 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingField(null)}
                        className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveInlineEdit('title')}
                        className="px-3 py-1 text-xs bg-indigo-600 text-white font-bold rounded-lg"
                      >
                        確定
                      </button>
                    </div>
                  </div>
                ) : (
                  <h3
                    onClick={() => handleStartEditing('title', visionData.title)}
                    className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 transition-colors leading-snug"
                  >
                    {visionData.title || '（タイトルが未設定です）'}
                  </h3>
                )}
              </div>
            </div>

            {/* FIELD: 概要 */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border transition-all duration-300 ${
                highlightedFields.summary
                  ? 'border-l-4 border-l-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/20 border-cyan-300'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-slate-200">概要</span>
                  {renderProvenanceBadge('summary')}
                  {highlightedFields.summary && (
                    <span className="text-[10px] font-bold text-cyan-600 animate-pulse">AI更新</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleStartEditing('summary', visionData.summary)}
                  className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="pt-2">
                {editingField === 'summary' ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      rows={3}
                      className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-cyan-500 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingField(null)}
                        className="px-3 py-1 text-xs text-slate-500"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveInlineEdit('summary')}
                        className="px-3 py-1 text-xs bg-indigo-600 text-white font-bold rounded-lg"
                      >
                        確定
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    onClick={() => handleStartEditing('summary', visionData.summary)}
                    className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed cursor-pointer hover:bg-slate-50/50 rounded-lg p-1"
                  >
                    {visionData.summary || '（概要が未設定です）'}
                  </p>
                )}
              </div>
            </div>

            {/* 2-Column Grid for Structured Vision Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* 実現したい未来 */}
              <div
                className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all duration-300 ${
                  highlightedFields.desired_future
                    ? 'border-l-4 border-l-cyan-500 bg-cyan-50/40 border-cyan-300'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-indigo-700 dark:text-cyan-300">実現したい未来</span>
                    {renderProvenanceBadge('desired_future')}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStartEditing('desired_future', visionData.desired_future)}
                    className="text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
                <div className="pt-2">
                  {editingField === 'desired_future' ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        rows={3}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-cyan-500 rounded-xl p-2 text-slate-900 dark:text-white"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setEditingField(null)} className="px-2 py-0.5 text-xs text-slate-500">取消</button>
                        <button type="button" onClick={() => handleSaveInlineEdit('desired_future')} className="px-2.5 py-0.5 text-xs bg-indigo-600 text-white font-bold rounded-lg">確定</button>
                      </div>
                    </div>
                  ) : (
                    <p onClick={() => handleStartEditing('desired_future', visionData.desired_future)} className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed">
                      {visionData.desired_future}
                    </p>
                  )}
                </div>
              </div>

              {/* 現状の課題 */}
              <div
                className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all duration-300 ${
                  highlightedFields.current_issues
                    ? 'border-l-4 border-l-cyan-500 bg-cyan-50/40 border-cyan-300'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">現状の課題</span>
                    {renderProvenanceBadge('current_issues')}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStartEditing('current_issues', visionData.current_issues)}
                    className="text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
                <div className="pt-2">
                  {editingField === 'current_issues' ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        rows={3}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-cyan-500 rounded-xl p-2 text-slate-900 dark:text-white"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setEditingField(null)} className="px-2 py-0.5 text-xs text-slate-500">取消</button>
                        <button type="button" onClick={() => handleSaveInlineEdit('current_issues')} className="px-2.5 py-0.5 text-xs bg-indigo-600 text-white font-bold rounded-lg">確定</button>
                      </div>
                    </div>
                  ) : (
                    <p onClick={() => handleStartEditing('current_issues', visionData.current_issues)} className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed">
                      {visionData.current_issues}
                    </p>
                  )}
                </div>
              </div>

              {/* 背景 */}
              <div className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all ${highlightedFields.background ? 'border-l-4 border-l-cyan-500 bg-cyan-50/40 border-cyan-300' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">背景</span>
                    {renderProvenanceBadge('background')}
                  </div>
                  <button type="button" onClick={() => handleStartEditing('background', visionData.background)} className="text-slate-400 hover:text-indigo-600 p-0.5">
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
                <div className="pt-2">
                  {editingField === 'background' ? (
                    <div className="space-y-2">
                      <textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} rows={3} className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-cyan-500 rounded-xl p-2 text-slate-900 dark:text-white" />
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setEditingField(null)} className="px-2 py-0.5 text-xs text-slate-500">取消</button>
                        <button type="button" onClick={() => handleSaveInlineEdit('background')} className="px-2.5 py-0.5 text-xs bg-indigo-600 text-white font-bold rounded-lg">確定</button>
                      </div>
                    </div>
                  ) : (
                    <p onClick={() => handleStartEditing('background', visionData.background)} className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed">
                      {visionData.background}
                    </p>
                  )}
                </div>
              </div>

              {/* 対象 */}
              <div className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all ${highlightedFields.target_scope ? 'border-l-4 border-l-cyan-500 bg-cyan-50/40 border-cyan-300' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">対象（ターゲット）</span>
                    {renderProvenanceBadge('target_scope')}
                  </div>
                  <button type="button" onClick={() => handleStartEditing('target_scope', visionData.target_scope)} className="text-slate-400 hover:text-indigo-600 p-0.5">
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
                <div className="pt-2">
                  {editingField === 'target_scope' ? (
                    <div className="space-y-2">
                      <textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} rows={2} className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-cyan-500 rounded-xl p-2 text-slate-900 dark:text-white" />
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setEditingField(null)} className="px-2 py-0.5 text-xs text-slate-500">取消</button>
                        <button type="button" onClick={() => handleSaveInlineEdit('target_scope')} className="px-2.5 py-0.5 text-xs bg-indigo-600 text-white font-bold rounded-lg">確定</button>
                      </div>
                    </div>
                  ) : (
                    <p onClick={() => handleStartEditing('target_scope', visionData.target_scope)} className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed">
                      {visionData.target_scope}
                    </p>
                  )}
                </div>
              </div>

              {/* 目的 */}
              <div className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all ${highlightedFields.purpose ? 'border-l-4 border-l-cyan-500 bg-cyan-50/40 border-cyan-300' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">目的</span>
                    {renderProvenanceBadge('purpose')}
                  </div>
                  <button type="button" onClick={() => handleStartEditing('purpose', visionData.purpose)} className="text-slate-400 hover:text-indigo-600 p-0.5">
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
                <div className="pt-2">
                  {editingField === 'purpose' ? (
                    <div className="space-y-2">
                      <textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} rows={2} className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-cyan-500 rounded-xl p-2 text-slate-900 dark:text-white" />
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setEditingField(null)} className="px-2 py-0.5 text-xs text-slate-500">取消</button>
                        <button type="button" onClick={() => handleSaveInlineEdit('purpose')} className="px-2.5 py-0.5 text-xs bg-indigo-600 text-white font-bold rounded-lg">確定</button>
                      </div>
                    </div>
                  ) : (
                    <p onClick={() => handleStartEditing('purpose', visionData.purpose)} className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed">
                      {visionData.purpose}
                    </p>
                  )}
                </div>
              </div>

              {/* 実現の方向性 */}
              <div className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all ${highlightedFields.solution_direction ? 'border-l-4 border-l-cyan-500 bg-cyan-50/40 border-cyan-300' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">実現の方向性</span>
                    {renderProvenanceBadge('solution_direction')}
                  </div>
                  <button type="button" onClick={() => handleStartEditing('solution_direction', visionData.solution_direction)} className="text-slate-400 hover:text-indigo-600 p-0.5">
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
                <div className="pt-2">
                  {editingField === 'solution_direction' ? (
                    <div className="space-y-2">
                      <textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} rows={3} className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-cyan-500 rounded-xl p-2 text-slate-900 dark:text-white" />
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setEditingField(null)} className="px-2 py-0.5 text-xs text-slate-500">取消</button>
                        <button type="button" onClick={() => handleSaveInlineEdit('solution_direction')} className="px-2.5 py-0.5 text-xs bg-indigo-600 text-white font-bold rounded-lg">確定</button>
                      </div>
                    </div>
                  ) : (
                    <p onClick={() => handleStartEditing('solution_direction', visionData.solution_direction)} className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed">
                      {visionData.solution_direction}
                    </p>
                  )}
                </div>
              </div>

            </div>

            {/* Additional Structured Vision Details */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block pb-1 border-b border-slate-100 dark:border-slate-800">
                協力・関係者・募集要項
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">必要だと考えている協力:</span>
                  <p className="text-slate-800 dark:text-slate-200 pt-0.5 leading-relaxed">{visionData.needed_cooperation}</p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">想定している関係者:</span>
                  <p className="text-slate-800 dark:text-slate-200 pt-0.5 leading-relaxed">{visionData.intended_stakeholders}</p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">期待される効果:</span>
                  <p className="text-slate-800 dark:text-slate-200 pt-0.5 leading-relaxed">{visionData.expected_effects}</p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">募集したいIdeaの方向性:</span>
                  <p className="text-slate-800 dark:text-slate-200 pt-0.5 leading-relaxed">{visionData.recruiting_ideas_direction}</p>
                </div>
              </div>

              {/* Tags and Category */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                  カテゴリ: {visionData.category}
                </span>
                {visionData.tags.map((t, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-[11px] font-medium">
                    #{t}
                  </span>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN BOTTOM ACTION BAR (Specification 26, 27, 31, 32) */}
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-lg">
            
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 order-2 sm:order-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>投稿先: Vision（共創アイデアの募集）</span>
            </div>

            {/* Actions: Save Draft & Post Vision */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto order-1 sm:order-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft || isPostingVision}
                className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
              >
                {isSavingDraft ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                <span>下書きとして保存</span>
              </button>

              <button
                type="button"
                onClick={handlePostVision}
                disabled={isPostingVision || isSavingDraft}
                className="flex-1 sm:flex-none px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isPostingVision ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>投稿中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Visionとして投稿</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* LEAVE CONFIRMATION MODAL (Specification 28) */}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 z-[700] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-base">
              <AlertCircle className="w-5 h-5" />
              <span>変更内容が保存されていません</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              作業中のVision内容やチャット履歴を下書き保存して終了しますか？
            </p>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  await handleSaveDraft();
                  setShowLeaveConfirmModal(false);
                  onClose();
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>下書きとして保存して閉じる</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveConfirmModal(false);
                  onClose();
                }}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <span>保存せず閉じる</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveConfirmModal(false)}
                className="w-full py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
              >
                <span>キャンセル</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST SUCCESS MODAL */}
      {showPostSuccessModal && (
        <div className="fixed inset-0 z-[700] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-emerald-500 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5 text-slate-900 dark:text-slate-100">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-300 dark:border-emerald-500/40">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Visionを投稿しました
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                AIと作成したVisionが公開されました。このVisionに対するIdeaを募集できます。
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPostSuccessModal(false);
                  onClose();
                  if (createdVisionId) {
                    navigate(`/projects/${createdVisionId}`);
                  } else {
                    navigate('/projects');
                  }
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>投稿したVisionを見る</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPostSuccessModal(false);
                  onClose();
                  navigate('/projects');
                }}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <span>Vision一覧へ</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
