import fs from 'fs';

function restoreBraces(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Custom manual mappings based on compiler errors for each file

  if (filePath.includes('AddMembersModal.tsx')) {
    content = content.replace('avatar: string;\n\ninterface AddMembersModalProps', 'avatar: string;\n}\n\ninterface AddMembersModalProps');
    content = content.replace('onMembersAdded: () => void;\n\nexport default function', 'onMembersAdded: () => void;\n}\n\nexport default function');
    content = content.replace('fetchContacts();\n  }, [isOpen, user, itemId, itemType]);', 'fetchContacts();\n    }\n  }, [isOpen, user, itemId, itemType]);');
    content = content.replace('newSelection.add(userId);\n    setSelectedUserIds(newSelection);', 'newSelection.add(userId);\n    }\n    setSelectedUserIds(newSelection);');
    content = content.replace('setSelectedUserIds(new Set());\n    } catch (error) {', 'setSelectedUserIds(new Set());\n      }\n    } catch (error) {');
    content = content.replace('setLoading(false);\n  };', 'setLoading(false);\n    }\n  };');
    content = content.replace('</div>\n                    </div>\n                  ))\n                )}', '</div>\n                    </div>\n                  ))\n                )}\n              </div>\n            </div>\n          </motion.div>\n        </motion.div>\n  );\n}\n');
  } else if (filePath.includes('ShareModal.tsx')) {
    content = content.replace('type: \'direct\' | \'project\';\n\ninterface ShareModalProps', 'type: \'direct\' | \'project\';\n}\n\ninterface ShareModalProps');
    content = content.replace('type?: \'idea\' | \'project\';\n\nexport default function ShareModal', 'type?: \'idea\' | \'project\';\n}\n\nexport default function ShareModal');
    content = content.replace('setSelectedIds(prev =>\n      prev.includes(id)\n        ? prev.filter(i => i !== id)\n        : [...prev, id]\n    );\n  };\n', 'setSelectedIds(prev =>\n      prev.includes(id)\n        ? prev.filter(i => i !== id)\n        : [...prev, id]\n    );\n  };\n');
    content = content.replace('      } else {\n        socket.emit(\'send_message\', messageData);\n    });\n', '      } else {\n        socket.emit(\'send_message\', messageData);\n      }\n    });\n');
  } else if (filePath.includes('CompletedProjects.tsx')) {
    content = content.replace('            </Link>\n        </div>\n      </div>\n    </div>\n  );\n}', '            </Link>\n          </motion.div>\n        ))}\n      </div>\n    </div>\n  );\n}');
  }

  fs.writeFileSync(filePath, content);
  console.log(`Re-braced ${filePath}`);
}

['src/components/AddMembersModal.tsx', 'src/components/ShareModal.tsx', 'src/pages/CompletedProjects.tsx'].forEach(restoreBraces);

