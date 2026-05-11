# Guia de Deploy

## Vercel Preview

O projeto inclui `vercel.json` e `api/index.js` para abrir um preview online rapido na Vercel.

Variaveis obrigatorias:

- `NODE_ENV=production`
- `SESSION_SECRET`
- `ADMIN_USER`
- `ADMIN_PASSWORD_HASH`

No ambiente serverless da Vercel, quando `DATA_FILE` nao for definido, o app usa `/tmp/controle-entregas-tarefas.json`. Esse modo e adequado para demonstracao de portfolio, mas a persistencia e temporaria.

Para uso real com dados persistentes, prefira Render com disco persistente ou PostgreSQL.

## Render

1. Criar novo Web Service.
2. Apontar para este repositorio.
3. Usar `render.yaml` ou configurar manualmente.
4. Criar disco persistente em `/var/data`.
5. Definir `DATA_FILE=/var/data/production.json`.
6. Definir `UPLOAD_DIR=/var/data/uploads-production`.
7. Definir `SESSION_SECRET` com valor seguro.
8. Gerar hash da senha e configurar `ADMIN_PASSWORD_HASH`.

## Dominio, HTTPS e Ambientes

Para uma entrega profissional, use ambientes separados:

- Homologacao: `https://homologacao.seudominio.com`
- Producao: `https://app.seudominio.com`

No Render ou provedor equivalente:

1. Configure dominio customizado.
2. Aponte DNS conforme instrucoes do provedor.
3. Ative HTTPS/TLS automatico.
4. Mantenha variaveis e banco separados por ambiente.
5. Use `DATA_FILE` diferente para homologacao e producao.
6. Nunca use a senha local `admin123` em producao.

## Gerar Hash da Senha

Use:

```bash
npm run hash:password -- "sua-senha-forte"
```

O formato preferencial e `scrypt$salt$hash`. Hashes antigos em SHA-256 continuam aceitos apenas para compatibilidade e migracao.

## PostgreSQL

Quando `DATABASE_URL` estiver configurado, rode:

```bash
npm run db:migrate
```

O arquivo `migrations/001_init.sql` cria tabelas, historico confiavel e indices de busca. A aplicacao ainda mantem JSON como fallback local para demo e homologacao simples.

## Backup Automatico

Para JSON local, agende:

```bash
npm run backup
```

Em producao PostgreSQL, use backup gerenciado do provedor e retencao diaria.

## Variaveis

- `PORT`: porta do servidor.
- `NODE_ENV`: use `production` em producao.
- `DATA_FILE`: caminho do arquivo de dados JSON.
- `UPLOAD_DIR`: pasta segura para comprovantes.
- `SESSION_SECRET`: chave de assinatura da sessao.
- `SESSION_MAX_AGE_MS`: tempo de vida da sessao em milissegundos.
- `ADMIN_USER`: usuario administrador inicial.
- `ADMIN_PASSWORD_HASH`: hash da senha gerado pelo script.
- `NOTIFICATION_WEBHOOK_URL`: webhook opcional.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: envio de e-mail.
- `NOTIFICATION_EMAIL_TO`: destinatario dos alertas.
- `DATABASE_URL`: conexao PostgreSQL para migrations.

## Validacao Pos-Deploy

- Abrir `/api/health`.
- Confirmar `security.sessionSecretConfigured=true`.
- Confirmar que o workflow `CI` passou no GitHub Actions.
- Registrar uma demanda teste.
- Entrar no painel.
- Mover status.
- Validar dominio customizado.
- Validar HTTPS ativo.
- Exportar CSV.
- Baixar backup.
- Validar upload de comprovante.
