import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { uploadToR2, getDownloadUrl, deleteObject } from "./r2";
import { insertExportSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/exports/upload", async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);

      const fileName = req.headers['x-file-name'] as string;
      const durationMs = req.headers['x-duration-ms'] ? parseInt(req.headers['x-duration-ms'] as string) : null;

      if (!fileName) {
        return res.status(400).json({ error: "x-file-name header required" });
      }

      const key = `exports/${Date.now()}_${fileName}`;
      await uploadToR2(key, body, 'video/mp4');

      const record = await storage.createExport({
        fileName,
        r2Key: key,
        fileSize: body.length,
        durationMs,
      });

      res.json(record);
    } catch (e: any) {
      console.error("Upload error:", e);
      res.status(500).json({ error: e.message });
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
