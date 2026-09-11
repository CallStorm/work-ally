'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { AssetImg } from './asset-img';
import { ModelPicker } from './model-picker';
import type {
  ImageStudioAsset,
  ImageStudioProject,
  ImageStudioPublicModel,
  ImageStudioTurn,
} from './types';

type Props = {
  projectId: string;
  onBack: () => void;
  onProjectUpdated?: (project: ImageStudioProject) => void;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollTurn(turnId: string): Promise<ImageStudioTurn> {
  for (let i = 0; i < 120; i++) {
    const turn = await apiFetch<ImageStudioTurn>(
      `/apps/image-studio/turns/${turnId}`,
    );
    if (turn.status !== 'running') return turn;
    await sleep(1000);
  }
  throw new Error('生成超时，请稍后刷新查看');
}

function statusLabel(status: string): string {
  switch (status) {
    case 'running':
      return '生成中';
    case 'done':
      return '完成';
    case 'failed':
      return '失败';
    default:
      return status;
  }
}

export function Workspace({ projectId, onBack, onProjectUpdated }: Props) {
  const [project, setProject] = useState<ImageStudioProject | null>(null);
  const [models, setModels] = useState<ImageStudioPublicModel[]>([]);
  const [turns, setTurns] = useState<ImageStudioTurn[]>([]);
  const [modelId, setModelId] = useState('');
  const [n, setN] = useState(1);
  const [prompt, setPrompt] = useState('');
  const [useCurrentAsSource, setUseCurrentAsSource] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeTurnStatus, setActiveTurnStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const turnsEndRef = useRef<HTMLDivElement>(null);
  const onProjectUpdatedRef = useRef(onProjectUpdated);
  onProjectUpdatedRef.current = onProjectUpdated;

  const applyProject = useCallback((next: ImageStudioProject) => {
    setProject(next);
    onProjectUpdatedRef.current?.(next);
  }, []);

  const refresh = useCallback(async () => {
    const [proj, turnList] = await Promise.all([
      apiFetch<ImageStudioProject>(`/apps/image-studio/projects/${projectId}`),
      apiFetch<ImageStudioTurn[]>(
        `/apps/image-studio/projects/${projectId}/turns`,
      ),
    ]);
    applyProject(proj);
    setTurns(turnList);
    return proj;
  }, [projectId, applyProject]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [proj, turnList, modelList] = await Promise.all([
          apiFetch<ImageStudioProject>(
            `/apps/image-studio/projects/${projectId}`,
          ),
          apiFetch<ImageStudioTurn[]>(
            `/apps/image-studio/projects/${projectId}/turns`,
          ),
          apiFetch<ImageStudioPublicModel[]>('/apps/image-studio/models'),
        ]);
        if (cancelled) return;
        applyProject(proj);
        setTurns(turnList);
        const enabled = modelList.filter((m) => m.enabled);
        setModels(enabled);
        const preferred =
          (proj.defaultModelId &&
            enabled.find((m) => m.id === proj.defaultModelId)?.id) ||
          enabled.find((m) => m.isDefault)?.id ||
          enabled[0]?.id ||
          '';
        setModelId(preferred);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : '加载工作台失败，请稍后重试',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, applyProject]);

  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, generating]);

  async function handleGenerate() {
    const text = prompt.trim();
    if (!text || generating || !modelId) return;
    setGenerating(true);
    setActiveTurnStatus('running');
    setError(null);
    try {
      const sourceAssetId =
        useCurrentAsSource && project?.currentAssetId
          ? project.currentAssetId
          : null;
      const started = await apiFetch<ImageStudioTurn>(
        `/apps/image-studio/projects/${projectId}/generate`,
        {
          method: 'POST',
          body: JSON.stringify({
            prompt: text,
            modelId,
            n,
            sourceAssetId,
          }),
        },
      );
      setActiveTurnStatus(started.status);
      const finished =
        started.status === 'running' ? await pollTurn(started.id) : started;
      setActiveTurnStatus(finished.status);
      if (finished.status === 'failed') {
        setError(finished.errorMessage || '生成失败');
      } else {
        setPrompt('');
      }
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '生成失败，请稍后重试',
      );
      try {
        await refresh();
      } catch {
        // ignore refresh failure after generate/timeout error
      }
    } finally {
      setGenerating(false);
      setActiveTurnStatus(null);
    }
  }

  async function handleSelect(assetId: string) {
    if (generating) return;
    try {
      const updated = await apiFetch<ImageStudioProject>(
        `/apps/image-studio/projects/${projectId}/assets/${assetId}/select`,
        { method: 'POST' },
      );
      applyProject(updated);
      setTurns((prev) =>
        prev.map((turn) => ({
          ...turn,
          assets: turn.assets.map((a) => ({
            ...a,
            selected: a.id === assetId,
          })),
        })),
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '选择失败');
    }
  }

  async function handleUpload(file: File) {
    if (uploading || generating) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const asset = await apiFetch<ImageStudioAsset>(
        `/apps/image-studio/projects/${projectId}/upload`,
        { method: 'POST', body: form },
      );
      const updated = await apiFetch<ImageStudioProject>(
        `/apps/image-studio/projects/${projectId}/assets/${asset.id}/select`,
        { method: 'POST' },
      );
      applyProject(updated);
      setUseCurrentAsSource(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) {
    return (
      <div className="image-studio-workspace">
        <p className="image-studio-library__status">正在打开工作台…</p>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="image-studio-workspace">
        <div className="image-studio-workspace__top">
          <button type="button" className="image-studio-btn" onClick={onBack}>
            ← 返回项目库
          </button>
        </div>
        <div className="image-studio-library__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => window.location.reload()}>
            重试
          </button>
        </div>
      </div>
    );
  }

  const currentId = project?.currentAssetId ?? null;

  return (
    <div className="image-studio-workspace">
      <header className="image-studio-workspace__top">
        <div className="image-studio-workspace__title">
          <button type="button" className="image-studio-btn" onClick={onBack}>
            ← 返回
          </button>
          <div>
            <p className="image-studio-library__eyebrow">图工作室 · 工作台</p>
            <h1>{project?.name ?? '工作台'}</h1>
          </div>
        </div>
        <ModelPicker
          models={models}
          modelId={modelId}
          onModelChange={setModelId}
          n={n}
          onNChange={setN}
          disabled={generating}
        />
      </header>

      {error && (
        <div className="image-studio-library__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            关闭
          </button>
        </div>
      )}

      <div className="image-studio-workspace__body">
        <aside className="image-studio-workspace__chat">
          <div className="image-studio-workspace__turns">
            {turns.length === 0 && (
              <p className="image-studio-workspace__empty">
                还没有对话。输入提示词开始文生图，或先上传参考图再图生图。
              </p>
            )}
            {turns.map((turn) => (
              <article
                key={turn.id}
                className={`image-studio-turn image-studio-turn--${turn.status}`}
              >
                <div className="image-studio-turn__meta">
                  <span className="image-studio-turn__status">
                    {statusLabel(turn.status)}
                  </span>
                  {turn.sourceAssetId ? (
                    <span className="image-studio-turn__badge">图生图</span>
                  ) : (
                    <span className="image-studio-turn__badge">文生图</span>
                  )}
                </div>
                <p className="image-studio-turn__prompt">{turn.prompt}</p>
                {turn.status === 'failed' && turn.errorMessage && (
                  <p className="image-studio-turn__error">{turn.errorMessage}</p>
                )}
                {turn.assets.length > 0 && (
                  <div className="image-studio-turn__assets">
                    {turn.assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        className={
                          asset.id === currentId
                            ? 'image-studio-turn__thumb is-selected'
                            : 'image-studio-turn__thumb'
                        }
                        onClick={() => void handleSelect(asset.id)}
                        disabled={generating}
                        title="设为当前图"
                        aria-label="选择此图"
                      >
                        <AssetImg assetId={asset.id} />
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {generating && activeTurnStatus && (
              <p className="image-studio-workspace__generating">
                {statusLabel(activeTurnStatus)}…
              </p>
            )}
            <div ref={turnsEndRef} />
          </div>

          <div className="image-studio-workspace__composer">
            {currentId && (
              <label className="image-studio-workspace__source">
                <input
                  type="checkbox"
                  checked={useCurrentAsSource}
                  disabled={generating}
                  onChange={(e) => setUseCurrentAsSource(e.target.checked)}
                />
                <span>使用当前图作为参考（图生图）</span>
              </label>
            )}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想生成的画面…"
              rows={3}
              disabled={generating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleGenerate();
                }
              }}
            />
            <div className="image-studio-workspace__composer-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                }}
              />
              <button
                type="button"
                className="image-studio-btn"
                disabled={generating || uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? '上传中…' : '上传参考图'}
              </button>
              <button
                type="button"
                className="image-studio-btn image-studio-btn--primary"
                disabled={
                  generating || !prompt.trim() || !modelId || models.length === 0
                }
                onClick={() => void handleGenerate()}
              >
                {generating ? '生成中…' : '生成'}
              </button>
            </div>
          </div>
        </aside>

        <section className="image-studio-workspace__canvas" aria-label="画布">
          {currentId ? (
            <div className="image-studio-workspace__stage">
              <AssetImg assetId={currentId} className="image-studio-workspace__hero" />
            </div>
          ) : (
            <div className="image-studio-workspace__placeholder">
              <strong>画布为空</strong>
              <p>生成或上传图片后，当前选中图会显示在这里。</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
