import React, { useEffect, useState } from 'react';
import { X, Users, Shield, Clock, MapPin, Sparkles, UserCheck, CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { safeFetchJson } from '../lib/api';
import { getAccountTypeBorderClass } from '../utils/avatar';
import AccountTypeBadge from './AccountTypeBadge';

interface Member {
  id: number;
  username: string;
  avatar: string;
  account_type?: any;
  role: string; // 管理者, メンバー, 閲覧者
  joined_at: string;
  field: string; // 担当分野 (企画, 開発, デザイン, マーケティング, etc.)
  online_status: string; // オンライン, オフライン
  permissions: string; // 管理者, 編集可, 閲覧のみ
  join_route: string; // 参加申請, Projectから参加, 指名スカウト, Vision投稿者による招待
}

interface ProjectMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'project' | 'idea';
  id: string;
}

export default function ProjectMembersModal({ isOpen, onClose, type, id }: ProjectMembersModalProps) {
  const { language } = useAppContext();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen || !type || !id) return;
    setLoading(true);
    const endpoint = `/api/${type === 'idea' ? 'ideas' : 'projects'}/${id}/members_detailed`;
    safeFetchJson(endpoint, undefined, [])
      .then(data => {
        const rawList: Member[] = Array.isArray(data) ? data : [];
        const uniqueMap = new Map<number, Member>();
        for (const m of rawList) {
          if (!uniqueMap.has(m.id) || m.role === '管理者') {
            uniqueMap.set(m.id, m);
          }
        }
        setMembers(Array.from(uniqueMap.values()));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen, type, id]);

  if (!isOpen) return null;

  const filtered = members.filter(m => 
    m.username.toLowerCase().includes(search.toLowerCase()) ||
    m.field?.toLowerCase().includes(search.toLowerCase()) ||
    m.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-400" />
              {language === 'ja' ? 'プロジェクトメンバー' : 'Project Members'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {language === 'ja' ? `全 ${members.length} 名のメンバー情報` : `${members.length} total members`}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search filter */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/50">
          <input
            type="text"
            placeholder={language === 'ja' ? '名前、担当分野で検索...' : 'Search by name, role, field...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">{language === 'ja' ? 'メンバー情報を読み込み中...' : 'Loading members...'}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Users className="w-12 h-12 text-slate-700 mx-auto mb-2" />
              <p className="text-sm">{language === 'ja' ? '該当するメンバーが見つかりません' : 'No members found'}</p>
            </div>
          ) : (
            filtered.map(member => (
              <div 
                key={member.id}
                className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-700 rounded-2xl p-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Avatar & Username */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Link to={`/profile/${member.id}`} className="relative group shrink-0">
                      <img 
                        src={member.avatar || undefined} 
                        alt={member.username} 
                        className={`w-12 h-12 rounded-full object-cover ${getAccountTypeBorderClass(member.account_type, 'border-[3px]')} transition-colors`}
                      />
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" title="オンライン" />
                    </Link>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link 
                          to={`/profile/${member.id}`} 
                          className="font-bold text-white text-base hover:text-emerald-400 transition-colors truncate flex items-center gap-1.5"
                        >
                          {member.username}
                          <AccountTypeBadge accountType={member.account_type} size="xs" />
                        </Link>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          member.role === '管理者' || member.role === 'author' 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {member.role === 'author' ? '管理者' : member.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                        <span className="text-slate-300 font-medium bg-slate-900/60 px-2 py-0.5 rounded border border-slate-700/50">
                          担当: {member.field || '全般'}
                        </span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Shield className="w-3.5 h-3.5 text-indigo-400" />
                          {member.permissions || '編集可'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Joined Date & Route info */}
                  <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-700/50 text-xs text-slate-400 space-y-1 shrink-0">
                    <div className="flex sm:justify-end items-center gap-1.5 text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>参加日: {member.joined_at ? new Date(member.joined_at).toLocaleDateString('ja-JP') : '初期メンバー'}</span>
                    </div>
                    <div className="flex sm:justify-end items-center gap-1.5 text-slate-400 text-[11px]">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>経路: {member.join_route || '参加申請'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 text-right">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-colors"
          >
            {language === 'ja' ? '閉じる' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
