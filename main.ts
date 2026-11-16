// main.ts — the entrypoint: packs game/ and screenshots/ into /output and
// writes /output/dossier.json with the kit's buildDossier. Node 22+ stdlib
// only, no network, deterministic output (same bytes on every run).

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Caps straight from the bounty rules: text 160 KiB, at most 4 screenshots
// of 256 KiB each, game/ at most 993 entries and 48 MiB, paths at most
// 1000 bytes. Same caps the scorer rebuilds the dossier with.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function pack() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const name of ['game', 'screenshots']) {
    const src = join(here, name);
    if (!existsSync(src)) continue;
    cpSync(src, join(outDir, name), { recursive: true });
  }
  const dossier = buildDossier(outDir, dossierCaps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  const shotCount = existsSync(join(outDir, 'screenshots'))
    ? readdirSync(join(outDir, 'screenshots')).length
    : 0;
  console.log(`packed ${outDir}: dossier.json ${dossier.length} bytes, ${shotCount} screenshots`);
}

pack();
