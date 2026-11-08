const fs = require('fs');

function revert(file, isProject) {
  let code = fs.readFileSync(file, 'utf8');
  const objName = isProject ? "project" : "idea";

  const titleRegex = /<h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight break-words">/;
  
  const gaugeBlock = `                <div className="mb-6 sm:mb-8 flex items-center justify-between">
                  <div>
                    {${objName}.stage && Number(${objName}.is_recruitment) !== 1 && (
                      <div 
                        onClick={() => {
                          if (user && Number(user.id) !== Number(${objName}.author_id)) {
                            setIsEvaluationModalOpen(true);
                          }
                        }}
                        className={user && Number(user.id) !== Number(${objName}.author_id) ? "cursor-pointer hover:opacity-80 transition-opacity inline-block rounded-xl" : ""}
                      >
                        <SimpleStageIndicator currentStage={${objName}.stage} />
                      </div>
                    )}
                  </div>
                </div>\n                `;

  if (!code.includes('<SimpleStageIndicator currentStage=')) {
    code = code.replace(titleRegex, gaugeBlock + '<h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight break-words">');
  }

  const targetStr = `                  {${objName}.stage && Number(${objName}.is_recruitment) !== 1 && (
                    <button
                      onClick={() => {
                        if (user && Number(user.id) !== Number(${objName}.author_id)) {
                          setIsEvaluationModalOpen(true);
                        }
                      }}
                      className={"flex items-center gap-2.5 transition-all hover:scale-110 " + (user && Number(user.id) !== Number(${objName}.author_id) ? "text-slate-400 hover:text-purple-500 cursor-pointer" : "text-purple-500 cursor-default")}
                      title="Evaluate Stage"
                    >
                      <Target className="w-7 h-7" />
                      <span className="text-base font-bold">{${objName}.stage}</span>
                    </button>
                  )}

`;
  code = code.replace(targetStr, "");
  fs.writeFileSync(file, code);
  console.log("Reverted", file);
}

revert('src/pages/IdeaDetail.tsx', false);
revert('src/pages/ProjectDetail.tsx', true);
