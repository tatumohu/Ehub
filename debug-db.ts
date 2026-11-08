
import Database from 'better-sqlite3';
const db = new Database('ehub.db');

try {
  const ideaId = 1;
  const idea = db.prepare(`
    SELECT ideas.id, ideas.title, ideas.description, ideas.image, ideas.author_id, ideas.quoted_item_id, ideas.quoted_item_type, ideas.stage,
           strftime('%Y-%m-%dT%H:%M:%SZ', ideas.created_at) as created_at,
         users.username as author_name, users.avatar as author_avatar
    FROM ideas
    JOIN users ON ideas.author_id = users.id
    WHERE ideas.id = ?
  `).get(ideaId);
  console.log('Idea:', idea);

  const comments = db.prepare(`
    SELECT comments.id, comments.content, comments.user_id, comments.idea_id, comments.parent_id,
           strftime('%Y-%m-%dT%H:%M:%SZ', comments.created_at) as created_at,
           users.username, users.avatar
    FROM comments
    JOIN users ON comments.user_id = users.id
    WHERE idea_id = ?
    ORDER BY created_at ASC
  `).all(ideaId);
  console.log('Comments:', comments.length);
} catch (e) {
  console.error('Database error:', e);
}
