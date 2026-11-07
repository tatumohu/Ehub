import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Send, ChevronLeft, Users, Info, Plus, UserPlus, Image as ImageIcon, FileText, X, Check, Menu, Bell, Calendar, Map as MapIcon, LogOut, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ProposalApprovalModal from '../components/ProposalApprovalModal';
import ProposalRemandModal from '../components/ProposalRemandModal';
import ScheduleModal from '../components/ScheduleModal';
import ProjectMembersModal from '../components/ProjectMembersModal';
import { ProjectContractViewModal } from '../components/ProjectContractViewModal';
import { Briefcase } from 'lucide-react';
import { getAccountTypeBorderClass } from '../utils/avatar';
import AccountTypeBadge from '../components/AccountTypeBadge';

interface User {
  id: number;
  username: string;
  avatar: string;
  account_type?: string;
}

export default function ProjectChat() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { user, socket, language, isAuthLoaded, refreshUnreadCount } = useAppContext();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [item, setItem] = useState<any>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [contacts, setContacts] = useState<User[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<User[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ file: File, type: 'image' | 'file', preview?: string }[]>([]);

  // Leave project modal state
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveModalMode, setLeaveModalMode] = useState<'confirm' | 'owner_notice'>('confirm');
  const [isLeaving, setIsLeaving] = useState(false);

  // Proposal modal state
  const [selectedProposal, setSelectedProposal] = useState<{ proposalId: number; messageId: number } | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRemandModal, setShowRemandModal] = useState(false);
  const [isProposalActionLoading, setIsProposalActionLoading] = useState(false);
  const [invitedUserIds, setInvitedUserIds] = useState<number[]>([]);

  // Project Contract state
  const [activeContracts, setActiveContracts] = useState<any[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [showContractViewModal, setShowContractViewModal] = useState(false);

  useEffect(() => {
    if (type && id) {
      const q = type === 'project' ? `project_id=${id}` : type === 'idea' ? `idea_id=${id}` : `user_id=${id}`;
      fetch(`/api/project-contracts?${q}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          setActiveContracts(data);
          if (data.length > 0) {
            setSelectedContractId(data[0].id);
          }
        })
        .catch(err => console.error(err));
    }
  }, [type, id]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthLoaded) return;
    if (!user || !type || !id) {
      navigate('/');
      return;
    }

    fetch('/api/chats/mark_read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        project_id: type === 'project' ? parseInt(id) : null,
        idea_id: type === 'idea' ? parseInt(id) : null,
        recipient_id: (type === 'direct' || type === 'private') ? parseInt(id) : null
      })
    }).then(() => {
      refreshUnreadCount();
    }).catch(e => console.error(e));

    if (type === 'direct' || type === 'private') {
      fetch(`/api/users/${id}`)
        .then(res => res.json())
        .then(data => {
          setItem({
            title: data.username,
            image: data.avatar,
            id: data.id,
            account_type: data.account_type
          });
          setMembers([
            { id: user.id, username: user.username, avatar: user.avatar, role: 'me' },
            { id: data.id, username: data.username, avatar: data.avatar, role: 'contact' }
          ]);
        });

      fetch(`/api/direct_chat/${id}/messages?user_id=${encodeURIComponent(user.id)}`)
        .then(res => res.json())
        .then(data => {
          setMessages(data);
          scrollToBottom();
          data.forEach((msg: any) => {
            if (!msg.is_read && msg.user_id !== user.id) {
              socket?.emit('mark_as_read', { 
                message_id: msg.id, 
                user_id: user.id,
                recipient_id: parseInt(id!)
              });
            }
          });
        });

      if (socket) {
        socket.emit('join_user', user.id);
        socket.on('new_message', (message: any) => {
          if ((message.user_id === parseInt(id) && message.recipient_id === user.id) || 
              (message.user_id === user.id && message.recipient_id === parseInt(id))) {
            setMessages(prev => [...prev, message]);
            scrollToBottom();
            if (message.user_id !== user.id) {
              socket.emit('mark_as_read', { 
                message_id: message.id, 
                user_id: user.id,
                recipient_id: parseInt(id!)
              });
            }
          }
        });

        socket.on('message_read', ({ message_id, read_count }) => {
          setMessages(prev => prev.map(m => m.id === message_id ? { ...m, read_count } : m));
        });

        return () => {
          socket.off('new_message');
          socket.off('message_read');
        };
      }
    } else {
      const itemType = type === 'idea' ? 'ideas' : 'projects';

      fetch(`/api/${itemType}/${id}/membership?user_id=${encodeURIComponent(user.id)}`)
        .then(res => res.json())
        .then(data => {
          if (!data.isMember) {
            navigate(`/${type}/${id}`);
          }
        });

      fetch(`/api/${itemType}/${id}${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`)
        .then(res => res.json())
        .then(data => setItem(data));

      fetch(`/api/${itemType}/${id}/members`)
        .then(res => res.json())
        .then(data => {
          const arr = Array.isArray(data) ? data : [];
          const map = new Map<number, any>();
          for (const m of arr) {
            if (!map.has(m.id) || m.role === 'author') {
              map.set(m.id, m);
            }
          }
          setMembers(Array.from(map.values()));
        });

      fetch(`/api/${itemType}/${id}/messages?user_id=${encodeURIComponent(user.id)}`)
        .then(res => {
          if (res.status === 403) {
            navigate(`/${type}/${id}`);
            return [];
          }
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(data);
            scrollToBottom();
            data.forEach((msg: any) => {
              if (!msg.is_read && msg.user_id !== user.id) {
                socket?.emit('mark_as_read', { 
                  message_id: msg.id, 
                  user_id: user.id,
                  idea_id: type === 'idea' ? id : null,
                  project_id: type === 'project' ? id : null
                });
              }
            });
          }
        });

      if (socket) {
        socket.emit(type === 'idea' ? 'join_idea' : 'join_project', id);
        socket.on('new_message', (message: any) => {
          setMessages(prev => [...prev, message]);
          scrollToBottom();
          if (message.user_id !== user.id) {
            socket.emit('mark_as_read', { 
              message_id: message.id, 
              user_id: user.id,
              idea_id: type === 'idea' ? id : null,
              project_id: type === 'project' ? id : null
            });
          }
        });

        socket.on('message_read', ({ message_id, read_count }) => {
          setMessages(prev => prev.map(m => m.id === message_id ? { ...m, read_count } : m));
        });

        socket.on('member_joined', () => {
          const itemType = type === 'idea' ? 'ideas' : 'projects';
          fetch(`/api/${itemType}/${id}/members`)
            .then(res => res.json())
            .then(data => {
              const arr = Array.isArray(data) ? data : [];
              const map = new Map<number, any>();
              for (const m of arr) {
                if (!map.has(m.id) || m.role === 'author') {
                  map.set(m.id, m);
                }
              }
              setMembers(Array.from(map.values()));
            });
        });

        return () => {
          socket.emit(type === 'idea' ? 'leave_idea' : 'leave_project', id);
          socket.off('new_message');
          socket.off('message_read');
          socket.off('member_joined');
        };
      }
    }
  }, [type, id, user, socket, navigate, isAuthLoaded]);

  useEffect(() => {
    if (isContactPickerOpen && user) {
      fetch(`/api/users/${user.id}/contacts?item_id=${id}&item_type=${type}`)
        .then(res => res.json())
        .then(data => setContacts(data));
    }
  }, [isContactPickerOpen, user, id, type]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (!newMessage.trim() && pendingFiles.length === 0 && selectedContacts.length === 0) || !socket) return;

    const commonData = {
      idea_id: type === 'idea' ? id : null,
      project_id: type === 'project' ? id : null,
      recipient_id: type === 'direct' ? id : null,
      user_id: user.id
    };

    if (newMessage.trim()) {
      socket.emit('send_message', {
        ...commonData,
        content: newMessage,
        type: 'text'
      });
    }

    for (const contact of selectedContacts) {
      socket.emit('send_message', {
        ...commonData,
        content: `Contact: ${contact.username}`,
        type: 'contact',
        metadata: JSON.stringify({ user_id: contact.id, username: contact.username, avatar: contact.avatar })
      });
    }

    for (const pf of pendingFiles) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        socket.emit('send_message', {
          ...commonData,
          content: pf.file.name,
          type: pf.type,
          metadata: JSON.stringify({ name: pf.file.name, data: base64 })
        });
      };
      reader.readAsDataURL(pf.file);
    }

    setNewMessage('');
    setSelectedContacts([]);
    setPendingFiles([]);
    setIsActionMenuOpen(false);
  };

  const handleApproveProposal = (proposalId: number, msgId: number) => {
    setSelectedProposal({ proposalId, messageId: msgId });
    setShowApprovalModal(true);
  };

  const handleRejectProposal = (proposalId: number, msgId: number) => {
    setSelectedProposal({ proposalId, messageId: msgId });
    setShowRemandModal(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedProposal || !user) return;
    setIsProposalActionLoading(true);
    try {
      const res = await fetch(`/api/ideas/${selectedProposal.proposalId}/approve_proposal`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_id: user.id, messageId: selectedProposal.messageId })
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === selectedProposal.messageId ? { ...m, metadata: JSON.stringify({ ...JSON.parse(m.metadata || '{}'), status: 'approved' }) } : m));
        setShowApprovalModal(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProposalActionLoading(false);
    }
  };

  const handleConfirmRemand = async ({ reason, requestedChanges, notes }: { reason: string; requestedChanges: string; notes: string }) => {
    if (!selectedProposal || !user) return;
    setIsProposalActionLoading(true);
    try {
      const res = await fetch(`/api/ideas/${selectedProposal.proposalId}/reject_proposal`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approver_id: user.id,
          reason,
          requested_changes: requestedChanges,
          notes,
          messageId: selectedProposal.messageId
        })
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === selectedProposal.messageId ? { ...m, metadata: JSON.stringify({ ...JSON.parse(m.metadata || '{}'), status: 'rejected' }) } : m));
        setShowRemandModal(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProposalActionLoading(false);
    }
  };

  const handleInviteContact = (targetUserId: number) => {
    if (!socket || !user || !item) return;
    socket.emit('invite_contact', {
      idea_id: type === 'idea' ? id : null,
      project_id: type === 'project' ? id : null,
      from_user_id: user.id,
      target_user_id: targetUserId
    });
    setInvitedUserIds(prev => [...prev, targetUserId]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'file') => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).map(file => ({
      file,
      type: fileType,
      preview: fileType === 'image' ? URL.createObjectURL(file as Blob) : undefined
    }));

    setPendingFiles(prev => [...prev, ...newFiles]);
    setIsActionMenuOpen(false);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleContactSelection = (contact: User) => {
    setSelectedContacts(prev => {
      if (prev.find(c => c.id === contact.id)) {
        return prev.filter(c => c.id !== contact.id);
      } else {
        return [...prev, contact];
      }
    });
  };

  const handleOpenLeaveModal = () => {
    setIsDrawerOpen(false);
    const isOwner = item?.author_id === user?.id || item?.author?.id === user?.id;
    if (isOwner) {
      setLeaveModalMode('owner_notice');
    } else {
      setLeaveModalMode('confirm');
    }
    setIsLeaveModalOpen(true);
  };

  const handleLeaveProject = async () => {
    if (!user || !id) return;
    setIsLeaving(true);
    try {
      const itemType = type === 'idea' ? 'ideas' : 'projects';
      const res = await fetch(`/api/${itemType}/${id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || (language === 'ja' ? '退出に失敗しました' : 'Failed to leave project'));
        return;
      }
      if (socket) {
        socket.emit(type === 'idea' ? 'leave_idea' : 'leave_project', id);
      }
      setIsLeaveModalOpen(false);
      alert(language === 'ja' ? 'プロジェクトから退出しました。' : 'You have left the project.');
      navigate(`/${type}/${id}`);
    } catch (e) {
      console.error(e);
      alert(language === 'ja' ? 'エラーが発生しました' : 'An error occurred');
    } finally {
      setIsLeaving(false);
    }
  };

  if (!item) return <div className="p-8 text-center text-slate-400">Loading...</div>;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-64px)] flex flex-col">
      <div className="hidden lg:flex items-center justify-between mb-6">
        <Link to={type === 'direct' ? '/chat' : `/${type}/${id}`} className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
          Back to {type === 'direct' ? 'Chat List' : (type === 'idea' ? 'Idea' : 'Project')}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {type === 'direct' ? `Chat with ${item.title}` : `${item.title} - ${type === 'idea' ? 'Idea' : 'Project'} Chat`}
          </h1>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        <div className="lg:col-span-3 bg-white dark:bg-[#0b0f19] rounded-3xl border border-slate-200 dark:border-cyan-500/25 flex flex-col overflow-hidden shadow-md dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0b0f19]/80 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <Link to={type === 'direct' ? '/chat' : `/${type}/${id}`} className="p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors lg:hidden shrink-0">
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 dark:bg-cyan-500/20 flex items-center justify-center overflow-hidden shrink-0 ${type === 'direct' ? `rounded-full ${getAccountTypeBorderClass(item?.account_type, 'border-[3px]')}` : 'rounded-xl border border-blue-200 dark:border-cyan-500/30'}`}>
                {item?.image ? (
                  <img src={item.image || undefined} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  type === 'direct' ? <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-cyan-400" /> : <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-cyan-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {item?.title || (type === 'direct' ? 'Direct Message' : 'Group Discussion')}
                  </h2>
                  {type === 'direct' && item?.account_type && (
                    <AccountTypeBadge accountType={item.account_type} size="xs" />
                  )}
                  {type !== 'direct' && (
                    <span className="text-[10px] font-bold text-blue-600 dark:text-cyan-400 bg-blue-50 dark:bg-cyan-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 hidden sm:block border border-blue-200 dark:border-cyan-500/20">
                      {type === 'idea' ? 'Idea' : 'Vision'}
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setIsMembersModalOpen(true)}
                  className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors flex items-center gap-1 mt-0.5"
                >
                  {type === 'direct' ? '2 participants' : `${members.length} members`}
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {activeContracts.length > 0 && (
                <button
                  onClick={() => setShowContractViewModal(true)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Project Contract</span>
                </button>
              )}
              
              <button 
                onClick={() => setIsDrawerOpen(true)}
                className="p-2 sm:p-3 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white rounded-xl transition-colors shrink-0 border border-slate-200 dark:border-slate-800"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-[#0b0f19]/30">
            {messages.map((msg, i) => {
              const isMe = msg.user_id === user?.id;
              return (
                <div 
                  key={msg.id || i}
                  className={`flex gap-4 ${isMe ? 'flex-row-reverse' : ''}`}
                >
                  <img src={msg.avatar || undefined} alt="" className={`w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 ${getAccountTypeBorderClass(msg.account_type, 'border-[3px]')} object-cover shadow-sm`} />
                  <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="font-bold text-slate-900 dark:text-white text-sm inline-flex items-center gap-1.5">{msg.username} <AccountTypeBadge accountType={msg.account_type} size="xs" /></span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {formatDistanceToNow(new Date((msg.created_at || '') + (!(msg.created_at || '').includes('Z') ? 'Z' : '')), { addSuffix: true })}
                      </span>
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                      isMe 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-cyan-500 dark:to-blue-600 text-white rounded-tr-none shadow-md border border-blue-400/30 dark:border-cyan-400/30' 
                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-cyan-500/20 shadow-sm'
                    }`}>
                      {msg.type === 'contact' ? (
                        <div className="flex flex-col gap-3">
                          <p className="text-xs opacity-70 italic">Shared a contact</p>
                          <div className="flex items-center gap-2">
                            {(() => {
                              let meta = {};
                              try { meta = JSON.parse((msg.metadata && msg.metadata !== 'undefined') ? msg.metadata : '{}'); } catch(e) {}
                              const isAuthor = item?.author_id === user?.id;
                              const isMember = members.some(m => m.id === (meta as any).user_id);
                              const Content = (
                                <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-white/10 flex-1">
                                  <img src={(meta as any).avatar || undefined} alt="" className={`w-10 h-10 rounded-full ${getAccountTypeBorderClass((meta as any).account_type, 'border-[3px]')} object-cover`} />
                                  <div className="min-w-0">
                                    <p className="font-bold text-white truncate flex items-center gap-1.5">{(meta as any).username} <AccountTypeBadge accountType={(meta as any).account_type} size="xs" /></p>
                                    <p className="text-[10px] opacity-60">Click to view profile</p>
                                  </div>
                                </div>
                              );
                              return (
                                <>
                                  <Link to={`/profile/${(meta as any).user_id}`} className="block hover:opacity-80 transition-opacity flex-1 min-w-0">
                                    {Content}
                                  </Link>
                                  {isAuthor && !isMember && (
                                    <button 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (!invitedUserIds.includes((meta as any).user_id)) {
                                          handleInviteContact((meta as any).user_id);
                                        }
                                      }}
                                      disabled={invitedUserIds.includes((meta as any).user_id)}
                                      className={`p-3 rounded-xl transition-all shadow-lg shrink-0 ${
                                        invitedUserIds.includes((meta as any).user_id)
                                          ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                          : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20'
                                      }`}
                                      title={invitedUserIds.includes((meta as any).user_id) ? "Invitation sent" : "Invite to chat"}
                                    >
                                      {invitedUserIds.includes((meta as any).user_id) ? (
                                        <Check className="w-5 h-5" />
                                      ) : (
                                        <Plus className="w-5 h-5" />
                                      )}
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      ) : msg.type === 'shared_item' ? (
                        (() => {
                          let shared = {};
                          try { shared = JSON.parse((msg.metadata && msg.metadata !== 'undefined') ? msg.metadata : '{}'); } catch(e) {}
                          const s = shared as any;
                          return (
                            <Link 
                              to={`/${s.type}/${s.id}`}
                              className="block bg-slate-900/50 p-3 rounded-xl border border-white/10 hover:bg-slate-900 transition-all group/shared min-w-[200px]"
                            >
                              <div className="flex gap-3 mb-2">
                                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                  <img src={s.image || undefined} alt="" className="w-full h-full object-cover group-hover/shared:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">Shared {s.type}</p>
                                  <p className="font-bold text-white truncate text-sm">{s.title}</p>
                                  <p className="text-[10px] text-slate-500 truncate">by {s.author_name}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-center py-1.5 bg-blue-500/10 rounded-lg text-[10px] font-bold text-blue-400 group-hover/shared:bg-blue-500 group-hover/shared:text-white transition-all">
                                VIEW {s.type?.toUpperCase()}
                              </div>
                            </Link>
                          );
                        })()
                      ) : msg.type === 'edit_proposal' ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] opacity-70 text-slate-400 ml-1 mb-0.5">{language === 'ja' ? '編集提案' : 'Edit Proposal'}</p>
                          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-lg w-[260px]">
                            {(() => {
                              let meta = {};
                              try { meta = JSON.parse((msg.metadata && msg.metadata !== 'undefined') ? msg.metadata : '{}'); } catch(e) {}
                              const pId = (meta as any).proposal_id;
                              const pTitle = (meta as any).proposal_title;
                              const pStatus = (meta as any).status;
                              const isAuthor = item?.author_id === user?.id;
                              return (
                                <>
                                  <div className="p-3 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <Link to={`/idea/${pId}`} className="font-bold text-white text-sm hover:text-indigo-300 transition-colors block truncate">
                                        {pTitle || (language === 'ja' ? '提案を見る' : 'View Proposal')}
                                      </Link>
                                    </div>
                                  </div>
                                  {!pStatus && isAuthor && (
                                    <div className="flex bg-slate-900/50">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRejectProposal(pId, msg.id);
                                        }}
                                        className="flex-1 py-2.5 text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border-r border-slate-700"
                                      >
                                        {language === 'ja' ? '差し戻し' : 'Reject'}
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleApproveProposal(pId, msg.id);
                                        }}
                                        className="flex-1 py-2.5 text-[11px] font-bold text-emerald-400 hover:text-white hover:bg-emerald-500/20 transition-colors"
                                      >
                                        {language === 'ja' ? '承認する' : 'Approve'}
                                      </button>
                                    </div>
                                  )}
                                  {pStatus === 'approved' && (
                                    <div className="py-2 px-3 text-center text-xs font-bold text-emerald-400 bg-emerald-500/10">
                                      {language === 'ja' ? '承認済み' : 'Approved'}
                                    </div>
                                  )}
                                  {pStatus === 'rejected' && (
                                    <div className="py-2 px-3 text-center text-xs font-bold text-slate-400 bg-slate-800">
                                      {language === 'ja' ? '差し戻し済み' : 'Rejected'}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      ) : msg.type === 'schedule_event' ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] opacity-70 text-slate-400 ml-1 mb-0.5">{language === 'ja' ? 'スケジュール' : 'Schedule'}</p>
                          <div className="bg-slate-800/90 rounded-2xl border border-slate-700 overflow-hidden shadow-lg w-[280px]">
                            {(() => {
                              let meta: any = {};
                              try { meta = JSON.parse((msg.metadata && msg.metadata !== 'undefined') ? msg.metadata : '{}'); } catch(e) {}
                              const isDl = meta.event_type === '締切' || meta.event_type === 'Idea提出期限' || meta.event_type === '承認期限' || meta.event_type === '成果物提出';
                              return (
                                <div className="p-3.5 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      isDl ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    }`}>
                                      {meta.event_type || '予定'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {meta.action === 'created' ? '新規追加' : meta.action === 'deleted' ? '削除' : '更新'}
                                    </span>
                                  </div>

                                  <h4 className="font-bold text-white text-sm leading-tight">{meta.title || msg.content}</h4>

                                  {meta.start_at && (
                                    <div className="text-[11px] text-slate-300 flex items-center gap-1.5 font-mono">
                                      <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                      <span>{new Date(meta.start_at).toLocaleDateString('ja-JP')} {meta.start_at.slice(11, 16)} 〜</span>
                                    </div>
                                  )}

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedScheduleId(meta.schedule_id || null);
                                      setIsScheduleModalOpen(true);
                                    }}
                                    className="w-full mt-2 py-2 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-blue-500/40 flex items-center justify-center gap-1.5"
                                  >
                                    ［予定を見る］
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ) : msg.type === 'image' ? (
                        <div className="space-y-2">
                          <img src={(() => { try { return JSON.parse((msg.metadata && msg.metadata !== 'undefined') ? msg.metadata : '{}').data || undefined; } catch(e) { return undefined; } })()} alt="" className="max-w-full rounded-lg border border-white/10" />
                          <p className="text-xs opacity-70">{msg.content}</p>
                        </div>
                      ) : msg.type === 'file' ? (
                        <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-white/10">
                          <FileText className="w-6 h-6 text-blue-400" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">{msg.content}</p>
                            <a 
                              href={(() => { try { return JSON.parse((msg.metadata && msg.metadata !== 'undefined') ? msg.metadata : '{}').data; } catch(e) { return ''; } })()} 
                              download={msg.content}
                              className="text-[10px] text-blue-400 hover:underline"
                            >
                              Download File
                            </a>
                          </div>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.read_count > 1 && (
                      <div className={`mt-1 text-[10px] text-slate-500 font-medium flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span>既読</span>
                        {type !== 'direct' && <span>{msg.read_count - 1}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-4 border-t border-slate-800 bg-[#0b0f19]/90 backdrop-blur-md">
            {(pendingFiles.length > 0 || selectedContacts.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedContacts.map(c => (
                  <div key={c.id} className="flex items-center gap-2 bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 rounded-full">
                    <img src={c.avatar || undefined} alt="" className={`w-5 h-5 rounded-full object-cover ${getAccountTypeBorderClass(c.account_type, 'border-2')}`} />
                    <span className="text-xs text-cyan-300 font-medium">{c.username}</span>
                    <button onClick={() => toggleContactSelection(c)} className="text-cyan-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {pendingFiles.map((pf, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-900 border border-cyan-500/30 px-3 py-1.5 rounded-full">
                    {pf.type === 'image' ? <ImageIcon className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5 text-cyan-400" />}
                    <span className="text-xs text-slate-300 font-medium truncate max-w-[100px]">{pf.file.name}</span>
                    <button onClick={() => removePendingFile(i)} className="text-slate-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="relative">
              <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-cyan-500/30 rounded-[32px] p-2 transition-all focus-within:border-blue-500 dark:focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-blue-500 dark:focus-within:ring-cyan-500/50 shadow-sm">
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full bg-transparent border-none pl-4 pr-4 pt-2 pb-0 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none min-h-[32px] max-h-[200px] text-sm custom-scrollbar"
                  rows={1}
                />
                
                <div className="flex items-center justify-between px-2 pb-1">
                  <div className="flex items-center gap-2 relative">
                    <button
                      type="button"
                      onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                      className={`p-2 rounded-full transition-all ${
                        isActionMenuOpen 
                          ? 'bg-blue-600 dark:bg-cyan-500 text-white rotate-45 shadow-md' 
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Plus className="w-5 h-5" />
                    </button>

                    {isActionMenuOpen && (
                      <div
                        className="absolute bottom-full left-0 mb-2 flex flex-col bg-white dark:bg-[#0b0f19] rounded-2xl border border-slate-200 dark:border-cyan-500/30 shadow-2xl overflow-hidden min-w-[140px]"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setIsContactPickerOpen(true);
                            setIsActionMenuOpen(false);
                          }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all text-sm"
                        >
                          <UserPlus className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                          Contact
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            photoInputRef.current?.click();
                            setIsActionMenuOpen(false);
                          }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all text-sm border-t border-slate-100 dark:border-slate-800"
                        >
                          <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            setIsActionMenuOpen(false);
                          }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all text-sm border-t border-slate-100 dark:border-slate-800"
                        >
                          <FileText className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                          File
                        </button>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit"
                    disabled={!newMessage.trim() && pendingFiles.length === 0 && selectedContacts.length === 0}
                    className="p-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-full hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all shadow-lg shadow-cyan-500/20 border border-cyan-400/30"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </form>

              <input
                type="file"
                ref={photoInputRef}
                onChange={e => handleFileChange(e, 'image')}
                accept="image/*"
                className="hidden"
                multiple
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={e => handleFileChange(e, 'file')}
                className="hidden"
                multiple
              />
            </div>
          </div>
        </div>

        {/* Contact Picker Modal */}
        
      {/* Sidebar/Drawer (Right side) */}
      {isDrawerOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex justify-end bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}>
          <div className="w-80 bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{language === 'ja' ? 'メニュー' : 'Menu'}</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 space-y-2 flex-1 overflow-y-auto">
              {type !== 'direct' && (
                <>
                                    {type === 'idea' && (
                    <Link to={`/network/${id}?type=${type}`} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors font-medium">
                      <FileText className="w-5 h-5 text-emerald-400" />
                      {language === 'ja' ? '編集' : 'Edit'}
                    </Link>
                  )}
                  <Link to={`/network/${id}?type=${type}`} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors font-medium">
                    <MapIcon className="w-5 h-5 text-indigo-400" />
                    {language === 'ja' ? 'Vision・Ideaツリー' : 'Vision/Idea Tree'}
                  </Link>
                  <button onClick={() => { setIsScheduleModalOpen(true); setIsDrawerOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors font-medium">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    {language === 'ja' ? 'スケジュール' : 'Schedule'}
                  </button>
                  <button onClick={() => { setIsMembersModalOpen(true); setIsDrawerOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors font-medium">
                    <Users className="w-5 h-5 text-emerald-400" />
                    {language === 'ja' ? 'メンバー' : 'Members'}
                  </button>
                  <Link to={`/${type}/${id}`} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors font-medium">
                    <Info className="w-5 h-5 text-amber-400" />
                    {language === 'ja' ? 'プロジェクト情報' : 'Project Info'}
                  </Link>
                </>
              )}
              <button onClick={() => { setIsNotificationModalOpen(true); setIsDrawerOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors font-medium">
                <Bell className="w-5 h-5 text-rose-400" />
                {language === 'ja' ? '通知設定' : 'Notification Settings'}
              </button>
              {type !== 'direct' && (
                <button 
                  onClick={handleOpenLeaveModal} 
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors font-medium border border-rose-500/20 bg-rose-500/10 mt-4"
                >
                  <LogOut className="w-5 h-5 text-rose-400" />
                  {language === 'ja' ? '退出' : 'Leave Project'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setSelectedScheduleId(null);
        }}
        type={(type === 'idea' ? 'idea' : 'project')}
        id={id || ''}
        selectedScheduleId={selectedScheduleId}
      />

      {/* Project Members Modal */}
      <ProjectMembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        type={(type === 'idea' ? 'idea' : 'project')}
        id={id || ''}
      />

      {/* Notification Settings Modal */}
      {isNotificationModalOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-rose-400" />
                {language === 'ja' ? '通知設定' : 'Notification Settings'}
              </h2>
              <button onClick={() => setIsNotificationModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-6">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white font-medium">{language === 'ja' ? 'すべてのメッセージを通知' : 'Notify all messages'}</span>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900" defaultChecked />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white font-medium">{language === 'ja' ? 'メンションのみ通知' : 'Mentions only'}</span>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white font-medium">{language === 'ja' ? 'ミュート (通知なし)' : 'Mute chat'}</span>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900" />
              </label>
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-3xl">
               <button onClick={() => setIsNotificationModalOpen(false)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors">
                 {language === 'ja' ? '保存' : 'Save'}
               </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isContactPickerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              onClick={() => setIsContactPickerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <div
              className="relative w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Select Contacts</h2>
                <button onClick={() => setIsContactPickerOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-4">
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {contacts.filter(c => c.id !== item?.author_id).length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-slate-500">No contacts found</p>
                    </div>
                  ) : (
                    contacts.filter(c => c.id !== item?.author_id).map((c) => {
                      const isSelected = selectedContacts.some(sc => sc.id === c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleContactSelection(c)}
                          className="flex items-center gap-4 p-3 rounded-2xl border border-slate-800 hover:border-slate-700 bg-slate-800/30 cursor-pointer transition-all group"
                        >
                          <button
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'
                            }`}
                          >
                            {isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                          </button>
                          <img src={c.avatar || undefined} alt={c.username} className={`w-10 h-10 rounded-full object-cover ${getAccountTypeBorderClass(c.account_type, 'border-2')}`} />
                          <div className="flex-1">
                            <p className="font-bold text-white">{c.username}</p>
                            <div className="h-0.5 w-12 bg-slate-700 rounded-full mt-1 group-hover:bg-blue-500/50 transition-colors" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="mt-6">
                  <button
                    onClick={() => setIsContactPickerOpen(false)}
                    className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20"
                  >
                    Done ({selectedContacts.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Members Modal */}
        {isMembersModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              onClick={() => setIsMembersModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <div
              className="relative w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Group Members</h2>
                <button onClick={() => setIsMembersModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  {members.map(member => (
                    <Link 
                      key={member.id} 
                      to={`/profile/${member.id}`}
                      onClick={() => setIsMembersModalOpen(false)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-700/50"
                    >
                      <img src={member.avatar || undefined} alt="" className={`w-10 h-10 rounded-full bg-slate-800 ${getAccountTypeBorderClass(member.account_type, 'border-2')} object-cover`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{member.username}</p>
                        <p className="text-xs text-slate-400 capitalize flex items-center gap-1">
                          {member.role === 'author' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>}
                          {member.role}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Members Sidebar */}
        <div className="hidden lg:block lg:col-span-1 bg-[#0b0f19] rounded-3xl border border-cyan-500/25 overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div className="p-6 border-b border-slate-800 bg-[#0b0f19]/50">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-cyan-400" />
              {type === 'direct' ? 'Participants' : 'Project Members'}
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {members.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-700/50">
                <img src={member.avatar || undefined} alt="" className={`w-10 h-10 rounded-full bg-slate-800 ${getAccountTypeBorderClass(member.account_type, 'border-[3px]')} object-cover`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate flex items-center gap-1.5">{member.username} <AccountTypeBadge accountType={member.account_type} size="xs" /></p>
                  <p className="text-xs text-slate-400 capitalize flex items-center gap-1">
                    {member.role === 'author' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>}
                    {member.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Proposal Approval Modal */}
      <ProposalApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onConfirm={handleConfirmApproval}
        loading={isProposalActionLoading}
      />

      {/* Proposal Remand Modal */}
      <ProposalRemandModal
        isOpen={showRemandModal}
        onClose={() => setShowRemandModal(false)}
        onSubmit={handleConfirmRemand}
        loading={isProposalActionLoading}
      />

      {/* Leave Project Modal */}
      {isLeaveModalOpen && createPortal(
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5" onClick={e => e.stopPropagation()}>
            {leaveModalMode === 'owner_notice' ? (
              <>
                <div className="flex items-center gap-3 text-amber-400">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">
                      {language === 'ja' ? '退出できません' : 'Cannot Leave'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {language === 'ja' ? 'Vision投稿者（Owner）制限' : 'Vision Owner restriction'}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 text-sm text-slate-300 leading-relaxed space-y-2">
                  <p className="font-semibold text-white">
                    {language === 'ja' ? 'Vision投稿者（Owner）はプロジェクトから退出できません。' : 'Vision Owners cannot leave the project.'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {language === 'ja' 
                      ? 'あなたがこのプロジェクトのオーナー（Vision投稿者）であるため、通常の方法で退出することはできません。' 
                      : 'As the owner of this project, you cannot leave using the standard method.'}
                  </p>
                </div>

                <button
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
                >
                  {language === 'ja' ? '了解' : 'OK'}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <LogOut className="w-6 h-6 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">
                      {language === 'ja' ? 'プロジェクトからの退出' : 'Leave Project'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {language === 'ja' ? '退出確認' : 'Confirmation'}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 text-xs text-slate-300 leading-relaxed space-y-2">
                  <p className="font-bold text-white text-sm">
                    {language === 'ja' ? 'このプロジェクトから退出しますか？' : 'Are you sure you want to leave this project?'}
                  </p>
                  <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
                    <li>
                      {language === 'ja' 
                        ? '退出後も、あなたが過去に投稿したメッセージやIdea提案は削除されずに残ります。' 
                        : 'Your past messages and proposals will remain in the project.'}
                    </li>
                    <li>
                      {language === 'ja' 
                        ? '退出後は、原則としてプロジェクトチャットを閲覧できません。' 
                        : 'You will no longer be able to view or send messages in the project chat.'}
                    </li>
                  </ul>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsLeaveModalOpen(false)}
                    disabled={isLeaving}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors text-sm disabled:opacity-50"
                  >
                    {language === 'ja' ? 'キャンセル' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleLeaveProject}
                    disabled={isLeaving}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-colors text-sm shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLeaving ? (
                      <span>{language === 'ja' ? '処理中...' : 'Leaving...'}</span>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4" />
                        <span>{language === 'ja' ? '退出する' : 'Leave'}</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Project Contract View Modal */}
      {selectedContractId && user && (
        <ProjectContractViewModal
          contractId={selectedContractId}
          currentUserId={user.id}
          isOpen={showContractViewModal}
          onClose={() => setShowContractViewModal(false)}
          onRefresh={() => {
            const q = type === 'project' ? `project_id=${id}` : type === 'idea' ? `idea_id=${id}` : `user_id=${id}`;
            fetch(`/api/project-contracts?${q}`)
              .then(res => res.ok ? res.json() : [])
              .then(data => setActiveContracts(data));
          }}
        />
      )}
    </>
  );
}
