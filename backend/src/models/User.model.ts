import mongoose, { type Document, Schema } from 'mongoose';

export type CurrencyCode = 'EUR';
export type ThemeMode = 'light' | 'dark';

export interface IUserPreferences {
  currency: CurrencyCode;
  budgetStartDay: number;
  theme: ThemeMode;
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  recoveryKeyHash?: string;
  recoveryKeyHint?: string;
  resetEmailCodeHash?: string;
  resetEmailCodeExpiresAt?: Date;
  resetEmailCodeAttempts: number;
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
    preferences: {
      currency: user.preferences.currency,
      budgetStartDay: user.preferences.budgetStartDay,
      theme: user.preferences.theme
    },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export const UserModel = mongoose.model<IUser>('User', userSchema);
