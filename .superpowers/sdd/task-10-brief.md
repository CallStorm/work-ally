### Task 10: Spec 鐘舵€?+ 鍐掔儫娓呭崟

**Files:**
- Modify: `docs/superpowers/specs/2026-08-29-handbook-personal-notes-design.md`锛堢姸鎬佹敼涓哄凡瀹炵幇鎴栥€屽疄鐜颁腑銆嶆寜浜嬪疄锛?

- [ ] **Step 1: 绔埌绔啋鐑?*

| # | 姝ラ | 鏈熸湜 |
|---|---|---|
| 1 | 宸ヤ綔鍙?鈫?搴旂敤 鈫?鎵嬪唽 | 杩涘叆涓夋爮 |
| 2 | 寤哄垎绫汇€岃繍缁淬€嶁啋 瀛愮被銆屽彂甯冦€?| 鏍戞纭?|
| 3 | 鍦ㄣ€屽彂甯冦€嶄笅鏂板缓绗旇鍐?Markdown | 鑷姩淇濆瓨 |
| 4 | 鎼滅储鍏抽敭璇?| 鍒楄〃杩囨护 |
| 5 | 鍒犲垎绫伙紙鏃犲瓙锛?| 绗旇杩涙湭鍒嗙被 |
| 6 | 绠＄悊绔叧闂墜鍐?| 鍒楄〃涓嶅彲鐢?/ API 403 |
| 7 | 涓庨棯绛句簰涓嶅奖鍝?| 涓よ竟鏁版嵁鐙珛 |

- [ ] **Step 2: Commit docs if status changed**

```bash
git add docs/superpowers/specs/2026-08-29-handbook-personal-notes-design.md
git commit -m "docs: mark handbook design as implemented"
```

---

## Spec coverage check

| Spec 椤?| Task |
|---------|------|
| App slug/璺敱/鍚嶇О | 1, 3, 6, 9 |
| 鍒嗙被 鈮? 灞?+ 鍒犲垎绫荤瑪璁板綊鏈垎绫?| 4, 7 |
| 绗旇 Markdown CRUD + 缃《 | 5, 8 |
| 鍏ㄥ眬鎼滅储 | 5, 8 |
| 涓夋爮 IA | 6鈥? |
| AppRegistry + ACL Guard | 3 |
| Admin 寮€鍏?| 3, 9 |
| 涓庨棯绛?缁勭粐鐭ヨ瘑搴撲笉閲嶅彔 | 鍏ㄧ▼鏃犳棩鍘?RAG |
| AI 寮曠敤棰勭暀锛堜笉鍋氾級 | 鏃?Task 鈥?姝ｇ‘ |
| body 瓒呴檺鎷掔粷 | 1 + 5锛圸od锛?|
| 绀轰緥绗旇 | 8 鍙€?|

## Placeholder / consistency notes

- `categoryId=uncategorized` 涓哄垪琛ㄦ煡璇㈢害瀹氬瓧绗︿覆锛岄潪 DB id
- `HANDBOOK_SLUG` 涓庨棯绛句竴鏍峰湪 shared 瀵煎嚭
- Admin list 蹇呴』杩斿洖澶氬簲鐢紝閬垮厤鎵嬪唽 seed 鍚庣鐞嗙浠嶅彧瑙侀棯绛?
