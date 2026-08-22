type ConnectorVisual = {
  bg: string;
  fg: string;
  glyph: string;
  fontSize?: number;
};

function getConnectorVisual(name: string): ConnectorVisual {
  const lower = name.toLowerCase();

  if (lower.includes('github')) {
    return { bg: '#24292f', fg: '#fff', glyph: '⌘', fontSize: 18 };
  }
  if (lower.includes('腾讯') || lower.includes('tencent') || lower.includes('docs')) {
    return { bg: '#0052d9', fg: '#fff', glyph: 'T', fontSize: 18 };
  }
  if (lower.includes('简道') || lower.includes('jdy') || lower.includes('jiandaoyun')) {
    return { bg: '#ff6a00', fg: '#fff', glyph: 'J', fontSize: 17 };
  }
  if (lower.includes('slack')) {
    return { bg: '#4a154b', fg: '#fff', glyph: 'S', fontSize: 17 };
  }
  if (lower.includes('notion')) {
    return { bg: '#111827', fg: '#fff', glyph: 'N', fontSize: 17 };
  }

  const initial = name.trim().charAt(0).toUpperCase() || 'M';
  const hue =
    Math.abs([...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % 360;
  return {
    bg: `hsl(${hue} 68% 46%)`,
    fg: '#fff',
    glyph: initial,
    fontSize: 17,
  };
}

export default function ConnectorIcon({ name }: { name: string }) {
  const visual = getConnectorVisual(name);
  return (
    <div
      aria-hidden
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: visual.bg,
        color: visual.fg,
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: visual.fontSize ?? 16,
        flexShrink: 0,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}
    >
      {visual.glyph}
    </div>
  );
}
