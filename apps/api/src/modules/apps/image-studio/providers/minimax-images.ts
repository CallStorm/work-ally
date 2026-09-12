import {
  formatProviderError,
  OpenAiCompatibleImagesError,
  type OpenAiCompatibleImageResult,
} from './openai-compatible-images';

export type MinimaxImageResult = OpenAiCompatibleImageResult;

/** Normalize admin baseUrl to the root that hosts `/image_generation`. */
export function minimaxImageApiRoot(baseUrl: string): string {
  let root = baseUrl.trim().replace(/\/$/, '');
  // Accept either host root or .../v1
  if (!/\/v1$/i.test(root)) {
    root = `${root}/v1`;
  }
  return root;
}

export async function minimaxImages(opts: {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  prompt: string;
  n: number;
  sourceImage?: Buffer;
  sourceMime?: string;
  defaultParams?: Record<string, unknown>;
}): Promise<MinimaxImageResult[]> {
  const root = minimaxImageApiRoot(opts.baseUrl);
  const n = Math.min(Math.max(1, Math.floor(opts.n) || 1), 4);
  const defaults = { ...(opts.defaultParams ?? {}) };
  // Prefer readable Chinese / poster text when admin didn't set it
  if (defaults.prompt_optimizer === undefined) {
    defaults.prompt_optimizer = true;
  }

  const prompt = enrichMinimaxPrompt(opts.prompt).slice(0, 1500);

  const body: Record<string, unknown> = {
    ...defaults,
    model: opts.modelName || 'image-01',
    prompt,
    n,
    response_format: 'base64',
  };

  // Controlled fields win over defaultParams
  body.model = opts.modelName || 'image-01';
  body.prompt = prompt;
  body.n = n;
  body.response_format = 'base64';

  if (opts.sourceImage) {
    const mime = opts.sourceMime ?? 'image/png';
    const b64 = opts.sourceImage.toString('base64');
    body.subject_reference = [
      {
        type: 'character',
        image_file: `data:${mime};base64,${b64}`,
      },
    ];
  }

  const res = await fetch(`${root}/image_generation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => '');
  let json: {
    data?: { image_base64?: string[]; image_urls?: string[] };
    base_resp?: { status_code?: number; status_msg?: string };
  } = {};
  try {
    json = text ? (JSON.parse(text) as typeof json) : {};
  } catch {
    if (!res.ok) {
      throw new OpenAiCompatibleImagesError(text || res.statusText, res.status);
    }
    throw new OpenAiCompatibleImagesError('MiniMax 返回非 JSON 响应', res.status);
  }

  const statusCode = json.base_resp?.status_code;
  if (statusCode != null && statusCode !== 0) {
    const msg = json.base_resp?.status_msg || text || `status_code=${statusCode}`;
    throw new OpenAiCompatibleImagesError(msg, res.status || undefined);
  }
  if (!res.ok) {
    throw new OpenAiCompatibleImagesError(text || res.statusText, res.status);
  }

  const b64List = json.data?.image_base64 ?? [];
  if (b64List.length) {
    return b64List.map((b64) => {
      const raw = b64.includes(',') ? b64.split(',').pop()! : b64;
      const buffer = Buffer.from(raw, 'base64');
      return { buffer, mimeType: sniffMime(buffer) };
    });
  }

  const urls = json.data?.image_urls ?? [];
  if (!urls.length) {
    throw new OpenAiCompatibleImagesError('MiniMax 未返回图片');
  }

  const out: MinimaxImageResult[] = [];
  for (const url of urls) {
    const imgRes = await fetch(url);
    if (!imgRes.ok) {
      throw new OpenAiCompatibleImagesError(
        '下载 MiniMax 图片失败',
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
  }
  return out;
}

export async function minimaxConnectionTest(opts: {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}): Promise<{ ok: true; message: string }> {
  try {
    await minimaxImages({
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      modelName: opts.modelName || 'image-01',
      prompt: 'connection test simple icon',
      n: 1,
      defaultParams: { aspect_ratio: '1:1' },
    });
    return { ok: true, message: '连接成功' };
  } catch (err) {
    if (err instanceof OpenAiCompatibleImagesError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new OpenAiCompatibleImagesError(formatProviderError(message));
  }
}

function enrichMinimaxPrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return trimmed;
  // Server-side title overlay path: keep the canvas free of model-drawn glyphs
  if (/不要出现任何文字|无文字|no[- ]?text|留白/i.test(trimmed)) {
    return trimmed;
  }
  // Poster / Chinese-text prompts: steer model toward fewer, larger, correct glyphs
  const hasCjk = /[\u4e00-\u9fff]/.test(trimmed);
  const looksLikePoster =
    /海报|宣传|标题|文案|字体|文字|slogan|banner|poster/i.test(trimmed);
  if (!hasCjk && !looksLikePoster) return trimmed;
  if (/清晰可读|字形正确|prompt_optimizer/i.test(trimmed)) return trimmed;
  return `${trimmed}。要求：画面中的中文标题与文案必须字形正确、清晰可读，文字宜少而大，避免乱码或假字。`;
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
