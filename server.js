const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 3000);
const IS_SERVERLESS_PREVIEW = Boolean(process.env.VERCEL);
const IS_PRODUCTION = process.env.NODE_ENV === "production" || IS_SERVERLESS_PREVIEW;
const DEFAULT_DATA_FILE = IS_SERVERLESS_PREVIEW ? path.join("/tmp", "controle-entregas-tarefas.json") : path.join(__dirname, "data", "database.json");
const DEFAULT_UPLOAD_DIR = IS_SERVERLESS_PREVIEW ? path.join("/tmp", "controle-entregas-uploads") : path.join(__dirname, "uploads");
const DATA_FILE = path.resolve(process.env.DATA_FILE || DEFAULT_DATA_FILE);
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR);
const DATABASE_URL = process.env.DATABASE_URL || "";
const STORAGE_DRIVER = DATABASE_URL ? "postgres" : "json";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_MS || 8 * 60 * 60 * 1000);
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || (IS_PRODUCTION ? "" : sha256("admin123"));
const NOTIFICATION_WEBHOOK_URL = process.env.NOTIFICATION_WEBHOOK_URL || "";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "operacao@empresa.com";
const NOTIFICATION_EMAIL_TO = process.env.NOTIFICATION_EMAIL_TO || "";

const STATUSES = ["novo", "em_separacao", "aguardando_coleta", "em_rota", "entregue", "falha_entrega", "reentrega", "cancelado"];
const TYPES = ["entrega", "coleta", "tarefa"];
const CATEGORIES = ["entrega", "coleta", "rota", "estoque", "manutencao", "administrativo"];
const PRIORITIES = ["baixa", "media", "alta", "critica"];
const SLA_HOURS = { critica: 2, alta: 6, media: 24, baixa: 72 };
const CATEGORY_SLA_HOURS = {
  entrega: { critica: 2, alta: 6, media: 24, baixa: 48 },
  coleta: { critica: 4, alta: 8, media: 24, baixa: 48 },
  rota: { critica: 2, alta: 6, media: 24, baixa: 48 },
  estoque: { critica: 6, alta: 12, media: 24, baixa: 72 },
  manutencao: { critica: 12, alta: 24, media: 48, baixa: 96 },
  administrativo: { critica: 24, alta: 48, media: 72, baixa: 120 },
};
const ROLES = ["admin", "supervisor", "operador", "leitura"];
const ROLE_PERMISSIONS = {
  admin: ["read", "write", "settings", "users", "export", "seed"],
  supervisor: ["read", "write", "export"],
  operador: ["read", "write"],
  leitura: ["read"],
};
const TRANSITIONS = {
  novo: ["em_separacao", "aguardando_coleta", "em_rota", "cancelado"],
  em_separacao: ["aguardando_coleta", "em_rota", "falha_entrega", "cancelado"],
  aguardando_coleta: ["em_rota", "falha_entrega", "cancelado"],
  em_rota: ["entregue", "falha_entrega", "reentrega", "cancelado"],
  falha_entrega: ["reentrega", "cancelado"],
  reentrega: ["em_rota", "entregue", "falha_entrega", "cancelado"],
  entregue: [],
  cancelado: [],
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "-");
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp", ".pdf"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function safeEqualString(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, storedHash) {
  const hash = String(storedHash || "");
  if (hash.startsWith("scrypt$")) {
    const [, salt, derived] = hash.split("$");
    if (!salt || !derived) return false;
    return safeEqualString(hashPassword(password, salt), hash);
  }

  // Compatibilidade com bancos e variaveis antigas em SHA-256.
  return safeEqualString(sha256(password || ""), hash);
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").filter(Boolean).map((item) => {
    const [key, ...rest] = item.trim().split("=");
    return [key, decodeURIComponent(rest.join("="))];
  }));
}

function makeSession() {
  const now = Date.now();
  const payload = JSON.stringify({ user: ADMIN_USER, role: "admin", issuedAt: now, expiresAt: now + SESSION_MAX_AGE_MS });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function makeSessionFor(admin) {
  const now = Date.now();
  const payload = JSON.stringify({ user: admin.user, role: admin.role, issuedAt: now, expiresAt: now + SESSION_MAX_AGE_MS });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function sessionCookie(value, maxAge = null) {
  const attrs = [`ops_session=${encodeURIComponent(value)}`, "HttpOnly", "SameSite=Lax", "Path=/"];
  if (IS_PRODUCTION) attrs.push("Secure");
  attrs.push(`Max-Age=${maxAge !== null ? maxAge : Math.floor(SESSION_MAX_AGE_MS / 1000)}`);
  return attrs.join("; ");
}

function currentAdmin(req) {
  const token = parseCookies(req).ops_session;
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  const expected = sign(encoded);
  if (!signature || signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const admin = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (admin.expiresAt && Date.now() > Number(admin.expiresAt)) return null;
    return admin;
  } catch {
    return null;
  }
}

function isValidSession(req) {
  const token = parseCookies(req).ops_session;
  if (!token || !token.includes(".")) return false;
  const [encoded, signature] = token.split(".");
  const expected = sign(encoded);
  if (!signature || signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function requireAdmin(req, res, next) {
  if (!isValidSession(req)) return res.status(401).json({ error: "Acesso administrativo necessario." });
  next();
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const sessionAdmin = currentAdmin(req);
      if (!sessionAdmin) return res.status(401).json({ error: "Acesso administrativo necessario." });
      const dbAdmin = findAdmin(await readDb(), sessionAdmin.user);
      if (!dbAdmin || dbAdmin.active === false) return res.status(401).json({ error: "Sessao administrativa invalida ou usuario bloqueado." });
      if (!ROLE_PERMISSIONS[dbAdmin.role]?.includes(permission)) return res.status(403).json({ error: "Permissao insuficiente." });
      req.admin = { user: dbAdmin.user, role: dbAdmin.role, id: dbAdmin.id };
      next();
    } catch (error) {
      next(error);
    }
  };
}

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
  ].join("; "));
  next();
}

function sameOriginGuard(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  const protocol = req.get("x-forwarded-proto") || req.protocol;
  const expected = `${protocol}://${req.get("host")}`;
  if (origin !== expected) return res.status(403).json({ error: "Origem da requisicao nao autorizada." });
  next();
}

function createRateLimiter({ windowMs = 60_000, max = 120 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const current = hits.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > current.resetAt) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }
    current.count += 1;
    hits.set(key, current);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - current.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));
    if (current.count > max) return res.status(429).json({ error: "Muitas requisicoes. Tente novamente em instantes." });
    next();
  };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function defaultDb() {
  return {
    settings: {
      companyName: "Controle de Entregas e Tarefas Operacionais",
      contactEmail: "operacao@empresa.com",
      primaryColor: "#16423c",
      accentColor: "#256f5b",
      categories: CATEGORIES,
      slaHours: SLA_HOURS,
      categorySlaHours: CATEGORY_SLA_HOURS,
    },
    admins: [
      { id: 1, user: ADMIN_USER, role: "admin", passwordHash: ADMIN_PASSWORD_HASH, createdAt: new Date().toISOString() },
    ],
    demands: [
      {
        id: 1,
        protocol: `OP-${new Date().getFullYear()}-0001`,
        type: "entrega",
        title: "Entrega expressa para cliente prioritario",
        requester: "Loja Centro",
        contact: "operacao@lojacentro.com",
        category: "entrega",
        priority: "critica",
        status: "em_rota",
        assignee: "Equipe Logistica",
        origin: "CD Principal",
        destination: "Cliente Centro",
        description: "Cliente aguardando entrega com prazo critico.",
        dueAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        proof: "",
        notes: [{ visibility: "public", text: "Entrega saiu para rota.", createdAt: new Date().toISOString() }],
        attachments: [],
        history: [{ action: "created", detail: "Demanda demonstrativa criada.", actor: "sistema", createdAt: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: "",
      },
    ],
    audit: [],
  };
}

function ensureDataFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(defaultDb(), null, 2));
}

function readJsonDb() {
  ensureDataFile();
  const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  return normalizeDb(db);
}

function writeJsonDb(db) {
  normalizeDb(db);
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let pgPool;
async function getPgPool() {
  if (!pgPool) {
    pgPool = new Pool({ connectionString: DATABASE_URL });
  }
  return pgPool;
}

async function ensurePostgresState() {
  const pool = await getPgPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    "INSERT INTO app_state (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING",
    ["default", JSON.stringify(defaultDb())],
  );
}

async function readPostgresDb() {
  await ensurePostgresState();
  const pool = await getPgPool();
  const result = await pool.query("SELECT value FROM app_state WHERE key = $1", ["default"]);
  return normalizeDb(result.rows[0]?.value || defaultDb());
}

async function writePostgresDb(db) {
  normalizeDb(db);
  await ensurePostgresState();
  const pool = await getPgPool();
  await pool.query(
    "UPDATE app_state SET value = $2::jsonb, updated_at = now() WHERE key = $1",
    ["default", JSON.stringify(db)],
  );
}

async function readDb() {
  return STORAGE_DRIVER === "postgres" ? readPostgresDb() : readJsonDb();
}

async function writeDb(db) {
  if (STORAGE_DRIVER === "postgres") {
    await writePostgresDb(db);
    return;
  }
  writeJsonDb(db);
}

function normalizeDb(db) {
  db.settings ||= {};
  db.settings.companyName ||= "Sistema de Controle de Entregas e Tarefas Operacionais";
  db.settings.contactEmail ||= "operacao@empresa.com";
  db.settings.primaryColor ||= "#16423c";
  db.settings.accentColor ||= "#256f5b";
  db.settings.categories ||= [...CATEGORIES];
  db.settings.slaHours ||= { ...SLA_HOURS };
  db.settings.categorySlaHours ||= structuredClone(CATEGORY_SLA_HOURS);
  db.demands ||= [];
  db.audit ||= [];
  db.admins ||= [];
  if (!db.admins.length) db.admins.push({ id: 1, user: ADMIN_USER, role: "admin", passwordHash: ADMIN_PASSWORD_HASH, createdAt: new Date().toISOString() });
  db.admins.forEach((admin) => {
    admin.active = admin.active !== false;
    admin.mustChangePassword = Boolean(admin.mustChangePassword);
  });
  db.demands.forEach((demand) => {
    demand.notes ||= [];
    demand.attachments ||= [];
    demand.history ||= [];
  });
  return db;
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}

function formatProtocol(id, date = new Date()) {
  return `OP-${date.getFullYear()}-${String(id).padStart(4, "0")}`;
}

function inferPriority(text, dueAt) {
  const value = String(text || "").toLowerCase();
  if (["urgente", "atrasado", "cliente aguardando", "rota parada", "carga parada", "bloqueado"].some((word) => value.includes(word))) return "critica";
  if (["hoje", "reentrega", "motorista", "sem estoque", "devolucao"].some((word) => value.includes(word))) return "alta";
  if (dueAt) {
    const hours = (new Date(dueAt).getTime() - Date.now()) / 36e5;
    if (hours <= 2) return "critica";
    if (hours <= 8) return "alta";
    if (hours <= 24) return "media";
  }
  return "baixa";
}

function inferCategory(text) {
  const value = String(text || "").toLowerCase();
  const rules = {
    coleta: ["coleta", "retirada", "fornecedor"],
    entrega: ["entrega", "pedido", "cliente", "reentrega", "canhoto"],
    rota: ["rota", "motorista", "veiculo", "trajeto"],
    estoque: ["estoque", "separacao", "conferencia", "volume", "carga"],
    manutencao: ["manutencao", "quebrado", "oficina", "equipamento"],
    administrativo: ["nota fiscal", "nf", "documento", "relatorio"],
  };
  return Object.entries(rules).find(([, words]) => words.some((word) => value.includes(word)))?.[0] || "administrativo";
}

function dueAtFor(priority) {
  return new Date(Date.now() + (SLA_HOURS[priority] || 24) * 60 * 60 * 1000).toISOString();
}

function dueAtForDb(db, priority, category = "") {
  const categoryHours = db.settings?.categorySlaHours?.[category]?.[priority];
  const hours = Number(categoryHours || db.settings?.slaHours?.[priority] || SLA_HOURS[priority] || 24);
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function validateDemand(payload) {
  const errors = [];
  if (!TYPES.includes(payload.type)) errors.push("Tipo invalido.");
  if (!String(payload.title || "").trim()) errors.push("Titulo e obrigatorio.");
  if (!String(payload.requester || "").trim()) errors.push("Solicitante e obrigatorio.");
  if (!String(payload.contact || "").trim()) errors.push("Contato e obrigatorio.");
  if (payload.category && !CATEGORIES.includes(payload.category)) errors.push("Categoria invalida.");
  if (!String(payload.description || "").trim() || String(payload.description).trim().length < 10) errors.push("Descricao deve ter pelo menos 10 caracteres.");
  if (payload.dueAt && Number.isNaN(new Date(payload.dueAt).getTime())) errors.push("Prazo invalido.");
  return errors;
}

function publicDemand(demand) {
  const lastPublicNote = [...(demand.notes || [])].reverse().find((note) => note.visibility === "public");
  return {
    protocol: demand.protocol,
    type: demand.type,
    title: demand.title,
    category: demand.category,
    priority: demand.priority,
    status: demand.status,
    assignee: demand.assignee,
    origin: demand.origin,
    destination: demand.destination,
    dueAt: demand.dueAt,
    isOverdue: isOverdue(demand),
    lastPublicNote,
    updatedAt: demand.updatedAt,
  };
}

function isOverdue(demand) {
  return !["entregue", "cancelado"].includes(demand.status) && new Date(demand.dueAt).getTime() < Date.now();
}

function dashboard(db) {
  const demands = db.demands;
  const open = demands.filter((item) => !["entregue", "cancelado"].includes(item.status));
  return {
    total: demands.length,
    abertas: open.length,
    emRota: demands.filter((item) => item.status === "em_rota").length,
    emSeparacao: demands.filter((item) => item.status === "em_separacao").length,
    aguardandoColeta: demands.filter((item) => item.status === "aguardando_coleta").length,
    falhas: demands.filter((item) => item.status === "falha_entrega").length,
    reentregas: demands.filter((item) => item.status === "reentrega").length,
    vencidas: demands.filter(isOverdue).length,
    concluidas: demands.filter((item) => item.status === "entregue").length,
    criticas: demands.filter((item) => item.priority === "critica").length,
    porStatus: countBy(demands, "status"),
    porCategoria: countBy(demands, "category"),
    porPrioridade: countBy(demands, "priority"),
  };
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    acc[item[field]] = (acc[item[field]] || 0) + 1;
    return acc;
  }, {});
}

function addAudit(db, action, detail) {
  db.audit.unshift({ action, detail, actor: "sistema", createdAt: new Date().toISOString() });
  db.audit = db.audit.slice(0, 100);
}

function addAuditFor(db, action, detail, actor = "sistema") {
  db.audit.unshift({ action, detail, actor, createdAt: new Date().toISOString() });
  db.audit = db.audit.slice(0, 100);
}

function addHistory(demand, action, detail, actor = "sistema") {
  demand.history ||= [];
  demand.history.unshift({ action, detail, actor, createdAt: new Date().toISOString() });
  demand.history = demand.history.slice(0, 100);
}

function findAdmin(db, user) {
  return db.admins.find((admin) => admin.user.toLowerCase() === String(user || "").toLowerCase());
}

function reportData(db, days = 30) {
  const since = Date.now() - Math.max(1, Number(days) || 30) * 24 * 60 * 60 * 1000;
  const items = db.demands.filter((item) => new Date(item.createdAt).getTime() >= since);
  const completed = items.filter((item) => item.status === "entregue");
  const completionHours = completed
    .filter((item) => item.completedAt)
    .map((item) => Math.max(0, (new Date(item.completedAt) - new Date(item.createdAt)) / 36e5));
  const average = completionHours.length ? Math.round((completionHours.reduce((sum, value) => sum + value, 0) / completionHours.length) * 10) / 10 : 0;
  return {
    days: Number(days),
    total: items.length,
    vencidas: items.filter(isOverdue).length,
    concluidas: completed.length,
    criticas: items.filter((item) => item.priority === "critica").length,
    tempoMedioConclusaoHoras: average,
    porTipo: countBy(items, "type"),
    porResponsavel: countBy(items, "assignee"),
    porCategoria: countBy(items, "category"),
    concluidasPorDia: completed.reduce((acc, item) => {
      const day = String(item.completedAt || item.updatedAt || "").slice(0, 10);
      if (day) acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {}),
  };
}

async function notify(event, demand) {
  await Promise.allSettled([notifyWebhook(event, demand), notifyEmail(event, demand)]);
}

async function notifyWebhook(event, demand) {
  if (!NOTIFICATION_WEBHOOK_URL) return;
  try {
    await fetch(NOTIFICATION_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, protocol: demand.protocol, status: demand.status }),
    });
  } catch {
    // Integracao externa nao pode bloquear a operacao principal.
  }
}

async function notifyEmail(event, demand) {
  if (!SMTP_HOST || !NOTIFICATION_EMAIL_TO) return;
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    await transporter.sendMail({
      from: SMTP_FROM,
      to: NOTIFICATION_EMAIL_TO,
      subject: `[Operacao] ${event} - ${demand.protocol}`,
      text: [
        `Evento: ${event}`,
        `Protocolo: ${demand.protocol}`,
        `Titulo: ${demand.title}`,
        `Status: ${demand.status}`,
        `Prioridade: ${demand.priority}`,
        `Responsavel: ${demand.assignee || "Nao definido"}`,
      ].join("\n"),
    });
  } catch {
    // E-mail externo nao pode bloquear a operacao principal.
  }
}

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(createRateLimiter({ windowMs: 60_000, max: 180 }));
  app.use("/api/session", createRateLimiter({ windowMs: 15 * 60_000, max: 20 }));
  app.use(sameOriginGuard);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, "public")));
  app.use("/uploads", requirePermission("read"), express.static(UPLOAD_DIR));

  app.get("/api/health", (req, res) => res.json({
    status: "ok",
    product: "controle-entregas-tarefas",
    storage: STORAGE_DRIVER,
    mode: IS_SERVERLESS_PREVIEW ? "serverless-preview" : "node",
    persistence: STORAGE_DRIVER === "postgres" ? "postgres" : (IS_SERVERLESS_PREVIEW ? "temporary" : "filesystem"),
    adminConfigured: Boolean(ADMIN_PASSWORD_HASH),
    security: {
      production: IS_PRODUCTION,
      sessionSecretConfigured: SESSION_SECRET !== "dev-secret-change-me",
      sessionMaxAgeMinutes: Math.round(SESSION_MAX_AGE_MS / 60000),
    },
  }));

  app.post("/api/session", asyncRoute(async (req, res) => {
    const { user, password } = req.body || {};
    const db = await readDb();
    const admin = findAdmin(db, user);
    if (!admin || admin.active === false || !verifyPassword(password || "", admin.passwordHash)) return res.status(401).json({ error: "Credenciais invalidas." });
    res.setHeader("Set-Cookie", sessionCookie(makeSessionFor(admin)));
    res.json({ ok: true, user: admin.user, role: admin.role });
  }));

  app.delete("/api/session", (req, res) => {
    res.setHeader("Set-Cookie", sessionCookie("", 0));
    res.json({ ok: true });
  });

  app.post("/api/suggest", (req, res) => {
    const text = `${req.body?.title || ""} ${req.body?.description || ""}`;
    res.json({ category: inferCategory(text), priority: inferPriority(text, req.body?.dueAt) });
  });

  app.get("/api/settings", requirePermission("read"), asyncRoute(async (req, res) => {
    res.json((await readDb()).settings);
  }));

  app.put("/api/settings", requirePermission("settings"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const payload = req.body || {};
    db.settings.companyName = String(payload.companyName || db.settings.companyName).trim();
    db.settings.contactEmail = String(payload.contactEmail || db.settings.contactEmail).trim();
    db.settings.primaryColor = String(payload.primaryColor || db.settings.primaryColor).trim();
    db.settings.accentColor = String(payload.accentColor || db.settings.accentColor).trim();
    if (payload.slaHours && typeof payload.slaHours === "object") {
      for (const priority of PRIORITIES) {
        const value = Number(payload.slaHours[priority] || db.settings.slaHours[priority]);
        if (value >= 1 && value <= 720) db.settings.slaHours[priority] = value;
      }
    }
    if (payload.categorySlaHours && typeof payload.categorySlaHours === "object") {
      db.settings.categorySlaHours = db.settings.categorySlaHours || {};
      for (const category of CATEGORIES) {
        const value = Number(payload.categorySlaHours[category]);
        if (value >= 1 && value <= 720) db.settings.categorySlaHours[category] = value;
      }
    }
    addAudit(db, "settings.updated", "Tema, prazos ou configuracoes alterados");
    await writeDb(db);
    res.json(db.settings);
  }));

  app.get("/api/admins", requirePermission("users"), asyncRoute(async (req, res) => {
    res.json((await readDb()).admins.map(({ passwordHash, ...admin }) => admin));
  }));

  app.post("/api/admins", requirePermission("users"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const user = String(req.body?.user || "").trim();
    const role = ROLES.includes(req.body?.role) ? req.body.role : "operador";
    const password = String(req.body?.password || "");
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(user)) return res.status(400).json({ error: "Usuario invalido." });
    if (password.length < 8) return res.status(400).json({ error: "Senha deve ter pelo menos 8 caracteres." });
    if (findAdmin(db, user)) return res.status(409).json({ error: "Usuario ja existe." });
    const admin = { id: nextId(db.admins), user, role, active: true, mustChangePassword: true, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
    db.admins.push(admin);
    addAudit(db, "admin.created", user);
    await writeDb(db);
    const { passwordHash, ...safe } = admin;
    res.status(201).json(safe);
  }));

  app.patch("/api/admins/:id", requirePermission("users"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const admin = db.admins.find((item) => item.id === Number(req.params.id));
    if (!admin) return res.status(404).json({ error: "Usuario nao encontrado." });
    if (req.body?.role && ROLES.includes(req.body.role)) admin.role = req.body.role;
    if (req.body?.active !== undefined) admin.active = Boolean(req.body.active);
    admin.updatedAt = new Date().toISOString();
    addAuditFor(db, "admin.updated", admin.user, req.admin?.user || "admin");
    await writeDb(db);
    const { passwordHash, ...safe } = admin;
    res.json(safe);
  }));

  app.post("/api/me/password", requirePermission("read"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const admin = findAdmin(db, req.admin.user);
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    if (!admin || !verifyPassword(currentPassword, admin.passwordHash)) return res.status(401).json({ error: "Senha atual invalida." });
    if (newPassword.length < 8) return res.status(400).json({ error: "Nova senha deve ter pelo menos 8 caracteres." });
    admin.passwordHash = hashPassword(newPassword);
    admin.mustChangePassword = false;
    admin.updatedAt = new Date().toISOString();
    addAuditFor(db, "admin.password", "Senha alterada pelo proprio usuario", admin.user);
    await writeDb(db);
    res.json({ ok: true });
  }));

  app.post("/api/demands", asyncRoute(async (req, res) => {
    const payload = req.body || {};
    const errors = validateDemand(payload);
    if (errors.length) return res.status(400).json({ errors });
    const db = await readDb();
    const id = nextId(db.demands);
    const text = `${payload.title} ${payload.description}`;
    const priority = PRIORITIES.includes(payload.priority) ? payload.priority : inferPriority(text, payload.dueAt);
    const now = new Date().toISOString();
    const demand = {
      id,
      protocol: formatProtocol(id),
      type: payload.type,
      title: String(payload.title).trim(),
      requester: String(payload.requester).trim(),
      contact: String(payload.contact).trim(),
      category: payload.category || inferCategory(text),
      priority,
      status: "novo",
      assignee: String(payload.assignee || "").trim(),
      origin: String(payload.origin || "").trim(),
      destination: String(payload.destination || "").trim(),
      description: String(payload.description).trim(),
      dueAt: payload.dueAt || dueAtForDb(db, priority, payload.category || inferCategory(text)),
      proof: "",
      notes: [],
      attachments: [],
      history: [],
      createdAt: now,
      updatedAt: now,
      completedAt: "",
    };
    addHistory(demand, "created", "Demanda registrada.", "publico");
    db.demands.push(demand);
    addAudit(db, "demand.created", demand.protocol);
    await writeDb(db);
    await notify("demand.created", demand);
    if (demand.priority === "critica") await notify("demand.critical", demand);
    res.status(201).json(demand);
  }));

  app.get("/api/public/demands/:protocol", asyncRoute(async (req, res) => {
    const contact = String(req.query.contact || "").trim().toLowerCase();
    const demand = (await readDb()).demands.find((item) => item.protocol === req.params.protocol && item.contact.toLowerCase() === contact);
    if (!demand) return res.status(404).json({ error: "Demanda nao encontrada." });
    res.json(publicDemand(demand));
  }));

  app.get("/api/demands", requirePermission("read"), asyncRoute(async (req, res) => {
    let demands = (await readDb()).demands.map((item) => ({ ...item, isOverdue: isOverdue(item) }));
    for (const field of ["status", "category", "priority", "type", "assignee"]) {
      if (req.query[field]) demands = demands.filter((item) => item[field] === req.query[field]);
    }
    if (req.query.search) {
      const q = String(req.query.search).toLowerCase();
      demands = demands.filter((item) => [item.protocol, item.title, item.requester, item.description, item.assignee].some((value) => String(value).toLowerCase().includes(q)));
    }
    res.json(demands.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }));

  app.get("/api/demands/:id", requirePermission("read"), asyncRoute(async (req, res) => {
    const demand = (await readDb()).demands.find((item) => item.id === Number(req.params.id));
    if (!demand) return res.status(404).json({ error: "Demanda nao encontrada." });
    res.json({ ...demand, isOverdue: isOverdue(demand) });
  }));

  app.patch("/api/demands/:id/status", requirePermission("write"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const demand = db.demands.find((item) => item.id === Number(req.params.id));
    if (!demand) return res.status(404).json({ error: "Demanda nao encontrada." });
    const nextStatus = req.body?.status;
    if (!TRANSITIONS[demand.status]?.includes(nextStatus)) return res.status(409).json({ error: "Transicao de status invalida." });
    const fromStatus = demand.status;
    demand.status = nextStatus;
    demand.assignee = String(req.body?.assignee || demand.assignee || "Operacao").trim();
    demand.updatedAt = new Date().toISOString();
    if (nextStatus === "entregue") {
      const completionNote = String(req.body?.completionNote || "").trim();
      const proof = String(req.body?.proof || demand.proof || "").trim();
      if (!completionNote || !proof) return res.status(400).json({ error: "Conclusao exige observacao final e comprovante." });
      demand.completedAt = demand.updatedAt;
      demand.proof = proof;
      demand.completionNote = completionNote;
      demand.completedBy = req.admin?.user || "admin";
    }
    addHistory(demand, "status", `${fromStatus} -> ${nextStatus}`, req.admin?.user || "admin");
    addAuditFor(db, "demand.status", `${demand.protocol}: ${nextStatus}`, req.admin?.user || "admin");
    await writeDb(db);
    await notify("demand.status", demand);
    res.json(demand);
  }));

  app.patch("/api/demands/:id", requirePermission("write"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const demand = db.demands.find((item) => item.id === Number(req.params.id));
    if (!demand) return res.status(404).json({ error: "Demanda nao encontrada." });
    const fields = ["title", "requester", "contact", "origin", "destination", "category", "priority", "assignee", "dueAt", "description", "proof"];
    for (const field of fields) {
      if (req.body?.[field] !== undefined) demand[field] = String(req.body[field]).trim();
    }
    demand.updatedAt = new Date().toISOString();
    addHistory(demand, "updated", "Dados principais atualizados.", req.admin?.user || "admin");
    if (!req.body?.dueAt && (req.body?.priority || req.body?.category)) {
      demand.dueAt = dueAtForDb(db, demand.priority, demand.category);
    }
    addAuditFor(db, "demand.updated", demand.protocol, req.admin?.user || "admin");
    await writeDb(db);
    res.json({ ...demand, isOverdue: isOverdue(demand) });
  }));

  app.post("/api/demands/:id/notes", requirePermission("write"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const demand = db.demands.find((item) => item.id === Number(req.params.id));
    if (!demand) return res.status(404).json({ error: "Demanda nao encontrada." });
    const text = String(req.body?.text || "").trim();
    if (text.length < 3) return res.status(400).json({ error: "Nota muito curta." });
    const note = { visibility: req.body?.visibility === "public" ? "public" : "internal", text, createdAt: new Date().toISOString() };
    demand.notes.push(note);
    demand.updatedAt = note.createdAt;
    addHistory(demand, "note", note.visibility === "public" ? "Resposta publica adicionada." : "Nota interna adicionada.", req.admin?.user || "admin");
    addAuditFor(db, "demand.note", demand.protocol, req.admin?.user || "admin");
    await writeDb(db);
    res.status(201).json(note);
  }));

  app.post("/api/demands/:id/attachments", requirePermission("write"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const demand = db.demands.find((item) => item.id === Number(req.params.id));
    if (!demand) return res.status(404).json({ error: "Demanda nao encontrada." });
    const attachment = {
      id: nextId(demand.attachments || []),
      name: String(req.body?.name || "comprovante").trim(),
      url: String(req.body?.url || "").trim(),
      type: String(req.body?.type || "link").trim(),
      createdAt: new Date().toISOString(),
    };
    if (!attachment.url) return res.status(400).json({ error: "URL do anexo e obrigatoria nesta versao." });
    demand.attachments.push(attachment);
    demand.proof = attachment.url;
    demand.updatedAt = attachment.createdAt;
    addHistory(demand, "attachment", `Anexo registrado: ${attachment.name}`, req.admin?.user || "admin");
    addAuditFor(db, "demand.attachment", demand.protocol, req.admin?.user || "admin");
    await writeDb(db);
    res.status(201).json(attachment);
  }));

  app.post("/api/demands/:id/files", requirePermission("write"), upload.single("file"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const demand = db.demands.find((item) => item.id === Number(req.params.id));
    if (!demand) return res.status(404).json({ error: "Demanda nao encontrada." });
    if (!req.file) return res.status(400).json({ error: "Arquivo obrigatorio." });
    const attachment = {
      id: nextId(demand.attachments || []),
      name: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      type: path.extname(req.file.originalname).replace(".", "") || "file",
      storageName: req.file.filename,
      size: req.file.size,
      createdAt: new Date().toISOString(),
    };
    demand.attachments.push(attachment);
    demand.proof = attachment.url;
    demand.updatedAt = attachment.createdAt;
    addHistory(demand, "attachment", `Arquivo enviado: ${attachment.name}`, req.admin?.user || "admin");
    addAuditFor(db, "demand.file", demand.protocol, req.admin?.user || "admin");
    await writeDb(db);
    res.status(201).json(attachment);
  }));

  app.get("/api/dashboard", requirePermission("read"), asyncRoute(async (req, res) => res.json(dashboard(await readDb()))));
  app.get("/api/reports", requirePermission("read"), asyncRoute(async (req, res) => {
    const db = await readDb();
    let report = reportData(db, req.query.days || 30);
    if (req.query.category || req.query.assignee) {
      const filtered = { ...db, demands: db.demands.filter((item) => {
        if (req.query.category && item.category !== req.query.category) return false;
        if (req.query.assignee && item.assignee !== req.query.assignee) return false;
        return true;
      }) };
      report = reportData(filtered, req.query.days || 30);
    }
    res.json(report);
  }));
  app.get("/api/report.pdf", requirePermission("export"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const report = reportData(db, req.query.days || 30);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Relatorio Operacional</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#18211f}h1{color:#16423c}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{border:1px solid #d9e2dd;padding:14px;border-radius:8px}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{border-bottom:1px solid #d9e2dd;padding:8px;text-align:left}</style></head><body><h1>Sistema de Controle de Entregas e Tarefas Operacionais</h1><p>Relatorio imprimivel. Use o navegador para salvar como PDF.</p><div class="grid"><div class="card"><strong>${report.total}</strong><br>Total</div><div class="card"><strong>${report.vencidas}</strong><br>Vencidas</div><div class="card"><strong>${report.concluidas}</strong><br>Entregues</div><div class="card"><strong>${report.tempoMedioConclusaoHoras}h</strong><br>Media conclusao</div></div><table><thead><tr><th>Protocolo</th><th>Titulo</th><th>Status</th><th>Responsavel</th><th>Prazo</th></tr></thead><tbody>${db.demands.map((d) => `<tr><td>${d.protocol}</td><td>${d.title}</td><td>${d.status}</td><td>${d.assignee || ""}</td><td>${d.dueAt}</td></tr>`).join("")}</tbody></table></body></html>`;
    res.type("html").send(html);
  }));
  app.get("/api/audit", requirePermission("read"), asyncRoute(async (req, res) => res.json((await readDb()).audit)));
  app.get("/api/backup", requirePermission("export"), asyncRoute(async (req, res) => res.json(await readDb())));

  app.post("/api/notifications/check-overdue", requirePermission("write"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const overdue = db.demands.filter((item) => isOverdue(item) && !item.overdueNotifiedAt);
    for (const demand of overdue) {
      demand.overdueNotifiedAt = new Date().toISOString();
      addHistory(demand, "notification", "Alerta de prazo vencido enviado.", req.admin?.user || "admin");
      await notify("demand.overdue", demand);
    }
    if (overdue.length) addAuditFor(db, "notification.overdue", `${overdue.length} alerta(s) enviados`, req.admin?.user || "admin");
    await writeDb(db);
    res.json({ notified: overdue.length });
  }));

  app.get("/api/export.csv", requirePermission("export"), asyncRoute(async (req, res) => {
    const rows = (await readDb()).demands;
    const header = ["protocol", "type", "title", "requester", "category", "priority", "status", "assignee", "dueAt"];
    const csv = [header.join(","), ...rows.map((row) => header.map((field) => `"${String(row[field] || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    res.type("text/csv").send(csv);
  }));

  app.post("/api/demo/seed", requirePermission("seed"), asyncRoute(async (req, res) => {
    const db = await readDb();
    const samples = [
      ["coleta", "Coleta atrasada no fornecedor", "Fornecedor Norte", "rota", "critica", "aguardando_coleta"],
      ["tarefa", "Conferencia de volumes da rota 12", "Estoque", "estoque", "media", "em_separacao"],
      ["entrega", "Entrega agendada para cliente premium", "Loja Sul", "entrega", "alta", "em_rota"],
    ];
    const created = samples.map(([type, title, requester, category, priority, status]) => {
      const id = nextId(db.demands);
      const now = new Date().toISOString();
      const demand = {
        id,
        protocol: formatProtocol(id),
        type,
        title,
        requester,
        contact: `${String(requester).toLowerCase().replace(/\s+/g, ".")}@empresa.com`,
        category,
        priority,
        status,
        assignee: "Equipe Operacional",
        origin: "Base operacional",
        destination: "Destino em validacao",
        description: `${title} criada para demonstracao do sistema.`,
        dueAt: dueAtForDb(db, priority, category),
        proof: "",
        notes: [],
        attachments: [],
        history: [],
        createdAt: now,
        updatedAt: now,
        completedAt: "",
      };
      addHistory(demand, "created", "Demanda demo criada.", req.admin?.user || "admin");
      db.demands.push(demand);
      return demand;
    });
    addAudit(db, "demo.seed", `${created.length} demandas demo criadas`);
    await writeDb(db);
    res.status(201).json({ created: created.length, demands: created });
  }));

  app.use("/api", (req, res) => res.status(404).json({ error: "Recurso nao encontrado." }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(500).json({ error: "Falha interna ao processar a solicitacao." });
  });
  return app;
}

if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`Sistema de Controle de Entregas e Tarefas Operacionais em http://localhost:${PORT}`);
  });
}

module.exports = {
  createApp,
  inferPriority,
  inferCategory,
  validateDemand,
  sha256,
  hashPassword,
  verifyPassword,
  STATUSES,
  TYPES,
  CATEGORIES,
  TRANSITIONS,
};
