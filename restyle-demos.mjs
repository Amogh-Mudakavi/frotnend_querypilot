#!/usr/bin/env node
/**
 * Restyles the landing-page feature demos to the QueryPilot platform look
 * (neutral black/grey, indigo for "active", green only for success).
 *
 * It changes COLOURS, chip/input shapes and the smallest font sizes only.
 * No state, handlers, data or markup structure is touched.
 *
 * Usage (from the project root):
 *   node restyle-demos.mjs src/components/demos --dry   # preview
 *   node restyle-demos.mjs src/components/demos         # apply
 *
 * Run it on the WHOLE demos folder (including primitives/) so demoKit's palette,
 * DemoWindow, StatusPill, DemoButton, etc. are remapped too. Commit first so
 * you can diff / revert. A marker comment is added to each changed file so a
 * second run skips it.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SENTINEL = '// restyled: platform-v1';

/* Old hex (upper-case) -> new hex. None of the new values is also a key, so this is safe. */
const HEX = {
  // surfaces
  '#08080A': '#0B0B0C', // canvas / sunken panels  (= auth card black)
  '#111215': '#202020', // raised rows, answer card (= sidebar)
  '#1E2026': '#262626', // hairlines
  '#22242A': '#2E2E30', // borders
  '#353945': '#4A4A4D', // hover borders
  '#4B5263': '#6A6A70', // focus / active ring
  '#3F4350': '#505054', // idle dots
  '#1A1D24': '#2A2A2D', // active chip bg
  '#16181F': '#232326', // active list row bg
  '#252933': '#303034', // active tag bg (= app raised control)
  '#3D4251': '#4A4A4D',
  // text
  '#CBD0DC': '#D9D9DB',
  '#8B93A5': '#A8ADB4',
  '#717888': '#858A92',
  '#555B6D': '#6F7278', // placeholders
  '#E2E5EB': '#E6E6E6',
  '#E6E9EF': '#E6E6E6',
  '#0A0B0E': '#0B0B0C',
  // success: softer green, and no green fills/borders (ticks and verdicts keep the colour)
  '#4FA36A': '#8FBF98',
  '#18251C': '#202020',
  '#2C4D35': '#3A3A3D',
  // "active / running": orange -> platform indigo family
  '#E39135': '#8E98F0',
  '#D9822B': '#6571E0',
  '#1E140C': '#1A1C30',
  '#3D2514': '#323869',
};

/* Exact-string swaps. [from, to] */
const LITERAL = [
  // Planner graph + routing: grey lines and chips, not green
  ['stroke={settled ? C.green : C.orangeDot}', 'stroke={settled ? C.muted : C.orangeDot}'],
  ["['done', C.green],", "['done', C.muted],"],
  ['style={{ color: picked ? C.green : C.faint }}', 'style={{ color: picked ? C.text : C.faint }}'],
  ['color: picked ? C.green : C.faint,', 'color: picked ? C.textHi : C.faint,'],
  // Structured data: result values in white
  ['style={{ color: executed ? C.green : C.dotOff }}', 'style={{ color: executed ? C.textHi : C.dotOff }}'],
  // Pill-shaped sample chips and prompt inputs (match the app's auth + chat controls)
  ['shrink-0 rounded-[6px] border px-2.5 py-1', 'shrink-0 rounded-full border px-3 py-1'],
  ['flex-1 rounded-[8px] border px-3.5 py-2.5', 'flex-1 rounded-full border px-4 py-2.5'],
];

/* Order matters: 11 -> 12 first, then 10 -> 11. */
const SIZES = [
  ['text-[11px]', 'text-[12px]'],
  ['text-[10px]', 'text-[11px]'],
];

const dir = process.argv[2];
const dry = process.argv.includes('--dry');

if (!dir) {
  console.error('Usage: node restyle-demos.mjs <demos-folder> [--dry]');
  process.exit(1);
}

async function* walk(d) {
  for (const e of await fs.readdir(d, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) yield p;
  }
}

const countOf = (s, needle) => s.split(needle).length - 1;
let touched = 0;

for await (const file of walk(dir)) {
  const src = await fs.readFile(file, 'utf8');

  if (src.includes(SENTINEL)) {
    console.log(`skip     ${file} (already restyled)`);
    continue;
  }

  let out = src;
  let hex = 0;
  let lit = 0;
  let size = 0;

  out = out.replace(/#[0-9a-fA-F]{6}\b/g, (m) => {
    const to = HEX[m.toUpperCase()];
    if (!to) return m;
    hex += 1;
    return to;
  });

  for (const [from, to] of LITERAL) {
    lit += countOf(out, from);
    out = out.split(from).join(to);
  }

  for (const [from, to] of SIZES) {
    size += countOf(out, from);
    out = out.split(from).join(to);
  }

  if (out === src) {
    console.log(`nochange ${file}`);
    continue;
  }

  const directive = /^(\s*['"]use client['"];?[ \t]*\r?\n)/;
  out = directive.test(out) ? out.replace(directive, `$1${SENTINEL}\n`) : `${SENTINEL}\n${out}`;

  touched += 1;
  console.log(`${dry ? 'would   ' : 'updated '} ${file}  colours:${hex}  shapes:${lit}  sizes:${size}`);
  if (!dry) await fs.writeFile(file, out);
}

console.log(`\n${dry ? 'Dry run: ' : ''}${touched} file(s) ${dry ? 'would change' : 'changed'}.`);