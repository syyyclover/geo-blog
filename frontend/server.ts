import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me-in-production";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";
const CONTENT_PATH = process.env.CONTENT_PATH || path.join(process.cwd(), "..", "content");

function parseFrontMatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      result[key] = val;
    }
  }
  return result;
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const DATA_FILE = path.join(process.cwd(), "locations.json");
  const CONFIG_FILE = path.join(process.cwd(), "app-config.json");

  // Ensure data files exist
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([
      {
        id: "1",
        name: "Tokyo, Japan",
        coordinates: [139.6917, 35.6895],
        date: "2024-03-15",
        description: "Cherry blossoms in Shinjuku Gyoen.",
        images: ["https://picsum.photos/seed/tokyo/800/600"]
      }
    ], null, 2));
  }

  try {
    await fs.access(CONFIG_FILE);
  } catch {
    await fs.writeFile(CONFIG_FILE, JSON.stringify({
      nextDestination: {
        name: "Reykjavik, Iceland",
        flag: "🇮🇸",
        startDate: "2024-01-01",
        targetDate: "2026-06-01",
      }
    }, null, 2));
  }

  // Auth
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ sub: "admin" }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Public API Routes
  app.get("/api/locations", async (req, res) => {
    const data = await fs.readFile(DATA_FILE, "utf-8");
    res.json(JSON.parse(data));
  });

  app.get("/api/config", async (req, res) => {
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    res.json(JSON.parse(data));
  });

  app.get("/api/travel-guides", async (req, res) => {
    const guidesDir = path.join(CONTENT_PATH, "travel");
    try {
      const files = await fs.readdir(guidesDir);
      const mdFiles = files.filter(f => f.endsWith(".md"));
      const guides = await Promise.all(
        mdFiles.map(async (file) => {
          const raw = await fs.readFile(path.join(guidesDir, file), "utf-8");
          const matter = parseFrontMatter(raw);
          return {
            slug: file.replace(/\.md$/, ""),
            title: matter.title || file.replace(/\.md$/, "").replace(/-/g, " "),
            date: matter.date || "",
            category: matter.category || "Travel",
          };
        })
      );
      res.json(guides.sort((a, b) => b.date.localeCompare(a.date)));
    } catch {
      res.json([]);
    }
  });

  // Protected API Routes
  app.post("/api/locations", requireAuth, async (req, res) => {
    const newLocation = req.body;
    const data = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
    data.push({ ...newLocation, id: Date.now().toString() });
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    res.status(201).json(newLocation);
  });

  app.delete("/api/locations/:id", requireAuth, async (req, res) => {
    const data: any[] = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
    const filtered = data.filter(loc => loc.id !== req.params.id);
    await fs.writeFile(DATA_FILE, JSON.stringify(filtered, null, 2));
    res.json({ success: true });
  });

  app.post("/api/config", requireAuth, async (req, res) => {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  });

  // R2 Upload placeholder (configure R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET, R2_PUBLIC_URL in .env)
  app.post("/api/upload", requireAuth, async (req, res) => {
    res.status(501).json({
      error: "R2 upload not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET, R2_PUBLIC_URL in your .env file."
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
