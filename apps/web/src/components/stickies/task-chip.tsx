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
  onDrop,
}: {
  task: Task;
  onOpen: () => void;
  onToggleComplete: () => void;
  onDrop?: (e: DragEvent) => void;
}) {
  const didDragRef = useRef(false);

  return (
    <div
      className={`task-chip${task.completed ? ' is-done' : ''}`}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        didDragRef.current = true;
        e.stopPropagation();
        document.body.classList.add('is-dragging-task');
        setTaskDragData(e.dataTransfer, task.id);
      }}
      onDragEnd={() => {
        document.body.classList.remove('is-dragging-task');
        requestAnimationFrame(() => {
          didDragRef.current = false;
        });
      }}
      onDragOver={(e) => {
        if (!onDrop) return;
        allowTaskDrop(e);
      }}
      onDrop={(e) => {
        if (!onDrop) return;
        onDrop(e);
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
      />
      <span
        className="task-chip__dot"
        aria-hidden
        style={{ background: PRIORITY_DOT[task.priority] }}
      />
      <span className="task-chip__title">{task.title}</span>
    </div>
  );
}
