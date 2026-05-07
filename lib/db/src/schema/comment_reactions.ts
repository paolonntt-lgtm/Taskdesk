import { pgTable, integer, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { ticketCommentsTable } from "./ticket_comments";
import { usersTable } from "./users";

export const commentReactionsTable = pgTable("comment_reactions", {
  commentId: integer("comment_id").notNull().references(() => ticketCommentsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("comment_reactions_unique").on(t.commentId, t.userId, t.emoji),
  index("comment_reactions_comment_id_idx").on(t.commentId),
]);

export type CommentReaction = typeof commentReactionsTable.$inferSelect;
