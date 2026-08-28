import type { CalendarView } from './types';

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

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return formatYmd(a) === formatYmd(b);
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
