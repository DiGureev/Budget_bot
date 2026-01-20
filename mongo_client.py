import os

from pymongo import MongoClient


_client: MongoClient | None = None


def get_mongo_client() -> MongoClient:
    """
    Singleton Mongo client.

    Requires env var:
    - MONGODB_URI (MongoDB Atlas connection string, usually mongodb+srv://...)
    """
    global _client
    if _client is not None:
        return _client

    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise RuntimeError("Missing env var MONGODB_URI")

    _client = MongoClient(uri)
    return _client


def get_db_name() -> str:
    # Optional override; otherwise use a stable default.
    return os.getenv("MONGODB_DB", "family_budget_bot")


def get_db():
    client = get_mongo_client()
    return client[get_db_name()]


