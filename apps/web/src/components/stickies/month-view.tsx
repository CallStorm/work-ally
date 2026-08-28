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
    <div
      className="stickies-month"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div
        className="stickies-month__weekdays"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          marginBottom: 6,
          fontSize: 12,
          color: 'var(--stickies-muted)',
          textAlign: 'center',
        }}
      >
        {WEEKDAYS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div
        className="stickies-month__grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(6, minmax(92px, 1fr))',
          gap: 4,
          flex: 1,
          minHeight: 0,
        }}
      >
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
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 0,
                padding: 6,
                borderRadius: 10,
                border: isSelected
                  ? '1.5px solid #3d8f74'
                  : '1px solid rgba(28, 43, 40, 0.08)',
                background: isSelected
                  ? 'rgba(184, 228, 210, 0.35)'
                  : isToday
                    ? 'rgba(251, 246, 224, 0.7)'
                    : 'rgba(255, 255, 255, 0.65)',
                opacity: inMonth ? 1 : 0.45,
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              <span
                className="stickies-month__daynum"
                style={{
                  fontSize: 12,
                  fontWeight: isToday || isSelected ? 700 : 500,
                  alignSelf: 'flex-end',
                }}
              >
                {day.getDate()}
              </span>
              {visible.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  onOpen={() => onOpenTask(task.id)}
                  onToggleComplete={() => onToggleComplete(task)}
                />
              ))}
              {overflow > 0 && (
                <div
                  className="stickies-month__more"
                  style={{ fontSize: 11, color: 'var(--stickies-muted)', paddingLeft: 4 }}
                >
                  +{overflow}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
