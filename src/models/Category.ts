import mongoose, {Schema, type Model} from "mongoose";
import {ICategory} from "../types.js";

const MonthlyHistorySchema = new Schema(
  {
    year: Number,
    month: Number,
    budget: Number,
    spent: Number,
  },
  {_id: false},
);

const AnnualYearHistorySchema = new Schema(
  {
    year: Number,
    budget: Number,
    spent: Number,
  },
  {_id: false},
);

const CategorySchema = new Schema<ICategory>(
  {
    ownerId: {type: Number, required: true, index: true},
    ownerType: {
      type: String,
      enum: ["user", "group"],
      required: true,
    },

    name: {type: String, required: true},
    nameKey: {type: String, required: true},

    type: {type: String, enum: ["monthly", "annual"], required: true},
    status: {type: String, enum: ["active", "archived"], default: "active"},

    currentBudget: {type: Number, required: true},
    currentSpent: {type: Number, default: 0},

    period: {
      year: Number,
      month: Number,
    },

    currentYearMonthlySpent: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },

    history: {
      months: {type: [MonthlyHistorySchema], default: []},
      years: {type: [AnnualYearHistorySchema], default: []},
    },
  },
  {timestamps: true},
);

CategorySchema.index(
  {ownerId: 1, ownerType: 1, nameKey: 1, status: 1},
  {unique: true},
);

const Category: Model<ICategory> = mongoose.model<ICategory>(
  "Category",
  CategorySchema,
);

export default Category;
