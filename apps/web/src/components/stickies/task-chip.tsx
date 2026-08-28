'use client';

import type { Task } from './types';
import { PRIORITY_DOT } from './types';

export default function TaskChip({
  task,
  onOpen,
  onToggleComplete,
}: {
  task: Task;
  onOpen: () => void;
  onToggleComplete: () => void;
}) {
  return (
    <div
      className="task-chip"
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        minWidth: 0,
        padding: '2px 4px',
        borderRadius: 6,
        cursor: 'pointer',
        opacity: task.completed ? 0.55 : 1,
        textDecoration: task.completed ? 'line-through' : 'none',
        fontSize: 12,
        lineHeight: 1.3,
        color: 'inherit',
      }}
    >
      <input
        type="checkbox"
        checked={task.completed}
        aria-label={`完成 ${task.title}`}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          onToggleComplete();
        }}
        style={{ margin: 0, flexShrink: 0 }}
      />
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: PRIORITY_DOT[task.priority],
          flexShrink: 0,
        }}
      />
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          textAlign: 'left',
        }}
      >
        {task.title}
      </span>
    </div>
  );
}
