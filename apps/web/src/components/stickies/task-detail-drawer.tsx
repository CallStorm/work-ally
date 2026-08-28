'use client';

import { useEffect, useRef, useState } from 'react';
import {
  formatYmd,
  startOfLocalDay,
  toAllDayDueAt,
  toTimedDueAt,
} from './date-utils';
import type { Task, TaskPatch, TaskPriority } from './types';

const DEBOUNCE_MS = 400;

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
    if (!task) return;
    setTitle(task.title);
    setCompleted(task.completed);
    setDate(formatYmd(new Date(task.dueAt)));
    setAllDay(task.allDay);
    setTime(task.allDay ? '09:00' : localTimeValue(task.dueAt));
    setPriority(task.priority);
    setReminder(toDatetimeLocalValue(task.reminderAt));
    setNotes(task.notes);
  }, [
    task?.id,
    task?.completed,
    task?.title,
    task?.dueAt,
    task?.updatedAt,
    task?.allDay,
  ]);

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
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="stickies-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stickies-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="stickies-drawer__head">
          <strong id="stickies-drawer-title">任务详情</strong>
          <button
            type="button"
            className="stickies-drawer__close"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <label className="stickies-drawer__check">
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
          <label htmlFor="stickies-task-title" className="stickies-drawer__label">
            标题
          </label>
          <input
            id="stickies-task-title"
            className="stickies-drawer__field"
            value={title}
            onChange={(e) => {
              const next = e.target.value;
              setTitle(next);
              schedule({ title: next });
            }}
          />
        </div>

        <div
          className={`stickies-drawer__row ${allDay ? 'stickies-drawer__row--allday' : 'stickies-drawer__row--split'}`}
        >
          <div>
            <label htmlFor="stickies-task-date" className="stickies-drawer__label">
              日期
            </label>
            <input
              id="stickies-task-date"
              className="stickies-drawer__field"
              type="date"
              value={date}
              onChange={(e) => {
                const next = e.target.value;
                setDate(next);
                applyDue(next, allDay, time);
              }}
            />
          </div>
          {allDay ? (
            <label className="stickies-drawer__check stickies-drawer__check--end">
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
              <label htmlFor="stickies-task-time" className="stickies-drawer__label">
                时间
              </label>
              <input
                id="stickies-task-time"
                className="stickies-drawer__field"
                type="time"
                value={time}
                onChange={(e) => {
                  const next = e.target.value;
                  setTime(next);
                  applyDue(date, false, next);
                }}
              />
            </div>
          )}
        </div>

        {!allDay && (
          <label className="stickies-drawer__check">
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
          <label htmlFor="stickies-task-priority" className="stickies-drawer__label">
            优先级
          </label>
          <select
            id="stickies-task-priority"
            className="stickies-drawer__field"
            value={priority}
            onChange={(e) => {
              const next = e.target.value as TaskPriority;
              setPriority(next);
              schedule({ priority: next });
            }}
          >
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </div>

        <div>
          <label htmlFor="stickies-task-reminder" className="stickies-drawer__label">
            提醒
          </label>
          <div className="stickies-drawer__reminder">
            <input
              id="stickies-task-reminder"
              className="stickies-drawer__field"
              type="datetime-local"
              value={reminder}
              onChange={(e) => {
                const next = e.target.value;
                setReminder(next);
                schedule({ reminderAt: fromDatetimeLocalValue(next) });
              }}
            />
            {reminder && (
              <button
                type="button"
                className="stickies-drawer__clear"
                onClick={() => {
                  setReminder('');
                  schedule({ reminderAt: null });
                }}
              >
                清除
              </button>
            )}
          </div>
        </div>

        <div className="stickies-drawer__notes">
          <label htmlFor="stickies-task-notes" className="stickies-drawer__label">
            备注
          </label>
          <textarea
            id="stickies-task-notes"
            className="stickies-drawer__field"
            value={notes}
            rows={6}
            onChange={(e) => {
              const next = e.target.value;
              setNotes(next);
              schedule({ notes: next });
            }}
          />
        </div>

        <button
          type="button"
          className="stickies-drawer__delete"
          onClick={() => void handleDelete()}
          disabled={deleting}
        >
          {deleting ? '删除中…' : '删除任务'}
        </button>
      </aside>
    </>
  );
}
