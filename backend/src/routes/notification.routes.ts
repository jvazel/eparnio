import { Router } from 'express';
import {
  getVapidPublicKey,
  notificationPreferencesSchema,
  sendTestNotification,
  subscribePush,
  subscribeSchema,
  unsubscribePush,
  unsubscribeSchema,
  updateNotificationPreferences,
} from '../controllers/notification.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get('/vapid-public-key', getVapidPublicKey);
notificationRouter.post('/subscribe', validate({ body: subscribeSchema }), subscribePush);
notificationRouter.delete('/unsubscribe', validate({ body: unsubscribeSchema }), unsubscribePush);
notificationRouter.patch(
  '/preferences',
  validate({ body: notificationPreferencesSchema }),
  updateNotificationPreferences
);
notificationRouter.post('/test', sendTestNotification);

export { notificationRouter };
