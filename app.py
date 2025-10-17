import os
import asyncio
import logging
from flask import Flask, request
from telegram import Update
from telegram.ext import Dispatcher, CommandHandler, MessageHandler, filters
from bot_logic import handle_start, handle_text, handle_setbudget
from storage import load_data, save_data
from datetime import datetime

BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBHOOK_SECRET_PATH = os.getenv("WEBHOOK_SECRET_PATH")

app = Flask(__name__)

# Build Telegram application
telegram_app = Dispatcher.builder().token(BOT_TOKEN).build()

# Register handlers
telegram_app.add_handler(CommandHandler("start", handle_start))
telegram_app.add_handler(CommandHandler("setbudget", handle_setbudget))
telegram_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

# Initialize telegram_app once at startup
async def initialize_app():
    await telegram_app.initialize()

asyncio.run(initialize_app())

# Create one persistent event loop for the Flask app to use
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

@app.route('/')
def hello():
    return "Hello, Family Budget Bot is running!"

@app.route(f"/{WEBHOOK_SECRET_PATH}", methods=["POST"])
def webhook():
    global loop  # <-- move this to the very top of the function
    update = Update.de_json(request.get_json(force=True), telegram_app.bot)
    try:
        # Run update processing on the persistent event loop
        loop.run_until_complete(telegram_app.process_update(update))
    except RuntimeError as e:
        # If event loop closed accidentally, recreate it and retry
        logging.error(f"Event loop error: {e}. Recreating event loop.")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(telegram_app.process_update(update))
    except Exception as e:
        logging.error(f"Unexpected error in webhook: {e}")
        raise e
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
                logging.error(f"Error notifying {chat_id}: {e}")
            del data[chat_id]

    save_data(data)
    return "Cron OK"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Flask app on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)
