# Sistema de Controle de Entregas e Tarefas Operacionais

Sistema web profissional para registrar, priorizar, acompanhar e auditar entregas, coletas, rotas e tarefas internas. O projeto foi criado como uma entrega nova e independente, com tela publica, painel operacional, API REST, persistencia local, login administrativo, regras de prazo, exportacao, backup, LGPD e documentacao de producao.

## Implementacoes Profissionais Incluidas

- Dashboard com graficos reais por status, prioridade e categoria.
- Mapa/rota textual com origem e destino em cada demanda.
- SLA configuravel por prioridade e estrutura para SLA por categoria.
- Relatorio gerencial imprimivel em PDF via navegador.
- Tema visual configuravel por cliente no painel.
- Pagina comercial dedicada em `/comercial.html`.
- Usuarios com perfis e permissoes.
- Detalhe completo da demanda com historico, notas e anexos por link.
- Upload real de comprovantes em PNG, JPG, WEBP ou PDF.
- Troca de senha, bloqueio/desbloqueio de usuario e auditoria por ator.
- Status operacionais: novo, em separacao, aguardando coleta, em rota, entregue, falha na entrega, reentrega e cancelado.
- Conclusao exige observacao final e comprovante.
- Notificacoes opcionais por webhook e e-mail SMTP, incluindo alerta de demanda critica e prazo vencido.
- Migrations PostgreSQL, indices de busca e script de backup.
- Filtros avancados por status, prioridade, categoria e busca livre.
- Seed demo para demonstracoes comerciais.
- Deploy documentado com dominio, HTTPS, homologacao e producao separados.

## Preview Das Telas

As imagens ficam em `public/screens/` e ja foram geradas para a entrega:

- `public/screens/home-desktop.png`: tela publica de registro e consulta.
- `public/screens/home-tablet.png`: tela publica em tablet.
- `public/screens/home-mobile.png`: tela publica em celular com menu hamburguer.
- `public/screens/admin-desktop.png`: painel operacional com indicadores e kanban.
- `public/screens/docs-desktop.png`: documentacao visual de rotas.

Para gerar novamente:

```bash
npm run screenshots
```

## Demonstracao Visual

Fluxo demonstravel:

1. Registrar uma entrega, coleta ou tarefa operacional.
2. Receber protocolo no formato `OP-AAAA-0001`.
3. Consultar andamento pelo protocolo e contato.
4. Entrar no painel administrativo.
5. Mover a demanda entre status permitidos.
6. Exportar CSV ou baixar backup JSON.

## Como Rodar Localmente

```bash
npm install
npm start
```

Acesse:

```text
http://localhost:3000
```

Credenciais locais:

```text
usuario: admin
senha: admin123
```

## Qualidade E Testes

```bash
npm test
npm run check
npm run backup
```

Os testes cobrem classificacao de prioridade/categoria, abertura publica, consulta por protocolo, login, painel protegido, alteracao de status, notas e bloqueio de transicao invalida.

## Responsividade

Breakpoints adotados no CSS:

- Celular: ate 768px, com menu hamburguer.
- Tablet: 769px a 1024px.
- Desktop: acima de 1024px.

## Rotas Principais

Publicas:

- `GET /`
- `GET /docs.html`
- `GET /comercial.html`
- `GET /api/health`
- `POST /api/demands`
- `GET /api/public/demands/:protocol?contact=...`
- `POST /api/suggest`

Administrativas:

- `POST /api/session`
- `DELETE /api/session`
- `GET /api/demands`
- `PATCH /api/demands/:id/status`
- `POST /api/demands/:id/notes`
- `GET /api/dashboard`
- `GET /api/reports`
- `GET /api/report.pdf`
- `GET /api/audit`
- `GET /api/export.csv`
- `GET /api/backup`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/admins`
- `POST /api/admins`
- `PATCH /api/admins/:id`
- `POST /api/me/password`
- `POST /api/demo/seed`
- `POST /api/demands/:id/files`
- `POST /api/notifications/check-overdue`

## PostgreSQL E Ambientes

O projeto mantem JSON como fallback local simples, mas inclui base profissional para producao robusta:

- `migrations/001_init.sql`: schema PostgreSQL com indices.
- `npm run db:migrate`: aplica migrations usando `DATABASE_URL`.
- `.env.staging.example`: ambiente de homologacao.
- `.env.production.example`: ambiente de producao.
- `npm run backup`: gera backup local do arquivo JSON.

## Documentos Do Projeto

- [PRD do produto](docs/PRD.md)
- [Relatorio tecnico](docs/RELATORIO_TECNICO.md)
- [Guia de deploy](docs/DEPLOY.md)
- [Operacao do cliente](docs/OPERACAO_CLIENTE.md)
- [Roteiro de apresentacao](docs/ROTEIRO_APRESENTACAO.md)
- [Proposta comercial](docs/PROPOSTA_COMERCIAL.md)
- [Checklist de implantacao](docs/CHECKLIST_IMPLANTACAO.md)
- [Termos minimos](docs/TERMOS_MINIMOS.md)
- [Politica de privacidade/LGPD](docs/POLITICA_PRIVACIDADE_LGPD.md)
- [Evolucao para producao robusta](docs/EVOLUCAO_PRODUCAO.md)

## Regras De Negocio

- Toda demanda precisa ter tipo, titulo, solicitante, contato e descricao.
- Tipos validos: `entrega`, `coleta`, `tarefa`.
- Categorias validas: `entrega`, `coleta`, `rota`, `estoque`, `manutencao`, `administrativo`.
- Prioridades validas: `baixa`, `media`, `alta`, `critica`.
- O sistema sugere categoria e prioridade por palavras-chave.
- Demandas nascem com status `novo`.
- Status validos: `novo`, `em_separacao`, `aguardando_coleta`, `em_rota`, `entregue`, `falha_entrega`, `reentrega`, `cancelado`.
- O protocolo segue o formato `OP-AAAA-0001`.
- A consulta publica exige protocolo e contato.
- Status finais `entregue` e `cancelado` nao aceitam nova transicao.
- Demandas fora do prazo ficam marcadas como vencidas no painel.
- Para marcar como `entregue`, o operador precisa informar observacao final e comprovante.

## Status

Projeto novo, isolado na pasta `controle-entregas-tarefas`, sem alterar os projetos existentes do workspace.
