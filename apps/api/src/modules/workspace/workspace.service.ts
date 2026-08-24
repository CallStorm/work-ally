import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RuntimePathsService } from '../runtime/runtime-paths.service';
import { guessMimeFromFilename } from './mime.util';

export type WorkspaceEntry = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: string;
  children?: WorkspaceEntry[];
};

const SKIP_DIRS = new Set(['node_modules', '.pi-agent', '.git']);

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paths: RuntimePathsService,
  ) {}

  async assertSessionAccess(user: AuthUser, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId: user.tenantId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.createdBy !== user.userId && user.role !== 'admin') {
      throw new ForbiddenException();
    }
    return session;
  }

  workspaceDir(tenantId: string, sessionId: string) {
    return this.paths.ensureDir(
      this.paths.sessionWorkspaceDir(tenantId, sessionId),
    );
  }

  resolveSafePath(workspaceDir: string, relativePath: string) {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      throw new ForbiddenException('Invalid path');
    }
    const abs = path.resolve(workspaceDir, normalized);
    const root = path.resolve(workspaceDir);
    if (!abs.startsWith(root + path.sep) && abs !== root) {
      throw new ForbiddenException('Invalid path');
    }
    return { normalized, abs };
  }

  async listTree(user: AuthUser, sessionId: string) {
    const session = await this.assertSessionAccess(user, sessionId);
    const root = this.workspaceDir(session.tenantId, sessionId);
    const entries = this.scanDir(root, root, '');
    return { root: '.', entries };
  }

  async readFile(user: AuthUser, sessionId: string, relativePath: string) {
    const session = await this.assertSessionAccess(user, sessionId);
    const workspaceDir = this.workspaceDir(session.tenantId, sessionId);
    const { normalized, abs } = this.resolveSafePath(workspaceDir, relativePath);
    if (!fs.existsSync(abs)) throw new NotFoundException('File not found');
    const stat = fs.statSync(abs);
    if (!stat.isFile()) throw new NotFoundException('Not a file');
    const filename = path.basename(normalized);
    const mimeType = guessMimeFromFilename(filename);
    const content = fs.readFileSync(abs);
    return {
      path: normalized,
      filename,
      mimeType,
      sizeBytes: stat.size,
      content: content.toString('utf8'),
      isBinary: !this.isUtf8(content),
    };
  }

  private scanDir(
    root: string,
    dir: string,
    prefix: string,
  ): WorkspaceEntry[] {
    let names: string[];
    try {
      names = fs.readdirSync(dir);
    } catch {
      return [];
    }
    const entries: WorkspaceEntry[] = [];
    for (const name of names.sort()) {
      if (name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${name}` : name;
      const abs = path.join(dir, name);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(abs);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        entries.push({
          name,
          path: rel,
          type: 'directory',
          children: this.scanDir(root, abs, rel),
        });
      } else if (stat.isFile()) {
        entries.push({
          name,
          path: rel,
          type: 'file',
          size: stat.size,
          mtime: stat.mtime.toISOString(),
        });
      }
    }
    return entries;
  }

  private isUtf8(buf: Buffer): boolean {
    try {
      const decoded = buf.toString('utf8');
      return Buffer.from(decoded, 'utf8').equals(buf);
    } catch {
      return false;
    }
  }
}
