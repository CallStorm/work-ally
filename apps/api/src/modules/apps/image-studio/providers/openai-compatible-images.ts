export type OpenAiCompatibleImageResult = {
  buffer: Buffer;
  mimeType: string;
};

export class OpenAiCompatibleImagesError extends Error {
  readonly status?: number;
  readonly sanitizedMessage: string;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OpenAiCompatibleImagesError';
    this.status = status;
    this.sanitizedMessage = formatProviderError(message, status);
  }
}

export async function openaiCompatibleImages(opts: {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  prompt: string;
  n: number;
  sourceImage?: Buffer;
  sourceMime?: string;
  defaultParams?: Record<string, unknown>;
}): Promise<OpenAiCompatibleImageResult[]> {
  const root = opts.baseUrl.replace(/\/$/, '');
  const n = Math.min(Math.max(1, Math.floor(opts.n) || 1), 4);

  if (!opts.sourceImage) {
    const res = await fetch(`${root}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(opts.defaultParams ?? {}),
        model: opts.modelName,
        prompt: opts.prompt,
        n,
        response_format: 'b64_json',
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new OpenAiCompatibleImagesError(body || res.statusText, res.status);
    }
    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    return decodeImageData(json.data ?? []);
  }

  const form = new FormData();
  const mime = opts.sourceMime ?? 'image/png';
  const filename = `source.${extensionForMime(mime)}`;
  form.append(
    'image',
    new Blob([opts.sourceImage], { type: mime }),
    filename,
  );
  for (const [key, value] of Object.entries(opts.defaultParams ?? {})) {
    if (value === undefined || value === null) continue;
    if (
      key === 'model' ||
      key === 'prompt' ||
      key === 'n' ||
      key === 'response_format' ||
      key === 'image'
    ) {
      continue;
    }
    form.append(
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  }
  form.append('model', opts.modelName);
  form.append('prompt', opts.prompt);
  form.append('n', String(n));
  form.append('response_format', 'b64_json');

  const res = await fetch(`${root}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new OpenAiCompatibleImagesError(body || res.statusText, res.status);
  }
  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  return decodeImageData(json.data ?? []);
}

export function sanitizeProviderSnippet(raw: string): string {
  return raw
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(
      /(?:api[_-]?key|apiKey|access[_-]?token|secret)["']?\s*[:=]\s*["']?[^"'&\s,}+]+/gi,
      '[redacted]',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatProviderError(raw: string, status?: number): string {
  const prefix =
    status != null
      ? `上游生图失败（HTTP ${status}）`
      : '上游生图失败';
  const snippet = sanitizeProviderSnippet(raw).slice(0, 200);
  return snippet ? `${prefix}：${snippet}` : prefix;
}

async function decodeImageData(
  data: Array<{ b64_json?: string; url?: string }>,
): Promise<OpenAiCompatibleImageResult[]> {
  if (!data.length) {
    throw new OpenAiCompatibleImagesError('Provider returned no images');
  }
  const out: OpenAiCompatibleImageResult[] = [];
  for (const item of data) {
    if (item.b64_json) {
      const buffer = Buffer.from(item.b64_json, 'base64');
      out.push({ buffer, mimeType: sniffMime(buffer) });
      continue;
    }
    if (item.url) {
      const imgRes = await fetch(item.url);
      if (!imgRes.ok) {
        throw new OpenAiCompatibleImagesError(
          `Failed to download image url`,
          imgRes.status,
        );
      }
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const headerType = imgRes.headers.get('content-type');
      const mimeType =
        headerType && headerType.startsWith('image/')
          ? headerType.split(';')[0]!.trim()
          : sniffMime(buffer);
      out.push({ buffer, mimeType });
      continue;
    }
    throw new OpenAiCompatibleImagesError(
      'Provider image item missing b64_json and url',
    );
  }
  return out;
}

function sniffMime(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return 'image/png';
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}
