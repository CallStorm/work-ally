import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RuntimeEventsService } from '../runtime/runtime-events.service';
import { RuntimePathsService } from '../runtime/runtime-paths.service';
import { guessMimeFromFilename } from './mime.util';
import { WorkspaceService } from './workspace.service';

const WRITE_TOOLS = new Set(['write', 'edit']);

@Injectable()
export class ArtifactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paths: RuntimePathsService,
    private readonly workspace: WorkspaceService,
    private readonly events: RuntimeEventsService,
  ) {}

  async list(user: AuthUser, sessionId: string) {
    const session = await this.workspace.assertSessionAccess(user, sessionId);
    let rows = await this.prisma.sessionArtifact.findMany({
      where: { sessionId },
      orderBy: { updatedAt: 'desc' },
    });
    const latestRun = await this.prisma.agentRun.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (latestRun) {
      // Always reconcile so bash-created files (pptx etc.) appear even when
      // some artifacts already exist from write/edit promotion.
      await this.scanWorkspaceAndPromote({
        runId: latestRun.id,
        sessionId,
        tenantId: session.tenantId,
        emitEvents: false,
      });
      rows = await this.prisma.sessionArtifact.findMany({
        where: { sessionId },
        orderBy: { updatedAt: 'desc' },
      });
    }
    return rows;
  }

  async readContent(user: AuthUser, sessionId: string, artifactId: string) {
    await this.workspace.assertSessionAccess(user, sessionId);
    const artifact = await this.prisma.sessionArtifact.findFirst({
      where: { id: artifactId, sessionId },
    });
    if (!artifact) return null;
    return this.workspace.readFile(user, sessionId, artifact.path);
  }

  async resolveForDownload(
    user: AuthUser,
    sessionId: string,
    artifactId: string,
  ) {
    await this.workspace.assertSessionAccess(user, sessionId);
    const artifact = await this.prisma.sessionArtifact.findFirst({
      where: { id: artifactId, sessionId },
    });
    if (!artifact) return null;
    const file = await this.workspace.resolveFile(
      user,
      sessionId,
      artifact.path,
    );
    return {
      abs: file.abs,
      filename: artifact.filename || file.filename,
      mimeType: artifact.mimeType ?? file.mimeType,
    };
  }

  async handleToolResult(input: {
    runId: string;
    sessionId: string;
    tenantId: string;
    toolName: string;
    payload: unknown;
  }) {
    const tool = input.toolName.toLowerCase();
    if (!WRITE_TOOLS.has(tool)) return;

    const filePath = extractFilePath(input.payload);
    if (!filePath) return;

    await this.upsertArtifact({
      ...input,
      relativePath: filePath,
      emitEvents: true,
    });
  }

  /** Promote all non-hidden files in the session workspace (covers bash-created files). */
  async scanWorkspaceAndPromote(input: {
    runId: string;
    sessionId: string;
    tenantId: string;
    emitEvents?: boolean;
  }) {
    const workspaceDir = this.paths.sessionWorkspaceDir(
      input.tenantId,
      input.sessionId,
    );
    if (!fs.existsSync(workspaceDir)) return;

    const files = listFilesRecursive(workspaceDir, workspaceDir);
    for (const rel of files) {
      if (shouldSkipPath(rel)) continue;
      await this.upsertArtifact({
        runId: input.runId,
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        relativePath: rel,
        emitEvents: input.emitEvents !== false,
      });
    }
  }

  private async upsertArtifact(input: {
    runId: string;
    sessionId: string;
    tenantId: string;
    relativePath: string;
    emitEvents: boolean;
  }) {
    const workspaceDir = this.paths.sessionWorkspaceDir(
      input.tenantId,
      input.sessionId,
    );
    let normalized: string;
    try {
      ({ normalized } = this.workspace.resolveSafePath(
        workspaceDir,
        input.relativePath,
      ));
    } catch {
      return;
    }

    if (shouldSkipPath(normalized)) return;

    const abs = path.join(workspaceDir, normalized);
    if (!fs.existsSync(abs)) return;
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size === 0) return;

    const filename = path.basename(normalized);
    const mimeType = guessMimeFromFilename(filename);

    const existing = await this.prisma.sessionArtifact.findUnique({
      where: {
        sessionId_path: { sessionId: input.sessionId, path: normalized },
      },
    });

    const artifact = await this.prisma.sessionArtifact.upsert({
      where: {
        sessionId_path: { sessionId: input.sessionId, path: normalized },
      },
      create: {
        sessionId: input.sessionId,
        runId: input.runId,
        path: normalized,
        filename,
        mimeType,
        sizeBytes: stat.size,
        source: 'auto',
      },
      update: {
        runId: input.runId,
        filename,
        mimeType,
        sizeBytes: stat.size,
      },
    });

    if (!input.emitEvents) return;

    const eventType = existing ? 'artifact_updated' : 'artifact_created';
    this.events.emit(eventType, input.runId, input.sessionId, {
      artifactId: artifact.id,
      path: artifact.path,
      filename: artifact.filename,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
    });
    this.events.emit('workspace_file_changed', input.runId, input.sessionId, {
      path: normalized,
      action: existing ? 'modified' : 'created',
    });
  }
}

function extractFilePath(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const nested = [obj.output, obj.input, obj.args] as unknown[];
  const candidates = [
    obj.path,
    obj.file_path,
    obj.filePath,
    obj.file,
    ...nested.flatMap((n) => {
      if (!n || typeof n !== 'object') return [];
      const o = n as Record<string, unknown>;
      return [o.path, o.file_path, o.filePath, o.file];
    }),
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }

  // Pi write/edit success text: "Successfully wrote N bytes to path"
  const texts = collectTextBlobs(obj);
  for (const text of texts) {
    const wrote = text.match(
      /Successfully wrote\s+\d+\s+bytes?\s+to\s+(.+?)\s*$/i,
    );
    if (wrote?.[1]) return wrote[1].trim();
    const replaced = text.match(
      /Successfully replaced\s+\d+\s+block\(s\)\s+in\s+(.+?)\.?\s*$/i,
    );
    if (replaced?.[1]) return replaced[1].trim();
  }
  return null;
}

function collectTextBlobs(obj: Record<string, unknown>): string[] {
  const out: string[] = [];
  const visit = (v: unknown) => {
    if (typeof v === 'string') {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
      return;
    }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.text === 'string') out.push(o.text);
      for (const val of Object.values(o)) visit(val);
    }
  };
  visit(obj);
  return out;
}

function shouldSkipPath(normalized: string): boolean {
  const parts = normalized.split(/[/\\]/);
  if (parts.some((p) => p.startsWith('.'))) return true;
  if (parts.includes('node_modules')) return true;
  if (parts[0] === 'uploads' || parts.includes('uploads')) return true;
  return false;
}

function listFilesRecursive(root: string, dir: string): string[] {
  const results: string[] = [];
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return results;
  }
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const abs = path.join(dir, name);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (name === 'node_modules') continue;
      results.push(...listFilesRecursive(root, abs));
    } else if (stat.isFile()) {
      results.push(path.relative(root, abs).replace(/\\/g, '/'));
    }
  }
  return results;
}
