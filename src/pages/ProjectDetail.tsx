import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { 
  MessageSquare, 
  Heart, 
  Share2, 
  Users, 
  Send, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Lightbulb, 
  UserPlus, 
  UserCheck, 
  Network as NetworkIconLucide,
  Home as HomeIcon,
  Origami,
  PenLine,
  Bookmark,
  Lock,
  Target,
  AlertCircle,
} from 'lucide-react';
import NetworkIcon from '../components/NetworkIcon';
import ShareModal from '../components/ShareModal';
import { formatDistanceToNow } from 'date-fns';
import PlanUpgradeModal from '../components/PlanUpgradeModal';
import ScoutMessageModal from '../components/ScoutMessageModal';
import SubscribeButton from '../components/SubscribeButton';
import AddMembersModal from '../components/AddMembersModal';
import LineageHistorySlider from '../components/LineageHistorySlider';
import IdeaQuotesList from '../components/IdeaQuotesList';
import JoinProjectModal from '../components/JoinProjectModal';
import SimpleStageIndicator from '../components/SimpleStageIndicator';
import PermittedUsersModal from '../components/PermittedUsersModal';
import StageEvaluationModal from '../components/StageEvaluationModal';
import HashtagDisplay from '../components/HashtagDisplay';

import OrgBadge from '../components/OrgBadge';
import AccountTypeBadge from '../components/AccountTypeBadge';
import { getAccountTypeBorderClass } from '../utils/avatar';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromNetwork = searchParams.get('from') === 'network';
  const fromCompleted = searchParams.get('from') === 'completed';
  const { user, socket, language, refreshUnreadOfferCount } = useAppContext();
  const [project, setProject] = useState<any>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [membership, setMembership] = useState<any>({ isMember: false, status: 'none' });
  const [isLiked, setIsLiked] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [archiveCount, setArchiveCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [followCount, setFollowCount] = useState(0);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPlanUpgradeModal, setShowPlanUpgradeModal] = useState(false);
  const [showScoutMessageModal, setShowScoutMessageModal] = useState(false);
  const [keyForRefresh, setKeyForRefresh] = useState(0);
  const [quotedItem, setQuotedItem] = useState<any>(null);
  const [lineage, setLineage] = useState<any[]>([]);
  const [replyContext, setReplyContext] = useState<{
    id: number | string;
    type: 'project' | 'comment';
    author_name: string;
    author_avatar: string;
    author_account_type?: string;
    content: string;
    parentId?: number | string | null;
  } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showPermittedUsersModal, setShowPermittedUsersModal] = useState<number[] | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());

  const toggleReplies = (commentId: number) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  useEffect(() => {
    setError(null);
    fetch(`/api/projects/${id}?_t=${keyForRefresh}${user ? `&user_id=${encodeURIComponent(user.id)}` : ''}`)
      .then(res => {
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) throw new Error('Vision not found');
        return res.json();
      })
      .then(data => {
        if (!data || data.error) throw new Error(data?.error || 'Vision not found');
        setProject(data);
        setComments(data.comments || []);
        setLikeCount(data.likes_count || 0);
        setArchiveCount(data.archives_count || 0);
        setCommentCount(data.comments_count || 0);
        setFollowCount(data.follows_count || 0);
        
        if (data.quoted_item_id && data.quoted_item_type) {
          fetch(`/api/${data.quoted_item_type}s/${data.quoted_item_id}${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`)
            .then(res => {
              const ct = res.headers.get('content-type') || '';
              if (!res.ok || !ct.includes('application/json')) return null;
              return res.json();
            })
            .then(quoteData => {
              if (quoteData) setQuotedItem(quoteData);
            })
            .catch(err => console.error('Failed to fetch quoted item:', err));
        }

        // Fetch lineage
        fetch(`/api/lineage/project/${id}${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`)
          .then(res => {
            const ct = res.headers.get('content-type') || '';
            if (!res.ok || !ct.includes('application/json')) return [];
            return res.json();
          })
          .then(lData => setLineage(Array.isArray(lData) ? lData : []))
          .catch(err => console.error('Failed to fetch lineage:', err));
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      });

    if (user) {
      fetch(`/api/projects/${id}/membership?user_id=${encodeURIComponent(user.id)}`)
        .then(res => {
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) return null;
          return res.json();
        })
        .then(memData => {
          if (memData) setMembership(memData);
        }).catch(e => {});

      fetch(`/api/likes/check?user_id=${encodeURIComponent(user.id)}&item_id=${id}&item_type=project`)
        .then(res => {
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) return { liked: false };
          return res.json();
        })
        .then(data => {
          if (data) setIsLiked(Boolean(data.liked));
        }).catch(e => {});
        
      fetch(`/api/archives/check?user_id=${encodeURIComponent(user.id)}&item_id=${id}&item_type=project`)
        .then(res => {
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) return { archived: false };
          return res.json();
        })
        .then(data => {
          if (data) setIsArchived(Boolean(data.archived));
        }).catch(e => {});
    }

    fetch(`/api/likes/count?item_id=${id}&item_type=project`)
      .then(res => {
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) return { count: 0 };
        return res.json();
      })
      .then(data => {
        if (data) setLikeCount(data.count || 0);
      }).catch(e => {});

    if (user) {
      fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, item_id: id, item_type: 'project' })
      });
      // Mark offer notification as read
      fetch(`/api/users/${user.id}/notifications/read_offer/${id}`, { method: 'POST' })
        .then(() => refreshUnreadOfferCount());
    }
  }, [id, user, keyForRefresh]);

  const handleFollow = async () => {
    if (!user) return alert('Please login first');
    try {
      const res = await fetch(`/api/projects/${id}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_id: user.id })
      });
      if (res.ok) {
        setMembership({ isMember: false, status: 'pending' });
      } else {
        alert('Failed to send join request');
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (socket) {
      socket.emit('join_project', id);
      socket.on(`project:${id}:comment`, (comment: any) => {
        setComments(prev => [...prev, comment]);
        setCommentCount(prev => prev + 1);
      });

      return () => {
        socket.emit('leave_project', id);
        socket.off(`project:${id}:comment`);
      };
    }
  }, [id, socket]);

  const getProjectDesc = () => project ? (project.status === 'completed' ? (project.completed_description || project.description) : project.description) : "";
  const getProjectTitle = () => project ? (project.status === 'completed' ? (project.completed_title || project.title) : project.title) : "";

  const isDifferentLanguage = () => {
    const desc = getProjectDesc();
    if (!desc) return false;
    const text = desc.replace(/<[^>]*>?/gm, '').trim();
    if (!text) return false;
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    return language === 'ja' ? !hasJapanese : hasJapanese;
  };

  const handleTranslate = async () => {
    if (!showOriginal) {
      setShowOriginal(true);
      return;
    }
    
    if (translatedText) {
      setShowOriginal(false);
      return;
    }

    setIsTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: getProjectDesc(), 
          target_language: language === 'ja' ? 'Japanese' : 'English' 
        })
      });
      const data = await res.json();
      if (res.ok && data.translation) {
        setTranslatedText(data.translation);
        setShowOriginal(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleLike = async () => {
    if (!user) return alert('Please login first');
    try {
      if (isLiked) {
        await fetch('/api/likes', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, item_id: id, item_type: 'project' })
        });
        setLikeCount(prev => prev - 1);
      } else {
        await fetch('/api/likes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, item_id: id, item_type: 'project' })
        });
        setLikeCount(prev => prev + 1);
      }
      setIsLiked(!isLiked);
    } catch (e) {
      console.error(e);
    }
  };

  const handleArchive = async () => {
    if (!user) return alert('Please login first');
    try {
      if (isArchived) {
        await fetch('/api/archives', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, item_id: id, item_type: 'project' })
        });
        setArchiveCount(prev => prev - 1);
      } else {
        await fetch('/api/archives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, item_id: id, item_type: 'project' })
        });
        setArchiveCount(prev => prev + 1);
      }
      setIsArchived(!isArchived);
    } catch (e) {
      console.error(e);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    try {
      const res = await fetch(`/api/projects/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, content: newComment })
      });
      if (res.ok) {
        setNewComment('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitReply = async () => {
    if (!user || !replyText.trim() || !replyContext) return;

    const finalContent = replyContext.type === 'comment' 
      ? `@${replyContext.author_name} ${replyText}`
      : replyText;

    const parent_id = replyContext.type === 'comment' ? (replyContext.parentId || replyContext.id) : null;

    try {
      const res = await fetch(`/api/projects/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, content: finalContent, parent_id })
      });
      if (res.ok) {
        setReplyText('');
        setReplyContext(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const safeFormatDistance = (dateStr: string | null | undefined) => {
    try {
      if (!dateStr) return 'some time ago';
      const date = new Date((dateStr || '') + (!(dateStr || '').includes('Z') ? 'Z' : ''));
      if (isNaN(date.getTime())) return 'some time ago';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'some time ago';
    }
  };

  if (error) return (
    <div className="p-8 text-center">
      <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-8 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-white mb-2">Error</h2>
        <p className="text-slate-400 mb-6">{error}</p>
        <button 
          onClick={() => navigate('/')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl font-bold transition-all"
        >
          Back to Home
        </button>
      </div>
    </div>
  );

  if (!project) return <div className="p-8 text-center text-slate-400">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {fromNetwork ? (
        <button 
          onClick={() => navigate(-1)} 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Network
        </button>
      ) : fromCompleted || project.status === 'completed' ? (
        <Link to="/completed" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 mb-8 transition-colors">
          <ChevronLeft className="w-5 h-5" />
          {language === 'ja' ? 'ストアに戻る' : 'Back to Store'}
        </Link>
      ) : (
        <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-8 transition-colors">
          <ChevronLeft className="w-5 h-5" />
          Back to Home
        </Link>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Content (Note View) */}
        <div className="xl:col-span-2 space-y-8">
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col"
          >
            {/* Hero Image Section */}
            <div className="aspect-[21/9] relative bg-slate-900 overflow-hidden rounded-t-3xl">
              <img 
                src={project.image || undefined} 
                alt={project.title} 
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            
            <div className="flex-1 p-5 sm:p-8 md:p-12 relative flex flex-col">
              <div className="mb-6 sm:mb-8 flex items-center justify-between">
                <div>
                  {project.stage && Number(project.is_recruitment) !== 1 && (
                    <div className="inline-block rounded-xl">
                      <SimpleStageIndicator currentStage={project.stage} />
                    </div>
                  )}
                </div>

                {Number(project.is_private) === 1 && (
                  <button 
                    onClick={() => {
                      try {
                        const permitted = JSON.parse(project.permitted_users || '[]');
                        setShowPermittedUsersModal(permitted);
                      } catch (e) { console.error(e); }
                    }}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group"
                    title="View Permitted Users"
                  >
                    <Lock className="w-8 h-8 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" strokeWidth={2} />
                  </button>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-2 leading-tight tracking-tight break-words">
                <span>{getProjectTitle()}</span>
              </h1>
              
              {project.tags && (
                <div className="mb-6">
                  <HashtagDisplay tags={project.tags} />
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <Link to={`/profile/${project.author_id}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                  <img 
                    src={project.author_avatar || undefined} 
                    alt="" 
                    className={`w-12 h-12 rounded-full ${getAccountTypeBorderClass(project.author_account_type, 'border-2')} shadow-md object-cover`} 
                  />
                  <div>
                    <h3 className="text-slate-900 dark:text-white font-bold text-base hover:text-blue-500 transition-colors flex items-center gap-2 flex-wrap">
                      <span>{project.author_name}</span>
                      <AccountTypeBadge accountType={project.author_account_type || (project as any).account_type} size="xs" />
                      {(project.author_account_type === 'organization' || project.author_account_type === 'municipality' || project.author_account_type === 'corporate') && (project as any).author_org_plan && (
                        <OrgBadge plan={(project as any).author_org_plan} accountType={project.author_account_type} />
                      )}
                    </h3>
                    <p className="text-slate-500 text-xs">
                      {safeFormatDistance(project.created_at)}
                    </p>
                  </div>
                </Link>
                {project && project.author_id && (
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                    <SubscribeButton authorId={project.author_id} authorName={project.author_name} />
                    {(user?.account_type === 'organization' || user?.account_type === 'corporate' || user?.account_type === 'municipality') && user?.id !== project.author_id && (
                      <button
                        onClick={() => {
                          if (user.org_plan === 'basic' || !user.org_plan) {
                            setShowPlanUpgradeModal(true);
                          } else {
                            setShowScoutMessageModal(true);
                          }
                        }}
                        className={`flex items-center gap-1.5 ${
                          user?.account_type === 'municipality'
                            ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-900/20'
                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20'
                        } text-white px-4 py-2 rounded-full font-bold text-xs sm:text-sm transition-all shadow-lg`}
                      >
                        <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {language === 'ja' 
                          ? (user?.account_type === 'municipality' ? '官民連携スカウト' : '指名スカウト') 
                          : 'Direct Scout'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 mb-6">
                <LineageHistorySlider lineage={lineage} currentId={Number(id)} currentType="project" size="small" />
              </div>
              <div className="h-px bg-slate-200 dark:bg-slate-800 w-full mt-4 mb-8 opacity-50" />

              {/* Quoted Item Display */}
              {quotedItem && (
                <Link 
                  to={`/${project.quoted_item_type}/${project.quoted_item_id}`}
                  className="mb-10 p-5 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex gap-5 items-center hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all group/quote backdrop-blur-sm"
                >
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 shadow-md">
                    <img src={quotedItem.image || undefined} alt="" className="w-full h-full object-cover group-hover/quote:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400 mb-2 block opacity-80">
                      {project.quoted_item_type === 'project' ? 'Vision' : 'Idea'}
                    </span>
                    <h4 className="text-slate-900 dark:text-white font-bold text-lg truncate group-hover/quote:text-blue-500 transition-colors">{quotedItem.title}</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">by {quotedItem.author_name}</p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-slate-400 group-hover/quote:text-slate-900 dark:group-hover/quote:text-white group-hover/quote:translate-x-1 transition-all" />
                </Link>
              )}

              <div className="flex-1 relative">
                <div 
                  className="text-slate-700 dark:text-slate-300 text-lg md:text-xl leading-relaxed ql-editor !p-0 prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: !showOriginal && translatedText ? translatedText : getProjectDesc() }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const a = target.closest('a');
                    if (a && a.href) {
                      try {
                        const url = new URL(a.href);
                        if (url.origin === window.location.origin) {
                          e.preventDefault();
                          navigate(url.pathname + url.search + url.hash);
                        }
                      } catch (err) {}
                    }
                  }}
                />

                {isDifferentLanguage() && (
                  <div className="text-right mt-4">
                    <button 
                      onClick={handleTranslate}
                      disabled={isTranslating}
                      className="text-blue-500 font-medium hover:text-blue-400 text-sm transition-colors"
                    >
                      {isTranslating ? (language === 'ja' ? '翻訳中...' : 'Translating...') : (!showOriginal ? (language === 'ja' ? 'もとに戻す' : 'Show original') : (language === 'ja' ? '翻訳' : 'Translate'))}
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-16 pt-8 border-t border-slate-800/50 flex flex-col gap-8">
                {/* Action Icons Row */}
                <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-8 flex-wrap">
                  <button 
                    onClick={handleLike}
                    className={`flex items-center gap-2.5 transition-all hover:scale-110 ${isLiked ? 'text-pink-500' : 'text-slate-400 hover:text-pink-500'}`}
                    title="Like"
                  >
                    <Heart className={`w-7 h-7 ${isLiked ? 'fill-current' : ''}`} />
                    {likeCount > 0 && <span className="text-base font-bold">{likeCount}</span>}
                  </button>

                  <button 
                    onClick={() => {
                      if (!user) return alert('Please login first');
                      setReplyContext({
                        id: project.id,
                        type: 'project',
                        author_name: project.author_name,
                        author_avatar: project.author_avatar,
                        content: project.title
                      });
                    }}
                    className="flex items-center gap-2.5 text-slate-400 hover:text-blue-500 transition-all hover:scale-110"
                    title="Comment"
                  >
                    <MessageSquare className="w-7 h-7" />
                    {commentCount > 0 && <span className="text-base font-bold">{commentCount}</span>}
                  </button>

                  <button 
                    onClick={() => {
                      document.getElementById('idea-quotes-list')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2.5 text-slate-400 hover:text-yellow-400 transition-all hover:scale-110" 
                    title="Ideas"
                  >
                    <Lightbulb className="w-7 h-7" />
                    {project.quotes_count > 0 && <span className="text-base font-bold">{project.quotes_count}</span>}
                  </button>

                  <button 
                    onClick={() => {
                      if (!user) return alert('Please login first');
                      setIsShareModalOpen(true);
                    }}
                    className="flex items-center gap-2.5 text-slate-400 hover:text-blue-500 transition-all hover:scale-110" 
                    title="Share"
                  >
                    <Share2 className="w-7 h-7" />
                  </button>

                  {/* <button 
                    onClick={() => navigate(`/network/${id}?type=project`)}
                    className="flex items-center gap-2.5 text-slate-400 hover:text-blue-500 transition-all hover:scale-110" 
                    title="Network"
                  >
                    <NetworkIcon className="w-7 h-7" />
                  </button> */}

                  <button 
                    onClick={handleArchive}
                    className={`flex items-center gap-2.5 transition-all hover:scale-110 ${isArchived ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`}
                    title="Archive"
                  >
                    <Bookmark 
                      className={`w-7 h-7 ${isArchived ? 'fill-current' : ''}`}
                    />
                    {archiveCount > 0 && <span className="text-base font-bold">{archiveCount}</span>}
                  </button>
                </div>

                {user && project.author_id === user.id && project.pending_approvals_count > 0 && (
                  <Link to="/notifications" className="w-full flex items-center justify-between bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-3 rounded-xl mb-4 hover:bg-amber-500/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-bold text-sm">{language === 'ja' ? `承認待ち ${project.pending_approvals_count}件` : `${project.pending_approvals_count} Pending Approvals`}</span>
                    </div>
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                )}
                {/* Follow Button Row */}
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                  {membership.isMember ? (
                    <Link 
                      to={`/chat/project/${id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-3 bg-blue-500 hover:bg-blue-600 text-white px-3 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] min-w-0"
                    >
                      <MessageSquare className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
                      <span className="truncate flex-1 text-center">{user && project.author_id === user.id ? (language === 'ja' ? `グループチャット (${followCount})` : `Group Chat (${followCount})`) : (language === 'ja' ? `プロジェクトに参加済み (${followCount})` : `Joined Project (${followCount})`)}</span>
                    </Link>
                  ) : membership.status === 'pending' ? (
                    <button disabled className="flex-1 bg-slate-800 text-slate-400 px-3 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg border border-slate-700 cursor-not-allowed min-w-0">
                      <span className="truncate flex-1 text-center">{language === 'ja' ? `参加申請中 (${followCount})` : `Join Request Pending (${followCount})`}</span>
                    </button>
                  ) : Number(project.is_recruitment) === 1 && Number(project.is_private) !== 1 ? (
                    <button 
                      onClick={() => navigate(`/create?quoteId=${id}&quoteType=project&type=recruitment`)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-3 bg-emerald-500 hover:bg-emerald-600 text-white px-3 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg transition-all shadow-xl active:scale-[0.98] min-w-0"
                    >
                      <Lightbulb className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
                      <span className="truncate flex-1 text-center">
                        {language === 'ja' ? 'Ideaを投稿して、プロジェクトへ参加' : 'Submit Idea & Join Project'}
                      </span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowJoinModal(true)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-3 bg-white text-slate-900 hover:bg-slate-100 px-3 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg transition-all shadow-xl active:scale-[0.98] min-w-0"
                    >
                      <Users className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
                      <span className="truncate flex-1 text-center">{language === 'ja' ? `プロジェクトへ参加 (${followCount})` : `Join Project (${followCount})`}</span>
                    </button>
                  )}

                  {user && project.author_id === user.id && (
                    <button 
                      onClick={() => setIsAddMembersOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 sm:gap-3 bg-blue-500 hover:bg-blue-600 text-white px-3 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] shrink-0"
                    >
                      <UserPlus className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
                      <span>Add Members</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar (Ideas/Comments) */}
        <div className="xl:col-span-1 flex flex-col gap-8">
          <IdeaQuotesList item={{ id: parseInt(id!), type: 'project' }} isAuthor={user?.id === project.author_id} />

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                Comments ({comments.length})
              </h2>
            </div>
            
            {/* Inline Comment Placeholder */}
            <div className="p-6 pb-0">
              <button 
                onClick={() => {
                  if (!user) return alert('Please login first');
                  setReplyContext({
                    id: project.id,
                    type: 'project',
                    author_name: project.author_name,
                    author_avatar: project.author_avatar,
                    content: project.title
                  });
                }}
                className="w-full flex items-center gap-4 group/input p-1"
              >
                <img 
                  src={user?.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=guest'} 
                  alt="" 
                  className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" 
                />
                <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-full px-5 py-2.5 text-sm text-left group-hover/input:border-slate-400 dark:group-hover/input:border-slate-600 transition-colors">
                  コメントする
                </div>
              </button>
            </div>

            <div className="p-6 space-y-8">
              {(() => {
                const topLevelComments = comments.filter(c => !c.parent_id);
                const repliesMap = comments.reduce((acc, c) => {
                  if (c.parent_id) {
                    if (!acc[c.parent_id]) acc[c.parent_id] = [];
                    acc[c.parent_id].push(c);
                  }
                  return acc;
                }, {} as Record<number, any[]>);

                return topLevelComments.map((comment, i) => {
                  const replies = repliesMap[comment.id] || [];
                  const isExpanded = expandedComments.has(comment.id);
                  const authorName = comment.author_name || comment.username;
                  const authorAvatar = comment.author_avatar || comment.avatar;

                  return (
                    <div 
                      key={comment.id}
                      className="flex gap-4 group"
                    >
                      <img src={authorAvatar || undefined} alt="" className={`w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 mt-1 object-cover ${getAccountTypeBorderClass(comment.author_account_type || comment.account_type, 'border-2')}`} referrerPolicy="no-referrer" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{authorName}</span>
                            <span className="text-xs text-slate-500">
                              {safeFormatDistance(comment.created_at)}
                            </span>
                          </div>
                          <button className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                            <Send className="w-3.5 h-3.5 rotate-[-45deg]" />
                          </button>
                        </div>
                        
                        <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-3">
                          {comment.content}
                        </p>

                        <div className="flex items-center gap-4">
                          <button 
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-pink-500 transition-colors"
                          >
                            <Heart className="w-3.5 h-3.5" />
                            <span>1</span>
                          </button>
                          <button 
                            onClick={() => {
                              if (!user) return alert('Please login first');
                              setReplyContext({
                                id: comment.id,
                                type: 'comment',
                                author_name: authorName,
                                author_avatar: authorAvatar,
                                content: comment.content,
                                parentId: comment.parent_id || comment.id
                              });
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-500 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Reply</span>
                          </button>
                        </div>

                        {/* Replies Section */}
                        {replies.length > 0 && (
                          <div className="mt-4">
                            <button 
                              onClick={() => toggleReplies(comment.id)}
                              className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline transition-colors mb-4"
                            >
                              <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                <ChevronDown className="w-3 h-3" />
                              </div>
                              返信{replies.length}件
                            </button>

                            {isExpanded && (
                              <div className="space-y-4 border-l-2 border-slate-200 dark:border-slate-800 ml-2 pl-6">
                                {replies.map((reply) => (
                                  <div key={reply.id} className="flex gap-3">
                                    <img src={reply.author_avatar || reply.avatar || undefined} alt="" className={`w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 mt-1 object-cover ${getAccountTypeBorderClass(reply.author_account_type || reply.account_type, 'border-2')}`} referrerPolicy="no-referrer" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-bold text-slate-900 dark:text-white text-xs">{reply.author_name || reply.username}</span>
                                        <span className="text-[10px] text-slate-500">
                                          {safeFormatDistance(reply.created_at)}
                                        </span>
                                      </div>
                                      <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed ql-editor !p-0" dangerouslySetInnerHTML={{ __html: reply.content || "" }} />
                                      <button 
                                        onClick={() => {
                                          if (!user) return alert('Please login first');
                                          setReplyContext({
                                            id: reply.id,
                                            type: 'comment',
                                            author_name: reply.author_name || reply.username,
                                            author_avatar: reply.author_avatar || reply.avatar,
                                            content: reply.content,
                                            parentId: comment.id
                                          });
                                        }}
                                        className="mt-2 text-[10px] font-bold text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                      >
                                        Reply
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
              {comments.length === 0 && (
                <div className="py-12 text-center text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p className="text-sm">No comments yet.</p>
                </div>
              )}
            </div>
          </div>
          
          
        </div>
      </div>

      {/* Reply Modal */}
      {replyContext && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4 bg-slate-900/80 backdrop-blur-sm"
        >
          <div
            className="bg-slate-900 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <button onClick={() => setReplyContext(null)} className="text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={handleSubmitReply}
                disabled={!replyText.trim()}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white px-5 py-1.5 rounded-full font-bold text-sm transition-colors"
              >
                Submit
              </button>
            </div>
            
            <div className="p-4 flex flex-col">
              {/* Quoted Content */}
              <div className="flex gap-3 relative mb-2">
                <div className="absolute left-5 top-10 bottom-[-24px] w-0.5 bg-slate-700" />
                <img src={replyContext.author_avatar || undefined} alt="" className={`w-10 h-10 rounded-full bg-slate-800 shrink-0 z-10 ${getAccountTypeBorderClass(replyContext.author_account_type, 'border-2')} object-cover`} />
                <div className="pb-6">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{replyContext.author_name}</span>
                  </div>
                  <p className="text-slate-300 mt-1 text-sm line-clamp-3">{replyContext.content}</p>
                  <p className="text-slate-500 text-xs mt-2">
                    Replying to <span className="text-blue-400">@{replyContext.author_name}</span>
                  </p>
                </div>
              </div>

              {/* Reply Input */}
              <div className="flex gap-3">
                <img src={user?.avatar || undefined} alt="" className={`w-10 h-10 rounded-full bg-slate-800 shrink-0 z-10 ${getAccountTypeBorderClass(user?.account_type, 'border-2')} object-cover`} />
                <textarea
                  autoFocus
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Post your idea or reply"
                  className="w-full bg-transparent text-white text-lg resize-none outline-none placeholder-slate-500 min-h-[120px] pt-2"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button for Idea Post */}
      {user && project && (
        (Number(project.is_recruitment) === 1 && Number(project.is_private) !== 1)
          ? (user.account_type === 'organization' && project.author_id === user.id)
          : (project.author_id === user.id)
      ) && (
        <button 
          onClick={() => navigate(`/create?quoteId=${id}&quoteType=project`)}
          className="fixed bottom-24 right-6 md:bottom-28 md:right-12 z-[110] w-14 h-14 md:w-16 md:h-16 bg-blue-600 text-white hover:bg-blue-700 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-transform hover:scale-110"
          title="Update Vision (New Idea)"
        >
          <PenLine className="w-7 h-7" />
        </button>
      )}

      <AddMembersModal 
        isOpen={isAddMembersOpen}
        onClose={() => setIsAddMembersOpen(false)}
        itemId={id!}
        itemType="project"
        onMembersAdded={() => {
          fetch(`/api/projects/${id}${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`)
            .then(res => res.json())
            .then(data => {
              setProject(data);
              setFollowCount(data.follows_count || 0);
            });
        }}
      />
      
      {showJoinModal && (
        <JoinProjectModal
          projectName={project?.title || ''}
          onClose={() => setShowJoinModal(false)}
          onSubmit={async (data) => {
            const endpoint = `/api/projects/${id}/follow`;
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                follower_id: user?.id,
                ...data
              })
            });
            if (!res.ok) throw new Error('Failed to join');
            
            // update local state
            setMembership({ isMember: false, status: 'pending' });
          }}
        />
      )}
      
      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        item={{
          id: project.id,
          type: 'project',
          title: project.title,
          image: project.image,
          author_name: project.author_name
        }}
      />
      {showPermittedUsersModal && (
        <PermittedUsersModal 
          permittedUserIds={showPermittedUsersModal} 
          onClose={() => setShowPermittedUsersModal(null)} 
        />
      )}

      {showPlanUpgradeModal && (
        <PlanUpgradeModal onClose={() => setShowPlanUpgradeModal(false)} />
      )}

      {showScoutMessageModal && user && project && (
        <ScoutMessageModal
          onClose={() => setShowScoutMessageModal(false)}
          targetUserIds={[project.author_id.toString()]}
          targetUserNames={[project.author_name]}
          targetItemType="project"
          targetItemId={project.id.toString()}
          targetItemTitle={project.title}
          sourceType={
            Number(project.is_recruitment) === 1 && Number(project.is_private) === 1
              ? 'offer'
              : Number(project.is_recruitment) === 1
              ? 'recruitment'
              : 'direct'
          }
          offerId={Number(project.is_recruitment) === 1 && Number(project.is_private) === 1 ? project.id : undefined}
          offerTitle={Number(project.is_recruitment) === 1 && Number(project.is_private) === 1 ? project.title : undefined}
          offerContent={Number(project.is_recruitment) === 1 && Number(project.is_private) === 1 ? project.description : undefined}
          recruitmentId={Number(project.is_recruitment) === 1 && Number(project.is_private) !== 1 ? project.id : undefined}
          recruitmentTitle={Number(project.is_recruitment) === 1 && Number(project.is_private) !== 1 ? project.title : undefined}
          recruitmentContent={Number(project.is_recruitment) === 1 && Number(project.is_private) !== 1 ? project.description : undefined}
        />
      )}
    </div>
  );
}
