// src/models/User.js
import mongoose from "mongoose";
import {IUser} from "../types.js";

const UserStateSchema = new mongoose.Schema(
  {
    step: {type: String, default: null},
    payload: {type: mongoose.Schema.Types.Mixed, default: {}},
  },
  {_id: false}
);

const UserSchema = new mongoose.Schema<IUser>(
  {
    telegramUserId: {type: Number, required: true, unique: true, index: true},
    chatId: {type: Number, required: true},
    username: {type: String, default: null},
    firstName: {type: String, default: null},

    onboarding: {
      emailSubmitted: {type: Boolean, default: false},
      completed: {type: Boolean, default: false},
    },

    defaultCategoryId: {type: String, default: null},

    state: {type: UserStateSchema, default: () => ({})},

    lastSeenAt: {type: Date, default: null},
  },
  {timestamps: true}
);
export default mongoose.model<IUser>("User", UserSchema);
