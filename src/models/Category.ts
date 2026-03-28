import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IMonthlyHistoryEntry {
  year: number;
  month: number;
  budget: number;
  spent: number;
}

export interface IAnnualYearHistoryEntry {
  year: number;
  budget: number;
  spent: number;
}

export interface ICategory extends Document {
  userId: number;
  name: string;
  nameKey: string;
  type: 'monthly' | 'annual';
  status: 'active' | 'archived';
  currentBudget: number;
  currentSpent: number;
  period: {
    year: number;
    month: number | null;
  };
  currentYearMonthlySpent: Map<string, number>;
  history: {
    months: IMonthlyHistoryEntry[];
    years: IAnnualYearHistoryEntry[];
  };
}

const MonthlyHistorySchema = new Schema(
  {
    year: Number,
    month: Number,
    budget: Number,
    spent: Number,
  },
  { _id: false }
);

const AnnualYearHistorySchema = new Schema(
  {
    year: Number,
    budget: Number,
    spent: Number,
  },
  { _id: false }
);

const CategorySchema = new Schema<ICategory>(
  {
    userId: { type: Number, required: true, index: true },

    name: { type: String, required: true },
    nameKey: { type: String, required: true },

    type: { type: String, enum: ['monthly', 'annual'], required: true },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },

    currentBudget: { type: Number, required: true },
    currentSpent: { type: Number, default: 0 },

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
      months: { type: [MonthlyHistorySchema], default: [] },
      years: { type: [AnnualYearHistorySchema], default: [] },
    },
  },
  { timestamps: true }
);

CategorySchema.index({ userId: 1, nameKey: 1, status: 1 }, { unique: true });

const Category: Model<ICategory> = mongoose.model<ICategory>('Category', CategorySchema);
export default Category;
