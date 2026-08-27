import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/** Filesystem layout for skill packages and per-run sandboxes. */
@Injectable()
export class RuntimePathsService {
  constructor(private readonly config: ConfigService) {}

  root() {
    const configured = this.config.get<string>('WORKALLY_DATA_DIR');
    return configured
      ? path.resolve(configured)
      : path.resolve(process.cwd(), '.data');
  }

  skillsRoot(tenantId: string) {
    return path.join(this.root(), 'skills', tenantId);
  }

  skillPackageDir(tenantId: string, slug: string) {
    return path.join(this.skillsRoot(tenantId), slug);
  }

  runSandboxDir(tenantId: string, runId: string) {
    return path.join(this.root(), 'runs', tenantId, runId);
  }

  sessionWorkspaceDir(tenantId: string, sessionId: string) {
    return path.join(this.root(), 'sessions', tenantId, sessionId);
  }

  ensureDir(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  writeModelsJson(targetPath: string, input: {
    baseUrl: string;
    modelId: string;
    providerId?: string;
    apiKeyPlaceholder?: string;
  }) {
    const providerId = input.providerId || 'minimax';
    const doc = {
      providers: {
        [providerId]: {
          baseUrl: input.baseUrl,
          api: 'anthropic-messages',
          apiKey: input.apiKeyPlaceholder ?? 'from-runtime',
          models: [
            {
              id: input.modelId,
              name: input.modelId,
              reasoning: false,
              input: ['text'],
              contextWindow: 200000,
              maxTokens: 8192,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            },
          ],
        },
      },
    };
    this.ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, JSON.stringify(doc, null, 2), 'utf8');
    return targetPath;
  }
}
