### Task 6: Web 鈥?types + workbench page shell

**Files:**
- Create: `apps/web/src/components/handbook/types.ts`
- Create: `apps/web/src/components/handbook/handbook-app.tsx`锛堝厛绌哄３锛氬姞杞藉垎绫?绗旇鐘舵€侊紝涓夋爮鍗犱綅锛?
- Create: `apps/web/src/app/workbench/apps/handbook/page.tsx`

**Interfaces:**
- Produces: `HandbookCategory`, `HandbookNote` 绫诲瀷涓?`HandbookApp` 缁勪欢

- [ ] **Step 1: types.ts**

```ts
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

/** 宸︽爮閫変腑锛氬叏閮?| 鏈垎绫?| 鏌愬垎绫?id */
export type CategorySelection = 'all' | 'uncategorized' | string;
```

- [ ] **Step 2: handbook-app.tsx 鏈€灏忓３**

- `useEffect` 鎷?`/apps/handbook/categories` 涓庢寜 selection 鎷?`/apps/handbook/notes`
- state锛歚categories`, `notes`, `selection`, `selectedNoteId`, `query`, `loading`
- 涓夋爮 div 缁撴瀯 + className `handbook-app`锛堝瓙缁勪欢涓嬩换鍔″啀濉級

- [ ] **Step 3: page.tsx**

```tsx
'use client';
import { HandbookApp } from '@/components/handbook/handbook-app';

export default function HandbookPage() {
  return <HandbookApp />;
}
```

- [ ] **Step 4: 娴忚鍣ㄦ墦寮€ `/workbench/apps/handbook`**

Expected: 涓?404锛涜兘杩涘３锛圓PI 鑻?403 鏄剧ず鏃犳潈鎻愮ず锛夈€?

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/handbook apps/web/src/app/workbench/apps/handbook
git commit -m "feat(web): scaffold handbook workbench page"
```

---
