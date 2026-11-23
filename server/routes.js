// Single source of truth for API endpoints. The Vite dev/preview middleware
// mounts these directly; each also has a one-line adapter in api/<name>.js for
// Vercel. tests/routes.test.js fails if an adapter or its vercel.json limits are
// missing, so the two runtimes cannot drift apart.

import { handleAnalyze, handleMarket } from './handler.js';

/** @type {Record<string, { handler: Function, maxDuration: number }>} */
export const ROUTES = {
  '/api/analyze': { handler: handleAnalyze, maxDuration: 60 },
  '/api/market': { handler: handleMarket, maxDuration: 30 },
};
