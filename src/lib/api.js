// One place for calling the SkillMap API and turning failures into user-facing text.

export const NETWORK_MESSAGE = 'We couldn’t reach SkillMap. Check your connection and try again.';

export class ApiError extends Error {
  /** @param {string} message @param {{ status?: number, code?: string, network?: boolean }} [info] */
  constructor(message, info = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = info.status;
    this.code = info.code;
    this.network = Boolean(info.network);
  }
}

export const isAbort = (err) => err?.name === 'AbortError';

/**
 * POST JSON and return the parsed body, or throw ApiError with the server's
 * sanitized message (plus any field issues). AbortError is re-thrown as-is so
 * callers can ignore superseded runs.
 * @param {string} url
 * @param {unknown} body
 * @param {{ signal?: AbortSignal, fetchImpl?: typeof fetch }} [opts]
 */
export async function postJSON(url, body, { signal, fetchImpl = fetch } = {}) {
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiError(NETWORK_MESSAGE, { network: true });
  }
  let json = null;
  try {
    json = await res.json();
  } catch (err) {
    if (isAbort(err)) throw err;
  }
  if (!res.ok || !json) {
    const issues = json?.error?.issues?.map(i => i.message).join(' · ');
    const message = json?.error?.message || `Something went wrong (HTTP ${res.status}).`;
    throw new ApiError([message, issues].filter(Boolean).join(' '), { status: res.status, code: json?.error?.code });
  }
  return json;
}
