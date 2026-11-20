// Vercel serverless function for POST /api/market. All logic lives in server/handler.js.
import { createDeps, handleMarket } from '../server/handler.js';
import { makeVercelHandler } from '../server/http.js';

export default makeVercelHandler(handleMarket, createDeps);
