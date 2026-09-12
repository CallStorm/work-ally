import { getApiBase, getToken } from '@/lib/api';
import type { RuntimeEvent } from '@/lib/types';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Consume NestJS SSE with Authorization header (EventSource cannot set headers). */
export async function subscribeRunEvents(
  runId: string,
  onEvent: (event: RuntimeEvent) => void,
  signal?: AbortSignal,
) {
  const token = getToken();
  const url = `${getApiBase()}/runs/${runId}/events${
    token ? `?access_token=${encodeURIComponent(token)}` : ''
  }`;

  const maxAttempts = 8;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const res = await fetch(url, {
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        signal,
      });
      if (!res.ok || !res.body) {
        // 503 during API hot-reload — retry
        if ((res.status === 502 || res.status === 503) && attempt < maxAttempts - 1) {
          await sleep(Math.min(400 * (attempt + 1), 1500));
          continue;
        }
        throw new Error(`SSE failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const lines = chunk.split('\n');
          const dataLine = lines.find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const raw = dataLine.slice(5).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as RuntimeEvent;
            onEvent(parsed);
            if (parsed.type === 'run_finished') return;
          } catch {
            // ignore malformed
          }
        }
      }
      return;
    } catch (error) {
      lastError = error;
      if ((error as Error).name === 'AbortError') throw error;
      if (attempt < maxAttempts - 1) {
        await sleep(Math.min(400 * (attempt + 1), 1500));
        continue;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('SSE connection failed');
}
