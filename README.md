# ❄️ 00OO 北海道蜜月 2027

[![Deploy to GitHub Pages](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/deploy.yml/badge.svg)](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live_Demo-00OOhoneymoon2027-38bdf8?style=flat&logo=github)](https://timmatt-lee.github.io/00OOhoneymoon2027/)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0-646cff?style=flat&logo=vite&logoColor=white)
![Playwright](https://img.shields.io/badge/E2E-Playwright-2ead33?style=flat&logo=playwright&logoColor=white)

2027 年 3 月（`2027/03/02 – 03/13`）北海道 12 天 11 夜冬季婚紗蜜月自由行互動行程手冊（Mobile-First Web App / PWA）。

👉 **線上互動預覽：[https://timmatt-lee.github.io/00OOhoneymoon2027/](https://timmatt-lee.github.io/00OOhoneymoon2027/)**

---

## 📱 12 日行程與視差風景預覽

> 以下預覽圖由 Playwright E2E 測試套件（`tests/screenshots/day-01.png` ～ `day-12.png`）自動產出，並由 `.githooks/pre-commit` 與 `.githooks/pre-push` 強制確保與最新程式碼 100% 同步。

| Day 1 · 3/2 (二)<br>抵達新千歲・札幌夜空 | Day 2 · 3/3 (三)<br>札幌市區・百貨巡禮 | Day 3 · 3/4 (四)<br>札幌街景・前往旭川 | Day 4 · 3/5 (五)<br>旭川雪景・婚紗前夕 |
| :---: | :---: | :---: | :---: |
| <img src="tests/screenshots/day-01.png" width="190" alt="Day 1"/> | <img src="tests/screenshots/day-02.png" width="190" alt="Day 2"/> | <img src="tests/screenshots/day-03.png" width="190" alt="Day 3"/> | <img src="tests/screenshots/day-04.png" width="190" alt="Day 4"/> |
| **Day 5 · 3/6 (六)**<br>**美瑛雪原・夢幻婚紗** | **Day 6 · 3/7 (日)**<br>**支笏湖畔・秘境溫泉** | **Day 7 · 3/8 (一)**<br>**登別地獄谷・名湯巡禮** | **Day 8 · 3/9 (二)**<br>**洞爺湖・羊蹄山牧場** |
| <img src="tests/screenshots/day-05.png" width="190" alt="Day 5"/> | <img src="tests/screenshots/day-06.png" width="190" alt="Day 6"/> | <img src="tests/screenshots/day-07.png" width="190" alt="Day 7"/> | <img src="tests/screenshots/day-08.png" width="190" alt="Day 8"/> |
| **Day 9 · 3/10 (三)**<br>**JR 海景列車・小樽運河** | **Day 10 · 3/11 (四)**<br>**紅磚廳舍・札幌夜色** | **Day 11 · 3/12 (五)**<br>**時計台・電視塔・薄野** | **Day 12 · 3/13 (六)**<br>**新千歲機場・滿載返台** |
| <img src="tests/screenshots/day-09.png" width="190" alt="Day 9"/> | <img src="tests/screenshots/day-10.png" width="190" alt="Day 10"/> | <img src="tests/screenshots/day-11.png" width="190" alt="Day 11"/> | <img src="tests/screenshots/day-12.png" width="190" alt="Day 12"/> |

---

## ✨ 設計與技術亮點

* **Stories 膠囊導覽與連續手勢滑動**：支援左右拖拽（連續插值預覽跨日天空漸層與時間軸節點）、左右半部點擊切換、頂部進度條點選及鍵盤方向鍵導覽。
* **5 組多層次 SVG 視差地景（Parallax Scene Groups）**：
  * 依行程動線分為 5 組遠景（`0.38x`）、中景（`0.68x`）、前景（`1.0x`）純向量剪影，並搭配首尾日（Day 1 / Day 12）客機升降動畫與薄野 NORBESA 摩天輪旋轉特效。
  * 一鍵點擊底部地景即可開啟對應當日地標的 Google Maps 導航。
* **零 GC 負擔的 Canvas 氣候粒子系統**：
  * `SnowfallEffect`：全行程北海道飄雪（Day 5 美瑛婚紗日自動切換為浪漫粉雪色調）。
  * `OnsenSteamEffect`：Day 6 支笏湖與 Day 7 登別露天岩風呂上方動態升起的柔和溫泉白煙。
  * `NightGlowEffect`：Day 9–11 小樽與札幌夜間暖黃光暈粒子。
  * 內建固定種子 PRNG（Mulberry32），確保 Playwright E2E 截圖達到 pixel-perfect 確定性比對。

---

## 🗂️ 專案目錄結構

```text
00OOhoneymoon2027/
├── src/
│   ├── assets/scenes/       # 17 張分層 SVG 地景 (group0~4 bg/mid/fg + 首尾日客機)
│   ├── content/
│   │   ├── day-themes.json  # 12 天天空漸層、日夜主題、地圖查詢與視差步進設定
│   │   └── days/            # 01_0302.csv ~ 12_0313.csv 每日行程純資料檔
│   ├── effects/             # Canvas 飄雪、溫泉白煙、夜間微光粒子引擎
│   ├── engine/              # CSV 解析驗證、DOM 渲染、視差插值、手勢與時間軸控制
│   ├── styles/              # 模組化 SCSS (_variables, _layout, _animations)
│   └── types/               # Zod Schema 與 TypeScript 型別定義
├── tests/
│   ├── unit/                # Vitest 單元測試 (CSV 格式、時間遞增與無重複時段驗證)
│   ├── e2e/                 # Playwright 視覺碰撞檢測與 12 日全螢幕截圖驗證
│   └── screenshots/         # 自動化驗證之 day-01.png ~ day-12.png 基準截圖
└── .githooks/               # pre-commit 與 pre-push 自動化驗證與截圖同步防線
```

---

## 📝 行程修改指南（CSV 編輯小抄）

每日行程獨立存放於 `src/content/days/01_0302.csv` ～ `12_0313.csv`，修改行程無須觸碰任何 TypeScript 或 HTML 程式碼：

1. **CSV 欄位格式**：
   ```csv
   time,title,subtitle
   08:50,桃園機場第一航廈 TR892 起飛,預辦登機・機上餐點與 Wi-Fi 已預訂
   13:35,抵達新千歲國際機場 (CTS),辦理入境與領取行李
   ```
2. **自動防呆驗證規則（由 `tests/unit/schema.test.ts` 檢查）**：
   * `time` 必須為 24 小時制 `HH:MM`（例如 `08:50`、`19:30`）。
   * 同一天內的時間必須**嚴格由早到晚遞增**，且不可有重複的時間點。
   * 每天建議維持 `1 ~ 6` 個重點行程，確保在手機單一畫面內完美呈現、不產生垂直捲軸。
3. **修改後的更新截圖與提交流程**：
   因為 `.githooks/pre-commit` 會自動比對最新畫面與 `tests/screenshots/`，修改完 CSV 或樣式後請執行：
   ```bash
   # 1. 重新編譯並讓 Playwright 自動重拍 12 張最新截圖
   npm run build && npm run test:e2e

   # 2. 將修改的檔案與更新後的截圖一併加入並提交推送
   git add -A
   git commit -m "chore: update schedule"
   git push origin main
   ```

---

## 🛠️ 本地開發與測試指令

```bash
# 啟動本地開發伺服器
npm run dev

# 執行 TypeScript 型別檢查與單元測試
npm run typecheck && npm run test:unit

# 打包生產環境並執行 Playwright E2E 測試 (自動更新 tests/screenshots/)
npm run build && npm run test:e2e
```
