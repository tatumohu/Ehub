// Run with: npx tsx test-img.js
import { generateImage } from './lib/openai.ts';
await generateImage('A cat in space');
console.log('Image generation succeeded');
