export const BAZAAR_BASE_SCORE = 20;

export function scoreFromStars(starValues: number[]): {
  score: number;
  ratingCount: number;
  avgStars: number;
} {
  const ratingCount = starValues.length;
  const sum = starValues.reduce((a, b) => a + b, 0);
  return {
    score: BAZAAR_BASE_SCORE + sum,
    ratingCount,
    avgStars: ratingCount === 0 ? 0 : Math.round((sum / ratingCount) * 100) / 100,
  };
}
