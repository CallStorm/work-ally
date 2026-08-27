'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CreateMemberSchema } from '@work-ally/shared';

type MemberRow = {
  id: string;
  userId: string;
  phone: string;
  name: string;
  role: 'admin' | 'member';
  status: 'active' | 'disabled' | 'invited';
  groups: { id: string; name: string }[];
};

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  _count: { members: number };
};

const panelStyle = {
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: 16,
  padding: 20,
} as const;

export default function AdminMembersPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'members' | 'groups'>('members');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [groupIds, setGroupIds] = useState<string[]>([]);

  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [manageGroupId, setManageGroupId] = useState<string | null>(null);
  const [manageUserIds, setManageUserIds] = useState<string[]>([]);
  const [resetTarget, setResetTarget] = useState<MemberRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editGroupsMember, setEditGroupsMember] = useState<MemberRow | null>(
    null,
  );
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [savingGroups, setSavingGroups] = useState(false);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members],
  );

  async function refreshMembers() {
    const data = await apiFetch<{ items: MemberRow[] }>('/members');
    setMembers(data.items);
  }

  async function refreshGroups() {
    const data = await apiFetch<GroupRow[]>('/groups');
    setGroups(data);
  }

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    if (auth.user.role !== 'admin') {
      router.replace('/workbench');
      return;
    }
    void Promise.all([refreshMembers(), refreshGroups()]).catch((e) =>
      setError(e.message),
    );
  }, [auth, router]);

  async function onCreateMember(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const parsed = CreateMemberSchema.safeParse({
      phone,
      name,
      password,
      role,
      groupIds,
    });
    if (!parsed.success) {
      setError(parsed.error.errors.map((err) => err.message).join('；'));
      return;
    }

    try {
      await apiFetch('/members', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      setPhone('');
      setName('');
      setPassword('');
      setRole('member');
      setGroupIds([]);
      setMessage('成员已创建，请将初始密码告知对方');
      await refreshMembers();
      await refreshGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function updateMember(
    id: string,
    patch: { role?: 'admin' | 'member'; status?: 'active' | 'disabled'; groupIds?: string[] },
  ) {
    setError(null);
    try {
      await apiFetch(`/members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await refreshMembers();
      await refreshGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    }
  }

  async function onResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setError(null);
    try {
      await apiFetch(`/members/${resetTarget.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });
      setResetTarget(null);
      setNewPassword('');
      setMessage(`已重置 ${resetTarget.name} 的密码`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败');
    }
  }

  async function onCreateGroup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/groups', {
        method: 'POST',
        body: JSON.stringify({ name: groupName, description: groupDesc || undefined }),
      });
      setGroupName('');
      setGroupDesc('');
      await refreshGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建组失败');
    }
  }

  async function deleteGroup(id: string) {
    if (!confirm('确定删除该组？')) return;
    setError(null);
    try {
      await apiFetch(`/groups/${id}`, { method: 'DELETE' });
      await refreshGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  function openManageGroup(group: GroupRow) {
    setManageGroupId(group.id);
    void apiFetch<{ members: { userId: string }[] }>(`/groups/${group.id}`).then(
      (detail) => {
        setManageUserIds(detail.members.map((m) => m.userId));
      },
    );
  }

  async function saveGroupMembers() {
    if (!manageGroupId) return;
    setError(null);
    try {
      await apiFetch(`/groups/${manageGroupId}/members`, {
        method: 'PUT',
        body: JSON.stringify({ userIds: manageUserIds }),
      });
      setManageGroupId(null);
      await refreshGroups();
      await refreshMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  function toggleGroupPick(id: string) {
    setGroupIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  function toggleManageUser(userId: string) {
    setManageUserIds((cur) =>
      cur.includes(userId) ? cur.filter((x) => x !== userId) : [...cur, userId],
    );
  }

  function openEditMemberGroups(member: MemberRow) {
    setEditGroupsMember(member);
    setEditGroupIds(member.groups.map((g) => g.id));
  }

  function toggleEditGroupPick(id: string) {
    setEditGroupIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  async function saveMemberGroups() {
    if (!editGroupsMember) return;
    setSavingGroups(true);
    setError(null);
    try {
      await updateMember(editGroupsMember.id, { groupIds: editGroupIds });
      setEditGroupsMember(null);
      setMessage(`已更新 ${editGroupsMember.name} 的所属组`);
    } catch {
      // updateMember already sets error
    } finally {
      setSavingGroups(false);
    }
  }

  if (!auth) return null;

  return (
    <main style={{ padding: 28, display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ margin: '0 0 6px' }}>成员与组</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          管理员直接录入成员、分配角色与组。手机号全平台唯一。
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(['members', 'groups'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: '8px 16px',
              background: tab === key ? 'var(--accent)' : '#fff',
              color: tab === key ? '#fff' : 'inherit',
              cursor: 'pointer',
            }}
          >
            {key === 'members' ? '成员' : '组'}
          </button>
        ))}
      </div>

      {error && <div style={{ color: '#b42318' }}>{error}</div>}
      {message && <div style={{ color: '#027a48' }}>{message}</div>}

      {tab === 'members' && (
        <>
          <form onSubmit={onCreateMember} style={{ ...panelStyle, display: 'grid', gap: 12 }}>
            <strong>添加成员</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <label style={fieldStyle}>
                <span style={labelStyle}>姓名</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：张力鹏"
                  autoComplete="name"
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>手机号（11位）</span>
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="例如：18392189550"
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>初始密码</span>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>角色</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                  style={inputStyle}
                >
                  <option value="member">成员</option>
                  <option value="admin">管理员</option>
                </select>
              </label>
            </div>
            {groups.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {groups.map((g) => (
                  <label key={g.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={groupIds.includes(g.id)}
                      onChange={() => toggleGroupPick(g.id)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            )}
            <button type="submit" style={primaryBtn}>创建成员</button>
          </form>

          <div style={panelStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                  <th style={thStyle}>姓名</th>
                  <th style={thStyle}>手机号</th>
                  <th style={thStyle}>角色</th>
                  <th style={thStyle}>状态</th>
                  <th style={thStyle}>所属组</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isSelf = m.userId === auth.user.userId;
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={tdStyle}>{m.name}{isSelf ? '（我）' : ''}</td>
                      <td style={tdStyle}>{m.phone}</td>
                      <td style={tdStyle}>
                        <select
                          value={m.role}
                          disabled={isSelf}
                          onChange={(e) =>
                            void updateMember(m.id, {
                              role: e.target.value as 'admin' | 'member',
                            })
                          }
                          style={inputStyle}
                        >
                          <option value="member">成员</option>
                          <option value="admin">管理员</option>
                        </select>
                      </td>
                      <td style={tdStyle}>{m.status === 'active' ? '正常' : '已禁用'}</td>
                      <td style={tdStyle}>
                        <MemberGroupsCell
                          member={m}
                          onEdit={() => openEditMemberGroups(m)}
                        />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" style={linkBtn} onClick={() => setResetTarget(m)}>
                            重置密码
                          </button>
                          {!isSelf && (
                            <button
                              type="button"
                              style={linkBtn}
                              onClick={() =>
                                void updateMember(m.id, {
                                  status: m.status === 'active' ? 'disabled' : 'active',
                                })
                              }
                            >
                              {m.status === 'active' ? '禁用' : '启用'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'groups' && (
        <>
          <form onSubmit={onCreateGroup} style={{ ...panelStyle, display: 'grid', gap: 12 }}>
            <strong>新建组</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
              <input required value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="组名称" style={inputStyle} />
              <input value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} placeholder="描述（可选）" style={inputStyle} />
              <button type="submit" style={primaryBtn}>创建</button>
            </div>
          </form>

          <div style={{ ...panelStyle, display: 'grid', gap: 12 }}>
            {groups.map((g) => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {g.name}
                    {g.isDefault ? '（默认）' : ''}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {g.description || '无描述'} · {g._count.members} 人
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={linkBtn} onClick={() => openManageGroup(g)}>
                    管理成员
                  </button>
                  {!g.isDefault && g._count.members === 0 && (
                    <button type="button" style={{ ...linkBtn, color: '#b42318' }} onClick={() => void deleteGroup(g.id)}>
                      删除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editGroupsMember && (
        <div style={overlayStyle}>
          <div
            style={{
              ...panelStyle,
              width: 'min(440px, 92vw)',
              display: 'grid',
              gap: 12,
            }}
          >
            <strong>编辑所属组 — {editGroupsMember.name}</strong>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              可同时加入多个工作组，成员在工作台可切换当前组。
            </p>
            <div
              style={{
                display: 'grid',
                gap: 8,
                maxHeight: 280,
                overflow: 'auto',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 12,
              }}
            >
              {groups.length === 0 && (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  暂无工作组，请先在「组」Tab 创建。
                </div>
              )}
              {groups.map((g) => (
                <label
                  key={g.id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={editGroupIds.includes(g.id)}
                    onChange={() => toggleEditGroupPick(g.id)}
                  />
                  <span>
                    {g.name}
                    {g.isDefault ? (
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {' '}
                        （默认）
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            {editGroupIds.length === 0 && (
              <div style={{ fontSize: 13, color: '#b45309' }}>
                未选择任何组时，成员将无法在工作台切换组或查看组内会话。
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                style={linkBtn}
                onClick={() => setEditGroupsMember(null)}
              >
                取消
              </button>
              <button
                type="button"
                style={primaryBtn}
                disabled={savingGroups}
                onClick={() => void saveMemberGroups()}
              >
                {savingGroups ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div style={overlayStyle}>
          <form onSubmit={onResetPassword} style={{ ...panelStyle, width: 'min(400px, 92vw)', display: 'grid', gap: 12 }}>
            <strong>重置密码 — {resetTarget.name}</strong>
            <input required type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="新密码" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" style={linkBtn} onClick={() => setResetTarget(null)}>取消</button>
              <button type="submit" style={primaryBtn}>确认重置</button>
            </div>
          </form>
        </div>
      )}

      {manageGroupId && (
        <div style={overlayStyle}>
          <div style={{ ...panelStyle, width: 'min(480px, 92vw)', display: 'grid', gap: 12 }}>
            <strong>管理组成员</strong>
            <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflow: 'auto' }}>
              {activeMembers.map((m) => (
                <label key={m.userId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={manageUserIds.includes(m.userId)}
                    onChange={() => toggleManageUser(m.userId)}
                  />
                  <span>{m.name}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>{m.phone}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" style={linkBtn} onClick={() => setManageGroupId(null)}>取消</button>
              <button type="button" style={primaryBtn} onClick={() => void saveGroupMembers()}>保存</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const inputStyle = {
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '10px 12px',
  font: 'inherit',
  width: '100%',
} as const;

const fieldStyle = {
  display: 'grid',
  gap: 6,
} as const;

const labelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--muted)',
} as const;

const primaryBtn = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 16px',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const linkBtn = {
  border: 'none',
  background: 'transparent',
  color: 'var(--accent)',
  cursor: 'pointer',
  padding: 0,
} as const;

const thStyle = { padding: '10px 8px' } as const;
const tdStyle = { padding: '10px 8px', verticalAlign: 'middle' as const };

const overlayStyle = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 50,
};

function MemberGroupsCell({
  member,
  onEdit,
}: {
  member: MemberRow;
  onEdit: () => void;
}) {
  const readonly = member.status !== 'active';

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {member.groups.length === 0 ? (
        <span style={{ color: 'var(--muted)' }}>未分配</span>
      ) : (
        member.groups.map((g) => (
          <span key={g.id} style={groupChipStyle}>
            {g.name}
          </span>
        ))
      )}
      {!readonly && (
        <button type="button" style={chipEditBtn} onClick={onEdit}>
          编辑
        </button>
      )}
    </div>
  );
}

const groupChipStyle = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  background: '#f1f5f9',
  color: '#334155',
  fontSize: 12,
  lineHeight: 1.5,
} as const;

const chipEditBtn = {
  border: '1px solid var(--line)',
  borderRadius: 999,
  background: '#fff',
  color: 'var(--accent)',
  fontSize: 12,
  padding: '2px 10px',
  cursor: 'pointer',
} as const;
