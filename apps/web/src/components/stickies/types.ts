export type TaskPriority = 'high' | 'medium' | 'low';
export type CalendarView = 'day' | 'week' | 'month';

export type Task = {
  id: string;
  title: string;
  notes: string;
  completed: boolean;
  completedAt: string | null;
  priority: TaskPriority;
  dueAt: string;
  allDay: boolean;
  reminderAt: string | null;
  reminderFiredAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskPatch = Partial<
  Pick<
    Task,
    'title' | 'notes' | 'completed' | 'priority' | 'dueAt' | 'allDay' | 'reminderAt'
  >
>;

export type TaskNotification = {
  id: string;
  taskId: string;
  message: string;
  firedAt: string;
  read: boolean;
};

export type WorkbenchApp = {
  id: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
};

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: '#c45c4a',
  medium: '#c4a35a',
  low: '#7a8a99',
};
