const { execSync } = require('child_process');
try {
  execSync('python3 /dump_db.py', { stdio: 'inherit' });
} catch (e) {
  console.log(e);
}
