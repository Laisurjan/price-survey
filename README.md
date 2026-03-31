# 說故事學行銷 × 實地詢價任務

多元選修課線上學習單系統，讓學生在全聯福利中心、花蓮縣農會超市實地訪價時，用手機即時填寫。

## 功能

- 學生填寫基本資料（班級、座號、姓名、組別）後進入學習單
- 商品資料蒐集、現場觀察、定價分析、競爭策略、延伸思考
- 暫存草稿 / 正式送出
- 老師後台：查看所有學生填寫狀況、篩選組別、檢視個別內容
- 發布控制：老師可開啟「組內互看」或「全班互看」，學生只能看不能改

## 快速開始

### 1. 建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 建立新專案（或使用現有專案）
3. 在專案中新增「網頁應用程式」
4. 複製 Firebase 設定

### 2. 啟用 Firestore

1. 在 Firebase Console 左側選單點「Firestore Database」
2. 點「建立資料庫」
3. 選擇「以測試模式啟動」（或使用本專案的 `firestore.rules`）
4. 選擇地區（建議 `asia-east1` 台灣）

### 3. 填入設定

編輯 `firebase-config.js`，將 Firebase Console 給你的設定值貼入：

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 4. 部署到 GitHub Pages

```bash
git add .
git commit -m "init"
git push
```

到 GitHub repo → Settings → Pages → Source 選 `main` branch → Save。

幾分鐘後即可透過 `https://你的帳號.github.io/price-survey/` 存取。

## 老師密碼

預設密碼：`teacher2025`

如需修改，編輯 `app.js` 第 16 行的 `TEACHER_PASSWORD`。

## 技術架構

- 純前端 HTML/CSS/JS（無框架）
- Firebase Firestore 即時資料庫
- 可部署於 GitHub Pages（免費）
