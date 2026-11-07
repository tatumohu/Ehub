import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { safeFetchJson } from '../lib/api';
import { ChevronLeft, Image as ImageIcon, Sparkles, X, Plus, Minus, FileUp, Link as LinkIcon, Mic, Menu, Save, Bookmark, Lock, Unlock, Landmark, Bus, Home, Heart, Compass, Factory, Building2, Lightbulb, Paperclip, Music } from 'lucide-react';
import ReactQuill, { Quill } from 'react-quill-new';

import PrivacyModal from '../components/PrivacyModal';
import HashtagInput from '../components/HashtagInput';
import GenerateImageModal from '../components/GenerateImageModal';
import PlanUpgradeModal from '../components/PlanUpgradeModal';
import SimpleStageIndicator from '../components/SimpleStageIndicator';
import localforage from 'localforage';

// Register custom blots
const BlockEmbed = Quill.import('blots/block/embed') as any;
const Embed = Quill.import('blots/embed') as any;
class Hr extends BlockEmbed {
  static blotName = 'hr';
  static tagName = 'hr';
}

class QuoteEmbed extends Embed {
  static blotName = 'quoteEmbed';
  static tagName = 'a';
  static className = 'quoted-item-link';

  static create(value: any) {
    let node = super.create() as HTMLElement;
    
    // Check if value is a data object and not a DOM node 
    if (value && typeof value === 'object' && !(value instanceof Element) && !(value instanceof DocumentFragment)) {
      node.setAttribute('data-id', value.id || '');
      node.setAttribute('data-type', value.type || '');
      node.setAttribute('data-image', value.image || '');
      node.setAttribute('data-title', value.title || '');
      node.setAttribute('data-author', value.author_name || '');
      node.setAttribute('contenteditable', 'false');
      node.setAttribute('href', `/${value.type === 'project' ? 'project' : 'idea'}/${value.id}`);
      
      const typeText = value.type === 'project' ? 'Vision' : 'Idea';
      node.innerText = `${typeText}　${value.title || ''}　${value.author_name || ''}`;
      
      node.style.color = '#3b82f6';
      node.style.textDecoration = 'underline';
      node.style.cursor = 'pointer';
    }
    return node;
  }

  static value(node: HTMLElement) {
    return {
      id: node.getAttribute('data-id'),
      type: node.getAttribute('data-type'),
      image: node.getAttribute('data-image'),
      title: node.getAttribute('data-title'),
      author_name: node.getAttribute('data-author')
    };
  }
}

Quill.debug(false);
Quill.register('formats/hr', Hr);
Quill.register(QuoteEmbed);

const MODULES = {
  toolbar: {
    container: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'blockquote', 'code-block'],
      ['pagebreak'],
      ['clean']
    ],
    handlers: {
      pagebreak: function(this: any) {
        const range = this.quill.getSelection();
        if (range) {
          this.quill.insertEmbed(range.index, 'hr', 'page-break');
          this.quill.insertText(range.index + 1, '\n');
          this.quill.setSelection(range.index + 2);
        }
      }
    }
  }
};

const FORMATS = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list',
  'link', 'blockquote', 'code-block',
  'image', 'hr', 'quoteEmbed'
];

export default function CreateIdea() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const quoteId = searchParams.get('quoteId') || searchParams.get('quoted_item_id');
  const quoteType = searchParams.get('quoteType') || searchParams.get('quoted_item_type') || 'idea';
  const fromTree = searchParams.get('from_tree') === '1';
  const editMode = searchParams.get('editMode') === 'true';
  const typeParam = searchParams.get('type');
  const isOffer = typeParam === 'offer';
  const isRecruitment = typeParam === 'recruitment' || isOffer;
  const initialPermittedUsers = searchParams.get('permitted_users') 
    ? searchParams.get('permitted_users')!.split(',').map(Number).filter(n => !isNaN(n))
    : [];

  const [proposedType, setProposedType] = useState<'revision' | 'branch'>('revision');
  const [quotedItem, setQuotedItem] = useState<any>(null);
  const { user, logout, language } = useAppContext();
  const isOrg = user?.account_type === 'organization' || user?.account_type === 'corporate' || user?.account_type === 'municipality';
  const isMunicipality = user?.account_type === 'municipality';
  const isCorporate = user?.account_type === 'organization' || user?.account_type === 'corporate';
  const currentPlan = isOrg ? (user?.org_plan || 'light') : (user?.plan || 'free');
  const normalizedPlan = currentPlan === 'basic' ? (isOrg ? 'light' : 'free') : currentPlan;
  const isFreePlan = !isOrg && (normalizedPlan === 'free' || !user?.plan || user?.plan === 'free');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('#');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [showGenerateImageModal, setShowGenerateImageModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [stage, setStage] = useState(1);
  const [isPrivate, setIsPrivate] = useState(isOffer ? true : false);
  const [permittedUsers, setPermittedUsers] = useState<number[]>(isOffer ? initialPermittedUsers : []);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            setImage(canvas.toDataURL('image/jpeg', 0.85));
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
    if (coverInputRef.current) {
      coverInputRef.current.value = '';
    }
  };
  
  // Vision type and Drafts state
  const [postType, setPostType] = useState<'ideas' | 'projects'>('ideas');
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<any[]>([]);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [pendingSubmitAfterAuth, setPendingSubmitAfterAuth] = useState(false);

  useEffect(() => {
    if (user && pendingSubmitAfterAuth) {
      setPendingSubmitAfterAuth(false);
      setShowSignInPrompt(false);
      handleSubmit();
    }
  }, [user, pendingSubmitAfterAuth]);

  useEffect(() => {
    if (quoteId && quoteType) {
      setPostType('ideas'); // Quoting creates an Idea
      safeFetchJson(`/api/${quoteType}s/${quoteId}${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`, undefined, null)
        .then(data => {
          if (!data) return;
          setQuotedItem(data);
          if (editMode && data) {
            setTitle(data.title || '');
            setDescription(data.description || '');
            setImage(data.image || '');
            if (data.tags) {
              try {
                const parsedTags = JSON.parse(data.tags);
                setTags(Array.isArray(parsedTags) && parsedTags.length > 0 ? '#' + parsedTags.join(' #') : '#');
              } catch(e) {
                setTags(data.tags);
              }
            }
          }
          if (data && (data.is_private === 1 || Number(data.is_recruitment) === 1)) {
            setIsPrivate(true);
            const initialPerms = [data.author_id];
            if (user?.id && !initialPerms.includes(user.id)) initialPerms.push(user.id);
            setPermittedUsers(initialPerms);
          }
        })
        .catch(err => console.error('Failed to fetch quoted item:', err));
    } else {
      setPostType('projects'); // New post from + creates an Vision (Project)
      setQuotedItem(null);
    }
  }, [quoteId, quoteType]);

  useEffect(() => {
    localforage.getItem<any[]>('ehub_drafts').then((savedDrafts) => {
      if (savedDrafts && Array.isArray(savedDrafts)) {
        setDrafts(savedDrafts);
      } else {
        // Fallback to migrate from localStorage
        const oldDrafts = localStorage.getItem('ehub_drafts');
        if (oldDrafts && oldDrafts !== 'undefined') {
          try {
            const parsed = JSON.parse(oldDrafts);
            setDrafts(parsed);
            localforage.setItem('ehub_drafts', parsed);
            localStorage.removeItem('ehub_drafts'); // Clean up old storage
          } catch (e) {
            console.error(e);
          }
        }
      }
    }).catch(e => console.error(e));
  }, []);

  useEffect(() => {
    const sq = localStorage.getItem('savedQuotes');
    if (sq && sq !== 'undefined') {
      try {
        setSavedQuotes(JSON.parse(sq));
      } catch (e) {
        console.error(e);
      }
    }
  }, [showQuoteModal]);

  const handleSaveDraft = () => {
    const isDescriptionEmpty = !description || description === '<p><br></p>' || description === '<p></p>' || description.trim() === '';
    if (!title && isDescriptionEmpty && !image) return;
    
    const newDrafts = [...drafts];
    const draftIndex = currentDraftId ? newDrafts.findIndex(d => d.id === currentDraftId) : -1;
    
    const draftData = {
      id: currentDraftId || Date.now().toString(),
      type: postType,
      title,
      tags,
      description,
      image,
      quoteId,
      quoteType,
      updatedAt: new Date().toISOString()
    };

    if (draftIndex >= 0) {
      newDrafts[draftIndex] = draftData;
    } else {
      newDrafts.push(draftData);
      setCurrentDraftId(draftData.id);
    }
    
    setDrafts(newDrafts);
    localforage.setItem('ehub_drafts', newDrafts).then(() => {
      alert('Draft saved!');
    }).catch(e => {
      console.error(e);
      alert('Failed to save draft details.');
    });
  };

  const loadDraft = (draft: any) => {
    setTitle(draft.title || '');
    setTags(draft.tags || '');
    setDescription(draft.description || '');
    setImage(draft.image || '');
    if (draft.type) setPostType(draft.type);
    setCurrentDraftId(draft.id);
    
    // Update URL params to trigger quote fetch
    const newParams: any = {};
    if (draft.quoteId) newParams.quoteId = draft.quoteId;
    if (draft.quoteType) newParams.quoteType = draft.quoteType;
    setSearchParams(newParams, { replace: true });
    
    setShowDrafts(false);
  };

  const handleNewDraft = () => {
    setTitle('');
    setTags('#');
    setDescription('');
    setImage('');
    setCurrentDraftId(null);
    setQuotedItem(null);
    setSearchParams({}, { replace: true });
    setShowDrafts(false);
  };

  // Plus button state
  const quillRef = useRef<ReactQuill>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPlusButton, setShowPlusButton] = useState(false);
  const [plusButtonTop, setPlusButtonTop] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [currentSelectionIndex, setCurrentSelectionIndex] = useState<number | null>(null);

  // Auto-resize title textarea
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
    }
  }, [title]);

  const handleSelectionChange = (range: any) => {
    if (range && range.length === 0) {
      const quill = quillRef.current?.getEditor();
      if (quill) {
        const [line] = quill.getLine(range.index);
        if (line && line.length() === 1) { // 1 means only newline character
          const bounds = quill.getBounds(range.index);
          const toolbar = document.querySelector('.ql-toolbar');
          const toolbarHeight = toolbar ? toolbar.getBoundingClientRect().height : 0;
          const toolbarMargin = 20; // margin-bottom from CSS
          setPlusButtonTop(bounds.top + toolbarHeight + toolbarMargin);
          setShowPlusButton(true);
          setCurrentSelectionIndex(range.index);
        } else {
          setShowPlusButton(false);
          setShowMenu(false);
        }
      }
    } else if (!range) {
      // Do not hide if we are just clicking the menu
    } else {
      setShowPlusButton(false);
      setShowMenu(false);
    }
  };

  const handleInsertImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*";
      fileInputRef.current.click();
    }
  };

  const handleInsertFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "*/*";
      fileInputRef.current.click();
    }
  };

  const handleInsertLink = () => {
    const url = prompt('Enter URL:');
    const text = prompt('Enter link text:');
    if (url && text && currentSelectionIndex !== null) {
      const quill = quillRef.current?.getEditor();
      if (quill) {
        quill.insertText(currentSelectionIndex, text, 'link', url);
        quill.setSelection(currentSelectionIndex + text.length);
      }
    }
    setShowMenu(false);
    setShowPlusButton(false);
  };

  const handleInsertAudio = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "audio/*";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentSelectionIndex !== null) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const quill = quillRef.current?.getEditor();
        if (quill) {
          if (file.type.startsWith('image/')) {
            const img = new window.Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800;
              const MAX_HEIGHT = 800;
              let width = img.width;
              let height = img.height;
              
              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                quill.insertEmbed(currentSelectionIndex, 'image', resizedDataUrl);
                quill.insertText(currentSelectionIndex + 1, '\n');
                quill.setSelection(currentSelectionIndex + 2);
              }
            };
            img.src = result;
          } else if (file.type.startsWith('audio/')) {
            // For audio, we insert a link to the base64 data (in a real app, upload to server first)
            const text = `[音声] ${file.name}`;
            quill.insertText(currentSelectionIndex, text, 'link', result);
            quill.insertText(currentSelectionIndex + text.length, '\n');
            quill.setSelection(currentSelectionIndex + text.length + 1);
          } else {
            // For other files, insert a link
            const text = `[添付] ${file.name}`;
            quill.insertText(currentSelectionIndex, text, 'link', result);
            quill.insertText(currentSelectionIndex + text.length, '\n');
            quill.setSelection(currentSelectionIndex + text.length + 1);
          }
        }
      };
      reader.readAsDataURL(file);
    }
    setShowMenu(false);
    setShowPlusButton(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInsertDivider = () => {
    if (currentSelectionIndex !== null) {
      const quill = quillRef.current?.getEditor();
      if (quill) {
        quill.insertEmbed(currentSelectionIndex, 'hr', 'page-break');
        quill.insertText(currentSelectionIndex + 1, '\n');
        quill.setSelection(currentSelectionIndex + 2);
      }
    }
    setShowMenu(false);
    setShowPlusButton(false);
  };

  const generateAIImage = () => {
    if (!isOrg && (normalizedPlan === 'free' || !user?.plan || user?.plan === 'free')) {
      setShowUpgradeModal(true);
    } else {
      setShowGenerateImageModal(true);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      setPendingSubmitAfterAuth(true);
      setShowSignInPrompt(true);
      return;
    }
    
    if (!title.trim()) return alert(language === 'ja' ? 'タイトルを入力してください' : 'Please fill in the title.');

    // Use a default image if none is provided
    const finalImage = image || 'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=800&h=1200&fit=crop&q=80';

    const isRecruitmentQuoted = quotedItem && Number(quotedItem.is_recruitment) === 1;
    const finalIsPrivate = isPrivate || (isRecruitmentQuoted && !!quoteId) || isOffer ? 1 : 0;
    const finalPermitted = [...permittedUsers];
    if (quotedItem?.author_id && !finalPermitted.includes(quotedItem.author_id)) {
      finalPermitted.push(quotedItem.author_id);
    }
    if (user?.id && !finalPermitted.includes(user.id)) {
      finalPermitted.push(user.id);
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/${postType}${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          tags: tags.trim() === '#' ? '' : tags,
          description,
          image: finalImage,
          author_id: user.id,
          quoted_item_id: quoteId ? parseInt(quoteId) : null,
          quoted_item_type: quoteType,
          stage,
          is_private: finalIsPrivate,
          permitted_users: JSON.stringify(finalPermitted),
          is_recruitment: isRecruitment ? 1 : 0,
          is_edit_proposal: (editMode || fromTree) ? 1 : 0,
          proposed_type: proposedType
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // Remove draft if it was published
        if (currentDraftId) {
          const newDrafts = drafts.filter(d => d.id !== currentDraftId);
          setDrafts(newDrafts);
          localforage.setItem('ehub_drafts', newDrafts).catch(e => {
            console.error('Failed to update drafts:', e);
          });
        }

        if (editMode || fromTree) {
          const targetType = data.rootProjectId ? 'project' : quoteType;
          const targetId = data.rootProjectId || quoteId;
          alert(editMode 
            ? '編集提案を提出しました。プロジェクトチャットで承認をお待ちください。' 
            : '新規Ideaの提案を提出しました。プロジェクトチャットで承認をお待ちください。');
          navigate(`/chat/${targetType}/${targetId}`);
        } else if (postType === 'projects') {
          navigate(`/project/${data.id}`);
        } else {
          navigate(`/idea/${data.id}`);
        }
      } else {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to post:', errData);
        
        if (errData.error === 'User not found') {
          alert('Session expired or user not found. Please login again.');
          logout();
          navigate('/');
        } else {
          alert(`Failed to publish: ${errData.error || 'Please try again.'}`);
        }
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] text-slate-900 dark:text-white pb-32 transition-colors">
      {showGenerateImageModal && (
        <GenerateImageModal
          onClose={() => setShowGenerateImageModal(false)}
          onApply={(imgData) => {
            setImage(imgData);
            setShowGenerateImageModal(false);
          }}
          initialPrompt={title ? `A cinematic, high-quality, artistic cover image for a project titled "${title}". \n      The project is about: ${description.replace(/<[^>]*>/g, ' ').substring(0, 500)}. \n      Style: Modern, professional, clean, and visually striking. Landscape orientation.` : ''}
        />
      )}
      {showUpgradeModal && (
        <PlanUpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setShowDrafts(true)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Link to="/" className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <button
              onClick={() => {
                if ((quotedItem && quotedItem.is_private === 1) || isOffer) return;
                setIsPrivacyModalOpen(true);
              }}
              className={`ml-2 transition-colors p-1 ${(quotedItem && quotedItem.is_private === 1) || isOffer ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              title="Visibility Settings"
            >
              {isPrivate ? <Lock className={`w-5 h-5 ${(quotedItem && quotedItem.is_private === 1) || isOffer ? 'text-blue-500/50' : 'text-blue-500 dark:text-blue-400'}`} /> : <Unlock className="w-5 h-5" />}
            </button>
          </div>
        </div>
        
        {/* Dynamic Badge (Vision for Projects, Idea for Ideas) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div 
            className={`w-24 h-7 md:w-32 md:h-9 ${postType === 'projects' ? 'bg-blue-600 border-blue-400/30' : 'bg-slate-600 dark:bg-slate-700 border-slate-400/30 dark:border-slate-500/30'} border shadow-md flex items-center justify-center transition-transform hover:scale-110`}
            style={postType === 'projects' ? {
              clipPath: 'polygon(0% 30%, 50% 0%, 100% 30%, 100% 100%, 0% 100%)',
              WebkitClipPath: 'polygon(0% 30%, 50% 0%, 100% 30%, 100% 100%, 0% 100%)'
            } : {
              borderRadius: '4px'
            }}
          >
            <span className="text-white font-black text-xl md:text-2xl tracking-[0.2em] pl-[0.2em] pt-1">
              {postType === 'projects' ? 'Vision' : 'Idea'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleNewDraft}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors hidden sm:block"
          >
            New Draft
          </button>
          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
            title="Save Draft"
          >
            <Save className="w-5 h-5" />
            <span className="hidden sm:inline">Save</span>
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-full font-bold transition-all disabled:opacity-50 disabled:grayscale shadow-sm"
          >
            {language === 'ja' 
              ? (loading 
                  ? (editMode ? '編集提案中...' : fromTree ? '新規提案中...' : '公開中...') 
                  : (editMode ? '編集提案を送信' : fromTree ? '新規Idea提案を送信' : '公開する')) 
              : (loading 
                  ? (editMode ? 'Submitting...' : fromTree ? 'Submitting Proposal...' : 'Publishing...') 
                  : (editMode ? 'Submit Edit Proposal' : fromTree ? 'Submit New Proposal' : 'Publish'))}
          </button>
        </div>
      </div>

      {/* Drafts Sidebar */}
      {showDrafts && (
          <div 
            className="fixed inset-0 z-[60]"
          >
            <div 
              onClick={() => setShowDrafts(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <div
              className="fixed top-0 left-0 bottom-0 w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-[70] flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">下書き (Drafts)</h2>
                <button onClick={() => setShowDrafts(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <button 
                  onClick={handleNewDraft}
                  className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-xl font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Draft
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">アイデア (Ideas)</h3>
                  <div className="space-y-2">
                    {drafts.filter(d => d.type === 'ideas').length === 0 && (
                      <p className="text-slate-400 dark:text-slate-500 text-sm italic">No idea drafts</p>
                    )}
                    {drafts.filter(d => d.type === 'ideas').map(draft => (
                      <div 
                        key={draft.id}
                        onClick={() => loadDraft(draft)}
                        className={`p-3 rounded-xl cursor-pointer transition-colors ${currentDraftId === draft.id ? 'bg-blue-50 dark:bg-blue-500/20 border border-blue-400 dark:border-blue-500/50' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-transparent'}`}
                      >
                        <h4 className="text-slate-900 dark:text-white font-medium text-sm truncate">{draft.title || 'Untitled'}</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                          {new Date(draft.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">プロジェクト (Projects)</h3>
                  <div className="space-y-2">
                    {drafts.filter(d => d.type === 'projects').length === 0 && (
                      <p className="text-slate-400 dark:text-slate-500 text-sm italic">No project drafts</p>
                    )}
                    {drafts.filter(d => d.type === 'projects').map(draft => (
                      <div 
                        key={draft.id}
                        onClick={() => loadDraft(draft)}
                        className={`p-3 rounded-xl cursor-pointer transition-colors ${currentDraftId === draft.id ? 'bg-blue-50 dark:bg-blue-500/20 border border-blue-400 dark:border-blue-500/50' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-transparent'}`}
                      >
                        <h4 className="text-slate-900 dark:text-white font-medium text-sm truncate">{draft.title || 'Untitled'}</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                          {new Date(draft.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      <div
        className="max-w-3xl mx-auto px-4 sm:px-6 pt-12"
      >
        {/* Quoted Item Display */}
        {quotedItem && (
          <div className="mb-8 p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex gap-4 items-center">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
              <img src={quotedItem.image || undefined} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1 block">
                {quoteType === 'project' ? 'Vision' : 'Idea'}
              </span>
              <h4 className="text-slate-900 dark:text-white font-bold truncate">{quotedItem.title}</h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs">by {quotedItem.author_name}</p>
            </div>
            <button 
              onClick={() => {
                setQuotedItem(null);
                setSearchParams({}, { replace: true });
                setPostType('projects');
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Cover Image Section */}
        <input 
          type="file" 
          accept="image/*" 
          ref={coverInputRef} 
          onChange={handleCoverChange} 
          className="hidden" 
        />
        <div className="mb-10 relative group">
          {image ? (
            <div className="relative aspect-[16/9] md:aspect-[2/1] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm">
              <img src={image || undefined} alt="Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <button 
                  onClick={generateAIImage}
                  disabled={generatingImage}
                  className={isFreePlan
                    ? "bg-slate-900/60 hover:bg-slate-900/80 text-slate-300 border border-white/20 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 backdrop-blur-sm transition-all opacity-70"
                    : "bg-slate-900/80 hover:bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 backdrop-blur-sm transition-all"}
                >
                  {generatingImage ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Regenerate AI Image
                </button>
                <button 
                  onClick={() => setImage('')}
                  className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {generatingImage && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-slate-900 dark:text-white">
                  <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3" />
                  <p className="text-sm font-bold tracking-widest uppercase">Generating Cover...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[16/9] md:aspect-[3/1] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-400 dark:hover:border-slate-700 transition-all cursor-pointer bg-white/60 dark:bg-transparent">
              {generatingImage ? (
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">AI is generating your cover...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <ImageIcon className="w-10 h-10 opacity-40 text-slate-500 dark:text-slate-400" />
                  <div className="flex gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        coverInputRef.current?.click();
                      }}
                      className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm"
                    >
                      Add Image
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        generateAIImage();
                      }}
                      className={isFreePlan 
                        ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors opacity-70" 
                        : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"}
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate with AI
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Journey Stage Selection */}
        <div className="mb-6 p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'ja' ? 'Journey Stage（進行状況段階）' : 'Journey Stage'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'ja' ? '投稿画面でのみ設定可能です。現在の段階を選択してください。' : 'Select stage (1-6) before posting.'}
            </p>
          </div>
          <SimpleStageIndicator 
            currentStage={stage} 
            interactive={true} 
            onSelect={(st) => setStage(st)} 
          />
        </div>

        {/* Municipality Project Guidance & Example Presets */}
        {isMunicipality && postType === 'projects' && (
          <div className="mb-6 p-4 md:p-5 bg-gradient-to-r from-purple-900/20 via-slate-900/40 to-indigo-900/20 border border-purple-500/40 rounded-2xl shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2.5 font-bold text-sm text-purple-700 dark:text-purple-300 mb-1">
              <Landmark className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>自治体 Project 投稿（地域課題の公開・共創募集）</span>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
              自治体から地域課題や解決テーマ（例: 地域交通・空き家・子育て・観光・産業等）をProjectとして提示し、個人や法人から実証実験や解決ソリューションのIdea提案を広く募集できます。
            </p>

            {/* E-hub Flow Guide */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-[11px] font-semibold text-purple-900 dark:text-purple-200 border-b border-purple-500/20 mb-3">
              <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-800 dark:text-purple-200 shrink-0">自治体</span>
              <span>➔</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-400/40 text-blue-800 dark:text-blue-200 shrink-0">Project投稿</span>
              <span>➔</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-800 dark:text-emerald-200 shrink-0">個人・法人がIdea提案</span>
              <span>➔</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-800 dark:text-amber-200 shrink-0">Ideaを検討</span>
              <span>➔</span>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/40 text-indigo-800 dark:text-indigo-200 shrink-0">必要に応じてProject化</span>
            </div>

            {/* Example Chips */}
            <div>
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>自治体 Project テーマ例（タップでタイトル・基本構成を自動挿入）:</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    title: '地域交通を改善したい',
                    icon: Bus,
                    template: '<p><strong>【地域の課題と背景】</strong><br>高齢化や公共交通機関の減便に伴い、地域住民の移動手段確保が重大な課題となっています。</p><p><strong>【募集するIdea・提案】</strong><br>オンデマンド交通、AI相乗りタクシー、ボランティア輸送、MaaSアプリ連携などの具体的なアイデアを広く募集します！</p><p><strong>【期待する効果・今後の展開】</strong><br>ご提案いただいたIdeaを検討し、市と連携した実証実験やプロジェクト化を進めます。</p>'
                  },
                  {
                    title: '空き家問題を解決したい',
                    icon: Home,
                    template: '<p><strong>【地域の課題と背景】</strong><br>地域内の空き家率上昇に伴い、防災・防犯・景観上の懸念が増大しています。</p><p><strong>【募集するIdea・提案】</strong><br>空き家のリノベーション活用、お試し移住体験拠点、コミスタ・シェアオフィス化などの提案を広く募集します！</p><p><strong>【期待する効果・今後の展開】</strong><br>実現可能性の高い提案について、官民連携プロジェクトとしての導入を検討します。</p>'
                  },
                  {
                    title: '子育て支援を改善したい',
                    icon: Heart,
                    template: '<p><strong>【地域の課題と背景】</strong><br>共働き世帯の増加や孤立子育ての防止、子育て環境のさらなる充実が求められています。</p><p><strong>【募集するIdea・提案】</strong><br>病児保育シェア、子育てコミュニティアプリ、公共施設のキッズスペース活用などのアイデアを広く募集します！</p><p><strong>【期待する効果・今後の展開】</strong><br>提案されたアイデアを検討し、行政サービスや民間共創事業としての導入を検討します。</p>'
                  },
                  {
                    title: '観光を活性化したい',
                    icon: Compass,
                    template: '<p><strong>【地域の課題と背景】</strong><br>地域の自然・歴史資源を活かした観光集客と周遊消費の拡大が期待されています。</p><p><strong>【募集するIdea・提案】</strong><br>体験型アクティビティ開発、インバウンド対応、デジタルスタンプラリー、特産品コラボ等の提案を広く募集します！</p><p><strong>【期待する効果・今後の展開】</strong><br>魅力的な提案について、観光協会や地元事業者と連携した実証実験を進めます。</p>'
                  },
                  {
                    title: '地域産業を育成したい',
                    icon: Factory,
                    template: '<p><strong>【地域の課題と背景】</strong><br>地元中小企業のDX支援、新産業・スタートアップの創出、若手人材の定着が課題となっています。</p><p><strong>【募集するIdea・提案】</strong><br>アグリテック・フードテック、オープンイノベーションプログラム、地元特産品のブランド化などのアイデアを広く募集します！</p><p><strong>【期待する効果・今後の展開】</strong><br>アイデアをもとに、産業振興や実証実験プロジェクトとしての展開を目指します。</p>'
                  }
                ].map((item) => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => {
                        setTitle(item.title);
                        setTags('#自治体Project #地域課題 #官民共創');
                        if (!description || description.trim() === '' || description === '<p><br></p>') {
                          setDescription(item.template);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-purple-900 dark:text-purple-200 text-xs font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <IconComp className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Title Input */}
        <div className="mb-4 space-y-6 border-b border-slate-200 dark:border-slate-800 pb-4">
          
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              isMunicipality
                ? (language === 'ja' ? '例：地域交通を改善したい' : 'e.g. Improve Regional Transportation')
                : (language === 'ja' ? 'タイトルを入力してください' : 'Slide Title')
            }
            className="w-full bg-transparent text-4xl md:text-5xl font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 resize-none outline-none leading-tight"
            rows={1}
          />
          <HashtagInput value={tags} onChange={setTags} />

          {/* Role-specific Quick Tags */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1">
              {isMunicipality ? (
                <>
                  <Landmark className="w-3 h-3 shrink-0" />
                  <span>自治体タグ:</span>
                </>
              ) : isCorporate ? (
                <>
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span>法人タグ:</span>
                </>
              ) : (
                <>
                  <Lightbulb className="w-3 h-3 shrink-0" />
                  <span>おすすめタグ:</span>
                </>
              )}
            </span>
            {(isMunicipality
              ? ['#官民共創', '#地域課題', '#実証実験', '#地域政策', '#市民提案募集', '#企業提案募集', '#地方創生', '#行政DX']
              : isCorporate
              ? ['#法人Project', '#Idea募集', '#実証実験連携', '#共同開発', '#業務委託', '#新規事業']
              : ['#Vision', '#Idea提案', '#プロトタイプ', '#個人開発', '#オープンイノベーション']
            ).map((qTag) => (
              <button
                key={qTag}
                type="button"
                onClick={() => {
                  const current = (tags || '').trim();
                  if (current.includes(qTag)) return;
                  if (current === '#' || !current) {
                    setTags(qTag);
                  } else {
                    setTags(`${current} ${qTag}`);
                  }
                }}
                className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                  isMunicipality
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20'
                    : isCorporate
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20'
                    : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20'
                }`}
              >
                + {qTag}
              </button>
            ))}
          </div>
        </div>

        {/* Editor Section */}
        <div className="relative">
          {showPlusButton && (
            <div 
              className="absolute -left-12 z-10 flex items-center transition-all duration-200"
              style={{ top: `${plusButtonTop}px` }}
            >
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowMenu(!showMenu)}
                className={`w-8 h-8 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500 transition-all ${showMenu ? 'rotate-45 bg-slate-100 dark:bg-slate-800' : 'bg-white dark:bg-slate-900 shadow-sm'}`}
              >
                <Plus className="w-5 h-5" />
              </button>
              
              {showMenu && (
                  <div
                    className="absolute left-10 flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 shadow-xl"
                  >
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleInsertImage}
                      className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Add Image"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleInsertFile}
                      className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Add File"
                    >
                      <FileUp className="w-4 h-4" />
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleInsertAudio}
                      className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Add Audio"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleInsertLink}
                      className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Add Link"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleInsertDivider}
                      className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Add Page Break"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowQuoteModal(true);
                      }}
                      className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Insert Quote"
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>
                  </div>
                )}
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          <div className="quill-editor-container note-style-editor">
            {React.createElement(ReactQuill as any, {
              ref: quillRef,
              theme: "snow",
              value: description,
              onChange: setDescription,
              onChangeSelection: handleSelectionChange,
              modules: MODULES,
              formats: FORMATS,
              placeholder: "Write your story here..."
            })}
          </div>
        </div>
      </div>

      {showQuoteModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
            onClick={() => setShowQuoteModal(false)}
          />
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden relative z-[120]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-slate-900 dark:text-white font-bold text-lg">Saved Quotes</h3>
              <button onClick={() => setShowQuoteModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {savedQuotes.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                  <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No saved quotes yet.</p>
                </div>
              ) : (
                savedQuotes.map(quote => (
                  <div 
                    key={`${quote.type}-${quote.id}`}
                    className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 cursor-pointer transition-all shadow-sm"
                    onClick={() => {
                      const quill = quillRef.current?.getEditor();
                      if (quill) {
                        quill.focus();
                        setTimeout(() => {
                          const range = quill.getSelection();
                          const index = range ? range.index : 0;
                          quill.insertEmbed(index, 'quoteEmbed', {
                            id: quote.id,
                            type: quote.type,
                            title: quote.title,
                            image: quote.image,
                            author_name: quote.author_name
                          });
                          quill.insertText(index + 1, '\n');
                          quill.setSelection(index + 2);
                          setShowQuoteModal(false);
                          setShowMenu(false);
                        }, 10);
                      }
                    }}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-800">
                      <img src={quote.image || undefined} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{quote.type === 'project' ? 'Vision' : 'Idea'}</span>
                      <h4 className="text-slate-900 dark:text-white font-bold text-sm truncate">{quote.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">by {quote.author_name}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
      <PrivacyModal 
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        selectedUsers={permittedUsers}
        onConfirm={(users) => {
          setPermittedUsers(users);
          setIsPrivate(users.length > 0);
          setIsPrivacyModalOpen(false);
        }}
      />

      {/* Requirement 11: サインイン制御モーダル */}
      {showSignInPrompt && (
        <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 shadow-2xl max-w-md w-full text-center space-y-5 relative text-slate-900 dark:text-white">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-300 dark:border-amber-400/40 flex items-center justify-center mx-auto shadow-sm">
              <Lock className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                この内容を投稿するにはサインインが必要です。
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                入力した文章・添付ファイル・AIが整理した内容・修正した内容は保持されます。サインイン後、そのまま自動的に投稿処理が行われます。
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              {/* ［サインインして投稿］ */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
                }}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>サインインして投稿</span>
              </button>

              {/* ［アカウントを作成］ */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'register' } }));
                }}
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-cyan-300 border border-slate-300 dark:border-cyan-500/40 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>アカウントを作成</span>
              </button>

              {/* ［戻る］ */}
              <button
                onClick={() => setShowSignInPrompt(false)}
                className="w-full py-2.5 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl text-xs font-medium transition-colors"
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Upgrade Modal for AI image generation gating */}
      {showUpgradeModal && (
        <PlanUpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          noticeMessage="AI画像生成はProプラン限定の機能です。Proプランにアップグレードしてご利用ください。"
        />
      )}
    </div>
  );
}
