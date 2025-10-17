import json
import os
from config import DATA_FILE

def load_data():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

def get_chat_data(chat_id):
    data = load_data()
    return data.get(str(chat_id), None)

def update_chat_data(chat_id, chat_data):
    data = load_data()
    data[str(chat_id)] = chat_data
    save_data(data)

def delete_chat_data(chat_id):
    data = load_data()
    if str(chat_id) in data:
        del data[str(chat_id)]
        save_data(data)
