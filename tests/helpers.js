import { vi } from 'vitest';
import fixture from './fixtures/report.json';

/** A fetch Response-like object. */
export const jsonResponse = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
});

/** A Groq chat-completion response wrapping `content`. */
export const groqOk = (content = JSON.stringify(fixture), finish = 'stop') => jsonResponse(200, {
  id: 'chatcmpl-test',
  model: 'openai/gpt-oss-120b',
  choices: [{ index: 0, finish_reason: finish, message: { role: 'assistant', content } }],
  usage: { prompt_tokens: 500, completion_tokens: 1200, total_tokens: 1700 },
  x_groq: { id: 'req_secret_internal' },
});

/** fetch mock that returns the given responses in order (functions are called with (url, init)). */
export function fetchSequence(...responses) {
  const fn = vi.fn();
  for (const r of responses) fn.mockImplementationOnce(typeof r === 'function' ? r : async () => r);
  return fn;
}
