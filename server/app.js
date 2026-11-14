import express from 'express';
import cookieParser from 'cookie-parser';
import { COOKIE_NAME, principalForSlot, resolveSession } from './sessions.js';

export function createApp({ config, sessionStore }) {
  const app = express();
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/session', async (req, res, next) => {
    try {
      const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
      const principal = principalForSlot(config.pins.get(pin));
      if (!principal) return res.status(401).json({ error: 'Invalid PIN' });
      const id = await sessionStore.create(principal);
      res.cookie(COOKIE_NAME, id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000,
      });
      res.json({ user: principal.label });
    } catch (err) {
      next(err);
    }
  });

  // Every other /api route requires a server-side session; tenant comes only from it.
  app.use('/api', async (req, res, next) => {
    try {
      const principal = await resolveSession(sessionStore, req.cookies?.[COOKIE_NAME]);
      if (!principal) return res.status(401).json({ error: 'Not authenticated' });
      req.principal = principal;
      next();
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/session', (req, res) => res.json({ user: req.principal.label }));

  app.use((err, _req, res, _next) => {
    console.error(err.message);
    res.status(500).json({ error: 'Internal error' });
  });

  return app;
}
