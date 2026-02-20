import {
  ColoringDifficulty,
  ColoringPageDefinition,
  ColoringRegion,
  ColoringShapeType,
  ColoringThemeDefinition,
  ColoringThemeId,
} from '../types/coloring';

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 700;

const THEMES: ColoringThemeDefinition[] = [
  {
    id: 'animals',
    label: 'Animals',
    emoji: '🐾',
    shapeBias: ['circle', 'rect', 'triangle'],
    palette: [
      { id: 'brown', name: 'Brown', hex: '#9C6644' },
      { id: 'tan', name: 'Tan', hex: '#D9A679' },
      { id: 'gold', name: 'Gold', hex: '#FFB703' },
      { id: 'sky', name: 'Sky', hex: '#8ECAE6' },
      { id: 'grass', name: 'Grass', hex: '#6A994E' },
      { id: 'white', name: 'White', hex: '#FFFFFF' },
    ],
    subjects: ['Puppy Park', 'Kitten Nap', 'Forest Fox', 'Friendly Bear', 'Jungle Tiger', 'Safari Lion', 'Pond Duck', 'Mountain Goat', 'Racing Rabbit', 'Parade of Pets'],
  },
  {
    id: 'nature',
    label: 'Nature',
    emoji: '🌿',
    shapeBias: ['circle', 'hexagon', 'diamond'],
    palette: [
      { id: 'leaf', name: 'Leaf', hex: '#588157' },
      { id: 'meadow', name: 'Meadow', hex: '#8AB17D' },
      { id: 'sun', name: 'Sun', hex: '#FFB703' },
      { id: 'water', name: 'Water', hex: '#219EBC' },
      { id: 'soil', name: 'Soil', hex: '#7F5539' },
      { id: 'cloud', name: 'Cloud', hex: '#F8F9FA' },
    ],
    subjects: ['Spring Garden', 'River Bend', 'Sunny Meadow', 'Blooming Field', 'Waterfall Trail', 'Autumn Leaves', 'Desert Bloom', 'Mountain Sunrise', 'Pine Valley', 'Night Campfire'],
  },
  {
    id: 'space',
    label: 'Space',
    emoji: '🚀',
    shapeBias: ['hexagon', 'diamond', 'triangle'],
    palette: [
      { id: 'navy', name: 'Navy', hex: '#14213D' },
      { id: 'violet', name: 'Violet', hex: '#5A189A' },
      { id: 'star', name: 'Star', hex: '#F4D35E' },
      { id: 'planet', name: 'Planet', hex: '#00A6FB' },
      { id: 'rocket', name: 'Rocket', hex: '#E63946' },
      { id: 'moon', name: 'Moon', hex: '#E5E5E5' },
    ],
    subjects: ['Rocket Launch', 'Moon Walk', 'Planet Parade', 'Cosmic Comet', 'Asteroid Ring', 'Alien Garden', 'Space Station', 'Nebula Drift', 'Galaxy Tour', 'Star Map'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    emoji: '🐠',
    shapeBias: ['circle', 'diamond', 'hexagon'],
    palette: [
      { id: 'deep', name: 'Deep Blue', hex: '#023E8A' },
      { id: 'wave', name: 'Wave', hex: '#00B4D8' },
      { id: 'reef', name: 'Reef', hex: '#FF6B6B' },
      { id: 'sand', name: 'Sand', hex: '#E9C46A' },
      { id: 'kelp', name: 'Kelp', hex: '#2D6A4F' },
      { id: 'foam', name: 'Foam', hex: '#F1FAEE' },
    ],
    subjects: ['Coral Reef', 'Sea Turtle Bay', 'Dolphin Jump', 'Octopus Cave', 'Pirate Lagoon', 'Mermaid Grotto', 'Harbor Boats', 'Whale Song', 'Treasure Tide', 'Undersea Parade'],
  },
  {
    id: 'dinosaurs',
    label: 'Dinosaurs',
    emoji: '🦕',
    shapeBias: ['rect', 'triangle', 'hexagon'],
    palette: [
      { id: 'fern', name: 'Fern', hex: '#52B788' },
      { id: 'lava', name: 'Lava', hex: '#E76F51' },
      { id: 'stone', name: 'Stone', hex: '#6C757D' },
      { id: 'sun', name: 'Sun', hex: '#F4A261' },
      { id: 'mud', name: 'Mud', hex: '#8D5524' },
      { id: 'egg', name: 'Egg', hex: '#FDFCDC' },
    ],
    subjects: ['Tiny Triceratops', 'Tall Brachiosaurus', 'Happy Stegosaurus', 'Raptor Run', 'Pterodactyl Flight', 'Dino Nest', 'Jurassic Jungle', 'Volcano Valley', 'Fossil Dig', 'Dino Parade'],
  },
  {
    id: 'fantasy',
    label: 'Fantasy',
    emoji: '🦄',
    shapeBias: ['diamond', 'circle', 'triangle'],
    palette: [
      { id: 'pink', name: 'Pink', hex: '#FF70A6' },
      { id: 'mint', name: 'Mint', hex: '#70D6FF' },
      { id: 'sunbeam', name: 'Sunbeam', hex: '#FFD670' },
      { id: 'lavender', name: 'Lavender', hex: '#B388EB' },
      { id: 'forest', name: 'Forest', hex: '#40916C' },
      { id: 'silver', name: 'Silver', hex: '#E9ECEF' },
    ],
    subjects: ['Unicorn Meadow', 'Dragon Hill', 'Castle Gate', 'Fairy Garden', 'Wizard Tower', 'Magic Potion', 'Phoenix Flight', 'Crystal Cave', 'Treasure Crown', 'Rainbow Quest'],
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    emoji: '🚗',
    shapeBias: ['rect', 'hexagon', 'triangle'],
    palette: [
      { id: 'red', name: 'Red', hex: '#E63946' },
      { id: 'blue', name: 'Blue', hex: '#457B9D' },
      { id: 'yellow', name: 'Yellow', hex: '#FFB703' },
      { id: 'steel', name: 'Steel', hex: '#6C757D' },
      { id: 'road', name: 'Road', hex: '#495057' },
      { id: 'glass', name: 'Glass', hex: '#CAF0F8' },
    ],
    subjects: ['Race Car', 'Monster Truck', 'City Bus', 'Fire Engine', 'Police Cruiser', 'Rocket Bike', 'Harbor Ferry', 'Jet Plane', 'Bullet Train', 'Construction Crew'],
  },
  {
    id: 'holidays',
    label: 'Holidays',
    emoji: '🎉',
    shapeBias: ['circle', 'diamond', 'rect'],
    palette: [
      { id: 'berry', name: 'Berry', hex: '#D00000' },
      { id: 'pine', name: 'Pine', hex: '#2D6A4F' },
      { id: 'gold', name: 'Gold', hex: '#FFC300' },
      { id: 'snow', name: 'Snow', hex: '#F8F9FA' },
      { id: 'party', name: 'Party', hex: '#7B2CBF' },
      { id: 'candle', name: 'Candle', hex: '#F4A261' },
    ],
    subjects: ['Birthday Party', 'Halloween Night', 'Thanksgiving Feast', 'Winter Holiday', 'New Year Fireworks', 'Valentine Hearts', 'Spring Festival', 'Summer Picnic', 'Patriotic Parade', 'Harvest Carnival'],
  },
  {
    id: 'farm',
    label: 'Farm',
    emoji: '🚜',
    shapeBias: ['rect', 'circle', 'hexagon'],
    palette: [
      { id: 'barn', name: 'Barn Red', hex: '#BC4749' },
      { id: 'hay', name: 'Hay', hex: '#E9C46A' },
      { id: 'field', name: 'Field', hex: '#6A994E' },
      { id: 'sky', name: 'Sky', hex: '#8ECAE6' },
      { id: 'dirt', name: 'Dirt', hex: '#7F5539' },
      { id: 'milk', name: 'Milk', hex: '#F8F9FA' },
    ],
    subjects: ['Big Red Barn', 'Tractor Time', 'Chicken Coop', 'Cow Pasture', 'Pig Pen', 'Horse Stable', 'Corn Field', 'Apple Orchard', 'Farm Stand', 'Sunrise Harvest'],
  },
  {
    id: 'weather',
    label: 'Weather',
    emoji: '⛅',
    shapeBias: ['circle', 'triangle', 'diamond'],
    palette: [
      { id: 'sun', name: 'Sunshine', hex: '#FFB703' },
      { id: 'rain', name: 'Rain', hex: '#219EBC' },
      { id: 'storm', name: 'Storm', hex: '#5C677D' },
      { id: 'cloud', name: 'Cloud', hex: '#E9ECEF' },
      { id: 'wind', name: 'Wind', hex: '#A8DADC' },
      { id: 'rainbow', name: 'Rainbow', hex: '#FF7B00' },
    ],
    subjects: ['Sunny Day', 'Rain Shower', 'Storm Front', 'Snowfall', 'Windy Hill', 'Rainbow Sky', 'Cloud Parade', 'Lightning Show', 'Foggy Morning', 'Weather Station'],
  },
];

const difficultyForSubject = (index: number): ColoringDifficulty => {
  if (index < 3) return 'simple';
  if (index < 7) return 'medium';
  return 'difficult';
};

const difficultyRegionRange: Record<ColoringDifficulty, [number, number]> = {
  simple: [7, 9],
  medium: [11, 15],
  difficult: [17, 23],
};

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickShape(random: () => number, shapeBias: ColoringShapeType[]): ColoringShapeType {
  return shapeBias[Math.floor(random() * shapeBias.length)] || 'rect';
}

function buildRegions(pageId: string, paletteIds: string[], difficulty: ColoringDifficulty, shapeBias: ColoringShapeType[]): ColoringRegion[] {
  const random = mulberry32(hashString(pageId));
  const [min, max] = difficultyRegionRange[difficulty];
  const regionCount = min + Math.floor(random() * (max - min + 1));

  const cols = Math.max(3, Math.ceil(Math.sqrt(regionCount * 1.65)));
  const rows = Math.ceil(regionCount / cols);
  const cellW = VIEWBOX_WIDTH / cols;
  const cellH = VIEWBOX_HEIGHT / rows;

  const regions: ColoringRegion[] = [];

  for (let i = 0; i < regionCount; i += 1) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const centerX = col * cellW + cellW * (0.5 + (random() - 0.5) * 0.22);
    const centerY = row * cellH + cellH * (0.5 + (random() - 0.5) * 0.22);
    const width = cellW * (0.62 + random() * 0.2);
    const height = cellH * (0.58 + random() * 0.25);

    regions.push({
      id: `${pageId}-r${i + 1}`,
      label: `Area ${i + 1}`,
      targetColorId: paletteIds[(i + Math.floor(random() * paletteIds.length)) % paletteIds.length],
      shapeType: pickShape(random, shapeBias),
      cx: Number(centerX.toFixed(2)),
      cy: Number(centerY.toFixed(2)),
      width: Number(width.toFixed(2)),
      height: Number(height.toFixed(2)),
    });
  }

  return regions;
}

export const COLORING_THEMES = THEMES.map((theme) => ({ id: theme.id, label: theme.label, emoji: theme.emoji }));

export const COLORING_PAGES: ColoringPageDefinition[] = THEMES.flatMap((theme) => theme.subjects.map((subject, subjectIndex) => {
  const difficulty = difficultyForSubject(subjectIndex);
  const id = `${theme.id}-${String(subjectIndex + 1).padStart(2, '0')}`;

  return {
    id,
    title: subject,
    theme: theme.id,
    difficulty,
    previewEmoji: theme.emoji,
    description: `${theme.label} themed coloring scene in ${difficulty} mode with guided regions.`,
    palette: theme.palette,
    regions: buildRegions(id, theme.palette.map((c) => c.id), difficulty, theme.shapeBias),
  };
}));

export const COLORING_PAGE_COUNT = COLORING_PAGES.length;

export const COLORING_THEME_LABELS: Record<ColoringThemeId, string> = THEMES.reduce((acc, theme) => {
  acc[theme.id] = theme.label;
  return acc;
}, {} as Record<ColoringThemeId, string>);
