export type OpenAiCompatibleImageResult = {
  buffer: Buffer;
  mimeType: string;
};

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
        n: opts.n,
        response_format: 'b64_json',
      }),
    });
    if (!res.ok) throw new Error(await res.text());
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
  form.append('model', opts.modelName);
  form.append('prompt', opts.prompt);
  form.append('n', String(opts.n));
  form.append('response_format', 'b64_json');
  for (const [key, value] of Object.entries(opts.defaultParams ?? {})) {
    if (value === undefined || value === null) continue;
    form.append(
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  }

  const res = await fetch(`${root}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  return decodeImageData(json.data ?? []);
}

async function decodeImageData(
  data: Array<{ b64_json?: string; url?: string }>,
): Promise<OpenAiCompatibleImageResult[]> {
  if (!data.length) {
    throw new Error('Provider returned no images');
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
        throw new Error(`Failed to download image url (${imgRes.status})`);
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
    throw new Error('Provider image item missing b64_json and url');
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
