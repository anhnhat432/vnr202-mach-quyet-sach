import fs from "node:fs";
import path from "node:path";
import { validateContentCatalog } from "./lib/content-validation.mjs";

const root = path.resolve(import.meta.dirname, "..");
const contentDir = path.join(root, "docs/sdd/content");
const dossierDir = path.join(contentDir, "dossiers");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const sourceRegistry = readJson(path.join(contentDir, "sources.json"));
const publicationManifest = readJson(path.join(contentDir, "publication-manifest.json"));
const causalRegistry = readJson(path.join(contentDir, "causal-links.json"));
const dossiers = fs
  .readdirSync(dossierDir)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => readJson(path.join(dossierDir, file)));

const sourcesById = new Map(sourceRegistry.sources.map((source) => [source.id, source]));
const hydratedDossiers = dossiers.map((dossier) => {
  if (!dossier.experience) return dossier;
  return {
    ...dossier,
    experience: {
      ...dossier.experience,
      sources: dossier.sourceRefs.map((ref) => ({
        ...sourcesById.get(ref.sourceId),
        locator: ref.locator,
      })),
    },
  };
});

const catalog = validateContentCatalog({
  schemaVersion: 2,
  sources: sourceRegistry.sources,
  dossiers: hydratedDossiers,
  causalLinks: causalRegistry.links,
  publicationManifest,
});

const output = path.join(root, "web/src/generated/content-catalog.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
