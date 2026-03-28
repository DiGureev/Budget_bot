import mongoose, { Schema } from 'mongoose';
const UserStateSchema = new Schema({
    step: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, default: {} },
}, { _id: false });
const UserSchema = new Schema({
    telegramUserId: { type: Number, required: true, unique: true, index: true },
    chatId: { type: Number, required: true },
    username: { type: String, default: null },
    firstName: { type: String, default: null },
    onboarding: {
        emailSubmitted: { type: Boolean, default: false },
        completed: { type: Boolean, default: false },
    },
    defaultCategoryId: { type: String, default: null },
    state: { type: UserStateSchema, default: () => ({}) },
    lastSeenAt: { type: Date, default: null },
}, { timestamps: true });
const User = mongoose.model('User', UserSchema);
export default User;
