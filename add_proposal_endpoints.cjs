const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const targetStr = `app.get('/api/ideas', (req, res) => {`;
const endpointsStr = `
app.post('/api/ideas/:id/approve_proposal', (req, res) => {
  const ideaId = req.params.id;
  try {
    db.prepare("UPDATE ideas SET status = 'active' WHERE id = ?").run(ideaId);
    // Fetch idea to notify
    const idea = db.prepare("SELECT author_id, title FROM ideas WHERE id = ?").get(ideaId);
    if (idea) {
      db.prepare("INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, message) VALUES (?, 'proposal_approved', ?, ?, 'idea', 'Your edit proposal was approved.')").run(idea.author_id, 1, ideaId);
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ideas/:id/reject_proposal', (req, res) => {
  const ideaId = req.params.id;
  try {
    db.prepare("UPDATE ideas SET status = 'rejected' WHERE id = ?").run(ideaId);
    const idea = db.prepare("SELECT author_id, title FROM ideas WHERE id = ?").get(ideaId);
    if (idea) {
      db.prepare("INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, message) VALUES (?, 'proposal_rejected', ?, ?, 'idea', 'Your edit proposal was rejected.')").run(idea.author_id, 1, ideaId);
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ideas', (req, res) => {`;

content = content.replace(targetStr, endpointsStr);

fs.writeFileSync('server.ts', content);
