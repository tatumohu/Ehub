import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, CheckCircle2, Lock, FileText, Printer, AlertCircle, History, UserCheck, Calendar, Globe, Award } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { computeContractHash } from '../utils/contractHash';

interface ElectronicSignatureModalProps {
  onClose: () => void;
  scoutId: number | string;
  contractTitle: string;
  contractType: 'nda' | 'outsourcing';
  contractBody: string;
  contractVersion?: number;
  contractId?: number;
  existingAgreement?: any;
  onAgreementSuccess?: () => void;
  senderName?: string;
  receiverName?: string;
}

export default function ElectronicSignatureModal({
  onClose,
  scoutId,
  contractTitle,
  contractType,
  contractBody,
  contractVersion = 1,
  contractId,
  existingAgreement,
  onAgreementSuccess,
  senderName = '発注側',
  receiverName = '受諾者'
}: ElectronicSignatureModalProps) {
  const { user, language } = useAppContext();
  const [signatureName, setSignatureName] = useState(user?.username || '');
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreement, setAgreement] = useState<any>(existingAgreement || null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [computedHash, setComputedHash] = useState<string>('');

  const isAgreed = !!agreement;

  useEffect(() => {
    async function calculateHash() {
      const hash = await computeContractHash(contractTitle, contractBody);
      setComputedHash(hash);
    }
    calculateHash();
  }, [contractTitle, contractBody]);

  const handleSubmitAgreement = async () => {
    if (!user || !signatureName.trim() || !isChecked) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/contracts/agreements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({
          user_id: user.id,
          contract_id: contractId || 0,
          contract_version: contractVersion,
          snapshot_title: contractTitle,
          snapshot_body: contractBody,
          target_type: 'scout',
          target_id: scoutId,
          signature_name: signatureName.trim(),
          status: 'agreed'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '電子同意処理に失敗しました。');
      } else {
        setAgreement(data);
        if (onAgreementSuccess) onAgreementSuccess();
      }
    } catch (e) {
      console.error(e);
      setError('通信エラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchAuditLogs = async () => {
    if (!agreement?.id) return;
    try {
      const res = await fetch(`/api/contracts/audit-logs?agreement_id=${agreement.id}`);
      const data = await res.json();
      setAuditLogs(data);
      setShowLogs(!showLogs);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const displayHash = agreement?.content_hash || computedHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const certIdentificationNumber = `CERT-SCOUT-${scoutId}-AGR-${agreement?.id || contractId || '101'}-V${contractVersion}`;

  const modalContent = (
    <div className="fixed inset-0 z-[130] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto print:p-0 print:static print:bg-white">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl text-slate-100 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:bg-white print:text-black">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 print:hidden">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${contractType === 'nda' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                電子署名・同意書確認書 (E-hub)
                {isAgreed && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-normal">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 同意完了
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                スカウト #{scoutId} に伴う電子契約（版 v{contractVersion}）
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAgreed && (
              <button
                onClick={handlePrint}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                title="契約書を印刷 / PDF保存"
              >
                <Printer className="w-4 h-4" />
                証明書印刷 / PDF出力
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable / Contract Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-950/30 print:bg-white print:p-8">
          
          {/* E-hub Official Execution Header Banner (Always shown when printable or agreed) */}
          <div className="p-4 bg-slate-900/90 border border-indigo-500/30 rounded-xl space-y-2 print:border-black print:bg-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 print:border-black">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-400 print:text-black" />
                <span className="font-black text-sm text-white print:text-black">E-hub 電子契約合意証明書 (Electronic Contract Certificate)</span>
              </div>
              <span className="text-[11px] font-mono text-indigo-300 print:text-slate-700 font-bold">
                識別番号: {certIdentificationNumber}
              </span>
            </div>

            {/* Requirement 28 Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 print:text-black font-mono pt-1">
              <div><span className="text-slate-400 print:text-slate-600 font-bold">① 契約書タイトル:</span> {contractTitle}</div>
              <div><span className="text-slate-400 print:text-slate-600 font-bold">③ バージョン番号:</span> v{contractVersion}</div>
              <div><span className="text-slate-400 print:text-slate-600 font-bold">④ 契約当事者(甲):</span> {senderName}</div>
              <div><span className="text-slate-400 print:text-slate-600 font-bold">④ 契約当事者(乙):</span> {receiverName}</div>
              <div><span className="text-slate-400 print:text-slate-600 font-bold">⑤ 同意したユーザー:</span> {isAgreed ? `${agreement.signature_name} (ユーザーID: ${agreement.user_id || user?.id})` : `${signatureName || user?.username} (同意準備中)`}</div>
              <div><span className="text-slate-400 print:text-slate-600 font-bold">⑥ 同意日時:</span> {isAgreed ? new Date(agreement.agreed_at || agreement.created_at).toLocaleString('ja-JP') : '同意手続き中'}</div>
              <div><span className="text-slate-400 print:text-slate-600 font-bold">⑦ 契約識別番号:</span> {certIdentificationNumber}</div>
              <div><span className="text-slate-400 print:text-slate-600 font-bold">⑨ 同意方法:</span> {agreement?.agreement_method || 'E-hub Web電子署名 (タイムスタンプ・IPログ記録済)'}</div>
              <div className="sm:col-span-2 break-all"><span className="text-slate-400 print:text-slate-600 font-bold">⑧ 契約書ハッシュ値:</span> <span className="text-amber-300 print:text-slate-800 font-mono text-[11px]">{displayHash}</span></div>
            </div>

            {/* ⑩ E-hub上で締結したことを示す記録 */}
            <div className="mt-2 p-2.5 bg-slate-950 print:bg-slate-100 rounded-lg border border-slate-800 print:border-slate-300 text-[11px] text-slate-300 print:text-slate-800 leading-relaxed">
              <span className="font-bold text-indigo-300 print:text-black block mb-0.5">⑩ E-hub 電子締結完了の公式記録:</span>
              本合意文書は、E-hubオンライン合意プラットフォーム上で当事者間において正当に電子署名・合意された真正な契約記録です。元となるデータベース上の契約書本文、ハッシュ値および同意・変更・閲覧履歴（監査ログ）は変更不可の状態で永久保持されています。
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/80 space-y-4 print:border-black print:bg-white">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center print:border-black">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white print:text-black">② 契約書全文 ({contractTitle})</h2>
                <p className="text-xs text-slate-400 print:text-slate-600">識別番号: {certIdentificationNumber} / 版数: v{contractVersion}</p>
              </div>
              <div className="text-right text-[11px] text-slate-400 print:text-slate-600">
                <div>E-hub 電子合意プラットフォーム</div>
                <div>タイムスタンプ記録対象</div>
              </div>
            </div>

            <pre className="text-xs sm:text-sm text-slate-200 print:text-black whitespace-pre-wrap font-mono leading-relaxed p-4 bg-slate-950/80 print:bg-white rounded-lg border border-slate-800/80 print:border-none overflow-x-auto">
              {contractBody}
            </pre>
          </div>

          {/* Agreement Status / Signature Box */}
          {isAgreed ? (
            <div className="p-5 bg-emerald-950/20 border border-emerald-500/40 rounded-xl space-y-3 print:border-black print:bg-white">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm print:text-black">
                <CheckCircle2 className="w-5 h-5" />
                <span>電子同意証明情報 (Agreed Certificate)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300 print:text-black font-mono">
                <div>電子署名者名: <strong className="text-white print:text-black">{agreement.signature_name}</strong></div>
                <div>同意日時: <span className="text-slate-200 print:text-black">{new Date(agreement.agreed_at || agreement.created_at).toLocaleString('ja-JP')}</span></div>
                <div>IPアドレス: <span className="text-slate-400 print:text-slate-700">{agreement.ip_address || '記録済'}</span></div>
                <div>状態: <span className="text-emerald-400 font-bold print:text-black">電子署名有効 (Agreed)</span></div>
              </div>

              <div className="pt-2 flex justify-between items-center print:hidden">
                <button
                  onClick={fetchAuditLogs}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
                >
                  <History className="w-3.5 h-3.5" />
                  {showLogs ? '監査ログを隠す' : '監査ログ・履歴を表示'}
                </button>
              </div>

              {showLogs && (
                <div className="mt-3 p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2 text-xs">
                  <span className="font-bold text-slate-300">監査ログ (Audit Log Trail)</span>
                  <div className="space-y-1">
                    {auditLogs.map((log: any) => (
                      <div key={log.id} className="text-[11px] text-slate-400 font-mono border-b border-slate-800/60 pb-1">
                        [{new Date(log.created_at).toLocaleString()}] {log.username}: {log.details} ({log.ip_address})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                <span>個人ユーザーによる電子署名と合意</span>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    氏名・電子署名名 <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={signatureName}
                    onChange={e => setSignatureName(e.target.value)}
                    placeholder="例: 山田 太郎"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    ※入力された署名名、現在のタイムスタンプ、IPアドレスが電子同意ログとして記録保存されます。
                  </p>
                </div>

                <label className="flex items-start gap-2.5 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={e => setIsChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
                  />
                  <span className="text-xs text-slate-200 leading-relaxed">
                    上記の条文および契約条件を全て確認し、内容に同意した上で電子署名を送信します。
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmitAgreement}
                  disabled={isSubmitting || !isChecked || !signatureName.trim()}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>電子署名を送信中...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>同意して電子署名を送信</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
