import app from "../src/app.js";

/**
 * Vercel Serverless Function Handler
 * 
 * Wraps the Express app in a proper request handler function.
 * Vercel expects: export default (req, res) => { ... }
 * 
 * Express apps ARE callable (they're middleware functions),
 * so we just pass the request/response through.
 */
export default function handler(req, res) {
  return app(req, res);
}
