import React, { useState } from 'react';
import { Routes, Route, useLocation, Link, useNavigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ListView from './pages/ListView';
import IdeaDetail from './pages/IdeaDetail';
import ProjectDetail from './pages/ProjectDetail';
import ProjectChat from './pages/ProjectChat';
import CreateIdea from './pages/CreateIdea';
import Search from './pages/Search';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';
import ChatList from './pages/ChatList';
import CompletedProjects from './pages/CompletedProjects';
import PostToCompleted from './pages/PostToCompleted';
import CompletedDetail from './pages/CompletedDetail';
import PurchaseHistory from './pages/PurchaseHistory';
import Cart from './pages/Cart';
import NetworkView from './pages/NetworkView';
import CompileIdea from './pages/CompileIdea';
import MemoApp from './pages/MemoApp';
import ContractApp from './pages/ContractApp';
import AccountTypeModal from './components/AccountTypeModal';
import { Plus } from 'lucide-react';

// Force rebuild to clear cached React 19 state
export default function App() {
  console.log('React version:', React.version);
  return (
    <AppProvider>
      <AccountTypeModal />
      <AppContent />
    </AppProvider>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, user } = useAppContext();
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F8FAFC] dark:bg-[#020617] text-slate-900 dark:text-white font-sans overflow-hidden">
      <Navbar />
      
      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        <main className="pb-20">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateIdea />} />
            <Route path="/search" element={<Search />} />
            <Route path="/chat" element={<ChatList />} />
            <Route path="/completed" element={<CompletedProjects />} />
            <Route path="/completed/post/:projectId" element={<PostToCompleted />} />
            <Route path="/completed/:id" element={<CompletedDetail />} />
            <Route path="/purchases" element={<PurchaseHistory />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/list" element={<ListView />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/idea/:id" element={<IdeaDetail />} />
            <Route path="/project/:id" element={<ProjectDetail />} />
            <Route path="/compile/:projectId" element={<CompileIdea />} />
            <Route path="/memos" element={<MemoApp />} />
            <Route path="/contracts" element={<ContractApp />} />
            <Route path="/chat/:type/:id" element={<ProjectChat />} />
            <Route path="/network/:id" element={<NetworkView />} />
          </Routes>
        </main>


      </div>

      <BottomNav />

      {/* Select Post Type Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 dark:bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-cyan-500/30 rounded-3xl p-6 shadow-xl dark:shadow-[0_0_50px_rgba(6,182,212,0.15)] max-w-sm w-full relative">
            <h3 className="text-slate-900 dark:text-white text-xl font-bold mb-6 text-center tracking-wide flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-cyan-400"></span>
              {language === 'ja' ? '投稿タイプを選択' : 'Select Post Type'}
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => { setShowCreateModal(false); navigate('/create'); }}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/20 transition-all border border-cyan-400/30"
              >
                Vision
              </button>
              <button
                onClick={() => { setShowCreateModal(false); navigate('/create?type=recruitment'); }}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all border border-emerald-400/30"
              >
                {language === 'ja' ? 'Project' : 'Project'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl font-medium transition-colors mt-2"
              >
                {language === 'ja' ? 'キャンセル' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
