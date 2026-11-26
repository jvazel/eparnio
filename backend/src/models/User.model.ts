import mongoose, { type Document, Schema } from 'mongoose';

export type CurrencyCode = 'EUR';
export type ThemeMode = 'light' | 'dark';
export type DefaultTabId = 'revenus' | 'depenses' | 'enveloppes' | 'epargne' | 'budget';
export type BudgetViewMode = 'essential' | 'advanced';

export interface IUserPreferences {
  currency: CurrencyCode;
  budgetStartDay: number;
  theme: ThemeMode;
  defaultTab?: DefaultTabId;
  budgetViewMode?: BudgetViewMode;
}

export interface NotificationPreferences {
  dailyReminderEnabled: boolean;
  dailyReminderHour: string;
  upcomingDueAlertEnabled: boolean;
  envelopeThresholdAlertEnabled: boolean;
  sharedActivityAlertEnabled?: boolean;
}

export interface IWebAuthnCredential {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  notificationPreferences?: NotificationPreferences;
  recoveryKeyHash?: string;
  recoveryKeyHint?: string;
  resetEmailCodeHash?: string;
  resetEmailCodeExpiresAt?: Date;
  resetEmailCodeAttempts: number;
  webauthnCredentials: IWebAuthnCredential[];
  webauthnChallenge?: string;
  webauthnChallengeExpiresAt?: Date;
  tokenVersion: number;
  displayName: string;
  avatarEmoji: string;
  hasCompletedOnboarding: boolean;
  preferences: IUserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  avatarEmoji: string;
  recoveryKeyHint?: string;
  hasBiometrics: boolean;
  hasCompletedOnboarding: boolean;
  preferences: IUserPreferences;
  createdAt: string;
  updatedAt: string;
}

const userPreferencesSchema = new Schema<IUserPreferences>(
  {
    currency: {
      type: String,
      enum: ['EUR'],
      default: 'EUR'
    },
    budgetStartDay: {
      type: Number,
      min: 1,
      max: 31,
      default: 1
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    budgetViewMode: {
      type: String,
      enum: ['essential', 'advanced'],
      default: 'essential'
    }
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    recoveryKeyHash: {
      type: String
    },
    recoveryKeyHint: {
      type: String,
      trim: true
    },
    resetEmailCodeHash: {
      type: String
    },
    resetEmailCodeExpiresAt: {
      type: Date
    },
    resetEmailCodeAttempts: {
      type: Number,
      default: 0
    },
    tokenVersion: {
      type: Number,
      default: 0
    },
    webauthnCredentials: {
      type: [
        {
          credentialId: { type: String, required: true },
          publicKey: { type: String, required: true },
          counter: { type: Number, required: true, default: 0 },
          transports: { type: [String], default: [] }
        }
      ],
      default: []
    },
    webauthnChallenge: {
      type: String,
      required: false
    },
    webauthnChallengeExpiresAt: {
      type: Date,
      required: false
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    },
    avatarEmoji: {
      type: String,
      default: '🧑',
      trim: true
    },
    hasCompletedOnboarding: {
      type: Boolean,
      default: false
    },
    preferences: {
      type: userPreferencesSchema,
      default: () => ({
        currency: 'EUR',
        budgetStartDay: 1,
        theme: 'light'
      })
    },
    notificationPreferences: {
      type: new Schema(
        {
          dailyReminderEnabled: { type: Boolean, default: false },
          dailyReminderHour: { type: String, default: '20:00' },
          upcomingDueAlertEnabled: { type: Boolean, default: true },
          envelopeThresholdAlertEnabled: { type: Boolean, default: true },
          sharedActivityAlertEnabled: { type: Boolean, default: true }
        },
        { _id: false }
      ),
      default: () => ({
        dailyReminderEnabled: false,
        dailyReminderHour: '20:00',
        upcomingDueAlertEnabled: true,
        envelopeThresholdAlertEnabled: true,
        sharedActivityAlertEnabled: true
      })
    }
  },
  {
    timestamps: true
  }
);

/**
 * Sérialise un utilisateur Mongoose vers la réponse API publique sans jamais exposer `passwordHash`.
 */
export function toUserResponse(user: IUser): UserResponse {
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    avatarEmoji: user.avatarEmoji,
    ...(user.recoveryKeyHint ? { recoveryKeyHint: user.recoveryKeyHint } : {}),
    hasCompletedOnboarding: user.hasCompletedOnboarding,
    hasBiometrics: (user.webauthnCredentials?.length ?? 0) > 0,
    preferences: {
      currency: user.preferences.currency,
      budgetStartDay: user.preferences.budgetStartDay,
      theme: user.preferences.theme,
      defaultTab: user.preferences.defaultTab ?? 'depenses',
      budgetViewMode: user.preferences.budgetViewMode ?? 'essential'
    },
    ...(user.notificationPreferences
      ? { notificationPreferences: user.notificationPreferences }
      : {}),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export const UserModel = mongoose.model<IUser>('User', userSchema);
