// Vercel serverless function for POST /api/analyze. All logic lives in server/handler.js.
import { createDeps, handleAnalyze } from '../server/handler.js';
import { makeVercelHandler } from '../server/http.js';

export default makeVercelHandler(handleAnalyze, createDeps);
