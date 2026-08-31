'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { BazaarProduct } from './types';
import { bazaarCoverStyle } from './types';

type PolishSuggestion = {
  title: string;
  pitch: string;
  features: string[];
};

type Props = {
  product: BazaarProduct | null;
  autoPolish?: boolean;
  onClose: () => void;
  onSaved: (product: BazaarProduct) => void;
};

const TITLE_MAX = 80;
const PITCH_MAX = 2000;
const FEATURE_MAX = 40;
const FEATURE_LIMIT = 8;

export function ProductEditor({
  product,
  autoPolish = false,
  onClose,
  onSaved,
}: Props) {
  const [productId, setProductId] = useState(product?.id ?? null);
  const [title, setTitle] = useState(product?.title ?? '');
  const [pitch, setPitch] = useState(product?.pitch ?? '');
  const [features, setFeatures] = useState<string[]>(product?.features ?? []);
  const [coverHue, setCoverHue] = useState(product?.coverHue ?? 210);
  const [featureInput, setFeatureInput] = useState('');
  const [preview, setPreview] = useState<PolishSuggestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoPolishStarted = useRef(false);

  function addFeature() {
    const value = featureInput.trim();
    if (!value) return;
    if (value.length > FEATURE_MAX) {
      setError(`功能点每条不超过 ${FEATURE_MAX} 字`);
      return;
    }
    if (features.length >= FEATURE_LIMIT) {
      setError(`功能点最多 ${FEATURE_LIMIT} 条`);
      return;
    }
    setError(null);
    setFeatures((current) =>
      current.includes(value) ? current : [...current, value],
    );
    setFeatureInput('');
  }

  function removeFeature(index: number) {
    setFeatures((current) => current.filter((_, i) => i !== index));
  }

  function validate(): { title: string; pitch: string } | null {
    const trimmedTitle = title.trim();
    const trimmedPitch = pitch.trim();
    if (!trimmedTitle) {
      setError('请填写产品名称');
      return null;
    }
    if (trimmedTitle.length > TITLE_MAX) {
      setError(`名称不超过 ${TITLE_MAX} 字`);
      return null;
    }
    if (!trimmedPitch) {
      setError('请填写卖点');
      return null;
    }
    if (trimmedPitch.length > PITCH_MAX) {
      setError(`卖点不超过 ${PITCH_MAX} 字`);
      return null;
    }
    return { title: trimmedTitle, pitch: trimmedPitch };
  }

  async function persist(
    fields: { title: string; pitch: string },
  ): Promise<BazaarProduct> {
    const body = {
      title: fields.title,
      pitch: fields.pitch,
      features,
      coverHue,
    };
    if (productId) {
      return apiFetch<BazaarProduct>(`/apps/bazaar/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    }
    return apiFetch<BazaarProduct>('/apps/bazaar/products', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const fields = validate();
    if (!fields) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await persist(fields);
      setProductId(saved.id);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function runPolish() {
    const fields = validate();
    if (!fields) return;
    setPolishing(true);
    setError(null);
    try {
      let id = productId;
      if (!id) {
        const created = await persist(fields);
        id = created.id;
        setProductId(created.id);
        onSaved(created);
      }
      const suggestion = await apiFetch<PolishSuggestion>(
        `/apps/bazaar/products/${id}/polish`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: fields.title,
            pitch: fields.pitch,
            features,
          }),
        },
      );
      setPreview(suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : '润色失败');
    } finally {
      setPolishing(false);
    }
  }

  async function applyPreview() {
    if (!preview || !productId) return;
    setApplying(true);
    setError(null);
    try {
      const saved = await apiFetch<BazaarProduct>(
        `/apps/bazaar/products/${productId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: preview.title,
            pitch: preview.pitch,
            features: preview.features,
          }),
        },
      );
      setTitle(saved.title);
      setPitch(saved.pitch);
      setFeatures(saved.features);
      setPreview(null);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : '采用润色失败');
    } finally {
      setApplying(false);
    }
  }

  useEffect(() => {
    if (!autoPolish || autoPolishStarted.current || !product?.id) return;
    autoPolishStarted.current = true;
    void runPolish();
  }, [autoPolish, product?.id]);

  const busy = saving || polishing || applying;

  return (
    <div className="bazaar-modal" role="presentation" onClick={onClose}>
      <div
        className="bazaar-modal__dialog bazaar-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bazaar-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bazaar-editor__header">
          <h2 id="bazaar-editor-title">
            {productId ? '编辑产品' : '新建产品卡片'}
          </h2>
          <button type="button" className="bazaar-btn bazaar-btn--ghost" onClick={onClose}>
            关闭
          </button>
        </header>

        <div
          className="bazaar-editor__cover"
          style={bazaarCoverStyle(coverHue)}
          aria-hidden
        />

        {error && (
          <div className="bazaar-app__error" role="alert">
            {error}
          </div>
        )}

        <form className="bazaar-editor__form" onSubmit={handleSave}>
          <label className="bazaar-field">
            名称
            <input
              type="text"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：智能周报助手"
              autoComplete="off"
              required
            />
          </label>
          <label className="bazaar-field">
            卖点
            <textarea
              value={pitch}
              maxLength={PITCH_MAX}
              rows={5}
              onChange={(e) => setPitch(e.target.value)}
              placeholder="一两段话说明它解决什么、怎么用"
              required
            />
          </label>
          <div className="bazaar-field">
            功能点
            <div className="bazaar-chips">
              {features.map((feature, index) => (
                <button
                  key={`${feature}-${index}`}
                  type="button"
                  className="bazaar-chips__chip"
                  onClick={() => removeFeature(index)}
                  aria-label={`移除功能点 ${feature}`}
                >
                  {feature}
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>
            <div className="bazaar-chips__row">
              <input
                type="text"
                value={featureInput}
                maxLength={FEATURE_MAX}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addFeature();
                  }
                }}
                placeholder={`回车添加，最多 ${FEATURE_LIMIT} 条`}
                autoComplete="off"
                disabled={features.length >= FEATURE_LIMIT}
              />
              <button
                type="button"
                className="bazaar-btn"
                onClick={addFeature}
                disabled={features.length >= FEATURE_LIMIT || !featureInput.trim()}
              >
                添加
              </button>
            </div>
          </div>
          <label className="bazaar-field">
            封面色相 {coverHue}
            <input
              type="range"
              min={0}
              max={359}
              value={coverHue}
              onChange={(e) => setCoverHue(Number(e.target.value))}
            />
          </label>
          <div className="bazaar-editor__actions">
            <button
              type="submit"
              className="bazaar-btn bazaar-btn--primary"
              disabled={busy || !title.trim() || !pitch.trim()}
            >
              {saving ? '保存中…' : '保存草稿'}
            </button>
            <button
              type="button"
              className="bazaar-btn"
              onClick={() => void runPolish()}
              disabled={busy || !title.trim() || !pitch.trim()}
            >
              {polishing ? '润色中…' : 'AI 润色'}
            </button>
          </div>
        </form>

        {preview && (
          <section className="bazaar-editor__preview" aria-live="polite">
            <h3>润色建议</h3>
            <p className="bazaar-editor__preview-title">{preview.title}</p>
            <p className="bazaar-editor__preview-pitch">{preview.pitch}</p>
            {preview.features.length > 0 && (
              <ul className="bazaar-editor__preview-features">
                {preview.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            )}
            <div className="bazaar-editor__actions">
              <button
                type="button"
                className="bazaar-btn bazaar-btn--primary"
                onClick={() => void applyPreview()}
                disabled={busy}
              >
                {applying ? '采用中…' : '采用'}
              </button>
              <button
                type="button"
                className="bazaar-btn bazaar-btn--ghost"
                onClick={() => setPreview(null)}
                disabled={busy}
              >
                不用
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
