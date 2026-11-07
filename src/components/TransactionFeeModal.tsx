import React from 'react';
import { X, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface TransactionFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionFeeModal: React.FC<TransactionFeeModalProps> = ({ isOpen, onClose }) => {
  const { language } = useAppContext();

  if (!isOpen) return null;

  const feeItems = [
    {
      service: language === 'ja' ? 'Project契約（個人）' : 'Project Contract (Individual)',
      rate: '0%',
      badge: language === 'ja' ? '完全無料・全額受取' : 'Free (100% Payout)',
      note: language === 'ja' ? '個人ワーカーは契約報酬の100%をそのまま受取可能です。' : 'Individual receives 100% of agreed reward.'
    },
    {
      service: language === 'ja' ? 'Project契約（法人・自治体）' : 'Project Contract (Corporate/Gov)',
      rate: '5%',
      badge: language === 'ja' ? '契約成立時課金' : 'On Contract Completion',
      note: language === 'ja' ? '成果・雇用契約が成立した際、発注側（法人・自治体）に5%の成功報酬が加算されます。' : 'Corporate/Gov pays 5% platform success fee on completed contract.'
    },
    {
      service: language === 'ja' ? 'Store販売' : 'Store Sales',
      rate: '10%',
      badge: language === 'ja' ? '成果物・素材・プロンプト' : 'Digital Assets & Store',
      note: language === 'ja' ? '成果物やデジタルの販売成立時に10%の手数料が適用されます。' : '10% platform fee on digital product sales.'
    },
    {
      service: language === 'ja' ? 'Buyout成立' : 'Buyout Transactions',
      rate: '5%',
      badge: language === 'ja' ? '事業・Idea買収成立時' : 'Idea & Project Buyout',
      note: language === 'ja' ? 'アイデアや事業の買収（Buyout）合意成立時に5%の手数料が適用されます。' : '5% platform fee on successful buyout.'
    }
  ];

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white dark:bg-[#202123] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl relative transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900 dark:text-white">
                {language === 'ja' ? 'E-hub 手数料体系のご案内' : 'E-hub Transaction Fee Details'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ja' ? '透明性の高いシンプルな料金設定' : 'Transparent and simple platform fee structure'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Table */}
        <div className="p-6 space-y-4">
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">{language === 'ja' ? 'サービス' : 'Service'}</th>
                  <th className="py-3 px-4 text-right">{language === 'ja' ? 'E-hub手数料' : 'Platform Fee'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {feeItems.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {item.service}
                        {item.rate === '0%' && (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/40">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.note}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right align-middle">
                      <span className={`text-base font-bold ${item.rate === '0%' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {item.rate}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mandatory Footnote specified in item 34 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {language === 'ja' 
                ? '決済処理手数料、税その他の費用が別途発生する場合があります。' 
                : 'Payment processing fees, applicable taxes, and other standard charges may apply separately.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 transition-colors shadow-sm"
          >
            {language === 'ja' ? '閉じる' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
