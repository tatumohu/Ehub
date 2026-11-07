import OpenAI from 'openai';
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Source scripts and the bundled server both resolve back to the E-hub root.
const moduleDir = path.dirname(fileURLToPath(import.meta.url || `file://${__filename}`));
export const projectRoot = path.resolve(moduleDir, '..');
config({ path: path.join(projectRoot, '.env.local'), quiet: true });
config({ path: path.join(projectRoot, '.env'), quiet: true });

export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key is not configured');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000, maxRetries: 0 });
}

export async function generateText(input: string | Array<{ role: string; content: string }>, instructions?: string, signal?: AbortSignal) {
  const response = await getOpenAI().responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-6-astra',
    input: typeof input === 'string' ? input : input.map(m => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'assistant' as const : m.role === 'system' ? 'system' as const : 'user' as const,
      content: String(m.content || '')
    })),
    instructions,
    store: false,
  }, { signal });
  if (!response.output_text) throw new Error('OpenAI returned an empty text response');
  return response.output_text;
}

// Preserve the existing text endpoint response handling while using OpenAI only.
export async function requestAIText(options: RequestInit) {
  const payload = JSON.parse(String(options.body));
  return new Response(await generateText(payload.messages, undefined, options.signal || undefined));
}

export async function generateImage(prompt: string) {
  const response = await getOpenAI().images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    prompt, size: '1536x1024', n: 1,
  });
  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error('OpenAI returned no image');
  return base64;
}
