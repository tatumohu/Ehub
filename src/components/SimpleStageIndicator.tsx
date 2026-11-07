import React from 'react';

export const STAGES = [
  'SQUARE',
  'CREASE',
  'FOLDING',
  'SHAPE',
  'DETAIL',
  'FLIGHT'
];

interface SimpleStageIndicatorProps {
  currentStage: number;
  onSelect?: (stage: number) => void;
  interactive?: boolean;
}

export default function SimpleStageIndicator({ currentStage, onSelect, interactive = false }: SimpleStageIndicatorProps) {
  // Ensure stage is between 1 and 6 safely
  const safeStage = Math.max(1, Math.min(6, currentStage || 1));
  const currentStageName = STAGES[safeStage - 1];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5">
      {/* 6 Squares Progress Bar */}
      <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-900 border border-slate-800/80 p-1.5 rounded-xl">
        {[1, 2, 3, 4, 5, 6].map((st) => {
          const isActive = st <= safeStage;
          const isCurrent = st === safeStage;
          
          let bgColor = 'bg-slate-800'; // inactive
          if (isCurrent) bgColor = 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.3)]';
          else if (isActive) bgColor = 'bg-emerald-800/80';

          return (
            <div
              key={`stage-indicator-${st}`}
              
              onClick={() => {
                if (interactive && onSelect) onSelect(st);
              }}
              
              className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg transition-all duration-300 ${bgColor} ${interactive ? 'cursor-pointer hover:bg-emerald-500' : 'cursor-default'}`}
              aria-label={`Stage ${st}`}
            />
          );
        })}
      </div>
      
      {/* Stage numbers and labels */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <div className="flex flex-col items-center justify-center font-black min-w-[1.5rem]">
          <span className="text-lg sm:text-xl text-slate-900 dark:text-white leading-none tracking-tight">{safeStage}</span>
          <div className="w-full h-[2px] bg-slate-300 dark:bg-slate-700/60 my-0.5 sm:my-1"></div>
          <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-none">6</span>
        </div>
        
        <div className="flex flex-col">
          <span className="text-[9px] sm:text-[10px] font-black tracking-[0.2em] text-slate-500 dark:text-slate-400 uppercase mb-0.5">
            Journey Stage
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wide leading-none truncate max-w-[120px] sm:max-w-none">
            {currentStageName}
          </span>
        </div>
      </div>
    </div>
  );
}
