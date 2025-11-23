import { access, cp, mkdir } from "fs/promises";
import { constants } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");
const source = path.join(projectRoot, "attached_assets");
const destination = path.join(projectRoot, "dist", "public", "assets");

async function main() {
  try {
    await access(source, constants.F_OK);
  } catch {
    return;
  }

  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true });
}

main().catch((error) => {
  console.error("Failed to copy static assets", error);
  process.exitCode = 1;
});
