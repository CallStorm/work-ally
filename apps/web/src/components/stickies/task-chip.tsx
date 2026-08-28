'use client';

import { useRef, type DragEvent } from 'react';
import type { Task } from './types';
import { PRIORITY_DOT } from './types';

export const TASK_DRAG_TYPE = 'application/x-stickies-task-id';

export function setTaskDragData(dt: DataTransfer, taskId: string) {
  dt.setData(TASK_DRAG_TYPE, taskId);
  dt.setData('text/plain', taskId);
  dt.effectAllowed = 'move';
}

export function getTaskDragId(dt: DataTransfer): string | null {
  const id = dt.getData(TASK_DRAG_TYPE) || dt.getData('text/plain');
  return id || null;
}

export function allowTaskDrop(e: DragEvent) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

export default function TaskChip({
  task,
  onOpen,
  onToggleComplete,
}: {
  task: Task;
  onOpen: () => void;
  onToggleComplete: () => void;
}) {
  const didDragRef = useRef(false);

  return (
    <div
      className="task-chip"
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        didDragRef.current = true;
        e.stopPropagation();
        setTaskDragData(e.dataTransfer, task.id);
      }}
      onDragEnd={() => {
        requestAnimationFrame(() => {
          didDragRef.current = false;
        });
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (didDragRef.current) {
          didDragRef.current = false;
          return;
        }
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
        cursor: 'grab',
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
        draggable={false}
        aria-label={`完成 ${task.title}`}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          onToggleComplete();
        }}
        style={{ margin: 0, flexShrink: 0, cursor: 'pointer' }}
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
