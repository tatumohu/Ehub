import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { safeFetchJson } from '../lib/api';

export default function Cart({ isEmbedded }: { isEmbedded?: boolean }) {
  const { user, isAuthLoaded } = useAppContext();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCart = () => {
    if (!user) return;
    safeFetchJson(`/api/cart?user_id=${encodeURIComponent(user.id)}`, undefined, [])
      .then(data => {
        setCartItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isAuthLoaded) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchCart();
  }, [user, isAuthLoaded]);

  const removeFromCart = async (projectId: number) => {
    if (!user) return;
    try {
      await fetch(`/api/cart/${projectId}?user_id=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      setCartItems(prev => prev.filter(item => item.project_id !== projectId));
    } catch (e) {
      console.error(e);
    }
  };

  if (!isAuthLoaded || loading) {
    return <div className="p-8 text-slate-900 dark:text-white">Loading...</div>;
  }

  if (!user) {
    return <div className="p-8 text-slate-900 dark:text-white">Please log in to view your cart.</div>;
  }

  return (
    <div className={isEmbedded ? "" : "max-w-5xl mx-auto p-4 md:p-8"}>
      {!isEmbedded && (
        <div className="flex items-center gap-3 mb-6">
          <ShoppingCart className="w-8 h-8 text-slate-900 dark:text-white" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Shopping Cart</h1>
        </div>
      )}
      
      {cartItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          Your cart is empty.
        </div>
      ) : (
        <div className="space-y-4">
          {cartItems.map(item => (
            <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col sm:flex-row p-4 gap-4 items-center">
              <Link to={`/completed/${item.project_id}`} state={{ from: isEmbedded ? '/completed?tab=cart' : '/cart' }} className="w-full sm:w-48 h-32 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden shrink-0 block">
                {(item.project_image || item.project_images) ? (
                  <img 
                    src={item.project_image || JSON.parse(item.project_images || '[]')[0]} 
                    alt="Project" 
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
                )}
              </Link>
              
              <div className="flex-grow flex flex-col justify-between self-stretch">
                <div>
                  <Link to={`/completed/${item.project_id}`} state={{ from: isEmbedded ? '/completed?tab=cart' : '/cart' }} className="text-xl font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    {item.project_completed_title || item.project_title}
                  </Link>
                  <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm line-clamp-2">
                    {item.completed_description || item.project_description || 'No description provided.'}
                  </p>
                </div>
                <div className="mt-4 flex gap-3">
                  <Link 
                    to={`/completed/${item.project_id}`}
                    state={{ from: isEmbedded ? '/completed?tab=cart' : '/cart' }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    View Details & Support
                  </Link>
                  <button
                    onClick={() => removeFromCart(item.project_id)}
                    className="p-2 text-slate-500 hover:text-red-500 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title="Remove from Cart"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
