'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export type GroupOption = { id: string; name: string };

type AclState = {
  visibility: 'private' | 'restricted' | 'tenant';
  entries: Array<{ principalType: string; principalId: string }>;
};

export function expertVisibilityLabel(
  visibility: string,
  groupCount?: number,
): string {
  if (visibility === 'tenant') return '全公司';
  if (visibility === 'restricted') {
    return groupCount != null && groupCount > 0
      ? `指定组（${groupCount}）`
      : '指定组';
  }
  return '仅管理员';
}

export function ExpertGroupShareDialog({
  expertId,
  expertName,
  onClose,
  onSaved,
}: {
  expertId: string;
  expertName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [groupList, acl] = await Promise.all([
        apiFetch<GroupOption[]>('/groups'),
        apiFetch<AclState>(`/resources/experts/${expertId}/acl`),
      ]);
      setGroups(groupList.map((g) => ({ id: g.id, name: g.name })));
      if (acl.visibility === 'restricted') {
        setSelected(
          acl.entries
            .filter((e) => e.principalType === 'group')
            .map((e) => e.principalId),
        );
      }
    })().catch((e) => setError(e.message));
  }, [expertId]);

  async function save() {
    if (selected.length === 0) {
      setError('请至少选择一个组');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/resources/experts/${expertId}/acl`, {
        method: 'PUT',
        body: JSON.stringify({
          visibility: 'restricted',
          entries: selected.map((groupId) => ({
            principalType: 'group',
            principalId: groupId,
          })),
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        <strong>按组分享 — {expertName}</strong>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          仅所选组内的成员可在工作台看到并使用该专家。
        </p>
        <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflow: 'auto' }}>
          {groups.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              暂无工作组，请先在「成员与组」中创建。
            </div>
          )}
          {groups.map((g) => (
            <label
              key={g.id}
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <input
                type="checkbox"
                checked={selected.includes(g.id)}
                onChange={() =>
                  setSelected((cur) =>
                    cur.includes(g.id)
                      ? cur.filter((x) => x !== g.id)
                      : [...cur, g.id],
                  )
                }
              />
              {g.name}
            </label>
          ))}
        </div>
        {error && <div style={{ color: '#b42318', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            style={primaryBtn}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

export async function setExpertVisibility(
  expertId: string,
  visibility: 'private' | 'tenant',
) {
  await apiFetch(`/resources/experts/${expertId}/acl`, {
    method: 'PUT',
    body: JSON.stringify({ visibility, entries: [] }),
  });
}

const overlayStyle = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 50,
};

const panelStyle = {
  width: 'min(440px, 92vw)',
  background: '#fff',
  borderRadius: 16,
  border: '1px solid var(--line)',
  padding: 20,
  display: 'grid',
  gap: 12,
};

const primaryBtn = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 16px',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const ghostBtn = {
  border: 'none',
  background: 'transparent',
  color: 'var(--accent)',
  cursor: 'pointer',
  padding: '10px 12px',
} as const;
