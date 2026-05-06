const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Defina DATABASE_URL para rodar migrations PostgreSQL.");
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  for (const file of files) {
    const applied = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [file]);
    if (applied.rowCount) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
    await client.query("COMMIT");
    console.log(`Migration aplicada: ${file}`);
  }
  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
