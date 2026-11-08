import { Link, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import CompletedProjects from './CompletedProjects';
import ListView from './ListView';
export default function StoreHub() {
  const [params] = useSearchParams();
  const { language } = useAppContext();
  const buyout=params.get('tab')==='buyout';
  return <section data-section="store" className="min-w-0">
    <header className="max-w-7xl mx-auto px-4 pt-5">
      <h1 className="text-2xl font-bold">Store</h1>
      <nav aria-label="Store categories" className="flex flex-wrap gap-2 mt-4 mb-4">
        <Link to="/store" aria-current={!buyout?'page':undefined} className={`rounded-full px-4 py-2 text-sm font-semibold ${!buyout?'bg-slate-900 text-white':'bg-white border border-slate-200'}`}>{language==='ja'?'作品・商品':'Works & products'}</Link>
        <Link to="/store?tab=buyout" aria-current={buyout?'page':undefined} className={`rounded-full px-4 py-2 text-sm font-semibold ${buyout?'bg-slate-900 text-white':'bg-white border border-slate-200'}`}>Buyout</Link>
      </nav>
    </header>
    {buyout?<ListView mode="buyout"/>:<CompletedProjects/>}
  </section>;
}
