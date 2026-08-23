'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetch } from '@/lib/api';
import {
  loadStoredGroupId,
  saveStoredGroupId,
  type UserGroup,
} from '@/lib/group';
import { useAuth } from '@/lib/auth';

type GroupContextValue = {
  groups: UserGroup[];
  currentGroupId: string | null;
  currentGroup: UserGroup | null;
  setCurrentGroupId: (id: string) => void;
  loading: boolean;
  refreshGroups: () => Promise<void>;
};

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [currentGroupId, setCurrentGroupIdState] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const refreshGroups = useCallback(async () => {
    if (!auth) {
      setGroups([]);
      setCurrentGroupIdState(null);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ groups: UserGroup[] }>('/auth/me/groups');
      setGroups(data.groups);
      const stored = loadStoredGroupId();
      const validStored = data.groups.find((g) => g.id === stored)?.id;
      const fallback =
        validStored ??
        data.groups.find((g) => g.id === auth.defaultGroupId)?.id ??
        data.groups[0]?.id ??
        null;
      setCurrentGroupIdState(fallback);
      if (fallback) saveStoredGroupId(fallback);
    } catch {
      setGroups([]);
      setCurrentGroupIdState(auth.defaultGroupId);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void refreshGroups();
  }, [refreshGroups]);

  const setCurrentGroupId = useCallback((id: string) => {
    setCurrentGroupIdState(id);
    saveStoredGroupId(id);
  }, []);

  const currentGroup = useMemo(
    () => groups.find((g) => g.id === currentGroupId) ?? null,
    [groups, currentGroupId],
  );

  const value = useMemo(
    () => ({
      groups,
      currentGroupId,
      currentGroup,
      setCurrentGroupId,
      loading,
      refreshGroups,
    }),
    [
      groups,
      currentGroupId,
      currentGroup,
      setCurrentGroupId,
      loading,
      refreshGroups,
    ],
  );

  return (
    <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
  );
}

export function useCurrentGroup() {
  const ctx = useContext(GroupContext);
  if (!ctx) {
    throw new Error('useCurrentGroup must be used within GroupProvider');
  }
  return ctx;
}
