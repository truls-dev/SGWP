import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getUploadUrl, getDownloadUrl, deleteObject } from "./r2";
import { insertExportSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/exports/upload-url", async (req, res) => {
    try {
      const { fileName, contentType } = req.body;
      if (!fileName || !contentType) {
        return res.status(400).json({ error: "fileName and contentType required" });
      }
      const key = `exports/${Date.now()}_${fileName}`;
      const uploadUrl = await getUploadUrl(key, contentType);
      res.json({ uploadUrl, key });
    } catch (e: any) {
      console.error("Upload URL error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/exports", async (req, res) => {
    try {
      const parsed = insertExportSchema.parse(req.body);
      const record = await storage.createExport(parsed);
      res.json(record);
    } catch (e: any) {
      console.error("Create export error:", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/exports", async (_req, res) => {
    try {
      const records = await storage.getExports();
      res.json(records);
    } catch (e: any) {
      console.error("List exports error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/exports/:id/download", async (req, res) => {
    try {
      const record = await storage.getExport(req.params.id);
      if (!record) return res.status(404).json({ error: "Not found" });
      const downloadUrl = await getDownloadUrl(record.r2Key);
      res.json({ downloadUrl });
    } catch (e: any) {
      console.error("Download URL error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/exports/:id", async (req, res) => {
    try {
      const record = await storage.getExport(req.params.id);
      if (!record) return res.status(404).json({ error: "Not found" });
      await deleteObject(record.r2Key);
      await storage.deleteExport(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error("Delete export error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  return httpServer;
}
