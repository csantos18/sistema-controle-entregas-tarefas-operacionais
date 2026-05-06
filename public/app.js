const $ = (selector) => document.querySelector(selector);
const form = $("#demand-form");
const suggestion = $("#suggestion");
const formMessage = $("#form-message");
const loginForm = $("#login-form");
const adminArea = $("#admin-area");
const loginMessage = $("#login-message");
const lookupForm = $("#lookup-form");
const lookupResult = $("#lookup-result");
const detailDialog = $("#detail-dialog");
const detailBody = $("#detail-body");
const detailTitle = $("#detail-title");
const statuses = ["novo", "em_separacao", "aguardando_coleta", "em_rota", "entregue", "falha_entrega", "reentrega", "cancelado"];
let currentDemands = [];
let currentSettings = null;
let timer;

const menuToggle = document.querySelector(".menu-toggle");
const mainMenu = document.querySelector("#main-menu");
if (menuToggle && mainMenu) {
  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    mainMenu.classList.toggle("is-open", !expanded);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function formatDate(value) {
  if (!value) return "Sem prazo";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function collectDemandPayload() {
  const data = Object.fromEntries(new FormData(form).entries());
  if (data.dueAt) data.dueAt = new Date(data.dueAt).toISOString();
  return data;
}

form.description.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const payload = collectDemandPayload();
    if ((payload.description || "").length < 4) return;
    const response = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    suggestion.textContent = `Sugestao: categoria ${data.category}, prioridade ${data.priority}.`;
  }, 250);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";
  const response = await fetch("/api/demands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(collectDemandPayload()),
  });
  const data = await response.json();
  if (!response.ok) {
    formMessage.textContent = (data.errors || [data.error || "Nao foi possivel registrar."]).join(" ");
    formMessage.classList.add("error");
    return;
  }
  formMessage.classList.remove("error");
  formMessage.innerHTML = `Demanda <strong>${escapeHtml(data.protocol)}</strong> registrada com prioridade <strong>${escapeHtml(data.priority)}</strong> e prazo <strong>${escapeHtml(formatDate(data.dueAt))}</strong>.`;
  form.reset();
  suggestion.textContent = "A prioridade e a categoria sugeridas aparecem aqui.";
  await refreshPublicMetrics();
});

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(lookupForm).entries());
  const response = await fetch(`/api/public/demands/${encodeURIComponent(data.protocol)}?contact=${encodeURIComponent(data.contact)}`);
  const demand = await response.json();
  if (!response.ok) {
    lookupResult.innerHTML = `<p class="message error">${escapeHtml(demand.error)}</p>`;
    return;
  }
  lookupResult.innerHTML = `
    <dl class="details">
      <div><dt>Status</dt><dd>${escapeHtml(demand.status)}</dd></div>
      <div><dt>Prioridade</dt><dd>${escapeHtml(demand.priority)}</dd></div>
      <div><dt>Responsavel</dt><dd>${escapeHtml(demand.assignee || "Aguardando definicao")}</dd></div>
      <div><dt>Prazo</dt><dd>${escapeHtml(formatDate(demand.dueAt))}${demand.isOverdue ? " - vencida" : ""}</dd></div>
    </dl>
    ${demand.lastPublicNote ? `<p class="customer-note">${escapeHtml(demand.lastPublicNote.text)}</p>` : ""}
  `;
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.fromEntries(new FormData(loginForm).entries())),
  });
  if (!response.ok) {
    loginMessage.textContent = "Credenciais invalidas.";
    loginMessage.classList.add("error");
    return;
  }
  loginMessage.textContent = "";
  adminArea.classList.remove("hidden");
  await refreshAdmin();
});

$("#logout").addEventListener("click", async () => {
  await fetch("/api/session", { method: "DELETE" });
  adminArea.classList.add("hidden");
});

$("#search").addEventListener("input", () => setTimeout(loadDemands, 150));
$("#status-filter").addEventListener("change", loadDemands);
$("#priority-filter").addEventListener("change", loadDemands);
$("#category-filter").addEventListener("change", loadDemands);
$("#demo-seed").addEventListener("click", async () => {
  await fetch("/api/demo/seed", { method: "POST" });
  await refreshAdmin();
});
$("#detail-close").addEventListener("click", () => detailDialog.close());

$("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(event.target).entries());
  const payload = {
    companyName: formData.companyName,
    contactEmail: formData.contactEmail,
    primaryColor: formData.primaryColor,
    accentColor: formData.accentColor,
    slaHours: {
      critica: formData.slaCritica,
      alta: formData.slaAlta,
      media: formData.slaMedia,
      baixa: formData.slaBaixa,
    },
  };
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  $("#settings-message").textContent = response.ok ? "Configuracoes salvas." : (data.error || "Nao foi possivel salvar.");
  if (response.ok) applySettings(data);
});

async function refreshPublicMetrics() {
  const response = await fetch("/api/health");
  if (response.ok) {
    $("#hero-open").textContent = $("#hero-open").textContent || "0";
  }
}

async function refreshAdmin() {
  await Promise.all([loadSettings(), loadDashboard(), loadDemands(), loadAudit()]);
}

async function loadDashboard() {
  const response = await fetch("/api/dashboard");
  if (!response.ok) return;
  const data = await response.json();
  $("#hero-open").textContent = data.abertas;
  $("#hero-critical").textContent = data.criticas;
  $("#hero-overdue").textContent = data.vencidas;
  $("#metrics").innerHTML = [
    ["Total", data.total],
    ["Abertas", data.abertas],
    ["Em rota", data.emRota],
    ["Separacao", data.emSeparacao],
    ["Aguard. coleta", data.aguardandoColeta],
    ["Falhas", data.falhas],
    ["Reentregas", data.reentregas],
    ["Vencidas", data.vencidas],
    ["Entregues", data.concluidas],
    ["Criticas", data.criticas],
  ].map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join("");
  renderChart($("#status-chart"), data.porStatus);
  renderChart($("#priority-chart"), data.porPrioridade);
  renderChart($("#category-chart"), data.porCategoria);
}

async function loadSettings() {
  const response = await fetch("/api/settings");
  if (!response.ok) return;
  const settings = await response.json();
  applySettings(settings);
}

function applySettings(settings) {
  currentSettings = settings;
  document.documentElement.style.setProperty("--primary", settings.primaryColor || "#16423c");
  document.documentElement.style.setProperty("--accent", settings.accentColor || "#256f5b");
  const settingsForm = $("#settings-form");
  if (settingsForm) {
    settingsForm.companyName.value = settings.companyName || "";
    settingsForm.contactEmail.value = settings.contactEmail || "";
    settingsForm.primaryColor.value = settings.primaryColor || "#16423c";
    settingsForm.accentColor.value = settings.accentColor || "#256f5b";
    settingsForm.slaCritica.value = settings.slaHours?.critica || "";
    settingsForm.slaAlta.value = settings.slaHours?.alta || "";
    settingsForm.slaMedia.value = settings.slaHours?.media || "";
    settingsForm.slaBaixa.value = settings.slaHours?.baixa || "";
  }
}

function renderChart(container, data) {
  const entries = Object.entries(data || {});
  if (!entries.length) {
    container.innerHTML = "<p class=\"hint\">Sem dados.</p>";
    return;
  }
  const max = Math.max(...entries.map(([, value]) => value), 1);
  container.innerHTML = entries.map(([label, value]) => `
    <div class="bar-row">
      <span>${escapeHtml(label.replace("_", " "))}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(value / max) * 100}%"></div></div>
      <strong>${value}</strong>
    </div>
  `).join("");
}

async function loadDemands() {
  const params = new URLSearchParams();
  if ($("#search").value) params.set("search", $("#search").value);
  if ($("#status-filter").value) params.set("status", $("#status-filter").value);
  if ($("#priority-filter").value) params.set("priority", $("#priority-filter").value);
  if ($("#category-filter").value) params.set("category", $("#category-filter").value);
  const response = await fetch(`/api/demands?${params.toString()}`);
  if (!response.ok) return;
  currentDemands = await response.json();
  renderKanban();
}

function renderKanban() {
  $("#kanban").innerHTML = statuses.map((status) => {
    const items = currentDemands.filter((item) => item.status === status);
    return `
      <section class="lane">
        <h3>${status.replace("_", " ")} <span>${items.length}</span></h3>
        ${items.map(renderCard).join("") || "<p class=\"hint\">Sem demandas.</p>"}
      </section>
    `;
  }).join("");
}

function renderCard(item) {
  const nextOptions = {
    novo: ["em_separacao", "aguardando_coleta", "em_rota", "cancelado"],
    em_separacao: ["aguardando_coleta", "em_rota", "falha_entrega", "cancelado"],
    aguardando_coleta: ["em_rota", "falha_entrega", "cancelado"],
    em_rota: ["entregue", "falha_entrega", "reentrega", "cancelado"],
    falha_entrega: ["reentrega", "cancelado"],
    reentrega: ["em_rota", "entregue", "falha_entrega", "cancelado"],
    entregue: [],
    cancelado: [],
  }[item.status];
  return `
    <article class="demand ${item.isOverdue ? "overdue" : ""}">
      <strong>${escapeHtml(item.protocol)} - ${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.requester)} | ${escapeHtml(item.category)} | prioridade ${escapeHtml(item.priority)}</p>
      <small>Prazo: ${escapeHtml(formatDate(item.dueAt))}</small>
      <small>Responsavel: ${escapeHtml(item.assignee || "Nao definido")}</small>
      <div class="route-line"><span>${escapeHtml(item.origin || "Origem nao informada")}</span><b>-></b><span>${escapeHtml(item.destination || "Destino nao informado")}</span></div>
      <div class="card-actions">
        <button type="button" data-detail="${item.id}">Detalhes</button>
        ${nextOptions.map((status) => `<button type="button" data-id="${item.id}" data-status="${status}">${status.replace("_", " ")}</button>`).join("")}
      </div>
    </article>
  `;
}

$("#kanban").addEventListener("click", async (event) => {
  const detailButton = event.target.closest("[data-detail]");
  if (detailButton) {
    await showDetails(detailButton.dataset.detail);
    return;
  }
  const button = event.target.closest("[data-id]");
  if (!button) return;
  await fetch(`/api/demands/${button.dataset.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: button.dataset.status,
      completionNote: button.dataset.status === "entregue" ? window.prompt("Observacao final da entrega") : "",
      proof: button.dataset.status === "entregue" ? window.prompt("Comprovante ou link do comprovante") : "",
    }),
  });
  await refreshAdmin();
});

async function showDetails(id) {
  const response = await fetch(`/api/demands/${id}`);
  if (!response.ok) return;
  const item = await response.json();
  detailTitle.textContent = `${item.protocol} - ${item.title}`;
  detailBody.innerHTML = `
    <dl class="details">
      <div><dt>Solicitante</dt><dd>${escapeHtml(item.requester)}</dd></div>
      <div><dt>Contato</dt><dd>${escapeHtml(item.contact)}</dd></div>
      <div><dt>Status</dt><dd>${escapeHtml(item.status)}</dd></div>
      <div><dt>Prioridade</dt><dd>${escapeHtml(item.priority)}</dd></div>
      <div><dt>Categoria</dt><dd>${escapeHtml(item.category)}</dd></div>
      <div><dt>Responsavel</dt><dd>${escapeHtml(item.assignee || "Nao definido")}</dd></div>
      <div><dt>Origem</dt><dd>${escapeHtml(item.origin || "Nao informada")}</dd></div>
      <div><dt>Destino</dt><dd>${escapeHtml(item.destination || "Nao informado")}</dd></div>
      <div><dt>Prazo</dt><dd>${escapeHtml(formatDate(item.dueAt))}</dd></div>
    </dl>
    <h3>Descricao</h3>
    <p>${escapeHtml(item.description)}</p>
    <form class="inline-form" id="note-form">
      <input name="text" placeholder="Nova nota ou resposta" required>
      <select name="visibility"><option value="internal">Interna</option><option value="public">Publica</option></select>
      <button type="submit">Adicionar nota</button>
    </form>
    <form class="inline-form" id="attachment-form">
      <input name="name" placeholder="Nome do comprovante" required>
      <input name="url" placeholder="URL do comprovante/anexo" required>
      <button type="submit">Adicionar anexo</button>
    </form>
    <form class="inline-form" id="file-form" enctype="multipart/form-data">
      <input name="file" type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" required>
      <button type="submit">Enviar arquivo</button>
    </form>
    <form class="edit-form" id="edit-form">
      <input name="assignee" placeholder="Responsavel" value="${escapeHtml(item.assignee || "")}">
      <input name="dueAt" type="datetime-local">
      <select name="priority"><option value="">Prioridade</option><option value="critica">Critica</option><option value="alta">Alta</option><option value="media">Media</option><option value="baixa">Baixa</option></select>
      <select name="category"><option value="">Categoria</option><option value="entrega">Entrega</option><option value="coleta">Coleta</option><option value="rota">Rota</option><option value="estoque">Estoque</option><option value="manutencao">Manutencao</option><option value="administrativo">Administrativo</option></select>
      <input name="origin" placeholder="Origem" value="${escapeHtml(item.origin || "")}">
      <input name="destination" placeholder="Destino" value="${escapeHtml(item.destination || "")}">
      <button type="submit">Salvar edicao</button>
    </form>
    <h3>Mapa/rota textual</h3>
    <div class="route-map"><span>${escapeHtml(item.origin || "Origem")}</span><b>-></b><span>${escapeHtml(item.destination || "Destino")}</span></div>
    <h3>Anexos</h3>
    <div class="history">${(item.attachments || []).map((file) => `<p><a href="${escapeHtml(file.url)}" target="_blank">${escapeHtml(file.name)}</a> <small>${escapeHtml(formatDate(file.createdAt))}</small></p>`).join("") || "<p class=\"hint\">Sem anexos.</p>"}</div>
    <h3>Historico</h3>
    <div class="history">${(item.history || []).map((event) => `<p><strong>${escapeHtml(event.action)}</strong> - ${escapeHtml(event.detail)} <small>${escapeHtml(event.actor)} em ${escapeHtml(formatDate(event.createdAt))}</small></p>`).join("") || "<p class=\"hint\">Sem historico.</p>"}</div>
  `;
  detailDialog.showModal();
  $("#note-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await fetch(`/api/demands/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries())),
    });
    await showDetails(id);
    await refreshAdmin();
  });
  $("#attachment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await fetch(`/api/demands/${id}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries())),
    });
    await showDetails(id);
    await refreshAdmin();
  });
  $("#file-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await fetch(`/api/demands/${id}/files`, {
      method: "POST",
      body: new FormData(event.target),
    });
    await showDetails(id);
    await refreshAdmin();
  });
  $("#edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.target).entries());
    Object.keys(payload).forEach((key) => {
      if (!payload[key]) delete payload[key];
    });
    if (payload.dueAt) payload.dueAt = new Date(payload.dueAt).toISOString();
    await fetch(`/api/demands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await showDetails(id);
    await refreshAdmin();
  });
}

async function loadAudit() {
  const response = await fetch("/api/audit");
  if (!response.ok) return;
  const events = await response.json();
  $("#audit").innerHTML = events.slice(0, 10).map((event) => `<p><strong>${escapeHtml(event.action)}</strong> - ${escapeHtml(event.detail)} <small>${escapeHtml(formatDate(event.createdAt))}</small></p>`).join("") || "<p class=\"hint\">Sem auditoria.</p>";
}
