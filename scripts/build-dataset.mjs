import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parse } from "yaml";
import { globSync, statSync } from "node:fs";

const root = process.cwd();
const dataRoots = ["data/ccfddl", "data/custom"];
const files = dataRoots
  .flatMap((dataRoot) => {
    const conferenceRoot = `${dataRoot}/conference`;
    return globSync(`${conferenceRoot}/**/*.yml`, {
      cwd: root,
      exclude: [`${conferenceRoot}/types.yml`],
    });
  })
  .sort();
const acceptRateFiles = dataRoots
  .flatMap((dataRoot) =>
    globSync(`${dataRoot}/accept_rates/**/*`, {
      cwd: root,
    }),
  )
  .filter((file) => statSync(join(root, file)).isFile())
  .sort();
const acceptRates = await readAcceptRates();

const venues = [];

for (const file of files) {
  const raw = await readFile(join(root, file), "utf8");
  const parsed = parse(raw);
  const entries = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    venues.push({
      title: string(entry.title),
      description: string(entry.description),
      sub: string(entry.sub),
      rank: {
        ccf: string(entry.rank?.ccf || "N"),
        core: string(entry.rank?.core || "N"),
        thcpl: string(entry.rank?.thcpl || "N"),
      },
      dblp: string(entry.dblp),
      sourceFile: relative(root, join(root, file)),
      acceptanceRate: acceptRates.get(normalizeTitle(entry.title)),
      confs: Array.isArray(entry.confs)
        ? entry.confs
            .map((conf) => ({
              year: Number(conf.year || 0),
              id: string(conf.id),
              link: string(conf.link),
              timezone: string(conf.timezone || "UTC+0"),
              date: string(conf.date),
              place: string(conf.place),
              timeline: Array.isArray(conf.timeline)
                ? conf.timeline.map((item) => ({
                    abstract_deadline: optionalString(item.abstract_deadline),
                    deadline: optionalString(item.deadline),
                    comment: optionalString(item.comment),
                  }))
                : [],
            }))
            .sort((a, b) => b.year - a.year)
        : [],
    });
  }
}

await mkdir(join(root, "public/data"), { recursive: true });
await writeFile(
  join(root, "public/data/conferences.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: "https://github.com/ccfddl/ccf-deadlines",
      venues,
    },
    null,
    2,
  )}\n`,
);

console.log(`Built public/data/conferences.json with ${venues.length} venues from ${files.length} YAML files.`);

async function readAcceptRates() {
  const rates = new Map();

  for (const file of acceptRateFiles) {
    const raw = await readFile(join(root, file), "utf8");
    const parsed = parse(raw);
    const entries = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const latest = Array.isArray(entry.accept_rates)
        ? entry.accept_rates
            .filter((rate) => rate && typeof rate === "object")
            .map((rate) => ({
              year: Number(rate.year || 0),
              submitted: Number(rate.submitted || 0),
              accepted: Number(rate.accepted || 0),
              rate: Number(rate.rate || 0),
              source: optionalString(rate.source),
            }))
            .filter((rate) => rate.year > 0 && Number.isFinite(rate.rate))
            .sort((a, b) => b.year - a.year)[0]
        : undefined;

      if (!latest) continue;
      rates.set(normalizeTitle(entry.title), latest);
    }
  }

  return rates;
}

function string(value) {
  return value == null ? "" : String(value);
}

function optionalString(value) {
  return value == null ? undefined : String(value);
}

function normalizeTitle(value) {
  return string(value).trim().toLowerCase();
}
