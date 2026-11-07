import fs from 'fs';

function fixFile(file, edits) {
    if(!fs.existsSync(file)) return;
    let lines = fs.readFileSync(file, 'utf8').split('\n');
    
    // Sort edits descending by line number so inserting doesn't offset
    edits.sort((a,b) => b.line - a.line);

    for(const edit of edits) {
        if(edit.type === 'insert') {
            lines.splice(edit.line - 1, 0, edit.text);
        } else if (edit.type === 'replace') {
            lines[edit.line - 1] = edit.text;
        }
    }
    
    fs.writeFileSync(file, lines.join('\n'));
    console.log(`Manually repaired ${file}`);
}

// AddMembersModal
fixFile('src/components/AddMembersModal.tsx', [
    { line: 11, type: 'insert', text: '}' }, // Close User interface
    { line: 18, type: 'insert', text: '}' }, // Close Props interface
    { line: 30, type: 'insert', text: '    }' }, // Close if(isOpen) block
    { line: 50, type: 'insert', text: '    }' }, // Close newSelection.add(userId) else block
    { line: 66, type: 'insert', text: '      }' }, // Close if(res.ok) block
    { line: 70, type: 'insert', text: '    }' }, // Close finally block
    { line: 171, type: 'insert', text: '                )}\n              </div>\n            </div>\n          </motion.div>\n        </motion.div>\n  );\n}' }, // Replace end with proper closings
    { line: 171, type: 'replace', text: '' }, // remove the malformed )) on line 171 ? Wait, )) was line 171 earlier. Let's just do append.
]);

// ShareModal
fixFile('src/components/ShareModal.tsx', [
    { line: 17, type: 'insert', text: '}' }, // Close Recipient interface
    { line: 25, type: 'insert', text: '}' }, // Close ShareModalProps interface
    { line: 62, type: 'insert', text: '        }' }, // Close finally block
    { line: 97, type: 'insert', text: '      }' }, // Close else if (type === project)
    { line: 195, type: 'insert', text: '                  );\n                })\n              )}\n            </div>\n\n            <div className="p-6 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md">\n              <button\n                onClick={handleSend}\n                disabled={selectedIds.length === 0}\n                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"\n              >\n                <Send className="w-5 h-5" />\n                Send to {selectedIds.length} {selectedIds.length === 1 ? \'recipient\' : \'recipients\'}\n              </button>\n            </div>\n          </motion.div>\n        </motion.div>\n  );\n}' }
]);

