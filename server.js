// AR TECHNOLOGIES - Pure Node.js - Zero Dependencies
// CEO: Amit Ramjibhai Joshi
// No npm install needed - works on any server

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY || "AIzaSyB_RETYPX7yAh6JWmbpehUn1piTxWSoRgc";

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
    req.write(body);
    req.end();
  });
}

function body(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", c => d += c);
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
  });
}

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

function file(res, fp) {
  fs.readFile(fp, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, "public", "index.html"), (e, html) => {
        if (e) { res.writeHead(404); res.end("Not found"); return; }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      });
      return;
    }
    const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon" };
    res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "text/plain" });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" });
    res.end(); return;
  }

  if (p === "/health") {
    json(res, 200, { status: "online", company: "AR Technologies", ceo: "Amit Ramjibhai Joshi" });
    return;
  }

  if (p === "/api/ai" && req.method === "POST") {
    try {
      const { messages, system } = await body(req);
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
      json(res, 200, { content: [{ type: "text", text }] });
    } catch(e) { json(res, 500, { error: e.message }); }
    return;
  }

  if (p === "/api/translate" && req.method === "POST") {
    try {
      const { text, from, to } = await body(req);
      const contents = [
        { role: "user", parts: [{ text: "You are a translator. Return ONLY the translated text." }] },
        { role: "model", parts: [{ text: "OK." }] },
        { role: "user", parts: [{ text: `Translate from ${from || "auto"} to ${to}:\n\n${text}` }] }
      ];
      const translated = await gemini(contents);
      json(res, 200, { translated });
    } catch(e) { json(res, 500, { error: e.message }); }
    return;
  }

  if (req.method === "GET") {
    const fp = (p === "/" || p === "/index.html")
      ? path.join(__dirname, "public", "index.html")
      : path.join(__dirname, "public", p);
    file(res, fp);
    return;
  }

  json(res, 404, { error: "Not found" });

}).listen(PORT, () => {
  console.log("✅ AR Technologies running on port " + PORT);
  console.log("✅ CEO: Amit Ramjibhai Joshi");
  console.log("✅ AI: Google Gemini FREE");
  console.log("✅ No dependencies needed");
});
