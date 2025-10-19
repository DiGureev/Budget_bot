from models import db, ChatData
from datetime import datetime

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
