const fs = require("fs");
const path = require("path");

const dataFile = path.resolve(process.env.DATA_FILE || path.join(__dirname, "..", "data", "database.json"));
const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, "..", "backups"));

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(backupDir, `backup-${stamp}.json`);

if (!fs.existsSync(dataFile)) {
  throw new Error(`Arquivo de dados nao encontrado: ${dataFile}`);
}

fs.copyFileSync(dataFile, target);
console.log(target);
