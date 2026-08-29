export type HandbookCategory = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type HandbookNote = {
  id: string;
  title: string;
  bodyMd: string;
  categoryId: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 左栏选中：全部 | 未分类 | 某分类 id */
export type CategorySelection = 'all' | 'uncategorized' | string;
