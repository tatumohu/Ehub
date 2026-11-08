import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import SimpleStageIndicator from './SimpleStageIndicator';
import { useAppContext } from '../context/AppContext';

interface StageEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: number;
  itemType: 'idea' | 'project';
  userId: number;
  minStage: number;
  currentEvaluatedStage: number | null;
  onSuccess: () => void;
}

export default function StageEvaluationModal({
  isOpen,
  onClose,
  itemId,
  itemType,
  userId,
  minStage,
  currentEvaluatedStage,
  onSuccess
}: StageEvaluationModalProps) {
  const { language } = useAppContext();
  // If user previously evaluated, use that, otherwise default to minStage.
  const safeMinStage = minStage || 1;
  const [selectedStage, setSelectedStage] = useState<number>(Math.max(currentEvaluatedStage || safeMinStage, safeMinStage));
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (stageToSubmit: number) => {
    if (stageToSubmit < safeMinStage) return;
    setSelectedStage(stageToSubmit);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/items/${itemType}/${itemId}/stage_evaluation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, stage: stageToSubmit })
      });
      if (res.ok) {
        onSuccess();
        setTimeout(() => onClose(), 500); // Give a small delay to see the selection
      } else {
        console.error('Failed to submit evaluation');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60  backdrop-blur-sm" onClick={onClose}>
      <div data-ui-dialog="project-stage" role="dialog" aria-modal="true" className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900  flex items-center gap-2">
            {language === 'ja' ? 'ステージを評価' : 'Evaluate Stage'}
            {isSubmitting && <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />}
          </h2>
          <button aria-label="Close stage" onClick={onClose} disabled={isSubmitting} className="p-2 text-slate-600 hover:text-slate-700  rounded-full hover:bg-slate-100  transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center mb-4">
          <SimpleStageIndicator
            currentStage={selectedStage}
            interactive={!isSubmitting}
            onSelect={(st) => {
              if (st >= safeMinStage && !isSubmitting) {
                handleSubmit(st);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
