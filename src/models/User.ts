// src/models/User.js
import mongoose, { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<IUser>;

export interface IUser {
  /** Last Telegram user who interacted in this chat (DM or group member). */
  telegramUserId: number | null;
  /** Workspace key: private chat or group — shared by all members. */
  chatId: number;
  username: string | null;
  firstName: string | null;
  onboarding: {
    emailSubmitted: boolean;
    completed: boolean;
  };
  defaultCategoryId: string | null;
  state: {
    step: string | null;
    payload: Record<string, unknown>;
  };
  lastSeenAt: Date | null;
}

const UserStateSchema = new mongoose.Schema(
  {
    step: { type: String, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema<IUser>(
  {
    telegramUserId: { type: Number, default: null, index: true },
    chatId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: null },
    firstName: { type: String, default: null },

    onboarding: {
      emailSubmitted: { type: Boolean, default: false },
      completed: { type: Boolean, default: false },
    },

    defaultCategoryId: { type: String, default: null },

    state: { type: UserStateSchema, default: () => ({}) },

    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);
export default mongoose.model<IUser>('User', UserSchema);
