import os
from flask import Flask, request
from telegram import Bot, Update
from telegram.ext import Dispatcher, CommandHandler, MessageHandler, Filters, CallbackQueryHandler

from bot_logic import handle_start, handle_text, handle_setbudget, handle_budget_callback, handle_categories, handle_categories_callback
from datetime import datetime
from storage import list_chats, get_categories, update_chat_data, update_category

from dotenv import load_dotenv
load_dotenv()


BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBHOOK_SECRET_PATH = os.getenv("WEBHOOK_SECRET_PATH")

app = Flask(__name__)
bot = Bot(token=BOT_TOKEN)

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
    chats = list_chats()

    print(now)
    print(chats)
    
    for chat in chats:
        if chat.month != now.month or chat.year != now.year:
            try:
                # Calculate totals
                total_spent = chat.budget - chat.remaining
                categories = get_categories(chat.chat_id)
                categorized_spent = sum(category.total_spent for category in categories)
                uncategorized_spent = total_spent - categorized_spent
                
                # Build category breakdown
                category_text = ""
                
                if categories or uncategorized_spent > 0:
                    category_text = "\n\n📊 Spending by category:"
                    
                    for category in categories:
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
            update_chat_data(chat.chat_id, {
                "budget": None,
                "remaining": None,
                "month": now.month,
                "year": now.year,
            })
            
            # Reset category spending to 0
            for category in categories:
                update_category(category.id, {"total_spent": 0.0})
    return "Reset complete"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
