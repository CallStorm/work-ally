'use client';

import TaskChip, { allowTaskDrop, getTaskDragId } from './task-chip';
import {
  addDays,
  rangeForView,
  sameLocalDay,
  startOfMonth,
  tasksOnLocalDay,
} from './date-utils';
import type { Task } from './types';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MAX_VISIBLE = 3;

export default function MonthView({
  anchorDate,
  selectedDate,
  tasks,
  onSelectDate,
  onOpenTask,
  onToggleComplete,
  onDropTaskOnDay,
}: {
  anchorDate: Date;
  selectedDate: Date;
  tasks: Task[];
  onSelectDate: (day: Date) => void;
  onOpenTask: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  onDropTaskOnDay: (taskId: string, day: Date) => void;
}) {
  const { from } = rangeForView('month', anchorDate);
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  const monthIndex = startOfMonth(anchorDate).getMonth();
  const today = new Date();

  return (
    <div className="stickies-month">
      <div className="stickies-month__weekdays">
        {WEEKDAYS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="stickies-month__grid">
        {days.map((day) => {
          const dayTasks = tasksOnLocalDay(tasks, day);
          const visible = dayTasks.slice(0, MAX_VISIBLE);
          const overflow = dayTasks.length - visible.length;
          const inMonth = day.getMonth() === monthIndex;
          const isToday = sameLocalDay(day, today);
          const isSelected = sameLocalDay(day, selectedDate);
          return (
            <div
              key={day.toISOString()}
              className={[
                'stickies-month__cell',
                inMonth ? undefined : 'is-outside',
                isToday ? 'is-today' : undefined,
                isSelected ? 'is-selected' : undefined,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDate(day)}
              onDragOver={allowTaskDrop}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = getTaskDragId(e.dataTransfer);
                if (id) onDropTaskOnDay(id, day);
              }}
            >
              <span className="stickies-month__daynum">{day.getDate()}</span>
              {visible.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  onOpen={() => onOpenTask(task.id)}
                  onToggleComplete={() => onToggleComplete(task)}
                />
              ))}
              {overflow > 0 && (
                <div className="stickies-month__more">+{overflow}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
