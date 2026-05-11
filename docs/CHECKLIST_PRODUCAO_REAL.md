# Checklist de Producao Real

Use este checklist para validar o sistema publicado com dominio, HTTPS e PostgreSQL ativo.

## Infraestrutura

- Repositorio conectado ao provedor de deploy.
- CI verde no GitHub Actions.
- Web Service criado pelo `render.yaml`.
- PostgreSQL criado pelo `render.yaml`.
- `DATABASE_URL` configurado no ambiente de producao.
- `UPLOAD_DIR=/var/data/uploads-production`.
- Disco persistente montado em `/var/data`.
- `NODE_ENV=production`.
- `SESSION_SECRET` gerado pelo provedor ou definido com valor forte.
- `ADMIN_PASSWORD_HASH` gerado com `npm run hash:password`.

## Dominio e HTTPS

- Dominio customizado apontado para o provedor.
- HTTPS/TLS ativo.
- URL final abre sem alerta do navegador.
- `/api/health` responde pela URL final.
- `security.production=true`.
- `security.sessionSecretConfigured=true`.
- `storage=postgres`.
- `persistence=postgres`.

## Validacao Funcional

- Registrar demanda publica.
- Consultar protocolo com contato correto.
- Login administrativo com senha de producao.
- Criar, editar e filtrar demanda no painel.
- Mover status respeitando transicoes.
- Tentar transicao invalida e confirmar bloqueio.
- Adicionar nota publica e nota interna.
- Confirmar que nota interna nao aparece na consulta publica.
- Enviar comprovante por upload.
- Exportar CSV.
- Abrir relatorio imprimivel.
- Rodar alerta de vencidos.

## Persistencia

- Criar demanda teste.
- Reiniciar o Web Service.
- Confirmar que a demanda continua salva.
- Confirmar que usuario administrativo continua salvo.
- Confirmar que anexo enviado continua acessivel no painel.

## Seguranca

- Senha local `admin123` nao funciona em producao.
- Cookie administrativo aparece como `HttpOnly`.
- Cookie aparece como `Secure` em HTTPS.
- Rotas administrativas retornam 401 sem login.
- Usuarios bloqueados nao conseguem acessar.
- Consulta publica nao retorna contato, notas internas ou auditoria.

## Veredito

O deploy pode ser considerado pronto para apresentacao profissional quando todos os itens acima estiverem validados no dominio final.

