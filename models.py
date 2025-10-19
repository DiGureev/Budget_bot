from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class ChatData(db.Model):
    __tablename__ = 'chat_data'

    chat_id = db.Column(db.String, primary_key=True)
    state = db.Column(db.String, nullable=True)
    budget = db.Column(db.Float, nullable=True)
    remaining = db.Column(db.Float, nullable=True)
    month = db.Column(db.Integer, nullable=True)
    year = db.Column(db.Integer, nullable=True)

    categories = db.relationship('ExpenseCategory', back_populates='chat', cascade="all, delete-orphan")

class ExpenseCategory(db.Model):
    __tablename__ = 'expense_categories'

    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    chat_id = db.Column(db.String, db.ForeignKey('chat_data.chat_id'), nullable=False)
    total_spent = db.Column(db.Float, default=0.0, nullable=False)

    chat = db.relationship('ChatData', back_populates='categories')

