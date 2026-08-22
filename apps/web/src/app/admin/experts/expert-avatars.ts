export type AvatarPreset = {
  id: string;
  emoji: string;
  bg: string;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'robot-blue', emoji: '🤖', bg: '#dbeafe' },
  { id: 'chart-green', emoji: '📊', bg: '#dcfce7' },
  { id: 'doc-orange', emoji: '📝', bg: '#ffedd5' },
  { id: 'code-purple', emoji: '💻', bg: '#ede9fe' },
  { id: 'mail-cyan', emoji: '✉️', bg: '#cffafe' },
  { id: 'idea-yellow', emoji: '💡', bg: '#fef9c3' },
  { id: 'search-slate', emoji: '🔍', bg: '#e2e8f0' },
  { id: 'team-pink', emoji: '👥', bg: '#fce7f3' },
];

export function presetToAvatarUrl(presetId: string): string {
  return `preset:${presetId}`;
}

export function parseAvatarUrl(url: string | null | undefined): {
  kind: 'preset' | 'image';
  preset?: AvatarPreset;
  src?: string;
} {
  if (!url) return { kind: 'preset' };
  if (url.startsWith('preset:')) {
    const id = url.slice('preset:'.length);
    const preset = AVATAR_PRESETS.find((p) => p.id === id);
    return preset ? { kind: 'preset', preset } : { kind: 'preset' };
  }
  return { kind: 'image', src: url };
}

export function defaultPresetId(): string {
  return AVATAR_PRESETS[0].id;
}
