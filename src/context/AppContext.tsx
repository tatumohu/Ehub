import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export type User = {
  id: number;
  username: string;
  avatar: string;
  title?: string;
  private_profile?: boolean | number;
  show_activity_status?: boolean | number;
  account_type?: 'individual' | 'organization' | 'corporate' | 'municipality';
  country?: string;
  region?: string;
  org_plan?: 'pro' | 'basic' | 'enterprise' | 'light' | string;
  plan?: string;
  is_account_type_selected?: boolean | number;
  tags?: string;
  municipality_name?: string;
  prefecture?: string;
  municipality_type?: string;
  website_url?: string;
  official_website?: string;
  department_name?: string;
  department?: string;
  verification_status?: 'unverified' | 'pending' | 'verified' | string;
  company_name?: string;
  industry?: string;
  company_location?: string;
};

import localforage from 'localforage';

type AppContextType = {
  user: User | null;
  isAuthLoaded: boolean;
  login: (userData: User) => void;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  socket: Socket | null;
  totalUnreadCount: number;
  projectUnreadCount: number;
  directUnreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  unreadNotificationsCount: number;
  refreshUnreadNotificationsCount: () => Promise<void>;
  unreadOfferCount: number;
  refreshUnreadOfferCount: () => Promise<void>;
  unreadRecruitmentCount: number;
  refreshUnreadRecruitmentCount: () => Promise<void>;
  language: string;
  setLanguage: (lang: string) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [projectUnreadCount, setProjectUnreadCount] = useState(0);
  const [directUnreadCount, setDirectUnreadCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [unreadOfferCount, setUnreadOfferCount] = useState(0);
  const [unreadRecruitmentCount, setUnreadRecruitmentCount] = useState(0);
  const [language, setLanguageState] = useState(() => localStorage.getItem('ehub_language') || 'en');
  const [themeState, setThemeState] = useState<'dark' | 'light'>(() => (localStorage.getItem('ehub_theme') as 'dark' | 'light') || 'dark');
  const refreshTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('ehub_language', lang);
    } catch(e) {}
  };

  const setTheme = (theme: 'dark' | 'light') => {
    setThemeState(theme);
    try {
      localStorage.setItem('ehub_theme', theme);
    } catch(e) {}
  };

  useEffect(() => {
    if (themeState === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeState]);

  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const refreshUnreadCount = useCallback(async (signal?: AbortSignal) => {
    const currentUser = userRef.current;
    if (!currentUser || !currentUser.id) return;
    try {
      const res = await fetch(`/api/users/${currentUser.id}/unread_count`, { signal });
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        if (res.status === 404 || res.status === 400) {
          // If the server says the user is not found, clear the invalid session
          setUser(null);
          localforage.removeItem('ehub_user');
          localStorage.removeItem('ehub_user');
          return;
        }
        // Only log if it's a real server error, not a network failure
        if (res.status >= 500) {
          const text = await res.text();
          console.warn(`Failed to refresh unread count: ${res.status}`, text.slice(0, 100));
        }
        return;
      }
      const data = await res.json();
      setTotalUnreadCount(data.unread_count || 0);
      setProjectUnreadCount(data.project_unread_count || 0);
      setDirectUnreadCount(data.direct_unread_count || 0);
    } catch (e) {
      // Silently ignore network errors and aborts for background tasks
      if (e instanceof Error && (e.name === 'AbortError' || e.message === 'Failed to fetch' || e.message === 'Load failed')) return;
      console.error('Failed to refresh unread count:', e);
    }
  }, []);

  const refreshUnreadNotificationsCount = useCallback(async (signal?: AbortSignal) => {
    const currentUser = userRef.current;
    if (!currentUser || !currentUser.id) return;
    try {
      const res = await fetch(`/api/users/${currentUser.id}/unread_notifications_count`, { signal });
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        if (res.status === 404 || res.status === 400) {
          // If the server says the user is not found, clear the invalid session
          setUser(null);
          localforage.removeItem('ehub_user');
          localStorage.removeItem('ehub_user');
          return;
        }
        // Only log if it's a real server error, not a network failure
        if (res.status >= 500) {
          const text = await res.text();
          console.warn(`Failed to refresh unread notifications count: ${res.status}`, text.slice(0, 100));
        }
        return;
      }
      const data = await res.json();
      setUnreadNotificationsCount(data.count || 0);
    } catch (e) {
      // Silently ignore network errors and aborts for background tasks
      if (e instanceof Error && (e.name === 'AbortError' || e.message === 'Failed to fetch' || e.message === 'Load failed')) return;
      console.error('Failed to refresh unread notifications count:', e);
    }
  }, []);

  const refreshUnreadOfferCount = useCallback(async (signal?: AbortSignal) => {
    const currentUser = userRef.current;
    if (!currentUser || !currentUser.id) return;
    try {
      const res = await fetch(`/api/users/${currentUser.id}/unread_offer_count`, { signal });
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        return;
      }
      const data = await res.json();
      setUnreadOfferCount(data.count || 0);
    } catch (e) {
      if (e instanceof Error && (e.name === 'AbortError' || e.message === 'Failed to fetch' || e.message === 'Load failed')) return;
    }
  }, []);

  const refreshUnreadRecruitmentCount = useCallback(async (signal?: AbortSignal) => {
    const currentUser = userRef.current;
    if (!currentUser || !currentUser.id) return;
    try {
      const res = await fetch(`/api/users/${currentUser.id}/unread_recruitment_count`, { signal });
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        return;
      }
      const data = await res.json();
      setUnreadRecruitmentCount(data.count || 0);
    } catch (e) {
      if (e instanceof Error && (e.name === 'AbortError' || e.message === 'Failed to fetch' || e.message === 'Load failed')) return;
    }
  }, []);

  const debouncedRefreshUnreadCount = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      refreshUnreadCount();
    }, 300);
  }, [refreshUnreadCount]);

  useEffect(() => {
    localforage.getItem<any>('ehub_user').then(async (storedUser) => {
      let activeUser = storedUser;
      if (!activeUser) {
        // Fallback or migration from localStorage
        const oldUser = localStorage.getItem('ehub_user');
        if (oldUser && oldUser !== 'undefined') {
          try {
            activeUser = JSON.parse(oldUser);
            localforage.setItem('ehub_user', activeUser);
            localStorage.removeItem('ehub_user');
          } catch (e) {
            console.error('Failed to parse user from local storage:', e);
            localStorage.removeItem('ehub_user');
          }
        }
      }

      if (activeUser && activeUser.id) {
        setUser(activeUser);

        // Fetch fresh user data from server to sync plan and details
        try {
          const res = await fetch(`/api/users/${activeUser.id}`);
          if (res.ok) {
            const fresh = await res.json();
            if (fresh && fresh.id) {
              const merged = { ...activeUser, ...fresh };
              setUser(merged);
              localforage.setItem('ehub_user', merged);
            }
          }
        } catch (err) {
          console.warn('Could not sync user profile from server:', err);
        }
      }

      // Check if user returned with payment success query parameter
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('plan_success')) {
          params.delete('plan_success');
          params.delete('session_id');
          const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
          window.history.replaceState({}, '', newUrl);
        }
      } catch (_) {}

      setIsAuthLoaded(true);
    }).catch(e => {
      console.error(e);
      setIsAuthLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (user) {
      const abortController = new AbortController();
      const newSocket = io();
      newSocket.emit('join_user', user.id);
      setSocket(newSocket);

      refreshUnreadCount(abortController.signal);
      refreshUnreadNotificationsCount(abortController.signal);
      refreshUnreadOfferCount(abortController.signal);
      refreshUnreadRecruitmentCount(abortController.signal);

      // Periodic refresh as a fallback
      const interval = setInterval(() => {
        refreshUnreadCount(abortController.signal);
        refreshUnreadNotificationsCount(abortController.signal);
        refreshUnreadOfferCount(abortController.signal);
        refreshUnreadRecruitmentCount(abortController.signal);
      }, 30000);

      // Join all project/idea rooms to receive message updates for global unread count
      fetch(`/api/users/${user.id}/memberships`)
        .then(res => {
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) return [];
          return res.json();
        })
        .then(projects => {
          if (Array.isArray(projects)) {
            projects.forEach((p: any) => {
              newSocket.emit(p.type === 'idea' ? 'join_idea' : 'join_project', p.id);
            });
          }
        })
        .catch(e => {
          if (e instanceof Error && (e.name === 'AbortError' || e.message === 'Failed to fetch' || e.message === 'Load failed')) return;
          console.error('Failed to fetch memberships:', e);
        });

      const handleNewMessage = (msg: any) => {
        // If we received a message from someone else, refresh the count
        if (msg.user_id !== user.id) {
          debouncedRefreshUnreadCount();
        }
      };

      const handleMessageRead = (payload: any) => {
        // If the current user marked a message as read, refresh the count
        if (payload.user_id === user.id) {
          debouncedRefreshUnreadCount();
        }
      };

      const handleNotification = () => {
        refreshUnreadNotificationsCount();
        refreshUnreadOfferCount();
      };

      newSocket.on('new_message', handleNewMessage);
      newSocket.on('message_read', handleMessageRead);
      newSocket.on('notification', handleNotification);

      return () => {
        abortController.abort();
        clearInterval(interval);
        newSocket.disconnect();
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setTotalUnreadCount(0);
      setUnreadNotificationsCount(0);
      setUnreadOfferCount(0);
    }
  }, [user]);

  const login = useCallback((userData: User & { email?: string }) => {
    setUser(userData);
    localforage.setItem('ehub_user', userData).catch(e => {
      console.error('Failed to save user to localforage:', e);
    });
    if (userData.email) {
      try {
        localStorage.setItem('ehub_last_email', userData.email);
      } catch (e) {}
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localforage.removeItem('ehub_user');
    localStorage.removeItem('ehub_user');
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localforage.setItem('ehub_user', updatedUser).catch(e => {
      console.error('Failed to save user to localforage:', e);
    });
  }, []);

  return (
    <AppContext.Provider value={{ 
      user, isAuthLoaded, login, logout, updateUser, socket, 
      totalUnreadCount, projectUnreadCount, directUnreadCount, refreshUnreadCount,
      unreadNotificationsCount, refreshUnreadNotificationsCount,
      unreadOfferCount, refreshUnreadOfferCount,
      unreadRecruitmentCount, refreshUnreadRecruitmentCount,
      language, setLanguage, theme: themeState, setTheme
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
