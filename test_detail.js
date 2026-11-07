async function test() {
  const getRes = await fetch('http://127.0.0.1:3000/api/ideas/19?user_id=1');
  const data = await getRes.json();
  console.log(data);
}
test();
