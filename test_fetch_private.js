async function test() {
  const res = await fetch('http://127.0.0.1:3000/api/projects/5'); // 5 was created earlier by my script
  console.log("Status:", res.status);
  const data = await res.json();
  console.log(data);
}
test();
