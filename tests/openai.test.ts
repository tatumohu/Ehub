import test from 'node:test';
import assert from 'node:assert/strict';
import { generateText, generateImage, requestAIText, projectRoot } from '../lib/openai';

// No network calls or real credentials are used by these tests.
test('OpenAI adapter preserves history and instructions and keeps credentials server side', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only';
  const requests: Array<{url: string; body: any}> = [];
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const body = JSON.parse(await request.text());
    requests.push({url: request.url, body});
    return Response.json(request.url.endsWith('/images/generations')
      ? { data: [{ b64_json: 'aW1hZ2U=' }] }
      : { id: 'resp_test', object: 'response', status: 'completed', output: [{type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'OK', annotations: [] }] }] });
  };
  try {
    assert.equal(await generateText([{role: 'model', content: 'Previous answer'}, {role: 'user', content: 'Next'}], 'Scout instructions'), 'OK');
    assert.equal(requests[0].url, 'https://api.openai.com/v1/responses');
    assert.equal(requests[0].body.input[0].role, 'assistant');
    assert.equal(requests[0].body.instructions, 'Scout instructions');
    assert.equal(requests[0].body.store, false);
    const result = await requestAIText({body: JSON.stringify({messages: [{role: 'user', content: 'Translate'}]})});
    assert.equal(await result.text(), 'OK');
    assert.equal(await generateImage('Landscape'), 'aW1hZ2U=');
    assert.equal(requests[2].body.prompt, 'Landscape');
    assert.ok(projectRoot.endsWith('/E-hub'));
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(generateText('Hello'), /not configured/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
