import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getAccountTypeBorderClass } from '../utils/avatar';
import { ChevronLeft } from 'lucide-react';
import ReactQuill, { Quill } from 'react-quill-new';

import PrivacyModal from '../components/PrivacyModal';
import HashtagInput from '../components/HashtagInput';
import SimpleStageIndicator from '../components/SimpleStageIndicator';
import { Link as LinkIcon, Mic, FileUp, Sparkles, X, Plus, Minus, Menu, Bookmark, PenLine, Lock, Unlock, Image as ImageIcon } from 'lucide-react';

// Register custom blots
const BlockEmbed = Quill.import('blots/block/embed') as any;

class HrBlot extends BlockEmbed {
  static create(value: any) {
    let node = super.create(value);
    node.setAttribute('class', value);
    return node;
  }
}
HrBlot.blotName = 'hr';
HrBlot.tagName = 'hr';
Quill.debug(false);
Quill.register(HrBlot);

const MODULES = {
  toolbar: {
    container: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'blockquote', 'code-block'],
      ['clean']
    ]
  }
};

const FORMATS = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list',
  'link', 'blockquote', 'code-block'
];

export default function CompileIdea() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, language } = useAppContext();
  
  const [selectedIdeas, setSelectedIdeas] = useState<any[]>([]);
  const [activeTabId, setActiveTabId] = useState<'compile' | number>('compile');
  
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('#');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(1);
  const [isPrivate, setIsPrivate] = useState(false);
  const [permittedUsers, setPermittedUsers] = useState<number[]>([]);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Plus button state
  const quillRef = useRef<ReactQuill>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPlusButton, setShowPlusButton] = useState(false);
  const [plusButtonTop, setPlusButtonTop] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [currentSelectionIndex, setCurrentSelectionIndex] = useState<number | null>(null);

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
            quill.insertEmbed(currentSelectionIndex, 'image', result);
            quill.insertText(currentSelectionIndex + 1, '\n');
            quill.setSelection(currentSelectionIndex + 2);
          } else if (file.type.startsWith('audio/')) {
            const text = `[音声] ${file.name}`;
            quill.insertText(currentSelectionIndex, text, 'link', result);
            quill.insertText(currentSelectionIndex + text.length, '\n');
            quill.setSelection(currentSelectionIndex + text.length + 1);
          } else {
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

  useEffect(() => {
    if (location.state?.selectedIdeas) {
      const ideas = location.state.selectedIdeas;
      setSelectedIdeas(ideas);
      if (location.state?.aiSummary) {
        setDescription(location.state.aiSummary);
        setTitle("Compiled Ideas");
      }
    } else {
      // Fallback: If accessed directly, maybe fetch ideas or redirect back
      navigate(`/project/${projectId}`);
    }
  }, [location.state, navigate, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      alert('Please provide a title');
      return;
    }
    if (!description || description === '<p><br></p>') {
      alert('Please provide a description');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/ideas${user ? `?user_id=${encodeURIComponent(user.id)}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          tags: tags.trim() === '#' ? '' : tags,
          description,
          image: '', // We could add image uploading, but keeping it simpler for compile summary
          author_id: user?.id,
          quoted_item_id: projectId,
          quoted_item_type: 'project',
          stage,
          is_private: isPrivate,
          permitted_users: JSON.stringify(permittedUsers)
        })
      });

      if (res.ok) {
        const data = await res.json();
        navigate(`/idea/${data.id}`);
      } else {
        alert('Failed to post');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to post');
    } finally {
      setLoading(false);
    }
  };

  // We don't use activeIdeaId anymore
  // const activeIdea = selectedIdeas.find(i => i.id === activeIdeaId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-4">
          <Link to={`/project/${projectId}`} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Compile Masterpiece</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPrivacyModalOpen(true)}
            className={`p-2 rounded-full transition-colors ${isPrivate ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
            title="Visibility Settings"
          >
            {isPrivate ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading || !title}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-full font-bold transition-all shadow-md shadow-blue-500/20"
          >
            {loading ? 'Posting...' : 'Post Compile'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 flex-shrink-0 bg-slate-100/70 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700/50 flex flex-col overflow-y-auto custom-scrollbar shadow-sm z-20">
          <div className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Sections</div>
          
          {/* Compile Tab */}
          <button
            onClick={() => setActiveTabId('compile')}
            className={`w-full p-4 border-l-4 flex flex-col items-start transition-all ${
              activeTabId === 'compile'
                ? 'border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <PenLine className={`w-4 h-4 ${activeTabId === 'compile' ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
              <span className="font-bold text-sm">Compiled Summary</span>
            </div>
            <span className="text-xs opacity-70 mt-1.5 text-left leading-tight">Write and edit your summary</span>
          </button>

          <div className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-4 mb-1">Referenced Ideas</div>

          {/* Idea Tabs */}
          {selectedIdeas.map(idea => (
            <button
              key={idea.id}
              onClick={() => setActiveTabId(idea.id)}
              className={`w-full p-4 border-l-4 flex flex-col items-start transition-all ${
                activeTabId === idea.id 
                  ? 'border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 w-full">
                <Sparkles className={`w-3.5 h-3.5 shrink-0 ${activeTabId === idea.id ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="font-bold text-sm truncate">{idea.title}</span>
              </div>
              <span className="text-[10px] opacity-70 mt-1 w-full text-left truncate">by {idea.author_name}</span>
            </button>
          ))}
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 custom-scrollbar relative z-10 w-full transition-colors">
          {activeTabId === 'compile' ? (
            <div className="p-6 lg:p-10">
              <div className="max-w-4xl mx-auto space-y-6">
                
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  
                </div>

                {/* Journey Stage Selection */}
                <div className="mb-4 p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

                <input
                  type="text"
                  placeholder="Compiled Idea Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-transparent text-3xl md:text-4xl font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 border-none outline-none focus:ring-0 px-0"
                />
                <HashtagInput value={tags} onChange={setTags} />
                
                <div className="relative pl-10 -ml-10">
                  {showPlusButton && (
                    <div 
                      className="absolute left-0 z-10 flex items-center transition-all duration-200"
                      style={{ top: `${plusButtonTop}px` }}
                    >
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowMenu(!showMenu)}
                        className={`w-8 h-8 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500 transition-all ${showMenu ? 'rotate-45 bg-white dark:bg-slate-800 shadow-sm' : 'bg-white/80 dark:bg-transparent'}`}
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
                  <div className="quill-editor-container note-style-editor compile-editor mt-4">
                    {React.createElement(ReactQuill as any, {
                      ref: quillRef,
                      theme: "snow",
                      value: description,
                      onChange: setDescription,
                      onChangeSelection: handleSelectionChange,
                      modules: MODULES,
                      formats: FORMATS,
                      placeholder: "Write your compilation/summary here..."
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 lg:p-10">
              {(() => {
                const activeIdea = selectedIdeas.find(i => i.id === activeTabId);
                if (!activeIdea) return (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    Select an Idea to view
                  </div>
                );
                return (
                  <div className="max-w-prose mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                      <img src={activeIdea.author_avatar || undefined} alt="" className={`w-8 h-8 rounded-full object-cover ${getAccountTypeBorderClass(activeIdea.author_account_type || activeIdea.account_type, 'border-2')}`} />
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{activeIdea.author_name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(activeIdea.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {activeIdea.image && (
                      <img src={activeIdea.image || undefined} alt="" className="w-full h-auto rounded-xl mb-6 object-cover aspect-video shadow-sm" referrerPolicy="no-referrer" />
                    )}
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">{activeIdea.title}</h2>
                    <div 
                      className="text-slate-800 dark:text-slate-300 leading-relaxed ql-editor !p-0 prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: (activeIdea.description || '').replace(/<img /g, '<img referrerpolicy="no-referrer" ') }}
                    />
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .compile-editor .ql-toolbar.ql-snow {
          background-color: #f8fafc !important;
          border-radius: 0.5rem 0.5rem 0 0 !important;
          border: 1px solid #cbd5e1 !important;
          padding: 12px 16px !important;
          margin-bottom: 0 !important;
        }
        .dark .compile-editor .ql-toolbar.ql-snow {
          background-color: #1e293b !important;
          border: 1px solid #334155 !important;
        }
        .compile-editor .ql-container.ql-snow {
          border: 1px solid #cbd5e1 !important;
          border-top: none !important;
          border-radius: 0 0 0.5rem 0.5rem !important;
          background-color: #ffffff !important;
          min-height: 300px;
        }
        .dark .compile-editor .ql-container.ql-snow {
          border: 1px solid #334155 !important;
          border-top: none !important;
          background-color: #0f172a !important;
        }
      `}</style>
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
    </div>
  );
}
