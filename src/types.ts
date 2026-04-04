import {HydratedDocument, type Document} from "mongoose";

export type CategoryType = "monthly" | "annual";
export interface IUser {
  telegramUserId: number;
  chatId: number;
  username: string | null;
  firstName: string | null;
  onboarding: {
    emailSubmitted: boolean;
    completed: boolean;
  };
  defaultCategoryId: string | null;
  state: {
    step: string | null;
    context: {
      ownerId: number;
      ownerType: "user" | "group";
    } | null;
    payload: Record<string, unknown>;
  };
  lastSeenAt: Date | null;
}

export type UserDocument = HydratedDocument<IUser>;

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
  ownerId: number;
  ownerType: "user" | "group";

  name: string;
  nameKey: string;

  type: CategoryType;
  status: "active" | "archived";

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

export interface IBackupLog extends Document {
  dateKey: string;
  status: "running" | "success" | "failed";
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
}

export type Context = {
  ownerId: number;
  ownerType: "user" | "group";
};
