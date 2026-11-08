async function test() {
  const author_id = 1;

  // Let's create an idea from user 1 first.
  const postRes = await fetch(`http://127.0.0.1:3000/api/ideas?user_id=${author_id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Secret IDEA',
      description: 'Private stuff',
      image: '',
      author_id,
      quoted_item_id: null,
      quoted_item_type: null,
      stage: 1,
      is_private: 1,
      permitted_users: '[1,2]'
    })
  });
  const idea = await postRes.json();
  console.log("Posted Idea:", idea.id);

  // Now let's try to fetch it as user 1
  const fetchRes = await fetch(`http://127.0.0.1:3000/api/ideas/${idea.id}?user_id=${author_id}`);
  console.log("Fetch Idea Status:", fetchRes.status);
  const fetchedIdea = await fetchRes.json();
  console.log("Fetched Idea Title:", fetchedIdea.title);
  console.log("Error? ", fetchedIdea.error);
}
test();
