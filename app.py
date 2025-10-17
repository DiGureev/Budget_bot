import os
from flask import Flask, request
from telegram import Bot, Update
from telegram.ext import Dispatcher, CommandHandler, MessageHandler, Filters

from bot_logic import handle_start, handle_text, handle_setbudget
from storage import load_data, save_data
from datetime import datetime

BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBHOOK_SECRET_PATH = os.getenv("WEBHOOK_SECRET_PATH")

app = Flask(__name__)
bot = Bot(token=BOT_TOKEN)

# Create dispatcher without running a polling thread
dispatcher = Dispatcher(bot=bot, update_queue=None, workers=0, use_context=True)

# Register handlers
dispatcher.add_handler(CommandHandler("start", handle_start))
dispatcher.add_handler(CommandHandler("setbudget", handle_setbudget))
dispatcher.add_handler(MessageHandler(Filters.text & ~Filters.command, handle_text))


@app.route("/")
def home():
    return "Bot is running."


@app.route(f"/{WEBHOOK_SECRET_PATH}", methods=["POST"])
def webhook():
    update = Update.de_json(request.get_json(force=True), bot)
    dispatcher.process_update(update)
    return "OK"


@app.route("/cron", methods=["GET"])
def cron_reset():
    data = load_data()
    now = datetime.now()

    for chat_id, chat_data in list(data.items()):
        if chat_data.get("month") != now.month or chat_data.get("year") != now.year:
            try:
                bot.send_message(
                    chat_id=int(chat_id),
                    text=f"📅 Month ended. Remaining: {chat_data['remaining']}.\nUse /start to begin new month."
                )
            except Exception as e:
                print(f"Error notifying {chat_id}: {e}")
            del da
