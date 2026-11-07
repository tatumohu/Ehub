import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { jsPDF } from 'jspdf';

export default function PurchaseHistory({ isEmbedded }: { isEmbedded?: boolean }) {
  const { user, isAuthLoaded, language } = useAppContext();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthLoaded) return;
    if (!user) {
      setLoading(false);
      return;
    }

    fetch(`/api/purchases?user_id=${encodeURIComponent(user.id)}`)
      .then(res => res.json())
      .then(data => {
        setPurchases(data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, [user, isAuthLoaded]);

  const generateReceipt = (purchase: any) => {
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text('RECEIPT', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    // Receipt Details
    const date = new Date((purchase.created_at || '') + (!(purchase.created_at || '').includes('Z') ? 'Z' : '')).toLocaleDateString();
    doc.text(`Receipt Date: ${date}`, 20, 40);
    doc.text(`Receipt Number: ${purchase.stripe_session_id.substring(0, 14)}...`, 20, 50);
    doc.text(`Billed To: ${user?.username}`, 20, 60);

    // Separator line
    doc.setLineWidth(0.5);
    doc.line(20, 70, 190, 70);

    // Table Header
    doc.setFont("helvetica", "bold");
    doc.text('Item Description', 20, 80);
    doc.text('Amount (JPY)', 160, 80);

    doc.line(20, 85, 190, 85);

    // Item details
    doc.setFont("helvetica", "normal");
    const itemName = purchase.project_completed_title || purchase.project_title;
    
    // Auto wrap text for description
    const splitTitle = doc.splitTextToSize(`Project: ${itemName}`, 130);
    doc.text(splitTitle, 20, 95);
    
    let yPos = 95 + (splitTitle.length * 6);
    
    const splitTier = doc.splitTextToSize(`Return: ${purchase.tier_description}`, 130);
    doc.text(splitTier, 20, yPos);
    
    // Amount
    doc.text(`¥${purchase.amount.toLocaleString()}`, 160, 95);

    yPos += (splitTier.length * 6) + 10;
    
    doc.line(20, yPos, 190, yPos);
    yPos += 10;
    
    doc.setFont("helvetica", "bold");
    doc.text('Total:', 130, yPos);
    doc.text(`¥${purchase.amount.toLocaleString()}`, 160, yPos);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text('Thank you for your support!', 105, yPos + 30, { align: 'center' });

    doc.save(`Receipt_${purchase.stripe_session_id.substring(0, 8)}.pdf`);
  };

  if (!isAuthLoaded || loading) {
    return <div className="p-8 text-slate-900 dark:text-white">{language === 'ja' ? '読み込み中...' : 'Loading...'}</div>;
  }

  if (!user) {
    return <div className="p-8 text-slate-900 dark:text-white">{language === 'ja' ? '購入履歴を表示するにはログインしてください。' : 'Please log in to view purchase history.'}</div>;
  }

  return (
    <div className={isEmbedded ? "" : "max-w-5xl mx-auto p-4 md:p-8"}>
      {!isEmbedded && <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{language === 'ja' ? '購入履歴' : 'Purchase History'}</h1>}
      
      {purchases.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          {language === 'ja' ? '購入履歴がありません。' : 'No purchases found.'}
        </div>
      ) : (
        <div className="space-y-4">
          {purchases.map(purchase => (
            <div key={purchase.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-750 p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300 justify-between items-center">
                <div className="flex gap-8">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">{language === 'ja' ? '注文日' : 'Order Placed'}</div>
                    <div className="font-medium text-slate-900 dark:text-white">{new Date((purchase.created_at || '') + (!(purchase.created_at || '').includes('Z') ? 'Z' : '')).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">{language === 'ja' ? '合計' : 'Total'}</div>
                    <div className="font-medium text-slate-900 dark:text-white">¥{purchase.amount.toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="text-right">
                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">{language === 'ja' ? '注文番号' : 'Order #'}</div>
                    <div className="font-mono text-slate-700 dark:text-slate-300">{purchase.stripe_session_id.substring(0, 14)}...</div>
                  </div>
                  <button 
                    onClick={() => generateReceipt(purchase)}
                    className="text-xs px-3 py-1.5 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-800 dark:text-white transition-colors whitespace-nowrap"
                  >
                    {language === 'ja' ? '領収書 (PDF)' : 'Receipt (PDF)'}
                  </button>
                </div>
              </div>
              
              <div className="p-4 md:p-6 flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-32 h-24 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden shrink-0">
                  {(purchase.project_image || purchase.project_images) ? (
                    <img 
                      src={purchase.project_image || JSON.parse(purchase.project_images || '[]')[0]} 
                      alt="Project" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">{language === 'ja' ? '画像なし' : 'No Image'}</div>
                  )}
                </div>
                
                <div className="flex-grow flex flex-col justify-between">
                  <div>
                    <Link to={`/${purchase.item_type === "idea" ? "idea" : "completed"}/${purchase.project_id}`} state={{ from: isEmbedded ? "/completed?tab=purchase" : "/purchases" }} className="text-lg font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      {purchase.project_completed_title || purchase.project_title}
                    </Link>
                    <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm line-clamp-2">
                      {language === 'ja' ? 'リターン: ' : 'Return: '} {purchase.tier_description}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link to={`/${purchase.item_type === "idea" ? "idea" : "completed"}/${purchase.project_id}`} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors inline-block">
                      {language === 'ja' ? 'もう一度購入する / 詳細を見る' : 'Buy Again / View Details'}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
