# Security Policy

This portfolio project uses environment variables for secrets and must not store real credentials, uploads, production data, or client data in Git.

## Supported Scope

- Public demand registration and lookup
- Administrative authentication and permissions
- Upload handling
- API routes in `server.js`
- Deployment configuration in `render.yaml`

## Operational Rules

- Keep `.env`, production data, uploads, backups and coverage out of Git.
- Use strong values for `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, SMTP and webhook credentials.
- Generate password hashes with `npm run hash:password -- "sua-senha-forte"`.
- Keep `NODE_ENV=production` enabled in production so secure cookie flags are applied.
- Validate upload limits and file types before production use.
- Run `npm audit` before production changes.

## Reporting

Open a private GitHub issue or contact the maintainer through the GitHub profile.
