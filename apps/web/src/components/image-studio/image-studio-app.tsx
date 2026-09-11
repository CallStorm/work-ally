'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ProjectLibrary } from './project-library';
import { Workspace } from './workspace';
import type { ImageStudioProject, ImageStudioView } from './types';

export function ImageStudioApp() {
  const { auth, ready } = useAuth();
  const [view, setView] = useState<ImageStudioView>('library');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ImageStudioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ImageStudioProject[]>(
        '/apps/image-studio/projects',
      );
      setProjects(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : '加载项目失败，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !auth) return;
    void loadProjects();
  }, [ready, auth, loadProjects]);

  function openProject(id: string) {
    setProjectId(id);
    setView('workspace');
  }

  async function createProject(input: {
    name: string;
    description: string;
  }) {
    const created = await apiFetch<ImageStudioProject>(
      '/apps/image-studio/projects',
      {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          description: input.description,
        }),
      },
    );
    setProjects((prev) => [created, ...prev]);
    openProject(created.id);
  }

  async function toggleStar(project: ImageStudioProject) {
    const updated = await apiFetch<ImageStudioProject>(
      `/apps/image-studio/projects/${project.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ starred: !project.starred }),
      },
    );
    setProjects((prev) =>
      prev
        .map((p) => (p.id === updated.id ? updated : p))
        .sort((a, b) => {
          if (a.starred !== b.starred) return a.starred ? -1 : 1;
          return b.updatedAt.localeCompare(a.updatedAt);
        }),
    );
  }

  async function renameProject(project: ImageStudioProject, name: string) {
    const updated = await apiFetch<ImageStudioProject>(
      `/apps/image-studio/projects/${project.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      },
    );
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
  }

  async function deleteProject(project: ImageStudioProject) {
    await apiFetch(`/apps/image-studio/projects/${project.id}`, {
      method: 'DELETE',
    });
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
    if (projectId === project.id) {
      setProjectId(null);
      setView('library');
    }
  }

  const onProjectUpdated = useCallback((updated: ImageStudioProject) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
  }, []);

  if (!ready) {
    return (
      <div className="image-studio-app">
        <p className="image-studio-library__status">加载中…</p>
      </div>
    );
  }

  if (!auth) {
    return (
      <div className="image-studio-app">
        <p className="image-studio-library__status">请先登录后使用图工作室。</p>
      </div>
    );
  }

  if (view === 'workspace' && projectId) {
    return (
      <div className="image-studio-app image-studio-app--workspace">
        <Workspace
          projectId={projectId}
          onBack={() => {
            setView('library');
            setProjectId(null);
            void loadProjects();
          }}
          onProjectUpdated={onProjectUpdated}
        />
      </div>
    );
  }

  return (
    <div className="image-studio-app">
      <ProjectLibrary
        projects={projects}
        loading={loading}
        error={error}
        onRetry={() => void loadProjects()}
        onOpen={openProject}
        onCreate={createProject}
        onToggleStar={toggleStar}
        onRename={renameProject}
        onDelete={deleteProject}
      />
    </div>
  );
}
