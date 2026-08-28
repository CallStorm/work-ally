'use client';

import TimeGrid from './time-grid';
import { addDays, startOfWeek } from './date-utils';
import type { Task } from './types';

export default function WeekView({
  anchorDate,
  selectedDate,
  tasks,
  onSelectDate,
  onOpenTask,
  onToggleComplete,
  onCreateAt,
}: {
  anchorDate: Date;
  selectedDate: Date;
  tasks: Task[];
  onSelectDate: (day: Date) => void;
  onOpenTask: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  onCreateAt: (day: Date, hour: number) => void;
}) {
  const from = startOfWeek(anchorDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));

  return (
    <TimeGrid
      days={days}
      selectedDate={selectedDate}
      tasks={tasks}
      onSelectDate={onSelectDate}
      onOpenTask={onOpenTask}
      onToggleComplete={onToggleComplete}
      onCreateAt={onCreateAt}
    />
  );
}
