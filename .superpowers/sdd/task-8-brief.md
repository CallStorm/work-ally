### Task 8: Web 鈥?Note list + editor + search + autosave

**Files:**
- Create: `apps/web/src/components/handbook/note-list.tsx`
- Create: `apps/web/src/components/handbook/note-editor.tsx`
- Modify: `apps/web/src/components/handbook/handbook-app.tsx`

**Interfaces:**
- List: 灞曠ず title銆佹洿鏂版椂闂淬€佺疆椤舵爣璁帮紱銆? 鏂板缓銆嶁啋 `POST` 鍚庨€変腑
- Editor: 鏍囬 input + Markdown textarea + 銆岀紪杈憒棰勮銆嶅垏鎹紱棰勮鐢?`react-markdown` + `remark-gfm`
- Autosave: 鏍囬/姝ｆ枃鍙樻洿鍚?**400鈥?00ms 闃叉姈** `PATCH /apps/handbook/notes/:id`锛堝弬鑰冮棯绛?drawer锛?
- 椤堕儴鎼滅储锛氬彈鎺?`query`锛涘彉鏇村悗閲嶆柊 `GET notes?q=&categoryId=`锛坄all` 涓嶄紶 categoryId锛沗uncategorized` 浼?`uncategorized`锛?
- 鍒犻櫎锛氱‘璁ゅ悗 `DELETE`锛屾竻绌洪€変腑

- [ ] **Step 1: note-list.tsx**

鍒楀嚭 `notes`锛涚偣鍑昏缃?`selectedNoteId`銆?

- [ ] **Step 2: note-editor.tsx**

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// mode: 'edit' | 'preview'
// onChangeTitle / onChangeBody 鈫?鐖剁粍浠堕槻鎶?save
```

绌洪€変腑鏃舵樉绀恒€岄€夋嫨鎴栨柊寤轰竴绡囩瑪璁般€嶃€?

- [ ] **Step 3: handbook-app 涓茶仈**

鏂板缓榛樿锛歚{ title: '鏃犳爣棰?, bodyMd: '', categoryId: selection 涓哄叿浣?id 鏃剁敤璇?id锛屽惁鍒?null }`銆?

鍙€夛細棣栨绌哄簱鏃跺睍绀虹ず渚嬫寜閽紝涓€閿垱寤猴細

```md
# 绀轰緥锛氬彂甯冨墠妫€鏌?

1. 纭鍙樻洿鍗?
2. 澶囦唤
3. 鎵ц鍙戝竷鑴氭湰
4. 鍐掔儫楠岃瘉
```

鐢ㄦ埛鍙垹銆?

- [ ] **Step 4: 鎵嬮獙**

缂栬緫鑷姩淇濆瓨銆佹悳绱㈠懡涓€侀瑙堜唬鐮佸潡銆佸垹闄ゃ€?

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/handbook
git commit -m "feat(web): handbook note list, editor, search, autosave"
```

---
