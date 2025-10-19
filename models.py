from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class ChatData(db.Model):
    chat_id = db.Column(db.String, primary_key=True)
    state = db.Column(db.String, nullable=True)
    budget = db.Column(db.Float, nullable=True)
    remaining = db.Column(db.Float, nullable=True)
    month = db.Column(db.Integer, nullable=True)
    year = db.Column(db.Integer, nullable=True)
