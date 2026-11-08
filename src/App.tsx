import DraftSidebar from './components/drafts/DraftSidebar';
import PostDetailRoute from './pages/PostDetailRoute';
import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Navbar from './components/Navbar';
import VisionFeed from './pages/VisionFeed';
import ProjectHub from './pages/ProjectHub';
import StoreHub from './pages/StoreHub';
import ListView from './pages/ListView';
import IdeaDetail from './pages/IdeaDetail';
import ProjectDetail from './pages/ProjectDetail';
import ProjectChat from './pages/ProjectChat';
import CreateIdea from './pages/CreateIdea';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';
import ChatList from './pages/ChatList';
import PostToCompleted from './pages/PostToCompleted';
import CompletedDetail from './pages/CompletedDetail';
import PurchaseHistory from './pages/PurchaseHistory';
import Cart from './pages/Cart';
import NetworkView from './pages/NetworkView';
import CompileIdea from './pages/CompileIdea';
import AccountTypeModal from './components/AccountTypeModal';

export default function App() {
  return (
    <AppProvider>
      <AccountTypeModal />
      <AppContent />
    </AppProvider>
  );
}

function AppContent() {
  return (
    <div className="fixed inset-0 flex flex-col bg-[#F8FAFC] dark:bg-[#020617] text-slate-900 dark:text-white font-sans overflow-hidden">
      <Navbar />
      
      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        <main className="pb-20">
          <Routes>
            <Route path="/" element={<Navigate to="/vision" replace />} />
            <Route path="/vision" element={<VisionFeed />} />
            <Route path="/vision/:type/:id" element={<PostDetailRoute />} />
            <Route path="/projects" element={<ProjectHub />} />
            <Route path="/store" element={<StoreHub />} />
            <Route path="/create" element={<CreateIdea />} />
            <Route path="/search" element={<Navigate to="/vision" replace />} />
            <Route path="/chat" element={<ChatList />} />
            <Route path="/completed" element={<LegacyStoreRoute />} />
            <Route path="/completed/post/:projectId" element={<PostToCompleted />} />
            <Route path="/completed/:id" element={<CompletedDetail />} />
            <Route path="/purchases" element={<PurchaseHistory />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/list" element={<LegacyListRoute />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/idea/:id" element={<PostDetailRoute kind="idea" />} />
            <Route path="/project/:id" element={<PostDetailRoute kind="project" />} />
            <Route path="/compile/:projectId" element={<CompileIdea />} />
            <Route path="/memos/*" element={<Navigate to="/vision" replace />} />
            <Route path="/contracts/*" element={<Navigate to="/vision" replace />} />
            <Route path="/chat/:type/:id" element={<ProjectChat />} />
            <Route path="/network/:id" element={<NetworkView />} />
          </Routes>
        </main>


      </div>

      <BottomNav />
      <DraftSidebar />

    </div>
  );
}

function LegacyStoreRoute() {
  const location=useLocation();
  return <Navigate to={'/store'+location.search} state={location.state} replace/>;
}
function LegacyListRoute() {
  const location=useLocation();
  const type=new URLSearchParams(location.search).get('type');
  if(type==='buyout')return <Navigate to="/store?tab=buyout" state={location.state} replace/>;
  if(type==='recruitment'||type==='offer')return <Navigate to={'/projects'+location.search} state={location.state} replace/>;
  return <ListView/>;
}
