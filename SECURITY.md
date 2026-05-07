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
- Use strong values for `ADMIN_PASSWORD`, `SESSION_SECRET`, SMTP and webhook credentials.
- Validate upload limits and file types before production use.
- Run `npm audit` before production changes.

## Reporting

Open a private GitHub issue or contact the maintainer through the GitHub profile.
