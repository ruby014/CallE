import express from 'express';
import cookieParser from 'cookie-parser';
import { COOKIE_NAME, principalForSlot, resolveSession } from './sessions.js';

export function createApp({ config, sessionStore, memories, runs }) {
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

  const handle = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (/not found/i.test(err.message)) return res.status(404).json({ error: 'Not found' });
      if (/^(invalid|explicit user approval|memory (content|source|expiry))/i.test(err.message)) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  };
  const parseMemory = (body) => ({
    content: body?.content,
    source: body?.source,
    expiresAt: new Date(body?.expiresAt),
  });

  if (memories) {
    app.get('/api/memories', handle(async (req, res) => res.json(await memories.list(req.principal))));
    app.post('/api/memories', handle(async (req, res) =>
      res.status(201).json(await memories.save(req.principal, parseMemory(req.body)))));
    app.patch('/api/memories/:id', handle(async (req, res) =>
      res.json(await memories.correct(req.principal, req.params.id, parseMemory(req.body)))));
    app.delete('/api/memories/:id', handle(async (req, res) => {
      await memories.forget(req.principal, req.params.id);
      res.status(204).end();
    }));
  }

  if (runs) {
    app.post('/api/runs', handle(async (req, res) => res.status(201).json(await runs.startRun(req.principal, req.body))));
    app.get('/api/runs/:id', handle(async (req, res) => res.json(await runs.getRun(req.principal, req.params.id))));
    app.post('/api/runs/:id/field', handle(async (req, res) =>
      res.json(await runs.authorizeField(req.principal, req.params.id, req.body?.field))));
    app.post('/api/runs/:id/actions', handle(async (req, res) => {
      await runs.recordAction(req.principal, req.params.id, req.body);
      res.status(201).json({ ok: true });
    }));
    app.post('/api/runs/:id/complete', handle(async (req, res) =>
      res.json(await runs.completeRun(req.principal, req.params.id, req.body))));
    app.post('/api/runs/:id/memory', handle(async (req, res) =>
      res.status(201).json(await runs.saveOfferAsMemory(req.principal, req.params.id, {
        approved: req.body?.approved,
        expiresAt: new Date(req.body?.expiresAt),
      }))));
  }

  app.use((err, _req, res, _next) => {
    console.error(err.message);
    res.status(500).json({ error: 'Internal error' });
  });

  return app;
}
