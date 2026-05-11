const crypto = require("crypto");
const readline = require("readline/promises");

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

async function main() {
  const input = process.argv[2];
  if (input) {
    console.log(hashPassword(input));
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question("Senha para gerar hash: ");
  rl.close();

  if (!password || password.length < 8) {
    console.error("A senha deve ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  console.log(hashPassword(password));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
