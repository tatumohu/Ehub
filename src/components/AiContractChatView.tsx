import React from 'react';
import { Bot, Sparkles, History, Edit3, Bookmark, X, Check, UserCheck, RefreshCw, Send } from 'lucide-react';

interface AiContractChatViewProps {
  aiSubTab: 'chat' | 'preview';
  setAiSubTab: (tab: 'chat' | 'preview') => void;
  aiLimitInfo: any;
  handleSwitchPlan: (plan: string) => void;
  chatMessages: Array<{ id: string; sender: 'user' | 'assistant'; text: string; timestamp: string }>;
  isAiProcessing: boolean;
  chatBottomRef: React.RefObject<HTMLDivElement | null>;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  handleSendChatMessage: (text?: string) => void;
  aiGeneratedTitle: string;
  aiGeneratedBody: string;
  editableAiTitle: string;
  setEditableAiTitle: (title: string) => void;
  editableAiBody: string;
  setEditableAiBody: (body: string) => void;
  previousAiBody: string;
  isDiffView: boolean;
  setIsDiffView: (val: boolean) => void;
  isEditingGenerated: boolean;
  setIsEditingGenerated: (val: boolean) => void;
  lineDiffs: Array<{ type: 'added' | 'removed' | 'unchanged'; text: string }>;
  templateSaveSuccess: boolean;
  handleSaveAsTemplate: () => void;
  handleDiscard: () => void;
  handleApplyContract: (title: string, body: string, templateId?: number) => void;
  isSavingTemplate: boolean;
}

export function AiContractChatView({
  aiSubTab,
  setAiSubTab,
  aiLimitInfo,
  handleSwitchPlan,
  chatMessages,
  isAiProcessing,
  chatBottomRef,
  chatInputRef,
  inputMessage,
  setInputMessage,
  handleSendChatMessage,
  aiGeneratedTitle,
  aiGeneratedBody,
  editableAiTitle,
  setEditableAiTitle,
  editableAiBody,
  setEditableAiBody,
  previousAiBody,
  isDiffView,
  setIsDiffView,
  isEditingGenerated,
  setIsEditingGenerated,
  lineDiffs,
  templateSaveSuccess,
  handleSaveAsTemplate,
  handleDiscard,
  handleApplyContract,
  isSavingTemplate
}: AiContractChatViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sub-Tab Navigation for Switching Between Chat and AI Generated Preview */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAiSubTab('chat')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              aiSubTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            対話チャットモード (Chat)
          </button>
          <button
            type="button"
            onClick={() => setAiSubTab('preview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              aiSubTab === 'preview'
                ? 'bg-amber-500 dark:bg-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-600/30'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-900 dark:text-amber-300" />
            AI生成結果・全文プレビュー (Preview)
          </button>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {aiSubTab === 'chat' ? 'チャットを広く表示して対話・指示を行えます' : '生成された全文の確認、差分比較、編集が可能です'}
        </span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col pt-3">
        {aiSubTab === 'chat' ? (
          <div className="flex flex-col bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden h-full flex-1">
            {/* Chat Top Banner */}
            <div className="px-3 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 shrink-0">
              <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-300">
                <Bot className="w-4 h-4 text-amber-500 dark:text-amber-300 shrink-0" />
                <span>対話型AI法務コンサルタント</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                  aiLimitInfo?.plan === 'light'
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    : aiLimitInfo?.plan === 'enterprise'
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                    : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30'
                }`}>
                  {aiLimitInfo?.plan_label || (aiLimitInfo?.plan === 'light' ? 'Lightプラン' : aiLimitInfo?.plan === 'enterprise' ? 'Enterprise' : 'Standard')}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">
                  AI自動生成: <strong className={aiLimitInfo?.plan === 'light' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                    {aiLimitInfo?.plan === 'light'
                      ? '× (利用不可)'
                      : aiLimitInfo?.plan === 'enterprise'
                      ? '無制限'
                      : `月1回 (${aiLimitInfo?.used_count || 0}/1回使用済)`}
                  </strong>
                </span>

                {/* Plan Switcher Pills */}
                <div className="flex items-center gap-1 text-[10px] pl-2 border-l border-slate-300 dark:border-slate-800">
                  <span className="text-slate-500 text-[9px]">切替:</span>
                  <button
                    type="button"
                    onClick={() => handleSwitchPlan('light')}
                    className={`px-1.5 py-0.5 rounded transition-all border ${
                      aiLimitInfo?.plan === 'light'
                        ? 'bg-rose-100 dark:bg-rose-500/30 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-500/50 font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Lightプラン: 直接入力○ / 保存文章○ / AI自動生成×"
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchPlan('standard')}
                    className={`px-1.5 py-0.5 rounded transition-all border ${
                      aiLimitInfo?.plan === 'standard' || (!aiLimitInfo?.plan && aiLimitInfo?.max_limit === 1)
                        ? 'bg-indigo-100 dark:bg-indigo-500/30 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-500/50 font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Standardプラン: 直接入力○ / 保存文章○ / AI自動生成 月1回"
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchPlan('enterprise')}
                    className={`px-1.5 py-0.5 rounded transition-all border ${
                      aiLimitInfo?.plan === 'enterprise'
                        ? 'bg-amber-100 dark:bg-amber-500/30 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-500/50 font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Enterpriseプラン: 直接入力○ / 保存文章○ / AI自動生成 無制限"
                  >
                    Enterprise
                  </button>
                </div>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div className="p-4 flex-1 min-h-[380px] lg:min-h-[460px] overflow-y-auto space-y-3 font-sans text-xs">
              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl p-3 leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none font-mono text-[11px] shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                  {msg.sender === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              {isAiProcessing && (
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 text-xs py-2 px-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900/50 w-fit">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>法務AIが条文および回答を分析生成中...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Preset Prompt Buttons */}
            <div className="px-3 py-2 bg-slate-100/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5 text-[10px] shrink-0">
              <span className="text-slate-500 dark:text-slate-400 font-bold self-center">入力例・クイック指示:</span>
              <button
                onClick={() => handleSendChatMessage('3か月間のWebアプリ開発について、個人エンジニアへ業務を委託する契約書を作成したいです。成果物の知的財産権は発注側へ譲渡し、報酬は月額30万円を想定しています。')}
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-500/30 font-bold"
              >
                例: 3ヶ月開発・月額30万・権利譲渡
              </button>
              <button
                onClick={() => handleSendChatMessage('秘密保持期間を5年間に変更してください。')}
                className="px-2 py-1 bg-white hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700"
              >
                例: 秘密保持期間を5年に変更
              </button>
              <button
                onClick={() => handleSendChatMessage('成果物の権利は個人側に残し、発注側には利用許諾を与える内容へ変更してください。')}
                className="px-2 py-1 bg-white hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700"
              >
                例: 権利は個人保持・利用許諾
              </button>
              <button
                onClick={() => handleSendChatMessage('損害賠償の上限を「直近1ヶ月分の委託料相当額」に制限する条項を入れてください')}
                className="px-2 py-1 bg-white hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700"
              >
                例: 損害賠償額の上限制限
              </button>
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2 shrink-0">
              <input
                ref={chatInputRef}
                type="text"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChatMessage()}
                placeholder="例: 秘密保持期間を5年間に変更してください..."
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleSendChatMessage()}
                disabled={!inputMessage.trim() || isAiProcessing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                送信
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden h-full flex-1">
            <div className="p-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <span className="font-bold text-xs text-amber-600 dark:text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                AI生成結果（リアルタイム最新全文）
              </span>

              {/* Diff toggle button if previous version exists */}
              {previousAiBody && (
                <button
                  onClick={() => setIsDiffView(!isDiffView)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all border flex items-center gap-1 ${
                    isDiffView
                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  {isDiffView ? '全文表示に戻す' : '差分表示（前版比較）'}
                </button>
              )}
            </div>

            <div className="p-3 flex-1 overflow-y-auto space-y-3">
              {/* Title Box */}
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
                <div className="flex-1">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">契約書タイトル:</span>
                  {isEditingGenerated ? (
                    <input
                      type="text"
                      value={editableAiTitle}
                      onChange={e => setEditableAiTitle(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded px-2 py-1 text-xs mt-1"
                    />
                  ) : (
                    <strong className="text-slate-900 dark:text-white">{editableAiTitle || aiGeneratedTitle}</strong>
                  )}
                </div>
              </div>

              {/* Notification for Template Save Success */}
              {templateSaveSuccess && (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  社内契約テンプレートとして正常に保存されました！
                </div>
              )}

              {/* Body Container */}
              {isEditingGenerated ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-300 font-bold">
                    <span className="flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" />
                      手動直接編集モード
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">文字数: {editableAiBody.length}</span>
                  </div>
                  <textarea
                    value={editableAiBody}
                    onChange={e => setEditableAiBody(e.target.value)}
                    rows={14}
                    className="w-full bg-white dark:bg-slate-900 border border-amber-500/40 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-slate-100 leading-relaxed focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>
              ) : isDiffView && lineDiffs.length > 0 ? (
                <div className="bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-[11px] leading-relaxed max-h-[360px] overflow-y-auto space-y-0.5 select-all">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1 mb-2 font-sans flex items-center justify-between">
                    <span>差分表示 (<span className="text-emerald-600 dark:text-emerald-400 font-bold">+ 追加行</span> / <span className="text-rose-600 dark:text-rose-400 font-bold">- 削除行</span>)</span>
                    <span>変更前版 ➡ 最新版</span>
                  </div>
                  {lineDiffs.map((diff, idx) => (
                    <div
                      key={idx}
                      className={`px-1.5 py-0.5 rounded ${
                        diff.type === 'added'
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-l-2 border-emerald-500'
                          : diff.type === 'removed'
                          ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-l-2 border-rose-500 line-through opacity-80'
                          : 'text-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span className="inline-block w-4 text-slate-400 select-none">
                        {diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : ' '}
                      </span>
                      {diff.text || ' '}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed whitespace-pre-wrap max-h-[360px] overflow-y-auto select-all">
                  {editableAiBody || aiGeneratedBody || '左側のチャットでご要望（例: 3ヶ月開発業務委託、月額30万円...）を送信すると、ここにAIが生成した最新全文が表示されます。'}
                </div>
              )}

              {/* 5 Operation Action Buttons */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">【生成後の操作メニュー】</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* 1. 文章を編集 */}
                  <button
                    onClick={() => setIsEditingGenerated(!isEditingGenerated)}
                    className={`px-3 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all border ${
                      isEditingGenerated
                        ? 'bg-amber-600 text-white border-amber-500 shadow'
                        : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    {isEditingGenerated ? '編集完了' : '文章を編集'}
                  </button>

                  {/* 2. 追加でAIに修正を依頼 */}
                  <button
                    onClick={() => {
                      chatInputRef.current?.focus();
                      setAiSubTab('chat');
                    }}
                    className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    追加でAIに修正を依頼
                  </button>

                  {/* 3. テンプレートとして保存 */}
                  <button
                    onClick={handleSaveAsTemplate}
                    disabled={isSavingTemplate || (!editableAiBody && !aiGeneratedBody)}
                    className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {isSavingTemplate ? '保存中...' : 'テンプレートとして保存'}
                  </button>

                  {/* 4. 破棄 */}
                  <button
                    onClick={handleDiscard}
                    disabled={!editableAiBody && !aiGeneratedBody}
                    className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl font-bold border border-rose-200 dark:border-rose-900/40 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    破棄
                  </button>
                </div>

                {/* 5. 現在のスカウトに使用 (Primary Action) */}
                <button
                  onClick={() => handleApplyContract(editableAiTitle || aiGeneratedTitle, editableAiBody || aiGeneratedBody)}
                  disabled={!editableAiBody.trim() && !aiGeneratedBody.trim()}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  現在のスカウトに使用
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
