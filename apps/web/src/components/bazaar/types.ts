import type { BazaarStallSkin } from '@work-ally/shared';

export type { BazaarStallSkin };

export type BazaarView =
  | 'market'
  | 'stall-mine'
  | 'stall-user'
  | 'product'
  | 'leaderboard'
  | 'onboarding';

export type MarketSort = 'newest' | 'hottest';

export type BazaarCompany = {
  id: string;
  name: string;
  slogan: string;
  stallSkin: BazaarStallSkin;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type BazaarProductStatus = 'draft' | 'published';

export type BazaarProduct = {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  pitch: string;
  features: string[];
  coverHue: number;
  status: BazaarProductStatus;
  score: number;
  ratingCount: number;
  avgStars: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  myStars?: number | null;
};

export type BazaarMarketItem = BazaarProduct & {
  companyName: string;
  userName: string;
};

export type BazaarStall = {
  company: BazaarCompany;
  products: BazaarProduct[];
};

export type BazaarLeaderboardRow = {
  productId: string;
  score: number;
  avgStars: number;
  ratingCount: number;
  title: string;
  companyName: string;
  userId: string;
  userName: string;
};

export const BAZAAR_SHELF_LIMIT = 8;

export const BAZAAR_STALL_SKINS: BazaarStallSkin[] = [
  'neon-blue',
  'violet-pulse',
  'cyan-grid',
  'magenta-flare',
];

export const BAZAAR_STALL_SKIN_LABELS: Record<BazaarStallSkin, string> = {
  'neon-blue': '霓虹蓝',
  'violet-pulse': '紫脉冲',
  'cyan-grid': '青网格',
  'magenta-flare': '品红焰',
};

export type BazaarProductHint = {
  userName?: string;
  companyName?: string;
};

export function bazaarCoverStyle(hue: number) {
  return {
    background: `linear-gradient(135deg, hsl(${hue} 80% 45%), hsl(${hue} 80% 22%))`,
  };
}
