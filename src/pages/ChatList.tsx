import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MessageCircle, Users, Lock, Plus, X, Search as SearchIcon, User } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { safeFetchJson } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { getAccountTypeBorderClass } from '../utils/avatar';
import AccountTypeBadge from '../components/AccountTypeBadge';

type Project = {
  id: number;
  title: string;
  image: string;
  author_name: string;
  account_type?: string;
  type: 'idea' | 'project' | 'direct';
  last_message?: string;
  last_message_type?: string;
  last_message_at?: string;
  last_message_user_id?: number;
  last_message_read_count?: number;
  unread_count: number;
  members_count?: number;
  project_status?: string;
};

type Contact = {
  id: number;
  username: string;
  avatar: string;
  account_type?: string;
};

export default function ChatList() {
  const { user, socket, language } = useAppContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<'project' | 'direct'>(tabParam === 'direct' ? 'direct' : 'project');

  useEffect(() => {
    if (tabParam === 'direct' || tabParam === 'project') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [loading, setLoading] = useState(true);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const fetchMemberships = () => {
    if (!user) return;
    safeFetchJson(`/api/users/${user.id}/memberships`, undefined, [])
      .then(data => {
        setProjects(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchContacts = () => {
    if (!user) return;
    safeFetchJson(`/api/users/${user.id}/potential_contacts`, undefined, [])
      .then(data => setContacts(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchMemberships();
  }, [user]);

  useEffect(() => {
    if (socket && user) {
      // Join all project/idea rooms to receive message updates
      projects.forEach(p => {
        if (p.type === 'direct') {
          // Direct chats use user rooms
          socket.emit('join_user', user.id);
        } else {
          socket.emit(p.type === 'idea' ? 'join_idea' : 'join_project', p.id);
        }
      });

      const handleNewMessage = (msg: any) => {
        setProjects(prev => {
          const exists = prev.some(p => 
            (p.type === 'idea' && msg.idea_id === p.id) || 
            (p.type === 'project' && msg.project_id === p.id) ||
            (p.type === 'direct' && (msg.user_id === p.id || msg.recipient_id === p.id))
          );

          if (!exists) {
            fetchMemberships();
            return prev;
          }

          return prev.map(p => {
            const isMatch = (p.type === 'idea' && msg.idea_id === p.id) || 
                            (p.type === 'project' && msg.project_id === p.id) ||
                            (p.type === 'direct' && (msg.user_id === p.id || msg.recipient_id === p.id));
            if (isMatch) {
              return {
                ...p,
                last_message: msg.content,
                last_message_type: msg.type,
                last_message_at: msg.created_at,
                unread_count: msg.user_id === user.id ? p.unread_count : p.unread_count + 1
              };
            }
            return p;
          }).sort((a, b) => {
            const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return dateB - dateA;
          });
        });
      };

      const handleMessageRead = ({ message_id, read_count }: any) => {
        fetchMemberships();
      };

      socket.on('new_message', handleNewMessage);
      socket.on('message_read', handleMessageRead);

      return () => {
        projects.forEach(p => {
          if (p.type !== 'direct') {
            socket.emit(p.type === 'idea' ? 'leave_idea' : 'leave_project', p.id);
          }
        });
        socket.off('new_message', handleNewMessage);
        socket.off('message_read', handleMessageRead);
      };
    }
  }, [socket, user, projects.length]);

  const handleStartChat = () => {
    if (selectedContact) {
      navigate(`/chat/direct/${selectedContact.id}`);
      setShowContactModal(false);
    }
  };

  
  const projectChats = projects.filter(p => p.type === 'project' || p.type === 'idea');
  const directChats = projects.filter(p => p.type === 'direct');
  
  const projectUnread = projectChats.reduce((sum, p) => sum + (p.unread_count || 0), 0);
  const directUnread = directChats.reduce((sum, p) => sum + (p.unread_count || 0), 0);
  
  const displayedProjects = activeTab === 'project' ? projectChats : directChats;

  const filteredContacts = contacts.filter(c => 
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderLastMessage = (project: Project) => {
    if (!project.last_message) return 'No messages yet';
    if (project.last_message_type === 'image') return '[Image]';
    if (project.last_message_type === 'file') return '[File]';
    if (project.last_message_type === 'contact') return '[Contact]';
    return project.last_message;
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Lock className="w-16 h-16 text-slate-400 dark:text-slate-700 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{language === 'ja' ? 'サインインしてチャットを見る' : 'Sign in to see your chats'}</h1>
        <p className="text-slate-600 dark:text-slate-400">{language === 'ja' ? 'プロジェクトに参加してコラボレーションを始めましょう。' : 'Join projects to start collaborating with others.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-32">
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-8 h-8 text-blue-600 dark:text-cyan-400" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{language === 'ja' ? 'チャット' : 'Chats'}</h1>
        </div>
        <button 
          onClick={() => {
            fetchContacts();
            setShowContactModal(true);
          }}
          className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-cyan-500 dark:to-blue-600 hover:from-blue-500 hover:to-indigo-500 dark:hover:from-cyan-400 dark:hover:to-blue-500 text-white rounded-xl transition-all shadow-md shadow-blue-500/20 dark:shadow-cyan-500/20 border border-blue-400/30 dark:border-cyan-400/30"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="flex bg-slate-200/80 dark:bg-[#0b0f19] rounded-full p-1 border border-slate-300 dark:border-cyan-500/20 shrink-0 mb-6 w-full sm:w-fit mx-auto sm:mx-0 shadow-sm">
          <button 
            onClick={() => setActiveTab('project')}
            className={`flex-1 sm:flex-none py-2 px-6 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'project' 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-cyan-500 dark:to-blue-600 text-white shadow-md shadow-blue-500/20 dark:shadow-cyan-500/20' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {language === 'ja' ? 'プロジェクトチャット' : 'Project Chat'}
            {projectUnread > 0 && <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{projectUnread}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('direct')}
            className={`flex-1 sm:flex-none py-2 px-6 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'direct' 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-cyan-500 dark:to-blue-600 text-white shadow-md shadow-blue-500/20 dark:shadow-cyan-500/20' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {language === 'ja' ? 'チャット' : 'Direct'}
            {directUnread > 0 && <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{directUnread}</span>}
          </button>
      </div>


      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-white dark:bg-[#0b0f19] rounded-2xl animate-pulse border border-slate-200 dark:border-cyan-500/20 shadow-sm" />
            ))}
          </div>
        ) : displayedProjects.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#0b0f19] rounded-2xl border border-slate-200 dark:border-cyan-500/20 shadow-sm">
            <p className="text-slate-800 dark:text-slate-300 font-medium">No active chats available.</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Join projects or start a direct chat with collaborators.</p>
          </div>
        ) : (
          displayedProjects.map(project => (
            <Link 
              key={`${project.type}-${project.id}`} 
              to={`/chat/${project.type}/${project.id}`}
              className="flex items-center gap-4 bg-white dark:bg-[#0b0f19] p-4 rounded-2xl border border-slate-200 dark:border-cyan-500/20 hover:border-blue-400 dark:hover:border-cyan-500/50 transition-all shadow-sm hover:shadow-md dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] group hover:scale-[1.01]"
            >
              <img 
                src={project.image || undefined} 
                alt={project.title} 
                className={`w-16 h-16 object-cover ${project.type === 'direct' ? `rounded-full ${getAccountTypeBorderClass(project.account_type, 'border-[3px]')}` : 'rounded-xl border border-slate-200 dark:border-cyan-500/30'}`}
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 grid grid-cols-2 gap-4 items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-cyan-300 transition-colors">
                      {project.title}
                    </h3>
                    {project.type === 'direct' && (
                      <AccountTypeBadge accountType={project.account_type} size="xs" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                    {project.type === 'direct' ? (
                      <>
                        <User className="w-3 h-3 shrink-0 text-blue-600 dark:text-cyan-400" />
                        <span>Direct Message</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-3 h-3 shrink-0 text-blue-600 dark:text-cyan-400" />
                        <span className="inline-flex items-center gap-1">{project.author_name} <AccountTypeBadge accountType={project.account_type} size="xs" /></span>
                        <span>•</span>
                        <span>{project.members_count} {language === 'ja' ? 'メンバー' : 'Members'}</span>
                        {project.project_status && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{project.project_status}</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {project.last_message_user_id === user.id && project.last_message_read_count && project.last_message_read_count > 1 && (
                      <span className="text-[10px] text-blue-600 dark:text-cyan-400 font-bold">既読</span>
                    )}
                    {project.last_message_at && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(project.last_message_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 w-full justify-end">
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate italic flex-1 text-right">
                      {renderLastMessage(project)}
                    </p>
                    {project.unread_count > 0 && (
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-cyan-500 dark:to-blue-600 text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-md shrink-0">
                        {project.unread_count}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Contact Selection Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl">
          <div className="bg-white dark:bg-[#0b0f19] w-full max-w-md rounded-3xl border border-slate-200 dark:border-cyan-500/30 shadow-2xl dark:shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-cyan-400"></span>
                New Chat
              </h2>
              <button 
                onClick={() => setShowContactModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 pb-4 pt-2">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 dark:text-cyan-400" />
                <input 
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-cyan-500/20 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500">No contacts found.</p>
                </div>
              ) : (
                filteredContacts.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                      selectedContact?.id === contact.id 
                        ? 'bg-blue-50 dark:bg-cyan-500/20 border-blue-500 dark:border-cyan-500 text-blue-900 dark:text-white shadow-md' 
                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <img src={contact.avatar || undefined} alt={contact.username} className={`w-10 h-10 rounded-full object-cover ${getAccountTypeBorderClass(contact.account_type, 'border-[3px]')}`} />
                    <span className="font-medium inline-flex items-center gap-1.5">{contact.username} <AccountTypeBadge accountType={contact.account_type} size="xs" /></span>
                  </button>
                ))
              )}
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800">
              <button
                disabled={!selectedContact}
                onClick={handleStartChat}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-cyan-500 dark:to-blue-600 hover:from-blue-500 hover:to-indigo-500 dark:hover:from-cyan-400 dark:hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-blue-500/20 dark:shadow-cyan-500/20"
              >
                Start Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
