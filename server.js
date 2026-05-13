const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY || "AIzaSyB_RETYPX7yAh6JWmbpehUn1piTxWSoRgc";

// Read index.html at startup - works whether in public/ or root
function getIndexHTML() {
  const paths = [
    path.join(__dirname, "public", "index.html"),
    path.join(__dirname, "index.html"),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return "<h1>AR Technologies - Loading...</h1>";
}

function gemini(contents) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
    });
    const req = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try {
          const j = JSON.parse(d);
          if (j.error) return reject(new Error(j.error.message));
          resolve(j?.candidates?.[0]?.content?.parts?.[0]?.text || "");
        } catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body); req.end();
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
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

const INDEX_HTML = getIndexHTML();

http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" });
    res.end(); return;
  }

  if (p === "/health") {
    sendJSON(res, 200, { status: "online", company: "AR Technologies", ceo: "Amit Ramjibhai Joshi" });
    return;
  }

  if (p === "/api/ai" && req.method === "POST") {
    try {
      const { messages, system } = await parseBody(req);
      const contents = [];
      if (system) {
        contents.push({ role: "user", parts: [{ text: system }] });
        contents.push({ role: "model", parts: [{ text: "Ready." }] });
      }
      (messages || []).forEach(m => contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));
      const text = await gemini(contents);
      sendJSON(res, 200, { content: [{ type: "text", text }] });
    } catch(e) { sendJSON(res, 500, { error: e.message }); }
    return;
  }

  if (p === "/api/translate" && req.method === "POST") {
    try {
      const { text, from, to } = await parseBody(req);
      const contents = [
        { role: "user", parts: [{ text: "Translate accurately. Return ONLY translated text." }] },
        { role: "model", parts: [{ text: "OK." }] },
        { role: "user", parts: [{ text: `Translate from ${from||"auto"} to ${to}:\n\n${text}` }] }
      ];
      const translated = await gemini(contents);
      sendJSON(res, 200, { translated });
    } catch(e) { sendJSON(res, 500, { error: e.message }); }
    return;
  }

  // Serve index.html for ALL routes
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(INDEX_HTML);

}).listen(PORT, () => {
  console.log("✅ AR Technologies running on port " + PORT);
  console.log("✅ CEO: Amit Ramjibhai Joshi");
  console.log("✅ AI: Google Gemini FREE");
});
