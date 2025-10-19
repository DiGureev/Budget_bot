from models import db, ChatData, ExpenseCategory

def get_chat_data(chat_id):
    chat = ChatData.query.get(str(chat_id))
    return chat

def update_chat_data(chat_id, updates: dict):
    chat_id = str(chat_id)
    chat = ChatData.query.get(chat_id)
    if not chat:
        chat = ChatData(chat_id=chat_id)
        db.session.add(chat)

    for key, value in updates.items():
        setattr(chat, key, value)

    db.session.commit()
    return chat

def get_categories(chat_id: str): 
    categories = ExpenseCategory.query.filter_by(chat_id=chat_id).all()
    return categories

def get_category(category_id: str):
    category = ExpenseCategory.query.get(category_id)
    return category

def add_category(name: str, chat_id: str):
    new_category = ExpenseCategory(name=name, chat_id=chat_id, total_spent=0)
    db.session.add(new_category)
    db.session.commit()
    return new_category

def update_category(category_id: str, updates: dict):
    category = ExpenseCategory.query.get(category_id)
    if not category:
        return None 

    for key, value in updates.items():
        setattr(category, key, value)

    db.session.commit()
    return category
