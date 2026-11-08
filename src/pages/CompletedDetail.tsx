import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Heart, ShoppingCart, Gavel, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { projectCache } from '../projectCache';
import HashtagDisplay from '../components/HashtagDisplay';
import SubscribeButton from '../components/SubscribeButton';
import { formatDistanceToNow } from 'date-fns';
import BuyoutJoinModal from '../components/BuyoutJoinModal';
import AuctionChatModal from '../components/AuctionChatModal';

import OrgBadge from '../components/OrgBadge';
import AccountTypeBadge from '../components/AccountTypeBadge';
import { getAccountTypeBorderClass } from '../utils/avatar';

export default function CompletedDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppContext();
  const [project, setProject] = useState<any>(() => projectCache.get(Number(id)) || null);
  
  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else {
      navigate(-1);
    }
  };
  const [ideas, setIdeas] = useState<any[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isInCart, setIsInCart] = useState(false);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const { language } = useAppContext();
  const [buyoutInfo, setBuyoutInfo] = useState<any>(null);
  const [showBuyoutModal, setShowBuyoutModal] = useState(false);
  const [showAuctionChat, setShowAuctionChat] = useState(false);
  const [buyoutApplications, setBuyoutApplications] = useState<any[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);

  useEffect(() => {
    if (buyoutInfo?.id) {
      fetch(`/api/buyouts/${buyoutInfo.id}/applications`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setBuyoutApplications(data); else console.error("Not an array:", data);
        }).catch(e => console.error(e));
    }
  }, [buyoutInfo?.id]);

  const isDifferentLanguage = () => {
    if (!project) return false;
    const desc = project.completed_description || project.description;
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
      const desc = project.completed_description || project.description;
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: desc, 
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

  useEffect(() => {
    const fetchProject = () => {
      fetch(`/api/projects/${id}`)
        .then(res => res.json())
        .then(data => {
          setProject(data);
          projectCache.set(Number(id), data);
          if (data.likes_count !== undefined) {
            setLikeCount(data.likes_count);
          }
          if (data.is_buyout) {
            fetch(`/api/buyouts/item/project/${id}`)
              .then(res => res.json())
              .then(bData => {
                if (!bData.error) setBuyoutInfo(bData);
              }).catch(e => console.error(e));
          }
        });
    };

    // Only fetch project if we don't already have it
    if (!projectCache.has(Number(id))) {
      fetchProject();
    } else {
      const cached = projectCache.get(Number(id));
      if (cached && cached.likes_count !== undefined) {
        setLikeCount(cached.likes_count);
      }
      // Always fetch buyout info even if project is cached!
      if (cached && cached.is_buyout) {
        fetch(`/api/buyouts/item/project/${id}`)
          .then(res => res.json())
          .then(bData => {
            if (!bData.error) setBuyoutInfo(bData);
          }).catch(e => console.error(e));
      }
    }

    if (user) {
      fetch(`/api/likes/check?user_id=${encodeURIComponent(user.id)}&item_id=${id}&item_type=project`)
        .then(res => res.json())
        .then(data => setIsLiked(data.liked)).catch(e => {});

      fetch(`/api/cart/check/${id}?user_id=${encodeURIComponent(user.id)}`)
        .then(res => res.json())
        .then(data => setIsInCart(data.inCart)).catch(e => {});
    }

    fetch(`/api/likes/count?item_id=${id}&item_type=project`)
      .then(res => res.json())
      .then(data => setLikeCount(data.count)).catch(e => {});

    fetch(`/api/items/project/${id}/quotes${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setIdeas(data.filter((idea: any) => idea.is_private !== 1));
        }
      })
      .catch(e => console.error(e));

    // Check when user returns to this tab (e.g. after Stripe checkout)
    window.addEventListener('focus', fetchProject);
    return () => window.removeEventListener('focus', fetchProject);
  }, [id, user]);

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
      console.error('Like failed', e);
    }
  };

  const handleToggleCart = async () => {
    if (!user) return alert('Please login first');
    setIsCartLoading(true);
    try {
      if (isInCart) {
        await fetch(`/api/cart/${id}?user_id=${encodeURIComponent(user.id)}`, {
          method: 'DELETE',
        });
        setIsInCart(false);
      } else {
        await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, project_id: id })
        });
        setIsInCart(true);
      }
    } catch (e) {
      console.error('Cart toggle failed', e);
    } finally {
      setIsCartLoading(false);
    }
  };

  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  
  const handleBackProject = async (amount: number, needsShipping: boolean = false, tierDescription?: string) => {
    if (!user) {
      alert('Please login first');
      return;
    }
    
    
    setIsCheckoutLoading(true);
    setStripeError(null);
    const paymentWindow = window.open('about:blank', '_blank');
    if (!paymentWindow) {
      alert(language === 'ja' ? 'ポップアップブロックを解除してください' : 'Please allow popups');
      setIsCheckoutLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: id,
          amount: amount,
          needs_shipping: needsShipping,
          tier_description: tierDescription,
          success_url: `${window.location.origin}/api/stripe/return?type=checkout`,
          cancel_url: `${window.location.origin}/api/stripe/return?type=cancel`,
          user_id: user.id
        })
      });
      const data = await res.json();
      if (data.url) { paymentWindow.close(); window.location.reload(); } else {
        paymentWindow.close();
        let errorMsg = data.error || 'Failed to initiate checkout';
        if (errorMsg.includes('destination account needs to have at least one of the following capabilities enabled')) {
          errorMsg = 'プロジェクト作成者がStripeの本人確認（オンボーディング）を完了していないため、決済を続行できません。';
        } else if (errorMsg.includes('Author has not connected Stripe')) {
          errorMsg = 'プロジェクト作成者がStripeアカウントを連携していません。';
        }
        setStripeError(errorMsg);
        alert(errorMsg);
      }
    } catch (e) {
      console.error(e);
      const netError = '通信エラーが発生しました。';
      setStripeError(netError);
      alert(netError);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const sortedIdeas = React.useMemo(() => {
    if (!project || ideas.length === 0) return [];
    
    return [...ideas].sort((a, b) => {
      const aIsAuthor = a.author_id === project.author_id;
      const bIsAuthor = b.author_id === project.author_id;
      
      if (aIsAuthor && !bIsAuthor) return -1;
      if (!aIsAuthor && bIsAuthor) return 1;
      
      if (a.author_id !== b.author_id) {
        return a.author_id - b.author_id;
      }
      
      return new Date((a.created_at || '') + (!(a.created_at || '').includes('Z') ? 'Z' : '')).getTime() - new Date((b.created_at || '') + (!(b.created_at || '').includes('Z') ? 'Z' : '')).getTime();
    });
  }, [ideas, project]);

  if (!project) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const displayTitle = project.completed_title || project.title;
  const displayDescription = project.completed_description || project.description;
  const rawImages = project.completed_images || project.images;

  let images: string[] = [];
  if (rawImages) {
    try {
      images = JSON.parse(rawImages);
    } catch(e) {}
  }
  if (images.length === 0 && project.image) {
    images = [project.image];
  }

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      {/* Left Pane: Vertical Ideas Timeline */}
      <div className="md:w-32 border-r border-slate-800 flex md:flex-col items-center p-4 md:py-8 gap-4 md:sticky top-0 md:h-screen shrink-0 bg-slate-900 md:bg-transparent overflow-y-auto">
        <button onClick={handleBack} className="text-slate-400 hover:text-white mr-auto md:mr-0 md:mb-6">
           <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex flex-row md:flex-col items-center gap-2 md:gap-0 justify-start flex-1 min-h-min w-full">
           <button 
             onClick={() => navigate(`/project/${project.id}?from=completed`)}
             className="flex flex-col items-center gap-1 w-[80px] shrink-0 group relative"
             title={project.title}
           >
             <div 
               className="w-12 h-12 md:w-16 md:h-16 bg-slate-800 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-transform hover:scale-105 group-hover:scale-105"
               style={{
                 clipPath: 'polygon(0% 25%, 50% 0%, 100% 25%, 100% 100%, 0% 100%)',
                 WebkitClipPath: 'polygon(0% 25%, 50% 0%, 100% 25%, 100% 100%, 0% 100%)',
               }}
             >
               {project.image ? (
                 <img src={project.image} alt={project.title} className="w-full h-full object-cover" />
               ) : (
                 <span className="text-emerald-400 text-xs font-bold px-1 text-center line-clamp-2">{project.title}</span>
               )}
             </div>
             <div className="flex flex-col items-center justify-center w-full">
               <div className="text-[10px] font-bold text-emerald-400 w-full text-center truncate">{project.title}</div>
               <div className="text-[9px] text-emerald-500/80 w-full text-center truncate">{project.author_name}</div>
             </div>
           </button>
           
           {sortedIdeas.length > 0 && (
             <div className="w-4 h-0.5 md:w-0.5 md:h-6 bg-slate-700 md:my-1 shrink-0"></div>
           )}

           {sortedIdeas.map((idea, index) => (
             <React.Fragment key={idea.id}>
               <button 
                 onClick={() => navigate(`/idea/${idea.id}?from=completed`)}
                 className="relative group shrink-0 flex flex-col items-center gap-1 w-[80px]"
               >
                 <div className="w-12 h-12 md:w-16 md:h-16 border-2 border-slate-700 bg-slate-800 flex items-center justify-center rounded-xl overflow-hidden hover:border-emerald-500 transition-colors shadow-lg group-hover:scale-105">
                   {idea.image ? (
                     <img src={idea.image} alt={idea.title} className="w-full h-full object-cover" />
                   ) : (
                     <span className="text-slate-500 text-xs font-bold px-1 text-center line-clamp-2">{idea.title}</span>
                   )}
                 </div>
                 <div className="flex flex-col items-center justify-center w-full">
                   <div className="text-[10px] font-bold text-white truncate w-full text-center">{idea.title}</div>
                   <div className="text-[9px] text-slate-400 truncate w-full text-center">{idea.author_name}</div>
                 </div>
               </button>
               {index < sortedIdeas.length - 1 && (
                 <div className="w-4 h-0.5 md:w-0.5 md:h-6 bg-slate-700 md:my-1 shrink-0"></div>
               )}
             </React.Fragment>
           ))}
        </div>
      </div>

      {/* Right Pane: Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {images.length > 0 && (
             <div className="mb-8 relative flex flex-col justify-center">
                 <div className="w-full aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl relative group">
                     {images.length > 1 && (
                       <button
                         onClick={handlePrevImage}
                         className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                         <ChevronLeft className="w-8 h-8" />
                       </button>
                     )}
                     
                     <img 
                       src={images[currentImageIndex]} 
                       alt="Screen" 
                       className="w-full h-full object-contain"
                       referrerPolicy="no-referrer"
                     />
                     
                     {Number(project.is_buyout) === 1 && (
                       <div className="absolute top-4 left-4 z-20 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 flex items-center shadow-lg rounded-full border border-emerald-400/30">
                         <span className="text-sm font-black text-white tracking-widest leading-none drop-shadow-sm">
                           {language === 'ja' ? 'バイアウト' : 'Buyout'} {buyoutInfo && `(${buyoutInfo.buyout_type === 'fixed' ? (language === 'ja' ? '固定価格' : 'Fixed Price') : (language === 'ja' ? 'オークション' : 'Auction')})`}
                         </span>
                       </div>
                     )}
                     
                     {images.length > 1 && (
                       <button
                         onClick={handleNextImage}
                         className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                         <ChevronRight className="w-8 h-8" />
                       </button>
                     )}
                 </div>
                 
                 {images.length > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      {images.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`rounded-full transition-all duration-300 ${
                            idx === currentImageIndex 
                              ? 'bg-emerald-500 w-3 h-3 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                              : 'bg-slate-700 hover:bg-slate-500 w-2 h-2 mt-0.5'
                          }`}
                          aria-label={`Go to slide ${idx + 1}`}
                        />
                      ))}
                    </div>
                 )}
             </div>
          )}

          <div className="mt-8">
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight mb-2 break-words">{displayTitle}</h1>

            {(project.completed_tags || project.tags) && (
              <div className="mb-6 mt-4">
                <HashtagDisplay tags={project.completed_tags || project.tags} />
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <Link to={`/profile/${project.author_id}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                <img 
                  src={project.author_avatar || undefined} 
                  alt="" 
                  className={`w-12 h-12 rounded-full ${getAccountTypeBorderClass(project.author_account_type, 'border-2')} shadow-lg object-cover`} 
                />
                <div>
                  <h3 className="text-white font-bold text-base hover:text-blue-400 transition-colors flex items-center gap-2 flex-wrap">
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
                <SubscribeButton authorId={project.author_id} authorName={project.author_name} />
              )}
            </div>

            <div className="h-px bg-slate-800 w-full mt-4 mb-8 opacity-50" />

            <div className="prose prose-invert max-w-none text-slate-300 text-lg leading-relaxed whitespace-pre-wrap">
               <span dangerouslySetInnerHTML={{ __html: (!showOriginal && translatedText) ? translatedText : displayDescription }} />
            </div>

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

            {Number(project.is_buyout) === 1 && !buyoutInfo && (
              <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 md:p-8 mt-12 mb-8 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-white mb-2 uppercase tracking-tight flex items-center gap-2">
                      {language === 'ja' ? 'プロジェクトバイアウト' : 'Project Buyout'}
                    </h3>
                    <p className="text-slate-400">
                      {language === 'ja' ? 'このプロジェクトのすべての権利を購入します。' : 'Purchase all rights to this project.'}
                    </p>
                  </div>
                  <div className="text-center md:text-right w-full md:w-auto">
                    <div className="text-3xl md:text-4xl font-black text-emerald-400 mb-4">
                      ¥{Number(project.buyout_price || 0).toLocaleString()}
                    </div>
                    <button
                      onClick={() => handleBackProject(project.buyout_price || 0, false, 'Project Buyout')}
                      disabled={isCheckoutLoading || project.author_id === user?.id}
                      className="w-full md:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full transition-colors disabled:opacity-50 text-lg shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                    >
                      {isCheckoutLoading ? (language === 'ja' ? '処理中...' : 'Processing...') : (language === 'ja' ? 'バイアウトする' : 'Buyout Now')}
                    </button>
                    {stripeError && (
                      <div className="text-red-400 text-sm mt-4 text-center">{stripeError}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {((project.funding_goal ?? 0) > 0 || project.status === 'completed') && (
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 md:p-8 mt-12 mb-8">
                <h3 className="text-xl md:text-2xl font-black text-white mb-6 uppercase tracking-tight">{language === 'ja' ? 'このプロジェクトを支援する' : 'Support this Project'}</h3>
                
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="flex-1 w-full space-y-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-3xl md:text-5xl font-black text-emerald-400">¥{(project.funding_current || 0).toLocaleString()}</span>
                        <span className="text-slate-400 ml-2">{language === 'ja' ? '集まりました' : 'raised'}</span>
                      </div>
                      <div className="text-right">
                        {project.funding_goal > 0 && (
                          <span className="text-slate-500 text-sm block">{language === 'ja' ? '目標: ' : 'Goal: '}¥{(project.funding_goal || 0).toLocaleString()}</span>
                        )}
                        <span className="text-xl font-bold text-white">{Math.round(((project.funding_current || 0) / (project.funding_goal || 1)) * 100)}%</span>
                      </div>
                    </div>
                    
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden w-full relative">
                      <div 
                        className="absolute left-0 top-0 bottom-0 bg-emerald-500 transition-all duration-1000"
                        style={{ width: `${Math.min(100, ((project.funding_current || 0) / (project.funding_goal || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="w-full md:w-[350px] shrink-0 flex flex-col gap-4">
                    {(() => {
                      try {
                        const tiers = project.funding_tiers ? JSON.parse(project.funding_tiers) : [];
                        if (tiers.length > 0) {
                          return tiers.map((tier: any, idx: number) => (
                            <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
                              {tier.image && (
                                <img src={tier.image} alt="" className="w-full h-40 object-cover border-b border-slate-700" />
                              )}
                              <div className="p-5 flex flex-col gap-3">
                                <span className="font-black text-2xl text-emerald-400">¥{Number(tier.amount).toLocaleString()}</span>
                                <p className="text-sm text-slate-300 whitespace-pre-wrap">{tier.return_description}</p>
                                
                                <div className="text-xs text-slate-400 mt-2 space-y-1">
                                  {tier.delivery_year && tier.delivery_month && (
                                    <div>{language === 'ja' ? `お届け予定: ${tier.delivery_year}年${tier.delivery_month}月` : `Estimated delivery: ${tier.delivery_month}/${tier.delivery_year}`}</div>
                                  )}
                                  {tier.limit && (
                                    <div>{language === 'ja' ? `残り: ${tier.limit}人` : `Remaining: ${tier.limit}`}</div>
                                  )}
                                </div>
                                
                                <button
                                  onClick={() => handleBackProject(tier.amount, tier.needs_shipping, tier.return_description)}
                                  disabled={isCheckoutLoading}
                                  className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] disabled:opacity-50"
                                >
                                  {language === 'ja' ? 'このリターンを選択する' : 'Select this reward'}
                                </button>
                              </div>
                            </div>
                          ));
                        }
                      } catch (e) {}
                      return (
                        <>
                          <button
                            onClick={() => handleBackProject(1000)}
                            disabled={isCheckoutLoading}
                            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
                          >
                            {language === 'ja' ? '¥1,000 支援する' : 'Support ¥1,000'}
                          </button>
                          <button
                            onClick={() => handleBackProject(5000)}
                            disabled={isCheckoutLoading}
                            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
                          >
                            {language === 'ja' ? '¥5,000 支援する' : 'Support ¥5,000'}
                          </button>
                          <button
                            onClick={() => handleBackProject(10000)}
                            disabled={isCheckoutLoading}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] disabled:opacity-50"
                          >
                            {language === 'ja' ? '¥10,000 支援する' : 'Support ¥10,000'}
                          </button>
                        </>
                      );
                    })()}
                    {stripeError && (
                      <div className="text-red-400 text-sm mt-2 text-center">{stripeError}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-slate-800/50 flex flex-col gap-8">
              <div className="flex items-center gap-8">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-2.5 transition-all hover:scale-110 ${isLiked ? 'text-pink-500' : 'text-slate-400 hover:text-pink-500'}`}
                  title="Like"
                >
                  <Heart className={`w-7 h-7 ${isLiked ? 'fill-current' : ''}`} />
                  {likeCount > 0 && <span className="text-base font-bold">{likeCount}</span>}
                </button>
                <button
                  onClick={handleToggleCart}
                  disabled={isCartLoading}
                  className={`flex items-center gap-2.5 transition-all hover:scale-105 ${isInCart ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-400'}`}
                  title={isInCart ? 'Remove from Cart' : 'Save to Cart'}
                >
                  <ShoppingCart className={`w-7 h-7 ${isInCart ? 'fill-current' : ''}`} />
                  <span className="text-sm font-medium">{isInCart ? (language === 'ja' ? 'カートに保存済み' : 'In Cart') : (language === 'ja' ? 'カートに保存' : 'Save to Cart')}</span>
                </button>
              </div>
            </div>

            {buyoutInfo && (
              <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl p-6 md:p-8 mt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                  <h2 className="text-2xl font-black text-white flex items-center gap-2 shrink-0">
                    <Gavel className="w-6 h-6 text-emerald-500" />
                    {language === 'ja' ? 'バイアウト参加者' : 'Buyout Applications'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    {buyoutInfo.buyout_type === 'auction' && (
                      <div className="text-xs md:text-sm text-slate-400 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
                        {buyoutInfo.start_date && buyoutInfo.end_date ? (
                          <>
                            {new Date(buyoutInfo.start_date).toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                            <span className="text-slate-600">~</span>
                            {new Date(buyoutInfo.end_date).toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                          </>
                        ) : (
                          language === 'ja' ? '期間指定なし' : 'No period specified'
                        )}
                      </div>
                    )}
                    <div className="text-xs md:text-sm font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 whitespace-nowrap">
                      {buyoutApplications.length} {language === 'ja' ? '名参加' : 'participants'}
                    </div>
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
                  <div key={app.id} className="bg-slate-800/50 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => setSelectedApplication(app)}>
                    <div className="flex items-center gap-4">
                      <img src={displayAvatar} alt={displayName} className="w-12 h-12 rounded-full object-cover border-2 border-slate-700 bg-slate-800" />
                      <div>
                        <div className="font-bold text-white text-lg">{displayName}</div>
                          <div className="text-sm text-slate-400">
                            {new Date(app.created_at + (!app.created_at.includes('Z') ? 'Z' : '')).toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-2xl font-black text-emerald-400">
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
                            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold shadow-lg transition-colors shrink-0"
                          >
                            {language === 'ja' ? '選択' : 'Select'}
                          </button>
                        )}
                        {app.status === 'selected' && (
                          <div className="flex flex-col items-end gap-2">
                            <span className="px-4 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-bold text-sm shrink-0">
                              {language === 'ja' ? '落札者' : 'Winner'}
                            </span>
                            {buyoutInfo.status === 'paid' && (
                              <span className="px-4 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full font-bold text-sm shrink-0">
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
                        {app.status === 'rejected' && project.author_id === user?.id && (
                            <span className="px-4 py-1.5 bg-slate-800 text-slate-500 rounded-full font-bold text-sm shrink-0">
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
        </div>
      </div>

      
      {selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedApplication(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">{language === 'ja' ? '参加者の想い' : 'Participant\'s Message'}</h3>
              <button onClick={() => setSelectedApplication(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <Link to={`/profile/${selectedApplication.user_id}`}>
                <img src={selectedApplication.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedApplication.user_name || 'U')}&background=random`} alt="" className="w-12 h-12 rounded-full border border-slate-600 shrink-0 hover:opacity-80 transition-opacity" />
              </Link>
              <div>
                <div className="font-bold text-white text-lg flex items-center gap-2">
                  {selectedApplication.user_name || 'User'}
                  {selectedApplication.account_type === 'organization' && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">ORG</span>
                  )}
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  ¥{selectedApplication.price?.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-slate-300 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto mb-6">
              {selectedApplication.message || (language === 'ja' ? 'メッセージはありません' : 'No message')}
            </div>
            {Number(buyoutInfo?.creator_id) === Number(user?.id) && buyoutInfo?.status === 'active' && (
              <button
                onClick={async (e) => { e.stopPropagation();
                                    const paymentWindow = window.open('about:blank', '_blank');
                                    if (!paymentWindow) { alert('Please allow popups'); return; }
                                    try {
      const res = await fetch(`/api/buyouts/${buyoutInfo.id}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedApplication.user_id, current_user_id: user?.id })
      });
      if (res.ok) window.location.href = window.location.href; else console.error(await res.text()); } catch(e) { console.error(e); }
                }}
                className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold shadow-lg transition-colors"
              >
                {language === 'ja' ? '選択' : 'Select'}
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Floating Action Button for Buyout Join */}
      {user && project && Number(project.is_buyout) === 1 && buyoutInfo && (() => {
        const isAuction = buyoutInfo.buyout_type === 'auction';
        const hasStarted = !buyoutInfo.start_date || new Date(buyoutInfo.start_date) <= new Date();
        const disabled = isAuction && !hasStarted;
        
        return (
          <button 
            onClick={() => {
              if (disabled) return;
              if (isAuction) setShowAuctionChat(true);
              else setShowBuyoutModal(true);
            }}
            disabled={disabled}
            className={`fixed bottom-24 right-6 md:bottom-28 md:right-12 z-[110] w-14 h-14 md:w-16 md:h-16 ${disabled ? 'bg-slate-600' : 'bg-amber-500 hover:bg-amber-600 hover:scale-110'} text-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-transform ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={language === 'ja' ? 'バイアウトに参加' : 'Join Buyout'}
          >
            <Gavel className="w-7 h-7" />
          </button>
        );
      })()}

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
    </div>
  );
}
