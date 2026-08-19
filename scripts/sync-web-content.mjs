import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const input = path.join(root, "docs", "sdd", "content", "phase-1-seed.json");
const output = path.join(root, "web", "src", "generated", "phase-1-seed.json");

fs.mkdirSync(path.dirname(output), { recursive: true });
const content = fs.readFileSync(input, "utf8");
JSON.parse(content);
fs.writeFileSync(output, content, "utf8");
