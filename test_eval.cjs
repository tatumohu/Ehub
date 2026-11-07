async function test() {
  const res = await fetch('http://localhost:3000/api/items/idea/1/stage_evaluation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: 2, stage: 5 })
  });
  const data = await res.json();
  console.log('Eval response:', data);

  const res2 = await fetch('http://localhost:3000/api/ideas/1?user_id=2');
  const data2 = await res2.json();
  console.log('Idea detail stage:', data2.stage, 'author_stage:', data2.author_stage, 'user_evaluated:', data2.user_evaluated_stage);
}

test();
