import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(
  /if \(\!author \|\| \!author\.stripe_account_id\) return res\.status\(400\)\.json\(\{ error: 'Author has not connected Stripe' \}\);/g,
  "// if (!author || !author.stripe_account_id) return res.status(400).json({ error: 'Author has not connected Stripe' });"
);
fs.writeFileSync('server.ts', content);
