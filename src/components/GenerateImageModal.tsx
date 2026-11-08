import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Image as ImageIcon, Loader2, Check, Lock, Sparkles, Crown, ArrowRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import PlanUpgradeModal from './PlanUpgradeModal';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text?: string;
  image?: string;
}

interface GenerateImageModalProps {
  onClose: () => void;
  onApply: (image: string) => void;
  initialPrompt?: string;
}

export default function GenerateImageModal({ onClose, onApply, initialPrompt }: GenerateImageModalProps) {
  const { language, user } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: language === 'ja' ? 'どのような画像を作成しますか？プロンプトを入力してください。' : 'What kind of image would you like to create? Please enter a prompt.'
    }
  ]);
  const [input, setInput] = useState(initialPrompt || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const plan = user?.plan || (user?.account_type === 'organization' ? (user?.org_plan || 'light') : 'free');
  const isProOrOrg = plan === 'pro' || plan === 'standard' || plan === 'enterprise';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    // 項目5: AI画像生成はPro以上で利用可能 (Freeではロック)
    if (!isProOrOrg) {
      setShowUpgradeModal(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const prompt = input.trim();
    setInput('');
    setIsGenerating(true);

    try {
      // Record AI image usage
      if (user?.id) {
        await fetch('/api/ai/record-usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': user.id.toString() },
          body: JSON.stringify({ feature: 'ai_image' })
        });
      }

      const res = await fetch('/api/generate_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate image');
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        image: data.image
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      console.error(error);
      const isQuota = error.message.includes('429') || error.message.includes('quota') || error.message.toLowerCase().includes('exhausted');
      let errorMsg = language === 'ja' 
        ? '画像の生成に失敗しました。もう一度お試しください。' 
        : 'Failed to generate image. Please try again.';
      
      if (isQuota) {
        errorMsg = language === 'ja'
          ? 'APIの利用制限（Quota Exceeded）に達したため、画像生成に失敗しました。しばらく待ってから再度お試しいただくか、APIキーのプランをご確認ください。'
          : 'Failed to generate image due to API quota limits. Please try again later or check your API key billing plan.';
      }
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: errorMsg
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div className="bg-white dark:bg-[#202123] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative flex flex-col h-[80vh] md:h-[600px] transition-colors" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-600 dark:text-cyan-400" />
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{language === 'ja' ? 'AI画像生成' : 'Generate with AI'}</span>
                {!isProOrOrg && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    <span>Pro機能</span>
                  </span>
                )}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Pro Lock Notice for Free Users (項目5: AI画像生成はPro以上) */}
          {!isProOrOrg && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-b border-blue-100 dark:border-blue-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-200">
                <Lock className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                <span className="text-xs sm:text-sm font-medium">
                  {language === 'ja' ? 'AI画像生成はProプラン（¥980/月）でご利用いただけます。' : 'AI Image generation is exclusively available on Pro (¥980/mo).'}
                </span>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="shrink-0 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1"
              >
                <span>{language === 'ja' ? 'Proにアップグレード' : 'Upgrade to Pro'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 dark:bg-transparent">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 rounded-bl-none'
                }`}>
                  {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                  {msg.image && (
                    <div className="space-y-3">
                      <img src={msg.image} alt="Generated" className="rounded-xl w-full h-auto shadow-sm" />
                      <button
                        onClick={() => onApply(msg.image!)}
                        className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        {language === 'ja' ? 'この画像を適用' : 'Apply this image'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 rounded-2xl rounded-bl-none p-4 flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500 dark:text-blue-400" />
                  <span className="text-sm">
                    {language === 'ja' ? '生成中...' : 'Generating...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-[#202123]">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isProOrOrg 
                  ? (language === 'ja' ? '例: 近未来的な都市のオープンイノベーションハブ...' : 'e.g. Futuristic open innovation hub...') 
                  : (language === 'ja' ? 'ProプランでAI画像生成が利用可能になります' : 'Upgrade to Pro to generate images')}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center shrink-0"
              >
                {isProOrOrg ? (
                  <Send className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showUpgradeModal && (
        <PlanUpgradeModal 
          onClose={() => setShowUpgradeModal(false)}
          noticeMessage="AI画像生成はProプラン（¥980/月）で無制限にご利用いただけます。"
        />
      )}
    </>
  );
}
