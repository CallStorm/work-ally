'use client';

import { getApiBase } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Props = {
  assetId: string;
  alt?: string;
  className?: string;
};

/** Renders asset bytes via same-origin `/api` proxy + `access_token` query. */
export function AssetImg({ assetId, alt = '', className }: Props) {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const base = getApiBase();
  const src = token
    ? `${base}/apps/image-studio/assets/${assetId}/content?access_token=${encodeURIComponent(token)}`
    : `${base}/apps/image-studio/assets/${assetId}/content`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}
