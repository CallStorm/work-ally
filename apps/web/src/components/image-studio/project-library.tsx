'use client';

import { useMemo, useState } from 'react';
import { getApiBase, getToken } from '@/lib/api';
import {
  filterProjects,
  formatProjectUpdated,
  projectCoverUrl,
  type ImageStudioProject,
  type ProjectLibraryFilter,
} from './types';

type Props = {
  projects: ImageStudioProject[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (id: string) => void;
  onCreate: (input: { name: string; description: string }) => Promise<void>;
  onToggleStar: (project: ImageStudioProject) => Promise<void>;
  onRename: (project: ImageStudioProject, name: string) => Promise<void>;
  onDelete: (project: ImageStudioProject) => Promise<void>;
};

export function ProjectLibrary({
  projects,
  loading,
  error,
  onRetry,
  onOpen,
  onCreate,
  onToggleStar,
  onRename,
  onDelete,
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectLibraryFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(
    () => filterProjects(projects, query, filter),
    [projects, query, filter],
  );

  const starredCount = projects.filter((p) => p.starred).length;
  const apiBase = getApiBase();
  const token = getToken();

  async function submitCreate() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim() });
      setCreateOpen(false);
      setName('');
      setDescription('');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  async function runAction(
    id: string,
    action: () => Promise<void>,
  ): Promise<void> {
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="image-studio-library">
      <header className="image-studio-library__top">
        <div>
          <p className="image-studio-library__eyebrow">图工作室 · 项目库</p>
          <h1>我的项目</h1>
        </div>
        <button
          type="button"
          className="image-studio-btn image-studio-btn--primary"
          onClick={() => setCreateOpen(true)}
        >
          新建项目
        </button>
      </header>

      <div className="image-studio-library__toolbar">
        <div className="image-studio-library__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={
              filter === 'all'
                ? 'image-studio-library__tab is-active'
                : 'image-studio-library__tab'
            }
            onClick={() => setFilter('all')}
          >
            全部项目 <span>{projects.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'starred'}
            className={
              filter === 'starred'
                ? 'image-studio-library__tab is-active'
                : 'image-studio-library__tab'
            }
            onClick={() => setFilter('starred')}
          >
            已收藏 <span>{starredCount}</span>
          </button>
        </div>
        <label className="image-studio-library__search">
          <span className="sr-only">搜索项目</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索项目"
            aria-label="搜索项目"
          />
        </label>
      </div>

      {error && (
        <div className="image-studio-library__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRetry}>
            重试
          </button>
        </div>
      )}

      {loading ? (
        <p className="image-studio-library__status">正在加载项目…</p>
      ) : (
        <div className="image-studio-library__grid">
          <button
            type="button"
            className="image-studio-library__new-card"
            onClick={() => setCreateOpen(true)}
          >
            <span className="image-studio-library__new-plus" aria-hidden>
              +
            </span>
            <strong>创建新项目</strong>
            <small>开始一段新的图片创作</small>
          </button>

          {visible.map((project, index) => {
            const cover = projectCoverUrl(project, apiBase, token);
            const fallbackClass = `image-studio-library__cover-fallback image-studio-library__cover-fallback--${index % 4}`;
            return (
              <article key={project.id} className="image-studio-library__card">
                <button
                  type="button"
                  className="image-studio-library__open"
                  onClick={() => onOpen(project.id)}
                  aria-label={`打开${project.name}`}
                >
                  <div
                    className={
                      cover
                        ? 'image-studio-library__cover has-image'
                        : `image-studio-library__cover ${fallbackClass}`
                    }
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" />
                    ) : (
                      <>
                        <span className="image-studio-library__orb image-studio-library__orb--one" />
                        <span className="image-studio-library__orb image-studio-library__orb--two" />
                      </>
                    )}
                  </div>
                  <div className="image-studio-library__info">
                    <div>
                      <h2>{project.name}</h2>
                      <p>
                        {project.description.trim() || '暂无描述'} ·{' '}
                        {formatProjectUpdated(project.updatedAt)}
                      </p>
                    </div>
                  </div>
                </button>
                <div className="image-studio-library__actions">
                  <button
                    type="button"
                    title={project.starred ? '取消收藏' : '收藏'}
                    disabled={busyId === project.id}
                    onClick={() =>
                      void runAction(project.id, () => onToggleStar(project))
                    }
                  >
                    {project.starred ? '★' : '☆'}
                  </button>
                  <button
                    type="button"
                    title="改名"
                    disabled={busyId === project.id}
                    onClick={() => {
                      const next = window.prompt('项目名称', project.name);
                      if (!next?.trim() || next.trim() === project.name) return;
                      void runAction(project.id, () =>
                        onRename(project, next.trim()),
                      );
                    }}
                  >
                    改名
                  </button>
                  <button
                    type="button"
                    className="image-studio-library__danger"
                    title="删除"
                    disabled={busyId === project.id}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `确定删除「${project.name}」吗？项目将移入回收状态。`,
                        )
                      ) {
                        return;
                      }
                      void runAction(project.id, () => onDelete(project));
                    }}
                  >
                    删除
                  </button>
                </div>
              </article>
            );
          })}

          {!visible.length && projects.length > 0 && (
            <p className="image-studio-library__status image-studio-library__status--span">
              没有找到匹配的项目
            </p>
          )}

          {!projects.length && !error && (
            <p className="image-studio-library__status image-studio-library__status--span">
              还没有项目，点击「创建新项目」开始。
            </p>
          )}
        </div>
      )}

      {createOpen && (
        <div
          className="image-studio-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-studio-create-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <div className="image-studio-modal__card">
            <div className="image-studio-modal__head">
              <div>
                <p className="image-studio-library__eyebrow">NEW PROJECT</p>
                <h2 id="image-studio-create-title">创建新项目</h2>
              </div>
              <button
                type="button"
                className="image-studio-modal__close"
                aria-label="关闭"
                onClick={() => setCreateOpen(false)}
              >
                ×
              </button>
            </div>
            <label className="image-studio-field">
              <span>项目名称 *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：夏季宣传海报"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitCreate();
                }}
              />
            </label>
            <label className="image-studio-field">
              <span>项目描述</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简单说明这个项目要完成什么"
                rows={3}
              />
            </label>
            <div className="image-studio-modal__hint">
              <strong>自动保存</strong>
              <p>创建后可进入工作台进行文生图 / 图生图创作。</p>
            </div>
            <div className="image-studio-modal__actions">
              <button
                type="button"
                className="image-studio-btn"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="image-studio-btn image-studio-btn--primary"
                disabled={!name.trim() || creating}
                onClick={() => void submitCreate()}
              >
                {creating ? '正在创建…' : '创建并进入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
