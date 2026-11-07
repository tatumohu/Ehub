import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, X, GitBranch, Plus } from 'lucide-react';
import * as d3 from 'd3';
import { useAppContext } from '../context/AppContext';
import { getAccountTypeBorderClass } from '../utils/avatar';

interface NetworkNodeVersion {
  id: number;
  version: number;
  title: string;
  content?: string;
  description?: string;
  image?: string;
  author_id: number;
  author_name: string;
  author_avatar?: string;
  author_account_type?: string;
  account_type?: string;
  type: string;
  created_at?: string;
  status?: string;
}

interface NetworkNode {
  id: number;
  type: 'idea' | 'project';
  title: string;
  author_name: string;
  author_avatar: string;
  author_account_type?: string;
  account_type?: string;
  image?: string;
  content?: string;
  version?: number;
  versions?: NetworkNodeVersion[];
  children: NetworkNode[];
}

export default function NetworkView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'idea';
  const navigate = useNavigate();
  
  const [treeData, setTreeData] = useState<NetworkNode | null>(null);
  const [loading, setLoading] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const nodes = useMemo(() => {
    if (!treeData) return [];
    try {
      return d3.hierarchy<NetworkNode>(treeData).descendants();
    } catch {
      return [];
    }
  }, [treeData]);

  const depthGroups = useMemo(() => {
    const groups: { [key: string]: d3.HierarchyNode<NetworkNode>[] } = {};
    nodes.forEach(node => {
      const depth = node.depth.toString();
      if (!groups[depth]) groups[depth] = [];
      groups[depth].push(node);
    });
    return groups;
  }, [nodes]);

  const { user } = useAppContext();

  useEffect(() => {
    const fetchNetwork = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/network/${id}?type=${type}${user ? `&user_id=${user.id}` : ''}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        
        if (data && !data.error) {
          setTreeData(data);
        } else {
          console.error('API error:', data?.error);
          setTreeData(null);
        }
      } catch (e) {
        console.error('Failed to fetch network:', e);
        setTreeData(null);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchNetwork();
  }, [id, type, user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B1120]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 md:p-8 animate-fade-in"
      onClick={() => navigate(-1)}
    >
      <div 
        className="relative w-full max-w-6xl h-[88vh] bg-[#0B1120] border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-colors border border-slate-700 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>戻る</span>
            </button>
            
            <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg pl-2 border-l border-slate-700">
              <GitBranch className="w-5 h-5 text-indigo-400" />
              <span>ツリー表示</span>
            </div>
          </div>

          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Canvas */}
        <div 
          ref={containerRef} 
          className="flex-1 relative overflow-hidden bg-[#0B1120] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(30,58,138,0.15),rgba(255,255,255,0))]"
        >
          <div className="w-full h-full overflow-x-auto p-8 md:p-12">
            <div className="flex gap-10 min-w-max pb-32 items-start">
              {Object.entries(depthGroups).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([depth, group], i) => {
                const sortedNodes = [...(group as d3.HierarchyNode<NetworkNode>[])].sort((a, b) => (a.data.id || 0) - (b.data.id || 0));

                return (
                  <div key={depth} className="flex items-start gap-10">
                    {i > 0 && (
                      <div className="flex flex-col items-center justify-center pt-24 text-slate-500">
                        <span className="text-lg font-bold tracking-widest leading-none">&gt;&gt;</span>
                        <span className="text-[10px] font-bold mt-1">NEXT</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-6 pt-2 pb-8 relative z-10">
                      {sortedNodes.map(hierarchyNode => {
                        const versionsToRender = (hierarchyNode.data.versions && hierarchyNode.data.versions.length > 0)
                          ? hierarchyNode.data.versions
                          : [{
                              id: hierarchyNode.data.id,
                              version: hierarchyNode.data.version || 1,
                              title: hierarchyNode.data.title,
                              content: hierarchyNode.data.content,
                              image: hierarchyNode.data.image,
                              author_id: 0,
                              author_name: hierarchyNode.data.author_name,
                              author_avatar: hierarchyNode.data.author_avatar,
                              type: hierarchyNode.data.type
                            }];

                        return (
                          <div key={`${hierarchyNode.data.type}-${hierarchyNode.data.id}-${hierarchyNode.depth}`} className="flex flex-col gap-3">
                            {versionsToRender.map((v, vIdx) => (
                              <React.Fragment key={`v-${v.id}-${v.version}-${vIdx}`}>
                                {vIdx > 0 && (
                                  <div className="flex items-center justify-center my-0.5">
                                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold shadow-sm">
                                      <span>↓</span>
                                      <span>編集承認 (v{v.version})</span>
                                    </div>
                                  </div>
                                )}
                                <div className="transition-transform hover:-translate-y-1">
                                  <NetworkCard 
                                    node={v} 
                                    isCurrent={v.id === parseInt(id!) && v.type === type && (v.version === hierarchyNode.data.version || vIdx === versionsToRender.length - 1)}
                                    isMember={Boolean((treeData as any)?.is_member)}
                                    onClick={() => {
                                      if (v.type === 'idea') {
                                        navigate(`/create?quoteId=${v.id}&quoteType=${v.type}&editMode=true`);
                                      } else {
                                        navigate(`/${v.type}/${v.id}?from=network`);
                                      }
                                    }}
                                    onEditClick={(e) => { e.stopPropagation(); navigate(`/create?quoteId=${v.id}&quoteType=${v.type}&editMode=true`); }}
                                  />
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {Boolean((treeData as any)?.is_member) && (
                <div className="flex items-start gap-10">
                  <div className="flex flex-col items-center justify-center pt-24 text-slate-500">
                    <span className="text-lg font-bold tracking-widest leading-none">&gt;&gt;</span>
                    <span className="text-[10px] font-bold mt-1">NEXT</span>
                  </div>
                  <div className="pt-2">
                    <div 
                      onClick={() => {
                        const sortedEntries = Object.entries(depthGroups).sort(([a], [b]) => parseInt(a) - parseInt(b));
                        const lastGroup = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1][1] : [];
                        const lastNode = lastGroup.length > 0 ? lastGroup[lastGroup.length - 1].data : treeData;
                        if (lastNode) {
                          navigate(`/create?quoteId=${lastNode.id}&quoteType=${lastNode.type}&from_tree=1`);
                        }
                      }}
                      className="w-[190px] h-[240px] border-2 border-dashed border-blue-500/40 hover:border-blue-400 bg-slate-900/40 hover:bg-slate-900/70 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all group/add hover:scale-[1.02] shadow-xl"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mb-3 group-hover/add:scale-110 group-hover/add:bg-blue-500 group-hover/add:text-white transition-all shadow-lg shadow-blue-500/10">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-blue-400 font-bold text-sm mb-1 flex items-center gap-1 group-hover/add:text-blue-300">
                        + 新しいIdeaを提案
                      </span>
                      <p className="text-[10px] text-slate-400 max-w-[140px] leading-relaxed">
                        このノードから新しいIdeaを分岐提案します
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface NetworkCardProps {
  node: NetworkNode | NetworkNodeVersion;
  isCurrent: boolean;
  isMember: boolean;
  onClick: () => void;
  onEditClick: (e: React.MouseEvent) => void;
}

const NetworkCard: React.FC<NetworkCardProps> = ({ node, isCurrent, isMember, onClick, onEditClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`group relative w-[190px] h-[240px] bg-slate-800/80 backdrop-blur-xl rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 shadow-xl ${
        isCurrent ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : 'border border-slate-700/50 hover:border-slate-500/50'
      }`}
    >
      {/* Highlight border for target current node */}
      {isCurrent && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 opacity-60" 
             style={{ 
               border: '2px solid transparent',
               background: 'linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8f00ff) border-box',
               WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
               WebkitMaskComposite: 'destination-out',
               maskComposite: 'exclude',
             }} 
        />
      )}

      {node.image ? (
        <div className="h-[45%] w-full relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10 opacity-50"></div>
          <img 
            src={node.image || undefined} 
            alt={node.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div className="h-[45%] w-full bg-slate-800 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center">
            <span className="text-slate-400 font-bold opacity-50 text-sm">{node.title.charAt(0)}</span>
          </div>
        </div>
      )}
      
      <div className="p-3 flex flex-col justify-between h-[55%] bg-gradient-to-b from-[#0B1120]/90 to-[#0B1120] relative z-20">
        <div>
          <div className="flex items-start justify-between gap-1.5 mb-1">
            <h3 className="text-slate-100 font-bold text-xs line-clamp-1 group-hover:text-blue-400 transition-colors">
              {node.title}
            </h3>
            <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${
              node.type === 'idea' 
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              {node.type} v{node.version || 1}
            </span>
          </div>
          <p className="text-slate-400 text-[10px] line-clamp-2 leading-tight">
            {node.content || "No description provided."}
          </p>
        </div>
        
        <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-slate-800/80">
          <img src={node.author_avatar || undefined} alt={node.author_name} className={`w-4 h-4 rounded-full bg-slate-800 object-cover ${getAccountTypeBorderClass(node.author_account_type || node.account_type, 'border')}`} />
          <span className="text-slate-300 text-[10px] font-medium truncate max-w-[70px]">
            {node.author_name}
          </span>
          {node.type === 'idea' && isMember && (
            <button 
              onClick={onEditClick}
              className="ml-auto bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-2 py-0.5 rounded-full text-[9px] font-bold transition-colors"
            >
              編集提案
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

