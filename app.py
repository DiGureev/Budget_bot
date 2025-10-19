import os
from models import db, ChatData
from flask import Flask, request
from telegram import Bot, Update
from telegram.ext import Dispatcher, CommandHandler, MessageHandler, Filters, CallbackQueryHandler

from bot_logic import handle_start, handle_text, handle_setbudget, handle_budget_callback, handle_categories, handle_categories_callback
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
dispatcher.add_handler(CommandHandler("categories", handle_categories))
dispatcher.add_handler(MessageHandler(Filters.text & ~Filters.command, handle_text))
dispatcher.add_handler(CallbackQueryHandler(handle_budget_callback, pattern='^(confirm_budget|change_budget)$'))
dispatcher.add_handler(CallbackQueryHandler(
    handle_categories_callback, 
    pattern='^(add_category|category_.*|expense_.*|delete_.*|confirm_delete_.*|back_to_categories)$'
))

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
                # Calculate totals
                total_spent = chat.budget - chat.remaining
                categorized_spent = sum(category.total_spent for category in chat.categories)
                uncategorized_spent = total_spent - categorized_spent
                
                # Build category breakdown
                category_text = ""
                
                if chat.categories or uncategorized_spent > 0:
                    category_text = "\n\n📊 Spending by category:"
                    
                    for category in chat.categories:
                        if category.total_spent > 0:
                            category_text += f"\n• {category.name}: {category.total_spent:.2f}"
                    
                    if uncategorized_spent > 0:
                        category_text += f"\n• Uncategorized: {uncategorized_spent:.2f}"
                
                # Send summary message
                bot.send_message(
                    chat_id=int(chat.chat_id),
                    text=f"📅 Month ended!\n\n💰 Budget: {chat.budget:.2f}\n💸 Total spent: {total_spent:.2f}\n💵 Remaining: {chat.remaining:.2f}{category_text}\n\n🔄 Budget reset for new month. Use /setbudget to set your new budget."
                )
            except Exception as e:
                print(f"Error notifying {chat.chat_id}: {e}")
            
            # Reset totals
            chat.remaining = chat.budget
            chat.month = now.month
            chat.year = now.year
            
            # Reset category spending to 0
            for category in chat.categories:
                category.total_spent = 0.0
    
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
