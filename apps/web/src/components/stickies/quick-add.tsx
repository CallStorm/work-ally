'use client';

import { useState } from 'react';

export default function QuickAdd({
  onCreate,
}: {
  onCreate: (title: string) => void | Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const next = title.trim();
    if (!next || busy) return;
    setBusy(true);
    try {
      await onCreate(next);
      setTitle('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer className="stickies-app__capture">
      <input
        className="quick-add__input"
        placeholder="添加任务…"
        value={title}
        disabled={busy}
        aria-label="添加任务"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
          }
        }}
      />
    </footer>
  );
}
