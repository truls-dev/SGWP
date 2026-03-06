import { type User, type InsertUser, type Export, type InsertExport, users, exports } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { randomUUID } from "crypto";

neonConfig.webSocketConstructor = ws;

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createExport(data: InsertExport): Promise<Export>;
  getExports(): Promise<Export[]>;
  getExport(id: string): Promise<Export | undefined>;
  updateExportScript(id: string, scriptData: string): Promise<void>;
  deleteExport(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private db;

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    this.db = drizzle(pool);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db.insert(users).values(insertUser).returning();
    return user;
  }

  async createExport(data: InsertExport): Promise<Export> {
    const [record] = await this.db.insert(exports).values(data).returning();
    return record;
  }

  async getExports(): Promise<Export[]> {
    return this.db.select().from(exports).orderBy(desc(exports.createdAt));
  }

  async getExport(id: string): Promise<Export | undefined> {
    const [record] = await this.db.select().from(exports).where(eq(exports.id, id));
    return record;
  }

  async updateExportScript(id: string, scriptData: string): Promise<void> {
    await this.db.update(exports).set({ scriptData }).where(eq(exports.id, id));
  }

  async deleteExport(id: string): Promise<void> {
    await this.db.delete(exports).where(eq(exports.id, id));
  }
}

export const storage = new DatabaseStorage();
