import { type User, type InsertUser, type Export, type InsertExport } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createExport(data: InsertExport): Promise<Export>;
  getExports(): Promise<Export[]>;
  getExport(id: string): Promise<Export | undefined>;
  deleteExport(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private exportRecords: Map<string, Export>;

  constructor() {
    this.users = new Map();
    this.exportRecords = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createExport(data: InsertExport): Promise<Export> {
    const id = randomUUID();
    const record: Export = {
      ...data,
      id,
      durationMs: data.durationMs ?? null,
      createdAt: new Date(),
    };
    this.exportRecords.set(id, record);
    return record;
  }

  async getExports(): Promise<Export[]> {
    return Array.from(this.exportRecords.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getExport(id: string): Promise<Export | undefined> {
    return this.exportRecords.get(id);
  }

  async deleteExport(id: string): Promise<void> {
    this.exportRecords.delete(id);
  }
}

export const storage = new MemStorage();
