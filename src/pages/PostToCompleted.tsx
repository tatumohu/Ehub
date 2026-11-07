import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { ChevronLeft, Image as ImageIcon, X, CheckCircle } from 'lucide-react';
import RatingModal from '../components/RatingModal';
import HashtagInput from '../components/HashtagInput';

export default function PostToCompleted() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthLoaded, language } = useAppContext();
  const [project, setProject] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('#');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [fundingGoal, setFundingGoal] = useState<string>('');
  const [fundingTiers, setFundingTiers] = useState<{
    amount: string,
    return_description: string,
    delivery_year: string,
    delivery_month: string,
    needs_shipping: boolean,
    limit: string,
    image?: string
  }[]>([
    { amount: '1000', return_description: 'お礼のメッセージ', delivery_year: '2026', delivery_month: '7', needs_shipping: false, limit: '' },
    { amount: '5000', return_description: 'オリジナルステッカー', delivery_year: '2026', delivery_month: '8', needs_shipping: true, limit: '100' },
    { amount: '10000', return_description: '完成版プロダクトの早期アクセス権', delivery_year: '2026', delivery_month: '9', needs_shipping: false, limit: '50' }
  ]);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [isBuyout, setIsBuyout] = useState(false);
  const [buyoutPrice, setBuyoutPrice] = useState('');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthLoaded) return;
    if (!user) {
      navigate('/');
      return;
    }
    fetch(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        setProject(data);
        if (!title) {
          setTitle(data.title);
        }
      });
      
    const checkStripe = () => {
      // Fetch user details to check for Stripe account
      fetch(`/api/users/${user.id}`)
        .then(res => res.json())
        .then(data => {
          setStripeAccountId(data.stripe_account_id);
        });
    };
    
    checkStripe();
    
    // Check when user returns to this tab
    window.addEventListener('focus', checkStripe);
    return () => window.removeEventListener('focus', checkStripe);
  }, [projectId, user, navigate]);

  const handleStripeConnect = async () => {
    if (!user) return;
    setIsStripeLoading(true);
    setStripeError(null);
    const onboardingWindow = window.open('about:blank', '_blank');
    if (!onboardingWindow) {
      alert(language === 'ja' ? 'ポップアップブロックを解除してください' : 'Please allow popups');
      setIsStripeLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/stripe/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });
      const data = await res.json();
      if (data.url) {
        onboardingWindow.location.href = data.url;
      } else {
        onboardingWindow.close();
        setStripeError(data.error || 'Failed to connect Stripe');
      }
    } catch (err) {
      console.error(err);
      setStripeError('Network error connecting to Stripe');
    } finally {
      setIsStripeLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImages(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title) return;
    
    // In our backend, we modified /api/projects/:id/complete to take title, description, images, funding_goal
    await fetch(`/api/projects/${projectId}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        tags: tags.trim() === '#' ? '' : tags,
        description,
        images,
        funding_goal: fundingGoal ? parseInt(fundingGoal, 10) : 0,
        is_buyout: isBuyout,
        buyout_price: buyoutPrice ? parseInt(buyoutPrice, 10) : 0,
        funding_tiers: fundingTiers.map(t => ({
          amount: parseInt(t.amount, 10) || 0,
          return_description: t.return_description,
          delivery_year: parseInt(t.delivery_year, 10) || 0,
          delivery_month: parseInt(t.delivery_month, 10) || 0,
          needs_shipping: t.needs_shipping,
          limit: t.limit ? parseInt(t.limit, 10) || null : null,
          image: t.image || null
        }))
      })
    });
    setShowRatingModal(true);
  };

  if (!project) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mb-6 transition-colors">
        <ChevronLeft className="w-5 h-5" />
        {language === 'ja' ? '戻る' : 'Back'}
      </button>

      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">{language === 'ja' ? 'ストアに投稿' : 'Post to Store'}</h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{language === 'ja' ? 'タイトル' : 'Title'}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-sm"
            placeholder={language === 'ja' ? 'プロジェクト名' : 'Project Title'}
          />
          <div className="mt-4">
            <HashtagInput value={tags} onChange={setTags} />
          </div>
        </div>

        <div>
           <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{language === 'ja' ? '説明' : 'Description'}</label>
           <textarea
             value={description}
             onChange={(e) => setDescription(e.target.value)}
             className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 h-40 resize-none shadow-sm"
             placeholder={language === 'ja' ? '作成したものを説明してください...' : 'Describe what you built...'}
           />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {language === 'ja' ? 'バイアウト設定（任意）' : 'Buyout Setup (Optional)'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {language === 'ja' ? 'プロジェクト全体を売却するためのバイアウト価格を設定します。' : 'Set a buyout price to sell the entire project.'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={isBuyout} onChange={(e) => setIsBuyout(e.target.checked)} />
              <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
          
          {isBuyout && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{language === 'ja' ? 'バイアウト価格 (円)' : 'Buyout Price (JPY)'}</label>
              <input
                type="number"
                value={buyoutPrice}
                onChange={(e) => setBuyoutPrice(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                placeholder={language === 'ja' ? '例: 1000000' : 'e.g. 1000000'}
              />
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {language === 'ja' ? 'クラウドファンディング設定（任意）' : 'Crowdfunding Setup (Optional)'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {language === 'ja' ? 'クラウドファンディングによってストアに公開されたVisionの資金調達ができます。Stripeアカウントを連携して資金を受け取りましょう。' : 'You can raise funds for this store Vision through crowdfunding. Connect your Stripe account to receive funds.'}
          </p>
          
          {!stripeAccountId ? (
            <div>
              <button
                onClick={handleStripeConnect}
                disabled={isStripeLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 shadow-sm"
              >
                {isStripeLoading ? (language === 'ja' ? '接続中...' : 'Connecting...') : (language === 'ja' ? 'Stripeと連携して資金を受け取る' : 'Connect Stripe to Receive Funds')}
              </button>
              {stripeError && (
                <div className="mt-2 text-red-500 dark:text-red-400 text-sm">{stripeError}</div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                <CheckCircle className="w-4 h-4" />
                {language === 'ja' ? 'Stripeアカウント連携済み' : 'Stripe Account Connected'}
              </div>
              <button
                onClick={handleStripeConnect}
                disabled={isStripeLoading}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {language === 'ja' ? 'Stripeダッシュボードへ' : 'Go to Stripe Dashboard'}
              </button>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{language === 'ja' ? '目標金額 (円)' : 'Funding Goal (JPY)'}</label>
                <input
                  type="number"
                  value={fundingGoal}
                  onChange={(e) => setFundingGoal(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 mb-4"
                  placeholder={language === 'ja' ? '例: 500000' : 'e.g. 500000'}
                />

                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{language === 'ja' ? 'サポートの階層とリターン' : 'Support Tiers & Returns'}</label>
                <div className="space-y-3">
                  {fundingTiers.map((tier, idx) => (
                    <div key={idx} className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{language === 'ja' ? `リターン #${idx + 1}` : `Reward #${idx + 1}`}</span>
                        <button
                          onClick={() => {
                            const newTiers = [...fundingTiers];
                            newTiers.splice(idx, 1);
                            setFundingTiers(newTiers);
                          }}
                          className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{language === 'ja' ? '価格 (円・税込)' : 'Price (JPY, tax included)'}</label>
                        <input
                          type="number"
                          value={tier.amount}
                          onChange={(e) => {
                            const newTiers = [...fundingTiers];
                            newTiers[idx].amount = e.target.value;
                            setFundingTiers(newTiers);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-sm"
                          placeholder={language === 'ja' ? '例: 5000' : 'e.g. 5000'}
                        />
                        {tier.amount && Number(tier.amount) > 0 && (
                          <div className="mt-1.5 p-2 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-[11px] space-y-0.5 text-slate-600 dark:text-slate-400">
                            <div className="flex justify-between">
                              <span>E-hub Store販売手数料 (10%):</span>
                              <span>¥{Math.round(Number(tier.amount) * 0.1).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                              <span>出品者受取予定額 (90%):</span>
                              <span>¥{(Number(tier.amount) - Math.round(Number(tier.amount) * 0.1)).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{language === 'ja' ? '画像 (任意)' : 'Image (Optional)'}</label>
                        <div className="flex items-center gap-4">
                          {tier.image && (
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shrink-0">
                              <img src={tier.image} alt="" className="w-full h-full object-cover" />
                              <button
                                onClick={() => {
                                  const newTiers = [...fundingTiers];
                                  newTiers[idx].image = undefined;
                                  setFundingTiers(newTiers);
                                }}
                                className="absolute top-0 right-0 bg-black/50 text-white p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <label className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 cursor-pointer transition-colors w-full shadow-sm">
                            <ImageIcon className="w-4 h-4" />
                            <span>{tier.image ? (language === 'ja' ? '画像を変更' : 'Change Image') : (language === 'ja' ? '画像をアップロード' : 'Upload Image')}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  if (event.target?.result) {
                                    const newTiers = [...fundingTiers];
                                    newTiers[idx].image = event.target.result as string;
                                    setFundingTiers(newTiers);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{language === 'ja' ? 'リターンの説明' : 'Reward Description'}</label>
                        <textarea
                          value={tier.return_description}
                          onChange={(e) => {
                            const newTiers = [...fundingTiers];
                            newTiers[idx].return_description = e.target.value;
                            setFundingTiers(newTiers);
                          }}
                          rows={3}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-sm resize-none"
                          placeholder={language === 'ja' ? '提供するアイテムやサービスについて説明してください...' : 'Describe the items or services you will provide...'}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{language === 'ja' ? 'お届け予定年' : 'Delivery Year'}</label>
                          <select
                            value={tier.delivery_year}
                            onChange={(e) => {
                              const newTiers = [...fundingTiers];
                              newTiers[idx].delivery_year = e.target.value;
                              setFundingTiers(newTiers);
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-sm appearance-none"
                          >
                            <option value="">{language === 'ja' ? '年' : 'Year'}</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{language === 'ja' ? 'お届け予定月' : 'Delivery Month'}</label>
                          <select
                            value={tier.delivery_month}
                            onChange={(e) => {
                              const newTiers = [...fundingTiers];
                              newTiers[idx].delivery_month = e.target.value;
                              setFundingTiers(newTiers);
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-sm appearance-none"
                          >
                            <option value="">{language === 'ja' ? '月' : 'Month'}</option>
                            {Array.from({ length: 12 }, (_, i) => (
                              <option key={i + 1} value={i + 1}>{i + 1}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{language === 'ja' ? '配送が必要ですか？' : 'Needs Shipping?'}</label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                checked={!tier.needs_shipping}
                                onChange={() => {
                                  const newTiers = [...fundingTiers];
                                  newTiers[idx].needs_shipping = false;
                                  setFundingTiers(newTiers);
                                }}
                                className="accent-emerald-500"
                              />
                              <span className="text-sm text-slate-800 dark:text-white">{language === 'ja' ? 'いいえ' : 'No'}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                checked={tier.needs_shipping}
                                onChange={() => {
                                  const newTiers = [...fundingTiers];
                                  newTiers[idx].needs_shipping = true;
                                  setFundingTiers(newTiers);
                                }}
                                className="accent-emerald-500"
                              />
                              <span className="text-sm text-slate-800 dark:text-white">{language === 'ja' ? 'はい' : 'Yes'}</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{language === 'ja' ? '数量制限 (任意)' : 'Limit (Optional)'}</label>
                          <input
                            type="number"
                            value={tier.limit || ''}
                            onChange={(e) => {
                              const newTiers = [...fundingTiers];
                              newTiers[idx].limit = e.target.value;
                              setFundingTiers(newTiers);
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-sm"
                            placeholder={language === 'ja' ? '制限なし' : 'No limit'}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setFundingTiers([...fundingTiers, { amount: '', return_description: '', delivery_year: '2026', delivery_month: '1', needs_shipping: false, limit: '' }])}
                    className="w-full border border-dashed border-slate-300 dark:border-slate-600 hover:border-emerald-500 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 py-2 rounded-lg text-sm transition-colors"
                  >
                    {language === 'ja' ? '+ サポート階層を追加' : '+ Add Support Tier'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{language === 'ja' ? '画像' : 'Images'}</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden group border border-slate-200 dark:border-slate-700">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-video bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
            >
              <ImageIcon className="w-8 h-8 mb-2" />
              <span className="text-sm">{language === 'ja' ? '画像を追加' : 'Add Image'}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              multiple
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!title}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 shadow-md"
        >
          {language === 'ja' ? 'ストアへ投稿' : 'Post to Store'}
        </button>
      </div>
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          navigate('/completed');
        }}
        itemId={Number(projectId)}
        itemType="project"
      />
    </div>
  );
}
