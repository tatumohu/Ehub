import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { INDUSTRIES_JA, INDUSTRIES_EN } from './HashtagInput';

export default function HashtagDisplay({ tags, className = '' }: { tags: string, className?: string }) {
  const { language } = useAppContext();
  
  if (!tags || tags.trim() === '' || tags.trim() === '#') return null;
  
  let tagsText = tags;
  try {
    if (tags.startsWith('[')) {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        tagsText = parsed.join(' ');
      }
    }
  } catch (e) {}

  const parts = tagsText.split(/(\s+)/).filter(p => p.trim() !== '');
  
  const getTranslatedTag = (tag: string) => {
    const cleanTag = tag.replace('#', '');
    if (language === 'en') {
      const jpIndex = INDUSTRIES_JA.indexOf(cleanTag);
      if (jpIndex !== -1) return '#' + INDUSTRIES_EN[jpIndex];
    } else if (language === 'ja') {
      const enIndex = INDUSTRIES_EN.indexOf(cleanTag);
      if (enIndex !== -1) return '#' + INDUSTRIES_JA[enIndex];
    }
    return tag;
  };
  
  const validTags = parts.filter(tag => tag.startsWith('#') && tag.length > 1 && tag !== '#[]' && tag !== '[]');
  
  if (validTags.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {validTags.map((tag, i) => {
        const displayTag = getTranslatedTag(tag);
        return (
          <Link 
            key={i} 
            to={`/search?q=${encodeURIComponent(displayTag)}`}
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {displayTag}
          </Link>
        );
      })}
    </div>
  );
}

