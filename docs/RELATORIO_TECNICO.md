# Relatorio Tecnico

## Arquitetura

Aplicacao Node.js com Express, front-end estatico em HTML/CSS/JavaScript e persistencia em arquivo JSON. A estrutura foi escolhida para ser simples de implantar, facil de demonstrar e preparada para evoluir para banco relacional.

## Componentes

- `server.js`: API, regras de negocio, autenticacao, persistencia e exportacao.
- `public/index.html`: tela publica e painel operacional.
- `public/app.js`: interacoes, consumo da API e kanban.
- `public/styles.css`: layout responsivo.
- `tests/app.test.js`: testes automatizados.
- `docs/`: documentacao de produto, deploy, operacao e LGPD.

## Responsividade

O CSS usa tres faixas principais:

- ate 768px: celular com menu hamburguer e layout em uma coluna;
- 769px a 1024px: tablet com hero e formularios reorganizados;
- acima de 1024px: desktop com grid amplo e kanban horizontal.

## Seguranca

- Painel protegido por sessao assinada.
- Cookie `HttpOnly`.
- Senha comparada por hash SHA-256.
- Rotas administrativas exigem login.
- Perfis com permissoes: admin, supervisor, operador e leitura.
- Consulta publica exige protocolo e contato.
- Notas internas nao aparecem na consulta publica.

## Implementacoes De Produto

- Dashboard com graficos calculados pela API `/api/dashboard`.
- Mapa/rota textual renderizado no card e no detalhe da demanda.
- Tema visual configurado via `/api/settings`.
- SLA configuravel por prioridade e estrutura para SLA por categoria.
- Relatorio imprimivel em `/api/report.pdf`.
- Pagina comercial em `/comercial.html`.
- Seed demo em `/api/demo/seed`.
- Anexos por link em `/api/demands/:id/attachments`.
- Upload real em `/api/demands/:id/files`.
- Detalhe completo em `/api/demands/:id`.
- Relatorio analitico em `/api/reports`.
- Alerta de vencidos em `/api/notifications/check-overdue`.
- Troca de senha em `/api/me/password`.
- Bloqueio/desbloqueio de usuarios em `/api/admins/:id`.

## Persistencia

O arquivo `data/database.json` guarda configuracoes, demandas e auditoria. Em producao, a variavel `DATA_FILE` deve apontar para disco persistente.

Para evolucao robusta, o projeto inclui `migrations/001_init.sql` e `scripts/migrate-postgres.js`. O schema PostgreSQL possui tabelas separadas para usuarios, demandas, notas, anexos, historico, auditoria e configuracoes, alem de indices para status, categoria, prioridade, responsavel, prazo e busca textual.

## Rotas

As rotas principais estao descritas no README e na tela `/docs.html`.

## Limites Conhecidos

- JSON e adequado para desenvolvimento, demonstracao e homologacao simples; para uso com alto volume, a evolucao recomendada e PostgreSQL.
- Nao ha rastreamento GPS nativo.
- Upload real esta disponivel em disco local; para alto volume, recomenda-se storage externo.
