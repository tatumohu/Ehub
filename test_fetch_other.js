async function test() {
  const res2 = await fetch('http://127.0.0.1:3000/api/ideas/recommended?user_id=3');
  const data2 = await res2.json();
  const test2 = data2.find(d => d.title === "テスト２");
  console.log("テスト２ for user 3:", JSON.stringify(test2, null, 2));
}
test();
