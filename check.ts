import Database from 'better-sqlite3';
const db = new Database('ehub.db');
try {
  const items = db.prepare(`
      SELECT id, title, description, image, author_id, quoted_item_id, quoted_item_type, stage, is_recruitment, is_private, permitted_users, status, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at, 'project' as type,
             strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
             (SELECT username FROM users WHERE id = author_id) as author_name,
             (SELECT avatar FROM users WHERE id = author_id) as author_avatar,
             (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
             0 as priority
      FROM projects
      WHERE status = 'active'
      ORDER BY RAND()
      LIMIT 10
  `).all();
  console.log('Query 1 OK');
} catch (e) {
  console.error('Query 1 ERROR:', e.message);
}

try {
  const items2 = db.prepare(`
    SELECT DISTINCT id, title, description, image, author_id, quoted_item_id, quoted_item_type, stage, is_recruitment, is_private, permitted_users, latest_idea_id, latest_idea_at, type,
           created_at, author_name, author_avatar, likes_count, comments_count, follows_count, quotes_count,
           MAX(priority) as priority
    FROM (
      SELECT projects.id, projects.title, projects.description, projects.image, projects.images, projects.completed_title, projects.completed_description, projects.completed_images, projects.author_id, projects.quoted_item_id, projects.quoted_item_type, projects.stage, projects.is_recruitment, projects.is_private, projects.permitted_users, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at, 'project' as type,
             strftime('%Y-%m-%dT%H:%M:%SZ', projects.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type,
             (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count,
             CASE WHEN subscriptions.id IS NOT NULL THEN 2 
                  WHEN views.id IS NOT NULL THEN 1 
                  ELSE 0 END as priority
      FROM projects
      JOIN users ON projects.author_id = users.id
      LEFT JOIN subscriptions ON subscriptions.subscriber_id = 999 AND subscriptions.subscribed_to_id = projects.author_id
      LEFT JOIN views ON views.user_id = 999 AND views.item_id = projects.id AND views.item_type = 'project'
      WHERE projects.status = 'active'
    )
    GROUP BY id, type
    ORDER BY priority DESC, created_at DESC
    LIMIT 20
  `).all();
  console.log('Query 2 OK');
} catch (e) {
  console.error('Query 2 ERROR:', e.message);
}

