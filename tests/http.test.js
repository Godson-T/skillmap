import { describe, expect, it, vi } from 'vitest';
import { clientIp, makeVercelHandler, normalizeHeaders, resolveCors, trustsProxy } from '../server/http.js';

describe('trustsProxy', () => {
  it('trusts Vercel by default', () => {
    expect(trustsProxy({ VERCEL: '1' })).toBe(true);
  });

  it('trusts an explicit TRUST_PROXY flag', () => {
    expect(trustsProxy({ TRUST_PROXY: 'true' })).toBe(true);
    expect(trustsProxy({ TRUST_PROXY: 'yes' })).toBe(true);
    expect(trustsProxy({ TRUST_PROXY: '1' })).toBe(true);
  });

  it('does not trust proxy headers anywhere else', () => {
    expect(trustsProxy({})).toBe(false);
    expect(trustsProxy({ TRUST_PROXY: '0' })).toBe(false);
    expect(trustsProxy({ TRUST_PROXY: 'false' })).toBe(false);
  });
});

describe('clientIp', () => {
  const socket = { remoteAddress: '10.0.0.5' };

  it('ignores x-forwarded-for when the proxy is not trusted (spoofable)', () => {
    const headers = { 'x-forwarded-for': '203.0.113.9' };
    expect(clientIp(headers, socket, {})).toBe('10.0.0.5');
  });

  it('uses x-forwarded-for behind a trusted proxy', () => {
    const headers = { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' };
    expect(clientIp(headers, socket, { VERCEL: '1' })).toBe('203.0.113.9');
  });

  it('prefers x-real-ip over x-forwarded-for behind a trusted proxy', () => {
    const headers = { 'x-real-ip': '203.0.113.1', 'x-forwarded-for': '203.0.113.9' };
    expect(clientIp(headers, socket, { VERCEL: '1' })).toBe('203.0.113.1');
  });

  it('falls back to the socket address when trusted headers are absent', () => {
    expect(clientIp({}, socket, { VERCEL: '1' })).toBe('10.0.0.5');
  });

  it('falls back to "unknown" with no socket', () => {
    expect(clientIp({}, undefined, {})).toBe('unknown');
  });
});

describe('resolveCors', () => {
  it('allows same-origin requests with no Origin header', () => {
    expect(resolveCors({ host: 'app.example' }, {})).toEqual({ allowed: true, headers: {} });
  });

  it('allows a same-host origin', () => {
    const r = resolveCors({ origin: 'https://app.example', host: 'app.example' }, {});
    expect(r.allowed).toBe(true);
    expect(r.headers['Access-Control-Allow-Origin']).toBe('https://app.example');
  });

  it('rejects a cross-origin request not on the allow list', () => {
    const r = resolveCors({ origin: 'https://evil.example', host: 'app.example' }, {});
    expect(r.allowed).toBe(false);
  });

  it('allows an origin explicitly listed in ALLOWED_ORIGINS', () => {
    const r = resolveCors({ origin: 'https://partner.example', host: 'app.example' }, { ALLOWED_ORIGINS: 'https://partner.example' });
    expect(r.allowed).toBe(true);
  });

  it('ignores a spoofed x-forwarded-host when the proxy is not trusted', () => {
    const r = resolveCors({ origin: 'https://evil.example', host: 'app.example', 'x-forwarded-host': 'evil.example' }, {});
    expect(r.allowed).toBe(false);
  });

  it('uses x-forwarded-host behind a trusted proxy', () => {
    const r = resolveCors({ origin: 'https://app.example', host: 'internal.local', 'x-forwarded-host': 'app.example' }, { VERCEL: '1' });
    expect(r.allowed).toBe(true);
  });

  it('does not throw on a malformed Origin header', () => {
    const r = resolveCors({ origin: 'not a url', host: 'app.example' }, {});
    expect(r.allowed).toBe(false);
  });
});

describe('normalizeHeaders', () => {
  it('lower-cases keys and joins array values', () => {
    expect(normalizeHeaders({ 'X-Foo': ['a', 'b'], Host: 'app.example' })).toEqual({ 'x-foo': 'a, b', host: 'app.example' });
  });
});

describe('makeVercelHandler', () => {
  function fakeReqRes({ headers = {}, body, method = 'POST' } = {}) {
    const req = { method, headers, body, socket: { remoteAddress: '10.0.0.5' } };
    const res = { statusCode: 0, headers: {}, body: undefined, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
    return { req, res };
  }

  it('rejects an oversized body via Content-Length before calling handle', async () => {
    const handle = vi.fn(async () => ({ status: 413, headers: {}, body: { error: 'too large' } }));
    const fn = makeVercelHandler(handle, () => ({ env: {} }));
    const { req, res } = fakeReqRes({ headers: { 'content-length': String(1024 * 1024) } });
    await fn(req, res);
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ bodyTooLarge: true, body: undefined }), expect.anything());
    expect(res.statusCode).toBe(413);
  });

  it('rejects an oversized parsed-object body even with no Content-Length', async () => {
    const handle = vi.fn(async () => ({ status: 200, headers: {}, body: { ok: true } }));
    const fn = makeVercelHandler(handle, () => ({ env: {} }));
    const big = { goal: 'x'.repeat(9000) };
    const { req, res } = fakeReqRes({ body: big });
    await fn(req, res);
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ bodyTooLarge: true }), expect.anything());
  });

  it('passes a well-formed body through with bodyTooLarge=false', async () => {
    const handle = vi.fn(async () => ({ status: 200, headers: {}, body: { ok: true } }));
    const fn = makeVercelHandler(handle, () => ({ env: {} }));
    const { req, res } = fakeReqRes({ body: { goal: 'Backend Engineer' } });
    await fn(req, res);
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ bodyTooLarge: false, body: { goal: 'Backend Engineer' } }), expect.anything());
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('reuses deps across warm invocations', async () => {
    const makeDeps = vi.fn(() => ({ env: {} }));
    const handle = vi.fn(async () => ({ status: 200, headers: {}, body: {} }));
    const fn = makeVercelHandler(handle, makeDeps);
    const a = fakeReqRes({ body: {} });
    const b = fakeReqRes({ body: {} });
    await fn(a.req, a.res);
    await fn(b.req, b.res);
    expect(makeDeps).toHaveBeenCalledTimes(1);
  });
});
