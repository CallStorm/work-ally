import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import type { ImageStudioOverlayPosition } from '@work-ally/shared';

/** Prefer real .ttf/.otf — libvips SVG often fails or ignores glyphs from .ttc collections. */
const CJK_FONT_CANDIDATES = [
  process.env.WORKALLY_CJK_FONT,
  'C:\\Windows\\Fonts\\simhei.ttf',
  'C:\\Windows\\Fonts\\simkai.ttf',
  'C:\\Windows\\Fonts\\simfang.ttf',
  'C:\\Windows\\Fonts\\msyh.ttc',
  'C:\\Windows\\Fonts\\msyhbd.ttc',
  'C:\\Windows\\Fonts\\simsun.ttc',
  '/System/Library/Fonts/Supplemental/Songti.ttc',
  '/System/Library/Fonts/PingFang.ttc',
  '/System/Library/Fonts/STHeiti Light.ttc',
  '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
].filter((p): p is string => Boolean(p));

function resolveCjkFontPath(): string | null {
  for (const p of CJK_FONT_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapLines(text: string, maxChars: number): string[] {
  const raw = text.trim().replace(/\s+/g, ' ');
  if (!raw) return [];
  const lines: string[] = [];
  let cur = '';
  for (const ch of raw) {
    if (cur.length >= maxChars) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function resolveStartY(opts: {
  height: number;
  blockHeight: number;
  titleSize: number;
  position: ImageStudioOverlayPosition;
}): number {
  const { height, blockHeight, titleSize, position } = opts;
  const margin = Math.round(height * 0.08);
  switch (position) {
    case 'top':
      return margin + Math.round(titleSize * 0.85);
    case 'bottom':
      return Math.max(
        margin + titleSize,
        height - margin - blockHeight + Math.round(titleSize * 0.35),
      );
    case 'center':
    default:
      return Math.round(height / 2 - blockHeight / 2 + titleSize * 0.35);
  }
}

function reserveHintForPosition(position: ImageStudioOverlayPosition): string {
  switch (position) {
    case 'top':
      return '上方留出干净主视觉留白区';
    case 'bottom':
      return '下方留出干净主视觉留白区';
    case 'center':
    default:
      return '中央留出干净主视觉留白区';
  }
}

/**
 * Composite crisp Chinese (or any) title onto an image using SVG + sharp.
 * Returns JPEG buffer. Throws if no CJK-capable font is available on the host.
 */
export async function overlayTitleOnImage(opts: {
  image: Buffer;
  title: string;
  subtitle?: string;
  position?: ImageStudioOverlayPosition;
}): Promise<{ buffer: Buffer; mimeType: string }> {
  const title = opts.title.trim();
  if (!title) {
    return { buffer: opts.image, mimeType: sniffMime(opts.image) };
  }

  const fontPath = resolveCjkFontPath();
  if (!fontPath) {
    throw new Error(
      '未找到中文字体，无法叠字。请安装微软雅黑/Noto CJK，或设置 WORKALLY_CJK_FONT 指向字体文件。',
    );
  }

  const meta = await sharp(opts.image).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;
  const position = opts.position ?? 'center';

  const titleLines = wrapLines(title, title.length > 8 ? 6 : 8);
  const subtitleLines = opts.subtitle?.trim()
    ? wrapLines(opts.subtitle.trim(), 14)
    : [];

  const titleSize = Math.max(36, Math.round(width * (titleLines.length > 2 ? 0.07 : 0.1)));
  const subSize = Math.max(22, Math.round(width * 0.035));
  const lineGap = Math.round(titleSize * 1.25);
  const subGap = Math.round(subSize * 1.3);
  const blockHeight =
    titleLines.length * lineGap +
    (subtitleLines.length ? Math.round(titleSize * 0.4) + subtitleLines.length * subGap : 0);
  const startY = resolveStartY({ height, blockHeight, titleSize, position });

  const fontUrl = pathToFileURL(fontPath).href;
  const fontFace = `
    @font-face {
      font-family: 'WorkAllyCJK';
      src: url('${fontUrl}');
    }
  `;

  const titleSvg = titleLines
    .map((line, i) => {
      const y = startY + i * lineGap;
      return `<text x="50%" y="${y}" text-anchor="middle" font-family="WorkAllyCJK, 'Microsoft YaHei', sans-serif" font-size="${titleSize}" font-weight="700" fill="#fff8e7" stroke="#7a1f12" stroke-width="${Math.max(4, Math.round(titleSize * 0.08))}" paint-order="stroke fill">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const subStart =
    startY + titleLines.length * lineGap + Math.round(titleSize * 0.35);
  const subSvg = subtitleLines
    .map((line, i) => {
      const y = subStart + i * subGap;
      return `<text x="50%" y="${y}" text-anchor="middle" font-family="WorkAllyCJK, 'Microsoft YaHei', sans-serif" font-size="${subSize}" font-weight="600" fill="#fff4d6" stroke="#5c160c" stroke-width="${Math.max(2, Math.round(subSize * 0.07))}" paint-order="stroke fill">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs><style><![CDATA[${fontFace}]]></style></defs>
  <rect x="0" y="${Math.max(0, startY - titleSize)}" width="${width}" height="${Math.min(height, blockHeight + titleSize)}" fill="rgba(90,18,12,0.18)"/>
  ${titleSvg}
  ${subSvg}
</svg>`;

  const buffer = await sharp(opts.image)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();

  return { buffer, mimeType: 'image/jpeg' };
}

/** Always steer the image model away from drawing glyphs; ratio comes from API params. */
export function buildNoTextPosterPrompt(
  scenePrompt: string,
  opts?: {
    forOverlay?: boolean;
    position?: ImageStudioOverlayPosition;
  },
): string {
  const base = scenePrompt.trim() || '节日宣传海报背景';
  const reserve = opts?.forOverlay
    ? `；为标题${reserveHintForPosition(opts.position ?? 'center')}`
    : '';
  return `${base}。重要：画面中不要出现任何文字、字母、汉字、数字或招牌字样${reserve}；高质量完整构图，避免局部特写。`;
}

function sniffMime(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  return 'image/png';
}
