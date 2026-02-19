export function normalizeWord(value: string) {
  return String(value || '').toUpperCase().replace(/[^A-Z]/g, '');
}

export function createRng(seed0: number) {
  let t = (seed0 >>> 0);
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWordsForPage({ allWords, count, gridSize, seed }: { allWords: string[]; count: number; gridSize: number; seed: number }) {
  const rng = createRng(seed);
  const pool = (Array.isArray(allWords) ? allWords : [])
    .map((w) => normalizeWord(w))
    .filter((w) => w.length >= 3 && w.length <= gridSize);

  const unique = [...new Set(pool)];
  for (let i = unique.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  return unique.slice(0, Math.max(1, count));
}

export function buildWordSearch({ size, words, seed, difficulty }: { size: number; words: string[]; seed: number; difficulty: string }) {
  const rng = createRng(seed);
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ''));

  const easyDirs = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
  ];
  const mediumDirs = [
    ...easyDirs,
    { dr: 1, dc: 1 },
    { dr: -1, dc: 1 },
  ];
  const hardDirs = [
    ...mediumDirs,
    { dr: 0, dc: -1 },
    { dr: -1, dc: 0 },
    { dr: 1, dc: -1 },
    { dr: -1, dc: -1 },
  ];

  const directions = (difficulty === 'hard') ? hardDirs : (difficulty === 'medium' ? mediumDirs : easyDirs);
  const randInt = (n: number) => Math.floor(rng() * n);

  const canPlace = (word: string, r0: number, c0: number, dir: { dr: number; dc: number }) => {
    const { dr, dc } = dir;
    const r1 = r0 + dr * (word.length - 1);
    const c1 = c0 + dc * (word.length - 1);
    if (r1 < 0 || r1 >= size || c1 < 0 || c1 >= size) return false;
    for (let i = 0; i < word.length; i += 1) {
      const r = r0 + dr * i;
      const c = c0 + dc * i;
      const existing = grid[r][c];
      if (existing && existing !== word[i]) return false;
    }
    return true;
  };

  const place = (word: string, r0: number, c0: number, dir: { dr: number; dc: number }) => {
    const { dr, dc } = dir;
    for (let i = 0; i < word.length; i += 1) {
      grid[r0 + dr * i][c0 + dc * i] = word[i];
    }
  };

  const normalized = words
    .map((w) => normalizeWord(w))
    .filter((w) => w.length >= 3 && w.length <= size)
    .sort((a, b) => b.length - a.length);

  for (const word of normalized) {
    let placedWord = false;
    for (let attempt = 0; attempt < 900; attempt += 1) {
      const dir = directions[randInt(directions.length)];
      const r0 = randInt(size);
      const c0 = randInt(size);
      if (!canPlace(word, r0, c0, dir)) continue;
      place(word, r0, c0, dir);
      placedWord = true;
      break;
    }
    if (!placedWord) {
      throw new Error('Could not place word: ' + word);
    }
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!grid[r][c]) grid[r][c] = alphabet[randInt(alphabet.length)];
    }
  }

  return { grid, words: normalized };
}

export function generateWordsearchQuickFacts({ topic, puzzleTitle, pageNumber, words, settings }: { topic: any; puzzleTitle: string; pageNumber: number; words: string[]; settings: any }) {
  const enabled = Number(settings?.quick_facts_enabled || 0) === 1;
  if (!enabled) return { description: '', summary: '' };

  const style = String(settings?.quick_facts_style || 'gentle').trim().toLowerCase();
  const sentences = Math.min(6, Math.max(1, Number(settings?.quick_facts_sentences || 2)));

  const topicTitle = String(topic?.title || '').trim();
  const title = String(puzzleTitle || '').trim();
  const wordsList = (Array.isArray(words) ? words : []).map((w) => String(w)).filter(Boolean);
  const topWords = wordsList.slice(0, 6).join(', ');

  const styleLead = (style === 'fun')
    ? 'Have fun hunting'
    : (style === 'educational')
      ? 'Explore'
      : 'Enjoy searching for';

  const description = topicTitle
    ? `${styleLead} ${topicTitle} words.`
    : `${styleLead} words from “${title || 'this puzzle'}”.`;

  const parts = [];
  if (topicTitle) {
    parts.push(`Page ${pageNumber} highlights ${topicTitle}.`);
  } else {
    parts.push(`Page ${pageNumber} highlights this theme.`);
  }

  if (topWords) {
    parts.push(`Look for words like ${topWords}.`);
  }

  if (style === 'educational') {
    parts.push('Try reading each word out loud as you find it.');
  } else if (style === 'fun') {
    parts.push('Circle each word and celebrate every find!');
  } else {
    parts.push('Take your time and enjoy the challenge.');
  }

  const summary = parts.slice(0, sentences).join(' ');
  return { description, summary };
}
