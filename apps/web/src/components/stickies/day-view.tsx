'use client';

import TimeGrid from './time-grid';
import { startOfLocalDay } from './date-utils';
import type { Task } from './types';

export default function DayView({
  selectedDate,
  tasks,
  onSelectDate,
  onOpenTask,
  onToggleComplete,
  onCreateAt,
  onDropTaskOnSlot,
}: {
  anchorDate: Date;
  selectedDate: Date;
  tasks: Task[];
  onSelectDate: (day: Date) => void;
  onOpenTask: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  onCreateAt: (day: Date, hour: number) => void;
  onDropTaskOnSlot: (taskId: string, day: Date, hour: number) => void;
}) {
  const day = startOfLocalDay(selectedDate);

  return (
    <TimeGrid
      days={[day]}
      selectedDate={selectedDate}
      tasks={tasks}
      showTodayHint
      onSelectDate={onSelectDate}
      onOpenTask={onOpenTask}
      onToggleComplete={onToggleComplete}
      onCreateAt={onCreateAt}
      onDropTaskOnSlot={onDropTaskOnSlot}
    />
  );
}
