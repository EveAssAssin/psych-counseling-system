# Google OAuth 設定指南

## 步驟 1: 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點擊頂部的專案選擇器 → **新增專案**
3. 專案名稱：`psych-counseling-system`
4. 點擊 **建立**

## 步驟 2: 啟用 OAuth API

1. 在左側選單選擇 **API 和服務** → **已啟用的 API 和服務**
2. 點擊 **+ 啟用 API 和服務**
3. 搜尋 `Google+ API` 並啟用（或 `Google People API`）

## 步驟 3: 設定 OAuth 同意畫面

1. 左側選單 **API 和服務** → **OAuth 同意畫面**
2. 選擇 **外部** → **建立**
3. 填寫以下資訊：
   - 應用程式名稱：`心理輔導系統`
   - 使用者支援電子郵件：你的 Email
   - 開發人員聯絡資訊：你的 Email
4. 點擊 **儲存並繼續**
5. 範圍：點擊 **新增或移除範圍**
   - 勾選 `email`
   - 勾選 `profile`
   - 勾選 `openid`
6. 點擊 **更新** → **儲存並繼續**
7. 測試使用者：新增你自己的 Email
8. **儲存並繼續** → **返回資訊主頁**

## 步驟 4: 建立 OAuth 憑證

1. 左側選單 **API 和服務** → **憑證**
2. 點擊 **+ 建立憑證** → **OAuth 用戶端 ID**
3. 應用程式類型：**網頁應用程式**
4. 名稱：`psych-system-web`
5. 已授權的 JavaScript 來源：
   ```
   http://localhost:3000
   http://localhost:5173
   ```
6. 已授權的重新導向 URI：
   ```
   http://localhost:3000/api/auth/google/callback
   ```
7. 點擊 **建立**

## 步驟 5: 複製憑證

建立完成後會顯示：
- **用戶端 ID**：`xxxxxx.apps.googleusercontent.com`
- **用戶端密碼**：`GOCSPX-xxxxxx`

## 步驟 6: 更新 .env 檔案

將取得的憑證填入 `/backend/.env`：

```env
GOOGLE_CLIENT_ID=你的用戶端ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-你的用戶端密碼
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

## 注意事項

- 開發階段使用「測試」模式，只有加入測試使用者的 Email 可以登入
- 正式上線前需要提交 OAuth 驗證申請
- 如果要使用正式網域，記得更新重新導向 URI
