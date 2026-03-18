import { WizardView } from '../../../types/pages/buildWizardPage';

export function withDownloadFlag(url: string): string {
  const clean = String(url || '').trim();
  if (!clean) {
    return '';
  }
  return `${clean}${clean.includes('?') ? '&' : '?'}download=1`;
}

export function fileExtensionFromName(name: string): string {
  const clean = String(name || '').trim();
  if (!clean || !clean.includes('.')) {
    return '';
  }
  const extension = clean.split('.').pop() || '';
  return extension.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
}

export function mimeGroupLabel(mimeType: string): string {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('application/pdf')) return 'PDF';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return 'Spreadsheet';
  if (mime.includes('wordprocessingml') || mime.includes('msword') || mime.includes('rtf') || mime.includes('text/')) return 'Document';
  if (mime.includes('presentation')) return 'Slides';
  if (mime.includes('zip') || mime.includes('compressed')) return 'Archive';
  if (mime.includes('json') || mime.includes('xml')) return 'Data';
  return 'File';
}

export function parseUrlState(): { view: WizardView; projectId: number | null } {
  if (typeof window === 'undefined') {
    return { view: 'launcher', projectId: null };
  }
  const url = new URL(window.location.href);
  const viewParam = String(url.searchParams.get('view') || '').toLowerCase();
  const projectIdParam = Number(url.searchParams.get('project_id') || '0');
  return {
    view: viewParam === 'build' ? 'build' : (viewParam === 'template_editor' ? 'template_editor' : 'launcher'),
    projectId: Number.isFinite(projectIdParam) && projectIdParam > 0 ? projectIdParam : null,
  };
}

export function pushUrlState(view: WizardView, projectId: number | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);

  if (view === 'build' && projectId && projectId > 0) {
    url.searchParams.set('view', 'build');
    url.searchParams.set('project_id', String(projectId));
  } else if (view === 'template_editor') {
    url.searchParams.set('view', 'template_editor');
    url.searchParams.delete('project_id');
  } else {
    url.searchParams.delete('view');
    url.searchParams.delete('project_id');
  }

  window.history.pushState({ view, projectId }, '', url.toString());
}

export function segmentBackground(colors: string[]): string {
  if (colors.length <= 1) {
    return colors[0] || 'var(--catn8-bw-tab-fallback-color)';
  }
  const stripeWidth = 8;
  const stops = colors
    .map((color, index) => {
      const start = index * stripeWidth;
      const end = (index + 1) * stripeWidth;
      return `${color} ${start}px ${end}px`;
    })
    .join(', ');
  return `repeating-linear-gradient(135deg, ${stops})`;
}

export function getStepPastelColor(stepId: number): string {
  const id = Math.max(1, Number(stepId) || 1);
  const hue = (id * 47) % 360;
  return `hsl(${hue}deg 62% 84%)`;
}
