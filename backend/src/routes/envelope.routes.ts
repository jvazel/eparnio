import { Router } from 'express';
import {
  createEnvelope,
  createEnvelopeBodySchema,
  deleteEnvelope,
  envelopeItemParamsSchema,
  listEnvelopes,
  listEnvelopesQuerySchema,
  periodParamsSchema,
  reorderEnvelopes,
  reorderEnvelopesBodySchema,
  updateEnvelope,
  updateEnvelopeBodySchema
} from '../controllers/envelope.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const envelopeRouter = Router({ mergeParams: true });

envelopeRouter.use(requireAuth);

envelopeRouter.get(
  '/',
  validate({ params: periodParamsSchema, query: listEnvelopesQuerySchema }),
  listEnvelopes
);
envelopeRouter.post(
  '/',
  validate({ params: periodParamsSchema, body: createEnvelopeBodySchema }),
  createEnvelope
);
envelopeRouter.patch(
  '/reorder',
  validate({ params: periodParamsSchema, body: reorderEnvelopesBodySchema }),
  reorderEnvelopes
);
envelopeRouter.patch(
  '/:id',
  validate({ params: envelopeItemParamsSchema, body: updateEnvelopeBodySchema }),
  updateEnvelope
);
envelopeRouter.delete(
  '/:id',
  validate({ params: envelopeItemParamsSchema }),
  deleteEnvelope
);

export { envelopeRouter };
