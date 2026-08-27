import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/current-user.decorator';
import { AclService } from '../acl/acl.service';

export type ParsedSkillMd = {
  /** Claude Code skill id (kebab-case) */
  slug: string;
  /** Display title */
  name: string;
  description: string;
  descriptionShort: string;
  bodyMd: string;
  sourcePath: string;
};

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AclService,
    private readonly config: ConfigService,
  ) {}

  packageDir(tenantId: string, slug: string) {
    const root =
      this.config.get<string>('WORKALLY_DATA_DIR') ||
      path.resolve(process.cwd(), '.data');
    return path.join(root, 'skills', tenantId, slug);
  }

  async list(user: AuthUser) {
    const items = await this.prisma.skill.findMany({
      where: { tenantId: user.tenantId, status: { in: ['active', 'disabled'] } },
      orderBy: { updatedAt: 'desc' },
    });
    return this.acl.filterUsable(user, 'skills', items);
  }

  async get(user: AuthUser, id: string) {
    const item = await this.prisma.skill.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!item || !(await this.acl.canUse(user, 'skills', item))) {
      throw new NotFoundException();
    }
    return item;
  }

  async uploadZip(
    user: AuthUser,
    file: Express.Multer.File,
    visibility: 'private' | 'restricted' | 'tenant' = 'private',
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传 zip 文件');
    }
    const name = file.originalname?.toLowerCase() ?? '';
    if (!name.endsWith('.zip')) {
      throw new BadRequestException('仅支持 .zip 技能包');
    }

    const parsed = parseSkillZip(file.buffer);
    extractSkillPackage(file.buffer, this.packageDir(user.tenantId, parsed.slug));

    const existing = await this.prisma.skill.findFirst({
      where: { tenantId: user.tenantId, slug: parsed.slug },
    });

    if (existing) {
      return this.prisma.skill.update({
        where: { id: existing.id },
        data: {
          name: parsed.name,
          description: parsed.description,
          descriptionShort: parsed.descriptionShort,
          bodyMd: parsed.bodyMd,
          version: existing.version + 1,
          status: 'active',
          visibility,
        },
      });
    }

    return this.prisma.skill.create({
      data: {
        tenantId: user.tenantId,
        ownerUserId: user.userId,
        name: parsed.name,
        slug: parsed.slug,
        description: parsed.description,
        descriptionShort: parsed.descriptionShort,
        bodyMd: parsed.bodyMd,
        visibility,
        status: 'active',
      },
    });
  }

  async setEnabled(user: AuthUser, id: string, enabled: boolean) {
    const existing = await this.prisma.skill.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    return this.prisma.skill.update({
      where: { id },
      data: { status: enabled ? 'active' : 'disabled' },
    });
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.prisma.skill.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    await this.prisma.skill.update({
      where: { id },
      data: { status: 'disabled' },
    });
    return { ok: true };
  }
}

/** Extract zip contents into dest, normalizing a single top-level folder. */
export function extractSkillPackage(buffer: Buffer, dest: string) {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new BadRequestException('无法解析 zip 文件');
  }

  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.mkdirSync(dest, { recursive: true });

  const tmp = `${dest}.__extract`;
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  zip.extractAllTo(tmp, true);

  const children = fs
    .readdirSync(tmp)
    .filter((n) => n !== '__MACOSX' && n !== '.DS_Store');
  const only = children.length === 1 ? path.join(tmp, children[0]) : null;
  const source =
    only && fs.statSync(only).isDirectory() ? only : tmp;

  for (const entry of fs.readdirSync(source)) {
    if (entry === '__MACOSX' || entry === '.DS_Store') continue;
    fs.cpSync(path.join(source, entry), path.join(dest, entry), {
      recursive: true,
    });
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  if (!fs.existsSync(path.join(dest, 'SKILL.md'))) {
    const found = findFile(dest, 'SKILL.md');
    if (found && path.dirname(found) !== dest) {
      const realRoot = path.dirname(found);
      const staging = `${dest}.__norm`;
      fs.renameSync(realRoot, staging);
      fs.rmSync(dest, { recursive: true, force: true });
      fs.renameSync(staging, dest);
    }
  }
  if (!fs.existsSync(path.join(dest, 'SKILL.md'))) {
    throw new BadRequestException('解压后未找到 SKILL.md');
  }
}

function findFile(dir: string, name: string): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) {
      return full;
    }
    if (entry.isDirectory() && entry.name !== '__MACOSX') {
      const hit = findFile(full, name);
      if (hit) return hit;
    }
  }
  return null;
}

/** Unpack zip and parse Claude Code style SKILL.md */
export function parseSkillZip(buffer: Buffer): ParsedSkillMd {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new BadRequestException('无法解析 zip 文件');
  }

  const entries = zip
    .getEntries()
    .filter((e) => !e.isDirectory && !e.entryName.includes('__MACOSX'));

  const skillEntry =
    entries.find((e) => /(^|\/)SKILL\.md$/i.test(e.entryName)) ??
    entries.find((e) => /(^|\/)skill\.md$/i.test(e.entryName));

  if (!skillEntry) {
    throw new BadRequestException(
      'zip 内未找到 SKILL.md（Claude Code 技能包必须包含该文件）',
    );
  }

  const content = skillEntry.getData().toString('utf8');
  const folderHint = skillEntry.entryName.includes('/')
    ? skillEntry.entryName.split('/').slice(-2, -1)[0]
    : undefined;

  return parseSkillMarkdown(content, folderHint);
}

export function parseSkillMarkdown(
  content: string,
  folderHint?: string,
): ParsedSkillMd {
  const trimmed = content.replace(/^\uFEFF/, '');
  const fm = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fm) {
    throw new BadRequestException(
      'SKILL.md 须以 YAML frontmatter 开头（--- / name / description / ---）',
    );
  }

  const meta = parseSimpleYaml(fm[1]);
  const bodyMd = fm[2].trim();
  if (!bodyMd) {
    throw new BadRequestException('SKILL.md 正文不能为空');
  }

  const rawName = String(meta.name ?? folderHint ?? '').trim();
  if (!rawName) {
    throw new BadRequestException('SKILL.md frontmatter 缺少 name');
  }

  const slug = normalizeSkillSlug(rawName);
  validateClaudeSkillName(slug);

  const description = String(
    meta.description ?? meta.Description ?? '',
  ).trim();
  if (!description) {
    throw new BadRequestException('SKILL.md frontmatter 缺少 description');
  }
  if (description.length > 1024) {
    throw new BadRequestException('description 最长 1024 字符');
  }

  const display =
    String(meta.title ?? meta.display_name ?? meta['display-name'] ?? '')
      .trim() || humanizeSlug(slug);

  const h1 = bodyMd.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const name = display || h1 || slug;

  return {
    slug,
    name,
    description,
    descriptionShort: description.slice(0, 512),
    bodyMd,
    sourcePath: 'SKILL.md',
  };
}

function parseSimpleYaml(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = block.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) {
      i += 1;
      continue;
    }
    const key = m[1];
    let value = m[2].trim();
    if (value === '>' || value === '|') {
      const parts: string[] = [];
      i += 1;
      while (i < lines.length && /^\s+/.test(lines[i])) {
        parts.push(lines[i].replace(/^\s+/, ''));
        i += 1;
      }
      out[key] = parts.join(value === '|' ? '\n' : ' ').trim();
      continue;
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
    i += 1;
  }
  return out;
}

function normalizeSkillSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function validateClaudeSkillName(slug: string) {
  if (!slug || slug.length > 64) {
    throw new BadRequestException('name 须为不超过 64 字符的 kebab-case');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new BadRequestException(
      'name 仅允许小写字母、数字与连字符（Claude Code 规范）',
    );
  }
  if (slug.includes('anthropic') || slug.includes('claude')) {
    throw new BadRequestException('name 不能包含保留词 anthropic / claude');
  }
}

function humanizeSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
