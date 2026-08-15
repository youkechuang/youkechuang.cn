#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const path = require("path");
const querystring = require("querystring");
const { exec } = require("child_process");

const PORT = Number(process.env.ADMIN_PORT || 9000);
const HOST = process.env.ADMIN_HOST || "0.0.0.0";
const REPO_DIR = process.env.SITE_REPO_DIR || "/opt/youkechuang/repo";
const APP_DIR = process.env.SITE_APP_DIR || "/opt/youkechuang";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const MAX_BODY = 25 * 1024 * 1024;
const EDITABLE_EXTENSIONS = new Set([
  ".md",
  ".html",
  ".css",
  ".js",
  ".yml",
  ".yaml",
  ".json",
  ".txt",
]);

if (!ADMIN_PASSWORD) {
  console.error("ADMIN_PASSWORD is required.");
  process.exit(1);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root{--bg:#f5f7fb;--paper:#fff;--ink:#18202c;--muted:#647084;--line:#dce4ef;--accent:#0f766e;--danger:#b91c1c}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.65}
    main{width:min(1180px,calc(100% - 28px));margin:0 auto;padding:28px 0 56px}
    .top{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:18px}.top a,.button,button{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 13px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--accent);font-weight:800;text-decoration:none;cursor:pointer}
    .button.primary,button.primary{background:var(--accent);color:#fff;border-color:var(--accent)}.button.danger,button.danger{color:#fff;background:var(--danger);border-color:var(--danger)}
    .card{border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.96);box-shadow:0 14px 32px rgba(31,43,62,.09);padding:22px;margin-bottom:16px}
    h1{margin:0 0 8px;font-size:2rem;line-height:1.2} h2{margin:0 0 12px;font-size:1.24rem}.muted{color:var(--muted)}
    input,textarea,select{width:100%;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font:inherit;padding:10px 12px} textarea{min-height:58vh;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:.94rem;line-height:1.55}
    label{display:block;margin:12px 0 6px;font-weight:850}.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.list{display:grid;gap:8px;margin:12px 0 0}.file{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:#fbfdff}.file code{overflow-wrap:anywhere}.notice{padding:12px 14px;border:1px solid #b7dcd7;border-radius:8px;background:#e8f6f3;color:#134e4a;font-weight:800}.error{padding:12px 14px;border:1px solid #fecaca;border-radius:8px;background:#fef2f2;color:#991b1b;font-weight:800}
    pre{overflow:auto;border:1px solid var(--line);border-radius:8px;background:#101828;color:#e5e7eb;padding:14px;white-space:pre-wrap}
    @media(max-width:760px){.grid{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}h1{font-size:1.65rem}textarea{min-height:52vh}}
  </style>
</head>
<body><main>${body}</main></body></html>`;
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || "";
  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key) cookies[key] = decodeURIComponent(rest.join("="));
  }
  return cookies;
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function makeSession() {
  const payload = JSON.stringify({ user: ADMIN_USER, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  const value = Buffer.from(payload).toString("base64url");
  return `${value}.${sign(value)}`;
}

function isAuthed(req) {
  const token = parseCookies(req).admin_session;
  if (!token || !token.includes(".")) return false;
  const [value, signature] = token.split(".");
  const expected = sign(value);
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return data.user === ADMIN_USER && data.exp > Date.now();
  } catch {
    return false;
  }
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function send(res, status, html, headers = {}) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...headers });
  res.end(html);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("请求体过大");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readForm(req) {
  const body = await readBody(req);
  return querystring.parse(body.toString("utf8"));
}

function safeRepoPath(inputPath) {
  const normalized = path.posix.normalize(String(inputPath || "").replaceAll("\\", "/"));
  if (!normalized || normalized === "." || normalized.startsWith("../") || path.isAbsolute(normalized)) {
    throw new Error("非法路径");
  }
  const fullPath = path.resolve(REPO_DIR, normalized);
  if (!fullPath.startsWith(path.resolve(REPO_DIR) + path.sep)) {
    throw new Error("非法路径");
  }
  return { relative: normalized, fullPath };
}

async function walk(dir, base = dir, files = []) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "dist" || entry.name === "_site") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, base, files);
    } else {
      const rel = path.relative(base, full).replaceAll(path.sep, "/");
      const ext = path.extname(entry.name).toLowerCase();
      if (rel.startsWith("source/") && EDITABLE_EXTENSIONS.has(ext)) files.push(rel);
    }
  }
  return files.sort();
}

function topNav() {
  return `<div class="top"><div><h1>网站管理后台</h1><p class="muted">编辑内容后点击发布，服务器会自动构建并上线。</p></div><div class="row"><a href="/admin/">文件</a><a href="/admin/new">新建</a><a href="/admin/upload">上传</a><a href="/admin/logout">退出</a></div></div>`;
}

async function renderHome(req, res) {
  const files = await walk(REPO_DIR);
  const fileItems = files
    .map((file) => `<div class="file"><code>${escapeHtml(file)}</code><a class="button" href="/admin/edit?path=${encodeURIComponent(file)}">编辑</a></div>`)
    .join("");
  send(
    res,
    200,
    page(
      "网站管理后台",
      `${topNav()}
      <div class="card">
        <h2>发布</h2>
        <p class="muted">发布会根据服务器上的源码重新生成静态网站，并重启 Nginx 容器。</p>
        <form method="post" action="/admin/publish"><button class="primary" type="submit">发布网站</button></form>
      </div>
      <div class="card"><h2>内容文件</h2><div class="list">${fileItems || "<p>暂无可编辑文件。</p>"}</div></div>`,
    ),
  );
}

async function renderLogin(req, res, message = "") {
  send(
    res,
    200,
    page(
      "登录网站管理后台",
      `<div class="card" style="max-width:460px;margin:8vh auto 0">
        <h1>登录后台</h1>
        ${message ? `<p class="error">${escapeHtml(message)}</p>` : ""}
        <form method="post" action="/admin/login">
          <label>用户名</label><input name="user" autocomplete="username" />
          <label>密码</label><input name="password" type="password" autocomplete="current-password" />
          <p><button class="primary" type="submit">登录</button></p>
        </form>
      </div>`,
    ),
  );
}

async function renderEditor(req, res, url) {
  const target = safeRepoPath(url.searchParams.get("path"));
  const content = await fsp.readFile(target.fullPath, "utf8");
  send(
    res,
    200,
    page(
      `编辑 ${target.relative}`,
      `${topNav()}<div class="card">
        <h2>编辑文件</h2>
        <form method="post" action="/admin/save">
          <label>路径</label><input name="path" value="${escapeHtml(target.relative)}" readonly />
          <label>内容</label><textarea name="content">${escapeHtml(content)}</textarea>
          <p class="row"><button class="primary" type="submit">保存</button><a class="button" href="/admin/">返回</a></p>
        </form>
      </div>`,
    ),
  );
}

async function renderNew(req, res) {
  send(
    res,
    200,
    page(
      "新建文件",
      `${topNav()}<div class="card">
        <h2>新建文件</h2>
        <form method="post" action="/admin/create">
          <label>路径</label><input name="path" placeholder="source/blogs/all/2026-05-18-title/README.md" />
          <label>内容</label><textarea name="content" placeholder="# 标题&#10;&#10;正文..."></textarea>
          <p><button class="primary" type="submit">创建</button></p>
        </form>
      </div>`,
    ),
  );
}

async function renderUpload(req, res) {
  send(
    res,
    200,
    page(
      "上传文件",
      `${topNav()}<div class="card">
        <h2>上传文件</h2>
        <p class="muted">适合上传图片、PDF 或静态资源。建议路径放在 <code>source/static/</code> 下。</p>
        <form method="post" action="/admin/upload" enctype="multipart/form-data">
          <label>保存目录</label><input name="dir" value="source/static/uploads" />
          <label>选择文件</label><input name="file" type="file" />
          <p><button class="primary" type="submit">上传</button></p>
        </form>
      </div>`,
    ),
  );
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=(.+)$/.exec(contentType || "");
  if (!boundaryMatch) throw new Error("缺少 multipart boundary");
  const boundary = Buffer.from(`--${boundaryMatch[1]}`);
  const parts = [];
  let start = buffer.indexOf(boundary);
  while (start !== -1) {
    start += boundary.length;
    if (buffer[start] === 45 && buffer[start + 1] === 45) break;
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;
    const end = buffer.indexOf(boundary, start);
    if (end === -1) break;
    const part = buffer.subarray(start, end - 2);
    const split = part.indexOf(Buffer.from("\r\n\r\n"));
    if (split !== -1) {
      const headers = part.subarray(0, split).toString("utf8");
      const data = part.subarray(split + 4);
      const name = /name="([^"]+)"/.exec(headers)?.[1];
      const filename = /filename="([^"]*)"/.exec(headers)?.[1];
      parts.push({ name, filename, data });
    }
    start = end;
  }
  return parts;
}

function run(command, cwd = REPO_DIR) {
  return new Promise((resolve) => {
    exec(command, { cwd, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      resolve({ ok: !error, output: `${stdout || ""}${stderr || ""}`, code: error?.code || 0 });
    });
  });
}

async function publish() {
  const release = path.join(APP_DIR, "releases", `${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-admin`);
  await fsp.mkdir(release, { recursive: true });
  const build = await run(`gitsite-cli build -o "${release}"`, REPO_DIR);
  if (!build.ok) return build;
  const current = path.join(APP_DIR, "current");
  const relCurrent = path.relative(path.dirname(current), release);
  await fsp.rm(current, { force: true });
  await fsp.symlink(relCurrent, current);
  const restart = await run("docker restart youkechuang-web", "/");
  return {
    ok: restart.ok,
    output: `${build.output}\n${restart.output}\nPublished release: ${release}`,
    code: restart.code,
  };
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === "/admin/login" && req.method === "GET") return renderLogin(req, res);
    if (url.pathname === "/admin/login" && req.method === "POST") {
      const form = await readForm(req);
      if (form.user === ADMIN_USER && form.password === ADMIN_PASSWORD) {
        return redirect(res, "/admin/", {
          "Set-Cookie": `admin_session=${encodeURIComponent(makeSession())}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=604800`,
        });
      }
      return renderLogin(req, res, "用户名或密码错误");
    }
    if (!isAuthed(req)) return redirect(res, "/admin/login");
    if (url.pathname === "/admin/logout") {
      res.writeHead(302, { Location: "/admin/login", "Set-Cookie": "admin_session=; Path=/admin; Max-Age=0" });
      return res.end();
    }
    if (url.pathname === "/admin/" && req.method === "GET") return renderHome(req, res);
    if (url.pathname === "/admin/edit" && req.method === "GET") return renderEditor(req, res, url);
    if (url.pathname === "/admin/new" && req.method === "GET") return renderNew(req, res);
    if (url.pathname === "/admin/upload" && req.method === "GET") return renderUpload(req, res);
    if (url.pathname === "/admin/save" && req.method === "POST") {
      const form = await readForm(req);
      const target = safeRepoPath(form.path);
      await fsp.writeFile(target.fullPath, String(form.content || ""), "utf8");
      return redirect(res, `/admin/edit?path=${encodeURIComponent(target.relative)}`);
    }
    if (url.pathname === "/admin/create" && req.method === "POST") {
      const form = await readForm(req);
      const target = safeRepoPath(form.path);
      await fsp.mkdir(path.dirname(target.fullPath), { recursive: true });
      await fsp.writeFile(target.fullPath, String(form.content || ""), "utf8");
      return redirect(res, `/admin/edit?path=${encodeURIComponent(target.relative)}`);
    }
    if (url.pathname === "/admin/upload" && req.method === "POST") {
      const body = await readBody(req);
      const parts = parseMultipart(body, req.headers["content-type"]);
      const dir = String(parts.find((part) => part.name === "dir")?.data || "source/static/uploads").trim();
      const file = parts.find((part) => part.name === "file" && part.filename);
      if (!file) throw new Error("没有选择文件");
      const safeName = path.basename(file.filename).replace(/[^\w.\-()\u4e00-\u9fa5]/g, "_");
      const target = safeRepoPath(path.posix.join(dir.replaceAll("\\", "/"), safeName));
      await fsp.mkdir(path.dirname(target.fullPath), { recursive: true });
      await fsp.writeFile(target.fullPath, file.data);
      return send(res, 200, page("上传完成", `${topNav()}<div class="card"><p class="notice">上传完成：<code>${escapeHtml(target.relative)}</code></p><p><a class="button" href="/admin/">返回文件列表</a></p></div>`));
    }
    if (url.pathname === "/admin/publish" && req.method === "POST") {
      const result = await publish();
      return send(res, result.ok ? 200 : 500, page("发布结果", `${topNav()}<div class="card"><h2>${result.ok ? "发布成功" : "发布失败"}</h2><pre>${escapeHtml(result.output)}</pre><p><a class="button" href="/admin/">返回</a></p></div>`));
    }
    send(res, 404, page("404", `${topNav()}<div class="card"><p class="error">页面不存在。</p></div>`));
  } catch (error) {
    send(res, 500, page("错误", `${topNav()}<div class="card"><p class="error">${escapeHtml(error.message)}</p></div>`));
  }
}

http.createServer(handle).listen(PORT, HOST, () => {
  console.log(`Admin server listening on ${HOST}:${PORT}`);
});
