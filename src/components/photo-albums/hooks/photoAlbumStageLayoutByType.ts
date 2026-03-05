import {
  CANVAS_MAX_X,
  CANVAS_MAX_Y,
  CANVAS_MIN_X,
  CANVAS_MIN_Y,
  clamp,
  constrainEditableLayout,
  createFlowOrders,
  estimateMediaHeightPct,
  estimateNoteHeightPct,
  hashValue,
  LayoutConstraints,
  LayoutItem,
  positionByDecorScatter,
  positionByFlow,
  resolveLayout,
  sizeVariation,
  visibleMediaCaption,
} from '../photoAlbumStageEngine';
import { DecorItem, NoteItem } from '../photoAlbumStageEngine';
import { PreparedMediaItem } from '../types';

export function computePhotoAlbumLayoutByType({
  albumId,
  spreadIndex,
  spreadTitle,
  mediaItems,
  notes,
  decorItems,
  mediaWidthPct,
  noteWidthPct,
  densityCount,
  editable,
  isLayoutLocked,
  respectSavedPositions,
  layoutConstraints,
}: {
  albumId: number;
  spreadIndex: number;
  spreadTitle: string;
  mediaItems: PreparedMediaItem[];
  notes: NoteItem[];
  decorItems: DecorItem[];
  mediaWidthPct: number;
  noteWidthPct: number;
  densityCount: number;
  editable: boolean;
  isLayoutLocked: boolean;
  respectSavedPositions: boolean;
  layoutConstraints: LayoutConstraints;
}) {
  try {
    const flow = createFlowOrders(mediaItems, notes, spreadTitle || '');
    const estimatedMediaArea = mediaItems.reduce((sum, item) => sum + (mediaWidthPct * estimateMediaHeightPct(item.caption, mediaWidthPct)), 0);
    const estimatedNoteArea = notes.reduce((sum, item) => sum + (noteWidthPct * estimateNoteHeightPct(item, noteWidthPct)), 0);
    const canvasArea = Math.max(1, (CANVAS_MAX_X - CANVAS_MIN_X) * (CANVAS_MAX_Y - CANVAS_MIN_Y));
    const estimatedCoverage = (estimatedMediaArea + estimatedNoteArea) / canvasArea;
    const targetCoverage = densityCount <= 2 ? 0.9 : densityCount <= 4 ? 0.88 : densityCount <= 8 ? 0.84 : densityCount <= 12 ? 0.82 : densityCount <= 16 ? 0.86 : 0.9;
    const sizeScale = clamp(Math.sqrt(targetCoverage / Math.max(0.0001, estimatedCoverage)), 0.78, 1.75);
    const decorScale = clamp(0.95 + ((sizeScale - 1) * 0.56), 0.85, 1.95);
    const singleMediaSingleNote = mediaItems.length === 1 && notes.length === 1;

    const mediaLayout: LayoutItem[] = mediaItems.map((item, index) => {
      const flowIndex = flow.mediaOrder.get(index) ?? index;
      const groupIndex = flow.mediaGroup.get(index) ?? 0;
      const groupCenterX = flow.groupCenterXByIndex.get(groupIndex) ?? 50;
      const fallback = positionByFlow(flowIndex, flow.total, groupCenterX, `${albumId}-${spreadIndex}-flow`);
      const w = clamp(mediaWidthPct * sizeScale * sizeVariation(`${albumId}-${spreadIndex}-media-${item.key}`, densityCount <= 2 ? 0.92 : 0.78, densityCount <= 2 ? 1.18 : 1.28), 10.5, 46);
      const singleHash = hashValue(`${albumId}-${spreadIndex}-single-media-${item.key}`);
      return {
        id: `media-${item.sourceIndex}`,
        type: 'media',
        index,
        sourceIndex: item.sourceIndex,
        x: Number(singleMediaSingleNote ? (5 + ((singleHash % 8) * 0.65)) : fallback.x),
        y: Number(singleMediaSingleNote ? (14 + ((Math.floor(singleHash / 17) % 12) * 0.7)) : fallback.y),
        w,
        h: estimateMediaHeightPct(visibleMediaCaption(item.caption), w),
        rotation: clamp(Number(singleMediaSingleNote ? (fallback.rotate - 2) : fallback.rotate), -8, 8),
      };
    });

    const noteLayout: LayoutItem[] = notes.map((note, index) => {
      const flowIndex = flow.noteOrder.get(index) ?? (mediaItems.length + index);
      const groupIndex = flow.noteGroup.get(index) ?? 0;
      const groupCenterX = flow.groupCenterXByIndex.get(groupIndex) ?? 50;
      const fallback = positionByFlow(flowIndex, flow.total, groupCenterX, `${albumId}-${spreadIndex}-flow`);
      const w = clamp(noteWidthPct * sizeScale * sizeVariation(`${albumId}-${spreadIndex}-note-${note.id}`, densityCount <= 2 ? 0.9 : 0.74, densityCount <= 2 ? 1.2 : 1.32), 11, 48);
      const singleHash = hashValue(`${albumId}-${spreadIndex}-single-note-${note.id}`);
      return {
        id: `note-${index}`,
        type: 'note',
        index,
        x: Number(singleMediaSingleNote ? (48 + ((singleHash % 10) * 0.75)) : fallback.x),
        y: Number(singleMediaSingleNote ? (28 + ((Math.floor(singleHash / 13) % 14) * 0.75)) : fallback.y),
        w,
        h: estimateNoteHeightPct(note, w),
        rotation: clamp(Number(singleMediaSingleNote ? (fallback.rotate + 2) : fallback.rotate), -7, 7),
      };
    });

    const decorLayout: LayoutItem[] = decorItems.map((item, index) => {
      const fallback = positionByDecorScatter(index, Math.max(1, decorItems.length), `${albumId}-${spreadIndex}-decor`);
      const size = clamp(Number(item.size ?? 1) * decorScale * sizeVariation(`${albumId}-${spreadIndex}-decor-${item.id}`, 0.72, 1.45), 0.65, 2.3);
      return { id: `decor-${index}`, type: 'decor', index, x: Number(fallback.x), y: Number(fallback.y), w: 4.6 * size, h: 4.6 * size, size, rotation: clamp(Number(item.rotation ?? fallback.rotate), -9, 9) };
    });

    const baseLayout = [...mediaLayout, ...noteLayout, ...decorLayout];
    const resolved = (editable && !isLayoutLocked) || respectSavedPositions
      ? baseLayout.map((item) => constrainEditableLayout({ ...item }, layoutConstraints))
      : resolveLayout(baseLayout, `${albumId}-${spreadIndex}`, layoutConstraints);

    const mediaByIndex = new Map<number, LayoutItem>();
    const noteByIndex = new Map<number, LayoutItem>();
    const decorByIndex = new Map<number, LayoutItem>();
    resolved.forEach((item) => {
      if (item.type === 'media') mediaByIndex.set(item.index, item);
      else if (item.type === 'note') noteByIndex.set(item.index, item);
      else decorByIndex.set(item.index, item);
    });
    return { mediaByIndex, noteByIndex, decorByIndex };
  } catch {
    return { mediaByIndex: new Map<number, LayoutItem>(), noteByIndex: new Map<number, LayoutItem>(), decorByIndex: new Map<number, LayoutItem>() };
  }
}
