import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Camera, Loader2, User as UserIcon } from 'lucide-react';
import { getAccountTypeBorderClass } from '../utils/avatar';

export default function AccountTypeModal() {
  const { user, updateUser, language } = useAppContext();
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1 states
  const [accountType, setAccountType] = useState<'individual' | 'organization' | 'municipality' | null>(null);

  // Step 2 states
  const [username, setUsername] = useState(user?.username || '');
  const [title, setTitle] = useState(user?.title || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [isUploading, setIsUploading] = useState(false);

  // Check if we need to show the modal
  const needsSelection = user && !user.is_account_type_selected;

  if (!needsSelection) {
    return null;
  }

  const handleNextStep = () => {
    if (accountType) {
      setStep(2);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 1024;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const base64String = canvas.toDataURL('image/jpeg', 0.8);
            setAvatar(base64String);
          }
          setIsUploading(false);
        };
        img.onerror = () => {
          alert('Failed to read image');
          setIsUploading(false);
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        alert('Failed to read image');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!user || isSubmitting || !accountType) return;
    
    if (!username.trim()) {
      alert(language === 'ja' ? 'ユーザーネームを入力してください' : 'Please enter a username');
      return;
    }

    try {
      setIsSubmitting(true);
      // Wait, there are multiple API calls needed based on server.ts:
      // 1. Settings (account_type, is_account_type_selected)
      // 2. Profile (username, title)
      // 3. Avatar (avatar)
      
      const payloadSettings = { account_type: accountType, is_account_type_selected: 1 };
      const resSettings = await fetch(`/api/users/${user.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadSettings)
      });

      if (!resSettings.ok) throw new Error('Failed to update settings');

      const payloadProfile = { username, title };
      const resProfile = await fetch(`/api/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadProfile)
      });
      if (!resProfile.ok) throw new Error('Failed to update profile');

      let finalUser = await resProfile.json();

      if (avatar && avatar !== user.avatar) {
        const resAvatar = await fetch(`/api/users/${user.id}/avatar`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar })
        });
        if (resAvatar.ok) {
          finalUser = await resAvatar.json();
        }
      }

      updateUser(finalUser);
    } catch (e) {
      console.error(e);
      alert(language === 'ja' ? 'エラーが発生しました' : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/60 p-6 sm:p-8 rounded-3xl max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in duration-300 my-8">
        
        {step === 1 ? (
          <>
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              {language === 'ja' ? 'どのアカウントで始めますか？' : 'Which account do you want to start with?'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 個人 */}
              <button
                type="button"
                onClick={() => setAccountType('individual')}
                disabled={isSubmitting}
                className={`flex flex-col p-5 border-2 rounded-2xl transition-all select-none text-left ${
                  accountType === 'individual' 
                    ? 'border-account-individual bg-[var(--account-individual-bg)] shadow-[0_0_15px_rgba(96,165,250,0.25)]' 
                    : 'border-slate-800 bg-slate-800/60 hover:border-account-individual hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 bg-account-individual rounded-lg text-white font-bold text-xs shrink-0 shadow-md">
                    P
                  </span>
                  <span className="text-lg font-bold text-white">
                    {language === 'ja' ? '個人' : 'Individual'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-[var(--account-individual-text)] mb-2">
                  {language === 'ja' ? '個人' : 'Individual'}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mt-auto">
                  {language === 'ja' ? '自分のVisionやIdeaから始める' : 'Start with your Vision and Idea'}
                </p>
              </button>

              {/* 法人 */}
              <button
                type="button"
                onClick={() => setAccountType('organization')}
                disabled={isSubmitting}
                className={`flex flex-col p-5 border-2 rounded-2xl transition-all select-none text-left ${
                  accountType === 'organization' 
                    ? 'border-account-corporate bg-[var(--account-corporate-bg)] shadow-[0_0_15px_rgba(248,113,113,0.25)]' 
                    : 'border-slate-800 bg-slate-800/60 hover:border-account-corporate hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 bg-account-corporate rounded-lg text-white font-bold text-xs shrink-0 shadow-md">
                    C
                  </span>
                  <span className="text-lg font-bold text-white">
                    {language === 'ja' ? '法人' : 'Corporate'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-[var(--account-corporate-text)] mb-2">
                  {language === 'ja' ? '法人' : 'Corporate'}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mt-auto">
                  {language === 'ja' ? '課題を公開し、Ideaや人とつながる' : 'Publish challenges, connect with Ideas & talent'}
                </p>
              </button>

              {/* 自治体 */}
              <button
                type="button"
                onClick={() => setAccountType('municipality')}
                disabled={isSubmitting}
                className={`flex flex-col p-5 border-2 rounded-2xl transition-all select-none text-left ${
                  accountType === 'municipality' 
                    ? 'border-account-municipality bg-[var(--account-municipality-bg)] shadow-[0_0_15px_rgba(74,222,128,0.25)]' 
                    : 'border-slate-800 bg-slate-800/60 hover:border-account-municipality hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 bg-account-municipality rounded-lg text-white font-bold text-xs shrink-0 shadow-md">
                    M
                  </span>
                  <span className="text-lg font-bold text-white">
                    {language === 'ja' ? '自治体' : 'Municipality'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-[var(--account-municipality-text)] mb-2">
                  {language === 'ja' ? '自治体' : 'Municipality'}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mt-auto">
                  {language === 'ja' ? '地域の課題を公開し、共創する' : 'Publish regional challenges and co-create'}
                </p>
              </button>
            </div>

            <button
              onClick={handleNextStep}
              disabled={!accountType}
              className="mt-8 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20"
            >
              {language === 'ja' ? '次へ' : 'Next'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              {language === 'ja' ? 'プロフィール設定' : 'Profile Setup'}
            </h2>
            <p className="text-slate-400 text-sm text-center mb-8">
              {language === 'ja' 
                ? '表示名、タイトル、プロフィール画像を登録してください。'
                : 'Set your display name, title, and profile image.'}
            </p>

            <div className="flex flex-col items-center mb-6">
              <div className="relative group">
                <div className={`w-24 h-24 rounded-full overflow-hidden ${getAccountTypeBorderClass(accountType, 'border-[3px]')} bg-slate-800 flex items-center justify-center ${isUploading ? 'opacity-50' : ''}`}>
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-10 h-10 text-slate-500" />
                  )}
                </div>
                <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {language === 'ja' ? '変更' : 'Change'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelect}
                    className="hidden"
                  />
                </label>
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {accountType === 'municipality'
                    ? (language === 'ja' ? '自治体名・行政組織名' : 'Municipality / Public Body Name')
                    : accountType === 'organization'
                    ? (language === 'ja' ? '企業・法人名' : 'Company / Organization Name')
                    : (language === 'ja' ? 'ユーザーネーム' : 'Username')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder={
                    accountType === 'municipality'
                      ? (language === 'ja' ? '例: 東京都 / 福岡市 / 美咲町' : 'e.g. Tokyo Metropolis / Fukuoka City')
                      : accountType === 'organization'
                      ? (language === 'ja' ? '例: 株式会社〇〇 / 〇〇研究所' : 'e.g. Acme Corp')
                      : (language === 'ja' ? 'あなたの名前' : 'Your name')
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {accountType === 'municipality'
                    ? (language === 'ja' ? '担当部署・役職' : 'Department / Position')
                    : accountType === 'organization'
                    ? (language === 'ja' ? '部署名・役職' : 'Department / Title')
                    : (language === 'ja' ? '肩書き・Title' : 'Title')}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder={
                    accountType === 'municipality'
                      ? (language === 'ja' ? '例: デジタル戦略推進課 / 官民共創担当' : 'e.g. Digital Strategy Div.')
                      : accountType === 'organization'
                      ? (language === 'ja' ? '例: 新規事業開発部 / CTO' : 'e.g. Business Dev / CTO')
                      : (language === 'ja' ? '例: ソフトウェアエンジニア' : 'e.g. Software Engineer')
                  }
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="flex-1 border border-slate-700 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all"
              >
                {language === 'ja' ? '戻る' : 'Back'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !username.trim()}
                className="flex-[2] bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  language === 'ja' ? '完了' : 'Complete'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
