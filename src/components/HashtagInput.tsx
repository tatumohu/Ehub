import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const INDUSTRIES_JA = [
  "水産・農林業", "鉱業", "建設業", "食料品", "繊維製品", "パルプ・紙", "化学", "医薬品",
  "石油・石炭製品", "ゴム製品", "ガラス・土石製品", "鉄鋼", "非鉄金属", "金属製品", "機械",
  "電気機器", "輸送用機器", "精密機器", "その他製品", "電気・ガス業", "陸運業", "海運業",
  "空運業", "倉庫・運輸関連業", "情報・通信", "卸売業", "小売業", "銀行業", "証券業",
  "保険業", "その他金融業", "不動産業", "サービス業"
];

export const INDUSTRIES_EN = [
  "Agriculture & Forestry", "Mining", "Construction", "Foods", "Textiles", "Pulp & Paper", "Chemicals", "Pharmaceuticals",
  "Oil & Coal", "Rubber", "Glass & Ceramics", "Iron & Steel", "Nonferrous Metals", "Metal Products", "Machinery",
  "Electric Appliances", "Transportation Eq.", "Precision Inst.", "Other Products", "Electric & Gas", "Land Transport", "Marine Transport",
  "Air Transport", "Warehousing", "Info & Comm", "Wholesale", "Retail", "Banks", "Securities",
  "Insurance", "Other Finance", "Real Estate", "Services"
];

function IndustryModal({ onClose, onConfirm, language }: { onClose: () => void, onConfirm: (selected: string[]) => void, language: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const industries = language === 'en' ? INDUSTRIES_EN : INDUSTRIES_JA;

  const toggleSelection = (industry: string) => {
    setSelected(prev => 
      prev.includes(industry) 
        ? prev.filter(i => i !== industry)
        : [...prev, industry]
    );
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80dvh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{language === 'en' ? 'Select Industry' : '業種を選択'}</h3>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
            {industries.map(industry => {
              const isSelected = selected.includes(industry);
              return (
                <button
                  type="button"
                  key={industry}
                  onClick={() => toggleSelection(industry)}
                  className={`p-2.5 text-xs md:text-sm rounded-xl border text-center transition-all ${
                    isSelected 
                      ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-sm' 
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {industry}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex justify-end shrink-0">
          <button 
            type="button"
            onClick={() => onConfirm(selected)}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-sm"
          >
            {language === 'en' ? 'Next' : '次へ'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export default function HashtagInput({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isFocused, setIsFocused] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { language } = useAppContext();

  // Reflow long tags when the viewport is resized as well as when typing.
  useEffect(() => {
    const element=inputRef.current;if(!element)return;
    const resize=()=>{element.style.height='auto';element.style.height=`${element.scrollHeight}px`};
    resize();let width=element.getBoundingClientRect().width;
    const observer=new ResizeObserver(()=>{const next=element.getBoundingClientRect().width;if(Math.abs(next-width)>.5){width=next;resize()}});
    observer.observe(element);return()=>observer.disconnect();
  }, [value]);

  const handleFocus = () => {
    setIsFocused(true);
    if (value === '') {
      onChange('#');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value.trim() === '#') {
      onChange(''); 
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let val = e.target.value;
    // Prevent newlines in hashtags, convert them to spaces if they occur (e.g. paste or enter)
    val = val.replace(/\n/g, ' ');

    if (val !== '' && !val.includes('#')) {
       val = '#' + val;
    }
    onChange(val);
  };

  const handleConfirmModal = (selected: string[]) => {
    setIsModalOpen(false);
    let newValue = (value || '').trim();
    if (newValue === '#') newValue = '';
    
    const toAppend = selected.map(s => '#' + s).join(' ');
    if (toAppend) {
      if (newValue && !newValue.endsWith(' ')) {
        newValue += ' ';
      }
      newValue += toAppend;
    } else if (!newValue) {
      newValue = '#';
    }
    
    if (newValue.length > 0 && !newValue.startsWith('#')) {
      newValue = '#' + newValue;
    }
    onChange(newValue);
  };

  return (
    <>
      <div 
        className={`w-full relative flex items-stretch rounded-xl border mt-4 overflow-hidden transition-all duration-200 ${isFocused ? 'bg-white dark:bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/50' : 'bg-white/80 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700/50 hover:border-slate-400 dark:hover:bg-slate-900'}`}
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="#hashtag..."
          rows={1}
          className={`flex-1 bg-transparent px-4 py-3 outline-none min-w-0 resize-none overflow-hidden ${value && value !== '#' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500'}`}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-3 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors border-l border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center shrink-0"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {isModalOpen && (
        <IndustryModal 
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmModal}
          language={language}
        />
      )}
    </>
  );
}
