import os
from models import db, ChatData
from flask import Flask, request
from telegram import Bot, Update
from telegram.ext import Dispatcher, CommandHandler, MessageHandler, Filters, CallbackQueryHandler

from bot_logic import handle_start, handle_text, handle_setbudget, handle_budget_callback
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()


BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBHOOK_SECRET_PATH = os.getenv("WEBHOOK_SECRET_PATH")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")  # Add this: your Render URL + secret path

app = Flask(__name__)
bot = Bot(token=BOT_TOKEN)

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    db.create_all()

# Create dispatcher without running a polling thread
dispatcher = Dispatcher(bot=bot, update_queue=None, workers=0, use_context=True)

# Register handlers
dispatcher.add_handler(CommandHandler("start", handle_start))
dispatcher.add_handler(CommandHandler("setbudget", handle_setbudget))
dispatcher.add_handler(MessageHandler(Filters.text & ~Filters.command, handle_text))
dispatcher.add_handler(CallbackQueryHandler(handle_budget_callback))


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
    now = datetime.now()
    chats = ChatData.query.all()
    
    for chat in chats:
        if chat.month != now.month or chat.year != now.year:
            try:
                bot.send_message(
                    chat_id=int(chat.chat_id),
                    text=f"📅 Month ended. Remaining: {chat.remaining}.\nUse /start to begin new month."
                )
            except Exception as e:
                print(f"Error notifying {chat.chat_id}: {e}")
            db.session.delete(chat)
    db.session.commit()
    
    return "Reset complete"



@app.route("/set_webhook", methods=["GET"])
def set_webhook():
    """Call this once to set up the webhook"""
    try:
        webhook_url = f"{WEBHOOK_URL}/{WEBHOOK_SECRET_PATH}"
        bot.set_webhook(url=webhook_url)
        return f"Webhook set to {webhook_url}"
    except Exception as e:
        return f"Error setting webhook: {e}"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
