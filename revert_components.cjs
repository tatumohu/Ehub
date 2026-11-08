const fs = require('fs');

const importMiniStageGauge = "import MiniStageGauge from '../components/MiniStageGauge';\n";

function processFile(filename, replaceTop, replaceGrid) {
  let code = fs.readFileSync(filename, 'utf8');
  
  if (code.includes(importMiniStageGauge)) {
    code = code.replace(importMiniStageGauge, '');
  }

  if (replaceTop) {
    code = code.replace(
      /<MiniStageGauge stage=\{slideItem\.stage\} \/>/,
      `<span className="px-2 py-1 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-md border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.1)]">\n                            {STAGES[Math.max(1, Math.min(6, slideItem.stage)) - 1]}\n                          </span>`
    );
  }

  if (replaceGrid) {
    code = code.replace(
      /<div className="absolute top-2 right-2 md:top-3 md:right-3 z-10"><MiniStageGauge stage=\{item\.stage\} \/><\/div>/,
      `<div className="absolute top-2 right-2 md:top-3 md:right-3 z-10 bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md flex items-center gap-1 shadow-lg">\n                      <span className="text-[8px] md:text-[10px] font-black text-emerald-400 tracking-wider">\n                        {Math.max(1, Math.min(6, item.stage))}/6\n                      </span>\n                      <span className="text-[8px] md:text-[10px] font-black text-white tracking-widest uppercase truncate max-w-[60px] md:max-w-none">\n                        {STAGES[Math.max(1, Math.min(6, item.stage)) - 1]}\n                      </span>\n                    </div>`
    );
    
    code = code.replace(
      /<div className="absolute top-3 right-3 z-10"><MiniStageGauge stage=\{item\.stage\} \/><\/div>/g,
      `<div className="absolute top-3 right-3 z-10 bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 px-2 py-1 rounded-md flex items-center gap-1.5 shadow-lg">\n                                        <span className="text-[10px] font-black text-emerald-400 tracking-wider">\n                                          {Math.max(1, Math.min(6, item.stage))}/6\n                                        </span>\n                                        <span className="text-[10px] font-black text-white tracking-widest uppercase">\n                                          {STAGES[Math.max(1, Math.min(6, item.stage)) - 1]}\n                                        </span>\n                                      </div>`
    );
  }
  
  fs.writeFileSync(filename, code);
}

processFile('src/pages/Home.tsx', true, true);
processFile('src/pages/Search.tsx', false, true);
processFile('src/pages/Profile.tsx', false, true);

