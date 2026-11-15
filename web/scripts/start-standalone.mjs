/**
 * Runs the production build the same way the Docker image does:
 * copies public/ and .next/static next to the standalone server, then starts it.
 * Usage: npm run build && npm start   (PORT, WEB_HOST and API_* env vars apply)
 *
 * The standalone server binds to $HOSTNAME, which Docker (and so the
 * devcontainer) sets to the container id; bind explicitly instead.
 */
import { cpSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, ".next/standalone");
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("No standalone build found. Run `npm run build` first.");
  process.exit(1);
}
cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
cpSync(path.join(root, ".next/static"), path.join(standalone, ".next/static"), { recursive: true });
process.env.HOSTNAME = process.env.WEB_HOST ?? "0.0.0.0";
process.chdir(standalone);
await import(path.join(standalone, "server.js"));
