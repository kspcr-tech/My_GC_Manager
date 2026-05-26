import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add built-in JSON body parsing
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/proxyCheckBalance", async (req, res) => {
    try {
        const targetUrl = req.query.url as string;
        if (!targetUrl) {
            res.status(400).json({ error: "Missing url parameter" });
            return;
        }

        const fetchRes = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        });
        
        if (!fetchRes.ok) {
            res.status(fetchRes.status).json({ error: "Upstream API error" });
            return;
        }

        const data = await fetchRes.json();
        res.json(data);
    } catch (e: any) {
        console.error("Proxy error:", e);
        res.status(500).json({ error: "Failed to fetch from target API" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
