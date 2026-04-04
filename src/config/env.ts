import dotenv from "dotenv";

dotenv.config();

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const MONGODB_URI = process.env.MONGODB_URI;
export const NODE_ENV = process.env.NODE_ENV || "development";
export const KIT_API_KEY = process.env.KIT_API_KEY;
export const KIT_TAG_ID = process.env.KIT_TAG_ID;
export const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;
