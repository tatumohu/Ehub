async function test() {
  const endpoints = [
    '/api/users/1/likes',
    '/api/users/1/ideas',
    '/api/users/1/projects',
    '/api/users/1/ema',
    '/api/lineage/idea/1',
    '/api/lineage/project/1',
    '/api/search?q=test',
    '/api/completed',
    '/api/ideas/1',
    '/api/projects/1'
  ];
  for (const ep of endpoints) {
    const res = await fetch('http://localhost:3000' + ep);
    const t = await res.text();
    console.log(ep, ':', t.includes('SqliteError') ? t.substring(0, 100) : 'OK');
  }
}
test();
