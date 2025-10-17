from flask import Flask, request
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters
from config import BOT_TOKEN, WEBHOOK_SECRET_PATH
from bot_logic import handle_start, handle_text, handle_setbudget
from storage import load_data, update_chat_data, save_data
from datetime import datetime
import asyncio

app = Flask(__name__)

telegram_app = Application.builder().token(BOT_TOKEN).build()
telegram_app.add_handler(CommandHandler("start", handle_start))
telegram_app.add_handler(CommandHandler("setbudget", handle_setbudget))
telegram_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

@app.route('/')
def hello():
    return "Hello, Family Budget Bot is running!"

@app.route(f"/{WEBHOOK_SECRET_PATH}", methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), telegram_app.bot)
    asyncio.run(telegram_app.process_update(update))
    return "ok"

@app.route("/cron", methods=["GET"])
def cron_reset():
    """This route can be called daily via Render cron job."""
    data = load_data()
    now = datetime.now()

    for chat_id, chat_data in list(data.items()):
        # End month if not current
        if chat_data.get("month") != now.month or chat_data.get("year") != now.year:
            # Notify end of month
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
    print("Starting Flask app...")
    app.run(host="0.0.0.0", port=5001, debug=True)
    print("Flask app.run exited")
