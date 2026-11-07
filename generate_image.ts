import { generateImage } from './lib/openai';
import fs from 'node:fs';
const image = await generateImage('A futuristic digital platform showing people connecting their skills to local community projects, vibrant colors, clean UI design, landscape composition.');
fs.writeFileSync('generated_idea_image.txt', image);
console.log('Image saved to generated_idea_image.txt');
