import { PhotoAlbumAiCreateRequest, PhotoAlbumSpec } from '../../types/photoAlbums';

function parseAspectRatio(input: string): { width: number; height: number; ratio: PhotoAlbumSpec['dimensions']['aspect_ratio'] } {
  const normalized = String(input || '4:3').trim();
  if (normalized === '16:9') return { width: 1600, height: 900, ratio: '16:9' };
  if (normalized === '3:2') return { width: 1500, height: 1000, ratio: '3:2' };
  if (normalized === '1:1') return { width: 1200, height: 1200, ratio: '1:1' };
  return { width: 1400, height: 1050, ratio: '4:3' };
}

export function buildPhotoAlbumAiPrompt(input: PhotoAlbumAiCreateRequest): string {
  const safeTitle = String(input.title || 'Untitled Album').trim();
  const safeSummary = String(input.summary || '').trim();
  const safeEra = String(input.memory_era || 'family timeline').trim();
  const safeMood = String(input.mood || 'warm and nostalgic').trim();
  const safePalette = String(input.dominant_palette || 'rose, cream, sage').trim();
  const safeMaterials = String(input.scrapbook_materials || 'linen, torn paper, tape').trim();
  const safeMotifs = String(input.motif_keywords || 'postmarks, doodles, pressed flowers').trim();
  const safeCameraStyle = String(input.camera_style || '35mm candid').trim();
  const safeTexture = String(input.texture_intensity || 'balanced').trim();

  return [
    '[CATN8_SCRAPBOOK_COVER_PROMPT_V1]',
    'Create a scrapbook album cover with a handcrafted look.',
    'Style constraints:',
    '- Endearing memory-focused design, never futuristic UI.',
    '- Tactile materials and layered paper textures.',
    '- Keep text readable for title and subtitle areas.',
    `Album title: ${safeTitle}`,
    `Album summary: ${safeSummary}`,
    `Memory era: ${safeEra}`,
    `Mood: ${safeMood}`,
    `Dominant palette: ${safePalette}`,
    `Materials: ${safeMaterials}`,
    `Motifs: ${safeMotifs}`,
    `Camera style inspiration: ${safeCameraStyle}`,
    `Texture intensity: ${safeTexture}`,
    'Output intent: one hero cover graphic suitable for a digital scrapbook viewer.',
  ].join('\n');
}

export function buildStandardPhotoAlbumSpec(input: PhotoAlbumAiCreateRequest): PhotoAlbumSpec {
  const ratio = parseAspectRatio(input.aspect_ratio);
  const spreadCount = Math.max(6, Math.min(30, Number(input.spread_count) || 10));
  const palette = String(input.dominant_palette || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  const materials = String(input.scrapbook_materials || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  const motifs = String(input.motif_keywords || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

  const spreads: PhotoAlbumSpec['spreads'] = [];
  for (let i = 1; i <= spreadCount; i += 1) {
    spreads.push({
      spread_number: i,
      title: i === 1 ? 'Opening Notes' : `Memory Spread ${i}`,
      caption: i === 1 ? 'Setting the tone of this chapter.' : `Highlights from spread ${i}.`,
      photo_slots: i % 3 === 0 ? 4 : 3,
      embellishments: [
        motifs[i % Math.max(1, motifs.length)] || 'handwritten notes',
        materials[i % Math.max(1, materials.length)] || 'paper clippings',
      ],
      background_prompt: [
        '[CATN8_SCRAPBOOK_SPREAD_BG_V1]',
        `Spread: ${i}/${spreadCount}`,
        `Mood: ${String(input.mood || 'warm and nostalgic').trim()}`,
        `Memory era: ${String(input.memory_era || 'family timeline').trim()}`,
        `Palette: ${palette.join(', ') || 'rose, cream, sage'}`,
        `Materials: ${materials.join(', ') || 'linen, tape, pressed paper'}`,
        `Motifs: ${motifs.join(', ') || 'postcards, ribbons, stamps'}`,
      ].join(' | '),
    });
  }

  return {
    schema_version: 'catn8_scrapbook_spec_v1',
    dimensions: {
      width_px: ratio.width,
      height_px: ratio.height,
      aspect_ratio: ratio.ratio,
      safe_margin_px: 56,
      bleed_px: 24,
    },
    controls: {
      page_turn_style: input.page_turn_style,
      zoom: {
        min: 0.75,
        max: 2.5,
        step: 0.25,
        initial: 1,
      },
      downloads: {
        allow_cover_download: true,
        allow_page_download: true,
        formats: ['png', 'jpg', 'webp'],
        default_format: 'png',
      },
    },
    style_guide: {
      memory_era: String(input.memory_era || 'family timeline').trim(),
      mood: String(input.mood || 'warm and nostalgic').trim(),
      palette: palette.length ? palette : ['rose', 'cream', 'sage'],
      materials: materials.length ? materials : ['linen', 'tape', 'postcards'],
      motifs: motifs.length ? motifs : ['postmarks', 'ribbons', 'handwriting'],
      scrapbook_feel: 'A deeply personal, handcrafted scrapbook assembled over months or years.',
    },
    spreads,
  };
}
