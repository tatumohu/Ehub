// Requirement 24: 認証状態保持・安全な投稿一時保存領域 (sessionStorage & localStorage活用)

export interface PendingPostData {
  userThoughtInput?: string;
  selectedPostTarget: 'Vision' | 'Recruitment' | 'Offer';
  editableResult: any;
  attachedFiles: Array<{ id: string; name: string; size: number; type: string; url?: string; extractedText?: string }>;
  adoptedCompletions?: Record<number, boolean>;
  selectedOrgId?: string | null;
  orgList?: any[];
  offerType?: 'public' | 'nominated';
  offerDetailsState?: {
    target_organization?: string;
    outsource_scope?: string;
    budget_and_terms?: string;
    deliverables?: string;
  };
  finalAgreed?: boolean;
  createdAt: number;
  expiresAt: number; // 有効期限（ミリ秒）
  submissionToken: string; // 二重投稿防止用トークン
  isSubmitted?: boolean;
  created_account_type?: string;
  created_account_id?: string;
}

const STORAGE_KEY = 'ehub_pending_post_secure_session_v1';
const SUBMITTED_TOKENS_KEY = 'ehub_submitted_tokens_v1';
const EXPIRATION_TIME_MS = 60 * 60 * 1000; // 60分間の有効期限

/**
 * 投稿データを安全に一時保存（URLには含めず、セッション領域・ローカル領域に保存）
 */
export function savePendingPostData(data: Omit<PendingPostData, 'createdAt' | 'expiresAt' | 'submissionToken'>): PendingPostData {
  const now = Date.now();
  const submissionToken = `token_${now}_${Math.random().toString(36).substring(2, 9)}`;
  const fullData: PendingPostData = {
    ...data,
    createdAt: now,
    expiresAt: now + EXPIRATION_TIME_MS,
    submissionToken,
    isSubmitted: false
  };

  const jsonStr = JSON.stringify(fullData);

  try {
    sessionStorage.setItem(STORAGE_KEY, jsonStr);
  } catch (err) {
    console.warn('Failed to save pending post data to sessionStorage:', err);
  }

  try {
    localStorage.setItem(STORAGE_KEY, jsonStr);
  } catch (err) {
    console.warn('Failed to save pending post data to localStorage:', err);
  }

  return fullData;
}

/**
 * 有効期限内の未提出一時保存データを取得
 */
export function getPendingPostData(): PendingPostData | null {
  try {
    let raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(STORAGE_KEY);
    }
    if (!raw) return null;

    const parsed: PendingPostData = JSON.parse(raw);
    const now = Date.now();

    // 有効期限切れチェック
    if (parsed.expiresAt < now) {
      clearPendingPostData();
      return null;
    }

    // すでに送信済みチェック
    if (parsed.isSubmitted) {
      return null;
    }

    return parsed;
  } catch (err) {
    console.error('Error reading pending post data:', err);
    clearPendingPostData();
    return null;
  }
}

/**
 * 一時保存データの削除（投稿完了時・キャンセル時）
 */
export function clearPendingPostData(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {}
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {}
}

/**
 * 二重投稿防止チェック
 * @returns true: 送信許可, false: 二重送信検出につきブロック
 */
export function markTokenAsSubmitted(token: string): boolean {
  try {
    const raw = sessionStorage.getItem(SUBMITTED_TOKENS_KEY) || localStorage.getItem(SUBMITTED_TOKENS_KEY);
    const tokens: string[] = raw ? JSON.parse(raw) : [];

    if (tokens.includes(token)) {
      return false; // 二重送信防止
    }

    tokens.push(token);
    const updatedTokensJson = JSON.stringify(tokens.slice(-50)); // 最新50件のみ保持
    try { sessionStorage.setItem(SUBMITTED_TOKENS_KEY, updatedTokensJson); } catch (e) {}
    try { localStorage.setItem(SUBMITTED_TOKENS_KEY, updatedTokensJson); } catch (e) {}

    // 一時データも送信済みにフラグ付け
    const pending = getPendingPostData();
    if (pending && pending.submissionToken === token) {
      pending.isSubmitted = true;
      const updatedPendingJson = JSON.stringify(pending);
      try { sessionStorage.setItem(STORAGE_KEY, updatedPendingJson); } catch (e) {}
      try { localStorage.setItem(STORAGE_KEY, updatedPendingJson); } catch (e) {}
    }

    return true;
  } catch (err) {
    console.warn('Error verifying submission token:', err);
    return true;
  }
}

