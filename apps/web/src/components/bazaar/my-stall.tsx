'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ProductEditor } from './product-editor';
import type {
  BazaarCompany,
  BazaarProduct,
  BazaarProductHint,
  BazaarStallSkin,
} from './types';
import {
  BAZAAR_SHELF_LIMIT,
  BAZAAR_STALL_SKIN_LABELS,
  BAZAAR_STALL_SKINS,
  bazaarCoverStyle,
} from './types';

type Props = {
  company: BazaarCompany;
  onCompanyChange: (company: BazaarCompany) => void;
  onOpenProduct: (productId: string, hint?: BazaarProductHint) => void;
};

type EditorState =
  | { product: BazaarProduct | null; autoPolish: boolean }
  | null;

const NAME_MAX = 64;
const SLOGAN_MAX = 120;

export function MyStall({ company, onCompanyChange, onOpenProduct }: Props) {
  const { auth } = useAuth();
  const [products, setProducts] = useState<BazaarProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [editingCompany, setEditingCompany] = useState(false);
  const [name, setName] = useState(company.name);
  const [slogan, setSlogan] = useState(company.slogan);
  const [stallSkin, setStallSkin] = useState<BazaarStallSkin>(company.stallSkin);
  const [savingCompany, setSavingCompany] = useState(false);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    setName(company.name);
    setSlogan(company.slogan);
    setStallSkin(company.stallSkin);
  }, [company]);

  const loadProducts = useCallback(async () => {
    const requestId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await apiFetch<BazaarProduct[]>('/apps/bazaar/products');
      if (requestId !== fetchIdRef.current) return;
      setProducts(next);
    } catch (err) {
      if (requestId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : '加载货架失败');
    } finally {
      if (requestId === fetchIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const publishedCount = products.filter(
    (item) => item.status === 'published',
  ).length;

  function upsertProduct(next: BazaarProduct) {
    setProducts((current) => {
      const index = current.findIndex((item) => item.id === next.id);
      if (index === -1) return [next, ...current];
      const copy = current.slice();
      copy[index] = next;
      return copy;
    });
  }

  async function togglePublish(item: BazaarProduct) {
    const path =
      item.status === 'published'
        ? `/apps/bazaar/products/${item.id}/unpublish`
        : `/apps/bazaar/products/${item.id}/publish`;
    setBusyId(item.id);
    setError(null);
    try {
      const next = await apiFetch<BazaarProduct>(path, { method: 'POST' });
      upsertProduct(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新上架状态失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCompanySave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('请填写公司名');
      return;
    }
    if (trimmedName.length > NAME_MAX) {
      setError(`公司名不超过 ${NAME_MAX} 字`);
      return;
    }
    if (slogan.trim().length > SLOGAN_MAX) {
      setError(`口号不超过 ${SLOGAN_MAX} 字`);
      return;
    }
    setSavingCompany(true);
    setError(null);
    try {
      const next = await apiFetch<BazaarCompany>('/apps/bazaar/company', {
        method: 'PATCH',
        body: JSON.stringify({
          name: trimmedName,
          slogan: slogan.trim(),
          stallSkin,
        }),
      });
      onCompanyChange(next);
      setEditingCompany(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新公司失败');
    } finally {
      setSavingCompany(false);
    }
  }

  const userName = auth?.user.name?.trim() || '';

  return (
    <div className="bazaar-stall">
      <section
        className={`bazaar-stall__company bazaar-stall__company--${company.stallSkin}`}
      >
        <div
          className={`bazaar-stall__avatar bazaar-stall__avatar--${company.stallSkin}`}
          aria-hidden
        />
        <div className="bazaar-stall__company-copy">
          <h1>{company.name}</h1>
          <p>
            {company.slogan || '还没有口号'}
            {userName ? ` · ${userName}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="bazaar-btn bazaar-btn--ghost"
          onClick={() => setEditingCompany((open) => !open)}
        >
          编辑公司
        </button>
      </section>

      {editingCompany && (
        <form className="bazaar-stall__company-form" onSubmit={handleCompanySave}>
          <label className="bazaar-field">
            公司名
            <input
              type="text"
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="bazaar-field">
            口号
            <input
              type="text"
              value={slogan}
              maxLength={SLOGAN_MAX}
              onChange={(e) => setSlogan(e.target.value)}
            />
          </label>
          <fieldset className="bazaar-field bazaar-skin-picker">
            <legend>摊位皮肤</legend>
            <div className="bazaar-skin-picker__grid">
              {BAZAAR_STALL_SKINS.map((skin) => (
                <label
                  key={skin}
                  className={[
                    'bazaar-skin-picker__option',
                    `bazaar-skin-picker__option--${skin}`,
                    stallSkin === skin ? 'is-selected' : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <input
                    type="radio"
                    name="stallSkin"
                    value={skin}
                    checked={stallSkin === skin}
                    onChange={() => setStallSkin(skin)}
                  />
                  <span className="bazaar-skin-picker__swatch" aria-hidden />
                  {BAZAAR_STALL_SKIN_LABELS[skin]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="bazaar-editor__actions">
            <button
              type="submit"
              className="bazaar-btn bazaar-btn--primary"
              disabled={savingCompany || !name.trim()}
            >
              {savingCompany ? '保存中…' : '保存公司'}
            </button>
            <button
              type="button"
              className="bazaar-btn bazaar-btn--ghost"
              onClick={() => setEditingCompany(false)}
            >
              取消
            </button>
          </div>
        </form>
      )}

      <p className="bazaar-stall__shelf">
        货架 {publishedCount} / {BAZAAR_SHELF_LIMIT}
      </p>

      {error && (
        <div className="bazaar-app__error" role="alert">
          {error}
        </div>
      )}
      {loading && <div className="bazaar-app__empty">加载货架…</div>}

      {!loading && (
        <ul className="bazaar-stall__grid">
          {products.map((item) => (
            <li key={item.id}>
              <article className="bazaar-stall-card">
                <button
                  type="button"
                  className="bazaar-stall-card__cover bazaar-stall-card__cover--btn"
                  style={bazaarCoverStyle(item.coverHue)}
                  onClick={() =>
                    onOpenProduct(item.id, { companyName: company.name })
                  }
                  aria-label={`查看产品 ${item.title}`}
                />
                <h2>
                  <button
                    type="button"
                    className="bazaar-card__title"
                    onClick={() =>
                      onOpenProduct(item.id, { companyName: company.name })
                    }
                  >
                    {item.title}
                  </button>
                </h2>
                <p className="bazaar-stall-card__meta">
                  {item.status === 'published' ? '已上架' : '草稿'}
                  {item.status === 'published' ? ` · ${item.score}分` : ''}
                </p>
                <div className="bazaar-stall-card__actions">
                  <button
                    type="button"
                    className="bazaar-btn bazaar-btn--sm"
                    onClick={() =>
                      setEditor({ product: item, autoPolish: false })
                    }
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="bazaar-btn bazaar-btn--sm"
                    disabled={busyId === item.id}
                    onClick={() => void togglePublish(item)}
                  >
                    {item.status === 'published' ? '下架' : '上架'}
                  </button>
                  <button
                    type="button"
                    className="bazaar-btn bazaar-btn--sm bazaar-btn--primary"
                    onClick={() =>
                      setEditor({ product: item, autoPolish: true })
                    }
                  >
                    AI 润色
                  </button>
                </div>
              </article>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="bazaar-stall__empty"
              onClick={() => setEditor({ product: null, autoPolish: false })}
            >
              + 新建产品卡片
            </button>
          </li>
        </ul>
      )}

      {editor && (
        <ProductEditor
          product={editor.product}
          autoPolish={editor.autoPolish}
          onClose={() => setEditor(null)}
          onSaved={(saved) => {
            upsertProduct(saved);
          }}
        />
      )}
    </div>
  );
}
