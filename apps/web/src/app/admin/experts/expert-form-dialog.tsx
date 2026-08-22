'use client';

import Link from 'next/link';
import {
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { apiFetch } from '@/lib/api';
import {
  AVATAR_PRESETS,
  defaultPresetId,
  parseAvatarUrl,
  presetToAvatarUrl,
} from './expert-avatars';

type Expert = {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  personaMd: string;
  visibility: string;
  suggestedPrompts: string[];
  skillIds: string[];
  connectorIds: string[];
};

type Named = { id: string; name: string };

type AssistResult = {
  name?: string;
  description?: string;
  personaMd?: string;
  suggestedPrompts?: string[];
  avatarPreset?: string;
};

type AssistTask =
  | 'draft'
  | 'optimize_name'
  | 'optimize_description'
  | 'generate_prompts'
  | 'optimize_rules'
  | 'suggest_avatar';

const field: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#64748b',
};

const sectionCard: CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 16,
  display: 'grid',
  gap: 12,
};

const primaryBtn: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#334155',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};

const aiBtn: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #c7d2fe',
  background: '#eef2ff',
  color: '#4338ca',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export function ExpertAvatar({
  name,
  avatarUrl,
  size = 44,
}: {
  name: string;
  avatarUrl: string | null;
  size?: number;
}) {
  const parsed = parseAvatarUrl(avatarUrl);
  if (parsed.kind === 'image' && parsed.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={parsed.src}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          objectFit: 'cover',
          border: '1px solid #e2e8f0',
        }}
      />
    );
  }
  const preset = parsed.preset ?? AVATAR_PRESETS[0];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: preset.bg,
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.45,
        border: '1px solid #e2e8f0',
      }}
    >
      {preset.emoji}
    </div>
  );
}

export function ExpertFormDialog({
  editing,
  skills,
  connectors,
  onClose,
  onSaved,
}: {
  editing: Expert | null;
  skills: Named[];
  connectors: Named[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isCreate = !editing;
  const initialPreset =
    parseAvatarUrl(editing?.avatarUrl ?? null).preset?.id ?? defaultPresetId();

  const [brief, setBrief] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(
    editing?.avatarUrl ?? presetToAvatarUrl(initialPreset),
  );
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [personaMd, setPersonaMd] = useState(editing?.personaMd ?? '');
  const [prompts, setPrompts] = useState<string[]>(
    editing?.suggestedPrompts?.length ? editing.suggestedPrompts : [],
  );
  const [skillIds, setSkillIds] = useState<string[]>(editing?.skillIds ?? []);
  const [connectorIds, setConnectorIds] = useState<string[]>(
    editing?.connectorIds ?? [],
  );
  const [visibility, setVisibility] = useState<'private' | 'tenant'>(
    editing?.visibility === 'tenant' ? 'tenant' : 'private',
  );
  const [showAdvanced, setShowAdvanced] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState<AssistTask | 'draft' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedPresetId =
    parseAvatarUrl(avatarUrl).preset?.id ??
    (avatarUrl.startsWith('preset:')
      ? avatarUrl.slice('preset:'.length)
      : defaultPresetId());

  async function runAssist(task: AssistTask) {
    setAiBusy(task);
    setError(null);
    try {
      const result = await apiFetch<AssistResult>('/experts/assist', {
        method: 'POST',
        body: JSON.stringify({
          task,
          brief: task === 'draft' ? brief : undefined,
          name,
          description,
          personaMd,
          suggestedPrompts: prompts,
        }),
      });
      applyAssistResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 生成失败');
    } finally {
      setAiBusy(null);
    }
  }

  function applyAssistResult(result: AssistResult) {
    if (result.name) setName(result.name);
    if (result.description) setDescription(result.description);
    if (result.personaMd) setPersonaMd(result.personaMd);
    if (result.suggestedPrompts?.length) setPrompts(result.suggestedPrompts);
    if (result.avatarPreset) {
      setAvatarUrl(presetToAvatarUrl(result.avatarPreset));
    }
  }

  function onPickPreset(id: string) {
    setAvatarUrl(presetToAvatarUrl(id));
  }

  function onUploadAvatar(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }
    if (file.size > 512 * 1024) {
      setError('图片请小于 512KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setAvatarUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      avatarUrl: avatarUrl || presetToAvatarUrl(defaultPresetId()),
      personaMd: personaMd.trim(),
      suggestedPrompts: prompts.map((p) => p.trim()).filter(Boolean),
      skillIds,
      connectorIds,
      knowledgeIds: [] as string[],
      visibility,
    };
    if (!body.name) {
      setError('请填写名称');
      return;
    }
    if (!body.personaMd) {
      setError('请填写规则，或使用 AI 生成');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/experts/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/experts', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.4)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
        padding: 20,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(680px, 100%)',
          maxHeight: '92vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 16,
          padding: 22,
          boxShadow: '0 24px 60px rgba(15,23,42,0.2)',
          display: 'grid',
          gap: 16,
        }}
      >
        <DialogHeader editing={!!editing} onClose={onClose} />

        {isCreate && (
          <section
            style={{
              background: 'linear-gradient(135deg, #eef2ff, #f8fafc)',
              border: '1px solid #c7d2fe',
              borderRadius: 14,
              padding: 16,
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 650, fontSize: 15, color: '#312e81' }}>
              ✨ 快速创建
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              用一句话描述专家用途，AI 将自动生成名称、描述、提示词与规则。
            </p>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="例如：帮我写周报、整理会议待办、审核合同条款…"
              style={{ ...field, minHeight: 72, resize: 'vertical' }}
            />
            <button
              type="button"
              disabled={aiBusy !== null || !brief.trim()}
              onClick={() => void runAssist('draft')}
              style={{
                ...primaryBtn,
                background: '#4338ca',
                justifySelf: 'start',
                opacity: !brief.trim() ? 0.6 : 1,
              }}
            >
              {aiBusy === 'draft' ? 'AI 生成中…' : 'AI 一键生成全部'}
            </button>
          </section>
        )}

        <Section title="身份" badge="改动立即生效">
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <ExpertAvatar name={name || '专家'} avatarUrl={avatarUrl} size={56} />
            <div style={{ flex: 1, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                头像
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                }}
              >
                {AVATAR_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPickPreset(p.id)}
                    style={{
                      border:
                        selectedPresetId === p.id && !avatarUrl.startsWith('data:')
                          ? '2px solid #4338ca'
                          : '1px solid #e2e8f0',
                      borderRadius: 12,
                      background: p.bg,
                      height: 44,
                      fontSize: 22,
                      cursor: 'pointer',
                    }}
                  >
                    {p.emoji}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={aiBtn}
                >
                  上传图片
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => onUploadAvatar(e.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={aiBusy !== null}
                  onClick={() => void runAssist('suggest_avatar')}
                  style={aiBtn}
                >
                  {aiBusy === 'suggest_avatar' ? '…' : '✨ AI 选头像'}
                </button>
              </div>
            </div>
          </div>

          <FieldWithAi
            label="名称"
            aiLabel="优化"
            aiBusy={aiBusy === 'optimize_name'}
            onAi={() => void runAssist('optimize_name')}
            disabled={aiBusy !== null}
          >
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：周报助手"
              style={field}
            />
          </FieldWithAi>

          <FieldWithAi
            label="描述"
            aiLabel="优化"
            aiBusy={aiBusy === 'optimize_description'}
            onAi={() => void runAssist('optimize_description')}
            disabled={aiBusy !== null || !description.trim()}
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="帮你解决什么问题"
              style={{ ...field, minHeight: 72, resize: 'vertical' }}
            />
          </FieldWithAi>
        </Section>

        <Section title="推荐提示词" badge="改动立即生效">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, color: '#64748b' }}>
              用户可直接点击使用的开场问题
            </span>
            <button
              type="button"
              disabled={
                aiBusy !== null || (!description.trim() && !name.trim())
              }
              onClick={() => void runAssist('generate_prompts')}
              style={aiBtn}
            >
              {aiBusy === 'generate_prompts' ? '生成中…' : '✨ 根据描述生成'}
            </button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {prompts.length === 0 && (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                暂无提示词，可点击上方按钮生成
              </div>
            )}
            {prompts.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <input
                  value={p}
                  onChange={(e) =>
                    setPrompts((prev) =>
                      prev.map((x, idx) => (idx === i ? e.target.value : x)),
                    )
                  }
                  placeholder="输入推荐提示词"
                  style={field}
                />
                <button
                  type="button"
                  onClick={() =>
                    setPrompts((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    borderRadius: 10,
                    padding: '0 12px',
                    cursor: 'pointer',
                    color: '#64748b',
                  }}
                >
                  删
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPrompts((p) => [...p, ''])}
              style={{
                justifySelf: 'start',
                border: 'none',
                background: 'transparent',
                color: '#334155',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              + 添加
            </button>
          </div>
        </Section>

        <Section title="引擎" badge="仅对新会话生效" badgeTone="warn">
          <select value="pi" disabled style={{ ...field, opacity: 0.9 }}>
            <option value="pi">Pi（默认 Agent Runtime）</option>
          </select>
        </Section>

        <Section title="规则" badge="仅对新会话生效" badgeTone="warn">
          <FieldWithAi
            label="人设与指令（Markdown）"
            aiLabel="优化"
            aiBusy={aiBusy === 'optimize_rules'}
            onAi={() => void runAssist('optimize_rules')}
            disabled={
              aiBusy !== null ||
              (!personaMd.trim() && !description.trim() && !name.trim())
            }
          >
            <textarea
              value={personaMd}
              onChange={(e) => setPersonaMd(e.target.value)}
              placeholder="可留空后使用 AI 生成，或手动编写 Markdown 规则…"
              style={{ ...field, minHeight: 140, resize: 'vertical' }}
            />
          </FieldWithAi>
        </Section>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {showAdvanced ? '▾ 收起高级配置' : '▸ 高级配置（技能 / MCP / 可见范围）'}
          </button>
        </div>

        {showAdvanced && (
          <Section title="默认配置" badge="仅对新会话生效" badgeTone="warn">
            <MultiSelect
              label={`技能（已选 ${skillIds.length} 项）`}
              options={skills}
              selected={skillIds}
              onChange={setSkillIds}
              emptyHint="暂无技能"
              manageHref="/admin/skills"
              manageLabel="技能中心"
            />
            <MultiSelect
              label={`MCP（已选 ${connectorIds.length} 项）`}
              options={connectors}
              selected={connectorIds}
              onChange={setConnectorIds}
              emptyHint="暂无 MCP"
              manageHref="/admin/connectors"
              manageLabel="MCP 设置"
            />
            <label style={labelStyle}>
              可见范围
              <select
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as 'private' | 'tenant')
                }
                style={field}
              >
                <option value="private">仅管理员配置（私有）</option>
                <option value="tenant">全公司可用</option>
              </select>
            </label>
          </Section>
        )}

        {error && (
          <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div>
        )}

        <DialogFooter
          saving={saving}
          editing={!!editing}
          onClose={onClose}
          aiBusy={aiBusy !== null}
        />
      </form>
    </div>
  );
}

function DialogHeader({
  editing,
  onClose,
}: {
  editing: boolean;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          {editing ? '编辑专家' : '创建专家'}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
          {editing
            ? '修改后立即生效；规则与默认配置仅对新会话生效。'
            : '描述需求 → AI 生成 → 微调 → 创建，只需几步。'}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        style={{
          border: 'none',
          background: 'transparent',
          fontSize: 22,
          cursor: 'pointer',
          color: '#94a3b8',
        }}
      >
        ×
      </button>
    </div>
  );
}

function DialogFooter({
  saving,
  editing,
  onClose,
  aiBusy,
}: {
  saving: boolean;
  editing: boolean;
  onClose: () => void;
  aiBusy: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        position: 'sticky',
        bottom: 0,
        background: '#fff',
        paddingTop: 8,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          padding: '9px 14px',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          background: '#fff',
          cursor: 'pointer',
        }}
      >
        取消
      </button>
      <button
        type="submit"
        disabled={saving || aiBusy}
        style={primaryBtn}
      >
        {saving ? '保存中…' : editing ? '保存' : '创建'}
      </button>
    </div>
  );
}

function FieldWithAi({
  label,
  aiLabel,
  aiBusy,
  onAi,
  disabled,
  children,
}: {
  label: string;
  aiLabel: string;
  aiBusy: boolean;
  onAi: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={labelStyle}>
      <span
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {label}
        <button
          type="button"
          disabled={disabled || aiBusy}
          onClick={onAi}
          style={{
            ...aiBtn,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {aiBusy ? '…' : `✨ AI ${aiLabel}`}
        </button>
      </span>
      {children}
    </label>
  );
}

function Section({
  title,
  badge,
  badgeTone,
  children,
}: {
  title: string;
  badge: string;
  badgeTone?: 'warn';
  children: React.ReactNode;
}) {
  return (
    <section style={sectionCard}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ fontSize: 15, color: '#0f172a' }}>{title}</strong>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 999,
            padding: '2px 8px',
            background: badgeTone === 'warn' ? '#fff7ed' : '#ecfdf5',
            color: badgeTone === 'warn' ? '#c2410c' : '#047857',
          }}
        >
          {badge}
        </span>
      </div>
      {children}
    </section>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  emptyHint,
  manageHref,
  manageLabel,
}: {
  label: string;
  options: Named[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyHint: string;
  manageHref: string;
  manageLabel: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
          {label}
        </span>
        <Link
          href={manageHref}
          style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}
        >
          {manageLabel} →
        </Link>
      </div>
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          maxHeight: 140,
          overflow: 'auto',
          padding: options.length ? 8 : 12,
          background: '#fff',
        }}
      >
        {options.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>{emptyHint}</div>
        ) : (
          options.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <label
                key={opt.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  padding: '6px 4px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((id) => id !== opt.id)
                        : [...selected, opt.id],
                    )
                  }
                />
                {opt.name}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
