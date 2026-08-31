const EXT_MIME: Record<string, string> = {
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.jsx': 'text/javascript',
  '.css': 'text/css',
  '.py': 'text/x-python',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.xlsx':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
};

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('image/');
}

export function guessMimeFromFilename(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return null;
  return EXT_MIME[filename.slice(dot).toLowerCase()] ?? null;
}

export function isPreviewableText(mime: string | null): boolean {
  if (!mime) return false;
  return (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml'
  );
}
