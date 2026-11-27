import { Router } from 'express';
import {
  deleteAccountSchema,
  deleteMe,
  forgotPasswordSchema,
  getAuthConfig,
  getMe,
  login,
  loginSchema,
  logout,
  refreshSession,
  regenerateRecoveryKey,
  register,
  registerSchema,
  requestPasswordResetEmailCode,
  updateMe,
  updatePassword,
  updatePasswordSchema,
  updateProfileSchema
} from '../controllers/auth.controller';
import {
  deleteWebAuthnCredentials,
  getWebAuthnLoginOptions,
  getWebAuthnRegisterOptions,
  verifyWebAuthnLogin,
  verifyWebAuthnRegister
} from '../controllers/webauthn.controller';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware';
import { authRateLimiter } from '../middlewares/rateLimit.middleware';
import { validate } from '../middlewares/validate.middleware';

const authRouter = Router();

authRouter.get('/config', getAuthConfig);
authRouter.post('/register', authRateLimiter, validate({ body: registerSchema }), register);
authRouter.post('/login', authRateLimiter, validate({ body: loginSchema }), login);
authRouter.post('/refresh', authRateLimiter, refreshSession);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, getMe);
authRouter.patch('/me', requireAuth, validate({ body: updateProfileSchema }), updateMe);
authRouter.delete(
  '/me',
  authRateLimiter,
  requireAuth,
  validate({ body: deleteAccountSchema }),
  deleteMe
);
authRouter.post('/recovery-key', requireAuth, regenerateRecoveryKey);
authRouter.post(
  '/password/forgot',
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  requestPasswordResetEmailCode
);
authRouter.patch(
  '/password',
  authRateLimiter,
  optionalAuth,
  validate({ body: updatePasswordSchema }),
  updatePassword
);
authRouter.post('/webauthn/register/options', requireAuth, getWebAuthnRegisterOptions);
authRouter.post('/webauthn/register/verify', requireAuth, verifyWebAuthnRegister);
authRouter.delete('/webauthn/credentials', requireAuth, deleteWebAuthnCredentials);
authRouter.post('/webauthn/login/options', authRateLimiter, getWebAuthnLoginOptions);
authRouter.post('/webauthn/login/verify', authRateLimiter, verifyWebAuthnLogin);

export { authRouter };
