from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import CallbackContext

from storage import get_chat_data, update_chat_data
from datetime import datetime

def handle_start(update: Update, context: CallbackContext):
    chat_id = str(update.message.chat_id)
    chat_data = get_chat_data(chat_id)

    if chat_data:
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
    chat_data = get_chat_data(chat_id)

    if not chat_data:
        update.message.reply_text("⚠️ Please start with /start or /setbudget to set your budget.")
        return

    state = chat_data.state

    if state == "awaiting_budget":
        try:
            budget = float(text)
            update_chat_data(chat_id, {
                "budget": budget,
                "remaining": budget,
                "state": "awaiting_confirmation"
            })

            keyboard = [
                [
                    InlineKeyboardButton("✅ Confirm", callback_data='confirm_budget'),
                    InlineKeyboardButton("✏️ Change", callback_data='change_budget'),
                ]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)

            update.message.reply_text(
                f"❓ You entered {budget}. Please confirm or change:",
                reply_markup=reply_markup
            )

        except ValueError:
            update.message.reply_text("❌ Please enter a valid number.")

    else:
        try:
            expense = float(text)
            budget = chat_data.budget
            remaining = chat_data.remaining

            if budget == 0:
                update.message.reply_text("⚠️ You haven't set a budget yet. Use /setbudget to start.")
                return

            if expense > 0:
                remaining -= expense
                update.message.reply_text(f"💸 Spent {expense}. Remaining budget: {remaining:.2f}")
            elif expense < 0:
                remaining += abs(expense)
                update.message.reply_text(f"🔄 Refund of {abs(expense)} added. Remaining budget: {remaining:.2f}")
            else:
                update.message.reply_text("⚠️ Please enter a non-zero number.")
                return

            update_chat_data(chat_id, {"remaining": remaining})

        except ValueError:
            update.message.reply_text("❓ I didn't understand that. Use /start to begin or /setbudget to set your budget.")

def handle_budget_callback(update: Update, context: CallbackContext):
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    chat_data = get_chat_data(chat_id)

    query.answer()

    if query.data == "confirm_budget":
        now = datetime.now()
        update_chat_data(chat_id, {
            "month": now.month,
            "year": now.year,
            "state": None,
        })
        query.edit_message_text(f"✅ Budget of {chat_data.budget} set for this month.")

    elif query.data == "change_budget":
        update_chat_data(chat_id, {
            "budget": 0,
            "remaining": 0,
            "state": "awaiting_budget",
        })
        query.edit_message_text("🔁 OK. Send the new budget number.")

    else:
        query.answer(text="Unknown action.")
