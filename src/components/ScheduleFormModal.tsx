import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Link2, User, Users, FileText, AlertCircle, Bell, Shield, Repeat, Paperclip, CheckCircle2, Check } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { safeFetchJson } from '../lib/api';

export const SCHEDULE_TYPES = [
  '締切',
  '会議',
  '作業',
  'レビュー',
  'Idea提出期限',
  '承認期限',
  'イベント',
  '成果物提出',
  'プロジェクト開始',
  'プロジェクト完了',
  'その他'
];

export const REMINDER_OPTIONS = [
  { value: '0', label: '開始時刻' },
  { value: '10m', label: '10分前' },
  { value: '30m', label: '30分前' },
  { value: '1h', label: '1時間前' },
  { value: '1d', label: '1日前' },
  { value: '3d', label: '3日前' },
  { value: '1w', label: '1週間前' },
];

interface ScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  type: 'project' | 'idea';
  id: string;
  initialData?: any;
}

export default function ScheduleFormModal({
  isOpen,
  onClose,
  onSaved,
  type,
  id,
  initialData
}: ScheduleFormModalProps) {
  const { user, language } = useAppContext();
  const [members, setMembers] = useState<any[]>([]);
  const [userEMAs, setUserEMAs] = useState<any[]>([]);
  const [userIdeas, setUserIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('会議');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [selectedAttendees, setSelectedAttendees] = useState<number[]>([]);
  const [relatedProjectId, setRelatedProjectId] = useState<string>('');
  const [relatedIdeaId, setRelatedIdeaId] = useState<string>('');
  const [relatedTask, setRelatedTask] = useState('');
  const [completionCriteria, setCompletionCriteria] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'highest'>('normal');
  const [reminders, setReminders] = useState<string[]>(['1d', '1h']);
  const [notifyTarget, setNotifyTarget] = useState<'assignee' | 'attendees' | 'all'>('all');
  const [visibility, setVisibility] = useState<'all' | 'attendees' | 'private'>('all');
  const [status, setStatus] = useState<string>('unstarted');
  const [recurrence, setRecurrence] = useState<string>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState('');
  const [notifyChat, setNotifyChat] = useState(true);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Fetch members
    const endpoint = `/api/${type === 'idea' ? 'ideas' : 'projects'}/${id}/members_detailed`;
    safeFetchJson(endpoint, undefined, [])
      .then(data => setMembers(Array.isArray(data) ? data : []));

    // Fetch user's Visions & Ideas for linking
    if (user) {
      safeFetchJson(`/api/users/${user.id}/projects`, undefined, [])
        .then(data => setUserEMAs(Array.isArray(data) ? data : []));
      safeFetchJson(`/api/users/${user.id}/ideas`, undefined, [])
        .then(data => setUserIdeas(Array.isArray(data) ? data : []));
    }

    // Set initial datetime values
    const now = new Date();
    const nextHour = new Date(now.getTime() + 3600 * 1000);
    const twoHoursLater = new Date(now.getTime() + 7200 * 1000);

    const formatForInput = (d: Date) => {
      const pad = (n: number) => (n < 10 ? '0' + n : n);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
    };

    if (initialData) {
      setTitle(initialData.title || '');
      setEventType(initialData.event_type || '会議');
      setIsAllDay(!!initialData.is_all_day);
      setStartAt(initialData.start_at ? initialData.start_at.slice(0, 16) : formatForInput(nextHour));
      setEndAt(initialData.end_at ? initialData.end_at.slice(0, 16) : formatForInput(twoHoursLater));
      setDescription(initialData.description || '');
      setLocation(initialData.location || '');
      setMeetingUrl(initialData.meeting_url || '');
      setAssigneeId(initialData.assignee_id ? String(initialData.assignee_id) : '');
      setSelectedAttendees(Array.isArray(initialData.attendees) ? initialData.attendees : []);
      setRelatedProjectId(initialData.related_project_id ? String(initialData.related_project_id) : '');
      setRelatedIdeaId(initialData.related_idea_id ? String(initialData.related_idea_id) : '');
      setRelatedTask(initialData.related_task || '');
      setCompletionCriteria(initialData.completion_criteria || '');
      setPriority(initialData.priority || 'normal');
      setReminders(Array.isArray(initialData.reminders) ? initialData.reminders : ['1d', '1h']);
      setNotifyTarget(initialData.notify_target || 'all');
      setVisibility(initialData.visibility || 'all');
      setStatus(initialData.status || 'unstarted');
      setRecurrence(initialData.recurrence || 'none');
      setRecurrenceEndDate(initialData.recurrence_end_date ? initialData.recurrence_end_date.slice(0, 10) : '');
      setRecurrenceCount(initialData.recurrence_count ? String(initialData.recurrence_count) : '');
      setAttachments(Array.isArray(initialData.attachments) ? initialData.attachments : []);
    } else {
      setTitle('');
      setEventType('会議');
      setIsAllDay(false);
      setStartAt(formatForInput(nextHour));
      setEndAt(formatForInput(twoHoursLater));
      setDescription('');
      setLocation('');
      setMeetingUrl('');
      setAssigneeId(user ? String(user.id) : '');
      setSelectedAttendees(user ? [user.id] : []);
      setRelatedProjectId('');
      setRelatedIdeaId('');
      setRelatedTask('');
      setCompletionCriteria('');
      setPriority('normal');
      setReminders(['1d', '1h']);
      setNotifyTarget('all');
      setVisibility('all');
      setStatus('unstarted');
      setRecurrence('none');
      setRecurrenceEndDate('');
      setRecurrenceCount('');
      setAttachments([]);
    }
  }, [isOpen, initialData, type, id, user]);

  if (!isOpen) return null;

  const isDeadline = eventType === '締切' || eventType === 'Idea提出期限' || eventType === '承認期限' || eventType === '成果物提出';

  const toggleAttendee = (userId: number) => {
    setSelectedAttendees(prev => 
      prev.includes(userId) ? prev.filter(uid => uid !== userId) : [...prev, userId]
    );
  };

  const toggleReminder = (remVal: string) => {
    setReminders(prev =>
      prev.includes(remVal) ? prev.filter(r => r !== remVal) : [...prev, remVal]
    );
  };

  const addAttachment = () => {
    if (!newAttachmentName || !newAttachmentUrl) return;
    setAttachments(prev => [...prev, { name: newAttachmentName, url: newAttachmentUrl }]);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startAt || !endAt || !user) return;

    setLoading(true);

    const payload = {
      project_id: type === 'project' ? parseInt(id) : (relatedProjectId ? parseInt(relatedProjectId) : null),
      idea_id: type === 'idea' ? parseInt(id) : (relatedIdeaId ? parseInt(relatedIdeaId) : null),
      author_id: user.id,
      title: title.trim(),
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      event_type: eventType,
      is_all_day: isAllDay ? 1 : 0,
      description,
      location,
      meeting_url: meetingUrl,
      assignee_id: assigneeId ? parseInt(assigneeId) : null,
      attendees: selectedAttendees,
      related_project_id: relatedProjectId ? parseInt(relatedProjectId) : null,
      related_idea_id: relatedIdeaId ? parseInt(relatedIdeaId) : null,
      related_task: relatedTask,
      completion_criteria: completionCriteria,
      priority,
      reminders,
      notify_target: notifyTarget,
      visibility,
      attachments,
      recurrence,
      recurrence_end_date: recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : null,
      recurrence_count: recurrenceCount ? parseInt(recurrenceCount) : null,
      status,
      notify_chat: notifyChat,
      updated_by: user.id
    };

    try {
      const url = initialData ? `/api/schedules/${initialData.id}` : '/api/schedules';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || '保存に失敗しました');
      }
    } catch (err) {
      console.error(err);
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`p-6 border-b flex items-center justify-between shrink-0 ${
          isDeadline ? 'bg-rose-950/40 border-rose-900/50' : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className={`w-6 h-6 ${isDeadline ? 'text-rose-400' : 'text-blue-400'}`} />
              {initialData 
                ? (language === 'ja' ? '予定の編集' : 'Edit Schedule') 
                : (language === 'ja' ? '新規予定の追加' : 'Add New Schedule')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isDeadline ? '締切・提出物の登録設定' : 'プロジェクトのスケジュール項目を入力'}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar text-sm">
          
          {/* Category / Event Type */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
              予定の種類 <span className="text-rose-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_TYPES.map(st => {
                const selected = eventType === st;
                const isDlType = st === '締切' || st === 'Idea提出期限' || st === '承認期限' || st === '成果物提出';
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setEventType(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      selected
                        ? (isDlType ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20' : 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20')
                        : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:border-slate-600'
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              予定タイトル <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="例: 第2回企画レビュー会議, デザイン案最終締切"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* All day & Datetimes */}
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-400" /> 日時の設定
              </span>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500"
                />
                終日設定
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  開始日時 <span className="text-rose-400">*</span>
                </label>
                <input
                  type={isAllDay ? "date" : "datetime-local"}
                  required
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  終了日時 / 締切日時 <span className="text-rose-400">*</span>
                </label>
                <input
                  type={isAllDay ? "date" : "datetime-local"}
                  required
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Deadline Specific Options */}
          {isDeadline && (
            <div className="bg-rose-950/20 border border-rose-900/40 p-4 rounded-2xl space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <AlertCircle className="w-4 h-4" /> 締切の優先度・完了条件
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    重要度
                  </label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
                  >
                    <option value="normal">通常</option>
                    <option value="important">重要</option>
                    <option value="highest">最重要</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    ステータス
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
                  >
                    <option value="unstarted">未着手</option>
                    <option value="in_progress">進行中</option>
                    <option value="review_pending">確認待ち</option>
                    <option value="completed">完了</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  完了条件 (任意)
                </label>
                <textarea
                  rows={2}
                  placeholder="例: 全員が成果物URLをコメントに貼り付けたら完了"
                  value={completionCriteria}
                  onChange={(e) => setCompletionCriteria(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* Description & Location / Online URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                場所 (オフライン)
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="会議室A, 東京オフィス..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                オンライン会議URL
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              説明・アジェンダ (任意)
            </label>
            <textarea
              rows={3}
              placeholder="会議の議題や注意事項..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Attendees Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>参加者を選択</span>
                {selectedAttendees.length > 0 && (
                  <span className="text-emerald-400 font-semibold text-xs ml-1">
                    ({selectedAttendees.length}名選択中)
                  </span>
                )}
              </label>

              {members.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAttendees(members.map(m => m.id))}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg transition-colors border border-emerald-500/20"
                  >
                    全員を選択
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAttendees([])}
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-300 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-colors border border-slate-700"
                  >
                    選択解除
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 max-h-52 overflow-y-auto custom-scrollbar">
              {members.length === 0 ? (
                <p className="text-xs text-slate-500 p-2 text-center">プロジェクトメンバーがいません</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {members.map(m => {
                    const checked = selectedAttendees.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleAttendee(m.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          checked
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-sm'
                            : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            checked ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {m.username ? m.username.slice(0, 1).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate leading-tight">{m.username}</p>
                            {m.field && (
                              <p className="text-[10px] text-slate-400 truncate">{m.field}</p>
                            )}
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          checked
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-slate-600 bg-slate-900'
                        }`}>
                          {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Related Vision / Idea / Task */}
          <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 space-y-3">
            <span className="text-xs font-bold text-slate-300 block">関連要素の紐付け (任意)</span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">関連Vision</label>
                <select
                  value={relatedProjectId}
                  onChange={(e) => setRelatedProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                >
                  <option value="">選択なし</option>
                  {userEMAs.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">関連Idea</label>
                <select
                  value={relatedIdeaId}
                  onChange={(e) => setRelatedIdeaId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                >
                  <option value="">選択なし</option>
                  {userIdeas.map(i => (
                    <option key={i.id} value={i.id}>{i.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">関連タスク / 提出物概要</label>
              <input
                type="text"
                placeholder="例: フロントエンド画面設計書の提出"
                value={relatedTask}
                onChange={(e) => setRelatedTask(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          {/* Recurrence Settings */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5 text-indigo-400" /> 繰り返し設定
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
              {[
                { val: 'none', label: 'なし' },
                { val: 'daily', label: '毎日' },
                { val: 'weekly', label: '毎週' },
                { val: 'monthly', label: '毎月' },
                { val: 'weekdays', label: '平日のみ' },
              ].map(r => (
                <button
                  key={r.val}
                  type="button"
                  onClick={() => setRecurrence(r.val)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${
                    recurrence === r.val
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {recurrence !== 'none' && (
              <div className="flex gap-3 mt-2 bg-indigo-950/20 p-3 rounded-xl border border-indigo-900/40">
                <div className="flex-1">
                  <label className="block text-[11px] text-slate-300 mb-1">繰返し終了日</label>
                  <input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Reminders & Notification Targets */}
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-amber-400" /> リマインド・通知設定
            </span>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">通知時期 (複数選択可能)</label>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map(ro => {
                  const sel = reminders.includes(ro.value);
                  return (
                    <button
                      key={ro.value}
                      type="button"
                      onClick={() => toggleReminder(ro.value)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                        sel
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      {ro.label} {sel && '✓'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">通知対象者</label>
                <select
                  value={notifyTarget}
                  onChange={(e: any) => setNotifyTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                >
                  <option value="all">プロジェクトメンバー全員</option>
                  <option value="attendees">指定した参加者のみ</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">公開範囲</label>
                <select
                  value={visibility}
                  onChange={(e: any) => setVisibility(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                >
                  <option value="all">プロジェクトメンバー全員</option>
                  <option value="attendees">指定した参加者のみ</option>
                  <option value="private">自分のみ (非公開)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5 text-blue-400" /> 添付ファイル / 参考URL
            </label>

            {attachments.length > 0 && (
              <div className="space-y-2 mb-3">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-xs">
                    <span className="text-white font-medium truncate max-w-[200px]">{att.name}</span>
                    <div className="flex items-center gap-2">
                      <a href={att.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-[11px]">開く</a>
                      <button type="button" onClick={() => removeAttachment(idx)} className="text-slate-500 hover:text-rose-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="ファイル名またはリンク名"
                value={newAttachmentName}
                onChange={(e) => setNewAttachmentName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              />
              <input
                type="url"
                placeholder="URL (https://...)"
                value={newAttachmentUrl}
                onChange={(e) => setNewAttachmentUrl(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
              />
              <button
                type="button"
                onClick={addAttachment}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shrink-0 border border-slate-700"
              >
                追加
              </button>
            </div>
          </div>

          {/* Chat Notification Checkbox */}
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">チャットへの通知</span>
              <span className="text-[11px] text-slate-400">プロジェクトチャットへカード投稿・変更通知を送信</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyChat}
                onChange={(e) => setNotifyChat(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-300 font-bold">{notifyChat ? '参加者へ通知する' : '通知せず変更する'}</span>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-3 font-bold text-white rounded-2xl transition-all shadow-lg ${
                isDeadline 
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20' 
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
              }`}
            >
              {loading ? '保存中...' : (initialData ? '予定を更新' : '予定を作成')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
