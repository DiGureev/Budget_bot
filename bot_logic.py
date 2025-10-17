# bot_logic.py

from telegram import Update
from telegram.ext import CallbackContext
from storage import load_data, save_data, update_chat_data

def handle_start(update: Update, context: CallbackContext):
    chat_id = str(update.message.chat_id)
    data = load_data()

    if chat_id in data:
        update.message.reply_text("👋 Welcome back! Use /setbudget to update your monthly budget.")
    else:
        update_chat_data(chat_id, {
            "state": "awaiting_budget",
            "month": None,
            "year": None,
            "budget": 0,
            "remaining": 0
        })
        update.message.reply_text("💰 How much money do you want to spend this month? Please send just the number.")

def handle_setbudget(update: Update, context: CallbackContext):
    chat_id = str(update.message.chat_id)
    update_chat_data(chat_id, {"state": "awaiting_budget"})
    update.message.reply_text("🔁 OK. Send the new budget number.")

def handle_text(update: Update, context: CallbackContext):
    chat_id = str(update.message.chat_id)
    text = update.message.text.strip()
    data = load_data()
    chat_data = data.get(chat_id, {})

    state = chat_data.get("state")

    if state == "awaiting_budget":
        try:
            budget = float(text)
            chat_data["temp_budget"] = budget
            chat_data["state"] = "awaiting_confirmation"
            save_data(data)
            update.message.reply_text(f"❓ You entered {budget}. Send 'confirm' to set this as your budget, or 'change' to enter a different number.")
        except ValueError:
            update.message.reply_text("❌ Please enter a valid number.")
    elif state == "awaiting_confirmation":
        if text.lower() == "confirm":
            budget = chat_data["temp_budget"]
            now = datetime.now()
            chat_data.update({
                "budget": budget,
                "remaining": budget,
                "month": now.month,
                "year": now.year,
                "state": None
            })
            save_data(data)
            update.message.reply_text(f"✅ Budget of {budget} set for this month.")
        elif text.lower() == "change":
            chat_data["state"] = "awaiting_budget"
            save_data(data)
            update.message.reply_text("🔁 OK. Send the new budget number.")
        else:
            update.message.reply_text("❓ Send 'confirm' to confirm the budget, or 'change' to change it.")
    else:
        update.message.reply_text("❓ I didn't understand that. Use /start to begin or /setbudget to set your budget.")
