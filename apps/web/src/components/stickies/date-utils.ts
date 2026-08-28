import type { CalendarView, Task } from './types';

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday-start week */
export function startOfWeek(d: Date): Date {
  const x = startOfLocalDay(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

export function startOfMonth(d: Date): Date {
  return startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonthExclusive(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export function toAllDayDueAt(localDay: Date): string {
  return startOfLocalDay(localDay).toISOString();
}

/** Local calendar day at `hour:minute` as UTC ISO. */
export function toTimedDueAt(
  localDay: Date,
  hour: number,
  minute = 0,
): string {
  const x = startOfLocalDay(localDay);
  x.setHours(hour, minute, 0, 0);
  return x.toISOString();
}

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return formatYmd(a) === formatYmd(b);
}

/** Inclusive `from`, exclusive `to` (same convention as `rangeForView`). */
export function isDateInRange(day: Date, from: Date, to: Date): boolean {
  const t = startOfLocalDay(day).getTime();
  return t >= from.getTime() && t < to.getTime();
}

export function rangeForView(
  view: CalendarView,
  anchor: Date,
): { from: Date; to: Date } {
  if (view === 'day') {
    const from = startOfLocalDay(anchor);
    return { from, to: addDays(from, 1) };
  }
  if (view === 'week') {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  // month: include leading/trailing days of grid (6 weeks)
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  return { from: gridStart, to: addDays(gridStart, 42) };
}

export function tasksOnLocalDay<T extends { dueAt: string }>(
  tasks: T[],
  day: Date,
): T[] {
  const key = formatYmd(day);
  return tasks.filter((t) => formatYmd(new Date(t.dueAt)) === key);
}

/** Keep all-day vs clock time when moving a task to another calendar day. */
export function moveTaskToDay(
  task: Task,
  day: Date,
): { dueAt: string; allDay: boolean } {
  if (task.allDay) {
    return { dueAt: toAllDayDueAt(day), allDay: true };
  }
  const old = new Date(task.dueAt);
  const next = startOfLocalDay(day);
  next.setHours(old.getHours(), old.getMinutes(), 0, 0);
  return { dueAt: next.toISOString(), allDay: false };
}

/** Place a task on a timed hour slot (clears all-day). */
export function moveTaskToSlot(
  day: Date,
  hour: number,
  minute = 0,
): { dueAt: string; allDay: boolean } {
  const next = startOfLocalDay(day);
  next.setHours(hour, minute, 0, 0);
  return { dueAt: next.toISOString(), allDay: false };
}
