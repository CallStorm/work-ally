### Task 7: Web 鈥?Category tree

**Files:**
- Create: `apps/web/src/components/handbook/category-tree.tsx`
- Modify: `apps/web/src/components/handbook/handbook-app.tsx`

**Interfaces:**
- Props: `categories`, `selection`, `onSelect`, `onCreate`, `onRename`, `onDelete`

- [ ] **Step 1: category-tree.tsx**

- 鍥哄畾椤癸細銆屽叏閮ㄣ€嶃€屾湭鍒嗙被銆?
- 鏍瑰垎绫讳笅鍒楀嚭 `parentId === null`锛涘叾瀛愰」缂╄繘鍒楀嚭
- 銆? 鍒嗙被銆嶏細prompt 鎴栬鍐呰緭鍏ュ悕绉?鈫?`POST /apps/handbook/categories`
- 鍙抽敭鎴栥€屸嫰銆嶏細閲嶅懡鍚?`PATCH`銆佸垹闄?`DELETE`锛堢‘璁わ級
- 閫変腑鎬?class `handbook-tree__item--active`

- [ ] **Step 2: 鎺ュ叆 handbook-app**

閫夋嫨鍒嗙被鏃堕噸缃?`selectedNoteId`锛堝彲閫変繚鐣欒嫢浠嶅睘璇ュ垎绫伙級锛涘埛鏂?notes 鍒楄〃銆?

- [ ] **Step 3: 鎵嬮獙**

寤轰袱灞傚垎绫汇€佸垹闄ゅ彾瀛愩€佸垹鐖跺墠鏈夊瓙搴旂湅鍒伴敊璇彁绀恒€?

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/handbook
git commit -m "feat(web): handbook category tree"
```

---
