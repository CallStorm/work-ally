'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { BazaarCompany, BazaarStallSkin } from './types';
import { BAZAAR_STALL_SKINS, BAZAAR_STALL_SKIN_LABELS } from './types';

type Props = {
  onCreated: (company: BazaarCompany) => void;
};

const NAME_MAX = 64;
const SLOGAN_MAX = 120;

export function OnboardingCompany({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [stallSkin, setStallSkin] = useState<BazaarStallSkin>('neon-blue');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
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

    setSubmitting(true);
    setError(null);
    try {
      const created = await apiFetch<BazaarCompany>('/apps/bazaar/company', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          slogan: slogan.trim(),
          stallSkin,
        }),
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : '开设公司失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bazaar-onboarding">
      <div className="bazaar-onboarding__panel">
        <p className="bazaar-onboarding__kicker">创司集市</p>
        <h1>开设你的公司</h1>
        <p className="bazaar-onboarding__lead">
          起一个名字、一句口号，选好摊位皮肤。一人一司，先开张再摆摊。
        </p>
        {error && (
          <div className="bazaar-app__error" role="alert">
            {error}
          </div>
        )}
        <form className="bazaar-onboarding__form" onSubmit={handleSubmit}>
          <label className="bazaar-field">
            公司名
            <input
              type="text"
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：星火工坊"
              autoComplete="off"
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
              placeholder="一句话介绍你们在卖什么脑洞"
              autoComplete="off"
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
          <button
            type="submit"
            className="bazaar-btn bazaar-btn--primary"
            disabled={submitting || !name.trim()}
          >
            {submitting ? '开设中…' : '开设公司，进入展会'}
          </button>
        </form>
      </div>
    </div>
  );
}
