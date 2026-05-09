# Sistema de Controle de Entregas e Tarefas Operacionais

Sistema web para registrar, priorizar, acompanhar e auditar entregas, coletas, rotas e tarefas internas, com painel operacional, consulta pública, regras de SLA, permissões, relatórios, exportação e base preparada para produção.

## Visão Geral

O Sistema de Controle de Entregas e Tarefas Operacionais resolve um problema comum em operações logísticas e equipes internas: demandas chegam por canais soltos, prazos se perdem, responsáveis não ficam claros, o cliente não consegue consultar andamento e a gestão não tem indicadores confiáveis para agir.

O solicitante registra uma entrega, coleta ou tarefa operacional, recebe um protocolo no formato `OP-AAAA-0001` e pode consultar o andamento com protocolo e contato. A equipe administrativa acompanha tudo no painel, filtra demandas, altera status, registra notas, adiciona anexos, controla SLA, exporta dados e consulta auditoria.

O documento central de produto fica em `docs/PRD.md`. Ele descreve problema, público-alvo, requisitos, regras de negócio, critérios de aceite, riscos e roadmap.

## Preview

| Tela pública | Tablet | Mobile |
| --- | --- | --- |
| ![Tela pública](public/screens/home-desktop.png) | ![Tablet](public/screens/home-tablet.png) | ![Mobile](public/screens/home-mobile.png) |

| Painel operacional | Documentação visual |
| --- | --- |
| ![Painel operacional](public/screens/admin-desktop.png) | ![Documentação visual](public/screens/docs-desktop.png) |

As imagens acima mostram a experiência pública de registro/consulta, a adaptação mobile e o painel administrativo usado pela operação.

Para gerar os screenshots novamente:

```bash
npm run screenshots
```

## Por Que Este Projeto Se Destaca

- Produto completo: tela pública, painel operacional, página comercial, documentação visual, API REST, relatórios e rotas administrativas.
- Regra de negócio real: protocolo único, SLA por prioridade/categoria, status permitidos e bloqueio de transições inválidas.
- Operação acompanhável: dashboard com indicadores, kanban, filtros, busca livre, histórico, notas e auditoria.
- Segurança aplicada: sessão assinada, cookie `HttpOnly`, comparação segura de senha, permissões por perfil e rotas protegidas.
- Persistência flexível: JSON local para demo/homologação simples e estrutura PostgreSQL com migrations para produção robusta.
- Qualidade verificável: testes automatizados, validação de sintaxe, geração de screenshots, backup e documentação de deploy.
- Experiência profissional: layout responsivo, menu mobile, tema configurável por cliente, exportação CSV e relatório imprimível.
- Integrações preparadas: webhook e e-mail SMTP opcionais para alertas de demanda crítica, status e vencimentos.

## Funcionalidades

### Solicitante

- Registro público de entrega, coleta ou tarefa.
- Sugestão automática de categoria e prioridade por palavras-chave.
- Geração de protocolo no formato `OP-AAAA-0001`.
- Consulta pública segura por protocolo e contato.
- Visualização de status, responsável, prazo, origem, destino e última nota pública.
- Página comercial para apresentação do serviço.
- Interface responsiva para desktop, tablet e celular.

### Operação

- Login administrativo protegido por sessão.
- Dashboard com indicadores por status, prioridade, categoria e atrasos.
- Kanban operacional com demandas abertas.
- Filtros por status, prioridade, categoria, tipo, responsável e busca livre.
- Alteração de status respeitando transições permitidas.
- Registro de notas públicas e internas.
- Detalhe completo da demanda com histórico, anexos e comprovantes.
- Upload de arquivos PNG, JPG, WEBP ou PDF.
- Exportação CSV, backup JSON e relatório imprimível.
- Tema visual configurável por cliente.
- Seed demo para apresentações comerciais.

### Administração

- Perfis de acesso: `admin`, `supervisor`, `operador` e `leitura`.
- Criação, bloqueio/desbloqueio e edição de usuários administrativos.
- Troca de senha.
- Auditoria por ator e ação.
- Monitoramento de demandas vencidas.
- Notificações opcionais por webhook e e-mail SMTP.

## Decisões Técnicas

- HTML, CSS e JavaScript sem framework: escolha intencional para demonstrar domínio da base web e manipulação direta do DOM.
- Node.js + Express: API REST simples, clara e adequada ao escopo operacional.
- Persistência em JSON: fallback local rápido para demo, testes e homologação simples.
- PostgreSQL: caminho recomendado para produção robusta, com schema versionado em `migrations/001_init.sql`.
- Multer: upload real de comprovantes e anexos.
- Nodemailer e webhook: notificações externas opcionais.
- Playwright: geração de screenshots e validação visual.
- Render: configuração preservada em `render.yaml` para deploy com disco persistente.

## Stack

| Área | Tecnologias |
| --- | --- |
| Front-end | HTML, CSS, JavaScript |
| Back-end | Node.js, Express |
| Banco de dados | JSON local, PostgreSQL preparado |
| Uploads | Multer |
| Notificações | Webhook, SMTP/Nodemailer |
| Testes e qualidade | Node Test Runner, `node --check`, Playwright |
| Deploy | Render, disco persistente, variáveis de ambiente |

## Como Rodar Localmente

```bash
npm install
npm start
```

Depois acesse:

```text
http://localhost:3000
```

Painel administrativo:

```text
http://localhost:3000
```

Credenciais locais de demonstração:

```text
usuario: admin
senha: admin123
```

Em produção, a senha local não deve ser usada. Configure `ADMIN_PASSWORD_HASH` com uma senha segura.

## Variáveis de Ambiente

Crie um `.env` local com base em `.env.example`.

Variáveis principais:

```text
PORT=3000
DATA_FILE=data/database.json
SESSION_SECRET=seu-segredo-de-sessao
ADMIN_USER=admin
ADMIN_PASSWORD_HASH=hash-sha256-da-senha
UPLOAD_DIR=uploads
DATABASE_URL=postgresql://...
NOTIFICATION_WEBHOOK_URL=https://exemplo.com/webhook
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_USER=usuario
SMTP_PASS=senha
NOTIFICATION_EMAIL_TO=operacao@empresa.com
```

Para gerar o hash da senha:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('sua-senha').digest('hex'))"
```

## Qualidade e Testes

O projeto inclui uma rotina de validação para reduzir regressões em API, regras de negócio, autenticação, permissões, relatórios e layout.

```bash
npm test
npm run check
npm run screenshots
npm run backup
```

Os testes cobrem:

- Classificação automática de categoria e prioridade.
- Validação de campos obrigatórios.
- Abertura pública e documentação visual.
- Criação de demanda e geração de protocolo.
- Consulta pública por protocolo e contato.
- Login administrativo e proteção de rotas.
- Alteração de status e bloqueio de transição inválida.
- Notas, relatórios, exportação, backup e auditoria.

## Segurança

- Painel protegido por sessão administrativa assinada.
- Cookie administrativo `HttpOnly` e `SameSite=Lax`.
- Senha comparada por hash SHA-256.
- Comparação de assinatura com `timingSafeEqual`.
- Permissões por perfil para leitura, escrita, configuração, usuários, exportação e seed demo.
- Consulta pública exige protocolo e contato.
- Notas internas não aparecem na consulta pública.
- Upload limitado a PNG, JPG, JPEG, WEBP ou PDF.
- Arquivos enviados ficam protegidos por rota que exige permissão de leitura.
- Variáveis sensíveis ficam fora do Git.

## Regras de Negócio

- Toda demanda precisa ter tipo, título, solicitante, contato e descrição.
- Tipos válidos: `entrega`, `coleta`, `tarefa`.
- Categorias válidas: `entrega`, `coleta`, `rota`, `estoque`, `manutencao`, `administrativo`.
- Prioridades válidas: `baixa`, `media`, `alta`, `critica`.
- O sistema sugere categoria e prioridade por palavras-chave.
- Demandas nascem com status `novo`.
- Status válidos: `novo`, `em_separacao`, `aguardando_coleta`, `em_rota`, `entregue`, `falha_entrega`, `reentrega`, `cancelado`.
- Status finais `entregue` e `cancelado` não aceitam nova transição.
- Demandas fora do prazo ficam marcadas como vencidas.
- Para marcar como `entregue`, o operador precisa informar observação final e comprovante.
- A consulta pública retorna apenas dados seguros da demanda.

## Persistência

O app funciona em dois modos:

- JSON local: recomendado para desenvolvimento, demonstração e homologação simples.
- PostgreSQL: recomendado para produção robusta.

Para aplicar migrations PostgreSQL:

```bash
npm run db:migrate
```

Para gerar backup local do JSON:

```bash
npm run backup
```

## Rotas Principais

### Públicas

```text
GET  /
GET  /docs.html
GET  /comercial.html
GET  /api/health
POST /api/demands
GET  /api/public/demands/:protocol?contact=...
POST /api/suggest
```

### Administrativas

```text
POST   /api/session
DELETE /api/session
GET    /api/settings
PUT    /api/settings
GET    /api/admins
POST   /api/admins
PATCH  /api/admins/:id
POST   /api/me/password
GET    /api/demands
GET    /api/demands/:id
PATCH  /api/demands/:id
PATCH  /api/demands/:id/status
POST   /api/demands/:id/notes
POST   /api/demands/:id/attachments
POST   /api/demands/:id/files
GET    /api/dashboard
GET    /api/reports
GET    /api/report.pdf
GET    /api/audit
GET    /api/export.csv
GET    /api/backup
POST   /api/demo/seed
POST   /api/notifications/check-overdue
```

## Estrutura

```text
.
├── server.js                 # API, segurança, regras, persistência e rotas
├── package.json              # Scripts e dependências
├── render.yaml               # Deploy Render
├── public/
│   ├── index.html            # Experiência pública e painel
│   ├── app.js                # Interações da aplicação
│   ├── styles.css            # Layout responsivo
│   └── screens/              # Screenshots do README
├── data/                     # Base JSON local
├── migrations/               # Schema PostgreSQL
├── scripts/                  # Backup, migrations e screenshots
├── tests/                    # Testes automatizados
└── docs/                     # Documentação de produto, deploy e operação
```

## Documentos do Projeto

- [PRD do produto](docs/PRD.md)
- [Relatório técnico](docs/RELATORIO_TECNICO.md)
- [Guia de deploy](docs/DEPLOY.md)
- [Operação do cliente](docs/OPERACAO_CLIENTE.md)
- [Roteiro de apresentação](docs/ROTEIRO_APRESENTACAO.md)
- [Proposta comercial](docs/PROPOSTA_COMERCIAL.md)
- [Checklist de implantação](docs/CHECKLIST_IMPLANTACAO.md)
- [Termos mínimos](docs/TERMOS_MINIMOS.md)
- [Política de privacidade/LGPD](docs/POLITICA_PRIVACIDADE_LGPD.md)
- [Evolução para produção robusta](docs/EVOLUCAO_PRODUCAO.md)

## Aprendizados Demonstrados

- Modelagem de fluxo completo para operação logística.
- Construção de API REST com validações de domínio.
- Controle de status, SLA, permissões e auditoria.
- Proteção de painel administrativo e consulta pública segura.
- Persistência local com caminho de evolução para PostgreSQL.
- Geração de relatórios, exportação e backup.
- Testes automatizados e documentação voltada para portfólio.

## Status

Projeto autoral pronto para deploy, com README, screenshots, documentação técnica, testes, regras de negócio, segurança básica, rotas REST e configuração de produção preservada para Render.
