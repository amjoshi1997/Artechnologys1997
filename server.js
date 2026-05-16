const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const GROQ_KEY = process.env.GROQ_API_KEY || "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";

// ── DATA FILE (persistent storage) ────────────────────────
const DATA_FILE = path.join(__dirname, "data.json");
function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return { projects: [], clients: [], files: [] }; }
}
function saveData(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch(e) { console.error("Save error:", e.message); }
}

// ── GROQ AI ────────────────────────────────────────────────
function callGroq(messages, system) {
  return new Promise((resolve, reject) => {
    const msgs = [];
    if (system) msgs.push({ role: "system", content: system });
    messages.forEach(m => msgs.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    const body = JSON.stringify({ model: "llama-3.3-70b-versatile", messages: msgs, max_tokens: 1000, temperature: 0.7 });
    const req = https.request({
      hostname: "api.groq.com", path: "/openai/v1/chat/completions", method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}`, "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { const j = JSON.parse(d); if (j.error) return reject(new Error(j.error.message)); resolve(j?.choices?.[0]?.message?.content || ""); }
        catch(e) { reject(e); }
      });
    });
    req.on("error", reject); req.write(body); req.end();
  });
}

function parseBody(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", c => d += c);
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" });
  res.end(JSON.stringify(data));
}

function getHTML() {
  const paths = [path.join(__dirname, "public", "index.html"), path.join(__dirname, "index.html")];
  for (const p of paths) { if (fs.existsSync(p)) return fs.readFileSync(p, "utf8"); }
  return "<h1>AR Technologies Loading...</h1>";
}

const INDEX_HTML = getHTML();

http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const p = parsed.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" });
    res.end(); return;
  }

  // ── HEALTH ────────────────────────────────────────────
  if (p === "/health") {
    sendJSON(res, 200, { status: "online", company: "AR Technologies", ceo: "Amit Ramjibhai Joshi", ai: "Groq FREE", storage: "persistent" });
    return;
  }

  // ── AI CHAT ───────────────────────────────────────────
  if (p === "/api/ai" && req.method === "POST") {
    try {
      const { messages, system } = await parseBody(req);
      const text = await callGroq(messages || [], system || "");
      sendJSON(res, 200, { content: [{ type: "text", text }] });
    } catch(e) { sendJSON(res, 500, { error: e.message }); }
    return;
  }

  // ── TRANSLATE ─────────────────────────────────────────
  if (p === "/api/translate" && req.method === "POST") {
    try {
      const { text, from, to } = await parseBody(req);
      const result = await callGroq(
        [{ role: "user", content: `Translate from ${from || "auto"} to ${to}. Return ONLY translated text:\n\n${text}` }],
        "You are a professional translator. Return ONLY the translated text."
      );
      sendJSON(res, 200, { translated: result });
    } catch(e) { sendJSON(res, 500, { error: e.message }); }
    return;
  }

  // ── PROJECTS CRUD ─────────────────────────────────────
  if (p === "/api/projects") {
    const data = loadData();
    if (req.method === "GET") { sendJSON(res, 200, { projects: data.projects }); return; }
    if (req.method === "POST") {
      const body = await parseBody(req);
      data.projects.unshift(body);
      saveData(data);
      sendJSON(res, 200, { ok: true, project: body });
      return;
    }
  }
  if (p.startsWith("/api/projects/") && req.method === "PUT") {
    const id = p.split("/")[3];
    const body = await parseBody(req);
    const data = loadData();
    const idx = data.projects.findIndex(x => x.id === id);
    if (idx >= 0) { data.projects[idx] = { ...data.projects[idx], ...body }; saveData(data); }
    sendJSON(res, 200, { ok: true });
    return;
  }
  if (p.startsWith("/api/projects/") && req.method === "DELETE") {
    const id = p.split("/")[3];
    const data = loadData();
    data.projects = data.projects.filter(x => x.id !== id);
    saveData(data);
    sendJSON(res, 200, { ok: true });
    return;
  }

  // ── CLIENTS CRUD ──────────────────────────────────────
  if (p === "/api/clients") {
    const data = loadData();
    if (req.method === "GET") { sendJSON(res, 200, { clients: data.clients }); return; }
    if (req.method === "POST") {
      const body = await parseBody(req);
      data.clients.push(body);
      saveData(data);
      sendJSON(res, 200, { ok: true });
      return;
    }
  }
  if (p.startsWith("/api/clients/") && req.method === "DELETE") {
    const id = p.split("/")[3];
    const data = loadData();
    data.clients = data.clients.filter(x => x.id !== id);
    saveData(data);
    sendJSON(res, 200, { ok: true });
    return;
  }

  // ── FILES ─────────────────────────────────────────────
  if (p === "/api/files") {
    const data = loadData();
    if (req.method === "GET") { sendJSON(res, 200, { files: data.files || [] }); return; }
    if (req.method === "POST") {
      const body = await parseBody(req);
      if (!data.files) data.files = [];
      data.files.unshift({ ...body, id: "F" + Date.now(), uploaded: new Date().toISOString() });
      saveData(data);
      sendJSON(res, 200, { ok: true });
      return;
    }
  }
  if (p.startsWith("/api/files/") && req.method === "DELETE") {
    const id = p.split("/")[3];
    const data = loadData();
    data.files = (data.files || []).filter(x => x.id !== id);
    saveData(data);
    sendJSON(res, 200, { ok: true });
    return;
  }

  // ── 3D MODELS LIST ────────────────────────────────────
  if (p === "/api/models3d") {
    sendJSON(res, 200, { models: [
      { id: "m1", name: "Industrial Engine", category: "Manufacturing", format: "OBJ", size: "2.4 MB", url: "https://free3d.com/3d-model/engine-v1--441644.html", preview: "⚙️", sketchfab: "6f85f5764c6a4df6aa91e26c59a64a69" },
      { id: "m2", name: "Defence Drone", category: "Defence", format: "OBJ", size: "1.8 MB", url: "https://free3d.com/3d-model/military-drone-2040-v4--313114.html", preview: "🚁", sketchfab: "bca4f59d80ac46dfab4d5a2e76f04d44" },
      { id: "m3", name: "Office Building", category: "Architecture", format: "OBJ", size: "3.2 MB", url: "https://free3d.com/3d-model/office-building-v1--556782.html", preview: "🏢", sketchfab: "d14b796fcdd64a2ab7c4f97c73c97ced" },
      { id: "m4", name: "Car Engine", category: "Automotive", format: "OBJ", size: "4.1 MB", url: "https://free3d.com/3d-model/car-engine-v2--848274.html", preview: "🚗", sketchfab: "0e4ca6002b6b40e3b80b0bc23a38b5ee" },
      { id: "m5", name: "Robot Arm", category: "Manufacturing", format: "OBJ", size: "1.5 MB", url: "https://free3d.com/3d-model/robot-arm-v1--341282.html", preview: "🤖", sketchfab: "6d4e3fbb2ef347c1aab7ce7d41da8f3a" },
      { id: "m6", name: "Factory Machine", category: "Manufacturing", format: "OBJ", size: "2.8 MB", url: "https://free3d.com/3d-model/factory-machine-v2--529834.html", preview: "🏭", sketchfab: "e5a74e27eb3a4d02ab06aacb1b5bf79d" },
      { id: "m7", name: "Radar System", category: "Defence", format: "OBJ", size: "1.2 MB", url: "https://free3d.com/3d-model/radar-dish-v2--447921.html", preview: "📡", sketchfab: "8f0d8b4c3e3f4b2d9c6a7e1f4d8b2c5a" },
      { id: "m8", name: "Rocket", category: "Aerospace", format: "OBJ", size: "1.9 MB", url: "https://free3d.com/3d-model/rocket-v1--881290.html", preview: "🚀", sketchfab: "9e3f7c2d1b4a5e8f6c0d2a4b7e1f3c5d" },
    ]});
    return;
  }

  // ── SERVE HTML ────────────────────────────────────────
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(INDEX_HTML);

}).listen(PORT, () => {
  console.log(`\n✅ AR Technologies running on port ${PORT}`);
  console.log(`✅ CEO: Amit Ramjibhai Joshi`);
  console.log(`✅ AI: Groq FREE`);
  console.log(`✅ Storage: Persistent (data.json)\n`);
});
