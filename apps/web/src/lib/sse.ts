import { getApiBase, getToken } from '@/lib/api';
import type { RuntimeEvent } from '@/lib/types';

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

  const res = await fetch(url, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    signal,
  });
  if (!res.ok || !res.body) {
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
}
