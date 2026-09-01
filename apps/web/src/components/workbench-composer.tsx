'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ComposerAddons from '@/components/composer-addons';
import ModelSelect from '@/components/model-select';
import { apiFetch } from '@/lib/api';
import { useAttachmentUpload } from '@/lib/attachments';
import { useAuth } from '@/lib/auth';
import { useCurrentGroup } from '@/lib/group-context';

type Expert = {
  id: string;
  name: string;
  avatarUrl: string | null;
  suggestedPrompts: string[];
  skillIds: string[];
  connectorIds: string[];
};

type Skill = {
  id: string;
  name: string;
  slug: string;
  descriptionShort: string;
  status: string;
};

type Connector = {
  id: string;
  name: string;
  status: string;
};

type ModelOption = {
  id: string;
  modelId: string;
  displayName: string;
};

type DefaultAgent = {
  suggestedPrompts: string[];
};

export default function WorkbenchComposer() {
  const { auth, ready } = useAuth();
  const { currentGroupId } = useCurrentGroup();
  const router = useRouter();
  const search = useSearchParams();
  const preselectExpertId = search.get('expertId');

  const [experts, setExperts] = useState<Expert[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [defaultPrompts, setDefaultPrompts] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [modelConfigId, setModelConfigId] = useState('');
  const [selectedExpertId, setSelectedExpertId] = useState<string | null>(
    null,
  );
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [connectorIds, setConnectorIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const upload = useAttachmentUpload();

  const hasUploading = upload.items.some((item) => item.status === 'uploading');
  const canSend =
    (content.trim().length > 0 || upload.attachmentIds.length > 0) &&
    !hasUploading;

  const selectedExpert = useMemo(
    () => experts.find((e) => e.id === selectedExpertId) ?? null,
    [experts, selectedExpertId],
  );

  const suggested = useMemo(() => {
    if (selectedExpert) {
      return selectedExpert.suggestedPrompts?.length
        ? selectedExpert.suggestedPrompts
        : [
            `用「${selectedExpert.name}」视角帮我拆解这个问题`,
            '输出一页可执行结论',
            '列出风险与下一步',
          ];
    }
    return defaultPrompts;
  }, [selectedExpert, defaultPrompts]);

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    (async () => {
      setLoadingAssets(true);
      try {
        const [expertList, skillList, connectorList, modelList, defaultAgent] =
          await Promise.all([
            apiFetch<Expert[]>('/experts?sort=recent_used'),
            apiFetch<Skill[]>('/skills'),
            apiFetch<Connector[]>('/connectors'),
            apiFetch<ModelOption[]>('/models'),
            apiFetch<DefaultAgent>('/default-agent').catch(() => null),
          ]);
        if (cancelled) return;
        setExperts(expertList);
        setSkills(skillList);
        setConnectors(connectorList);
        setModels(modelList);
        setDefaultPrompts(defaultAgent?.suggestedPrompts ?? []);
        if (modelList.length > 0) {
          setModelConfigId(modelList[0].id);
        } else {
          setModelConfigId('');
        }
        if (
          preselectExpertId &&
          expertList.some((e) => e.id === preselectExpertId)
        ) {
          const expert = expertList.find((e) => e.id === preselectExpertId)!;
          setSelectedExpertId(preselectExpertId);
          setSkillIds(expert.skillIds ?? []);
          setConnectorIds(expert.connectorIds ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载资源失败');
        }
      } finally {
        if (!cancelled) setLoadingAssets(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, preselectExpertId]);

  function appendSuggested(text: string) {
    setContent((cur) => {
      const trimmed = cur.trim();
      if (!trimmed) return text;
      return `${trimmed}\n\n${text}`;
    });
  }

  async function send() {
    if (!currentGroupId) {
      setError('请先选择工作组');
      return;
    }
    const text = content.trim();
    if (!text && upload.attachmentIds.length === 0) return;
    if (!modelConfigId) {
      setError('请先在管理后台配置并启用模型');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const created = await apiFetch<{
        sessionId: string;
        runId: string;
      }>('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          groupId: currentGroupId,
          expertId: selectedExpertId,
          modelConfigId,
          content: text || '请结合附件回答',
          attachmentIds: upload.attachmentIds,
          wait: false,
          context: {
            skillIds,
            connectorIds,
            knowledgeEnabled: false,
            knowledgeIds: [],
          },
        }),
      });
      router.push(
        `/workbench/sessions/${created.sessionId}?runId=${created.runId}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
      setSending(false);
    }
  }

  if (!ready || !auth) {
    return (
      <main style={{ padding: 40, color: 'var(--muted)' }}>加载中…</main>
    );
  }

  return (
    <main
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: 'min(860px, 100%)' }}>
        <h1 className="workbench-composer__title">WorkAlly，我帮你</h1>

        {suggested.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            {suggested.map((item) => (
              <button
                key={item}
                type="button"
                className="workbench-composer__prompt"
                onClick={() => appendSuggested(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        <div className="workbench-composer__card">
          <ComposerAddons
            experts={experts}
            skills={skills}
            connectors={connectors}
            expertId={selectedExpertId}
            skillIds={skillIds}
            connectorIds={connectorIds}
            onExpertChange={(id) => {
              setSelectedExpertId(id);
            }}
            onSkillIdsChange={setSkillIds}
            onConnectorIdsChange={setConnectorIds}
            loading={loadingAssets}
            attachmentItems={upload.items}
            onAttachmentAdd={upload.addFiles}
            onAttachmentRemove={upload.remove}
            footer={
              <>
                <ModelSelect
                  models={models}
                  value={modelConfigId}
                  onChange={setModelConfigId}
                  disabled={loadingAssets}
                />
                <button
                  type="button"
                  className="workbench-composer__send"
                  onClick={() => void send()}
                  disabled={sending || !canSend}
                  aria-label="发送"
                >
                  ↑
                </button>
              </>
            }
          >
            <textarea
              className="workbench-composer__input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="今天帮你做些什么？"
              style={{ minHeight: 88 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </ComposerAddons>
        </div>

        {!loadingAssets && experts.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 12 }}>
            暂无可用专家。
            {auth.user.role === 'admin' && (
              <>
                去{' '}
                <Link href="/admin/experts" style={{ color: 'var(--accent)' }}>
                  管理后台创建
                </Link>
              </>
            )}
          </p>
        )}

        {error && (
          <p style={{ color: '#b42318', marginTop: 12 }}>{error}</p>
        )}
        {upload.error && (
          <p style={{ color: '#b42318', marginTop: 12 }}>{upload.error}</p>
        )}
      </div>
    </main>
  );
}
