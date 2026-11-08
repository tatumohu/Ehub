import { useState } from 'react';
import PlanUpgradeModal from '../components/PlanUpgradeModal';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import ListView from './ListView';

export default function ProjectHub() {
  const [params] = useSearchParams();
  const { language, user } = useAppContext();
  const [showUpgrade,setShowUpgrade]=useState(false);
  const isOrg=!!user&&['corporate','organization','municipality'].includes(user.account_type||'');
  const type = ['recruitment', 'offer'].includes(params.get('type') || '') ? params.get('type')! : 'project-hub';
  return <section data-section="project" className="min-w-0">
    <header className="max-w-7xl mx-auto px-4 py-5">
      <h1 className="text-2xl font-bold">Project</h1>
      <p className="text-sm text-slate-500 mt-1">{language === 'ja' ? '仲間の募集と提案を、ひとつの場所で。' : 'Recruit people and exchange proposals in one place.'}</p>
      <div className="flex flex-wrap gap-2 mt-4">
        <Link to="/create?type=recruitment" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white">{language === 'ja' ? '募集を作成' : 'Create recruitment'}</Link>
        <Link to="/create?type=offer" className="rounded-full border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700">{language === 'ja' ? '提案を作成' : 'Create proposal'}</Link>
        {isOrg&&<button onClick={()=>{if(['light','basic'].includes(user?.org_plan||'light'))setShowUpgrade(true);else window.dispatchEvent(new Event('open-scout-chat'))}} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold">{language==='ja'?'AIスカウト':'AI Scout'}</button>}
      </div>
      <nav aria-label="Project filters" className="flex flex-wrap gap-2 mt-4">
        { [['project-hub', language === 'ja' ? 'すべて' : 'All'], ['recruitment', language === 'ja' ? '募集' : 'Recruitment'], ['offer', language === 'ja' ? '提案' : 'Proposals']].map(([key,label]) => <Link key={key} aria-current={type===key?'page':undefined} to={key==='project-hub'?'/projects':`/projects?type=${key}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${type===key?'bg-blue-600 text-white':'bg-white border border-slate-200'}`}>{label}</Link>)}
      </nav>
    </header>
    <ListView mode={type} />
    {showUpgrade&&<PlanUpgradeModal onClose={()=>setShowUpgrade(false)}/>}
  </section>;
}
