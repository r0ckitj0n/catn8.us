import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const target = path.join(repoRoot, 'src', 'entries', 'app.tsx');

if (!fs.existsSync(target)) {
  console.error('ERROR: app.tsx not found at:', target);
  process.exit(1);
}

const original = fs.readFileSync(target, 'utf8');
let next = original;

// 1) Remove misplaced Seed Story Editor modal block that was inserted near AIImageConfig modal.
const seedModalStart = '<div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={seedStoryModalRef}>';
const aiImageJsonMarker = '\n\n    <AIImageConfigJsonModal';

const startIdx = next.indexOf(seedModalStart);
if (startIdx !== -1) {
  const markerIdx = next.indexOf(aiImageJsonMarker, startIdx);
  if (markerIdx === -1) {
    console.error('ERROR: Found Seed Story modal start, but could not find AIImageConfigJsonModal marker after it. Aborting to avoid corrupting file.');
    process.exit(1);
  }

  // Remove from startIdx up to markerIdx (leave the marker itself intact).
  next = next.slice(0, startIdx) + next.slice(markerIdx + 2); // +2 drops the leading "\n\n" so spacing remains clean
  console.log('OK: Removed misplaced Seed Story Editor modal block (near AIImageConfigJsonModal).');
} else {
  console.log('SKIP: Misplaced Seed Story Editor modal block not found (seedStoryModalRef modal start marker missing).');
}

// Normalize indentation that may be left behind if the modal was manually removed.
next = next.replace(/\n\s{10}<AIImageConfigJsonModal/g, '\n    <AIImageConfigJsonModal');

// 2) Fix Wordsearch openJsonPreview calls (openJsonPreview is scoped to MysteryPage).
// Only apply inside Wordsearch component boundaries.
const wsStartNeedle = next.includes('function WordsearchPage')
  ? 'function WordsearchPage'
  : (next.includes('function WordSearchPage') ? 'function WordSearchPage' : '');
const wsStart = wsStartNeedle ? next.indexOf(wsStartNeedle) : -1;
if (wsStart === -1) {
  console.log('SKIP: WordsearchPage/WordSearchPage function not found; no Wordsearch openJsonPreview patch applied.');
} else {
  // Try to find next function declaration after WordsearchPage to limit scope.
  const afterWs = next.indexOf('\nfunction ', wsStart + wsStartNeedle.length);
  const wsEnd = afterWs === -1 ? next.length : afterWs;
  const wsChunk = next.slice(wsStart, wsEnd);

  const replacedChunk = wsChunk.replace(/\bopenJsonPreview\s*\(\s*\{/g, "console.error('Wordsearch JSON Preview', {");

  if (replacedChunk !== wsChunk) {
    next = next.slice(0, wsStart) + replacedChunk + next.slice(wsEnd);
    console.log('OK: Replaced openJsonPreview(...) calls inside WordSearchPage with console.error(...).');
  } else {
    console.log('SKIP: No openJsonPreview(...) calls found inside WordSearchPage.');
  }
}

if (next === original) {
  console.log('No changes needed; exiting without writing.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = target + '.' + stamp + '.bak';
fs.writeFileSync(backup, original, 'utf8');
fs.writeFileSync(target, next, 'utf8');

console.log('WROTE:', target);
console.log('BACKUP:', backup);
console.log('DONE');
