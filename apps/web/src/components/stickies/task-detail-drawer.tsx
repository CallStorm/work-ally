'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  formatYmd,
  startOfLocalDay,
  toAllDayDueAt,
  toTimedDueAt,
} from './date-utils';
import type { Task, TaskPatch, TaskPriority } from './types';

const DEBOUNCE_MS = 400;

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 40,
  background: 'rgba(16, 24, 32, 0.28)',
};

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  zIndex: 41,
  width: 360,
  maxWidth: '100vw',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '20px 20px 24px',
  background: 'rgba(255,255,255,0.98)',
  borderLeft: '1px solid rgba(28, 43, 40, 0.1)',
  boxShadow: '-12px 0 32px rgba(16,24,32,0.1)',
  color: 'var(--stickies-ink)',
  overflow: 'auto',
};

const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid rgba(28, 43, 40, 0.12)',
  borderRadius: 8,
  padding: '8px 10px',
  font: 'inherit',
  color: 'var(--stickies-ink)',
  background: '#fff',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--stickies-muted)',
  marginBottom: 6,
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function localTimeValue(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${formatYmd(d)}T${localTimeValue(iso)}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return startOfLocalDay(
    new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  );
}

function parseTime(value: string): [number, number] {
  const [h, m] = value.split(':').map(Number);
  return [Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0];
}

function duePatch(
  dateYmd: string,
  allDay: boolean,
  time: string,
): Pick<TaskPatch, 'dueAt' | 'allDay'> | null {
  const day = parseYmd(dateYmd);
  if (!day) return null;
  if (allDay) {
    return { dueAt: toAllDayDueAt(day), allDay: true };
  }
  const [hour, minute] = parseTime(time || '09:00');
  return { dueAt: toTimedDueAt(day, hour, minute), allDay: false };
}

function sanitizePatch(patch: TaskPatch): TaskPatch | null {
  const next = { ...patch };
  if (next.title !== undefined) {
    const trimmed = next.title.trim();
    if (!trimmed) delete next.title;
    else next.title = trimmed;
  }
  return Object.keys(next).length > 0 ? next : null;
}

export default function TaskDetailDrawer({
  task,
  onClose,
  onChange,
  onDelete,
}: {
  task: Task | null;
  onClose: () => void;
  onChange: (patch: TaskPatch) => void;
  onDelete: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [completed, setCompleted] = useState(task?.completed ?? false);
  const [date, setDate] = useState(
    task ? formatYmd(new Date(task.dueAt)) : '',
  );
  const [allDay, setAllDay] = useState(task?.allDay ?? true);
  const [time, setTime] = useState(
    task && !task.allDay ? localTimeValue(task.dueAt) : '09:00',
  );
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? 'medium',
  );
  const [reminder, setReminder] = useState(
    toDatetimeLocalValue(task?.reminderAt ?? null),
  );
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [deleting, setDeleting] = useState(false);

  const pendingRef = useRef<TaskPatch>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function flush() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const ready = sanitizePatch(pendingRef.current);
    pendingRef.current = {};
    if (ready) onChangeRef.current(ready);
  }

  function schedule(patch: TaskPatch) {
    pendingRef.current = { ...pendingRef.current, ...patch };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flush();
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const ready = sanitizePatch(pendingRef.current);
      pendingRef.current = {};
      if (ready) onChangeRef.current(ready);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!task) return null;

  function applyDue(
    nextDate: string,
    nextAllDay: boolean,
    nextTime: string,
  ) {
    const patch = duePatch(nextDate, nextAllDay, nextTime);
    if (patch) schedule(patch);
  }

  async function handleDelete() {
    if (deleting) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = {};
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        className="stickies-drawer__overlay"
        style={overlayStyle}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="stickies-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stickies-drawer-title"
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <strong id="stickies-drawer-title">任务详情</strong>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              color: 'var(--stickies-muted)',
            }}
          >
            ×
          </button>
        </header>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => {
              const next = e.target.checked;
              setCompleted(next);
              schedule({ completed: next });
            }}
          />
          已完成
        </label>

        <div>
          <label htmlFor="stickies-task-title" style={labelStyle}>
            标题
          </label>
          <input
            id="stickies-task-title"
            value={title}
            onChange={(e) => {
              const next = e.target.value;
              setTitle(next);
              schedule({ title: next });
            }}
            style={fieldStyle}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: allDay ? '1fr auto' : '1fr 1fr',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <div>
            <label htmlFor="stickies-task-date" style={labelStyle}>
              日期
            </label>
            <input
              id="stickies-task-date"
              type="date"
              value={date}
              onChange={(e) => {
                const next = e.target.value;
                setDate(next);
                applyDue(next, allDay, time);
              }}
              style={fieldStyle}
            />
          </div>
          {allDay ? (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingBottom: 8,
                whiteSpace: 'nowrap',
              }}
            >
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => {
                  const next = e.target.checked;
                  const nextTime = time || '09:00';
                  setAllDay(next);
                  if (!next) setTime(nextTime);
                  applyDue(date, next, nextTime);
                }}
              />
              全天
            </label>
          ) : (
            <div>
              <label htmlFor="stickies-task-time" style={labelStyle}>
                时间
              </label>
              <input
                id="stickies-task-time"
                type="time"
                value={time}
                onChange={(e) => {
                  const next = e.target.value;
                  setTime(next);
                  applyDue(date, false, next);
                }}
                style={fieldStyle}
              />
            </div>
          )}
        </div>

        {!allDay && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => {
                const next = e.target.checked;
                setAllDay(next);
                applyDue(date, next, time || '09:00');
              }}
            />
            全天
          </label>
        )}

        <div>
          <label htmlFor="stickies-task-priority" style={labelStyle}>
            优先级
          </label>
          <select
            id="stickies-task-priority"
            value={priority}
            onChange={(e) => {
              const next = e.target.value as TaskPriority;
              setPriority(next);
              schedule({ priority: next });
            }}
            style={fieldStyle}
          >
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </div>

        <div>
          <label htmlFor="stickies-task-reminder" style={labelStyle}>
            提醒
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="stickies-task-reminder"
              type="datetime-local"
              value={reminder}
              onChange={(e) => {
                const next = e.target.value;
                setReminder(next);
                schedule({ reminderAt: fromDatetimeLocalValue(next) });
              }}
              style={{ ...fieldStyle, flex: 1 }}
            />
            {reminder && (
              <button
                type="button"
                onClick={() => {
                  setReminder('');
                  schedule({ reminderAt: null });
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--stickies-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                清除
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="stickies-task-notes" style={labelStyle}>
            备注
          </label>
          <textarea
            id="stickies-task-notes"
            value={notes}
            rows={6}
            onChange={(e) => {
              const next = e.target.value;
              setNotes(next);
              schedule({ notes: next });
            }}
            style={{ ...fieldStyle, resize: 'vertical', minHeight: 120 }}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={deleting}
          style={{
            marginTop: 'auto',
            border: 'none',
            background: 'transparent',
            color: '#c45c4a',
            cursor: deleting ? 'default' : 'pointer',
            padding: '8px 0',
            textAlign: 'left',
            font: 'inherit',
          }}
        >
          {deleting ? '删除中…' : '删除任务'}
        </button>
      </aside>
    </>
  );
}
