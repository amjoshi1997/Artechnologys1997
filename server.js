const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const GROQ_KEY = process.env.GROQ_API_KEY || "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";

function getHTML() {
  const paths = [
    path.join(__dirname, "public", "index.html"),
    path.join(__dirname, "index.html"),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return "<h1>AR Technologies Loading...</h1>";
}

function callGroq(messages, system) {
  return new Promise((resolve, reject) => {
    const msgs = [];
    if (system) msgs.push({ role: "system", content: system });
    messages.forEach(m => msgs.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

    const body = JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: msgs,
      max_tokens: 1000,
      temperature: 0.7
    });

    const req = https.request({
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Length": Buffer.byteLength(body)
      }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try {
          const j = JSON.parse(d);
          if (j.error) return reject(new Error(j.error.message));
          resolve(j?.choices?.[0]?.message?.content || "");
        } catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
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
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  });
  res.end(JSON.stringify(data));
}

const INDEX_HTML = getHTML();

http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    });
    res.end(); return;
  }

  if (p === "/health") {
    sendJSON(res, 200, { status: "online", company: "AR Technologies", ceo: "Amit Ramjibhai Joshi", ai: "Groq FREE" });
    return;
  }

  if (p === "/api/ai" && req.method === "POST") {
    try {
      const { messages, system } = await parseBody(req);
      const text = await callGroq(messages || [], system || "");
      sendJSON(res, 200, { content: [{ type: "text", text }] });
    } catch(e) {
      console.error("AI error:", e.message);
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  if (p === "/api/translate" && req.method === "POST") {
    try {
      const { text, from, to } = await parseBody(req);
      const result = await callGroq(
        [{ role: "user", content: `Translate from ${from || "auto"} to ${to}. Return ONLY the translated text:\n\n${text}` }],
        "You are a professional translator. Return ONLY the translated text, nothing else."
      );
      sendJSON(res, 200, { translated: result });
    } catch(e) {
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(INDEX_HTML);

}).listen(PORT, () => {
  console.log("✅ AR Technologies running on port " + PORT);
  console.log("✅ CEO: Amit Ramjibhai Joshi");
  console.log("✅ AI: Groq FREE - No limits!");
});
