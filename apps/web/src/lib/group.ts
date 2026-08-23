export const GROUP_STORAGE_KEY = 'workbench.defaultGroupId';

export type UserGroup = {
  id: string;
  name: string;
  isDefault: boolean;
};

export function loadStoredGroupId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(GROUP_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveStoredGroupId(groupId: string) {
  try {
    localStorage.setItem(GROUP_STORAGE_KEY, groupId);
  } catch {
    // ignore
  }
}
