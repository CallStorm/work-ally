'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DayView from './day-view';
import MonthView from './month-view';
import QuickAdd from './quick-add';
import TaskDetailDrawer from './task-detail-drawer';
import WeekView from './week-view';
import {
  addDays,
  formatYmd,
  rangeForView,
  startOfLocalDay,
  startOfWeek,
  toAllDayDueAt,
  toTimedDueAt,
} from './date-utils';
import type { CalendarView, Task, TaskNotification, TaskPatch } from './types';
import { apiFetch } from '@/lib/api';

function shiftAnchor(current: Date, view: CalendarView, dir: number): Date {
  if (view === 'month') {
    return startOfLocalDay(
      new Date(current.getFullYear(), current.getMonth() + dir, 1),
    );
  }
  if (view === 'week') {
    return addDays(startOfWeek(current), dir * 7);
  }
  return addDays(startOfLocalDay(current), dir);
}

function rangeTitle(view: CalendarView, anchor: Date): string {
  if (view === 'month') {
    return `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`;
  }
  if (view === 'week') {
    const from = startOfWeek(anchor);
    const to = addDays(from, 6);
    return `${formatYmd(from)} – ${formatYmd(to)}`;
  }
  return formatYmd(startOfLocalDay(anchor));
}

function applyTaskPatch(task: Task, patch: TaskPatch): Task {
  return {
    ...task,
    ...patch,
    completedAt:
      patch.completed === undefined
        ? task.completedAt
        : patch.completed
          ? new Date().toISOString()
          : null,
    reminderFiredAt:
      patch.reminderAt !== undefined ? null : task.reminderFiredAt,
  };
}

export default function StickiesApp() {
  const [view, setView] = useState<CalendarView>('month');
  const [selectedDate, setSelectedDate] = useState(() =>
    startOfLocalDay(new Date()),
  );
  const [anchorDate, setAnchorDate] = useState(() =>
    startOfLocalDay(new Date()),
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());
  const bellRef = useRef<HTMLDivElement>(null);

  const loadTasks = useCallback(async () => {
    const { from, to } = rangeForView(view, anchorDate);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      includeCompleted: hideCompleted ? 'false' : 'true',
    });
    const data = await apiFetch<Task[]>(`/apps/stickies/tasks?${params}`);
    setTasks(data);
  }, [view, anchorDate, hideCompleted]);

  const loadNotifications = useCallback(async () => {
    const data = await apiFetch<TaskNotification[]>(
      '/apps/stickies/notifications?unread=true',
    );
    setNotifications(data);
    for (const n of data) {
      if (notifiedRef.current.has(n.id)) continue;
      notifiedRef.current.add(n.id);
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification('闪签提醒', { body: n.message });
      }
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadTasks();
      } catch {
        setTasks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadTasks]);

  useEffect(() => {
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const t = setInterval(() => void loadNotifications(), 30_000);
    return () => clearInterval(t);
  }, [loadNotifications]);

  useEffect(() => {
    if (!bellOpen) return;
    function onDoc(e: MouseEvent) {
      if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setBellOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [bellOpen]);

  async function handleCreate(title: string) {
    const created = await apiFetch<Task>('/apps/stickies/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title,
        dueAt: toAllDayDueAt(selectedDate),
        allDay: true,
      }),
    });
    setTasks((prev) => [...prev, created]);
  }

  async function handleCreateAt(day: Date, hour: number) {
    const localDay = startOfLocalDay(day);
    setSelectedDate(localDay);
    try {
      const created = await apiFetch<Task>('/apps/stickies/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: '新任务',
          dueAt: toTimedDueAt(localDay, hour),
          allDay: false,
        }),
      });
      setTasks((prev) => [...prev, created]);
    } catch {
      await loadTasks();
    }
  }

  function handleSelectDate(day: Date) {
    const localDay = startOfLocalDay(day);
    setSelectedDate(localDay);
    setAnchorDate(localDay);
  }

  function handleViewChange(next: CalendarView) {
    setView(next);
    if (next === 'day' || next === 'week') {
      setAnchorDate(startOfLocalDay(selectedDate));
    }
  }

  function handleShiftRange(dir: number) {
    const nextAnchor = shiftAnchor(anchorDate, view, dir);
    setAnchorDate(nextAnchor);
    if (view === 'day') {
      setSelectedDate(startOfLocalDay(nextAnchor));
      return;
    }
    if (view === 'week') {
      const weekStart = startOfWeek(nextAnchor);
      const weekEnd = addDays(weekStart, 7);
      const sel = startOfLocalDay(selectedDate);
      if (sel < weekStart || sel >= weekEnd) {
        setSelectedDate(weekStart);
      }
    }
  }

  async function handleToggleComplete(task: Task) {
    const nextCompleted = !task.completed;
    setTasks((prev) => {
      if (hideCompleted && nextCompleted) {
        return prev.filter((t) => t.id !== task.id);
      }
      return prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              completed: nextCompleted,
              completedAt: nextCompleted ? new Date().toISOString() : null,
            }
          : t,
      );
    });
    try {
      const updated = await apiFetch<Task>(`/apps/stickies/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: nextCompleted }),
      });
      setTasks((prev) => {
        if (hideCompleted && updated.completed) {
          return prev.filter((t) => t.id !== updated.id);
        }
        if (prev.some((t) => t.id === updated.id)) {
          return prev.map((t) => (t.id === updated.id ? updated : t));
        }
        return prev;
      });
    } catch {
      await loadTasks();
    }
  }

  async function handleTaskPatch(id: string, patch: TaskPatch) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? applyTaskPatch(t, patch) : t)),
    );
    try {
      const updated = await apiFetch<Task>(`/apps/stickies/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setTasks((prev) => {
        if (hideCompleted && updated.completed) {
          return prev.filter((t) => t.id !== updated.id);
        }
        if (prev.some((t) => t.id === updated.id)) {
          return prev.map((t) => (t.id === updated.id ? updated : t));
        }
        return [...prev, updated];
      });
      if (hideCompleted && updated.completed) {
        setSelectedTaskId((cur) => (cur === updated.id ? null : cur));
      }
    } catch {
      await loadTasks();
    }
  }

  async function handleTaskDelete(id: string) {
    await apiFetch(`/apps/stickies/tasks/${id}`, { method: 'DELETE' });
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTaskId((cur) => (cur === id ? null : cur));
  }

  function goToday() {
    const today = startOfLocalDay(new Date());
    setSelectedDate(today);
    setAnchorDate(today);
  }

  async function openNotification(n: TaskNotification) {
    await apiFetch(`/apps/stickies/notifications/${n.id}/read`, {
      method: 'PATCH',
    });
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    setBellOpen(false);
    setSelectedTaskId(n.taskId);
  }

  async function markAllNotificationsRead() {
    await apiFetch('/apps/stickies/notifications/read-all', { method: 'POST' });
    setNotifications([]);
  }

  const unreadCount = notifications.length;
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  return (
    <div className="stickies-app">
      <header className="stickies-app__header">
        <div className="stickies-app__brand">
          <span className="stickies-app__logo" aria-hidden>
            <span className="stickies-app__logo-sheet stickies-app__logo-sheet--a" />
            <span className="stickies-app__logo-sheet stickies-app__logo-sheet--b" />
            <span className="stickies-app__logo-sheet stickies-app__logo-sheet--c" />
          </span>
          <div>
            <h1>闪签</h1>
            <p>日历任务</p>
          </div>
        </div>
        <div className="stickies-app__actions">
          <div className="stickies-app__tabs">
            {(
              [
                ['day', '日'],
                ['week', '周'],
                ['month', '月'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={view === key ? 'is-active' : undefined}
                onClick={() => handleViewChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="stickies-app__cal-nav"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <button
              type="button"
              aria-label="上一区间"
              onClick={() => handleShiftRange(-1)}
            >
              ‹
            </button>
            <strong style={{ minWidth: 120, textAlign: 'center' }}>
              {rangeTitle(view, anchorDate)}
            </strong>
            <button
              type="button"
              aria-label="下一区间"
              onClick={() => handleShiftRange(1)}
            >
              ›
            </button>
          </div>
          <button
            type="button"
            className="stickies-app__digest"
            onClick={goToday}
          >
            今天
          </button>
          <button
            type="button"
            className={hideCompleted ? 'is-active' : undefined}
            onClick={() => setHideCompleted((v) => !v)}
            style={{
              border: 'none',
              background: hideCompleted ? 'rgba(61, 143, 116, 0.15)' : 'transparent',
              borderRadius: 999,
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
            }}
          >
            隐藏已完成
          </button>
          <div className="stickies-app__bell-wrap" ref={bellRef}>
            <button
              type="button"
              className={`stickies-app__bell${bellOpen ? ' is-open' : ''}`}
              title="提醒"
              aria-expanded={bellOpen}
              aria-haspopup="dialog"
              onClick={() => setBellOpen((v) => !v)}
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="stickies-app__badge">{unreadCount}</span>
              )}
            </button>
            {bellOpen && (
              <div className="stickies-app__bell-panel" role="dialog">
                <div className="stickies-app__bell-head">
                  <strong>提醒</strong>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsRead()}
                    >
                      全部已读
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="stickies-app__bell-empty">暂无提醒</p>
                ) : (
                  <ul className="stickies-app__bell-list">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => void openNotification(n)}
                        >
                          <span>{n.message}</span>
                          <time>
                            {new Date(n.firedAt).toLocaleString('zh-CN', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="stickies-app__empty">加载中…</div>
      ) : view === 'month' ? (
        <MonthView
          anchorDate={anchorDate}
          selectedDate={selectedDate}
          tasks={tasks}
          onSelectDate={handleSelectDate}
          onOpenTask={setSelectedTaskId}
          onToggleComplete={(task) => void handleToggleComplete(task)}
        />
      ) : view === 'week' ? (
        <WeekView
          anchorDate={anchorDate}
          selectedDate={selectedDate}
          tasks={tasks}
          onSelectDate={handleSelectDate}
          onOpenTask={setSelectedTaskId}
          onToggleComplete={(task) => void handleToggleComplete(task)}
          onCreateAt={(day, hour) => void handleCreateAt(day, hour)}
        />
      ) : (
        <DayView
          anchorDate={anchorDate}
          selectedDate={selectedDate}
          tasks={tasks}
          onSelectDate={handleSelectDate}
          onOpenTask={setSelectedTaskId}
          onToggleComplete={(task) => void handleToggleComplete(task)}
          onCreateAt={(day, hour) => void handleCreateAt(day, hour)}
        />
      )}

      {selectedTask && (
        <TaskDetailDrawer
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onChange={(patch) => void handleTaskPatch(selectedTask.id, patch)}
          onDelete={() => handleTaskDelete(selectedTask.id)}
        />
      )}

      <QuickAdd onCreate={handleCreate} />
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9a6 6 0 1 1 12 0c0 3.2 1.2 4.8 2 6H4c.8-1.2 2-2.8 2-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10 18a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
