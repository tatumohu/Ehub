import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Bot, Loader2, Search, Menu, Plus, MessageSquare, User as UserIcon, Check } from 'lucide-react';
import ScoutMessageModal from './ScoutMessageModal';
import ScoutInboxModal from './ScoutInboxModal';
import PlanUpgradeModal from './PlanUpgradeModal';
import { useAppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface Message {
  id?: string | number;
  role: 'user' | 'assistant' | 'system' | 'ai'; // 'ai' used locally for old state
  content?: string;
  text?: string;
  profiles?: any[];
}

interface Session {
  id: number;
  title: string;
  created_at: string;
}

interface ScoutChatModalProps {
  onClose: () => void;
}

export default function ScoutChatModal({ onClose }: ScoutChatModalProps) {
  const { language, user } = useAppContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const initialMessages: Message[] = [
    {
      id: 'welcome',
      role: 'assistant',
      content: language === 'ja' ? 'どのようなVision（人材・企業）をお探しですか？要望をお聞かせください。' : 'What kind of Vision (talent/company) are you looking for? Please let me know your requirements.'
    }
  ];

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const isOrg = user?.account_type === 'organization';
  const [selectedProfiles, setSelectedProfiles] = useState<any[]>([]);
  const [showScoutMessageModal, setShowScoutMessageModal] = useState(false);
  const [showScoutInboxModal, setShowScoutInboxModal] = useState(false);
  const [showPlanUpgradeModal, setShowPlanUpgradeModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, showHistory]);

  useEffect(() => {
    if (user?.id) {
      fetchSessions();
    }
  }, [user?.id]);

    const fetchSessions = async () => {
    try {
      const res = await fetch(`/api/users/${user?.id}/scout_sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadSession = async (sessionId: number) => {
    try {
      const res = await fetch(`/api/scout_sessions/${sessionId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.length > 0 ? data : initialMessages);
        setCurrentSessionId(sessionId);
        setShowHistory(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startNewSession = () => {
    setMessages(initialMessages);
    setCurrentSessionId(null);
    setShowHistory(false);
  };

  const saveMessage = async (sessionId: number, role: string, content: string, profiles?: any[]) => {
    if (!user) return;
    try {
      await fetch(`/api/scout_sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content, profiles })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    
    const content = input.trim();
    setInput('');
    setIsGenerating(true);
    
    // Add user message locally
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content
    };
    
    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
        const res = await fetch(`/api/users/${user?.id}/scout_sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        });
        if (res.ok) {
          const newSession = await res.json();
          sessionId = newSession.id;
          setCurrentSessionId(sessionId);
          setSessions(prev => [newSession, ...prev]);
        }
      } catch (e) {
        console.error(e);
      }
    }

    setMessages(prev => [...prev, userMessage]);
    if (sessionId) {
      await saveMessage(sessionId, 'user', content);
    }

    try {
      // Prepare history for API
      const historyForApi = messages.filter(m => m.id !== 'welcome').map(m => ({
        role: m.role === 'ai' || m.role === 'assistant' ? 'assistant' : 'user',
        content: m.text || m.content
      }));
      historyForApi.push({ role: 'user', content: content });

      const res = await fetch('/api/scout_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: content, messages: historyForApi, language, userId: user?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to chat');
      
      const newMessages: Message[] = [];
      let baseId = Date.now();
      if (data.text) {
        newMessages.push({
          id: (baseId++).toString(),
          role: 'assistant',
          content: data.text,
        });
      }
      
      const emaProfiles = data.profiles?.filter((p: any) => p.account_type === 'ema' || p.account_type === 'organization') || [];
      if (emaProfiles.length > 0) {
        newMessages.push({
          id: (baseId++).toString(),
          role: 'assistant',
          content: language === 'ja' ? '関連するVision/法人・自治体候補です：' : 'Here are some related Vision/Corporate/Gov candidates:',
          profiles: emaProfiles
        });
      }

      const individualProfiles = data.profiles?.filter((p: any) => p.account_type === 'individual') || [];
      if (individualProfiles.length > 0) {
        newMessages.push({
          id: (baseId++).toString(),
          role: 'assistant',
          content: language === 'ja' ? '関連する個人ユーザー候補です：' : 'Here are some related individual user candidates:',
          profiles: individualProfiles
        });
      }

      if (newMessages.length === 0) {
        newMessages.push({
          id: (baseId++).toString(),
          role: 'assistant',
          content: data.text || '',
          profiles: data.profiles
        });
      }

      setMessages(prev => [...prev, ...newMessages]);

      if (sessionId) {
        for (const msg of newMessages) {
          await saveMessage(sessionId, 'assistant', msg.content || '', msg.profiles);
        }
      }

    } catch (error: any) {
      console.error(error);
      const errorMsg = language === 'ja'
          ? 'エラーが発生しました。もう一度お試しください。'
          : 'An error occurred. Please try again.';
          
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-[#0b0f19] border border-cyan-500/30 w-full max-w-4xl rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)] relative flex flex-col h-[calc(100dvh-2rem)] md:h-[720px] max-h-[calc(100dvh-2rem)]" onClick={e => e.stopPropagation()}>
        
        {/* Mobile History Drawer Overlay */}
        {showHistory && (
          <div className="absolute inset-0 bg-[#0b0f19] z-20 flex flex-col md:hidden">
            <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between shrink-0 bg-slate-950/50">
              <h3 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                {language === 'ja' ? 'スカウト履歴' : 'Scout History'}
              </h3>
              <button onClick={() => setShowHistory(false)} className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <button 
                onClick={startNewSession}
                className="w-full flex items-center gap-2 p-3 text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl transition-all shadow-lg shadow-cyan-500/20 font-bold"
              >
                <Plus className="w-5 h-5" />
                {language === 'ja' ? '新しいAIスカウト' : 'New Scout Chat'}
              </button>
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`w-full flex items-center gap-2 p-3 text-left rounded-xl transition-all border ${currentSessionId === session.id ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300' : 'border-transparent text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'}`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0 text-cyan-400" />
                  <span className="truncate text-sm">{session.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop History Sidebar */}
          {showHistory && (
            <div className="hidden md:flex w-72 border-r border-cyan-500/20 flex-col bg-[#070a12] shrink-0">
              <div className="p-4">
                <button 
                  onClick={startNewSession}
                  className="w-full flex items-center gap-2 p-3 text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl transition-all shadow-lg shadow-cyan-500/20 font-bold text-sm"
                >
                  <Plus className="w-5 h-5" />
                  {language === 'ja' ? '新しいAIスカウト' : 'New Scout Chat'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={`w-full flex items-center gap-2 p-3 text-left rounded-xl transition-all border ${currentSessionId === session.id ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300' : 'border-transparent text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'}`}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-cyan-400" />
                    <span className="truncate text-sm">{session.title}</span>
                  </button>
                ))}
                {sessions.length === 0 && (
                  <p className="text-center text-slate-500 text-sm mt-8">
                    {language === 'ja' ? '履歴はありません' : 'No history yet'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden relative bg-[#0b0f19]">
            {/* Header */}
            <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between shrink-0 bg-[#0b0f19]/90 backdrop-blur-md z-10 absolute top-0 left-0 right-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-all"
                  title="Toggle History"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                  <Bot className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white tracking-wide flex items-center gap-2">
                    {language === 'ja' ? 'AI スカウト' : 'AI Scout'}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase font-mono">Neural v2</span>
                  </h2>
                </div>
                <button
                  onClick={() => setShowScoutInboxModal(true)}
                  className="ml-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  {language === 'ja' ? '送信済み一覧' : 'Sent Scouts'}
                </button>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 pt-20 space-y-6 custom-scrollbar">
              {messages.map((msg, idx) => (
                <div key={msg.id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {(msg.role === 'ai' || msg.role === 'assistant') && (
                      <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 mb-1 shadow-md shadow-cyan-500/10">
                        <Bot className="w-4 h-4 text-cyan-400" />
                      </div>
                    )}
                    <div className={`rounded-2xl p-4 shadow-xl flex flex-col gap-4 border ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-br-none border-cyan-400/30 shadow-cyan-500/20' 
                        : 'bg-slate-900/90 text-slate-200 rounded-bl-none border-slate-800 backdrop-blur'
                    }`}>
                      {(msg.text || msg.content) && <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text || msg.content}</p>}
                      {msg.profiles && msg.profiles.length > 0 && (
                        <div className="flex flex-col gap-3 mt-2">
                          {msg.profiles.map((profile: any) => (
                            <Link 
                              key={profile.id} 
                              to={`/profile/${profile.id}`}
                              state={{ fromScout: true }}
                              onClick={onClose}
                              className="flex items-center gap-3 p-3 rounded-xl bg-[#070a12] hover:bg-slate-800/80 transition-all border border-cyan-500/20 hover:border-cyan-500/50 shadow-md group"
                            >
                              <div className={`w-11 h-11 rounded-full overflow-hidden bg-slate-800 shrink-0 ${getAccountTypeBorderClass(profile.account_type, 'border-2')}`}>
                                {profile.avatar ? (
                                  <img src={profile.avatar} alt={profile.username} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                    <UserIcon className="w-5 h-5 text-cyan-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="font-bold text-white text-sm truncate group-hover:text-cyan-300 transition-colors">{profile.username}</span>
                                <span className="text-xs text-cyan-400/90 truncate font-mono">{profile.title || (profile.account_type === 'ema' ? 'Vision' : profile.account_type)}</span>
                              </div>
                              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Send className="w-3.5 h-3.5" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="flex items-end gap-2">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 mb-1">
                      <Bot className="w-4 h-4 text-cyan-400 animate-pulse" />
                    </div>
                    <div className="bg-slate-900 border border-cyan-500/30 text-slate-200 rounded-2xl rounded-bl-none p-4 flex items-center gap-3 shadow-lg shadow-cyan-500/10">
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      <span className="text-sm font-mono text-cyan-300">
                        {language === 'ja' ? 'ニューラルスキャン中...' : 'Neural scanning...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            
            {selectedProfiles.length > 0 && (
              <div className="absolute bottom-[80px] left-0 right-0 p-3 mx-4 bg-slate-900/95 border border-cyan-500/40 rounded-2xl flex items-center justify-between z-20 shadow-2xl backdrop-blur-md">
                <span className="text-white text-sm font-bold ml-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  {language === 'ja' ? `${selectedProfiles.length}人選択中` : `${selectedProfiles.length} selected`}
                </span>
                <button
                  onClick={() => {
                    if (user?.org_plan === 'basic' || !user?.org_plan) {
                      setShowPlanUpgradeModal(true);
                    } else {
                      setShowScoutMessageModal(true);
                    }
                  }}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-cyan-500/30 active:scale-[0.98] transition-all"
                >
                  {language === 'ja' ? '次へ' : 'Next'}
                </button>
              </div>
            )}

            {/* Input Area */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-4 border-t border-cyan-500/20 shrink-0 bg-[#0b0f19]/90 backdrop-blur"
            >
              <div className="flex items-end gap-2 max-w-4xl mx-auto">
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={language === 'ja' ? '例: AI開発に強いエンジニアを探しています' : 'e.g., Looking for engineers with AI experience'}
                  className="flex-1 bg-slate-950 border border-cyan-500/30 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 resize-none overflow-y-auto text-sm shadow-inner"
                  rows={1}
                  style={{ minHeight: '48px', maxHeight: '150px' }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isGenerating}
                  className="mb-1 p-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-800 text-white rounded-xl transition-all flex shrink-0 shadow-lg shadow-cyan-500/20 border border-cyan-400/40 cursor-pointer"
                >
                  <Send className="w-5 h-5 pointer-events-none" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
