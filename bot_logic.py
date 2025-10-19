from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import CallbackContext

from storage import get_chat_data, update_chat_data, get_categories, get_category, add_category, update_category, delete_category
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
    elif state == "waiting for category":
        add_category(text, chat_id)
        update_chat_data(chat_id, {"state": None})
        update.message.reply_text(f"Category '{text}' added.")
    elif state and state.startswith("awaiting_expense_for_category_"):
            category_id = state.replace("awaiting_expense_for_category_", "")
            try:
                amount = float(text)
                chat_data = get_chat_data(chat_id)
                category = get_category(category_id)
                if not category or category.chat_id != chat_id:
                    update.message.reply_text("❌ Invalid category.")
                    return

                # Update budget and category total
                remaining = chat_data.remaining
                new_total = category.total_spent

                if amount >= 0:
                    new_total = category.total_spent + amount     # add spending
                    remaining -= amount                           # subtract from remaining budget
                    update.message.reply_text(
                        f"✅ {amount:.2f} added to '{category.name}'. Remaining budget: {remaining:.2f}")
                else:
                    refund = abs(amount)
                    new_total = category.total_spent - refund    # subtract refund from total spent
                    remaining += refund                           # add refund back to remaining budget
                    update.message.reply_text(
                        f"🔄 Refund of {refund:.2f} applied to '{category.name}'. Remaining: {remaining:.2f}")

                    
                update_chat_data(chat_id, {"remaining": remaining, "state": None})
                update_category(category_id, {"total_spent": new_total})


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

def handle_categories(update: Update, context: CallbackContext):
    chat_id = str(update.message.chat_id)

    categories = get_categories(chat_id)

    keyboard = [
        [InlineKeyboardButton(f"{c.name} - {c.total_spent:.2f}", callback_data=f"category_{c.id}")]
        for c in categories
    ]

    keyboard.append([InlineKeyboardButton("➕ Add category", callback_data="add_category")])
    reply_markup = InlineKeyboardMarkup(keyboard)

    update.message.reply_text("📊 Your categories and totals:", reply_markup=reply_markup)


def handle_categories_callback(update: Update, context: CallbackContext):
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    data = query.data

    query.answer()

    if data == "add_category":
        update_chat_data(chat_id, {"state": "waiting for category"})
        query.edit_message_text("📝 Please send the name of the new category.")

    elif data.startswith("category_"):
        category_id = data.split("_", 1)[1]  # Extract the category ID
        category = get_category(category_id)
        
        if not category or category.chat_id != chat_id:
            query.edit_message_text("❌ Invalid category.")
            return
        
        # Show options: add expense or delete
        keyboard = [
            [InlineKeyboardButton("💸 Add Expense", callback_data=f"expense_{category_id}")],
            [InlineKeyboardButton("🗑️ Delete Category", callback_data=f"delete_{category_id}")],
            [InlineKeyboardButton("⬅️ Back", callback_data="back_to_categories")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        query.edit_message_text(
            f"📊 Category: {category.name}\n💰 Total spent: {category.total_spent:.2f}\n\nWhat would you like to do?",
            reply_markup=reply_markup
        )
    
    elif data.startswith("expense_"):
        category_id = data.split("_", 1)[1]
        update_chat_data(chat_id, {
            "state": f"awaiting_expense_for_category_{category_id}"
        })
        query.edit_message_text("💸 Please enter the amount to record for this category.")
    
    elif data.startswith("delete_"):
        category_id = data.split("_", 1)[1]
        category = get_category(category_id)
        
        if not category or category.chat_id != chat_id:
            query.edit_message_text("❌ Invalid category.")
            return
        
        # Confirmation buttons
        keyboard = [
            [
                InlineKeyboardButton("✅ Yes, Delete", callback_data=f"confirm_delete_{category_id}"),
                InlineKeyboardButton("❌ Cancel", callback_data="back_to_categories")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        query.edit_message_text(
            f"⚠️ Are you sure you want to delete '{category.name}'?\n\n💰 Total spent in this category: {category.total_spent:.2f}\n\nThis cannot be undone!",
            reply_markup=reply_markup
        )
    
    elif data.startswith("confirm_delete_"):
        category_id = data.split("_", 2)[2]
        category = get_category(category_id)
        
        if category and category.chat_id == chat_id:
            category_name = category.name
            delete_category(category_id)
            query.edit_message_text(f"🗑️ Category '{category_name}' has been deleted.")
        else:
            query.edit_message_text("❌ Category not found.")
    
    elif data == "back_to_categories":
        # Show categories list again
        categories = get_categories(chat_id)
        
        keyboard = [
            [InlineKeyboardButton(f"{c.name} - {c.total_spent:.2f}", callback_data=f"category_{c.id}")]
            for c in categories
        ]
        keyboard.append([InlineKeyboardButton("➕ Add category", callback_data="add_category")])
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        query.edit_message_text("📊 Your categories and totals:", reply_markup=reply_markup)

