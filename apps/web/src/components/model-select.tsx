'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type ModelSelectOption = {
  id: string;
  displayName: string;
};

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12l5 5L20 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ModelSelect({
  models,
  value,
  onChange,
  disabled,
  emptyLabel = '请先配置模型',
}: {
  models: ModelSelectOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => models.find((m) => m.id === value) ?? null,
    [models, value],
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerLabel = selected?.displayName ?? emptyLabel;

  return (
    <div
      ref={rootRef}
      className={`model-select${open ? ' model-select--open' : ''}`}
    >
      <button
        type="button"
        className="model-select__trigger"
        disabled={disabled || models.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (models.length === 0) return;
          setOpen((v) => !v);
        }}
      >
        <span className="model-select__trigger-label">{triggerLabel}</span>
        <ChevronDown />
      </button>

      {open && models.length > 0 && (
        <div className="model-select__menu" role="listbox">
          {models.map((model) => {
            const active = model.id === value;
            return (
              <button
                key={model.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`model-select__option${active ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(model.id);
                  setOpen(false);
                }}
              >
                <span className="model-select__check" aria-hidden>
                  {active ? <CheckIcon /> : null}
                </span>
                <span className="model-select__name">{model.displayName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
