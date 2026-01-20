import uuid
from dataclasses import dataclass
from typing import Any, Optional

from mongo_client import get_db


@dataclass
class ChatDataObj:
    chat_id: str
    state: Optional[str] = None
    budget: Optional[float] = None
    remaining: Optional[float] = None
    month: Optional[int] = None
    year: Optional[int] = None


@dataclass
class ExpenseCategoryObj:
    id: str
    name: str
    chat_id: str
    total_spent: float = 0.0


def _chats_col():
    return get_db()["chats"]


def _categories_col():
    return get_db()["categories"]


def _ensure_indexes():
    # Safe to call multiple times.
    _chats_col().create_index("chat_id", unique=True)
    _categories_col().create_index("chat_id")


_ensure_indexes()

def get_chat_data(chat_id):
    chat_id = str(chat_id)
    doc = _chats_col().find_one({"chat_id": chat_id})
    if not doc:
        return None
    return ChatDataObj(
        chat_id=doc["chat_id"],
        state=doc.get("state"),
        budget=doc.get("budget"),
        remaining=doc.get("remaining"),
        month=doc.get("month"),
        year=doc.get("year"),
    )

def update_chat_data(chat_id, updates: dict):
    chat_id = str(chat_id)
    allowed: set[str] = {"state", "budget", "remaining", "month", "year"}
    to_set: dict[str, Any] = {k: v for k, v in updates.items() if k in allowed}
    _chats_col().update_one(
        {"chat_id": chat_id},
        {"$set": {"chat_id": chat_id, **to_set}},
        upsert=True,
    )
    return get_chat_data(chat_id)

def get_categories(chat_id: str): 
    chat_id = str(chat_id)
    docs = list(_categories_col().find({"chat_id": chat_id}).sort("name", 1))
    return [
        ExpenseCategoryObj(
            id=d["id"],
            name=d["name"],
            chat_id=d["chat_id"],
            total_spent=float(d.get("total_spent", 0.0)),
        )
        for d in docs
    ]

def get_category(category_id: str):
    doc = _categories_col().find_one({"id": category_id})
    if not doc:
        return None
    return ExpenseCategoryObj(
        id=doc["id"],
        name=doc["name"],
        chat_id=doc["chat_id"],
        total_spent=float(doc.get("total_spent", 0.0)),
    )

def add_category(name, chat_id):
    chat_id = str(chat_id)
    category_id = str(uuid.uuid4())
    doc = {
        "id": category_id,
        "name": name,
        "chat_id": chat_id,
        "total_spent": 0.0,
    }
    _categories_col().insert_one(doc)
    return ExpenseCategoryObj(**doc)

def update_category(category_id: str, updates: dict):
    allowed: set[str] = {"name", "total_spent"}
    to_set: dict[str, Any] = {k: v for k, v in updates.items() if k in allowed}
    res = _categories_col().update_one({"id": category_id}, {"$set": to_set})
    if res.matched_count == 0:
        return None
    return get_category(category_id)

def delete_category(category_id):
    res = _categories_col().delete_one({"id": category_id})
    return res.deleted_count > 0


def list_chats() -> list[ChatDataObj]:
    docs = list(_chats_col().find({}))
    return [
        ChatDataObj(
            chat_id=d["chat_id"],
            state=d.get("state"),
            budget=d.get("budget"),
            remaining=d.get("remaining"),
            month=d.get("month"),
            year=d.get("year"),
        )
        for d in docs
    ]
