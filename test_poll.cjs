// Run with: npx tsx test_poll.cjs
(async () => {
  const { generateText } = await import('./lib/openai.ts');
  console.log(await generateText('Reply with OK'));
})();
