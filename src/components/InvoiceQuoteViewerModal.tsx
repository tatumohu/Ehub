import React from 'react';
import { X, Printer, Download, CheckCircle2, Building, FileText, Calendar, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export interface QuoteData {
  quoteNumber: string;
  issueDate: string;
  validUntil: string;
  recipient: {
    orgName: string;
    department?: string;
    contactName: string;
  };
  issuer: {
    name: string;
    invoiceRegistrationNumber: string;
    address: string;
    email: string;
    phone: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate: string;
  }>;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  billingCycle: string;
  paymentTerms: string;
  bankInfo: {
    bankName: string;
    branchName: string;
    accountType: string;
    accountNumber: string;
    accountHolder: string;
  };
  documentType?: 'quote' | 'invoice';
}

interface InvoiceQuoteViewerModalProps {
  data: QuoteData;
  onClose: () => void;
}

export const InvoiceQuoteViewerModal: React.FC<InvoiceQuoteViewerModalProps> = ({ data, onClose }) => {
  const { language } = useAppContext();
  const isQuote = (data.documentType || 'quote') === 'quote';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-3xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-8 print:shadow-none print:m-0 print:w-full print:rounded-none">
        
        {/* Header Bar - Hidden on Print */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-base">
              {isQuote ? (language === 'ja' ? 'E-hub 電子見積書プレビュー' : 'E-hub Official Quote Preview') : (language === 'ja' ? 'E-hub 請求書プレビュー' : 'E-hub Invoice Preview')}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/30 text-purple-300 font-mono">
              {data.quoteNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
            >
              <Printer className="w-4 h-4" />
              <span>{language === 'ja' ? '印刷 / PDF保存' : 'Print / Save PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-12 space-y-8 bg-white print:p-6 text-slate-800">
          {/* Document Title Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                {isQuote ? '御 見 積 書' : 'ご 請 求 書'}
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-mono">Document No: {data.quoteNumber}</p>
            </div>
            <div className="text-right text-xs text-slate-600 space-y-1">
              <div><span className="font-semibold">{isQuote ? '発行日:' : '請求日:'}</span> {data.issueDate}</div>
              {isQuote && <div><span className="font-semibold">有効期限:</span> {data.validUntil}</div>}
            </div>
          </div>

          {/* Recipient & Issuer Split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
            {/* Recipient */}
            <div className="space-y-2 border-b sm:border-b-0 pb-4 sm:pb-0">
              <div className="text-lg font-bold text-slate-900 border-b border-slate-300 pb-1.5">
                {data.recipient.orgName} 御中
              </div>
              {data.recipient.department && (
                <div className="text-slate-700 font-medium">{data.recipient.department}</div>
              )}
              <div className="text-slate-700 font-medium">ご担当: {data.recipient.contactName} 様</div>
              <p className="text-xs text-slate-600 pt-2 leading-relaxed">
                {isQuote 
                  ? '平素は格別のご高配を賜り、厚く御礼申し上げます。下記の通りお見積り申し上げます。' 
                  : '平素は格別のご高配を賜り、厚く御礼申し上げます。下記の通りご請求申し上げます。'}
              </p>
            </div>

            {/* Issuer */}
            <div className="space-y-1.5 text-right sm:text-right relative">
              {/* Virtual Stamp */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-red-500/70 flex items-center justify-center text-red-500/70 font-bold text-[10px] transform rotate-[-12deg] pointer-events-none select-none">
                E-hub印
              </div>

              <div className="font-bold text-slate-900">{data.issuer.name}</div>
              <div className="text-xs text-slate-600">適格請求書発行事業者登録番号:</div>
              <div className="text-xs font-mono font-bold text-slate-800">{data.issuer.invoiceRegistrationNumber}</div>
              <div className="text-xs text-slate-600">{data.issuer.address}</div>
              <div className="text-xs text-slate-600">Email: {data.issuer.email}</div>
              <div className="text-xs text-slate-600">TEL: {data.issuer.phone}</div>
            </div>
          </div>

          {/* Grand Total Box */}
          <div className="p-4 rounded-xl bg-slate-50 border-2 border-slate-900 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-700">
              {isQuote ? '御見積金額（税込）' : 'ご請求金額（税込）'}
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
              ¥{data.totalAmount.toLocaleString()} -
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b-2 border-slate-800 bg-slate-100 text-slate-800">
                  <th className="py-2.5 px-3 font-bold">品名 / サービス内容</th>
                  <th className="py-2.5 px-3 font-bold text-center w-16">数量</th>
                  <th className="py-2.5 px-3 font-bold text-right w-28">単価（税抜）</th>
                  <th className="py-2.5 px-3 font-bold text-right w-28">金額（税抜）</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">税率: {item.taxRate}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">{item.quantity}</td>
                    <td className="py-3 px-3 text-right font-mono">¥{item.unitPrice.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold">¥{item.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tax Breakdown */}
          <div className="flex justify-end pt-2">
            <div className="w-full sm:w-64 space-y-1.5 text-xs sm:text-sm border-t border-slate-300 pt-3">
              <div className="flex justify-between text-slate-600">
                <span>小計（税抜）:</span>
                <span className="font-mono">¥{data.netAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>消費税額（10%）:</span>
                <span className="font-mono">¥{data.taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-900 pt-1.5">
                <span>合計（税込）:</span>
                <span className="font-mono">¥{data.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payment & Bank Terms */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>お支払い条件・振込先口座情報（官公庁公金支出・口座振込対応）</span>
            </div>
            <div className="text-slate-700">
              <span className="font-semibold">お支払い条件:</span> {data.paymentTerms}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200 text-slate-600">
              <div><span className="font-semibold">金融機関:</span> {data.bankInfo.bankName} {data.bankInfo.branchName}</div>
              <div><span className="font-semibold">預金種目:</span> {data.bankInfo.accountType} {data.bankInfo.accountNumber}</div>
              <div className="col-span-1 sm:col-span-2"><span className="font-semibold">口座名義:</span> {data.bankInfo.accountHolder}</div>
            </div>
          </div>

          {/* Remarks */}
          <div className="text-[11px] text-slate-500 space-y-1">
            <p>※ 本見積書・請求書は電子的に発行された公式文書です。官公庁の会計基準・公金支出・請求書払い（翌月末振込）に対応しております。</p>
            <p>※ 年間契約、複数部署契約、包括連携協定等に応じた契約書・誓約書等のカスタマイズも承っております。</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
          >
            {language === 'ja' ? '閉じる' : 'Close'}
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow transition"
          >
            <Printer className="w-4 h-4" />
            <span>{language === 'ja' ? '印刷 / PDFとして保存' : 'Print / Export to PDF'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
