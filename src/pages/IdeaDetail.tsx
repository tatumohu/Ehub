import PreviousPageButton from '../components/project/PreviousPageButton';
import ProjectPostActions from '../components/project/ProjectPostActions';
import ProjectReplies from '../components/project/ProjectReplies';
import VisionQuoteCard from '../components/vision/VisionQuoteCard';
import useVisionRevision from '../components/vision/useVisionRevision';
import {replyCount} from '../components/vision/replyTools';
import JoinProjectModal from '../components/JoinProjectModal';
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import {
  MessageSquare,
  Heart,
  Share2,
  Users, X,
  Send,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserPlus,
  UserCheck,
  Network as NetworkIconLucide,
  Home as HomeIcon,
  Origami,
  PenLine,
  Bookmark,
  Lightbulb,
  Lock,
  Gavel,
  Target,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  History,
  GitBranch,
  Check,
  Landmark
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
import SimpleStageIndicator from '../components/SimpleStageIndicator';
import StageEvaluationModal from '../components/StageEvaluationModal';
import PermittedUsersModal from '../components/PermittedUsersModal';
import HashtagDisplay from '../components/HashtagDisplay';
import BuyoutJoinModal from '../components/BuyoutJoinModal';
import AuctionChatModal from '../components/AuctionChatModal';

import ProposalApprovalModal from '../components/ProposalApprovalModal';
import ProposalRemandModal from '../components/ProposalRemandModal';
import VersionHistoryModal from '../components/VersionHistoryModal';
import TreeModal from '../components/TreeModal';
import { ProjectContractModal } from '../components/ProjectContractModal';
import { ProjectContractViewModal } from '../components/ProjectContractViewModal';
import { Briefcase } from 'lucide-react';

import OrgBadge from '../components/OrgBadge';
import AccountTypeBadge from '../components/AccountTypeBadge';
import { getAccountTypeBorderClass } from '../utils/avatar';

export default function IdeaDetail() {
  const { id } = useParams();
  const revision=useVisionRevision();
  const loadSerial=useRef(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromNetwork = searchParams.get('from') === 'network';
  const fromCompleted = searchParams.get('from') === 'completed';
  const { user, socket, logout, language } = useAppContext();
  const [idea, setIdea] = useState<any>(null);
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
  useEffect(()=>setCommentCount(replyCount(comments)),[comments]);
  const [followCount, setFollowCount] = useState(0);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPlanUpgrade, setShowPlanUpgrade] = useState(false);
  const [showScoutMessage, setShowScoutMessage] = useState(false);
  const [keyForRefresh, setKeyForRefresh] = useState(0);
  const [quotedItem, setQuotedItem] = useState<any>(null);
  const [lineage, setLineage] = useState<any[]>([]);
  const [replyContext, setReplyContext] = useState<{
    id: number | string;
    type: 'idea' | 'comment';
    author_name: string;
    author_avatar: string;
    author_account_type?: string;
    content: string;
    parentId?: number | string | null;
  } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showPermittedUsersModal, setShowPermittedUsersModal] = useState<number[] | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [buyoutInfo, setBuyoutInfo] = useState<any>(null);
  const [showBuyoutModal, setShowBuyoutModal] = useState(false);
  const [showAuctionChat, setShowAuctionChat] = useState(false);
  const [buyoutApplications, setBuyoutApplications] = useState<any[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);

  // Proposal approval & Versioning & Tree modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRemandModal, setShowRemandModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showTreeModal, setShowTreeModal] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Project Contract state (プロジェクト型雇用)
  const [showCreateContractModal, setShowCreateContractModal] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [showViewContractModal, setShowViewContractModal] = useState(false);
  const [existingContracts, setExistingContracts] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      fetch(`/api/project-contracts?idea_id=${id}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setExistingContracts(data))
        .catch(err => console.error(err));
    }
  }, [id, keyForRefresh]);

  const handleApproveProposal = async () => {
    if (!user || !idea) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/ideas/${id}/approve_proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_id: user.id })
      });
      if (res.ok) {
        setShowApprovalModal(false);
        setKeyForRefresh(prev => prev + 1);
      } else {
        const err = await res.json();
        alert(`承認に失敗しました: ${err.error || 'エラー'}`);
      }
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRemandProposalSubmit = async ({ reason, requestedChanges, notes }: { reason: string; requestedChanges: string; notes: string }) => {
    if (!user || !idea) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/ideas/${id}/reject_proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approver_id: user.id,
          reason,
          requested_changes: requestedChanges,
          notes
        })
      });
      if (res.ok) {
        setShowRemandModal(false);
        setKeyForRefresh(prev => prev + 1);
      } else {
        const err = await res.json();
        alert(`差し戻しに失敗しました: ${err.error || 'エラー'}`);
      }
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました');
    } finally {
      setIsActionLoading(false);
    }
  };

  useEffect(() => {
    if (buyoutInfo?.id) {
      fetch(`/api/buyouts/${buyoutInfo.id}/applications`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setBuyoutApplications(data); else console.error("Not an array:", data);
        }).catch(e => console.error(e));
    }
  }, [buyoutInfo?.id]);

  const toggleReplies = (commentId: number) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  useEffect(() => {
    const loadId=++loadSerial.current;
    setError(null);
    fetch(`/api/ideas/${id}?_t=${keyForRefresh}${user ? `&user_id=${encodeURIComponent(user.id)}` : ''}`)
      .then(res => {
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) throw new Error('Idea not found');
        return res.json();
      })
      .then(data => {
        if (!data || data.error) throw new Error(data?.error || 'Idea not found');
        if(loadId!==loadSerial.current)return;
        setTranslatedText(null);setShowOriginal(true);
        setIdea(data);

        // Save to recently viewed visions in localStorage
        if (data.id) {
          try {
            const existing = JSON.parse(localStorage.getItem('ehub_recently_viewed_visions') || '[]');
            const updated = [Number(data.id), ...existing.filter((x: any) => Number(x) !== Number(data.id))].slice(0, 10);
            localStorage.setItem('ehub_recently_viewed_visions', JSON.stringify(updated));
          } catch (e) {}
        }

        setComments(data.comments || []);
        setLikeCount(data.likes_count || 0);
        setArchiveCount(data.archives_count || 0);
        setCommentCount(data.comments_count || 0);
        setFollowCount(data.follows_count || 0);

        if (data.is_buyout) {
          fetch(`/api/buyouts/item/idea/${id}`)
            .then(res => {
              const ct = res.headers.get('content-type') || '';
              if (!res.ok || !ct.includes('application/json')) return null;
              return res.json();
            })
            .then(bData => {
              if (bData && !bData.error) setBuyoutInfo(bData);
            }).catch(e => console.error(e));
        }

        if (data.quoted_item_id && data.quoted_item_type) {
          fetch(`/api/${data.quoted_item_type}s/${data.quoted_item_id}${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`)
            .then(res => {
              const ct = res.headers.get('content-type') || '';
              if (!res.ok || !ct.includes('application/json')) return null;
              return res.json();
            })
            .then(quoteData => {
              setQuotedItem(quoteData||null);
            })
            .catch(err => console.error('Failed to fetch quoted item:', err));
        }

        // Fetch lineage
        fetch(`/api/lineage/idea/${id}${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`)
          .then(res => {
            const ct = res.headers.get('content-type') || '';
            if (!res.ok || !ct.includes('application/json')) return [];
            return res.json();
          })
          .then(lData => {
            const list = Array.isArray(lData) ? lData : [];
            setLineage(list);
            const root = list[0] || {id:Number(id),type:'idea'};
            const rootCollection = root.type === 'project' ? 'projects' : 'ideas';
            if(user){
              const readJson=async(url:string)=>{const res=await fetch(url);return res.ok?res.json():null};
              // The private proposal's request is saved on this Idea. Preserve its
              // own membership/pending state before falling back to the parent group.
              Promise.all([
                readJson(`/api/ideas/${id}/membership?user_id=${encodeURIComponent(user.id)}`),
                readJson(`/api/${rootCollection}/${root.id}/membership?user_id=${encodeURIComponent(user.id)}`),
                readJson(`/api/${rootCollection}/${root.id}?user_id=${encodeURIComponent(user.id)}`)
              ]).then(([ownMembership,rootMembership,rootPost])=>{
                if(loadId!==loadSerial.current)return;
                const ownState=ownMembership?.isMember||['pending','left'].includes(ownMembership?.status);
                setMembership(ownState?ownMembership:(rootMembership||ownMembership||{isMember:false,status:'none'}));
                if(rootPost&&!ownState&&Number(data.is_private)!==1)setFollowCount(rootPost.follows_count||0);
              }).catch(()=>{});
            }

          })
          .catch(err => console.error('Failed to fetch lineage:', err));
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      });

    if (user) {
      fetch(`/api/likes/check?user_id=${encodeURIComponent(user.id)}&item_id=${id}&item_type=idea`)
        .then(res => {
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) return { liked: false };
          return res.json();
        })
        .then(data => {
          if (data) setIsLiked(Boolean(data.liked));
        }).catch(e => {});

      fetch(`/api/archives/check?user_id=${encodeURIComponent(user.id)}&item_id=${id}&item_type=idea`)
        .then(res => {
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) return { archived: false };
          return res.json();
        })
        .then(data => {
          if (data) setIsArchived(Boolean(data.archived));
        }).catch(e => {});

      fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, item_id: id, item_type: 'idea' })
      });
    }

    fetch(`/api/likes/count?item_id=${id}&item_type=idea`)
      .then(res => {
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) return { count: 0 };
        return res.json();
      })
      .then(data => {
        if (data) setLikeCount(data.count || 0);
      }).catch(e => {});

    if (socket) {
      socket.emit('join_idea', id);
      socket.on(`idea:${id}:comment`, (comment: any) => {
        setComments(prev => prev.some(c=>c.id===comment.id)?prev:[...prev,comment]);

      });

      return () => {
        socket.emit('leave_idea', id);
        socket.off(`idea:${id}:comment`);
      };
    }
  }, [id, user, socket, keyForRefresh, revision]);

  const handleFollow = async (data?: any) => {
    if (!user) return alert('Please login first');
    const rootEmaId = lineage.length > 0 ? lineage[0].id : id;
    try {
      const res = await fetch(`/api/projects/${rootEmaId}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_id: user.id, ...data })
      });
      if (res.ok) {
        setMembership({ isMember: false, status: 'pending' });
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === 'User not found') {
          alert('Session expired. Please login again.');
          logout();
          navigate('/');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isDifferentLanguage = () => {
    if (!idea || !idea.description) return false;
    const text = idea.description.replace(/<[^>]*>?/gm, '').trim();
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
          text: idea.description,
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
          body: JSON.stringify({ user_id: user.id, item_id: id, item_type: 'idea' })
        });
        setLikeCount(prev => prev - 1);
      } else {
        const res = await fetch('/api/likes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, item_id: id, item_type: 'idea' })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (errData.error === 'User not found') {
            alert('Session expired. Please login again.');
            logout();
            navigate('/');
            return;
          }
        }
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
          body: JSON.stringify({ user_id: user.id, item_id: id, item_type: 'idea' })
        });
        setArchiveCount(prev => prev - 1);
      } else {
        const res = await fetch('/api/archives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, item_id: id, item_type: 'idea' })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (errData.error === 'User not found') {
            alert('Session expired. Please login again.');
            logout();
            navigate('/');
            return;
          }
        }
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

    const res = await fetch(`/api/ideas/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, content: newComment })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (errData.error === 'User not found') {
        alert('Session expired. Please login again.');
        logout();
        navigate('/');
        return;
      }
    }

    setNewComment('');
  };

  const handleSubmitReply = async () => {
    if (!user || !replyText.trim() || !replyContext) return;

    const finalContent = replyContext.type === 'comment'
      ? `@${replyContext.author_name} ${replyText}`
      : replyText;

    const parent_id = replyContext.type === 'comment' ? (replyContext.parentId || replyContext.id) : null;

    await fetch(`/api/ideas/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        content: finalContent,
        parent_id
      })
    });

    setReplyText('');
    setReplyContext(null);
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
        <h2 className="text-xl font-bold text-slate-900 mb-2">Error</h2>
        <p className="text-slate-600 mb-6">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl font-bold transition-all"
        >
          Back to Vision
        </button>
      </div>
    </div>
  );

  if (!idea) return <div className="p-8 text-center text-slate-600">Loading...</div>;

  return (
    <div data-testid="project-post-detail" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {Number(idea.is_recruitment)===1?<PreviousPageButton/>:(fromNetwork ? (
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Network
        </button>
      ) : fromCompleted || lineage.some(item => item.status === 'completed') ? (
        <Link to="/completed" className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-700 mb-8 transition-colors">
          <ChevronLeft className="w-5 h-5" />
          {language === 'ja' ? 'ストアに戻る' : 'Back to Store'}
        </Link>
      ) : (
        <Link to="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8 transition-colors">
          <ChevronLeft className="w-5 h-5" />
          Back to Vision
        </Link>
      ))}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Content (Note View) */}
        <div className="xl:col-span-2 space-y-8">
          <div
            className="bg-white  rounded-3xl border border-slate-200  shadow-xl flex flex-col"
          >
            {/* Hero Image Section */}
            <div data-project-media="true" className="aspect-[21/9] relative bg-white overflow-hidden rounded-t-3xl">
              {idea.image&&<img data-testid="project-cover"
                src={idea.image || undefined}
                alt={idea.title}
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />}
              {idea.image&&<div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent"/>}

              {Number(idea.is_buyout) === 1 && (
                <div className="absolute top-4 left-4 z-20 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 flex items-center shadow-lg rounded-full border border-emerald-400/30">
                  <span className="text-sm font-black text-white tracking-widest leading-none drop-shadow-sm">
                    {language === 'ja' ? 'バイアウト' : 'Buyout'} {buyoutInfo && `(${buyoutInfo.buyout_type === 'fixed' ? (language === 'ja' ? '固定価格' : 'Fixed Price') : (language === 'ja' ? 'オークション' : 'Auction')})`}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 p-5 sm:p-8 md:p-12 relative flex flex-col">
              <div className="mb-6 sm:mb-8 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {idea.stage && Number(idea.is_recruitment) !== 1 && (
                    <div className="inline-block rounded-xl">
                      <SimpleStageIndicator currentStage={idea.stage} />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Section 19: Approval / Remand Buttons for Pending Edit Proposal */}
                  {user && idea.status === 'pending_approval' && (quotedItem?.author_id === user.id || (lineage.length > 0 && lineage[0]?.author_id === user.id) || idea.author_id === user.id) && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowRemandModal(true)}
                        className="px-3.5 py-1.5 bg-slate-100  hover:bg-amber-500/20 text-amber-700  hover:text-amber-800 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        差し戻し
                      </button>
                      <button
                        onClick={() => setShowApprovalModal(true)}
                        className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-500/20"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        承認
                      </button>
                    </div>
                  )}

                  {Number(idea.is_private) === 1 && (
                    <button
                      onClick={() => {
                        try {
                          const permitted = JSON.parse(idea.permitted_users || '[]');
                          setShowPermittedUsersModal(permitted);
                        } catch (e) { console.error(e); }
                      }}
                      className="p-2 hover:bg-slate-100  rounded-lg transition-colors group"
                      title="View Permitted Users"
                    >
                      <Lock className="w-6 h-6 text-slate-600 group-hover:text-slate-900  transition-colors" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>

              {/* Version Badge Bar */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button
                  onClick={() => setShowVersionModal(true)}
                  className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600  border border-blue-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>v{idea.version || 1} (履歴を見る)</span>
                </button>
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-end gap-3"><ProjectPostActions post={{...idea,type:'idea'}}/>{idea.project_edited_at&&<span className="text-xs text-slate-500">{language==='ja'?'編集済み':'Edited'}</span>}
      {user && idea && lineage.length > 0 && (
        (Number(lineage[0].is_recruitment) === 1 && Number(lineage[0].is_private) !== 1)
          ? (user.account_type === 'organization' && lineage[0].author_id === user.id)
          : (lineage[0].author_id === user.id)
      ) && (
        <button
          onClick={() => navigate(`/create?quoteId=${id}&quoteType=idea`)}
          data-testid="project-update-post" className={Number(idea.is_recruitment)===1?"inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700":"fixed bottom-24 right-6 md:bottom-28 md:right-12 z-[110] w-14 h-14 md:w-16 md:h-16 bg-blue-600 text-white hover:bg-blue-700 rounded-full flex items-center justify-center shadow-lg"}
          title="Update Idea"
        >
          <PenLine className={Number(idea.is_recruitment)===1?"h-4 w-4":"h-7 w-7"}/>{Number(idea.is_recruitment)===1&&<span>{language==='ja'?'更新投稿を作成':'Create update post'}</span>}
        </button>
      )}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900  mb-2 leading-tight tracking-tight break-words">
                <span>{idea.title}</span>
              </h1>

              {idea.tags && (
                <div className="mb-6">
                  <HashtagDisplay tags={idea.tags} />
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <Link to={`/profile/${idea.author_id}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                  <img
                    src={idea.author_avatar || undefined}
                    alt=""
                    className={`w-12 h-12 rounded-full ${getAccountTypeBorderClass(idea.author_account_type, 'border-2')} shadow-md object-cover`}
                  />
                  <div>
                    <h3 className="text-slate-900  font-bold text-base hover:text-blue-500 transition-colors flex items-center gap-2 flex-wrap">
                      <span>{idea.author_name}</span>
                      <AccountTypeBadge accountType={idea.author_account_type || (idea as any).account_type} size="xs" />
                      {(idea.author_account_type === 'organization' || idea.author_account_type === 'municipality' || idea.author_account_type === 'corporate') && (idea as any).author_org_plan && (
                        <OrgBadge plan={(idea as any).author_org_plan} accountType={idea.author_account_type} />
                      )}
                    </h3>
                    <p className="text-slate-500 text-xs">
                      {safeFormatDistance(idea.created_at)}
                    </p>
                  </div>
                </Link>
                {idea && idea.author_id && (
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                    <SubscribeButton authorId={idea.author_id} authorName={idea.author_name} />

                    {/* Project Contract Action Button (項目74, 75: プロジェクト型雇用) */}
                    {user && (
                      user.account_type === 'organization' && user.id !== idea.author_id ? (
                        <button
                          onClick={() => {
                            if (existingContracts.length > 0) {
                              setSelectedContractId(existingContracts[0].id);
                              setShowViewContractModal(true);
                            } else {
                              setShowCreateContractModal(true);
                            }
                          }}
                          className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-4 py-2 rounded-full font-bold text-xs sm:text-sm transition-all shadow-lg shadow-indigo-900/20"
                        >
                          <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          {existingContracts.length > 0 ? 'Project Contractを確認' : 'Project Contractを締結'}
                        </button>
                      ) : (
                        existingContracts.length > 0 && (
                          <button
                            onClick={() => {
                              setSelectedContractId(existingContracts[0].id);
                              setShowViewContractModal(true);
                            }}
                            className="flex items-center gap-1.5 bg-indigo-50  text-indigo-600  border border-indigo-200  px-4 py-2 rounded-full font-bold text-xs sm:text-sm hover:bg-indigo-100 transition-all"
                          >
                            <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Project Contract ({existingContracts[0].contract_status === 'active' ? '進行中' : existingContracts[0].contract_status === 'awaiting_payment' ? '決済待ち' : '確認中'})
                          </button>
                        )
                      )
                    )}

                    {(user?.account_type === 'organization' || user?.account_type === 'corporate' || user?.account_type === 'municipality') && user?.id !== idea.author_id && (
                      <button
                        onClick={() => {
                          if (user.org_plan === 'basic' || !user.org_plan) {
                            setShowPlanUpgrade(true);
                          } else {
                            setShowScoutMessage(true);
                          }
                        }}
                        className={`flex items-center gap-1.5 ${
                          user?.account_type === 'municipality'
                            ? 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-500/40'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
                        } px-3.5 py-2 rounded-full font-bold text-xs sm:text-sm transition-all`}
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
                <LineageHistorySlider lineage={lineage} currentId={Number(id)} currentType="idea" size="small" />
              </div>
              <div className="h-px bg-slate-200  w-full mt-4 mb-8 opacity-50" />

              {/* Municipality Project E-hub Flow Banner */}
              {idea.author_account_type === 'municipality' && (
                <div className="mb-8 p-4 md:p-5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-slate-900  shadow-sm backdrop-blur-sm">
                  <div className="flex items-center gap-2 font-bold text-sm text-purple-700  mb-2">
                    <Landmark className="w-5 h-5 text-purple-600  shrink-0" />
                    <span>自治体 Project （E-hub 地域課題共創構造）</span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold text-purple-900  pb-2 mb-2 border-b border-purple-500/20">
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/30 shrink-0">自治体</span>
                    <span>↓</span>
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/30 shrink-0">Project公開</span>
                    <span>↓</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-800  border border-emerald-400/30 shrink-0">個人・法人がIdeaを投稿</span>
                    <span>↓</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800  border border-amber-400/30 shrink-0">Ideaを検討</span>
                    <span>↓</span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-800  border border-blue-400/30 shrink-0">必要に応じてProject化</span>
                  </div>
                  <p className="text-xs text-slate-600  leading-relaxed">
                    このProjectは自治体による地域課題の募集です。個人・法人の皆様から寄せられたIdeaを自治体で検討し、官民連携や実証実験など必要に応じて更なるProject化へ進みます。
                  </p>
                </div>
              )}

              {/* Quoted Item Display */}
              {idea.quoted_item_id&&idea.quoted_item_type&&<VisionQuoteCard reference={{id:idea.quoted_item_id,type:idea.quoted_item_type}}/>}

              <div className="flex-1 relative">
                <div
                  data-testid="project-post-body" className="text-slate-700  text-lg md:text-xl leading-relaxed ql-editor !p-0 prose  max-w-none"
                  dangerouslySetInnerHTML={{ __html: !showOriginal && translatedText ? translatedText : (idea.description || "") }}
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
                      className="text-blue-500 font-medium hover:text-blue-600 text-sm transition-colors"
                    >
                      {isTranslating ? (language === 'ja' ? '翻訳中...' : 'Translating...') : (!showOriginal ? (language === 'ja' ? 'もとに戻す' : 'Show original') : (language === 'ja' ? '翻訳' : 'Translate'))}
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-16 pt-8 border-t border-slate-200/50 flex flex-col gap-8">
                {/* Action Icons Row */}
                <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-8 flex-wrap">
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-2.5 transition-all hover:scale-110 ${isLiked ? 'text-pink-500' : 'text-slate-600 hover:text-pink-500'}`}
                    title="Like"
                  >
                    <Heart className={`w-7 h-7 ${isLiked ? 'fill-current' : ''}`} />
                    {likeCount > 0 && <span className="text-base font-bold">{likeCount}</span>}
                  </button>

                  <button
                    onClick={() => {
                      if (!user) return alert('Please login first');
                      setReplyContext({
                        id: idea.id,
                        type: 'idea',
                        author_name: idea.author_name,
                        author_avatar: idea.author_avatar,
                        content: idea.title
                      });
                    }}
                    className="flex items-center gap-2.5 text-slate-600 hover:text-blue-500 transition-all hover:scale-110"
                    title="Comment"
                  >
                    <MessageSquare className="w-7 h-7" />
                    {commentCount > 0 && <span className="text-base font-bold">{commentCount}</span>}
                  </button>

                  <button
                    onClick={() => {
                      document.getElementById('idea-quotes-list')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2.5 text-slate-600 hover:text-yellow-400 transition-all hover:scale-110"
                    title="Ideas"
                  >
                    <Lightbulb className="w-7 h-7" />
                    {idea.quotes_count > 0 && <span className="text-base font-bold">{idea.quotes_count}</span>}
                  </button>

                  <button
                    onClick={() => {
                      if (!user) return alert('Please login first');
                      setIsShareModalOpen(true);
                    }}
                    className="flex items-center gap-2.5 text-slate-600 hover:text-blue-500 transition-all hover:scale-110"
                    title="Share"
                  >
                    <Share2 className="w-7 h-7" />
                  </button>

                  {/* <button
                    onClick={() => navigate(`/network/${id}?type=idea`)}
                    className="flex items-center gap-2.5 text-slate-600 hover:text-blue-500 transition-all hover:scale-110"
                    title="Network"
                  >
                    <NetworkIcon className="w-7 h-7" />
                  </button> */}

                  <button
                    onClick={handleArchive}
                    className={`flex items-center gap-2.5 transition-all hover:scale-110 ${isArchived ? 'text-emerald-500' : 'text-slate-600 hover:text-emerald-500'}`}
                    title="Archive"
                  >
                    <Bookmark
                      className={`w-7 h-7 ${isArchived ? 'fill-current' : ''}`}
                    />
                    {archiveCount > 0 && <span className="text-base font-bold">{archiveCount}</span>}
                  </button>
                </div>

                {user && idea.author_id === user.id && idea.pending_approvals_count > 0 && (
                  <Link to="/notifications" className="w-full flex items-center justify-between bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-3 rounded-xl mb-4 hover:bg-amber-500/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-bold text-sm">{language === 'ja' ? `承認待ち ${idea.pending_approvals_count}件` : `${idea.pending_approvals_count} Pending Approvals`}</span>
                    </div>
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                )}
                {/* Follow Button Row */}
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                  {membership.isMember ? (
                    <button
                      disabled
                      className="flex-1 bg-blue-500/20 text-blue-600 px-3 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg border border-blue-500/30 cursor-not-allowed min-w-0"
                    >
                      <span className="truncate flex-1 text-center text-slate-900">{user && idea.author_id === user.id ? (language === 'ja' ? `グループチャット (${followCount})` : `Group Chat (${followCount})`) : (language === 'ja' ? `プロジェクトに参加済み (${followCount})` : `Joined Project (${followCount})`)}</span>
                    </button>
                  ) : membership.status === 'pending' ? (
                    <button disabled className="flex-1 bg-slate-50 text-slate-600 px-3 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg border border-slate-200 cursor-not-allowed min-w-0">
                      <span className="truncate">{language === 'ja' ? `参加申請中 (${followCount})` : `Join Request Pending (${followCount})`}</span>
                    </button>
                  ) : Number(idea.is_recruitment) === 1 && Number(idea.is_private) !== 1 ? (
                    <button
                      onClick={() => navigate(`/create?quoteId=${id}&quoteType=idea&type=recruitment`)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-3 bg-emerald-700 hover:bg-emerald-800 text-white px-3 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg transition-all shadow-xl active:scale-[0.98] min-w-0"
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

                  {user && idea.author_id === user.id && (
                    <button
                      data-testid="project-add-members" onClick={() => setIsAddMembersOpen(true)}
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

          {buyoutInfo && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 md:p-8 mt-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Gavel className="w-6 h-6 text-emerald-500" />
                  {language === 'ja' ? 'バイアウト参加者' : 'Buyout Applications'}
                </h2>
                <div className="text-slate-600 text-sm font-bold bg-slate-50 px-4 py-2 rounded-full border border-slate-200">
                  {buyoutApplications.length} {language === 'ja' ? '名参加' : 'participants'}
                </div>
              </div>
              {Number(buyoutInfo.creator_id) === Number(user?.id) && buyoutInfo.buyout_type === 'auction' && buyoutInfo.status === 'active' && (!buyoutInfo.end_date || new Date() >= new Date(buyoutInfo.end_date)) && (
                <button
                  onClick={async (e) => { e.stopPropagation();
                    try {
                      const res = await fetch(`/api/buyouts/${buyoutInfo.id}/auction/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_user_id: user?.id }) });
                      if (res.ok) window.location.reload();
                    } catch(err) {}
                  }}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full font-bold shadow-lg transition-colors text-sm"
                >
                  {language === 'ja' ? 'オークション終了' : 'End Auction'}
                </button>
              )}

            <div className="space-y-4">
              {buyoutApplications.map((app: any, index: number) => {
                const isCreator = Number(buyoutInfo.creator_id) === Number(user?.id);
                const isMe = app.user_id === user?.id;
                const displayName = app.user_name || (language === 'ja' ? `ユーザー${index + 1}` : `User ${index + 1}`);
                const displayAvatar = app.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.user_name || 'U')}&background=random`;

                return (
                  <div key={app.id} className="bg-slate-50/50 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-200/50 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedApplication(app)}>
                    <div className="flex items-center gap-4">
                      <img src={displayAvatar} alt={displayName} className={`w-12 h-12 rounded-full object-cover ${getAccountTypeBorderClass(app.account_type, 'border-2')} bg-slate-50`} />
                      <div>
                        <div className="font-bold text-slate-900 text-lg">{displayName}</div>
                        <div className="text-sm text-slate-600">
                          {new Date(app.created_at + (!app.created_at.includes('Z') ? 'Z' : '')).toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 md:min-w-[200px]">
                      <div className="text-2xl font-black text-emerald-700">
                        ¥{app.price?.toLocaleString()}
                      </div>
                      {Number(buyoutInfo.creator_id) === Number(user?.id) && buyoutInfo.buyout_type === 'fixed' && buyoutInfo.status === 'active' && (
                        <button
                          onClick={async (e) => { e.stopPropagation();
                            try {
                              const res = await fetch(`/api/buyouts/${buyoutInfo.id}/select`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ user_id: app.user_id, current_user_id: user?.id })
                              });
                              if (res.ok) window.location.reload();
                            } catch(e) { console.error(e); }
                          }}
                          className="px-6 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full font-bold shadow-lg transition-colors shrink-0"
                        >
                          {language === 'ja' ? '選択' : 'Select'}
                        </button>
                      )}
                      {app.status === 'selected' && (
                        <div className="flex flex-col items-end gap-2">
                          <span className="px-4 py-1.5 bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 rounded-full font-bold text-sm shrink-0">
                            {language === 'ja' ? '落札者' : 'Winner'}
                          </span>
                          {buyoutInfo.status === 'paid' && (
                            <span className="px-4 py-1.5 bg-blue-500/20 text-blue-600 border border-blue-500/30 rounded-full font-bold text-sm shrink-0">
                              {language === 'ja' ? '支払完了' : 'Paid'}
                            </span>
                          )}
                          {app.user_id === user?.id && buyoutInfo.status === 'completed' && (
                            <button
                              onClick={async (e) => { e.stopPropagation();
                                try {
                                  const res = await fetch(`/api/buyouts/${buyoutInfo.id}/transfer`, {
                                    method: 'POST'
                                  });
                                  if (res.ok) {
                                    window.location.reload();
                                  } else {
                                    const data = await res.json();
                                    alert(data.error || 'Transfer failed');
                                  }
                                } catch (err) {
                                  console.error(err);
                                  alert('Error connecting to server');
                                }
                              }}
                              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-bold shadow-lg transition-colors shrink-0 whitespace-nowrap"
                            >
                              {language === 'ja' ? '支払って所有権を移行' : 'Pay & Transfer Ownership'}
                            </button>
                          )}
                        </div>
                      )}
                      {app.status === 'rejected' && idea.author_id === user?.id && (
                          <span className="px-4 py-1.5 bg-slate-50 text-slate-500 rounded-full font-bold text-sm shrink-0">
                            {language === 'ja' ? '落選' : 'Rejected'}
                          </span>
                        )}
                      </div>
                    </div>
                  ); })}
                {buyoutApplications.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    {language === 'ja' ? 'まだ参加者がいません' : 'No applications yet'}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

        {/* Sidebar (Comments) */}
        <div className="xl:col-span-1 flex flex-col gap-8">
          <IdeaQuotesList item={{ id: parseInt(id!), type: 'idea' }} />

          {Number(idea.is_recruitment)===1?<ProjectReplies post={{...idea,type:'idea'}} replies={comments}/>: (
          <div className="bg-white rounded-3xl border border-slate-200 flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                Comments ({comments.length})
              </h2>
            </div>

            <div className="p-6 pb-0">
              <button
                onClick={() => {
                  if (!user) return alert('Please login first');
                  setReplyContext({
                    id: idea.id,
                    type: 'idea',
                    author_name: idea.author_name,
                    author_avatar: idea.author_avatar,
                    content: idea.title
                  });
                }}
                className="w-full flex items-center gap-4 group/input p-1"
              >
                <img
                  src={user?.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=guest'}
                  alt=""
                  className={`w-10 h-10 rounded-full bg-slate-50 ${getAccountTypeBorderClass(user?.account_type, 'border-2')} object-cover`}
                />
                <div className="flex-1 bg-slate-50/50 border border-slate-200 text-slate-500 rounded-full px-5 py-2.5 text-sm text-left group-hover/input:border-slate-300 transition-colors">
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
                      <img src={authorAvatar || undefined} alt="" className={`w-10 h-10 rounded-full bg-slate-50 shrink-0 mt-1 ${getAccountTypeBorderClass(comment.author_account_type || comment.account_type, 'border-2')} object-cover`} referrerPolicy="no-referrer" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-slate-900 text-sm">{authorName}</span>
                            <span className="text-xs text-slate-500">
                              {safeFormatDistance(comment.created_at)}
                            </span>
                          </div>
                          <button className="text-slate-600 hover:text-slate-900 transition-colors opacity-0 group-hover:opacity-100">
                            <Send className="w-3.5 h-3.5 rotate-[-45deg]" />
                          </button>
                        </div>

                        <p className="text-slate-700 text-sm leading-relaxed mb-3">
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
                              className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-300 transition-colors mb-4"
                            >
                              <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                <ChevronDown className="w-3 h-3" />
                              </div>
                              返信{replies.length}件
                            </button>

                            {isExpanded && (
                              <div className="space-y-4 border-l-2 border-slate-200 ml-2 pl-6">
                                {replies.map((reply) => (
                                  <div key={reply.id} className="flex gap-3">
                                    <img src={reply.author_avatar || reply.avatar || undefined} alt="" className={`w-8 h-8 rounded-full bg-slate-50 shrink-0 mt-1 ${getAccountTypeBorderClass(reply.author_account_type || reply.account_type, 'border-2')} object-cover`} referrerPolicy="no-referrer" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-bold text-slate-900 text-xs">{reply.author_name || reply.username}</span>
                                        <span className="text-[10px] text-slate-500">
                                          {safeFormatDistance(reply.created_at)}
                                        </span>
                                      </div>
                                      <p className="text-slate-700 text-xs leading-relaxed ql-editor !p-0" dangerouslySetInnerHTML={{ __html: reply.content || "" }} />
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
                                        className="mt-2 text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors"
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
          )}


        </div>
      </div>

      {/* Reply Modal */}
      {replyContext && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-sm"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <button onClick={() => setReplyContext(null)} className="text-slate-600 hover:text-slate-900 transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleSubmitReply}
                disabled={!replyText.trim()}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white px-5 py-1.5 rounded-full font-bold text-sm transition-colors"
              >
                Reply
              </button>
            </div>

            <div className="p-4 flex flex-col">
              {/* Quoted Content */}
              <div className="flex gap-3 relative mb-2">
                <div className="absolute left-5 top-10 bottom-[-24px] w-0.5 bg-slate-100" />
                <img src={replyContext.author_avatar || undefined} alt="" className={`w-10 h-10 rounded-full bg-slate-50 shrink-0 z-10 ${getAccountTypeBorderClass(replyContext.author_account_type, 'border-2')} object-cover`} />
                <div className="pb-6">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{replyContext.author_name}</span>
                  </div>
                  <p className="text-slate-700 mt-1 text-sm line-clamp-3">{replyContext.content}</p>
                  <p className="text-slate-500 text-xs mt-2">
                    Replying to <span className="text-blue-600">@{replyContext.author_name}</span>
                  </p>
                </div>
              </div>

              {/* Reply Input */}
              <div className="flex gap-3">
                <img src={user?.avatar || undefined} alt="" className={`w-10 h-10 rounded-full bg-slate-50 shrink-0 z-10 ${getAccountTypeBorderClass(user?.account_type, 'border-2')} object-cover`} />
                <textarea
                  autoFocus
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Post your reply"
                  className="w-full bg-transparent text-slate-900 text-lg resize-none outline-none placeholder-slate-500 min-h-[120px] pt-2"
                />
              </div>
            </div>
          </div>
        </div>
      )}


      {selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedApplication(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">{language === 'ja' ? '参加者の想い' : 'Participant\'s Message'}</h3>
              <button onClick={() => setSelectedApplication(null)} className="text-slate-600 hover:text-slate-900 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <Link to={`/profile/${selectedApplication.user_id}`}>
                <img src={selectedApplication.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedApplication.user_name || 'U')}&background=random`} alt="" className={`w-12 h-12 rounded-full ${getAccountTypeBorderClass(selectedApplication.account_type, 'border-2')} shrink-0 hover:opacity-80 transition-opacity object-cover`} />
              </Link>
              <div>
                <div className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  {selectedApplication.user_name || 'User'}
                  {selectedApplication.account_type === 'organization' && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-600 px-2 py-0.5 rounded-full border border-blue-500/30">ORG</span>
                  )}
                </div>
                <div className="text-2xl font-black text-emerald-700">
                  ¥{selectedApplication.price?.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-slate-700 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto mb-6">
              {selectedApplication.message || (language === 'ja' ? 'メッセージはありません' : 'No message')}
            </div>
            {Number(buyoutInfo?.creator_id) === Number(user?.id) && buyoutInfo?.status === 'active' && (
              <button
                onClick={async (e) => { e.stopPropagation();
                  try {
      const res = await fetch(`/api/buyouts/${buyoutInfo.id}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedApplication.user_id, current_user_id: user?.id })
      });
      if (res.ok) window.location.href = window.location.href; else console.error(await res.text()); } catch(e) { console.error(e); }
                }}
                className="w-full px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full font-bold shadow-lg transition-colors"
              >
                {language === 'ja' ? '選択' : 'Select'}
              </button>
            )}
          </div>
        </div>
      )}


      {/* Related dialogs */}


      {showBuyoutModal && buyoutInfo && (
        <BuyoutJoinModal
          buyout={buyoutInfo}
          onClose={() => setShowBuyoutModal(false)}
          onJoin={() => {
            alert(language === 'ja' ? '参加申請を送信しました' : 'Join request sent');
            window.location.reload();
          }}
        />
      )}

      {showAuctionChat && buyoutInfo && (
        <AuctionChatModal
          buyout={buyoutInfo}
          onClose={() => setShowAuctionChat(false)}
        />
      )}

      <AddMembersModal
        isOpen={isAddMembersOpen}
        onClose={() => setIsAddMembersOpen(false)}
        itemId={id!}
        itemType="idea"
        onMembersAdded={() => {
          fetch(`/api/ideas/${id}${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`)
            .then(res => res.json())
            .then(data => {
              setIdea(data);
              setFollowCount(data.follows_count || 0);
            });
        }}
      />

      {showJoinModal && (
        <JoinProjectModal
          projectName={idea?.title || ''}
          onClose={() => setShowJoinModal(false)}
          onSubmit={async (data) => {
            const endpoint = `/api/ideas/${id}/follow`;
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
          id: idea.id,
          type: 'idea',
          title: idea.title,
          image: idea.image,
          author_name: idea.author_name
        }}
      />
      {showPermittedUsersModal && (
        <PermittedUsersModal
          permittedUserIds={showPermittedUsersModal}
          onClose={() => setShowPermittedUsersModal(null)}
        />
      )}

      {/* Proposal Approval Modal */}
      <ProposalApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onConfirm={handleApproveProposal}
        loading={isActionLoading}
      />

      {/* Proposal Remand Modal */}
      <ProposalRemandModal
        isOpen={showRemandModal}
        onClose={() => setShowRemandModal(false)}
        onSubmit={handleRemandProposalSubmit}
        loading={isActionLoading}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        ideaId={Number(id)}
        currentTitle={idea?.title}
        currentVersion={idea?.version || 1}
      />

      {/* Project Contract Modals */}
      {user && (
        <>
          <ProjectContractModal
            isOpen={showCreateContractModal}
            onClose={() => setShowCreateContractModal(false)}
            onSuccess={(newContractId) => {
              setSelectedContractId(newContractId);
              setShowViewContractModal(true);
              setKeyForRefresh(prev => prev + 1);
            }}
            ideaId={Number(id)}
            organizationId={user.id}
            individualId={idea.author_id}
            organizationName={user.username}
            individualName={idea.author_name}
            projectTitle={quotedItem?.title || idea.title}
            ideaTitle={idea.title}
          />

          {selectedContractId && (
            <ProjectContractViewModal
              contractId={selectedContractId}
              currentUserId={user.id}
              isOpen={showViewContractModal}
              onClose={() => setShowViewContractModal(false)}
              onRefresh={() => setKeyForRefresh(prev => prev + 1)}
              onOpenChat={(pId, iId) => {
                if (pId) navigate(`/project/${pId}/chat`);
                else if (iId) navigate(`/chat/${iId}`);
              }}
            />
          )}
        </>
      )}

      {/* Tree View Modal */}
      {idea && (
        <TreeModal
          isOpen={showTreeModal}
          onClose={() => setShowTreeModal(false)}
          currentItem={{
            id: Number(id),
            title: idea.title,
            type: 'idea',
            quoted_item_id: idea.quoted_item_id,
            quoted_item_type: idea.quoted_item_type
          }}
          onNewProposal={(parentId, parentType) => {
            setShowTreeModal(false);
            navigate(`/create?quoted_item_id=${parentId}&quoted_item_type=${parentType}&from_tree=1`);
          }}
        />
      )}
    </div>
  );
}
