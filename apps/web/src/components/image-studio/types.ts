export type ImageStudioProject = {
  id: string;
  name: string;
  description: string;
  coverObjectKey: string | null;
  currentAssetId: string | null;
  defaultModelId: string | null;
  starred: boolean;
  workspaceState: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type ImageStudioAspectRatio =
  | '1:1'
  | '16:9'
  | '4:3'
  | '3:2'
  | '2:3'
  | '3:4'
  | '9:16'
  | '21:9';

export type ImageStudioOverlayPosition = 'top' | 'center' | 'bottom';

export type ImageStudioPublicModel = {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  capabilities: {
    textToImage?: boolean;
    imageToImage?: boolean;
  };
  isDefault: boolean;
  enabled: boolean;
};

export type ImageStudioAsset = {
  id: string;
  projectId: string;
  turnId: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  selected: boolean;
  createdAt: string;
};

export type ImageStudioTurn = {
  id: string;
  projectId: string;
  parentTurnId: string | null;
  prompt: string;
  modelId: string;
  sourceAssetId: string | null;
  status: 'running' | 'done' | 'failed' | string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  assets: ImageStudioAsset[];
};

export type ImageStudioView = 'library' | 'workspace';

export type ProjectLibraryFilter = 'all' | 'starred';

export function filterProjects(
  projects: ImageStudioProject[],
  query: string,
  filter: ProjectLibraryFilter,
): ImageStudioProject[] {
  const q = query.trim().toLowerCase();
  return projects.filter((project) => {
    if (filter === 'starred' && !project.starred) return false;
    if (!q) return true;
    return (
      project.name.toLowerCase().includes(q) ||
      project.description.toLowerCase().includes(q)
    );
  });
}

export function projectCoverUrl(
  project: ImageStudioProject,
  apiBase: string,
  accessToken: string | null | undefined,
): string | null {
  if (!project.currentAssetId) return null;
  const path = `${apiBase}/apps/image-studio/assets/${project.currentAssetId}/content`;
  if (!accessToken) return path;
  return `${path}?access_token=${encodeURIComponent(accessToken)}`;
}

export function formatProjectUpdated(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
