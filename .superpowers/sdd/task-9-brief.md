### Task 9: Apps list card + CSS + Admin page

**Files:**
- Modify: `apps/web/src/app/workbench/apps/page.tsx`
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/admin/apps/handbook/page.tsx`
- Modify: admin 瀵艰埅锛堣嫢鏈夊簲鐢ㄩ摼鎺ュ垪琛紝澧炲姞鎵嬪唽锛涙悳绱?`admin/apps/stickies` 寮曠敤澶勪竴骞跺姞涓?handbook锛?

- [ ] **Step 1: apps list**

瀵?`slug === 'handbook'` 浣跨敤涓撶敤 class锛堝 `apps-list-page__card--handbook`锛変笌涓€琛?meta锛歚鍒嗙被 路 Markdown 路 鎼滅储`銆?

- [ ] **Step 2: globals.css**

澧炲姞涓夋爮甯冨眬锛堝乏绾?200px銆佷腑绾?260px銆佸彸寮规€э級銆佹爲缂╄繘銆佺紪杈戝尯 textarea 绛夐珮銆佸皬灞忓彲鏀逛负涓婁笅鍫嗗彔锛堢畝鍗?`max-width` 濯掍綋鏌ヨ鍗冲彲锛夈€?

- [ ] **Step 3: Admin handbook page**

澶嶅埗 `admin/apps/stickies/page.tsx` 绮剧畝鐗堬細鏍囬銆屽簲鐢?路 鎵嬪唽銆嶏紱璇存槑涓汉宸ヤ綔娴佺▼绗旇锛涘紑鍏?`enabled` + `visibility`锛堣嫢闂椤垫湁 ACL UI 鍒欏悓鏍锋帴 `/admin/apps/handbook` 鐨?entries鈥斺€旀棤鍒欏彧鍋?enabled/visibility锛屼笌闂褰撳墠鑳藉姏瀵归綈锛夈€?

- [ ] **Step 4: 鎵惧埌 admin 渚ф爮/閾炬帴**

Grep `apps/stickies`锛屼负 handbook 澧炲姞瀵圭瓑閾炬帴銆?

- [ ] **Step 5: Lint web + 鎵嬮獙**

Run: `pnpm --filter @work-ally/web lint`  
鎵嬮獙锛氬簲鐢ㄥ垪琛ㄤ袱寮犲崱銆佺鐞嗙鍙叧鎵嬪唽銆佸叧闂悗宸ヤ綔鍙颁笉鍙敤銆?

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/workbench/apps/page.tsx \
  apps/web/src/app/globals.css \
  apps/web/src/app/admin/apps/handbook
# 浠ュ強鏀瑰姩鐨?admin nav 鏂囦欢
git commit -m "feat(web): handbook app card, styles, and admin page"
```

---
