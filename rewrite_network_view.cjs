const fs = require('fs');
let content = fs.readFileSync('src/pages/NetworkView.tsx', 'utf8');

const networkCardReplacement = `interface NetworkCardProps {
  node: NetworkNode;
  isCurrent: boolean;
  onClick: () => void;
  onEditClick: (e: React.MouseEvent) => void;
}

const NetworkCard: React.FC<NetworkCardProps> = ({ node, isCurrent, onClick, onEditClick }) => {
  return (
    <div className="flex flex-col gap-4">
      <div 
        onClick={onClick}
        className={\`group relative w-[280px] h-[160px] rounded-[24px] overflow-hidden cursor-pointer transition-all duration-300 shadow-2xl \${
          isCurrent ? 'ring-2 ring-blue-500 ring-offset-4 ring-offset-[#0B1120] shadow-[0_0_30px_rgba(59,130,246,0.6)]' : 'border border-slate-700/50 hover:border-slate-500/50'
        }\`}
      >
        {node.image ? (
          <img 
            src={node.image} 
            alt={node.title} 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
            <span className="text-slate-400 font-bold opacity-50 text-xl">{node.title.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
        <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col justify-end h-full pointer-events-none">
          <h3 className="text-white font-bold text-xl line-clamp-1 leading-snug">
            {node.title}
          </h3>
        </div>
      </div>
      
      <div className="px-1 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <img src={node.author_avatar || 'https://via.placeholder.com/40'} alt={node.author_name} className="w-8 h-8 rounded-full bg-slate-800 object-cover" />
          <span className="text-slate-200 text-sm font-bold truncate">
            {node.author_name}
          </span>
          {node.type === 'idea' && (
            <button 
              onClick={onEditClick}
              className="ml-auto bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-4 py-1.5 rounded-full text-xs font-bold transition-colors shadow-sm active:scale-95"
            >
              編集提案
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-5 text-slate-400">
          <div className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            <span className="text-sm font-medium">{(node as any).likes_count || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            <span className="text-sm font-medium">{(node as any).comments_count || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
            <span className="text-sm font-medium">{(node as any).archives_count || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}`;

content = content.replace(/interface NetworkCardProps {[\s\S]*?}\);\n}/, networkCardReplacement);

fs.writeFileSync('src/pages/NetworkView.tsx', content);
