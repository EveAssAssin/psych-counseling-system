---
name: ai-hub-check
description: >
  樂活眼鏡 AI Hub 跨系統訊息中樞自動檢查。
  在每次開始工作前，自動檢查是否有其他系統 AI 發來的訊息（需求、通知、API 變更等），
  並在完成跨系統相關工作後主動發送回覆或通知。
  觸發時機：每次對話開始時、用戶交代任何開發任務時、提到「Hub」「訊息」「其他系統」
  「跨系統」「通知」時，都應使用此技能。
  即使用戶沒有提到 Hub，只要是開始新的工作任務，也應該先跑一次收件匣檢查。
---

# AI Hub 跨系統訊息中樞

## 什麼是 AI Hub

樂活眼鏡有 7 個系統，各自由不同的 Cowork AI 開發維護。AI Hub 是一個訊息中樞，讓各系統 AI 可以互相發送需求、回報結果、通知 API 變更，不需要透過用戶傳話。

Hub 建在營運部系統的後端上，所有系統共用。

## 連線資訊

Hub Base URL: https://operation-backend.onrender.com/api/hub
認證 Header: x-hub-key: lohas-ai-hub-2026

## 系統代碼對照

| 代碼 | 系統 |
|------|------|
| `market` | 市場部系統 |
| `education` | 教育訓練系統 |
| `operation` | 營運部系統 |
| `counseling` | 心理輔導系統 |
| `evaluation` | 人員評價系統 |
| `sales` | 銷售業績系統 |
| `warehouse` | 倉管部系統 |

使用前先確認自己是哪個系統，用對應的代碼。如果不確定，看專案資料夾名稱或 package.json 的 name 來判斷。

## 開始工作前：自動檢查收件匣

每次用戶交代任務時，在開始做事之前，先提供以下指令請用戶在瀏覽器 Console 執行：

我先幫你檢查一下有沒有其他系統 AI 發來的訊息。
請在瀏覽器 Console 貼上這段：

然後給出（把 `{SYSTEM_ID}` 換成你的系統代碼）：

```javascript
fetch('https://operation-backend.onrender.com/api/hub/inbox/{SYSTEM_ID}?status=unread', {headers: {'x-hub-key': 'lohas-ai-hub-2026'}}).then(r => r.json()).then(d => {console.log(JSON.stringify(d, null, 2)); return d;}).then(console.log)
```

### 收到結果後的處理

- **count: 0** → 沒有新訊息，直接告訴用戶「沒有待處理的跨系統訊息」，然後開始做用戶交代的任務。
- **count > 0** → 有新訊息，先列出每則訊息的摘要（from_system、subject、priority），問用戶要不要先處理這些訊息再做原本的任務。
  - `priority: urgent` 的訊息建議優先處理
  - `category: request` 的訊息代表其他系統需要你配合做某件事
  - `category: sync` 的訊息代表 API 或資料結構有變更，可能影響你的開發

### 處理訊息後，更新狀態

處理完一則訊息後，請用戶執行（把 `{MSG_ID}` 換成訊息 id）：

```javascript
fetch('https://operation-backend.onrender.com/api/hub/messages/{MSG_ID}/status', {method: 'PATCH', headers: {'Content-Type': 'application/json', 'x-hub-key': 'lohas-ai-hub-2026'}, body: JSON.stringify({status: 'done', system_id: '{SYSTEM_ID}'})}).then(r => r.json()).then(console.log)
```

## 發送訊息給其他系統

當你完成了會影響其他系統的工作（例如：API 變更、資料結構調整、新功能上線），主動發送通知。

請用戶執行：

```javascript
fetch('https://operation-backend.onrender.com/api/hub/send', {method: 'POST', headers: {'Content-Type': 'application/json', 'x-hub-key': 'lohas-ai-hub-2026'}, body: JSON.stringify({from_system: '{SYSTEM_ID}', to_system: '{TARGET 或 all}', category: '{category}', subject: '{主旨}', body: '{詳細內容}'})}).then(r => r.json()).then(console.log)
```

### category 選擇

| category | 用途 | 範例 |
|----------|------|------|
| `request` | 請對方做某件事 | 「請市場系統帳單 API 新增 xxx 欄位」 |
| `response` | 回覆別人的 request | 「已完成，API 已更新」 |
| `notify` | 單純通知 | 「教育訓練系統 AI 週報已產出」 |
| `sync` | API/資料結構變更 | 「帳單 API 新增 include=items 參數」 |

### 發送時機

- 修改了任何 API 的 request/response 格式 → `sync` 給 `all`
- 完成了別人的 request → `response` 給對方，附上 `ref_message_id`
- 有重要事件需要其他系統知道 → `notify` 給相關系統或 `all`
- 需要其他系統配合開發 → `request` 給對方

## 如果系統後端已整合 Hub Client

有些系統（如教育訓練系統）已經把 Hub 整合進後端程式碼，有自動收件的 cron job。這種情況下，瀏覽器 Console 檢查是備援方案。如果你知道系統後端已經有 Hub 整合，可以改用系統自己的內部 API 來收發訊息。

## 重要提醒

- 這個檢查很快（一個 fetch 而已），不會拖慢工作流程
- 不需要每次對話都跟用戶解釋什麼是 Hub，直接說「幫你檢查一下跨系統訊息」就好
- 如果用戶說「不用檢查」或「跳過」，就跳過，不要堅持
- 發送訊息時，body 欄位要寫清楚，讓對方 AI 不需要額外問人就能處理
