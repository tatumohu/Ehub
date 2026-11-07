import React, { useState, useRef, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Country, State } from 'country-state-city';
import { STAGES } from '../components/SimpleStageIndicator';
import { User, Building2, Landmark, Settings, LogOut, Shield, Bell, Moon, Globe, ChevronRight, Send, ChevronLeft, Camera, Menu, X, UserCheck, UserPlus, Heart, MessageSquare, Users, SquarePlus, Bookmark, Lock, ShoppingBag, Star, StarHalf, CheckCircle, CheckCircle2, ExternalLink, Crown, MapPin, Sparkles, Lightbulb, Trophy, FolderKanban } from 'lucide-react';

import OrgBadge from '../components/OrgBadge';
import AccountTypeBadge from '../components/AccountTypeBadge';
import VerificationBadge from '../components/VerificationBadge';
import { getAccountTypeBorderClass } from '../utils/avatar';
import HashtagInput from '../components/HashtagInput';
import HashtagDisplay from '../components/HashtagDisplay';
import PlanUpgradeModal from '../components/PlanUpgradeModal';
import ScoutMessageModal from '../components/ScoutMessageModal';


const japanPrefectures: Record<string, string> = {
  '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県', '06': '山形県', '07': '福島県',
  '08': '茨城県', '09': '栃木県', '10': '群馬県', '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県',
  '15': '新潟県', '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県', '21': '岐阜県',
  '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県', '26': '京都府', '27': '大阪府', '28': '兵庫県',
  '29': '奈良県', '30': '和歌山県', '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
  '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県', '41': '佐賀県', '42': '長崎県',
  '43': '熊本県', '44': '大分県', '45': '宮崎県', '46': '鹿児島県', '47': '沖縄県'
};

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, logout, updateUser, language, setLanguage, theme, setTheme } = useAppContext();
  const [activeTab, setActiveTab] = useState<'ema' | 'idea' | 'joint' | 'muni_projects' | 'muni_visions' | 'muni_recruitment' | 'muni_achievements' | 'corp_projects' | 'corp_visions' | 'corp_proposals' | 'corp_achievements'>('ema');
  const [tabItems, setTabItems] = useState<any[]>([]);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [showScoutMessageModal, setShowScoutMessageModal] = useState(false);
  const [showPlanUpgrade, setShowPlanUpgrade] = useState(false);
  const [showScoutMessage, setShowScoutMessage] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editMunicipalityName, setEditMunicipalityName] = useState("");
  const [editPrefecture, setEditPrefecture] = useState("");
  const [editMunicipalityType, setEditMunicipalityType] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [editDepartmentName, setEditDepartmentName] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editCompanyLocation, setEditCompanyLocation] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [activeSettingTab, setActiveSettingTab] = useState<string | null>(null);
  const [settingsState, setSettingsState] = useState({
    privateProfile: false,
    showActivityStatus: true,
    pushNotifications: true,
    emailNotifications: false
  });

  const [isBannerExpanded, setIsBannerExpanded] = useState(false);
  const [likedItems, setLikedItems] = useState<any[]>([]);
  const [userComments, setUserComments] = useState<any[]>([]);
  const [archivedItems, setArchivedItems] = useState<any[]>([]);

  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedRegionCode, setSelectedRegionCode] = useState("");

  const getCountries = () => {
    return Country.getAllCountries().map(c => {
      let displayName = c.name;
      if (language === 'ja') {
        try {
          displayName = new Intl.DisplayNames(['ja'], { type: 'region' }).of(c.isoCode) || c.name;
        } catch (e) {
          // fallback
        }
      }
      return { ...c, displayName };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName, language === 'ja' ? 'ja' : 'en'));
  };

  const getStates = (countryCode: string) => {
    let states = State.getStatesOfCountry(countryCode);
    if (countryCode === 'JP') {
      states = states.sort((a, b) => parseInt(a.isoCode) - parseInt(b.isoCode));
      return states.map(s => ({
        ...s,
        displayName: language === 'ja' ? (japanPrefectures[s.isoCode] || s.name) : s.name
      }));
    }
    return states.map(s => ({ ...s, displayName: s.name })).sort((a, b) => a.displayName.localeCompare(b.displayName, language === 'ja' ? 'ja' : 'en'));
  };


  useEffect(() => {
    if (currentUser) {
      // Only set initial values if we haven't selected anything yet, or if currentUser explicitly updated
      if (selectedCountryCode === "" && selectedRegionCode === "" && (currentUser.country || currentUser.region)) {
        setSelectedCountryCode(currentUser.country || "");
        setSelectedRegionCode(currentUser.region || "");
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    if ((currentUser.country || "") !== selectedCountryCode || (currentUser.region || "") !== selectedRegionCode) {
      // If the selected values are empty strings but currentUser also has empty strings/null, no need to save
      // But if user explicitly clears it, then we save.
      const timeoutId = setTimeout(() => {
        fetch(`/api/users/${currentUser?.id}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country: selectedCountryCode, region: selectedRegionCode })
        }).then(res => res.json()).then(data => updateUser(data)).catch(console.error);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedCountryCode, selectedRegionCode]);


  const isOwnProfile = !id || id === currentUser?.id?.toString();
  const targetUserId = id || currentUser?.id;

  useEffect(() => {
    const handleResetView = () => {
      setIsSettingsOpen(false);
      setIsEditProfileOpen(false);
      setIsMenuOpen(false);
    };
    window.addEventListener('reset-profile-view', handleResetView);
    return () => window.removeEventListener('reset-profile-view', handleResetView);
  }, []);

  useEffect(() => {
    if (isSettingsOpen && targetUserId) {
      // Fetch likes
      fetch(`/api/users/${targetUserId}/likes${currentUser ? `?user_id=${encodeURIComponent(currentUser.id)}` : ''}`)
        .then(res => res.json())
        .then(data => setLikedItems(Array.isArray(data) ? data : []))
        .catch(console.error);
        
      // Fetch comments
      fetch(`/api/users/${targetUserId}/comments${currentUser ? `?user_id=${encodeURIComponent(currentUser.id)}` : ''}`)
        .then(res => res.json())
        .then(data => setUserComments(Array.isArray(data) ? data : []))
        .catch(console.error);
        
      // Fetch archives
      fetch(`/api/users/${targetUserId}/archives${currentUser ? `?user_id=${encodeURIComponent(currentUser.id)}` : ''}`)
        .then(res => res.json())
        .then(data => setArchivedItems(Array.isArray(data) ? data : []))
        .catch(console.error);
    }
  }, [isSettingsOpen, targetUserId]);

  const openEditProfile = () => {
    setEditUsername(currentUser?.username || "");
    setEditTitle(currentUser?.title || "");
    setEditMunicipalityName(currentUser?.municipality_name || currentUser?.username || "");
    setEditPrefecture(currentUser?.prefecture || currentUser?.region || "");
    setEditMunicipalityType(currentUser?.municipality_type || "中核市");
    setEditWebsiteUrl(currentUser?.official_website || currentUser?.website_url || "");
    setEditDepartmentName(currentUser?.department || currentUser?.department_name || "");
    setEditCompanyName(currentUser?.company_name || currentUser?.username || "");
    setEditIndustry(currentUser?.industry || "IT・通信");
    setEditCompanyLocation(currentUser?.company_location || currentUser?.region || currentUser?.country || "");
    let initialTags = currentUser?.tags || "";
    if (initialTags === "[]" || initialTags === "#[]") {
      initialTags = "";
    } else {
      initialTags = initialTags.replace('#[] ', '').replace('#[]', '');
    }
    setEditTags(initialTags);
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      const isMuni = currentUser.account_type === 'municipality';
      const isCorp = currentUser.account_type === 'corporate' || currentUser.account_type === 'organization';

      const payload = isMuni ? {
        username: editMunicipalityName || editUsername,
        title: editTitle,
        tags: editTags,
        municipality_name: editMunicipalityName,
        prefecture: editPrefecture,
        municipality_type: editMunicipalityType,
        website_url: editWebsiteUrl,
        official_website: editWebsiteUrl,
        department_name: editDepartmentName,
        department: editDepartmentName,
        verification_status: currentUser.verification_status || 'verified',
      } : isCorp ? {
        username: editCompanyName || editUsername,
        title: editTitle,
        tags: editTags,
        company_name: editCompanyName,
        industry: editIndustry,
        company_location: editCompanyLocation,
        website_url: editWebsiteUrl,
        official_website: editWebsiteUrl,
        department_name: editDepartmentName,
        department: editDepartmentName,
      } : {
        username: editUsername,
        title: editTitle,
        tags: editTags,
      };

      const res = await fetch(`/api/users/${currentUser.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updatedUser = await res.json();
        updateUser(updatedUser);
        setIsEditProfileOpen(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update profile');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const toggleSetting = async (key: keyof typeof settingsState) => {
    if (typeof settingsState[key] === 'boolean') {
      const newValue = !settingsState[key];
      setSettingsState(prev => ({ ...prev, [key]: newValue }));
      
      if (currentUser && isOwnProfile && (key === 'privateProfile' || key === 'showActivityStatus')) {
        try {
          const res = await fetch(`/api/users/${currentUser.id}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              private_profile: key === 'privateProfile' ? newValue : settingsState.privateProfile,
              show_activity_status: key === 'showActivityStatus' ? newValue : settingsState.showActivityStatus
            })
          });
          if (res.ok) {
            const updated = await res.json();
            updateUser(updated);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  };
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listType, setListType] = useState<string>('subscriptions');
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [profileUser, setProfileUser] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (targetUserId) {
      fetch(`/api/users/${targetUserId}${currentUser ? `?current_user_id=${encodeURIComponent(currentUser.id)}` : ''}`)
        .then(res => res.json())
        .then(data => {
          setProfileUser(data);
          setStats(data);
          if (!isOwnProfile && data.isSubscribed !== undefined) {
             setIsSubscribed(data.isSubscribed);
          }
        })
        .catch(console.error);
    }
  }, [targetUserId, id, currentUser, isOwnProfile]);

  useEffect(() => {
    if (targetUserId && isMenuOpen) {
      setIsLoadingList(true);
      setSubscriptions([]);
      
      let fetchEndpoint = listType;
      
      fetch(`/api/users/${targetUserId}/${fetchEndpoint}${currentUser ? `?user_id=${encodeURIComponent(currentUser.id)}` : ''}`)
        .then(res => res.json())
        .then(data => {
          setSubscriptions(data);
          setIsLoadingList(false);
        })
        .catch(() => setIsLoadingList(false));
    }
  }, [targetUserId, listType, isMenuOpen]);

  useEffect(() => {
    if (targetUserId) {
      setIsLoadingTab(true);
      setTabItems([]);
      
      let fetchEndpoint: string = activeTab;
      if (activeTab === 'idea' || activeTab === 'muni_recruitment' || activeTab === 'corp_proposals') fetchEndpoint = 'ideas';
      else if (activeTab === 'ema' || activeTab === 'muni_projects' || activeTab === 'muni_visions' || activeTab === 'muni_achievements' || activeTab === 'corp_projects' || activeTab === 'corp_visions' || activeTab === 'corp_achievements') fetchEndpoint = 'projects';

      fetch(`/api/users/${targetUserId}/${fetchEndpoint}${currentUser ? `?user_id=${encodeURIComponent(currentUser.id)}` : ''}`)
        .then(res => res.json())
        .then(data => {
          const filterVisible = (item: any) => {
            if (!item.is_private) return true;
            if (currentUser && item.author_id === currentUser.id) return true;
            try {
              const permitted = JSON.parse(item.permitted_users || '[]');
              if (currentUser && permitted.includes(currentUser.id)) return true;
            } catch (e) {}
            return false;
          };
          
          let rawItems = Array.isArray(data) ? data.filter(filterVisible) : Object.values(data || {}).flat().filter(filterVisible);

          if (activeTab === 'muni_recruitment' || activeTab === 'corp_proposals') {
            rawItems = rawItems.filter((item: any) => Number(item.is_recruitment) === 1 || item.type === 'idea');
          } else if (activeTab === 'muni_achievements' || activeTab === 'corp_achievements') {
            rawItems = rawItems.filter((item: any) => item.status === 'completed' || Number(item.is_buyout) === 1 || item.has_contract === 1);
          }

          setTabItems(rawItems);
          setIsLoadingTab(false);
        })
        .catch(() => setIsLoadingTab(false));
    }
  }, [targetUserId, activeTab]);

  useEffect(() => {
    if (currentUser && isOwnProfile) {
      setProfileUser(prev => prev ? ({ ...prev, ...currentUser }) : currentUser);
      setSettingsState(prev => ({
        ...prev,
        privateProfile: currentUser.private_profile === 1 || currentUser.private_profile === true,
        showActivityStatus: currentUser.show_activity_status === 1 || currentUser.show_activity_status === true || currentUser.show_activity_status === undefined
      }));
    } else if (profileUser && !isOwnProfile) {
      // Just in case we want to show profile user's settings state (though settings tab is not shown for others)
    }
  }, [currentUser, isOwnProfile]);

  if (!currentUser && !id) {
    return (
      <div className="max-w-[800px] mx-auto px-4 py-20 text-center">
        <User className="w-16 h-16 text-slate-400 dark:text-slate-700 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Sign in to see your profile</h1>
        <p className="text-slate-600 dark:text-slate-400">Manage your account and settings.</p>
      </div>
    );
  }

  if (!profileUser && targetUserId) {
    return <div className="p-20 text-center text-slate-500 dark:text-slate-400">Loading profile...</div>;
  }

  const displayUser = profileUser || currentUser;

  const handleUserClick = (sub: any) => {
    setIsMenuOpen(false);
    navigate(`/profile/${sub.id}`);
  };

  const handleAvatarClick = () => {
    if (isOwnProfile) {
      fileInputRef.current?.click();
    }
  };

  const handleSubscribe = async () => {
    if (!currentUser || isOwnProfile) return;
    try {
      const endpoint = isSubscribed ? 'unsubscribe' : 'subscribe';
      const res = await fetch(`/api/users/${profileUser.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriber_id: currentUser.id })
      });
      if (res.ok) {
        setIsSubscribed(!isSubscribed);
        setStats((prev: any) => ({ 
          ...prev, 
          subscriberCount: isSubscribed ? (prev?.subscriberCount || 1) - 1 : (prev?.subscriberCount || 0) + 1 
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = async () => {
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
            
            try {
              const res = await fetch(`/api/users/${currentUser.id}/avatar`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ avatar: base64String }),
              });

              if (res.ok) {
                const updatedUser = await res.json();
                updateUser(updatedUser);
              } else {
                alert('Failed to update avatar');
              }
            } catch (error) {
              console.error('Error updating avatar on server:', error);
              alert('Error updating avatar');
            }
          }
          setIsUploading(false);
        };
        img.onerror = () => {
          alert('Failed to process image');
          setIsUploading(false);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Error uploading avatar');
      setIsUploading(false);
    }
  };

  const settingsItems = [
    { id: 'Purchase History', icon: <ShoppingBag className="w-5 h-5 text-indigo-400" />, label: language === 'ja' ? '購入履歴' : 'Purchase History', description: language === 'ja' ? '購入したリターン一覧' : 'Purchased returns list', isLink: true, to: '/purchases' },
    { id: 'Like', icon: <Heart className="w-5 h-5 text-red-500" />, label: language === 'ja' ? 'いいね' : 'Like', description: language === 'ja' ? 'いいねしたVisionとIdea' : 'Liked Vision and Ideas' },
    { id: 'Comment', icon: <MessageSquare className="w-5 h-5 text-blue-500" />, label: language === 'ja' ? 'コメント' : 'Comment', description: language === 'ja' ? 'あなたのコメント' : 'Your comments' },
    { id: 'Archive', icon: <Bookmark className="w-5 h-5 text-yellow-500" />, label: language === 'ja' ? 'アーカイブ' : 'Archive', description: language === 'ja' ? 'アーカイブされた引用' : 'Archived quotes' },
    { id: 'Privacy & Security', icon: <Shield className="w-5 h-5 text-emerald-500" />, label: language === 'ja' ? 'プライバシーとセキュリティ' : 'Privacy & Security', description: language === 'ja' ? 'データとアカウントのセキュリティを管理' : 'Manage your data and account security' },
    { id: 'Notifications', icon: <Bell className="w-5 h-5 text-purple-500" />, label: language === 'ja' ? '通知' : 'Notifications', description: language === 'ja' ? 'アラートの受信方法を設定' : 'Configure how you receive alerts' },
    { id: 'Language', icon: <Globe className="w-5 h-5 text-indigo-500" />, label: language === 'ja' ? '言語 (Language)' : 'Language', description: language === 'ja' ? '希望の言語を選択' : 'Choose your preferred language' },
    { id: 'Appearance', icon: <Moon className="w-5 h-5 text-slate-400" />, label: language === 'ja' ? '外観' : 'Appearance', description: language === 'ja' ? 'ライト/ダークテーマの切り替え' : 'Switch between light and dark themes' },
  ];

  return (
    <div className="w-full px-1 sm:px-4 py-2.5 sm:py-3.5 lg:py-4 pb-32 relative min-h-screen">
      <div className="max-w-[800px] mx-auto">
        {/* Subscriptions Drawer */}
        {isMenuOpen && (
          <div
            className="fixed inset-0 z-[90]"
          >
            <div
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <div className="fixed inset-0 flex items-center justify-center p-4 pt-[130px] pb-[80px] md:pb-[100px] pointer-events-none z-[90]">
              <div
                className="relative w-full max-w-lg bg-white dark:bg-[#0b0f19]/90 backdrop-blur-2xl border border-slate-200 dark:border-cyan-500/30 rounded-3xl p-6 shadow-2xl dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] pointer-events-auto overflow-hidden flex flex-col max-h-full text-slate-900 dark:text-white"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-red-500" />
                      {listType === 'subscriptions' ? (language === 'ja' ? 'フォロー中' : 'Following') : 
                       listType === 'subscribers' ? (language === 'ja' ? 'フォロワー' : 'Followers') : 
                       listType === 'joint' ? 'Joint' : 
                       listType === 'idea' ? 'Idea' : 'Vision'}
                    </h2>
                  </div>
                  <button onClick={() => {
                    setIsMenuOpen(false);
                  }} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4 overflow-y-auto flex-1 scrollbar-hide">
                  {isLoadingList ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 text-sm">Loading {listType === 'idea' ? 'ideas' : listType}...</p>
                    </div>
                  ) : subscriptions.length > 0 ? (
                    (listType === 'joint' || listType === 'ema' || listType === 'idea') ? (
                      <div className="grid grid-cols-2 gap-6">
                        {subscriptions.map((item) => {
                          const targetUrl = item.type === 'project' && (item.status === 'completed' || Number(item.is_buyout) === 1) ? `/completed/${item.id}` : `/${item.type}/${item.id}`;
                          return (
                          <Link 
                            key={`${item.type}-${item.id}`}
                            to={targetUrl}
                            onClick={() => setIsMenuOpen(false)}
                            className="block group relative"
                          >
                            <div 
                              className="relative aspect-[16/9] overflow-hidden bg-slate-800 border border-slate-700/50 shadow-lg mb-3"
                              style={item.type === 'project' ? {
                                clipPath: 'polygon(0% 25%, 50% 0%, 100% 25%, 100% 100%, 0% 100%)',
                                WebkitClipPath: 'polygon(0% 25%, 50% 0%, 100% 25%, 100% 100%, 0% 100%)',
                                borderRadius: '0'
                              } : {
                                borderRadius: '1rem'
                              }}
                            >
                              <img 
                                src={item.image || undefined} 
                                alt={item.title} 
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 transition-opacity duration-300"></div>
                              
                              <div className="absolute bottom-0 left-0 right-0 p-4">
                                <h3 className="text-white font-bold text-lg leading-tight group-hover:text-blue-400 transition-colors line-clamp-1 mb-2">
                                  {item.title}
                                </h3>
                                <div className="flex items-center gap-2 text-[10px] text-slate-300">
                                  <img src={item.author_avatar || undefined} alt="" className={`w-4 h-4 rounded-full object-cover ${getAccountTypeBorderClass(item.author_account_type || item.account_type, 'border')}`} />
                                  <span className="truncate flex-1 font-medium">{item.author_name}</span>
                                  <div className="flex items-center gap-3 ml-auto shrink-0 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full">
                                    <span className="flex items-center gap-1">
                                      <Heart className="w-2.5 h-2.5 text-pink-500" />
                                      {item.likes_count || 0}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <MessageSquare className="w-2.5 h-2.5 text-blue-400" />
                                      {item.comments_count || 0}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Bookmark className="w-2.5 h-2.5 text-emerald-500" />
                                      {item.archives_count || 0}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Users className="w-2.5 h-2.5 text-emerald-400" />
                                      {item.follows_count || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        )})}
                      </div>
                    ) : (
                      subscriptions.map((sub) => (
                        <div 
                          key={sub.id} 
                          onClick={() => handleUserClick(sub)}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-cyan-500/20 transition-all cursor-pointer group"
                        >
                          <img src={sub.avatar || undefined} alt="" className={`w-10 h-10 rounded-full ${getAccountTypeBorderClass(sub.account_type, 'border-2')} object-cover`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-900 dark:text-white font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{sub.username}</p>
                            <p className="text-slate-500 text-xs">{listType === 'subscriptions' ? (language === 'ja' ? 'フォロー中' : 'Following') : (language === 'ja' ? 'フォロワー' : 'Followers')}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors" />
                        </div>
                      ))
                    )
                  ) : (
                    <div className="text-center py-10">
                      <UserCheck className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                      <p className="text-slate-500 text-sm">
                        {(listType === 'joint' || listType === 'ema' || listType === 'idea')
                          ? 'まだ投稿されていません'
                          : `No ${listType === 'subscriptions' ? 'following' : 'followers'} yet`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plan Upgrade Modal */}
        
      {showScoutMessageModal && (
        <ScoutMessageModal 
          onClose={() => setShowScoutMessageModal(false)}
          targetUserIds={[displayUser?.id.toString()]}
          targetUserNames={[displayUser?.username]}
        />
      )}

        {/* Edit Profile Modal */}
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pt-[130px] pb-[80px] md:pb-[100px]">
            <div
              onClick={() => setIsEditProfileOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <div className="relative w-full max-w-md bg-white dark:bg-[#0b0f19]/90 backdrop-blur-2xl border border-slate-200 dark:border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] z-10 flex flex-col max-h-full">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {language === 'ja' ? 'プロフィールを編集' : 'Edit Profile'}
                </h2>
                <button
                  onClick={() => setIsEditProfileOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                {currentUser?.account_type === 'municipality' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        自治体名
                      </label>
                      <input
                        type="text"
                        value={editMunicipalityName}
                        onChange={(e) => {
                          setEditMunicipalityName(e.target.value);
                          setEditUsername(e.target.value);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                        placeholder="例: 東京都渋谷区, 長野県軽井沢町"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          都道府県
                        </label>
                        <input
                          type="text"
                          value={editPrefecture}
                          onChange={(e) => setEditPrefecture(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                          placeholder="例: 東京都"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          自治体区分
                        </label>
                        <select
                          value={editMunicipalityType}
                          onChange={(e) => setEditMunicipalityType(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="政令指定都市">政令指定都市</option>
                          <option value="中核市">中核市</option>
                          <option value="施行時特例市">施行時特例市</option>
                          <option value="一般市">一般市</option>
                          <option value="町・村">町・村</option>
                          <option value="特別区">特別区</option>
                          <option value="広域連合・一部事務組合">広域連合・一部事務組合</option>
                          <option value="その他地方公共団体">その他地方公共団体</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        担当部署名
                      </label>
                      <input
                        type="text"
                        value={editDepartmentName}
                        onChange={(e) => setEditDepartmentName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                        placeholder="例: デジタル戦略課 官民連携推進係"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        公式WebサイトURL
                      </label>
                      <input
                        type="text"
                        value={editWebsiteUrl}
                        onChange={(e) => setEditWebsiteUrl(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                        placeholder="https://www.city.example.lg.jp"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        自治体Vision / 重点テーマ宣言
                      </label>
                      <textarea
                        rows={3}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                        placeholder="例: デジタル技術と官民共創を活用し、子育て支援と持続可能なスマートシティの構築を実現します。"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        注力テーマタグ
                      </label>
                      <HashtagInput value={editTags} onChange={setEditTags} />
                    </div>
                  </div>
                ) : (currentUser?.account_type === 'corporate' || currentUser?.account_type === 'organization') ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        法人名 (企業・組織名)
                      </label>
                      <input
                        type="text"
                        value={editCompanyName}
                        onChange={(e) => {
                          setEditCompanyName(e.target.value);
                          setEditUsername(e.target.value);
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        placeholder="例: 株式会社テックイノベーション"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          業種
                        </label>
                        <select
                          value={editIndustry}
                          onChange={(e) => setEditIndustry(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="IT・通信">IT・通信</option>
                          <option value="製造業">製造業</option>
                          <option value="サービス・コンサルティング">サービス・コンサルティング</option>
                          <option value="金融・保険">金融・保険</option>
                          <option value="不動産・建設">不動産・建設</option>
                          <option value="医療・ヘルスケア">医療・ヘルスケア</option>
                          <option value="小売・EC・流通">小売・EC・流通</option>
                          <option value="エネルギー・環境">エネルギー・環境</option>
                          <option value="メディア・広告">メディア・広告</option>
                          <option value="その他">その他</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          所在地 (都道府県・市区)
                        </label>
                        <input
                          type="text"
                          value={editCompanyLocation}
                          onChange={(e) => setEditCompanyLocation(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                          placeholder="例: 東京都港区"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        担当部署名
                      </label>
                      <input
                        type="text"
                        value={editDepartmentName}
                        onChange={(e) => setEditDepartmentName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        placeholder="例: 新規事業開発部 官民共創推進室"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        公式WebサイトURL
                      </label>
                      <input
                        type="text"
                        value={editWebsiteUrl}
                        onChange={(e) => setEditWebsiteUrl(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        placeholder="https://www.example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        企業Vision / 事業ミッション
                      </label>
                      <textarea
                        rows={3}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                        placeholder="例: 最新のテクノロジーとオープンイノベーションを通じて、持続可能な社会基盤を創造します。"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        注力領域・キーワードタグ
                      </label>
                      <HashtagInput value={editTags} onChange={setEditTags} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {language === 'ja' ? 'ユーザー名' : 'Username'}
                      </label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 backdrop-blur-md border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
                        placeholder={language === 'ja' ? 'ユーザー名' : 'Username'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {language === 'ja' ? '肩書き' : 'Title'}
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 backdrop-blur-md border border-slate-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 transition-colors"
                        placeholder={language === 'ja' ? '肩書き (例: プロダクトデザイナー)' : 'Title (e.g. Product Designer)'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {language === 'ja' ? '興味' : 'Interests'}
                      </label>
                      <HashtagInput value={editTags} onChange={setEditTags} />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {language === 'ja' ? 'キャンセル' : 'Cancel'}
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile || !editUsername.trim()}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 transition-colors"
                >
                  {isSavingProfile ? (language === 'ja' ? '保存中...' : 'Saving...') : (language === 'ja' ? '保存' : 'Save')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[90]">
            <div
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <div className="fixed inset-0 flex items-center justify-center p-4 pt-[130px] pb-[80px] md:pb-[100px] pointer-events-none z-[90]">
              <div className="relative w-full max-w-4xl bg-white dark:bg-[#0b0f19]/95 backdrop-blur-2xl border border-slate-200 dark:border-cyan-500/30 rounded-3xl p-0 shadow-2xl dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] pointer-events-auto overflow-hidden flex flex-col md:flex-row h-full max-h-[800px] text-slate-900 dark:text-white">
                {/* Sidebar / List */}
                <div className={`w-full md:w-1/3 bg-slate-50 dark:bg-slate-900 md:border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col h-full shrink-0 relative z-20 ${activeSettingTab !== null ? 'hidden md:flex' : 'flex'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{language === 'ja' ? 'アカウント設定' : 'Account Settings'}</h2>
                    <button onClick={() => {
                      setIsSettingsOpen(false);
                      setActiveSettingTab(null);
                    }} className="md:hidden text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1.5">
                    {settingsItems.map((item, i) => {
                      const isActive = activeSettingTab === item.id;
                      if (item.isLink) {
                        return (
                          <Link
                            key={i}
                            to={item.to as string}
                            onClick={() => {
                              setIsSettingsOpen(false);
                              setActiveSettingTab(null);
                            }}
                            className={`w-full text-left p-3.5 rounded-xl transition-all flex items-center gap-4 ${
                              isActive
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-sm'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <div className="shrink-0">{item.icon}</div>
                            <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{item.label}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                            </div>
                          </Link>
                        );
                      }
                      return (
                        <button
                          key={i}
                          onClick={() => setActiveSettingTab(item.id)}
                          className={`w-full text-left p-3.5 rounded-xl transition-all flex items-center gap-4 ${
                            isActive
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-sm'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <div className="shrink-0">{item.icon}</div>
                          <div>
                            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{item.label}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                          </div>
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        setActiveSettingTab(null);
                        logout();
                      }}
                      className="w-full text-left p-3.5 rounded-xl transition-all flex flex-row items-center gap-4 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    >
                      <LogOut className="w-5 h-5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{language === 'ja' ? 'サインアウト' : 'Sign Out'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{language === 'ja' ? 'アカウントからログアウト' : 'Log out of your account'}</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Content Area */}
                <div className={`flex-1 bg-slate-100/70 dark:bg-slate-900/50 p-6 overflow-y-auto relative h-full ${activeSettingTab === null ? 'hidden' : 'block md:block'}`}>
                  <div className="flex items-center justify-between mb-6 md:mb-0">
                    <button 
                      onClick={() => setActiveSettingTab(null)}
                      className="md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-2"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      {language === 'ja' ? '戻る' : 'Back'}
                    </button>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white md:hidden">
                       {language === 'ja' && activeSettingTab === 'Privacy & Security' ? 'プライバシーとセキュリティ' :
                        language === 'ja' && activeSettingTab === 'Notifications' ? '通知' :
                        language === 'ja' && activeSettingTab === 'Language' ? '言語' :
                        language === 'ja' && activeSettingTab === 'Appearance' ? '外観' : activeSettingTab}
                    </h2>
                    <button onClick={() => {
                      setIsSettingsOpen(false);
                      setActiveSettingTab(null);
                    }} className="text-slate-400 hover:text-slate-900 dark:hover:text-white md:absolute md:top-6 md:right-6 md:z-10 transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="animate-in fade-in duration-300 max-w-xl mx-auto pt-4 md:pt-0 pb-10">
                    {activeSettingTab === 'Like' && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">{language === 'ja' ? 'いいねしたアイテム' : 'Liked Items'}</h3>
                        {likedItems.length === 0 ? (
                          <p className="text-slate-500 dark:text-slate-400">{language === 'ja' ? 'いいねしたアイテムはありません。' : 'No liked items.'}</p>
                        ) : (
                          <div className="space-y-4">
                            {likedItems.map((item: any, i: number) => {
                              const targetUrl = item.type === 'project' && (item.status === 'completed' || Number(item.is_buyout) === 1) ? `/completed/${item.id}` : `/${item.type}/${item.id}`;
                              return (
                              <Link to={targetUrl} key={i} className="flex gap-4 p-4 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-700/50 shadow-sm">
                                {item.image && <img src={item.image || undefined} className="w-16 h-16 object-cover rounded-lg shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{item.type}</p>
                                  <h4 className="font-medium text-slate-900 dark:text-white truncate">{item.title}</h4>
                                  <p className="text-sm text-slate-600 dark:text-slate-400">By {item.author_name}</p>
                                </div>
                              </Link>
                            )})}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {activeSettingTab === 'Comment' && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">{language === 'ja' ? 'あなたのコメント' : 'Your Comments'}</h3>
                        {userComments.length === 0 ? (
                          <p className="text-slate-500 dark:text-slate-400">{language === 'ja' ? 'コメントはまだありません。' : 'No comments yet.'}</p>
                        ) : (
                          <div className="space-y-4">
                            {userComments.map((comment: any, i: number) => (
                              <div key={i} className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 space-y-3 shadow-sm">
                                <p className="text-slate-800 dark:text-white text-sm line-clamp-3">{comment.content}</p>
                                <Link to={`/${comment.idea_id ? 'idea' : 'project'}/${comment.idea_id || comment.project_id}`} className="block p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg group">
                                  <p className="text-xs text-slate-500 mb-1">{comment.idea_id ? 'Idea' : 'Vision'}</p>
                                  <h4 className="font-medium text-slate-800 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{comment.idea_title || comment.project_title}</h4>
                                  <p className="text-xs text-slate-500">By {comment.idea_author_name || comment.project_author_name}</p>
                                </Link>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeSettingTab === 'Archive' && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">{language === 'ja' ? 'アーカイブされた引用' : 'Archived Quotes'}</h3>
                        {archivedItems.length === 0 ? (
                          <p className="text-slate-500 dark:text-slate-400">{language === 'ja' ? 'アーカイブされたアイテムはありません。' : 'No archived items.'}</p>
                        ) : (
                          <div className="space-y-4">
                            {archivedItems.map((item: any, i: number) => {
                              const targetUrl = item.type === 'project' && (item.status === 'completed' || Number(item.is_buyout) === 1) ? `/completed/${item.id}` : `/${item.type}/${item.id}`;
                              return (
                              <Link to={targetUrl} key={i} className="flex gap-4 p-4 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-700/50 shadow-sm">
                                {item.image && <img src={item.image || undefined} className="w-16 h-16 object-cover rounded-lg shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-xs tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-1">{item.type}</p>
                                  <h4 className="font-medium text-slate-900 dark:text-white truncate">{item.title}</h4>
                                  <p className="text-sm text-slate-600 dark:text-slate-400">By {item.author_name}</p>
                                </div>
                              </Link>
                            )})}
                          </div>
                        )}
                      </div>
                    )}

                    {activeSettingTab === 'Appearance' && (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{language === 'ja' ? 'お使いのデバイスでのE-hubの外観をカスタマイズします。' : 'Customize how E-hub looks on your device.'}</p>
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => setTheme('dark')}
                            className={`p-6 border-2 rounded-3xl flex flex-col items-center gap-3 transition-all ${
                              theme === 'dark' 
                                ? 'bg-slate-800 border-indigo-500 dark:border-white text-white scale-[1.02] shadow-md' 
                                : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <Moon className={`w-8 h-8 ${theme === 'dark' ? 'text-indigo-400 dark:text-white' : 'text-slate-400'}`} />
                            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-700 dark:text-slate-400'}`}>{language === 'ja' ? 'ダークモード' : 'Dark Mode'}</span>
                            {theme === 'dark' ? (
                              <span className="text-xs px-2.5 py-1 bg-indigo-500/20 text-indigo-300 dark:bg-white/20 dark:text-white rounded-md font-medium">{language === 'ja' ? 'アクティブ' : 'Active'}</span>
                            ) : (
                              <div className="h-6"></div>
                            )}
                          </button>
                          <button 
                            onClick={() => setTheme('light')}
                            className={`p-6 border-2 rounded-3xl flex flex-col items-center gap-3 transition-all ${
                              theme === 'light'
                                ? 'bg-white border-indigo-600 dark:border-white text-slate-900 dark:text-white scale-[1.02] shadow-md'
                                : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-200 flex items-center justify-center border border-slate-300 dark:border-transparent">
                              <div className={`w-4 h-4 rounded-full ${theme === 'light' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                            </div>
                            <span className={`font-medium ${theme === 'light' ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-400'}`}>{language === 'ja' ? 'ライトモード' : 'Light Mode'}</span>
                            {theme === 'light' ? (
                              <span className="text-xs px-2.5 py-1 bg-indigo-50 dark:bg-white/20 text-indigo-600 dark:text-white rounded-md font-medium">{language === 'ja' ? 'アクティブ' : 'Active'}</span>
                            ) : (
                              <div className="h-6"></div>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    {activeSettingTab === 'Privacy & Security' && (
                        <div className="space-y-4">
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{language === 'ja' ? 'データ、パスワード、アカウントのセキュリティ設定をここで管理します。' : 'Manage your data, password and account security settings here.'}</p>
                          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-slate-900 dark:text-white font-medium">{language === 'ja' ? 'プライベートプロフィール' : 'Private Profile'}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{language === 'ja' ? '承認されたフォロワーのみがあなたの投稿を閲覧できます。' : 'Only approved followers can see your posts.'}</p>
                              </div>
                              <div 
                                onClick={() => toggleSetting('privateProfile')}
                                className={`w-11 h-6 rounded-full cursor-pointer relative transition-colors ${settingsState.privateProfile ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${settingsState.privateProfile ? 'right-1 bg-white' : 'left-1 bg-slate-500 dark:bg-slate-400'}`}></div>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-slate-900 dark:text-white font-medium">{language === 'ja' ? 'アクティビティステータスを表示' : 'Show Activity Status'}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{language === 'ja' ? 'あなたがオンラインかどうかを他の人に表示します。' : 'Allow others to see when you are online.'}</p>
                              </div>
                              <div 
                                onClick={() => toggleSetting('showActivityStatus')}
                                className={`w-11 h-6 rounded-full cursor-pointer relative transition-colors ${settingsState.showActivityStatus ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${settingsState.showActivityStatus ? 'right-1 bg-white' : 'left-1 bg-slate-500 dark:bg-slate-400'}`}></div>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 mt-4 shadow-sm">
                            <div className="flex flex-col gap-2">
                              <div>
                                <h3 className="text-slate-900 dark:text-white font-medium">{language === 'ja' ? 'アカウント種別' : 'Account Type'}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {language === 'ja' ? '個人・法人・自治体のいずれかのアカウント種別を選択してください。' : 'Choose your account type (Individual, Corporate, or Municipality).'}
                                </p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (currentUser) {
                                      const newType = 'individual';
                                      fetch(`/api/users/${currentUser.id}/settings`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ account_type: newType, is_account_type_selected: 1 })
                                      }).then(res => res.json()).then(data => updateUser(data)).catch(console.error);
                                    }
                                  }}
                                  className={`p-3 rounded-2xl flex items-center gap-3 border transition-all text-left ${
                                    currentUser?.account_type === 'individual' || !currentUser?.account_type
                                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-950 dark:text-white shadow-sm' 
                                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                                  }`}
                                >
                                  <div className="w-9 h-9 rounded-full border-2 border-blue-500 bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-bold text-xs">{language === 'ja' ? '個人' : 'Individual'}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{language === 'ja' ? '個人アカウント' : 'Personal Account'}</div>
                                  </div>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (currentUser) {
                                      const newType = 'organization';
                                      fetch(`/api/users/${currentUser.id}/settings`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ account_type: newType, is_account_type_selected: 1 })
                                      }).then(res => res.json()).then(data => updateUser(data)).catch(console.error);
                                    }
                                  }}
                                  className={`p-3 rounded-2xl flex items-center gap-3 border transition-all text-left ${
                                    currentUser?.account_type === 'organization' || currentUser?.account_type === 'corporate'
                                      ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-950 dark:text-white shadow-sm' 
                                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                                  }`}
                                >
                                  <div className="w-9 h-9 rounded-full border-2 border-emerald-500 bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                    <Building2 className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-bold text-xs">{language === 'ja' ? '法人' : 'Corporate'}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{language === 'ja' ? '法人アカウント' : 'Corporate Account'}</div>
                                  </div>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (currentUser) {
                                      const newType = 'municipality';
                                      fetch(`/api/users/${currentUser.id}/settings`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ account_type: newType, is_account_type_selected: 1 })
                                      }).then(res => res.json()).then(data => updateUser(data)).catch(console.error);
                                    }
                                  }}
                                  className={`p-3 rounded-2xl flex items-center gap-3 border transition-all text-left ${
                                    currentUser?.account_type === 'municipality'
                                      ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-950 dark:text-white shadow-sm' 
                                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                                  }`}
                                >
                                  <div className="w-9 h-9 rounded-full border-2 border-purple-500 bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                                    <Landmark className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-bold text-xs">{language === 'ja' ? '自治体' : 'Municipality'}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{language === 'ja' ? '自治体アカウント' : 'Municipality Account'}</div>
                                  </div>
                                </button>
                              </div>
                              
                              
                          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 mt-4 shadow-sm">
                            <div className="flex flex-col gap-2">
                              <div>
                                <h3 className="text-slate-900 dark:text-white font-medium">{language === 'ja' ? '地域設定' : 'Region Settings'}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {language === 'ja' ? '国と地域を設定して、あなたに合ったおすすめを表示します。' : 'Set your country and region to get localized recommendations.'}
                                </p>
                              </div>
                              <div className="mt-2 space-y-3">
                                <div>
                                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{language === 'ja' ? '国' : 'Country'}</label>
                                  <select 
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500"
                                    value={selectedCountryCode}
                                    onChange={(e) => {
                                      setSelectedCountryCode(e.target.value);
                                      setSelectedRegionCode('');
                                    }}
                                  >
                                    <option value="">{language === 'ja' ? '選択してください' : 'Select Country'}</option>
                                    {getCountries().map(c => (
                                      <option key={c.isoCode} value={c.isoCode}>{c.displayName}</option>
                                    ))}
                                  </select>
                                </div>
                                {selectedCountryCode && (
                                  <div>
                                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{language === 'ja' ? '都道府県 / 州' : 'State / Province / Region'}</label>
                                    <select 
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500"
                                      value={selectedRegionCode}
                                      onChange={(e) => {
                                        setSelectedRegionCode(e.target.value);
                                      }}
                                    >
                                      <option value="">{language === 'ja' ? '選択してください' : 'Select Region'}</option>
                                      {getStates(selectedCountryCode).map(s => (
                                        <option key={s.isoCode} value={s.isoCode}>{s.displayName}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                              </div>
                            </div>
                          </div>

                              {(currentUser?.account_type === 'organization' || currentUser?.account_type === 'corporate' || currentUser?.account_type === 'municipality') && (
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                                  <h3 className="text-slate-900 dark:text-white font-medium mb-3">
                                    {currentUser?.account_type === 'municipality'
                                      ? (language === 'ja' ? '自治体プラン' : 'Municipality Plan')
                                      : (language === 'ja' ? '法人プラン' : 'Corporate Plan')}
                                  </h3>
                                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <button
                                      onClick={() => {
                                        if (currentUser) {
                                          const target = currentUser.account_type === 'municipality' ? 'basic' : 'light';
                                          fetch(`/api/users/${currentUser.id}/settings`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ org_plan: target })
                                          }).then(res => res.json()).then(data => updateUser(data)).catch(console.error);
                                        }
                                      }}
                                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                                        (!currentUser.org_plan || currentUser.org_plan === 'light' || currentUser.org_plan === 'basic')
                                          ? (currentUser?.account_type === 'municipality' ? 'bg-purple-600 text-white shadow-sm' : 'bg-emerald-500 text-white shadow-sm')
                                          : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                      }`}
                                    >
                                      {currentUser?.account_type === 'municipality' ? 'Basic' : 'Light'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (currentUser) {
                                          fetch(`/api/users/${currentUser.id}/settings`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ org_plan: 'standard' })
                                          }).then(res => res.json()).then(data => updateUser(data)).catch(console.error);
                                        }
                                      }}
                                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                                        currentUser?.org_plan === 'standard' || currentUser?.org_plan === 'pro'
                                          ? (currentUser?.account_type === 'municipality' ? 'bg-purple-600 text-white shadow-sm' : 'bg-emerald-500 text-white shadow-sm')
                                          : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                      }`}
                                    >
                                      Standard
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (currentUser) {
                                          fetch(`/api/users/${currentUser.id}/settings`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ org_plan: 'enterprise' })
                                          }).then(res => res.json()).then(data => updateUser(data)).catch(console.error);
                                        }
                                      }}
                                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                                        currentUser?.org_plan === 'enterprise'
                                          ? (currentUser?.account_type === 'municipality' ? 'bg-purple-600 text-white shadow-sm' : 'bg-emerald-500 text-white shadow-sm')
                                          : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                      }`}
                                    >
                                      Enterprise
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <button className="w-full py-4 text-center text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800/50 rounded-xl mt-4 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
                            {language === 'ja' ? 'パスワードを変更' : 'Change Password'}
                          </button>
                        </div>
                      )}
                      
                      {activeSettingTab === 'Notifications' && (
                        <div className="space-y-4">
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{language === 'ja' ? 'アクティビティに関する通知の方法を選択します。' : 'Choose how you want to be notified about activity.'}</p>
                          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-slate-900 dark:text-white font-medium">{language === 'ja' ? 'プッシュ通知' : 'Push Notifications'}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{language === 'ja' ? 'デバイスでアラートを受信します。' : 'Receive alerts on your device.'}</p>
                              </div>
                              <div 
                                onClick={() => toggleSetting('pushNotifications')}
                                className={`w-11 h-6 rounded-full cursor-pointer relative transition-colors ${settingsState.pushNotifications ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${settingsState.pushNotifications ? 'right-1 bg-white' : 'left-1 bg-slate-500 dark:bg-slate-400'}`}></div>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-slate-900 dark:text-white font-medium">{language === 'ja' ? 'メール通知' : 'Email Notifications'}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{language === 'ja' ? '毎日のサマリーを受信します。' : 'Receive daily summaries.'}</p>
                              </div>
                              <div 
                                onClick={() => toggleSetting('emailNotifications')}
                                className={`w-11 h-6 rounded-full cursor-pointer relative transition-colors ${settingsState.emailNotifications ? 'bg-emerald-500' : 'bg-slate-700'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${settingsState.emailNotifications ? 'right-1 bg-white' : 'left-1 bg-slate-400'}`}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeSettingTab === 'Language' && (
                        <div className="space-y-4">
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{language === 'ja' ? 'システムインターフェースの希望する言語を選択してください。' : 'Select your preferred language for the system interface.'}</p>
                          <div className="space-y-2">
                            <button 
                              onClick={() => setLanguage('en')}
                              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-colors ${language === 'en' ? 'bg-white dark:bg-slate-800 border-2 border-emerald-500 shadow-sm' : 'bg-white/60 dark:bg-slate-800/40 border-2 border-slate-200 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800/80'}`}
                            >
                              <span className={`${language === 'en' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-700 dark:text-slate-300'} font-medium`}>English</span>
                              <div className={`w-5 h-5 rounded-full transition-all ${language === 'en' ? 'border-4 border-emerald-500 bg-white dark:bg-slate-900' : 'border-2 border-slate-300 dark:border-slate-600'}`}></div>
                            </button>
                            <button 
                              onClick={() => setLanguage('ja')}
                              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-colors ${language === 'ja' ? 'bg-white dark:bg-slate-800 border-2 border-emerald-500 shadow-sm' : 'bg-white/60 dark:bg-slate-800/40 border-2 border-slate-200 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800/80'}`}
                            >
                              <span className={`${language === 'ja' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-700 dark:text-slate-300'} font-medium`}>日本語 (Japanese)</span>
                              <div className={`w-5 h-5 rounded-full transition-all ${language === 'ja' ? 'border-4 border-emerald-500 bg-white dark:bg-slate-900' : 'border-2 border-slate-300 dark:border-slate-600'}`}></div>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Main Profile Header Card */}
        <div className="mb-5 p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-3.5 relative transition-all">
          
          {/* Top Bar: Menu Button on Left, Edit Profile Button / Actions on Right */}
          <div className="flex items-center justify-between w-full">
            <div>
              {isOwnProfile && (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl shadow-sm group"
                  title={language === 'ja' ? 'メニュー / 設定' : 'Menu / Settings'}
                >
                  <Menu className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                </button>
              )}
              {!isOwnProfile && location.state?.fromOfferSearch && (
                <button
                  onClick={() => navigate('/list?type=offer', { state: { openOfferSearch: true, search: location.state.search, searchIndustries: location.state.searchIndustries, selectedIds: location.state.selectedIds } })}
                  className="flex items-center gap-1 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="font-bold text-xs sm:text-sm">{language === 'ja' ? '戻る' : 'Back'}</span>
                </button>
              )}
              {!isOwnProfile && location.state?.fromScout && (
                <button
                  onClick={() => {
                    navigate(-1);
                    setTimeout(() => window.dispatchEvent(new CustomEvent('open-scout-chat')), 100);
                  }}
                  className="flex items-center gap-1 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="font-bold text-xs sm:text-sm">{language === 'ja' ? 'AIスカウトに戻る' : 'Back to AI Scout'}</span>
                </button>
              )}
            </div>

            <div>
              {isOwnProfile ? (
                <button
                  onClick={openEditProfile}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Settings className="w-4 h-4" />
                  <span>{language === 'ja' ? 'プロフィールを編集' : 'Edit Profile'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {(currentUser?.account_type === 'organization' || currentUser?.account_type === 'corporate' || currentUser?.account_type === 'municipality') && (
                    <button 
                      onClick={() => {
                        if (currentUser.org_plan === 'basic' || !currentUser.org_plan) {
                          setShowPlanUpgrade(true);
                        } else {
                          setShowScoutMessageModal(true);
                        }
                      }}
                      className={`px-3.5 py-1.5 ${
                        currentUser?.account_type === 'municipality'
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      } text-white text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{currentUser?.account_type === 'municipality' ? (language === 'ja' ? '官民連携スカウト' : 'Gov Scout') : (language === 'ja' ? 'スカウト' : 'Scout')}</span>
                    </button>
                  )}
                  {currentUser && (
                    <button
                      onClick={handleSubscribe}
                      disabled={isSubscribed}
                      className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                        isSubscribed 
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-default' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                      }`}
                    >
                      {isSubscribed ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      <span>{isSubscribed ? (language === 'ja' ? 'フォロー中' : 'Following') : (profileUser?.isFollowingMe ? (language === 'ja' ? 'フォローバック' : 'Follow Back') : (language === 'ja' ? 'フォロー' : 'Follow'))}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* User Identity Row: [Avatar] on left, Name & Current Plan on right */}
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className={`relative group ${isOwnProfile ? 'cursor-pointer' : ''} shrink-0`} onClick={handleAvatarClick}>
              <div className="relative inline-block">
                <img 
                  src={displayUser.avatar || undefined} 
                  alt={displayUser.username} 
                  className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-slate-100 dark:bg-slate-800 ${getAccountTypeBorderClass(displayUser.account_type, 'border-[3px]')} shadow-md object-cover transition-opacity ${isUploading ? 'opacity-50' : isOwnProfile ? 'group-hover:opacity-80' : ''}`} 
                />
                {(displayUser.show_activity_status === 1 || displayUser.show_activity_status === true || displayUser.show_activity_status === undefined) && (
                  <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full z-10" title="Online"></div>
                )}
              </div>
              {isOwnProfile && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white drop-shadow-lg" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                    <Settings className="w-3 h-3 text-white" />
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </>
              )}
            </div>

            {/* Name & Plan Info Area */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white break-words break-all whitespace-normal leading-snug flex items-start sm:items-center gap-1.5">
                  {(displayUser.verification_status === 'verified' || !displayUser.verification_status || displayUser.verification_status === 'approved') && (
                    <span title={language === 'ja' ? '認証済み' : 'Verified'} className="inline-flex items-center shrink-0 mt-0.5 sm:mt-0">
                      <CheckCircle2 className="w-5 h-5 text-blue-500 fill-blue-500/10 shrink-0" />
                    </span>
                  )}
                  <span className="break-words break-all">{displayUser.municipality_name || displayUser.company_name || displayUser.username}</span>
                </h1>
              </div>

              {/* Compact "現在のプラン" Badge directly under Name */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <div 
                  onClick={() => isOwnProfile && setIsPlanModalOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-lg text-xs font-semibold ${isOwnProfile ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700' : ''}`}
                >
                  <span className="text-slate-400 font-medium">
                    {language === 'ja' ? '現在のプラン:' : 'Current Plan:'}
                  </span>
                  <span className={`font-black flex items-center gap-1 ${
                    displayUser.account_type === 'municipality' ? 'text-purple-600 dark:text-purple-400' :
                    (displayUser.account_type === 'organization' || displayUser.account_type === 'corporate') ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0 stroke-[1.75]" />
                    <span>{(() => {
                      const userObj = isOwnProfile ? (currentUser || displayUser) : displayUser;
                      const isGov = userObj.account_type === 'municipality';
                      const isCorp = userObj.account_type === 'organization' || userObj.account_type === 'corporate';
                      const rawPlan = (isCorp || isGov) ? (userObj.org_plan || userObj.plan || 'light') : (userObj.plan || 'free');
                      const planValue = rawPlan.toLowerCase();

                      if (isGov) {
                        switch (planValue) {
                          case 'enterprise': return language === 'ja' ? '自治体 Enterprise' : 'Gov Enterprise';
                          case 'standard': return language === 'ja' ? '自治体 Standard' : 'Gov Standard';
                          case 'light':
                          case 'basic':
                          default: return language === 'ja' ? '自治体 Basic' : 'Gov Basic';
                        }
                      } else if (isCorp) {
                        switch (planValue) {
                          case 'enterprise': return language === 'ja' ? '法人 Enterprise' : 'Corp Enterprise';
                          case 'standard': return language === 'ja' ? '法人 Standard' : 'Corp Standard';
                          case 'light':
                          case 'basic':
                          default: return language === 'ja' ? '法人 Light' : 'Corp Light';
                        }
                      } else {
                        switch (planValue) {
                          case 'pro': return language === 'ja' ? '個人 Pro' : 'Personal Pro';
                          case 'free':
                          default: return language === 'ja' ? '個人 Free' : 'Personal Free';
                        }
                      }
                    })()}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Banner Region: Consolidates profile input fields */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-2 text-xs sm:text-sm">
            {/* Meta attributes (Location, Industry, Dept, Website) */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs font-medium">
              {displayUser.account_type === 'municipality' ? (
                <>
                  {(displayUser.prefecture || displayUser.region) && (
                    <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/30 text-purple-800 dark:text-purple-300 rounded-md flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>{displayUser.prefecture || displayUser.region}</span>
                    </span>
                  )}
                  {displayUser.municipality_type && (
                    <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-800 dark:text-indigo-300 rounded-md flex items-center gap-1">
                      <Landmark className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>{displayUser.municipality_type}</span>
                    </span>
                  )}
                  {displayUser.department_name && (
                    <span className="px-2 py-0.5 bg-slate-200/70 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
                      <span>担当: {displayUser.department_name}</span>
                    </span>
                  )}
                </>
              ) : (displayUser.account_type === 'corporate' || displayUser.account_type === 'organization') ? (
                <>
                  {displayUser.industry && (
                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-md flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>業種: {displayUser.industry}</span>
                    </span>
                  )}
                  {(displayUser.company_location || displayUser.region || displayUser.country) && (
                    <span className="px-2 py-0.5 bg-slate-200/70 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
                      <span>所在地: {displayUser.company_location || displayUser.region || displayUser.country}</span>
                    </span>
                  )}
                  {displayUser.department_name && (
                    <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-800 dark:text-indigo-300 rounded-md flex items-center gap-1">
                      <Users className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>担当: {displayUser.department_name}</span>
                    </span>
                  )}
                </>
              ) : (
                displayUser.region && (
                  <span className="px-2 py-0.5 bg-slate-200/70 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span>活動地域: {displayUser.region}</span>
                  </span>
                )
              )}

              {displayUser.website_url && (
                <a 
                  href={displayUser.website_url.startsWith('http') ? displayUser.website_url : `https://${displayUser.website_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-md flex items-center gap-1 transition-colors"
                >
                  <Globe className="w-3 h-3" />
                  <span>公式Webサイト</span>
                  <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                </a>
              )}
            </div>

            {/* Vision / Bio Main Text */}
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1 ${
                displayUser.account_type === 'municipality' ? 'text-purple-600 dark:text-purple-400' :
                (displayUser.account_type === 'corporate' || displayUser.account_type === 'organization') ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
              }`}>
                {displayUser.account_type === 'municipality' ? (
                  <>
                    <Landmark className="w-3 h-3 shrink-0" />
                    <span>自治体Vision・重点課題宣言</span>
                  </>
                ) : (displayUser.account_type === 'corporate' || displayUser.account_type === 'organization') ? (
                  <>
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span>企業Vision・重点テーマ</span>
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3 shrink-0" />
                    <span>個人Vision・プロフィール紹介</span>
                  </>
                )}
              </div>

              {(() => {
                const text = displayUser.title || displayUser.bio || (
                  displayUser.account_type === 'municipality' ? (language === 'ja' ? '官民共創による地域課題解決・DX推進・持続可能なまちづくりに取り組んでいます。' : 'Promoting public-private co-creation and regional development.') :
                  (displayUser.account_type === 'corporate' || displayUser.account_type === 'organization') ? (language === 'ja' ? '事業開発・新規事業創出・オープンイノベーションを推進しています。' : 'Driving business development and open innovation.') :
                  (language === 'ja' ? 'プロフィールを追加 (Visionや自己紹介を入力)' : 'Add Profile (Vision or Bio)')
                );
                const isLong = text.length > 120;

                return (
                  <div>
                    <p className={`leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap ${!isBannerExpanded && isLong ? 'line-clamp-3' : ''}`}>
                      {text}
                    </p>
                    {isLong && (
                      <button
                        onClick={() => setIsBannerExpanded(!isBannerExpanded)}
                        className="mt-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        {isBannerExpanded 
                          ? (language === 'ja' ? '閉じる ▲' : 'Show Less ▲') 
                          : (language === 'ja' ? 'もっと見る ▼' : 'Show More ▼')}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Hashtags inside Banner */}
            {displayUser.tags && displayUser.tags !== '[]' && (
              <div className="pt-0.5">
                <HashtagDisplay tags={displayUser.tags} />
              </div>
            )}
          </div>

          {/* Follow Stats & 5-Star Rating Row (Same Row) */}
          <div className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-semibold flex-wrap">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setListType('subscriptions'); setIsMenuOpen(true); }}
                className="flex items-center gap-1 hover:text-blue-600 transition-colors"
              >
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">{stats?.followingCount || 0}</span>
                <span className="text-slate-500 text-xs">{language === 'ja' ? 'フォロー中' : 'Following'}</span>
              </button>
              <div className="h-3.5 w-[1px] bg-slate-300 dark:bg-slate-700"></div>
              <button
                onClick={() => { setListType('subscribers'); setIsMenuOpen(true); }}
                className="flex items-center gap-1 hover:text-blue-600 transition-colors"
              >
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">{stats?.subscriberCount || 0}</span>
                <span className="text-slate-500 text-xs">{language === 'ja' ? 'フォロワー' : 'Followers'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const rating = stats?.avg_rating || 0;
                  const rounded = Math.round(rating * 2) / 2;
                  if (rounded >= star) {
                    return <Star key={star} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />;
                  } else if (rounded >= star - 0.5) {
                    return (
                      <div key={star} className="relative w-3.5 h-3.5">
                        <Star className="absolute inset-0 w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                        <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        </div>
                      </div>
                    );
                  } else {
                    return <Star key={star} className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />;
                  }
                })}
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                {(stats?.avg_rating || 5.0).toFixed(1)} ({stats?.review_count || stats?.rating_count || 0})
              </span>
            </div>
          </div>
        </div>

        {profileUser?.private_profile === 1 && !isOwnProfile && !isSubscribed ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-t border-slate-800 mt-6">
            <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center mb-3">
              <Lock className="w-7 h-7 text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{language === 'ja' ? 'このアカウントは非公開です' : 'This account is private'}</h3>
            <p className="text-slate-400 text-xs max-w-sm">
              {language === 'ja' ? '写真や動画を見るには、フォローしてください。' : 'Follow to see their posts.'}
            </p>
          </div>
        ) : (
          <>
            {/* Tabs for Vision, Idea, JOINT, Municipality, or Corporate Tabs */}
            {displayUser.account_type === 'municipality' ? (
              <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto scrollbar-hide">
                {[
                  { id: 'muni_projects', label: '公開Project', icon: FolderKanban, count: stats?.projectCount },
                  { id: 'muni_visions', label: 'Vision', icon: Sparkles, count: stats?.projectCount },
                  { id: 'muni_recruitment', label: 'Idea募集', icon: Lightbulb, count: stats?.ideaCount },
                  { id: 'muni_achievements', label: 'Project実績', icon: Trophy, count: stats?.jointCount }
                ].map((tab) => {
                  const isActive = activeTab === tab.id || (activeTab === 'ema' && tab.id === 'muni_projects');
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 min-w-[110px] flex justify-between items-center py-3 px-3 md:px-4 transition-all border-b-2 -mb-[1px] ${
                        isActive
                          ? 'border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-300 font-bold'
                          : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-slate-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-bold tracking-wider whitespace-nowrap flex items-center gap-1.5">
                        <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[1.75]" />
                        <span>{tab.label}</span>
                      </span>
                      <span className="text-xs sm:text-sm font-bold ml-1.5">
                        {tab.count || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (displayUser.account_type === 'corporate' || displayUser.account_type === 'organization') ? (
              <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto scrollbar-hide">
                {[
                  { id: 'corp_projects', label: '公開Project', icon: Building2, count: stats?.projectCount },
                  { id: 'corp_visions', label: 'Vision', icon: Sparkles, count: stats?.projectCount },
                  { id: 'corp_proposals', label: 'Idea募集', icon: Lightbulb, count: stats?.ideaCount },
                  { id: 'corp_achievements', label: 'Project実績', icon: Trophy, count: stats?.jointCount }
                ].map((tab) => {
                  const isActive = activeTab === tab.id || (activeTab === 'ema' && tab.id === 'corp_projects');
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 min-w-[110px] flex justify-between items-center py-3 px-3 md:px-4 transition-all border-b-2 -mb-[1px] ${
                        isActive
                          ? 'border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-300 font-bold'
                          : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-slate-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-bold tracking-wider whitespace-nowrap flex items-center gap-1.5">
                        <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[1.75]" />
                        <span>{tab.label}</span>
                      </span>
                      <span className="text-xs sm:text-sm font-bold ml-1.5">
                        {tab.count || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto scrollbar-hide">
                {[
                  { id: 'ema', label: 'Vision', icon: Sparkles, count: stats?.projectCount },
                  { id: 'idea', label: 'Idea', icon: Lightbulb, count: stats?.ideaCount },
                  { id: 'joint', label: 'Joint', icon: Trophy, count: stats?.jointCount }
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'ema' | 'idea' | 'joint')}
                      className={`flex-1 min-w-[90px] flex justify-between items-center py-3 px-3 md:px-5 transition-all border-b-2 -mb-[1px] ${
                        isActive
                          ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 font-bold'
                          : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-slate-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-bold tracking-wider whitespace-nowrap flex items-center gap-1.5">
                        <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[1.75]" />
                        <span>{tab.label}</span>
                      </span>
                      <span className="text-xs sm:text-sm font-bold ml-1.5">
                        {tab.count || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab Items List */}
            <div className="space-y-6">
              {isLoadingTab ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-500 text-sm">Loading {activeTab}s...</p>
                </div>
              ) : tabItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {tabItems.map((item) => {
                    const targetUrl = item.type === 'project' && (item.status === 'completed' || Number(item.is_buyout) === 1) ? `/completed/${item.id}` : `/${item.type}/${item.id}`;
                    return (
                      <Link 
                        key={`${item.type}-${item.id}`}
                        to={targetUrl}
                        className="block bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-cyan-500/20 hover:border-blue-400 dark:hover:border-cyan-500/50 rounded-2xl overflow-hidden group shadow-md dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all hover:scale-[1.01] flex flex-col"
                      >
                        <div className="relative aspect-[16/10] bg-slate-100 dark:bg-slate-900 overflow-hidden">
                          <img 
                            src={item.image || undefined} 
                            alt={item.title} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 dark:from-[#0b0f19] via-black/20 to-transparent opacity-80"></div>
                          
                          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 backdrop-blur-md border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-md">
                              {item.type === 'project' ? 'Vision' : 'Idea'}
                            </span>
                            {item.status === 'completed' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold flex items-center gap-1 shadow-md">
                                <CheckCircle className="w-3 h-3" /> RELEASED
                              </span>
                            )}
                            {Number(item.is_recruitment) === 1 && (
                              <span className="px-2 py-0.5 rounded-full bg-red-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold shadow-md">
                                {Number(item.is_private) === 1 ? 'Offer' : 'Recruitment'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between gap-2">
                          <div>
                            <h3 className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm md:text-base leading-snug line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-cyan-300 transition-colors mb-1">
                              {item.title}
                            </h3>

                            {(item.completed_tags || item.tags) && (
                              <div className="mb-1">
                                <HashtagDisplay tags={item.completed_tags || item.tags || ''} />
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <img src={displayUser.avatar || item.author_avatar || undefined} alt="" className={`w-5 h-5 rounded-full object-cover ${getAccountTypeBorderClass(displayUser.account_type || item.author_account_type || item.account_type, 'border-2')}`} />
                              <span className="font-semibold truncate max-w-[80px] sm:max-w-[100px] text-[11px]">{displayUser.username || item.author_name}</span>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] sm:text-[11px]">
                              <span className="flex items-center gap-0.5 hover:text-pink-500 transition-colors" title="Likes">
                                <Heart className="w-3.5 h-3.5 text-pink-500" />
                                <span className="font-medium">{item.likes_count || 0}</span>
                              </span>
                              <span className="flex items-center gap-0.5 hover:text-blue-500 dark:hover:text-cyan-400 transition-colors" title="Comments">
                                <MessageSquare className="w-3.5 h-3.5 text-blue-500 dark:text-cyan-400" />
                                <span className="font-medium">{item.comments_count || 0}</span>
                              </span>
                              <span className="flex items-center gap-0.5 hover:text-emerald-500 transition-colors" title="Views">
                                <Bookmark className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                                <span className="font-medium">{item.archives_count || 0}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
          ) : (
            <div className="text-center py-20 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <SquarePlus className="w-12 h-12 text-slate-400 dark:text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 text-sm">
                まだ投稿されていません
              </p>
            </div>
          )}
        </div>
        </>
        )}

        {/* Plan Upgrade Modal */}
        {(isPlanModalOpen || showPlanUpgrade) && (
          <PlanUpgradeModal
            onClose={() => {
              setIsPlanModalOpen(false);
              setShowPlanUpgrade(false);
            }}
          />
        )}

      </div>
    </div>
  );
}
