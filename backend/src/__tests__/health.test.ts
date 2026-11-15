import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z, ZodError } from 'zod';
import { createApp } from '../app';
import { AppError, errorHandler } from '../middlewares/error.middleware';
import { validate } from '../middlewares/validate.middleware';

describe('Socle Backend Eparnio — Santé, Validation & Erreurs', () => {
  const app = createApp();

  it('GET /api/health retourne 200 et le statut ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.app).toBe('Eparnio API');
    expect(res.body.timestamp).toEqual(expect.any(String));
  });

  it('POST /api/health/echo valide et retourne le message nettoyé', async () => {
    const res = await request(app).post('/api/health/echo').send({ message: '  Bonjour Eparnio  ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      echo: 'Bonjour Eparnio'
    });
  });

  it('POST /api/health/echo rejette un payload invalide avec 400', async () => {
    const res = await request(app).post('/api/health/echo').send({ message: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBe('Données de requête invalides');
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          location: 'body',
          path: 'message'
        })
      ])
    );
  });

  it('retourne 404 JSON uniforme sur une route inconnue', async () => {
    const res = await request(app).get('/api/route-inexistante');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('Route introuvable');
  });

  it('valide aussi params et query via validate()', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get(
      '/items/:id',
      validate({
        params: z.object({ id: z.string().regex(/^\d+$/, 'ID numérique requis') }),
        query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) })
      }),
      (req, res) => {
        res.status(200).json({ id: req.params.id, limit: req.query.limit });
      }
    );
    testApp.use(errorHandler);

    const validRes = await request(testApp).get('/items/42?limit=5');
    expect(validRes.status).toBe(200);
    expect(validRes.body).toEqual({ id: '42', limit: 5 });

    const invalidRes = await request(testApp).get('/items/abc?limit=100');
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.details).toHaveLength(2);
  });

  it('errorHandler formate AppError, ZodError et erreurs inattendues 500', async () => {
    const testApp = express();
    testApp.get('/app-err', (_req, _res, next) => next(new AppError('Accès refusé', 403)));
    testApp.get('/zod-err', (_req, _res, next) => {
      try {
        z.object({ amount: z.number().positive() }).parse({ amount: -10 });
      } catch (err) {
        next(err as ZodError);
      }
    });
    testApp.get('/unexpected-err', (_req, _res, next) => next(new Error('Panne critique')));
    testApp.use(errorHandler);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const appErrRes = await request(testApp).get('/app-err');
    expect(appErrRes.status).toBe(403);
    expect(appErrRes.body).toEqual({ status: 'error', message: 'Accès refusé' });

    const zodErrRes = await request(testApp).get('/zod-err');
    expect(zodErrRes.status).toBe(400);
    expect(zodErrRes.body.message).toBe('Données invalides');

    const unexpectedRes = await request(testApp).get('/unexpected-err');
    expect(unexpectedRes.status).toBe(500);
    expect(unexpectedRes.body).toEqual({
      status: 'error',
      message: 'Erreur interne du serveur'
    });

    consoleSpy.mockRestore();
  });
});
