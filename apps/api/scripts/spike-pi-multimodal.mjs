/**
 * Task 0 spike: Pi session.prompt() with ImageContent via MiniMax anthropic-messages.
 * Run: node apps/api/scripts/spike-pi-multimodal.mjs
 * Requires ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL in apps/api/.env (or env).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(apiRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** Valid 1×1 red pixel PNG (verified base64) */
function redPngBase64() {
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFgwJ/lY3MpgAAAABJRU5ErkJggg==';
}

function normalizeBaseUrl(raw) {
  if (!raw) return 'https://api.anthropic.com';
  return raw.replace(/\/$/, '').replace(/\/v1$/, '');
}

loadEnv();

const apiKey =
  process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
const baseUrl = normalizeBaseUrl(process.env.ANTHROPIC_BASE_URL);
const modelId = (process.env.ANTHROPIC_DEFAULT_FABLE_MODEL || 'MiniMax-M3')
  .split('/')
  .pop();
const providerId = 'minimax';

if (!apiKey) {
  console.error('Missing ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN');
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-spike-'));
const agentDir = path.join(tmpDir, '.pi-agent');
fs.mkdirSync(agentDir, { recursive: true });

const modelsPath = path.join(agentDir, 'models.json');
fs.writeFileSync(
  modelsPath,
  JSON.stringify(
    {
      providers: {
        [providerId]: {
          baseUrl,
          api: 'anthropic-messages',
          apiKey: 'from-runtime',
          models: [
            {
              id: modelId,
              name: modelId,
              reasoning: false,
              input: ['text', 'image'],
              contextWindow: 200000,
              maxTokens: 8192,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            },
          ],
        },
      },
    },
    null,
    2,
  ),
);

const pi = await import('@mariozechner/pi-coding-agent');
const authStorage = pi.AuthStorage.create(path.join(agentDir, 'auth.json'));
authStorage.setRuntimeApiKey(providerId, apiKey);
const modelRegistry = pi.ModelRegistry.create(authStorage, modelsPath);
const model = modelRegistry.find(providerId, modelId);
if (!model) {
  console.error(`Model not found: ${providerId}/${modelId}`);
  process.exit(1);
}

console.log('Spike config:', { providerId, modelId, baseUrl, modelInput: model.input });

const loader = new pi.DefaultResourceLoader({
  cwd: tmpDir,
  agentDir,
  systemPromptOverride: () => 'You are a vision test assistant. Describe images briefly.',
  skillsOverride: () => ({ skills: [], diagnostics: [] }),
});
await loader.reload();

const settingsManager = pi.SettingsManager.inMemory({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 1 },
});

const { session } = await pi.createAgentSession({
  cwd: tmpDir,
  agentDir,
  model,
  thinkingLevel: 'off',
  authStorage,
  modelRegistry,
  resourceLoader: loader,
  sessionManager: pi.SessionManager.inMemory(),
  settingsManager,
});

let text = '';
const unsubscribe = session.subscribe((event) => {
  if (
    event.type === 'message_update' &&
    event.assistantMessageEvent?.type === 'text_delta' &&
    event.assistantMessageEvent.delta
  ) {
    text += event.assistantMessageEvent.delta;
  }
});

const image = {
  type: 'image',
  data: redPngBase64(),
  mimeType: 'image/png',
};

const promptText = 'Describe this image in one short sentence. What color dominates?';

try {
  // Baseline: text-only must work before judging vision
  console.log('Baseline text-only prompt...');
  await session.prompt('Reply with exactly: OK');
  const baseline = session.messages.filter((m) => m.role === 'assistant').pop();
  console.log('Text-only stop:', baseline?.stopReason, baseline?.errorMessage ?? '');

  console.log('Sending prompt with ImageContent via session.prompt(text, { images })...');
  await session.prompt(promptText, { images: [image] });

  const messages = session.messages ?? [];
  const userMsg = messages.find((m) => m.role === 'user');
  const userHasImage = Array.isArray(userMsg?.content)
    ? userMsg.content.some((c) => c?.type === 'image')
    : false;

  console.log('\n--- Result ---');
  console.log('User message has image block:', userHasImage);
  console.log('Assistant text:', text.trim() || '(empty)');
  const assistantMsg = messages.filter((m) => m.role === 'assistant').pop();
  console.log('Stop reason:', assistantMsg?.stopReason);
  console.log('Error message:', assistantMsg?.errorMessage ?? '(none)');

  const mentionsRed =
    /red|红|crimson|scarlet|maroon|pink|orange|solid|color|colour/i.test(text);
  console.log('Response mentions color/red:', mentionsRed);

  if (!userHasImage) {
    console.error('FAIL: image block not in user message');
    process.exit(2);
  }
  if (!text.trim()) {
    console.error('FAIL: empty assistant response');
    process.exit(3);
  }
  if (!mentionsRed) {
    console.warn('WARN: response may not reflect vision (no color keywords)');
  }
  console.log('PASS: end-to-end multimodal prompt succeeded');
} catch (err) {
  console.error('FAIL:', err);
  process.exit(4);
} finally {
  unsubscribe();
  try {
    session.dispose();
  } catch {
    /* ignore */
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
