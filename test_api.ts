async function test() {
  const p1 = await fetch('http://localhost:3000/api/projects').then(res => res.text());
  console.log('/api/projects:', p1.includes('SqliteError') ? p1 : 'OK');

  const p2 = await fetch('http://localhost:3000/api/ideas').then(res => res.text());
  console.log('/api/ideas:', p2.includes('SqliteError') ? p2 : 'OK');

  const p3 = await fetch('http://localhost:3000/api/ideas/recommended').then(res => res.text());
  console.log('/api/ideas/recommended:', p3.includes('SqliteError') ? p3 : 'OK');
}
test();
