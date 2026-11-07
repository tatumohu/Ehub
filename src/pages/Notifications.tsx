import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Bell, Check, UserPlus, MessageSquare, Heart, Lock, Star, FileText, ShieldCheck, FileCheck, RefreshCw, AlertTriangle, Award, Edit3, CheckCircle, XCircle } from 'lucide-react';
import RatingModal from '../components/RatingModal';
import ScoutInboxModal from '../components/ScoutInboxModal';
import { formatDistanceToNow } from 'date-fns';
import { getAccountTypeBorderClass } from '../utils/avatar';
import AccountTypeBadge from '../components/AccountTypeBadge';

export default function Notifications() {
  const navigate = useNavigate();
  const { user, socket, refreshUnreadNotificationsCount, language } = useAppContext();
  const [showScoutInboxModal, setShowScoutInboxModal] = useState(false);
  const [targetScoutId, setTargetScoutId] = useState<number | undefined>(undefined);
  
  const processBuyoutPayment = async (buyoutId: number) => {
    try {
      const res = await fetch(`/api/buyouts/${buyoutId}/transfer`, {
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
  };
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModalData, setRejectModalData] = useState<{ isOpen: boolean, followId: number | null }>({ isOpen: false, followId: null });
  const [rejectComment, setRejectComment] = useState('');
  const [ratingModalData, setRatingModalData] = useState<{ isOpen: boolean, itemId: number, itemType: 'project' | 'idea' }>({ isOpen: false, itemId: 0, itemType: 'project' });
  const [expandedNotifs, setExpandedNotifs] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) => {
    setExpandedNotifs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const markAsRead = async () => {
    if (!user) return;
    try {
      await fetch(`/api/users/${user.id}/notifications/read`, { method: 'POST' });
      refreshUnreadNotificationsCount();
    } catch (error) {
      console.error(error);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/users/${user.id}/notifications`);
      const data = await res.json();
      setNotifications(data);
      // Mark as read after fetching
      if (data.some((n: any) => !n.is_read)) {
        markAsRead();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    if (socket) {
      socket.on('notification', () => fetchNotifications());
      return () => {
        socket.off('notification');
      };
    }
  }, [user, socket]);

  const rejectFollow = async () => {
    if (!rejectModalData.followId) return;
    try {
      await fetch(`/api/follows/${rejectModalData.followId}/reject`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: rejectComment })
      });
      setNotifications(notifications.filter(n => n.follow_id !== rejectModalData.followId));
      setRejectModalData({ isOpen: false, followId: null });
      setRejectComment('');
    } catch (e) {
      console.error(e);
    }
  };
  
  const acceptFollow = async (followId: number) => {
    if (!followId) return;
    await fetch(`/api/follows/${followId}/accept`, { method: 'POST' });
    setNotifications(notifications.filter(n => n.follow_id != followId));
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Bell className="w-16 h-16 text-slate-400 dark:text-slate-700 mx-auto mb-6 animate-pulse" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{language === 'ja' ? 'サインインして通知を見る' : 'Sign in to see notifications'}</h1>
        <p className="text-slate-600 dark:text-slate-400">{language === 'ja' ? 'プロジェクトや繋がりに関する最新情報を確認できます。' : 'Stay updated on your projects and connections.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-32">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Bell className="w-8 h-8 text-blue-500" />
          {language === 'ja' ? '通知' : 'Notifications'}
        </h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl animate-pulse border border-slate-200 dark:border-slate-800/80" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-200 dark:border-slate-800/80 shadow-xl">
            <Bell className="w-10 h-10 text-slate-400 dark:text-slate-700" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-lg">{language === 'ja' ? '新しい通知はありません' : 'No new notifications yet'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notif, i) => (
            <div
              key={`notif-${notif.id || i}-${i}`}
              onClick={() => {
                if (notif.type === 'follow_request') {
                  toggleExpand(notif.id);
                }
              }}
              className={`${
                notif.is_read 
                  ? 'bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border-slate-200/80 dark:border-slate-800/80 shadow-md dark:shadow-[0_4px_20px_0_rgba(0,0,0,0.4)]' 
                  : 'bg-white/95 dark:bg-[#0b0f19]/80 backdrop-blur-xl border-blue-400/60 dark:border-cyan-500/50 shadow-lg dark:shadow-[0_8px_32px_0_rgba(0,200,255,0.12)]'
              } rounded-2xl p-5 border ${notif.type === 'follow_request' ? 'cursor-pointer hover:border-blue-500 dark:hover:border-cyan-500/60' : 'hover:border-slate-300 dark:hover:border-slate-700/80'} hover-glass-card transition-all duration-300 animate-fade-in`}
            >
              <div className="flex items-start gap-4">
                <Link onClick={e => e.stopPropagation()} to={`/profile/${notif.from_user_id}`} className="relative block shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                  <img src={notif.from_user_avatar || undefined} alt="" className={`w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 ${getAccountTypeBorderClass(notif.from_user_account_type || (notif as any).account_type, 'border-[3px]')} object-cover shadow-sm`} />
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${
                    ['contract_attached', 'contract_updated', 'scout_contract_updated', 'nda_acceptance_required', 'contract_review_required', 'contract_accepted', 'contract_declined', 'contract_revision_requested', 'final_contract_confirmation_required'].includes(notif.type)
                      ? 'bg-indigo-600'
                      : notif.type === 'follow_request' || notif.type === 'invitation' || notif.type === 'new_follower'
                      ? 'bg-blue-500'
                      : notif.type === 'private_post'
                      ? 'bg-purple-500'
                      : notif.type === 'rate_user'
                      ? 'bg-yellow-500'
                      : 'bg-emerald-500'
                  } rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900`}>
                    {['contract_attached', 'contract_updated', 'scout_contract_updated', 'contract_review_required'].includes(notif.type) ? (
                      <FileText className="w-3 h-3 text-white" />
                    ) : notif.type === 'nda_acceptance_required' ? (
                      <ShieldCheck className="w-3 h-3 text-white" />
                    ) : notif.type === 'contract_accepted' ? (
                      <CheckCircle className="w-3 h-3 text-white" />
                    ) : notif.type === 'contract_declined' ? (
                      <XCircle className="w-3 h-3 text-white" />
                    ) : notif.type === 'contract_revision_requested' ? (
                      <RefreshCw className="w-3 h-3 text-white" />
                    ) : notif.type === 'final_contract_confirmation_required' ? (
                      <Award className="w-3 h-3 text-white" />
                    ) : notif.type === 'follow_request' || notif.type === 'invitation' || notif.type === 'new_follower' ? (
                      <UserPlus className="w-3 h-3 text-white" />
                    ) : notif.type === 'private_post' ? (
                      <Lock className="w-3 h-3 text-white" />
                    ) : notif.type === 'rate_user' ? (
                      <Star className="w-3 h-3 text-white" />
                    ) : (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                </Link>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                      
                      {notif.type === 'scout_received' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'から指名スカウトが届きました。' : ' sent you a scout.'}
                          <br />
                          <span className="text-slate-700 dark:text-slate-300 mt-2 block p-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-cyan-500/20">
                            <strong>{notif.message}</strong>
                            <br/>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetScoutId(notif.item_id);
                                setShowScoutInboxModal(true);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                            >
                              {language === 'ja' ? 'スカウト一覧で確認する' : 'Check in Scouts menu'}
                            </button>
                          </span>
                        </>
                      ) : notif.type === 'contract_attached' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name || '発注側'} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'から契約書が添付されました。' : ' attached a contract.'}
                          <br />
                          <span className="text-slate-700 dark:text-slate-300 mt-2 block p-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-cyan-500/20">
                            <strong>{notif.message || '契約書の内容を確認してください。'}</strong>
                            <br/>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (notif.item_type === 'contract') {
                                  navigate('/contracts');
                                } else {
                                  setTargetScoutId(notif.item_id);
                                  setShowScoutInboxModal(true);
                                }
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                            >
                              {language === 'ja' ? '対象契約書・スカウト画面を開く' : 'Open Contract / Scout Detail'}
                            </button>
                          </span>
                        </>
                      ) : notif.type === 'contract_updated' || notif.type === 'scout_contract_updated' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name || '担当者'} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'が契約書案を更新しました。' : ' updated contract draft.'}
                          <br />
                          <span className="text-slate-700 dark:text-slate-300 mt-2 block p-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-cyan-500/20">
                            <strong>{notif.message || '業務委託契約案が更新されました。内容を再確認してください。'}</strong>
                            <br/>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (notif.item_type === 'contract') {
                                  navigate('/contracts');
                                } else {
                                  setTargetScoutId(notif.item_id);
                                  setShowScoutInboxModal(true);
                                }
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                            >
                              {language === 'ja' ? '更新内容を再確認する' : 'Review Updated Contract'}
                            </button>
                          </span>
                        </>
                      ) : notif.type === 'nda_acceptance_required' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name || '発注側'} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'から秘密保持契約の確認依頼が届きました。' : ' requested NDA agreement.'}
                          <br />
                          <span className="text-slate-700 dark:text-slate-300 mt-2 block p-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-cyan-500/20">
                            <strong>{notif.message || `${notif.from_user_name || '発注側'}から秘密保持契約の確認依頼が届きました。`}</strong>
                            <br/>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetScoutId(notif.item_id);
                                setShowScoutInboxModal(true);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                            >
                              {language === 'ja' ? '秘密保持契約を確認・同意する' : 'Review & Agree NDA'}
                            </button>
                          </span>
                        </>
                      ) : notif.type === 'contract_review_required' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name || '発注側'} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'から契約案のレビュー依頼が届きました。' : ' requested contract review.'}
                          <br />
                          <span className="text-slate-700 dark:text-slate-300 mt-2 block p-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-cyan-500/20">
                            <strong>{notif.message || '業務委託契約案の確認依頼が届きました。内容をレビューしてください。'}</strong>
                            <br/>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetScoutId(notif.item_id);
                                setShowScoutInboxModal(true);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                            >
                              {language === 'ja' ? '契約案をレビューする' : 'Review Contract Draft'}
                            </button>
                          </span>
                        </>
                      ) : notif.type === 'contract_accepted' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name || 'ユーザー'} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'が契約書に同意しました。' : ' accepted the contract.'}
                          <br />
                          <span className="text-slate-700 dark:text-slate-300 mt-2 block p-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-cyan-500/20">
                            <strong>{notif.message || `${notif.from_user_name || 'ユーザー'}さんが秘密保持・業務委託契約に同意しました。`}</strong>
                            <br/>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetScoutId(notif.item_id);
                                setShowScoutInboxModal(true);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                            >
                              {language === 'ja' ? '同意内容・契約書を確認する' : 'Check Agreed Contract'}
                            </button>
                          </span>
                        </>
                      ) : notif.type === 'contract_declined' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name || 'ユーザー'} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'が契約書を辞退（拒否）しました。' : ' declined the contract.'}
                          <br />
                          <span className="text-slate-700 dark:text-slate-300 mt-2 block p-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-cyan-500/20">
                            <strong>{notif.message || '契約が辞退されました。理由をご確認ください。'}</strong>
                            <br/>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetScoutId(notif.item_id);
                                setShowScoutInboxModal(true);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                            >
                              {language === 'ja' ? '辞退理由・詳細を確認する' : 'View Decline Details'}
                            </button>
                          </span>
                        </>
                      ) : notif.type === 'contract_revision_requested' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name || '相手方'} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'から契約書の改定要求が届きました。' : ' requested contract revision.'}
                          <br />
                          <span className="text-slate-700 dark:text-slate-300 mt-2 block p-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-cyan-500/20">
                            <strong>{notif.message || '契約書の改定要求が届きました。内容を確認の上再提案を行ってください。'}</strong>
                            <br/>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetScoutId(notif.item_id);
                                setShowScoutInboxModal(true);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                            >
                              {language === 'ja' ? '改定要求内容を確認する' : 'Review Revision Request'}
                            </button>
                          </span>
                        </>
                      ) : notif.type === 'final_contract_confirmation_required' ? (
                        <>
                          <span className="font-bold text-slate-900 dark:text-white">{language === 'ja' ? '契約の最終確認要求' : 'Final Contract Confirmation Required'}</span>
                          <br />
                          <span className="text-slate-700 dark:text-slate-300 mt-2 block p-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-cyan-500/20">
                            <strong>{notif.message || 'プロジェクト参加に必要な契約書の最終確認を行ってください。'}</strong>
                            <br/>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetScoutId(notif.item_id);
                                setShowScoutInboxModal(true);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                            >
                              {language === 'ja' ? '最終確認画面を開く' : 'Perform Final Confirmation'}
                            </button>
                          </span>
                        </>
                      ) : notif.type === 'scout_accepted' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'が指名スカウトを承諾しました！' : ' accepted your scout!'}
                          <br />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowScoutInboxModal(true);
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                          >
                            {language === 'ja' ? 'スカウト一覧で確認する' : 'Check in Scouts menu'}
                          </button>
                        </>
                      ) : notif.type === 'scout_on_hold' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'が指名スカウトを保留にしました。' : ' put your scout on hold.'}
                          <br />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowScoutInboxModal(true);
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                          >
                            {language === 'ja' ? 'スカウト一覧で確認する' : 'Check in Scouts menu'}
                          </button>
                        </>
                      ) : notif.type === 'scout_declined' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'が指名スカウトを辞退しました。' : ' declined your scout.'}
                          <br />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowScoutInboxModal(true);
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                          >
                            {language === 'ja' ? 'スカウト一覧で確認する' : 'Check in Scouts menu'}
                          </button>
                        </>
                      ) : notif.type === 'scout_message' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'からスカウトメッセージが届いています:' : ' sent you a scout message:'}
                          <br />
                          <span className="text-slate-700 dark:text-slate-300 mt-2 block p-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md rounded-xl border border-slate-200/80 dark:border-cyan-500/20">
                            {notif.message}
                            <br />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowScoutInboxModal(true);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block text-xs font-semibold cursor-pointer text-left"
                            >
                              {language === 'ja' ? 'スカウト一覧で確認する' : 'Check in Scouts menu'}
                            </button>
                          </span>
                        </>
                      ) : notif.type === 'follow_request' ? (
                        <div>
                          <Link onClick={(e) => e.stopPropagation()} to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'がプロジェクトへの参加を希望しています:' : 'wants to join your project:'} <span className="font-bold text-slate-900 dark:text-white">"{notif.idea_title}"</span>
                          {expandedNotifs.has(notif.id) ? (
                            <div onClick={e => e.stopPropagation()} className="mt-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md border border-slate-200/80 dark:border-cyan-500/20 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 space-y-2">
                              {notif.follow_reason && <p><span className="text-slate-500">{language === 'ja' ? '参加理由' : 'Reason'}:</span> {notif.follow_reason}</p>}
                              {notif.follow_skills && <p><span className="text-slate-500">{language === 'ja' ? 'スキル' : 'Skills'}:</span> {notif.follow_skills}</p>}
                              {notif.follow_role && <p><span className="text-slate-500">{language === 'ja' ? '役割' : 'Role'}:</span> {notif.follow_role}</p>}
                              {notif.follow_period && <p><span className="text-slate-500">{language === 'ja' ? '期間' : 'Period'}:</span> {notif.follow_period}</p>}
                              {notif.follow_hours && <p><span className="text-slate-500">{language === 'ja' ? '時間' : 'Hours'}:</span> {notif.follow_hours}</p>}
                              {notif.follow_message && <p><span className="text-slate-500">{language === 'ja' ? 'メッセージ' : 'Message'}:</span> {notif.follow_message}</p>}
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-semibold">{language === 'ja' ? 'タップして詳細を見る' : 'Tap to view details'}</div>
                          )}
                        </div>
                      ) : notif.type === 'invitation' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> invited you to join <span className="font-bold text-slate-900 dark:text-white">"{notif.idea_title}"</span>
                        </>
                      ) : notif.type === 'follow_rejected' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'がプロジェクトへの参加申請を拒否しました。' : 'rejected your join request for'} <span className="font-bold text-slate-900 dark:text-white">"{notif.idea_title}"</span>
                          {notif.message && (
                            <div className="mt-3 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur-md border border-slate-200/80 dark:border-cyan-500/20 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300">
                              <span className="text-slate-500">{language === 'ja' ? 'コメント' : 'Comment'}:</span> {notif.message}
                            </div>
                          )}
                        </>
                      ) : notif.type === 'private_post' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> が <span className="font-bold text-slate-900 dark:text-white">"{notif.idea_title}"</span> を非公開で投稿しました。
                        </>
                      ) : notif.type === 'new_follower' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'があなたをフォローしました。' : 'started following you.'}
                        </>
                      ) : notif.type === 'offer' ? (
                        <>
                          <Link to={`/profile/${notif.from_user_id}`} className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 align-middle mr-1">{notif.from_user_name} <AccountTypeBadge accountType={notif.from_user_account_type || (notif as any).account_type} size="xs" /></Link> {language === 'ja' ? 'からProposalが届いています。' : ' sent you a Proposal.'}
                        </>
                      ) : notif.type === 'auction_ended' ? (
                        <>
                          <Link to={`/${notif.resolved_item_type === 'project' ? 'completed' : 'idea'}/${notif.resolved_item_id}`} className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">"{notif.idea_title}"</Link>
                          {language === 'ja' ? ' のオークションが終了しました。' : ' auction has ended.'}
                        </>
                      ) : notif.type === 'buyout_won' ? (
                        <>
                          {language === 'ja' ? 'おめでとうございます！' : 'Congratulations! '}
                          <Link to={`/${notif.resolved_item_type === 'project' ? 'completed' : 'idea'}/${notif.resolved_item_id}`} className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">"{notif.idea_title}"</Link>
                          {language === 'ja' ? ' のバイアウトを落札しました。' : ' buyout won.'}
                        </>
                      ) : notif.type === 'rate_user' ? (
                        <>
                          このVision <Link to={`/${notif.resolved_item_type === 'project' ? 'completed' : 'idea'}/${notif.resolved_item_id}`} className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">"{notif.idea_title}"</Link>
                          {language === 'ja' ? (notif.is_buyout ? ' がバイアウトに投稿されました。貢献度を評価してください。' : ' がCompletedに投稿されました。貢献度を評価してください。') : (notif.is_buyout ? ' has been posted to Buyout. Please evaluate the user.' : ' has been posted to Completed. Please evaluate the user.')}
                        </>
                      ) : notif.type === 'buyout_paid' ? (
                        <>
                          <Link to={`/${notif.resolved_item_type === 'project' ? 'completed' : 'idea'}/${notif.resolved_item_id}`} className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">"{notif.idea_title}"</Link>
                          {language === 'ja' ? ' のバイアウトの支払いが完了し、所有権が移行されました。' : ' buyout payment completed and ownership transferred.'}
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-slate-900 dark:text-white">"{notif.idea_title}"</span> に加え、<span className="font-bold text-slate-900 dark:text-white">follow back</span>がありました。
                        </>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap ml-4">
                      {formatDistanceToNow(new Date((notif.created_at || '') + (!(notif.created_at || '').includes('Z') ? 'Z' : '')), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {notif.type === 'rate_user' && (
                    <button 
                      onClick={() => setRatingModalData({ isOpen: true, itemId: notif.item_id, itemType: notif.item_type })}
                      className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors mt-2"
                    >
                      <Star className="w-4 h-4 fill-white text-white" />
                      {language === 'ja' ? 'ユーザーを評価する' : 'Evaluate User'}
                    </button>
                  )}

                  {(notif.type === 'follow_request' || notif.type === 'invitation') && (
                    <div className="flex gap-3 mt-4" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); acceptFollow(notif.follow_id); }}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold py-2.5 rounded-xl hover-glass-card animate-fade-in flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        {notif.type === 'invitation' ? (language === 'ja' ? '追加する' : 'Add') : (language === 'ja' ? '承認' : 'Approve')}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setRejectModalData({ isOpen: true, followId: notif.follow_id }); }} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-500/20 hover:text-red-500 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl hover-glass-card animate-fade-in transition-colors">
                        {language === 'ja' ? '拒否' : 'Reject'}
                      </button>
                    </div>
                  )}

                  {notif.type === 'follow_accepted' && notif.item_type !== 'idea' && (
                    <Link 
                      to={`/chat/${notif.item_type}/${notif.item_id}`}
                      className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-bold transition-colors mt-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {language === 'ja' ? 'グループチャットへ' : 'Go to Group Chat'}
                    </Link>
                  )}
                  {(notif.type === 'private_post' || notif.type === 'offer') && (
                    <Link 
                      to={`/${notif.item_type === 'project' ? 'project' : 'idea'}/${notif.item_id}`}
                      className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-bold transition-colors mt-2"
                    >
                      {language === 'ja' ? '投稿を見る' : 'View Post'}
                    </Link>
                  )}
                  {notif.type === 'buyout_won' ? (
                    <div className="flex gap-3 mt-3">
                      {notif.buyout_status !== 'paid' && (
                        <button
                          onClick={() => processBuyoutPayment(notif.item_id)}
                          className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg transition-colors"
                        >
                          {language === 'ja' ? '支払って所有権を移行' : 'Pay & Transfer Ownership'}
                        </button>
                      )}
                      <Link 
                        to={`/${notif.resolved_item_type === 'project' ? 'completed' : 'idea'}/${notif.resolved_item_id}`}
                        className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white px-5 py-2 rounded-full text-sm font-bold transition-colors"
                      >
                        {language === 'ja' ? '詳細を見る' : 'View Details'}
                      </Link>
                    </div>
                  ) : notif.type === 'auction_ended' ? (
                    <Link 
                      to={`/${notif.resolved_item_type === 'project' ? 'completed' : 'idea'}/${notif.resolved_item_id}`}
                      className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors mt-2"
                    >
                      {language === 'ja' ? '詳細を見る' : 'View Details'}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <RatingModal
        isOpen={ratingModalData.isOpen}
        onClose={() => setRatingModalData(prev => ({ ...prev, isOpen: false }))}
        itemId={ratingModalData.itemId}
        itemType={ratingModalData.itemType}
      />

      {rejectModalData.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0b0f19]/90 backdrop-blur-2xl rounded-2xl w-full max-w-md border border-slate-200 dark:border-cyan-500/30 shadow-2xl p-6 text-slate-900 dark:text-white">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{language === 'ja' ? '参加申請を拒否' : 'Reject Join Request'}</h3>
            <textarea
              className="w-full bg-slate-50 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-cyan-500/30 rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 mb-4 h-24 resize-none focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500"
              placeholder={language === 'ja' ? '拒否の理由やコメントを入力してください...' : 'Enter reason for rejection...'}
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setRejectModalData({ isOpen: false, followId: null })}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                {language === 'ja' ? 'キャンセル' : 'Cancel'}
              </button>
              <button 
                onClick={rejectFollow}
                
                className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl"
              >
                {language === 'ja' ? '送信' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScoutInboxModal && (
        <ScoutInboxModal
          initialScoutId={targetScoutId}
          onClose={() => {
            setShowScoutInboxModal(false);
            setTargetScoutId(undefined);
          }}
        />
      )}
    </div>
  );
}
