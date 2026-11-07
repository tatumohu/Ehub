async function test() {
  const res = await fetch('http://127.0.0.1:3000/api/projects?user_id=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Secret Post 2',
      description: 'Private stuff',
      image: '',
      author_id: 1,
      quoted_item_id: null,
      quoted_item_type: null,
      stage: 1,
      is_private: 1,
      permitted_users: '[1,2]'
    })
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Text:", text);
}
test();
