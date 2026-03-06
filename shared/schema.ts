import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const exports = pgTable("exports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  r2Key: text("r2_key").notNull(),
  fileSize: integer("file_size").notNull(),
  durationMs: integer("duration_ms"),
  scriptData: text("script_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertExportSchema = createInsertSchema(exports).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertExport = z.infer<typeof insertExportSchema>;
export type Export = typeof exports.$inferSelect;
