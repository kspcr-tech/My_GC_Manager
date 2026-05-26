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
            res.json({ success: false, status: 400, error: "Missing url parameter" });
            return;
        }

        const fetchRes = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json",
            },
        });
        
        if (!fetchRes.ok) {
            const errText = await fetchRes.text();
            res.json({ success: false, status: fetchRes.status, error: "Upstream API error", details: errText, urlTried: targetUrl });
            return;
        }

        const data = await fetchRes.json();
        res.json({ success: true, data });
    } catch (e: any) {
        console.error("Proxy error:", e);
        res.json({ success: false, status: 500, error: "Failed to fetch from target API: " + e.message });
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
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
