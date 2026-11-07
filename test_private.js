async function test() {
  const res = await fetch('http://127.0.0.1:3000/api/projects');
  const data = await res.json();
  console.log("Total:", data.length);
  const privates = data.filter(d => d.is_private);
  console.log("Private:", privates.length);

  const res2 = await fetch('http://127.0.0.1:3000/api/projects?user_id=1');
  const data2 = await res2.json();
  console.log("Total (user 1):", data2.length);
  const privates2 = data2.filter(d => d.is_private);
  console.log("Private (user 1):", privates2.length);
}
test();
