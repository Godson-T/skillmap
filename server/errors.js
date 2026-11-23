// Sanitized error envelope. `message` is user-facing (warm, no provider
// details); everything diagnostic goes to structured logs instead.

const CATALOG = {
  INVALID_JSON: [400, 'We couldn\'t read that request. Please refresh the page and try again.'],
  INVALID_INPUT: [400, 'A couple of details need a quick tweak before we can map your path.'],
  PAYLOAD_TOO_LARGE: [413, 'That\'s a lot of detail! Please trim your skills list and try again.'],
  METHOD_NOT_ALLOWED: [405, 'This endpoint only accepts POST requests.'],
  ORIGIN_NOT_ALLOWED: [403, 'This endpoint only accepts requests from the SkillMap site.'],
  RATE_LIMITED: [429, 'You\'re moving fast! Please wait a moment before running another analysis.'],
  DAILY_LIMIT: [429, 'You\'ve reached today\'s analysis limit. Come back tomorrow and we\'ll keep going!'],
  GLOBAL_DAILY_CAP: [503, 'SkillMap is extra popular today and has paused new analyses. Please try again tomorrow.'],
  UPSTREAM_BUSY: [503, 'Our AI provider is busy right now. Please try again in a minute.'],
  TIMEOUT: [504, 'Your analysis took longer than expected. Please try again.'],
  BAD_OUTPUT: [502, 'We couldn\'t put together a complete report this time. Please try again.'],
  UPSTREAM_ERROR: [502, 'The analysis service had a hiccup. Please try again shortly.'],
  SERVICE_UNAVAILABLE: [503, 'SkillMap is temporarily unavailable. We\'re on it — please try again later.'],
  INTERNAL: [500, 'Something unexpected went wrong on our side. Please try again.'],
};

const RETRYABLE = new Set(['RATE_LIMITED', 'UPSTREAM_BUSY', 'TIMEOUT', 'BAD_OUTPUT', 'UPSTREAM_ERROR']);

export class AppError extends Error {
  /**
   * @param {keyof typeof CATALOG} code
   * @param {{ detail?: string, issues?: Array<{field: string, message: string}>, retryAfter?: number, cause?: unknown }} [opts]
   */
  constructor(code, opts = {}) {
    super(opts.detail || code);
    this.code = CATALOG[code] ? code : 'INTERNAL';
    this.status = CATALOG[this.code][0];
    this.detail = opts.detail; // logged, never returned
    this.issues = opts.issues;
    this.retryAfter = opts.retryAfter;
    if (opts.cause) this.cause = opts.cause;
  }
}

export function errorBody(err, requestId) {
  const e = err instanceof AppError ? err : new AppError('INTERNAL');
  const error = { code: e.code, message: CATALOG[e.code][1], retryable: RETRYABLE.has(e.code) };
  if (e.issues?.length) error.issues = e.issues;
  if (e.retryAfter) error.retryAfterSeconds = e.retryAfter;
  return { requestId, error };
}
