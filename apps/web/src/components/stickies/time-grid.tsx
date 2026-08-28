'use client';

import TaskChip, { allowTaskDrop, getTaskDragId } from './task-chip';
import { formatYmd, sameLocalDay, tasksOnLocalDay } from './date-utils';
import type { Task } from './types';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
export const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_PX = 48;

function padHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export default function TimeGrid({
  days,
  selectedDate,
  tasks,
  showTodayHint = false,
  onSelectDate,
  onOpenTask,
  onToggleComplete,
  onCreateAt,
  onDropTaskOnSlot,
}: {
  days: Date[];
  selectedDate: Date;
  tasks: Task[];
  showTodayHint?: boolean;
  onSelectDate: (day: Date) => void;
  onOpenTask: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  onCreateAt: (day: Date, hour: number) => void;
  onDropTaskOnSlot: (taskId: string, day: Date, hour: number) => void;
}) {
  const today = new Date();
  const columns = `48px repeat(${days.length}, minmax(0, 1fr))`;
  const onlyDay = days.length === 1 ? days[0] : null;
  const showHint =
    showTodayHint &&
    onlyDay !== null &&
    sameLocalDay(onlyDay, today) &&
    tasksOnLocalDay(tasks, onlyDay).length === 0;

  return (
    <div className="stickies-timegrid">
      <div className="stickies-timegrid__head" style={{ gridTemplateColumns: columns }}>
        <div className="stickies-timegrid__gutter" />
        {days.map((day) => {
          const isToday = sameLocalDay(day, today);
          const isSelected = sameLocalDay(day, selectedDate);
          return (
            <button
              key={formatYmd(day)}
              type="button"
              className={[
                'stickies-timegrid__dayhead',
                isToday ? 'is-today' : undefined,
                isSelected ? 'is-selected' : undefined,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDate(day)}
            >
              <span>{WEEKDAYS[(day.getDay() + 6) % 7]}</span>
              <strong>{day.getDate()}</strong>
            </button>
          );
        })}
      </div>

      {showHint && (
        <p className="stickies-timegrid__hint">在今天添加第一个任务</p>
      )}

      <div className="stickies-timegrid__allday" style={{ gridTemplateColumns: columns }}>
        <div className="stickies-timegrid__gutter stickies-timegrid__gutter--muted">
          全天
        </div>
        {days.map((day) => {
          const allDayTasks = tasksOnLocalDay(tasks, day).filter((t) => t.allDay);
          return (
            <div
              key={formatYmd(day)}
              className="stickies-timegrid__allday-cell"
              onClick={() => onSelectDate(day)}
            >
              {allDayTasks.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  onOpen={() => onOpenTask(task.id)}
                  onToggleComplete={() => onToggleComplete(task)}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="stickies-timegrid__body">
        <div className="stickies-timegrid__hours">
          {HOURS.map((hour) => (
            <div
              key={`row-${hour}`}
              className="stickies-timegrid__row"
              style={{ gridTemplateColumns: columns, minHeight: HOUR_PX }}
            >
              <div className="stickies-timegrid__label">{padHour(hour)}</div>
              {days.map((day) => {
                const slotTasks = tasksOnLocalDay(tasks, day).filter(
                  (t) => !t.allDay && new Date(t.dueAt).getHours() === hour,
                );
                const isEmpty = slotTasks.length === 0;
                return (
                  <div
                    key={`${formatYmd(day)}-${hour}`}
                    className="stickies-timegrid__slot"
                    role={isEmpty ? 'button' : undefined}
                    tabIndex={isEmpty ? 0 : undefined}
                    aria-label={
                      isEmpty
                        ? `${formatYmd(day)} ${padHour(hour)} 添加任务`
                        : undefined
                    }
                    onClick={() => {
                      if (isEmpty) onCreateAt(day, hour);
                    }}
                    onDragOver={allowTaskDrop}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const id = getTaskDragId(e.dataTransfer);
                      if (id) onDropTaskOnSlot(id, day, hour);
                    }}
                    onKeyDown={(e) => {
                      if (!isEmpty) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onCreateAt(day, hour);
                      }
                    }}
                  >
                    {slotTasks.map((task) => (
                      <TaskChip
                        key={task.id}
                        task={task}
                        onOpen={() => onOpenTask(task.id)}
                        onToggleComplete={() => onToggleComplete(task)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
