from telegram import Update, KeyboardButton, ReplyKeyboardMarkup
from telegram.ext import ContextTypes
from datetime import datetime
from storage import get_chat_data, update_chat_data, delete_chat_data

def is_valid_number(text):
    try:
        float(text)
        return True
    except ValueError:
        return False

async def handle_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    now = datetime.now()

    chat_data = get_chat_data(chat_id)

    if chat_data and chat_data.get("month") == now.month and chat_data.get("year") == now.year:
        await update.message.reply_text(
            f"📅 This month's budget is already set to {chat_data['budget']}. Remaining: {chat_data['remaining']}.\n"
            f"You can update it with /setbudget if needed."
        )
        return

    delete_chat_data(chat_id)
    await update.message.reply_text("💰 How much money do you want to spend this month? Please send just the number.")

    context.user_data["awaiting_budget"] = True

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    text = update.message.text.strip()

    if not is_valid_number(text):
        await update.message.reply_text("🚫 Please send only numbers (budget or spending).")
        return

    now = datetime.now()
    raw_amount = float(text)
    amount = int(raw_amount) if raw_amount.is_integer() else raw_amount

    chat_data = get_chat_data(chat_id)

    # If waiting for new budget setup
    if context.user_data.get("awaiting_budget"):
        context.user_data["proposed_budget"] = amount
        context.user_data["awaiting_budget"] = False

        confirm_buttons = [[KeyboardButton("Confirm")], [KeyboardButton("Change")]]
        await update.message.reply_text(
            f"✅ You want to set the monthly budget to {amount}.\nConfirm or Change?",
            reply_markup=ReplyKeyboardMarkup(confirm_buttons, one_time_keyboard=True, resize_keyboard=True)
        )
        return

    # If user is confirming or changing
    if text.lower() == "confirm" and "proposed_budget" in context.user_data:
        proposed = context.user_data["proposed_budget"]
        new_data = {
            "year": now.year,
            "month": now.month,
            "budget": proposed,
            "spent": 0,
            "remaining": proposed,
            "confirmed": True
        }
        update_chat_data(chat_id, new_data)
        await update.message.reply_text(f"🎉 Budget confirmed: {proposed}. Let's start tracking!", reply_markup=None)
        context.user_data.clear()
        return

    if text.lower() == "change":
        context.user_data["awaiting_budget"] = True
        await update.message.reply_text("🔁 OK. Send the new budget number.")
        return

    # Spending logic
    if not chat_data or chat_data.get("month") != now.month or chat_data.get("year") != now.year:
        await update.message.reply_text("⚠️ No budget set for this month. Use /start to set one.")
        return

    if chat_data["remaining"] < amount:
        await update.message.reply_text("❌ You don't have enough money to spend.")
        return

    chat_data["spent"] += amount
    chat_data["remaining"] -= amount
    update_chat_data(chat_id, chat_data)

    await update.message.reply_text(
        f"✅ {amount} recorded. Remaining: {chat_data['remaining']}"
    )

async def handle_setbudget(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    now = datetime.now()

    if len(context.args) != 1 or not is_valid_number(context.args[0]):
        await update.message.reply_text("Usage: /setbudget <amount>")
        return

    new_budget = float(context.args[0])
    chat_data = get_chat_data(chat_id)

    if not chat_data or chat_data.get("month") != now.month or chat_data.get("year") != now.year:
        chat_data = {
            "year": now.year,
            "month": now.month,
            "spent": 0
        }

    chat_data["budget"] = new_budget
    chat_data["remaining"] = new_budget - chat_data.get("spent", 0)
    update_chat_data(chat_id, chat_data)

    await update.message.reply_text(
        f"🔧 Budget updated to {new_budget}. Spent: {chat_data['spent']}. Remaining: {chat_data['remaining']}"
    )
