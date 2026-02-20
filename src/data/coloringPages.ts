import {
  ColoringDifficulty,
  ColoringPageDefinition,
  ColoringRegion,
  ColoringShapeType,
  ColoringThemeDefinition,
  ColoringThemeId,
} from '../types/coloring';

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

function difficultyDetailCount(difficulty: ColoringDifficulty): number {
  if (difficulty === 'simple') return 2;
  if (difficulty === 'medium') return 5;
  return 9;
}

function hasAny(subject: string, tokens: string[]): boolean {
  const normalized = subject.toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function addSceneBase(regions: ColoringRegion[], pageId: string, paletteIds: string[], random: () => number): number {
  const next = regions.length + 1;
  const jitterX = (random() - 0.5) * 28;
  const jitterY = (random() - 0.5) * 16;
  regions.push(
    {
      id: `${pageId}-r${next}`,
      label: 'Sky',
      targetColorId: paletteIds[3 % paletteIds.length],
      shapeType: 'rect',
      cx: 500,
      cy: 195,
      width: 1000,
      height: 390,
    },
    {
      id: `${pageId}-r${next + 1}`,
      label: 'Ground',
      targetColorId: paletteIds[4 % paletteIds.length],
      shapeType: 'rect',
      cx: 500,
      cy: 550,
      width: 1000,
      height: 300,
    },
    {
      id: `${pageId}-r${next + 2}`,
      label: 'Sun',
      targetColorId: paletteIds[2 % paletteIds.length],
      shapeType: 'circle',
      cx: 150 + jitterX,
      cy: 110 + jitterY,
      width: 108,
      height: 108,
    },
  );

  return next + 3;
}

function pushRegion(
  regions: ColoringRegion[],
  pageId: string,
  sequence: number,
  shapeType: ColoringShapeType,
  label: string,
  targetColorId: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
): number {
  regions.push({
    id: `${pageId}-r${sequence}`,
    label,
    targetColorId,
    shapeType,
    cx,
    cy,
    width,
    height,
  });
  return sequence + 1;
}

function buildAnimalScene(pageId: string, paletteIds: string[], difficulty: ColoringDifficulty, subject: string): ColoringRegion[] {
  const random = mulberry32(hashString(pageId));
  const regions: ColoringRegion[] = [];
  let seq = addSceneBase(regions, pageId, paletteIds, random);

  const isDuck = hasAny(subject, ['duck']);
  const isRabbit = hasAny(subject, ['rabbit']);
  const bodyColor = isDuck ? paletteIds[2] : paletteIds[0];
  const earColor = isRabbit ? paletteIds[5] : paletteIds[1];

  seq = pushRegion(regions, pageId, seq, 'circle', 'Body', bodyColor, 500, 420, 250, 220);
  seq = pushRegion(regions, pageId, seq, 'circle', 'Head', paletteIds[1], 650, 335, 140, 130);
  seq = pushRegion(regions, pageId, seq, 'triangle', 'Left Ear', earColor, 615, 252, 58, 90);
  seq = pushRegion(regions, pageId, seq, 'triangle', 'Right Ear', earColor, 685, 252, 58, 90);
  seq = pushRegion(regions, pageId, seq, 'rect', 'Front Leg', paletteIds[0], 447, 560, 60, 130);
  seq = pushRegion(regions, pageId, seq, 'rect', 'Back Leg', paletteIds[0], 552, 560, 60, 130);

  if (hasAny(subject, ['pond'])) {
    seq = pushRegion(regions, pageId, seq, 'circle', 'Pond', paletteIds[3], 230, 520, 250, 120);
  }

  const detailCount = difficultyDetailCount(difficulty);
  for (let i = 0; i < detailCount; i += 1) {
    const cx = 170 + i * 72 + (random() - 0.5) * 15;
    const cy = 580 - (i % 2) * 24;
    seq = pushRegion(regions, pageId, seq, 'triangle', `Grass ${i + 1}`, paletteIds[4], cx, cy, 42, 64);
  }

  return regions;
}

function buildNatureScene(pageId: string, paletteIds: string[], difficulty: ColoringDifficulty): ColoringRegion[] {
  const random = mulberry32(hashString(pageId));
  const regions: ColoringRegion[] = [];
  let seq = addSceneBase(regions, pageId, paletteIds, random);

  seq = pushRegion(regions, pageId, seq, 'triangle', 'Left Mountain', paletteIds[4], 310, 340, 330, 260);
  seq = pushRegion(regions, pageId, seq, 'triangle', 'Right Mountain', paletteIds[4], 630, 360, 360, 280);
  seq = pushRegion(regions, pageId, seq, 'diamond', 'River', paletteIds[3], 520, 528, 240, 220);
  seq = pushRegion(regions, pageId, seq, 'rect', 'Tree Trunk', paletteIds[4], 140, 470, 70, 170);
  seq = pushRegion(regions, pageId, seq, 'circle', 'Tree Top', paletteIds[0], 140, 360, 180, 180);

  const detailCount = difficultyDetailCount(difficulty);
  for (let i = 0; i < detailCount; i += 1) {
    const flowerX = 700 + (i % 4) * 60 + (random() - 0.5) * 18;
    const flowerY = 580 - Math.floor(i / 4) * 55;
    seq = pushRegion(regions, pageId, seq, 'circle', `Flower ${i + 1}`, paletteIds[i % 2 === 0 ? 2 : 5], flowerX, flowerY, 38, 38);
  }

  return regions;
}

function buildSpaceScene(pageId: string, paletteIds: string[], difficulty: ColoringDifficulty, subject: string): ColoringRegion[] {
  const random = mulberry32(hashString(pageId));
  const regions: ColoringRegion[] = [];
  let seq = 1;

  seq = pushRegion(regions, pageId, seq, 'rect', 'Space Background', paletteIds[0], 500, 350, 1000, 700);
  seq = pushRegion(regions, pageId, seq, 'circle', 'Planet', paletteIds[3], 245, 455, 250, 250);
  seq = pushRegion(regions, pageId, seq, 'circle', 'Moon', paletteIds[5], 795, 165, 120, 120);

  if (hasAny(subject, ['station'])) {
    seq = pushRegion(regions, pageId, seq, 'rect', 'Station Core', paletteIds[4], 545, 305, 200, 95);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Station Wing Left', paletteIds[1], 425, 305, 120, 50);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Station Wing Right', paletteIds[1], 665, 305, 120, 50);
  } else {
    seq = pushRegion(regions, pageId, seq, 'triangle', 'Rocket Nose', paletteIds[4], 520, 170, 82, 110);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Rocket Body', paletteIds[4], 520, 295, 130, 220);
    seq = pushRegion(regions, pageId, seq, 'circle', 'Rocket Window', paletteIds[5], 520, 282, 58, 58);
    seq = pushRegion(regions, pageId, seq, 'triangle', 'Rocket Flame', paletteIds[2], 520, 432, 72, 112);
  }

  const detailCount = difficultyDetailCount(difficulty) + 2;
  for (let i = 0; i < detailCount; i += 1) {
    const starX = 120 + random() * 760;
    const starY = 80 + random() * 500;
    seq = pushRegion(regions, pageId, seq, 'diamond', `Star ${i + 1}`, paletteIds[2], starX, starY, 30, 30);
  }

  return regions;
}

function buildOceanScene(pageId: string, paletteIds: string[], difficulty: ColoringDifficulty, subject: string): ColoringRegion[] {
  const random = mulberry32(hashString(pageId));
  const regions: ColoringRegion[] = [];
  let seq = 1;

  seq = pushRegion(regions, pageId, seq, 'rect', 'Water', paletteIds[1], 500, 320, 1000, 640);
  seq = pushRegion(regions, pageId, seq, 'rect', 'Seabed', paletteIds[3], 500, 620, 1000, 160);
  seq = pushRegion(regions, pageId, seq, 'circle', 'Main Body', paletteIds[2], 500, 390, 300, 180);

  if (hasAny(subject, ['whale'])) {
    seq = pushRegion(regions, pageId, seq, 'rect', 'Whale Tail', paletteIds[0], 670, 390, 150, 80);
  } else {
    seq = pushRegion(regions, pageId, seq, 'triangle', 'Fish Tail', paletteIds[0], 670, 390, 120, 120);
  }

  seq = pushRegion(regions, pageId, seq, 'triangle', 'Top Fin', paletteIds[4], 510, 300, 76, 90);
  seq = pushRegion(regions, pageId, seq, 'circle', 'Eye', paletteIds[5], 440, 370, 24, 24);

  const detailCount = difficultyDetailCount(difficulty) + 1;
  for (let i = 0; i < detailCount; i += 1) {
    if (i % 2 === 0) {
      seq = pushRegion(regions, pageId, seq, 'rect', `Kelp ${i + 1}`, paletteIds[4], 120 + i * 55, 565, 30, 170);
    } else {
      const bubbleX = 710 + (i % 4) * 42 + (random() - 0.5) * 15;
      const bubbleY = 530 - Math.floor(i / 2) * 68;
      seq = pushRegion(regions, pageId, seq, 'circle', `Bubble ${i + 1}`, paletteIds[5], bubbleX, bubbleY, 34, 34);
    }
  }

  return regions;
}

function buildDinoScene(pageId: string, paletteIds: string[], difficulty: ColoringDifficulty, subject: string): ColoringRegion[] {
  const random = mulberry32(hashString(pageId));
  const regions: ColoringRegion[] = [];
  let seq = addSceneBase(regions, pageId, paletteIds, random);

  seq = pushRegion(regions, pageId, seq, 'circle', 'Dino Body', paletteIds[0], 480, 420, 300, 230);
  seq = pushRegion(regions, pageId, seq, 'circle', 'Dino Head', paletteIds[0], 665, 330, 150, 130);
  seq = pushRegion(regions, pageId, seq, 'rect', 'Left Leg', paletteIds[4], 410, 555, 65, 135);
  seq = pushRegion(regions, pageId, seq, 'rect', 'Right Leg', paletteIds[4], 525, 555, 65, 135);
  seq = pushRegion(regions, pageId, seq, 'triangle', 'Tail', paletteIds[2], 290, 430, 170, 110);

  if (hasAny(subject, ['volcano'])) {
    seq = pushRegion(regions, pageId, seq, 'triangle', 'Volcano', paletteIds[2], 180, 360, 220, 220);
    seq = pushRegion(regions, pageId, seq, 'diamond', 'Lava', paletteIds[1], 180, 252, 90, 90);
  }

  const detailCount = difficultyDetailCount(difficulty);
  for (let i = 0; i < detailCount; i += 1) {
    const spikeX = 420 + i * 38;
    const spikeY = 298 + (i % 2) * 14;
    seq = pushRegion(regions, pageId, seq, 'triangle', `Back Plate ${i + 1}`, paletteIds[1], spikeX, spikeY, 36, 52);
  }

  return regions;
}

function buildFantasyScene(pageId: string, paletteIds: string[], difficulty: ColoringDifficulty, subject: string): ColoringRegion[] {
  const random = mulberry32(hashString(pageId));
  const regions: ColoringRegion[] = [];
  let seq = addSceneBase(regions, pageId, paletteIds, random);

  if (hasAny(subject, ['castle', 'tower'])) {
    seq = pushRegion(regions, pageId, seq, 'rect', 'Castle Base', paletteIds[5], 520, 450, 380, 250);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Left Tower', paletteIds[3], 380, 350, 90, 220);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Right Tower', paletteIds[3], 660, 350, 90, 220);
    seq = pushRegion(regions, pageId, seq, 'triangle', 'Castle Roof', paletteIds[0], 520, 255, 260, 110);
  } else {
    seq = pushRegion(regions, pageId, seq, 'circle', 'Creature Body', paletteIds[0], 500, 415, 260, 220);
    seq = pushRegion(regions, pageId, seq, 'circle', 'Creature Head', paletteIds[3], 650, 330, 140, 130);
    seq = pushRegion(regions, pageId, seq, 'triangle', 'Horn', paletteIds[2], 705, 246, 56, 92);
    seq = pushRegion(regions, pageId, seq, 'diamond', 'Wing', paletteIds[1], 360, 360, 180, 120);
  }

  const detailCount = difficultyDetailCount(difficulty) + 2;
  for (let i = 0; i < detailCount; i += 1) {
    const cx = 160 + (i % 5) * 135 + (random() - 0.5) * 15;
    const cy = 570 - Math.floor(i / 5) * 70;
    seq = pushRegion(regions, pageId, seq, 'diamond', `Gem ${i + 1}`, paletteIds[(i + 1) % paletteIds.length], cx, cy, 38, 38);
  }

  return regions;
}

function buildVehicleScene(pageId: string, paletteIds: string[], difficulty: ColoringDifficulty, subject: string): ColoringRegion[] {
  const random = mulberry32(hashString(pageId));
  const regions: ColoringRegion[] = [];
  let seq = addSceneBase(regions, pageId, paletteIds, random);

  const isPlane = hasAny(subject, ['plane', 'jet']);
  const isBoat = hasAny(subject, ['ferry', 'harbor']);
  const isTrain = hasAny(subject, ['train']);

  if (isPlane) {
    seq = pushRegion(regions, pageId, seq, 'rect', 'Fuselage', paletteIds[0], 520, 340, 360, 90);
    seq = pushRegion(regions, pageId, seq, 'triangle', 'Nose', paletteIds[2], 720, 340, 100, 86);
    seq = pushRegion(regions, pageId, seq, 'diamond', 'Wing', paletteIds[1], 500, 380, 260, 110);
    seq = pushRegion(regions, pageId, seq, 'triangle', 'Tail', paletteIds[3], 355, 305, 90, 90);
  } else if (isBoat) {
    seq = pushRegion(regions, pageId, seq, 'diamond', 'Hull', paletteIds[4], 500, 470, 460, 150);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Cabin', paletteIds[0], 500, 370, 170, 100);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Window Band', paletteIds[5], 500, 370, 132, 40);
  } else if (isTrain) {
    seq = pushRegion(regions, pageId, seq, 'rect', 'Engine', paletteIds[0], 350, 430, 220, 160);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Carriage', paletteIds[1], 620, 430, 260, 160);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Window Row', paletteIds[5], 620, 390, 220, 50);
  } else {
    seq = pushRegion(regions, pageId, seq, 'rect', 'Vehicle Body', paletteIds[0], 500, 430, 420, 170);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Cabin', paletteIds[1], 605, 360, 170, 100);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Window', paletteIds[5], 612, 360, 92, 58);
  }

  seq = pushRegion(regions, pageId, seq, 'circle', 'Left Wheel', paletteIds[3], 390, 535, 105, 105);
  seq = pushRegion(regions, pageId, seq, 'circle', 'Right Wheel', paletteIds[3], 610, 535, 105, 105);

  const detailCount = difficultyDetailCount(difficulty);
  for (let i = 0; i < detailCount; i += 1) {
    const lineX = 120 + i * 82 + (random() - 0.5) * 16;
    seq = pushRegion(regions, pageId, seq, 'rect', `Road Mark ${i + 1}`, paletteIds[2], lineX, 620, 56, 22);
  }

  return regions;
}

function buildHolidayScene(pageId: string, paletteIds: string[], difficulty: ColoringDifficulty, subject: string): ColoringRegion[] {
  const random = mulberry32(hashString(pageId));
  const regions: ColoringRegion[] = [];
  let seq = addSceneBase(regions, pageId, paletteIds, random);

  if (hasAny(subject, ['birthday'])) {
    seq = pushRegion(regions, pageId, seq, 'rect', 'Cake Base', paletteIds[0], 500, 500, 260, 150);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Cake Top', paletteIds[5], 500, 430, 220, 90);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Candle', paletteIds[2], 500, 335, 24, 90);
    seq = pushRegion(regions, pageId, seq, 'diamond', 'Flame', paletteIds[5], 500, 275, 24, 40);
  } else if (hasAny(subject, ['winter', 'snow'])) {
    seq = pushRegion(regions, pageId, seq, 'triangle', 'Holiday Tree', paletteIds[1], 500, 430, 280, 280);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Tree Trunk', paletteIds[0], 500, 585, 65, 80);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Gift Box', paletteIds[4], 350, 570, 120, 90);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Gift Box 2', paletteIds[0], 640, 570, 120, 90);
  } else {
    seq = pushRegion(regions, pageId, seq, 'circle', 'Main Balloon', paletteIds[4], 500, 300, 180, 180);
    seq = pushRegion(regions, pageId, seq, 'circle', 'Balloon Left', paletteIds[0], 375, 340, 125, 125);
    seq = pushRegion(regions, pageId, seq, 'circle', 'Balloon Right', paletteIds[2], 625, 340, 125, 125);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Ribbon', paletteIds[5], 500, 480, 36, 160);
  }

  const detailCount = difficultyDetailCount(difficulty) + 1;
  for (let i = 0; i < detailCount; i += 1) {
    const confettiX = 140 + random() * 700;
    const confettiY = 120 + random() * 450;
    const shape: ColoringShapeType = i % 2 === 0 ? 'diamond' : 'circle';
    seq = pushRegion(regions, pageId, seq, shape, `Confetti ${i + 1}`, paletteIds[i % paletteIds.length], confettiX, confettiY, 26, 26);
  }

  return regions;
}

function buildFarmScene(pageId: string, paletteIds: string[], difficulty: ColoringDifficulty, subject: string): ColoringRegion[] {
  const random = mulberry32(hashString(pageId));
  const regions: ColoringRegion[] = [];
  let seq = addSceneBase(regions, pageId, paletteIds, random);

  if (hasAny(subject, ['tractor'])) {
    seq = pushRegion(regions, pageId, seq, 'rect', 'Tractor Body', paletteIds[0], 500, 450, 300, 150);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Tractor Cabin', paletteIds[5], 570, 360, 140, 100);
    seq = pushRegion(regions, pageId, seq, 'circle', 'Big Wheel', paletteIds[4], 390, 530, 130, 130);
    seq = pushRegion(regions, pageId, seq, 'circle', 'Small Wheel', paletteIds[4], 615, 530, 90, 90);
  } else {
    seq = pushRegion(regions, pageId, seq, 'rect', 'Barn Wall', paletteIds[0], 500, 430, 420, 270);
    seq = pushRegion(regions, pageId, seq, 'triangle', 'Barn Roof', paletteIds[4], 500, 270, 460, 170);
    seq = pushRegion(regions, pageId, seq, 'rect', 'Barn Door', paletteIds[4], 500, 515, 125, 170);
    seq = pushRegion(regions, pageId, seq, 'circle', 'Barn Window', paletteIds[5], 500, 390, 65, 65);
  }

  const detailCount = difficultyDetailCount(difficulty) + 2;
  for (let i = 0; i < detailCount; i += 1) {
    const baleX = 120 + (i % 5) * 160 + (random() - 0.5) * 12;
    const baleY = 590 - Math.floor(i / 5) * 65;
    seq = pushRegion(regions, pageId, seq, 'rect', `Hay Bale ${i + 1}`, paletteIds[1], baleX, baleY, 80, 52);
  }

  return regions;
}

function buildWeatherScene(pageId: string, paletteIds: string[], difficulty: ColoringDifficulty, subject: string): ColoringRegion[] {
  const random = mulberry32(hashString(pageId));
  const regions: ColoringRegion[] = [];
  let seq = pushRegion(regions, pageId, 1, 'rect', 'Sky', paletteIds[3], 500, 270, 1000, 540);

  if (hasAny(subject, ['storm', 'lightning'])) {
    seq = pushRegion(regions, pageId, seq, 'circle', 'Storm Cloud', paletteIds[2], 500, 230, 320, 180);
    seq = pushRegion(regions, pageId, seq, 'diamond', 'Lightning Bolt', paletteIds[5], 500, 390, 90, 180);
  } else if (hasAny(subject, ['rain', 'shower'])) {
    seq = pushRegion(regions, pageId, seq, 'circle', 'Rain Cloud', paletteIds[3], 500, 235, 320, 180);
    for (let i = 0; i < 6; i += 1) {
      seq = pushRegion(regions, pageId, seq, 'diamond', `Raindrop ${i + 1}`, paletteIds[1], 360 + i * 55, 410 + (i % 2) * 30, 30, 45);
    }
  } else {
    seq = pushRegion(regions, pageId, seq, 'circle', 'Sun', paletteIds[0], 250, 160, 140, 140);
    seq = pushRegion(regions, pageId, seq, 'circle', 'Cloud', paletteIds[3], 610, 230, 260, 150);
  }

  seq = pushRegion(regions, pageId, seq, 'rect', 'Ground', paletteIds[4], 500, 590, 1000, 220);
  if (hasAny(subject, ['rainbow'])) {
    seq = pushRegion(regions, pageId, seq, 'diamond', 'Rainbow Arc', paletteIds[5], 500, 330, 450, 170);
  }

  const detailCount = difficultyDetailCount(difficulty);
  for (let i = 0; i < detailCount; i += 1) {
    const gustX = 130 + (i % 6) * 130 + (random() - 0.5) * 20;
    const gustY = 520 - Math.floor(i / 6) * 56;
    seq = pushRegion(regions, pageId, seq, 'rect', `Wind Gust ${i + 1}`, paletteIds[1], gustX, gustY, 85, 20);
  }

  return regions;
}

function buildThemedRegions(
  pageId: string,
  theme: ColoringThemeId,
  paletteIds: string[],
  difficulty: ColoringDifficulty,
  subject: string,
): ColoringRegion[] {
  switch (theme) {
    case 'animals':
      return buildAnimalScene(pageId, paletteIds, difficulty, subject);
    case 'nature':
      return buildNatureScene(pageId, paletteIds, difficulty);
    case 'space':
      return buildSpaceScene(pageId, paletteIds, difficulty, subject);
    case 'ocean':
      return buildOceanScene(pageId, paletteIds, difficulty, subject);
    case 'dinosaurs':
      return buildDinoScene(pageId, paletteIds, difficulty, subject);
    case 'fantasy':
      return buildFantasyScene(pageId, paletteIds, difficulty, subject);
    case 'vehicles':
      return buildVehicleScene(pageId, paletteIds, difficulty, subject);
    case 'holidays':
      return buildHolidayScene(pageId, paletteIds, difficulty, subject);
    case 'farm':
      return buildFarmScene(pageId, paletteIds, difficulty, subject);
    case 'weather':
      return buildWeatherScene(pageId, paletteIds, difficulty, subject);
    default:
      return [];
  }
}

export const COLORING_THEMES = THEMES.map((theme) => ({ id: theme.id, label: theme.label, emoji: theme.emoji }));

export const COLORING_PAGES: ColoringPageDefinition[] = THEMES.flatMap((theme) => theme.subjects.map((subject, subjectIndex) => {
  const difficulty = difficultyForSubject(subjectIndex);
  const id = `${theme.id}-${String(subjectIndex + 1).padStart(2, '0')}`;
  const paletteIds = theme.palette.map((color) => color.id);

  return {
    id,
    title: subject,
    theme: theme.id,
    difficulty,
    previewEmoji: theme.emoji,
    description: `${theme.label} scene: ${subject}.`,
    palette: theme.palette,
    regions: buildThemedRegions(id, theme.id, paletteIds, difficulty, subject),
  };
}));

export const COLORING_PAGE_COUNT = COLORING_PAGES.length;

export const COLORING_THEME_LABELS: Record<ColoringThemeId, string> = THEMES.reduce((acc, theme) => {
  acc[theme.id] = theme.label;
  return acc;
}, {} as Record<ColoringThemeId, string>);
