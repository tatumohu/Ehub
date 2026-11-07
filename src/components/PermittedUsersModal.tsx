import React, { useEffect, useState } from 'react';
import { X, Send } from 'lucide-react';
import ScoutMessageModal from './ScoutMessageModal';
import PlanUpgradeModal from './PlanUpgradeModal';
import { useAppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface User {
  id: number;
  username: string;
  avatar: string;
  account_type?: any;
}

interface PermittedUsersModalProps {
  permittedUserIds: number[];
  onClose: () => void;
}

export default function PermittedUsersModal({ permittedUserIds, onClose }: PermittedUsersModalProps) {
  const { user, language } = useAppContext();
  const [scoutTargetId, setScoutTargetId] = useState<string | null>(null);
  const [scoutTargetName, setScoutTargetName] = useState<string | null>(null);
  const [showPlanUpgrade, setShowPlanUpgrade] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        const permitted = data.filter((u: User) => permittedUserIds.includes(u.id));
        setUsers(permitted);
        setLoading(false);
      })
      .catch(console.error);
  }, [permittedUserIds]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between font-bold mb-4">
          <h3 className="text-white text-lg">Permitted Users</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-slate-400">Loading...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-6 text-slate-400">No users found.</div>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {users.map(u => (
              <Link 
                key={u.id}
                to={`/profile/${u.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors"
                onClick={onClose}
              >
                <img src={u.avatar || undefined} alt={u.username} className={`w-10 h-10 rounded-full object-cover ${getAccountTypeBorderClass(u.account_type, 'border-2')}`} />
                <span className="font-medium text-white">{u.username}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {scoutTargetId && scoutTargetName && (
        <ScoutMessageModal 
          onClose={() => {
            setScoutTargetId(null);
            setScoutTargetName(null);
          }}
          targetUserIds={[scoutTargetId]}
          targetUserNames={[scoutTargetName]}
        />
      )}
      {showPlanUpgrade && (
        <PlanUpgradeModal onClose={() => setShowPlanUpgrade(false)} />
      )}
    </div>
  );
}
