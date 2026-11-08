// Run with: npx tsx test-poll2.cjs
(async () => {
  const { generateImage } = await import('./lib/openai.ts');
  await generateImage('A cat in space');
  console.log('OpenAI image generation succeeded');
})();
