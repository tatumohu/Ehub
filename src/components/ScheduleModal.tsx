import React, { useState, useEffect } from 'react';
import { 
  X, Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Clock, 
  MapPin, Link2, Users, CheckCircle2, AlertTriangle, FileText, Check,
  Trash2, Edit3, Filter, MessageSquare, Bell, Paperclip, AlertCircle, RefreshCw
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { safeFetchJson } from '../lib/api';
import ScheduleFormModal from './ScheduleFormModal';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'project' | 'idea';
  id: string;
  selectedScheduleId?: number | null;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  type,
  id,
  selectedScheduleId
}: ScheduleModalProps) {
  const { user, language } = useAppContext();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Selected Schedule Detail View State
  const [activeSchedule, setActiveSchedule] = useState<any | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);

  const fetchSchedules = () => {
    if (!type || !id) return;
    setLoading(true);
    const param = type === 'project' ? `project_id=${id}` : `idea_id=${id}`;
    const userParam = user ? `&user_id=${user.id}` : '';
    safeFetchJson(`/api/schedules?${param}${userParam}`, undefined, [])
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setSchedules(list);
        setLoading(false);

        // If selectedScheduleId was passed from chat card, open detail directly
        if (selectedScheduleId) {
          const found = list.find(s => s.id === selectedScheduleId);
          if (found) {
            fetchScheduleDetail(found.id);
          }
        }
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      fetchSchedules();
    }
  }, [isOpen, type, id, user]);

  const fetchScheduleDetail = (schedId: number) => {
    safeFetchJson(`/api/schedules/${schedId}`, undefined, null)
      .then(data => {
        if (data) setActiveSchedule(data);
      });
  };

  if (!isOpen) return null;

  // Calendar Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else if (viewMode === 'day') d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else if (viewMode === 'day') d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // RSVP Action
  const handleRsvp = async (status: 'attending' | 'declined' | 'tentative') => {
    if (!activeSchedule || !user) return;
    try {
      const res = await fetch(`/api/schedules/${activeSchedule.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, status })
      });
      if (res.ok) {
        fetchScheduleDetail(activeSchedule.id);
        fetchSchedules();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Schedule Action
  const handleDelete = async (schedId: number) => {
    if (!confirm('この予定を削除しますか？')) return;
    try {
      const res = await fetch(`/api/schedules/${schedId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify_chat: true, user_id: user?.id })
      });
      if (res.ok) {
        setActiveSchedule(null);
        fetchSchedules();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered schedules
  const filteredSchedules = schedules.filter(s => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'deadline') return s.event_type === '締切' || s.event_type === 'Idea提出期限' || s.event_type === '承認期限' || s.event_type === '成果物提出';
    return s.event_type === categoryFilter;
  });

  // Days in month calculation
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Format date header string
  const headerDateString = `${year}年 ${month + 1}月`;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[92vh]">
        
        {/* Top Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/20 rounded-2xl text-blue-400 border border-blue-500/30">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                プロジェクトカレンダー
              </h2>
            </div>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setEditingSchedule(null);
                setIsFormOpen(true);
              }}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> 予定を追加
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="p-3 sm:p-4 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold border border-slate-700 transition-colors"
            >
              今日
            </button>
            <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <button onClick={handlePrev} className="p-1.5 hover:bg-slate-700 text-slate-300">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={handleNext} className="p-1.5 hover:bg-slate-700 text-slate-300">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <span className="font-extrabold text-white text-base ml-2">{headerDateString}</span>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-800 p-1 rounded-2xl border border-slate-700">
            {[
              { id: 'month', label: '月' },
              { id: 'list', label: '予定一覧' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  viewMode === m.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs font-semibold focus:outline-none"
            >
              <option value="all">すべての種類</option>
              <option value="deadline">締切・提出期限のみ</option>
              <option value="会議">会議</option>
              <option value="作業">作業</option>
              <option value="レビュー">レビュー</option>
              <option value="イベント">イベント</option>
            </select>
          </div>
        </div>

        {/* Main Calendar Body Area */}
        <div className="flex-1 overflow-hidden relative flex">
          
          {/* Main Grid View */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 custom-scrollbar">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                <p>予定データを読み込み中...</p>
              </div>
            ) : viewMode === 'month' ? (
              /* MONTH VIEW */
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                  <div key={d} className={`text-center py-2 text-xs font-bold uppercase rounded-lg bg-slate-800/40 ${
                    i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'
                  }`}>
                    {d}
                  </div>
                ))}

                {/* Empty cells before month start */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[90px] sm:min-h-[110px] bg-slate-900/30 rounded-2xl border border-slate-800/40 p-1 opacity-40" />
                ))}

                {/* Days of current month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const isToday = dayNum === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                  
                  // Filter items for this day
                  const daySchedules = filteredSchedules.filter(s => {
                    const sd = new Date(s.start_at);
                    return sd.getDate() === dayNum && sd.getMonth() === month && sd.getFullYear() === year;
                  });

                  return (
                    <div 
                      key={dayNum} 
                      className={`min-h-[90px] sm:min-h-[110px] p-1.5 rounded-2xl border transition-all flex flex-col justify-between ${
                        isToday 
                          ? 'bg-blue-950/20 border-blue-500/60 ring-1 ring-blue-500/30' 
                          : 'bg-slate-800/20 border-slate-800/80 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isToday ? 'bg-blue-600 text-white' : 'text-slate-300'
                        }`}>
                          {dayNum}
                        </span>
                        {daySchedules.length > 0 && (
                          <span className="text-[10px] text-slate-500 font-mono">({daySchedules.length})</span>
                        )}
                      </div>

                      {/* Day schedule items */}
                      <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                        {daySchedules.map(s => {
                          const isDl = s.event_type === '締切' || s.event_type === 'Idea提出期限' || s.event_type === '承認期限' || s.event_type === '成果物提出';
                          const isOverdue = s.status === 'overdue';
                          return (
                            <button
                              key={s.id}
                              onClick={() => fetchScheduleDetail(s.id)}
                              className={`w-full text-left px-2 py-1 rounded-lg text-[11px] font-bold truncate transition-all flex items-center justify-between ${
                                isOverdue
                                  ? 'bg-rose-900/60 text-rose-200 border border-rose-500/50'
                                  : isDl
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30'
                              }`}
                            >
                              <span className="truncate">{s.title}</span>
                              {isOverdue && <span className="text-[9px] bg-rose-600 text-white px-1 rounded shrink-0">期限切れ</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW & OTHER VIEWS */
              <div className="space-y-3 max-w-3xl mx-auto">
                {filteredSchedules.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                    <p className="text-sm">表示する予定がありません</p>
                  </div>
                ) : (
                  filteredSchedules.map(s => {
                    const isDl = s.event_type === '締切' || s.event_type === 'Idea提出期限' || s.event_type === '承認期限' || s.event_type === '成果物提出';
                    const isOverdue = s.status === 'overdue';
                    const isCompleted = s.status === 'completed';

                    return (
                      <div
                        key={s.id}
                        onClick={() => fetchScheduleDetail(s.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isOverdue 
                            ? 'bg-rose-950/20 border-rose-800/60 hover:border-rose-600'
                            : isDl
                            ? 'bg-slate-800/40 border-rose-900/40 hover:border-rose-500/50'
                            : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              isDl ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {s.event_type}
                            </span>

                            {isOverdue && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> 期限超過
                              </span>
                            )}

                            {isCompleted && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> 完了
                              </span>
                            )}

                            <span className="text-xs text-slate-400 font-mono">
                              {new Date(s.start_at).toLocaleDateString('ja-JP')} {s.start_at.slice(11, 16)} 〜 {s.end_at.slice(11, 16)}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-white truncate">{s.title}</h3>

                          {s.description && (
                            <p className="text-xs text-slate-400 line-clamp-1">{s.description}</p>
                          )}
                        </div>

                        {/* Attendees & RSVP stats */}
                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          {s.assignee_name && (
                            <div className="flex items-center gap-1 text-slate-300 bg-slate-900/60 px-2.5 py-1 rounded-xl border border-slate-700">
                              <span className="text-slate-400 text-[10px]">担当:</span>
                              <span className="font-bold">{s.assignee_name}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-slate-400">
                            <span className="text-emerald-400 font-bold">参加 {s.attending_count || 0}</span>
                            <span className="text-slate-500">/</span>
                            <span>未定 {s.tentative_count || 0}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Schedule Detail Panel (Slide-Over) */}
          {activeSchedule && (
            <div className="w-full sm:w-96 bg-slate-900 border-l border-slate-800 p-6 flex flex-col h-full overflow-y-auto custom-scrollbar animate-fade-in shrink-0">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  activeSchedule.event_type === '締切' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {activeSchedule.event_type}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingSchedule(activeSchedule);
                      setIsFormOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                    title="編集"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(activeSchedule.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveSchedule(null)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & Time */}
              <div className="space-y-3 mb-6">
                <h3 className="text-lg font-bold text-white">{activeSchedule.title}</h3>
                
                <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                  <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <div>{new Date(activeSchedule.start_at).toLocaleString('ja-JP')}</div>
                    <div className="text-slate-400 text-[11px]">〜 {new Date(activeSchedule.end_at).toLocaleString('ja-JP')}</div>
                  </div>
                </div>
              </div>

              {/* RSVP Action Buttons (Req 31) */}
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60 mb-6 space-y-2">
                <span className="text-xs font-bold text-slate-300 block">出欠回答 (RSVP)</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'attending', label: '参加', color: 'bg-emerald-600 hover:bg-emerald-500' },
                    { id: 'tentative', label: '未定', color: 'bg-amber-600 hover:bg-amber-500' },
                    { id: 'declined', label: '不参加', color: 'bg-rose-600 hover:bg-rose-500' },
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleRsvp(r.id as any)}
                      className={`py-2 rounded-xl text-xs font-bold text-white transition-all ${r.color}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* RSVPs List */}
              {activeSchedule.rsvps && activeSchedule.rsvps.length > 0 && (
                <div className="mb-6 space-y-2">
                  <span className="text-xs font-bold text-slate-400 block">メンバーの出欠回答</span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                    {activeSchedule.rsvps.map((rv: any) => (
                      <div key={rv.user_id} className="flex items-center justify-between p-2 bg-slate-800/40 rounded-xl text-xs">
                        <div className="flex items-center gap-2">
                          <img src={rv.avatar || undefined} alt={rv.username} className={`w-6 h-6 rounded-full object-cover ${getAccountTypeBorderClass(rv.account_type, 'border-2')}`} />
                          <span className="text-white font-medium">{rv.username}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          rv.status === 'attending' ? 'bg-emerald-500/20 text-emerald-300' :
                          rv.status === 'declined' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {rv.status === 'attending' ? '参加' : rv.status === 'declined' ? '不参加' : '未定'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Location & Meeting URL */}
              {(activeSchedule.location || activeSchedule.meeting_url) && (
                <div className="space-y-2 mb-6 text-xs">
                  {activeSchedule.location && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <MapPin className="w-4 h-4 text-slate-500" />
                      <span>{activeSchedule.location}</span>
                    </div>
                  )}
                  {activeSchedule.meeting_url && (
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-blue-400" />
                      <a href={activeSchedule.meeting_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-bold truncate">
                        オンライン会議に参加
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {activeSchedule.description && (
                <div className="mb-6 space-y-1">
                  <span className="text-xs font-bold text-slate-400">説明・概要</span>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                    {activeSchedule.description}
                  </p>
                </div>
              )}

              {/* Completion Criteria if Deadline */}
              {activeSchedule.completion_criteria && (
                <div className="mb-6 space-y-1 bg-rose-950/20 p-3 rounded-xl border border-rose-900/40">
                  <span className="text-xs font-bold text-rose-400 block">完了条件</span>
                  <p className="text-xs text-rose-200">{activeSchedule.completion_criteria}</p>
                </div>
              )}

              {/* Attachments */}
              {activeSchedule.attachments && activeSchedule.attachments.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" /> 添付ファイル
                  </span>
                  <div className="space-y-1">
                    {activeSchedule.attachments.map((att: any, idx: number) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block p-2 bg-slate-800/80 rounded-xl text-xs text-blue-400 hover:underline truncate border border-slate-700"
                      >
                        {att.name || att.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            閉じる
          </button>
        </div>

      </div>

      {/* Schedule Form Modal */}
      <ScheduleFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={() => {
          fetchSchedules();
          if (activeSchedule) fetchScheduleDetail(activeSchedule.id);
        }}
        type={type}
        id={id}
        initialData={editingSchedule}
      />
    </div>
  );
}
