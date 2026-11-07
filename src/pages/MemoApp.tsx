import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { safeFetchJson } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, FolderOpen, MoreVertical, Trash2, Save, FileText, CheckCircle, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface Memo {
  id: number;
  user_id: number;
  project_id: number | null;
  folder_id: number | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface CustomFolder {
  id: number;
  name: string;
}

export default function MemoApp() {
  const { user, language } = useAppContext();
  const navigate = useNavigate();
  const [visions, setEmas] = useState<any[]>([]);
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<{ type: 'ema' | 'custom', id: number } | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Mobile layout state
  const [mobileView, setMobileView] = useState<'folders' | 'notes' | 'editor'>('folders');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Desktop collapse state
  const [isFoldersCollapsed, setIsFoldersCollapsed] = useState(false);
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    // Fetch Visions and Custom Folders
    Promise.all([
      safeFetchJson(`/api/users/${user.id}/projects`, undefined, []),
      safeFetchJson(`/api/memo_folders?user_id=${encodeURIComponent(user.id)}`, undefined, [])
    ])
      .then(([emasData, foldersData]) => {
        const visions = Array.isArray(emasData) ? emasData : [];
        const folders = Array.isArray(foldersData) ? foldersData : [];
        setEmas(visions);
        setCustomFolders(folders);
        if (!isMobile) {
          if (visions.length > 0) setSelectedFolder({ type: 'ema', id: visions[0].id });
          else if (folders.length > 0) setSelectedFolder({ type: 'custom', id: folders[0].id });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [user, navigate, isMobile]);

  useEffect(() => {
    if (selectedFolder) {
      fetchMemos(selectedFolder);
      if (isMobile && mobileView === 'folders') {
        setMobileView('notes');
      }
    }
  }, [selectedFolder]);

  const fetchMemos = (folder: { type: 'ema' | 'custom', id: number }) => {
    const query = folder.type === 'ema' ? `project_id=${folder.id}` : `folder_id=${folder.id}`;
    fetch(`/api/memos?${query}`)
      .then(res => res.json())
      .then(data => {
        setMemos(data);
        if (!isMobile) {
          setSelectedMemo(null);
        }
      })
      .catch(console.error);
  };

  const createMemo = async () => {
    if (!selectedFolder || !user) return;
    try {
      const body = selectedFolder.type === 'ema' 
        ? { user_id: user.id, project_id: selectedFolder.id, title: 'New Note', content: '' }
        : { user_id: user.id, folder_id: selectedFolder.id, title: 'New Note', content: '' };
        
      const res = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        fetchMemos(selectedFolder);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const createFolder = () => {
    setIsCreatingFolder(true);
    setNewFolderName('');
  };

  const submitCreateFolder = async () => {
    if (!user || !newFolderName.trim()) {
      setIsCreatingFolder(false);
      return;
    }
    try {
      const res = await fetch('/api/memo_folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, name: newFolderName.trim() })
      });
      if (res.ok) {
        const { id } = await res.json();
        setCustomFolders([{ id, name: newFolderName.trim() }, ...customFolders]);
        setSelectedFolder({ type: 'custom', id });
      }
    } catch (err) {
      console.error(err);
    }
    setIsCreatingFolder(false);
    setNewFolderName('');
  };

  const deleteFolder = async (e: React.MouseEvent, folderId: number) => {
    e.stopPropagation();
    if (!confirm(language === 'ja' ? 'フォルダーを削除しますか？' : 'Delete this folder?')) return;
    try {
      await fetch(`/api/memo_folders/${folderId}`, { method: 'DELETE' });
      setCustomFolders(customFolders.filter(f => f.id !== folderId));
      if (selectedFolder?.type === 'custom' && selectedFolder.id === folderId) {
        setSelectedFolder(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateMemo = async (memo: Memo) => {
    try {
      await fetch(`/api/memos/${memo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: memo.title, content: memo.content })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteMemo = async (e: React.MouseEvent, memoId: number) => {
    e.stopPropagation();
    if (!confirm(language === 'ja' ? '削除しますか？' : 'Delete this memo?')) return;
    try {
      await fetch(`/api/memos/${memoId}`, { method: 'DELETE' });
      if (selectedMemo?.id === memoId) {
        setSelectedMemo(null);
        if (isMobile) setMobileView('notes');
      }
      fetchMemos(selectedFolder!);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMemoSelect = (memo: Memo) => {
    setSelectedMemo(memo);
    if (isMobile) {
      setMobileView('editor');
    }
  };

  const handleBack = () => {
    if (mobileView === 'editor') {
      if (selectedMemo) updateMemo(selectedMemo);
      setMobileView('notes');
    } else if (mobileView === 'notes') {
      setMobileView('folders');
      setSelectedFolder(null);
    }
  };

  const handleContentChange = (content: string) => {
    if (!selectedMemo) return;
    setSelectedMemo({ ...selectedMemo, content });
  };
  
  const handleTitleChange = (title: string) => {
    if (!selectedMemo) return;
    setSelectedMemo({ ...selectedMemo, title });
  };

  const handleBlur = () => {
    if (selectedMemo) {
      updateMemo(selectedMemo);
      setMemos(memos.map(m => m.id === selectedMemo.id ? selectedMemo : m));
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  return (
    <div className="absolute inset-0 flex bg-slate-100 dark:bg-black">
      {/* Folders Pane */}
      {!isFoldersCollapsed && (
        <div className={`w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 ${isMobile && mobileView !== 'folders' ? 'hidden' : 'flex'}`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{language === 'ja' ? 'フォルダー' : 'Folders'}</h2>
            <div className="flex items-center gap-1">
              <button onClick={createFolder} className="p-1.5 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors">
                <Plus className="w-5 h-5" />
              </button>
              {!isMobile && (
                <button onClick={() => setIsFoldersCollapsed(true)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  <PanelLeftClose className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {(customFolders.length > 0 || isCreatingFolder) && (
              <div className="mb-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-2">Memo</h3>
                {isCreatingFolder && (
                  <div className="px-2 mb-2">
                    <input
                      type="text"
                      autoFocus
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') submitCreateFolder();
                        if (e.key === 'Escape') setIsCreatingFolder(false);
                      }}
                      onBlur={() => {
                        if (newFolderName.trim()) submitCreateFolder();
                        else setIsCreatingFolder(false);
                      }}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                      placeholder={language === 'ja' ? 'フォルダー名...' : 'Folder name...'}
                    />
                  </div>
                )}
                {customFolders.map(folder => (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolder({ type: 'custom', id: folder.id })}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer group ${selectedFolder?.type === 'custom' && selectedFolder.id === folder.id ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <FolderOpen className="w-5 h-5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-sm">{folder.name}</p>
                    </div>
                    <button onClick={(e) => deleteFolder(e, folder.id)} className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-2">Vision</h3>
              {visions.map(ema => (
                <button
                  key={ema.id}
                  onClick={() => setSelectedFolder({ type: 'ema', id: ema.id })}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${selectedFolder?.type === 'ema' && selectedFolder.id === ema.id ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <FolderOpen className="w-5 h-5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-sm">{ema.title || 'Untitled Vision'}</p>
                  </div>
                </button>
              ))}
              {visions.length === 0 && customFolders.length === 0 && !isCreatingFolder && (
                <p className="text-sm text-slate-500 p-4 text-center">No folders found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes Pane */}
      {!isNotesCollapsed && (
        <div className={`w-full md:w-72 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 ${isMobile && mobileView !== 'notes' ? 'hidden' : 'flex'}`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMobile && (
                <button onClick={handleBack} className="p-1 -ml-2 text-emerald-600 dark:text-emerald-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md">
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {isFoldersCollapsed && !isMobile && (
                <button onClick={() => setIsFoldersCollapsed(false)} className="p-1.5 -ml-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  <PanelLeftOpen className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{language === 'ja' ? 'メモ' : 'Notes'}</h2>
            </div>
            <div className="flex items-center gap-1">
              {selectedFolder && (
                <button onClick={createMemo} className="p-1.5 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              )}
              {!isMobile && (
                <button onClick={() => setIsNotesCollapsed(true)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  <PanelLeftClose className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!selectedFolder ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Select a folder
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {memos.map(memo => (
                  <div
                    key={memo.id}
                    onClick={() => handleMemoSelect(memo)}
                    className={`w-full p-4 rounded-xl cursor-pointer transition-colors group ${selectedMemo?.id === memo.id ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/30' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'} border`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold truncate text-sm mb-1 ${selectedMemo?.id === memo.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{memo.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{memo.content || 'No additional text'}</p>
                      </div>
                      <button 
                        onClick={(e) => deleteMemo(e, memo.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {memos.length === 0 && (
                  <p className="text-sm text-slate-500 p-4 text-center">No notes in this folder.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor Pane */}
      <div className={`flex-1 bg-white dark:bg-black flex flex-col ${isMobile && mobileView !== 'editor' ? 'hidden' : 'flex'}`}>
        {selectedMemo ? (
          <>
            <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 justify-between bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-2">
                {isMobile && (
                  <button onClick={handleBack} className="p-1 -ml-2 text-emerald-600 dark:text-emerald-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md flex items-center text-sm font-medium">
                    <ChevronLeft className="w-5 h-5" />
                    {language === 'ja' ? '戻る' : 'Back'}
                  </button>
                )}
                {isNotesCollapsed && !isMobile && (
                  <button onClick={() => setIsNotesCollapsed(false)} className="p-1.5 -ml-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <PanelLeftOpen className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                 <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                   <CheckCircle className="w-3 h-3 text-emerald-500" />
                   Saved
                 </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-4xl mx-auto w-full">
              <input
                type="text"
                value={selectedMemo.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={handleBlur}
                placeholder="Title"
                className="w-full bg-transparent text-2xl md:text-4xl font-bold text-slate-900 dark:text-white outline-none mb-6 placeholder-slate-400 dark:placeholder-slate-600"
              />
              <textarea
                value={selectedMemo.content}
                onChange={(e) => handleContentChange(e.target.value)}
                onBlur={handleBlur}
                placeholder="Start writing..."
                className="w-full h-[500px] bg-transparent text-base md:text-lg text-slate-800 dark:text-slate-300 outline-none resize-none placeholder-slate-400 dark:placeholder-slate-700 leading-relaxed"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 flex-col gap-4 relative">
             <div className="absolute top-4 left-4 flex gap-2">
               {isFoldersCollapsed && !isMobile && (
                  <button onClick={() => setIsFoldersCollapsed(false)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <PanelLeftOpen className="w-5 h-5" />
                  </button>
                )}
               {isNotesCollapsed && !isMobile && (
                  <button onClick={() => setIsNotesCollapsed(false)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <Menu className="w-5 h-5" />
                  </button>
                )}
             </div>
            <FileText className="w-16 h-16 text-slate-300 dark:text-slate-800" />
            <p>{language === 'ja' ? 'メモを選択してください' : 'Select a note'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
