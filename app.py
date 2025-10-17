import os
import asyncio
from flask import Flask, request
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from config import BOT_TOKEN, WEBHOOK_SECRET_PATH
from bot_logic import handle_start, handle_text, handle_setbudget
from storage import load_data, save_data, update_chat_data
from datetime import datetime

app = Flask(__name__)

# Build Telegram application
telegram_app = Application.builder().token(BOT_TOKEN).build()

# Register handlers
telegram_app.add_handler(CommandHandler("start", handle_start))
telegram_app.add_handler(CommandHandler("setbudget", handle_setbudget))
telegram_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))


@app.route('/')
def hello():
    return "Hello, Family Budget Bot is running!"


@app.route(f"/{WEBHOOK_SECRET_PATH}", methods=["POST"])
async def webhook():
    update = Update.de_json(request.get_json(force=True), telegram_app.bot)

    # ✅ Properly initialize before processing update
    if not telegram_app.running:
        await telegram_app.initialize()

    await telegram_app.process_update(update)
    return "ok"


@app.route("/cron", methods=["GET"])
def cron_reset():
    """Called daily by Render cron job to reset month if needed"""
    data = load_data()
    now = datetime.now()

    for chat_id, chat_data in list(data.items()):
        if chat_data.get("month") != now.month or chat_data.get("year") != now.year:
            try:
                telegram_app.bot.send_message(
                    chat_id=int(chat_id),
                    text=f"📅 Month ended. Remaining: {chat_data['remaining']}.\nUse /start to begin new month."
                )
            except Exception as e:
                print(f"Error notifying {chat_id}: {e}")
            del data[chat_id]

    save_data(data)
    return "Cron OK"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Flask app on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)
