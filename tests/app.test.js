const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, before, after } = require("node:test");

let server;
let baseUrl;
let cookie;
const dataFile = path.join(os.tmpdir(), `controle-operacional-${Date.now()}.json`);
process.env.DATA_FILE = dataFile;
const { createApp, inferCategory, inferPriority, validateDemand, sha256 } = require("../server");

before(async () => {
  process.env.ADMIN_PASSWORD_HASH = sha256("admin123");
  server = await new Promise((resolve) => {
    const instance = createApp().listen(0, () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
});

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  return { response, body };
}

async function createTestDemand(overrides = {}) {
  const created = await request("/api/demands", {
    method: "POST",
    body: JSON.stringify({
      type: "entrega",
      title: `Demanda teste ${Date.now()}`,
      requester: "Teste Automatizado",
      contact: `teste-${Date.now()}@empresa.com`,
      origin: "Origem teste",
      destination: "Destino teste",
      description: "Demanda criada para teste automatizado de fluxo operacional",
      ...overrides,
    }),
  });
  assert.equal(created.response.status, 201);
  return created.body;
}

test("classifica prioridade e categoria operacional", () => {
  assert.equal(inferPriority("rota parada com cliente aguardando"), "critica");
  assert.equal(inferCategory("coleta no fornecedor hoje"), "coleta");
  assert.equal(validateDemand({ type: "entrega", title: "Entrega", requester: "Loja", contact: "ops", description: "Enviar pedido ao cliente" }).length, 0);
});

test("informa modo de persistencia no healthcheck", async () => {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.body.storage, "json");
  assert.equal(health.body.persistence, "filesystem");
  assert.equal(health.body.security.sessionMaxAgeMinutes, 480);
});

test("cria demanda publica e consulta por protocolo", async () => {
  const created = await request("/api/demands", {
    method: "POST",
    body: JSON.stringify({
      type: "entrega",
      title: "Reentrega urgente",
      requester: "Loja Centro",
      contact: "loja@empresa.com",
      origin: "CD",
      destination: "Cliente",
      description: "Cliente aguardando reentrega urgente no centro",
    }),
  });
  assert.equal(created.response.status, 201);
  assert.match(created.body.protocol, /^OP-\d{4}-\d{4}$/);
  assert.equal(created.body.priority, "critica");

  const lookup = await request(`/api/public/demands/${created.body.protocol}?contact=loja%40empresa.com`, { headers: {} });
  assert.equal(lookup.response.status, 200);
  assert.equal(lookup.body.title, "Reentrega urgente");
  assert.equal(lookup.body.contact, undefined);
});

test("protege painel e permite fluxo administrativo", async () => {
  const blocked = await request("/api/dashboard");
  assert.equal(blocked.response.status, 401);

  const login = await request("/api/session", {
    method: "POST",
    body: JSON.stringify({ user: "admin", password: "admin123" }),
  });
  assert.equal(login.response.status, 200);
  cookie = login.response.headers.get("set-cookie").split(";")[0];

  const first = await createTestDemand({ title: "Fluxo administrativo controlado" });

  const status = await request(`/api/demands/${first.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "em_separacao", assignee: "Carlos" }),
  });
  assert.equal(status.response.status, 200);
  assert.equal(status.body.status, "em_separacao");

  const note = await request(`/api/demands/${first.id}/notes`, {
    method: "POST",
    body: JSON.stringify({ visibility: "public", text: "Equipe alinhando rota." }),
  });
  assert.equal(note.response.status, 201);

  const detail = await request(`/api/demands/${first.id}`);
  assert.equal(detail.response.status, 200);
  assert.ok(Array.isArray(detail.body.history));

  const dashboard = await request("/api/dashboard");
  assert.equal(dashboard.response.status, 200);
  assert.ok(dashboard.body.total >= 1);
});

test("aplica headers de seguranca e bloqueia origem cruzada em escrita", async () => {
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.equal(health.headers.get("x-frame-options"), "DENY");
  assert.match(health.headers.get("content-security-policy"), /default-src 'self'/);

  const blocked = await fetch(`${baseUrl}/api/demo/seed`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://malicioso.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(blocked.status, 403);
});

test("bloqueia transicao invalida", async () => {
  const first = await createTestDemand({ title: "Transicao invalida controlada" });
  const invalid = await request(`/api/demands/${first.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "entregue" }),
  });
  assert.equal(invalid.response.status, 409);
});

test("configura tema, cria usuario, anexo, relatorio e demo", async () => {
  const settings = await request("/api/settings", {
    method: "PUT",
    body: JSON.stringify({
      companyName: "Operacao Premium",
      primaryColor: "#123456",
      accentColor: "#256f5b",
      slaHours: { critica: 1, alta: 4, media: 12, baixa: 48 },
      categorySlaHours: { entrega: 6 },
    }),
  });
  assert.equal(settings.response.status, 200);
  assert.equal(settings.body.companyName, "Operacao Premium");
  assert.equal(settings.body.slaHours.critica, 1);
  assert.equal(settings.body.categorySlaHours.entrega, 6);

  const admin = await request("/api/admins", {
    method: "POST",
    body: JSON.stringify({ user: "operador01", password: "senha-forte", role: "operador" }),
  });
  assert.equal(admin.response.status, 201);
  assert.equal(admin.body.role, "operador");

  const list = await request("/api/demands");
  const first = list.body[0];
  const attachment = await request(`/api/demands/${first.id}/attachments`, {
    method: "POST",
    body: JSON.stringify({ name: "Canhoto", url: "https://example.com/canhoto.pdf" }),
  });
  assert.equal(attachment.response.status, 201);

  const report = await request("/api/reports?days=30");
  assert.equal(report.response.status, 200);
  assert.ok(report.body.total >= 1);

  const pdf = await fetch(`${baseUrl}/api/report.pdf`, { headers: { Cookie: cookie } });
  assert.equal(pdf.status, 200);
  assert.match(await pdf.text(), /Relatorio Operacional/);

  const seed = await request("/api/demo/seed", { method: "POST" });
  assert.equal(seed.response.status, 201);
  assert.equal(seed.body.created, 3);
});

test("troca senha, bloqueia usuario, edita demanda e exige comprovante para entregar", async () => {
  const admins = await request("/api/admins");
  const operador = admins.body.find((item) => item.user === "operador01");
  assert.ok(operador);

  const blockedUser = await request(`/api/admins/${operador.id}`, {
    method: "PATCH",
    body: JSON.stringify({ active: false }),
  });
  assert.equal(blockedUser.response.status, 200);
  assert.equal(blockedUser.body.active, false);

  const password = await request("/api/me/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword: "admin123", newPassword: "nova-senha-admin" }),
  });
  assert.equal(password.response.status, 200);

  const relogin = await request("/api/session", {
    method: "POST",
    body: JSON.stringify({ user: "admin", password: "nova-senha-admin" }),
  });
  assert.equal(relogin.response.status, 200);
  cookie = relogin.response.headers.get("set-cookie").split(";")[0];

  const created = await request("/api/demands", {
    method: "POST",
    body: JSON.stringify({
      type: "entrega",
      title: "Entrega com comprovante",
      requester: "Cliente Final",
      contact: "cliente@empresa.com",
      category: "entrega",
      description: "Entrega precisa seguir fluxo com comprovante",
    }),
  });
  const id = created.body.id;
  const edited = await request(`/api/demands/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ assignee: "Maria", origin: "CD", destination: "Cliente", priority: "alta" }),
  });
  assert.equal(edited.body.assignee, "Maria");
  assert.equal(edited.body.origin, "CD");

  const sep = await request(`/api/demands/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "em_separacao" }) });
  assert.equal(sep.response.status, 200);
  const route = await request(`/api/demands/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "em_rota" }) });
  assert.equal(route.response.status, 200);
  const missingProof = await request(`/api/demands/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "entregue" }) });
  assert.equal(missingProof.response.status, 400);
  const delivered = await request(`/api/demands/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "entregue", completionNote: "Recebido pelo cliente.", proof: "https://example.com/prova.pdf" }),
  });
  assert.equal(delivered.response.status, 200);
  assert.equal(delivered.body.status, "entregue");
  assert.equal(delivered.body.completedBy, "admin");
});

test("upload real e alerta de prazo vencido funcionam", async () => {
  const created = await request("/api/demands", {
    method: "POST",
    body: JSON.stringify({
      type: "entrega",
      title: "Entrega vencida com arquivo",
      requester: "Cliente Arquivo",
      contact: "arquivo@empresa.com",
      category: "entrega",
      description: "Entrega para validar upload e alerta vencido",
      dueAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    }),
  });
  assert.equal(created.response.status, 201);

  const data = new FormData();
  data.append("file", new Blob(["comprovante"], { type: "application/pdf" }), "comprovante.pdf");
  const upload = await fetch(`${baseUrl}/api/demands/${created.body.id}/files`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: data,
  });
  assert.equal(upload.status, 201);
  const uploaded = await upload.json();
  assert.match(uploaded.url, /^\/uploads\//);

  const notified = await request("/api/notifications/check-overdue", { method: "POST" });
  assert.equal(notified.response.status, 200);
  assert.ok(notified.body.notified >= 1);
});
