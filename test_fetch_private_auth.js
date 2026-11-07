async function test() {
  const res = await fetch('http://127.0.0.1:3000/api/projects/5?user_id=1');
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("ID:", data.id);
  console.log("Error:", data.error);
}
test();
