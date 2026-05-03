import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'https://psych-counseling-backend.onrender.com';

// ────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────
interface Conversation {
  thread_id: string;
  employee_app_number: string;
  employee_name: string;
  message_time: string;
  last_direction: 'inbound' | 'outbound';
  last_message: string;
  last_message_time: string;
  needs_reply: boolean;
  has_draft: boolean;
  draft_content: string | null;
  draft_id: string | null;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  message_text: string;
  message_time: string;
  author_name?: string;
  agent_type?: string;
  is_system_message?: boolean;
  is_manual_insert?: boolean;
}

interface Guideline {
  id: string;
  title: string;
  category: string;
  content: string;
  sort_order: number;
  is_active: boolean;
}

interface AutoReplySettings {
  id: string;
  is_enabled: boolean;
  start_hour: number;
  end_hour: number;
  days_of_week: number[];
  ai_persona: string;
  delay_seconds: number;
}

// ────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────
function fmtTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

function avatarChar(name: string) {
  return name ? name.slice(-1) : '?';
}

// ────────────────────────────────────────────
//  Main Component
// ────────────────────────────────────────────
export default function LineAssistantPage() {
  const [tab, setTab] = useState<'inbox' | 'guidelines' | 'settings'>('inbox');

  // ── 會話列表 ──
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convSearch, setConvSearch] = useState('');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

  // ── 訊息詳情 ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [employee, setEmployee] = useState<{ app_number: string; name: string } | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── 回覆面板 ──
  const [replyText, setReplyText] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; line_send_status: string } | null>(null);
  const [lastOriginalMsg, setLastOriginalMsg] = useState('');

  // ── 公司規範 ──
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [glLoading, setGlLoading] = useState(false);
  const [editingGl, setEditingGl] = useState<Partial<Guideline> | null>(null);
  const [glForm, setGlForm] = useState({ title: '', category: '一般', content: '', sort_order: 0, is_active: true });

  // ── 同步 ──
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // ── 設定 ──
  const [_arSettings, setArSettings] = useState<AutoReplySettings | null>(null);
  const [arForm, setArForm] = useState<Partial<AutoReplySettings>>({});
  const [isOffHours, setIsOffHours] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ════════════════════════════════════════════
  //  Effects
  // ════════════════════════════════════════════

  useEffect(() => {
    if (tab === 'inbox') loadConversations();
    if (tab === 'guidelines') loadGuidelines();
    if (tab === 'settings') { loadAutoReplySettings(); checkOffHours(); }
  }, [tab]);

  useEffect(() => {
    if (selectedThread) loadThreadMessages(selectedThread);
  }, [selectedThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ════════════════════════════════════════════
  //  API Calls
  // ════════════════════════════════════════════

  const loadConversations = async (search?: string) => {
    setConvLoading(true);
    try {
      const { data } = await axios.get(`${API}/line-assistant/conversations`, {
        params: { limit: 50, search: search || undefined },
      });
      setConversations(data.data || []);
    } catch (e) {
      console.error(e);
    }
    setConvLoading(false);
  };

  const loadThreadMessages = async (threadId: string) => {
    setMsgLoading(true);
    setSendResult(null);
    setAiSuggestion('');
    try {
      const { data } = await axios.get(`${API}/line-assistant/conversations/${encodeURIComponent(threadId)}/messages`);
      setMessages(data.messages || []);
      setEmployee(data.employee || null);

      // 找最後一筆 inbound 訊息作為觸發來源
      const inbounds = (data.messages || []).filter((m: Message) => m.direction === 'inbound');
      if (inbounds.length > 0) setLastOriginalMsg(inbounds[inbounds.length - 1].message_text);
    } catch (e) {
      console.error(e);
    }
    setMsgLoading(false);
  };

  const generateSuggestion = async () => {
    if (!selectedThread || !lastOriginalMsg) return;
    setGenerating(true);
    setAiSuggestion('');
    try {
      const { data } = await axios.post(`${API}/line-assistant/suggest`, {
        thread_id: selectedThread,
        original_message: lastOriginalMsg,
        employee_app_number: employee?.app_number,
        employee_name: employee?.name,
      });
      setAiSuggestion(data.suggestion || '');
      setReplyText(data.suggestion || '');
    } catch (e: any) {
      alert('AI 建議生成失敗：' + (e?.response?.data?.message || e.message));
    }
    setGenerating(false);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedThread) return;
    setSending(true);
    setSendResult(null);
    try {
      const { data } = await axios.post(`${API}/line-assistant/send`, {
        thread_id: selectedThread,
        final_reply: replyText,
        original_message: lastOriginalMsg,
        ai_suggestion: aiSuggestion,
        employee_app_number: employee?.app_number,
        employee_name: employee?.name,
      });
      setSendResult(data);
      if (data.success) {
        // 重新整理會話列表
        await loadConversations(convSearch);
        // 新增一筆 outbound 到本地 messages（即時反映）
        setMessages(prev => [...prev, {
          id: 'local_' + Date.now(),
          direction: 'outbound',
          message_text: replyText,
          message_time: new Date().toISOString(),
          author_name: '主管回覆',
        }]);
        setReplyText('');
        setAiSuggestion('');
      }
    } catch (e: any) {
      setSendResult({ success: false, message: e?.response?.data?.message || e.message, line_send_status: 'failed' });
    }
    setSending(false);
  };

  // ── 手動同步 LINE 訊息 ──
  const syncMessages = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await axios.post(`${API}/sync/official-channel`);
      const created = data.total_created || 0;
      const updated = data.total_updated || 0;
      setSyncResult({ success: true, message: `同步完成！新增 ${created} 筆，更新 ${updated} 筆` });
      await loadConversations();
    } catch (e: any) {
      setSyncResult({ success: false, message: '同步失敗：' + (e?.response?.data?.message || e.message) });
    }
    setSyncing(false);
  };

  const copyToClipboard = () => {
    if (replyText) {
      navigator.clipboard.writeText(replyText).then(() => alert('已複製到剪貼板，請到 LINE 手動貼上發送'));
    }
  };

  // ── 公司規範 ──
  const loadGuidelines = async () => {
    setGlLoading(true);
    try {
      const { data } = await axios.get(`${API}/line-assistant/guidelines`);
      setGuidelines(data || []);
    } catch (e) { console.error(e); }
    setGlLoading(false);
  };

  const saveGuideline = async () => {
    try {
      if (editingGl?.id) {
        await axios.patch(`${API}/line-assistant/guidelines/${editingGl.id}`, glForm);
      } else {
        await axios.post(`${API}/line-assistant/guidelines`, glForm);
      }
      setEditingGl(null);
      setGlForm({ title: '', category: '一般', content: '', sort_order: 0, is_active: true });
      loadGuidelines();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e.message;
      alert('儲存失敗：' + msg);
    }
  };

  const deleteGuideline = async (id: string) => {
    if (!confirm('確定刪除此規範？')) return;
    await axios.delete(`${API}/line-assistant/guidelines/${id}`);
    loadGuidelines();
  };

  // ── 設定 ──
  const loadAutoReplySettings = async () => {
    try {
      const { data } = await axios.get(`${API}/line-assistant/auto-reply/settings`);
      setArSettings(data);
      setArForm(data || {});
    } catch (e) { console.error(e); }
  };

  const checkOffHours = async () => {
    try {
      const { data } = await axios.get(`${API}/line-assistant/auto-reply/off-hours`);
      setIsOffHours(data.is_off_hours);
    } catch (e) { console.error(e); }
  };

  const saveAutoReplySettings = async () => {
    setSettingsSaving(true);
    try {
      await axios.patch(`${API}/line-assistant/auto-reply/settings`, arForm);
      await loadAutoReplySettings();
      alert('設定已儲存');
    } catch (e: any) {
      alert('儲存失敗：' + (e?.response?.data?.message || e.message));
    }
    setSettingsSaving(false);
  };

  // ════════════════════════════════════════════
  //  Render
  // ════════════════════════════════════════════

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
        color: '#fff',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <span style={{ fontSize: 24 }}>💬</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>AI 訊息輔助回覆</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>LINE 官方帳號訊息管理中心</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {isOffHours && tab === 'inbox' && (
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span>🌙</span> 非辦公時間・自動回覆中
            </div>
          )}
          {tab === 'inbox' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <button
                onClick={syncMessages}
                disabled={syncing}
                style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  border: 'none',
                  background: syncing ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)',
                  color: '#fff',
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {syncing ? '⏳ 同步中...' : '🔄 同步訊息'}
              </button>
              {syncResult && (
                <div style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: syncResult.success ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
                  color: '#fff',
                }}>
                  {syncResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        padding: '0 24px',
      }}>
        {([
          { key: 'inbox', label: '📥 收件匣' },
          { key: 'guidelines', label: '📋 公司規範' },
          { key: 'settings', label: '⚙️ 自動回覆設定' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '12px 20px',
              border: 'none',
              borderBottom: tab === t.key ? '3px solid #0284c7' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? '#0284c7' : '#6b7280',
              marginRight: 4,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 0 }}>
        {tab === 'inbox' && (
          <InboxTab
            conversations={conversations}
            loading={convLoading}
            search={convSearch}
            setSearch={(s: string) => { setConvSearch(s); loadConversations(s); }}
            selectedThread={selectedThread}
            onSelectThread={setSelectedThread}
            messages={messages}
            msgLoading={msgLoading}
            employee={employee}
            messagesEndRef={messagesEndRef}
            replyText={replyText}
            setReplyText={setReplyText}
            aiSuggestion={aiSuggestion}
            generating={generating}
            onGenerateSuggestion={generateSuggestion}
            sending={sending}
            onSend={sendReply}
            onCopy={copyToClipboard}
            sendResult={sendResult}
            setSendResult={setSendResult}
          />
        )}
        {tab === 'guidelines' && (
          <GuidelinesTab
            guidelines={guidelines}
            loading={glLoading}
            editingGl={editingGl}
            glForm={glForm}
            setGlForm={setGlForm}
            onEdit={(gl: Guideline) => { setEditingGl(gl); setGlForm({ title: gl.title, category: gl.category, content: gl.content, sort_order: gl.sort_order, is_active: gl.is_active }); }}
            onNew={() => { setEditingGl({}); setGlForm({ title: '', category: '一般', content: '', sort_order: 0, is_active: true }); }}
            onCancel={() => setEditingGl(null)}
            onSave={saveGuideline}
            onDelete={deleteGuideline}
          />
        )}
        {tab === 'settings' && (
          <SettingsTab
            form={arForm}
            setForm={setArForm}
            isOffHours={isOffHours}
            saving={settingsSaving}
            onSave={saveAutoReplySettings}
          />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
//  InboxTab
// ════════════════════════════════════════════
function InboxTab({
  conversations, loading, search, setSearch,
  selectedThread, onSelectThread,
  messages, msgLoading, employee, messagesEndRef,
  replyText, setReplyText,
  aiSuggestion, generating, onGenerateSuggestion,
  sending, onSend, onCopy,
  sendResult, setSendResult,
}: any) {
  const selectedConv = conversations.find((c: Conversation) => c.thread_id === selectedThread);

  // ── 員工摘要側邊欄 ──
  const [empSummary, setEmpSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (employee?.app_number) {
      setSummaryLoading(true);
      axios.get(`${API}/supervisor-hub/ai/employee-summary/${employee.app_number}`)
        .then(r => setEmpSummary(r.data))
        .catch(() => setEmpSummary(null))
        .finally(() => setSummaryLoading(false));
    } else {
      setEmpSummary(null);
    }
  }, [employee?.app_number]);

  // ── 補入歷史回覆 ──
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);
  const [insertText, setInsertText] = useState('');
  const [insertTime, setInsertTime] = useState('');
  const [inserting, setInserting] = useState(false);

  // ── 系統訊息 ──
  const [showSystemMsgs, setShowSystemMsgs] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);

  // 同步 messages prop → localMessages
  useEffect(() => { setLocalMessages(messages); }, [messages]);

  const openInsert = (afterMsgId: string, afterTime: string) => {
    setInsertAfterId(afterMsgId);
    setInsertText('');
    const t = new Date(new Date(afterTime).getTime() + 60000);
    setInsertTime(t.toISOString().slice(0, 16));
  };

  const submitInsert = async () => {
    if (!insertText.trim() || !insertTime || !selectedThread) return;
    setInserting(true);
    try {
      await axios.post(`${API}/line-assistant/insert-historical`, {
        thread_id: selectedThread,
        message_text: insertText,
        message_time: new Date(insertTime).toISOString(),
        employee_app_number: employee?.app_number,
        employee_name: employee?.name,
        sent_by_name: '主管（補入）',
      });
      setInsertAfterId(null);
      setInsertText('');
      // 重新載入此 thread 訊息
      const { data } = await axios.get(`${API}/line-assistant/conversations/${encodeURIComponent(selectedThread)}/messages`);
      setLocalMessages(data.messages || []);
    } catch { alert('補入失敗'); }
    setInserting(false);
  };

  const toggleSystemMsg = async (msg: Message) => {
    const next = !msg.is_system_message;
    try {
      await axios.patch(`${API}/line-assistant/messages/${msg.id}/system-flag`, { is_system_message: next });
      setLocalMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_system_message: next } : m));
    } catch { alert('標記失敗'); }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 110px)' }}>
      {/* Left Panel: Conversation List */}
      <div style={{
        width: 320,
        minWidth: 260,
        background: '#fff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜尋員工姓名或訊息..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 13,
              background: '#f9fafb',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>載入中...</div>}
          {!loading && conversations.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              尚無 LINE 訊息記錄
            </div>
          )}
          {conversations.map((c: Conversation) => (
            <ConvItem
              key={c.thread_id}
              conv={c}
              selected={selectedThread === c.thread_id}
              onClick={() => onSelectThread(c.thread_id)}
            />
          ))}
        </div>
      </div>

      {/* Right Panel: Messages + Reply */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
        {!selectedThread ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: '#9ca3af',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>選擇一個對話</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>從左側列表選取員工的 LINE 對話</div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div style={{
              background: '#fff',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
                color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: 16,
              }}>
                {avatarChar(employee?.name || '?')}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{employee?.name || '未知員工'}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{employee?.app_number || selectedThread}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedConv?.needs_reply && (
                  <div style={{
                    background: '#fef2f2',
                    color: '#ef4444',
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontWeight: 600,
                  }}>
                    待回覆
                  </div>
                )}
                <button
                  onClick={() => setSidebarOpen(v => !v)}
                  title={sidebarOpen ? '收合員工資訊' : '展開員工資訊'}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    background: sidebarOpen ? '#eff6ff' : '#f9fafb',
                    color: sidebarOpen ? '#0284c7' : '#6b7280',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  👤 {sidebarOpen ? '收合' : '員工資訊'}
                </button>
              </div>
            </div>

            {/* Chat + Sidebar Row */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Chat Column */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {msgLoading && <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>載入訊息中...</div>}

              {/* 系統訊息折疊列 */}
              {(() => {
                const sysCount = localMessages.filter(m => m.is_system_message).length;
                if (!sysCount) return null;
                return (
                  <div
                    onClick={() => setShowSystemMsgs(v => !v)}
                    style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', padding: '4px 0 10px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    {showSystemMsgs ? '▲ 隱藏' : '▼ 顯示'} {sysCount} 則系統自動訊息
                  </div>
                );
              })()}

              {!msgLoading && localMessages.map((m: Message) => {
                const isSys = !!m.is_system_message;
                if (isSys && !showSystemMsgs) return null;
                const isIn = m.direction === 'inbound';

                return (
                  <div key={m.id}>
                    {/* 訊息氣泡 + 🤖 標記按鈕 */}
                    <div style={{ display: 'flex', justifyContent: isIn ? 'flex-start' : 'flex-end', marginBottom: 4, alignItems: 'flex-end', gap: 6 }}>
                      {isIn && (
                        <button onClick={() => toggleSystemMsg(m)} title={isSys ? '取消系統訊息' : '標記為系統訊息'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, opacity: isSys ? 1 : 0.2, padding: 0, flexShrink: 0 }}>
                          🤖
                        </button>
                      )}
                      <div style={{
                        maxWidth: '70%',
                        background: isSys ? '#f1f5f9' : isIn ? '#fff' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                        color: isSys ? '#94a3b8' : isIn ? '#111827' : '#fff',
                        borderRadius: isIn ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                        padding: '10px 14px',
                        boxShadow: isSys ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
                        fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        border: isSys ? '1px dashed #cbd5e1' : 'none',
                      }}>
                        {isSys && <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>系統訊息</div>}
                        {m.is_manual_insert && !isIn && <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 3 }}>📝 補入</div>}
                        <div>{m.message_text}</div>
                        <div style={{ fontSize: 11, marginTop: 4, opacity: 0.65, textAlign: isIn ? 'left' : 'right' }}>
                          {!isIn && m.author_name && <span style={{ marginRight: 6 }}>{m.author_name}</span>}
                          {fmtTime(m.message_time)}
                        </div>
                      </div>
                      {!isIn && (
                        <button onClick={() => toggleSystemMsg(m)} title={isSys ? '取消系統訊息' : '標記為系統訊息'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, opacity: isSys ? 1 : 0.2, padding: 0, flexShrink: 0 }}>
                          🤖
                        </button>
                      )}
                    </div>

                    {/* 補入歷史回覆 */}
                    {insertAfterId === m.id ? (
                      <div style={{ margin: '6px 0 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>📝 補入主管回覆（歷史紀錄）</div>
                        <textarea
                          value={insertText}
                          onChange={e => setInsertText(e.target.value)}
                          placeholder="輸入歷史回覆內容..."
                          rows={3}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
                        />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="datetime-local" value={insertTime} onChange={e => setInsertTime(e.target.value)}
                            style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 12, outline: 'none' }} />
                          <button onClick={submitInsert} disabled={inserting || !insertText.trim()}
                            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: inserting || !insertText.trim() ? '#86efac' : '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                            {inserting ? '補入中...' : '確認補入'}
                          </button>
                          <button onClick={() => setInsertAfterId(null)}
                            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        <button onClick={() => openInsert(m.id, m.message_time)}
                          style={{ background: 'none', border: '1px dashed #94a3b8', borderRadius: 12, cursor: 'pointer', fontSize: 11, color: '#64748b', padding: '3px 14px' }}>
                          ＋ 補入主管回覆
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Panel */}
            <div style={{
              background: '#fff',
              borderTop: '1px solid #e5e7eb',
              padding: 16,
            }}>
              {/* AI Suggestion Strip */}
              {aiSuggestion && (
                <div style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 10,
                  fontSize: 13,
                  color: '#0369a1',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>✨</span> AI 建議回覆
                    <button
                      onClick={() => setReplyText(aiSuggestion)}
                      style={{
                        marginLeft: 'auto', fontSize: 11, padding: '2px 8px',
                        background: '#0284c7', color: '#fff', border: 'none',
                        borderRadius: 6, cursor: 'pointer',
                      }}
                    >
                      套用
                    </button>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{aiSuggestion}</div>
                </div>
              )}

              {/* Result */}
              {sendResult && (
                <div style={{
                  padding: '8px 12px',
                  marginBottom: 10,
                  borderRadius: 8,
                  fontSize: 13,
                  background: sendResult.success ? '#f0fdf4' : '#fef2f2',
                  color: sendResult.success ? '#16a34a' : '#dc2626',
                  border: `1px solid ${sendResult.success ? '#bbf7d0' : '#fecaca'}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                }}>
                  <span>{sendResult.success ? '✅' : '❌'}</span>
                  <div style={{ flex: 1 }}>
                    {sendResult.message}
                    {sendResult.line_send_status === 'manual' && (
                      <button
                        onClick={onCopy}
                        style={{
                          marginLeft: 8, fontSize: 11, padding: '2px 8px',
                          background: '#0284c7', color: '#fff', border: 'none',
                          borderRadius: 6, cursor: 'pointer',
                        }}
                      >
                        📋 複製內容
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setSendResult(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14 }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Textarea */}
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="輸入回覆內容..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontSize: 14,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                }}
              />

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={onGenerateSuggestion}
                  disabled={generating}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #0284c7',
                    background: generating ? '#e0f2fe' : '#f0f9ff',
                    color: '#0284c7',
                    cursor: generating ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {generating ? '⏳ 生成中...' : '✨ AI 建議'}
                </button>
                <button
                  onClick={onCopy}
                  disabled={!replyText.trim()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    background: '#f9fafb',
                    color: '#374151',
                    cursor: !replyText.trim() ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                  }}
                >
                  📋 複製
                </button>
                <button
                  onClick={onSend}
                  disabled={!replyText.trim() || sending}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: !replyText.trim() || sending ? '#93c5fd' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                    color: '#fff',
                    cursor: !replyText.trim() || sending ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {sending ? '傳送中...' : '📤 送出'}
                </button>
              </div>
            </div>

              </div>{/* end Chat Column */}

              {/* Employee Info Sidebar */}
              {sidebarOpen && (
                <EmployeeInfoPanel
                  summary={empSummary}
                  loading={summaryLoading}
                />
              )}
            </div>{/* end Chat + Sidebar Row */}
          </>
        )}
      </div>
    </div>
  );
}

// ── ConvItem ──
function ConvItem({ conv, selected, onClick }: { conv: Conversation; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
        background: selected ? '#eff6ff' : 'transparent',
        borderLeft: selected ? '3px solid #0284c7' : '3px solid transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: conv.needs_reply
            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : 'linear-gradient(135deg, #06b6d4, #0284c7)',
          color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0,
        }}>
          {avatarChar(conv.employee_name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: conv.needs_reply ? 700 : 500, fontSize: 14, color: '#111827' }}>
              {conv.employee_name || conv.employee_app_number}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtTime(conv.last_message_time)}</span>
          </div>
          <div style={{
            fontSize: 12,
            color: conv.needs_reply ? '#374151' : '#9ca3af',
            fontWeight: conv.needs_reply ? 500 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}>
            {conv.last_direction === 'outbound' ? <span style={{ color: '#0284c7' }}>你：</span> : ''}
            {conv.last_message}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {conv.needs_reply && (
              <span style={{ fontSize: 10, background: '#fef2f2', color: '#ef4444', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>
                待回覆
              </span>
            )}
            {conv.has_draft && (
              <span style={{ fontSize: 10, background: '#fffbeb', color: '#f59e0b', padding: '1px 6px', borderRadius: 8 }}>
                草稿
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════
//  GuidelinesTab
// ════════════════════════════════════════════
function GuidelinesTab({ guidelines, loading, editingGl, glForm, setGlForm, onEdit, onNew, onCancel, onSave, onDelete }: any) {
  const categories = [...new Set((guidelines as Guideline[]).map(g => g.category))];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>公司規範管理</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            AI 在生成回覆建議時會參考這些規範・目前共
            <span style={{ fontWeight: 700, color: '#0284c7', margin: '0 4px' }}>
              {(guidelines as Guideline[]).filter(g => g.is_active).length}
            </span>
            筆啟用中
          </p>
        </div>
        <button
          onClick={onNew}
          style={{
            padding: '8px 18px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          ＋ 新增規範
        </button>
      </div>

      {/* Edit Form */}
      {editingGl !== null && (
        <div style={{
          background: '#fff',
          border: '2px solid #bae6fd',
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#0369a1' }}>
            {editingGl?.id ? '編輯規範' : '新增規範'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>標題</label>
              <input
                value={glForm.title}
                onChange={e => setGlForm((f: any) => ({ ...f, title: e.target.value }))}
                style={inputStyle}
                placeholder="規範標題"
              />
            </div>
            <div>
              <label style={labelStyle}>分類</label>
              <input
                value={glForm.category}
                onChange={e => setGlForm((f: any) => ({ ...f, category: e.target.value }))}
                style={inputStyle}
                placeholder="分類（如：溝通禮儀）"
              />
            </div>
            <div>
              <label style={labelStyle}>排序</label>
              <input
                type="number"
                value={glForm.sort_order}
                onChange={e => setGlForm((f: any) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>規範內容</label>
            <textarea
              value={glForm.content}
              onChange={e => setGlForm((f: any) => ({ ...f, content: e.target.value }))}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' as const, lineHeight: 1.6 }}
              placeholder="詳細說明此規範的要求..."
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={glForm.is_active}
                onChange={e => setGlForm((f: any) => ({ ...f, is_active: e.target.checked }))}
              />
              啟用
            </label>
            <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 13 }}>取消</button>
            <button
              onClick={onSave}
              disabled={!glForm.title || !glForm.content}
              style={{
                padding: '7px 20px', borderRadius: 8, border: 'none',
                background: !glForm.title || !glForm.content ? '#93c5fd' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#fff', cursor: !glForm.title || !glForm.content ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              儲存
            </button>
          </div>
        </div>
      )}

      {/* Guidelines List */}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>載入中...</div>}
      {!loading && guidelines.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#fff', borderRadius: 12 }}>
          尚無規範，請點擊「新增規範」建立
        </div>
      )}
      {categories.map((cat: string) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            {cat}
          </div>
          {(guidelines as Guideline[])
            .filter(g => g.category === cat)
            .map(g => (
              <div key={g.id} style={{
                background: '#fff',
                border: `1px solid ${g.is_active ? '#e5e7eb' : '#f3f4f6'}`,
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 6,
                opacity: g.is_active ? 1 : 0.55,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{ fontSize: 15 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{g.title}</span>
                  {!g.is_active && <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>已停用</span>}
                  <span style={{ marginLeft: 10, fontSize: 11, color: '#9ca3af' }}>
                    {g.content.length} 字
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => onEdit(g)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 12 }}
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => onDelete(g.id)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff5f5', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                  >
                    刪除
                  </button>
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════
//  SettingsTab
// ════════════════════════════════════════════
function SettingsTab({ form, setForm, isOffHours, saving, onSave }: any) {
  const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

  const toggleDay = (d: number) => {
    const current: number[] = form.days_of_week || [];
    const newDays = current.includes(d) ? current.filter((x: number) => x !== d) : [...current, d];
    setForm((f: any) => ({ ...f, days_of_week: newDays }));
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      {/* Status card */}
      <div style={{
        background: isOffHours ? '#f0fdf4' : '#fff',
        border: `2px solid ${isOffHours ? '#bbf7d0' : '#e5e7eb'}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 32 }}>{isOffHours ? '🌙' : '☀️'}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>
            目前：{isOffHours ? '非辦公時間' : '辦公時間'}
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            {isOffHours
              ? form.is_enabled ? '自動回覆已啟用，將自動回覆新訊息' : '非辦公時間但自動回覆尚未啟用'
              : '目前為辦公時間，不會觸發自動回覆'}
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#111827' }}>⚙️ 自動回覆設定</h2>

        {/* Enable toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>啟用自動回覆</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>在非辦公時間自動以 AI 回覆員工訊息</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
            <input
              type="checkbox"
              checked={!!form.is_enabled}
              onChange={e => setForm((f: any) => ({ ...f, is_enabled: e.target.checked }))}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute', cursor: 'pointer', inset: 0,
              background: form.is_enabled ? '#0284c7' : '#d1d5db',
              borderRadius: 24, transition: '0.3s',
            }}>
              <span style={{
                position: 'absolute',
                height: 18, width: 18, left: form.is_enabled ? 22 : 4, bottom: 3,
                background: '#fff', borderRadius: '50%', transition: '0.3s',
              }} />
            </span>
          </label>
        </div>

        {/* Time Range */}
        <div style={{ padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>非辦公時段</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <label style={{ ...labelStyle, marginBottom: 4 }}>開始時間</label>
              <select
                value={form.start_hour ?? 18}
                onChange={e => setForm((f: any) => ({ ...f, start_hour: parseInt(e.target.value) }))}
                style={{ ...inputStyle, width: 100 }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div style={{ color: '#6b7280', marginTop: 16 }}>→ 隔天</div>
            <div>
              <label style={{ ...labelStyle, marginBottom: 4 }}>結束時間</label>
              <select
                value={form.end_hour ?? 9}
                onChange={e => setForm((f: any) => ({ ...f, end_hour: parseInt(e.target.value) }))}
                style={{ ...inputStyle, width: 100 }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Days of Week */}
        <div style={{ padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>假日（全天不辦公）</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {DAY_LABELS.map((label, d) => {
              const selected = (form.days_of_week || []).includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  style={{
                    width: 40, height: 40,
                    borderRadius: '50%',
                    border: selected ? 'none' : '1px solid #e5e7eb',
                    background: selected ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#f9fafb',
                    color: selected ? '#fff' : '#374151',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>點選後為整天不辦公（全天自動回覆）</div>
        </div>

        {/* Delay */}
        <div style={{ padding: '14px 0' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>延遲回覆秒數</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number"
              value={form.delay_seconds ?? 30}
              onChange={e => setForm((f: any) => ({ ...f, delay_seconds: parseInt(e.target.value) || 0 }))}
              min={0}
              max={300}
              style={{ ...inputStyle, width: 100 }}
            />
            <span style={{ fontSize: 13, color: '#6b7280' }}>秒後自動回覆（避免即時感太強）</span>
          </div>
        </div>

        {/* Save */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              padding: '10px 28px', borderRadius: 8, border: 'none',
              background: saving ? '#93c5fd' : 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            {saving ? '儲存中...' : '💾 儲存設定'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
//  EmployeeInfoPanel
// ════════════════════════════════════════════
const SEVERITY_LABEL: Record<string, string> = {
  critical: '🔴 嚴重',
  high: '🟠 高',
  medium: '🟡 中',
  low: '🟢 低',
};
const REVIEW_TYPE_LABEL: Record<string, { label: string; bad: boolean }> = {
  positive: { label: '✅ 正面', bad: false },
  praise:   { label: '🌟 表揚', bad: false },
  negative: { label: '❌ 負面', bad: true  },
  complaint:{ label: '⚠️ 客訴', bad: true  },
  other:    { label: '📝 其他', bad: false },
};

function EmployeeInfoPanel({ summary, loading }: { summary: any; loading: boolean }) {
  const [openAi, setOpenAi] = useState(true);
  const [openPerf, setOpenPerf] = useState(true);
  const [openReview, setOpenReview] = useState(true);

  return (
    <div style={{
      width: 300,
      borderLeft: '1px solid #e5e7eb',
      background: '#fff',
      overflowY: 'auto',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', fontSize: 13, fontWeight: 700, color: '#374151' }}>
        👤 員工資訊
        {summary?.employee?.store_name && (
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: '#9ca3af' }}>
            {summary.employee.store_name}
          </span>
        )}
      </div>

      {loading && (
        <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>載入中...</div>
      )}
      {!loading && !summary && (
        <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>無員工資料</div>
      )}

      {!loading && summary && (
        <div style={{ flex: 1 }}>

          {/* ── AI 總結 ── */}
          <SidebarSection emoji="🤖" title="AI 總結" open={openAi} onToggle={() => setOpenAi(v => !v)}>
            {/* 風險標記 */}
            {summary.riskFlags && summary.riskFlags.length > 0 ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>
                  ⚠️ 風險標記（{summary.riskFlags.filter((f: any) => ['open','acknowledged','in_progress'].includes(f.status)).length} 筆進行中）
                </div>
                {summary.riskFlags.slice(0, 3).map((f: any, i: number) => (
                  <div key={i} style={{
                    background: '#fef2f2', border: '1px solid #fecaca',
                    borderRadius: 6, padding: '5px 8px', fontSize: 11,
                    color: '#dc2626', marginBottom: 4, lineHeight: 1.4,
                  }}>
                    <div style={{ fontWeight: 600 }}>
                      {SEVERITY_LABEL[f.severity] || f.severity} {f.risk_type}
                    </div>
                    {f.title && <div>{f.title}</div>}
                    {f.description && (
                      <div style={{ color: '#b91c1c', marginTop: 2 }}>
                        {f.description.slice(0, 60)}{f.description.length > 60 ? '...' : ''}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#f87171', marginTop: 2 }}>
                      {new Date(f.created_at).toLocaleDateString('zh-TW')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>✅ 無風險標記</div>
            )}
            {/* 隨手記 */}
            {summary.notes && summary.notes.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                  📝 隨手記 ({summary.notes.length})
                </div>
                {summary.notes.slice(0, 3).map((n: any, i: number) => (
                  <div key={i} style={{
                    background: '#f8fafc', borderRadius: 6, padding: '5px 8px',
                    fontSize: 11, color: '#374151', marginBottom: 4, lineHeight: 1.4,
                  }}>
                    {n.category_name && (
                      <div style={{ fontSize: 10, color: '#0284c7', marginBottom: 2 }}>{n.category_name}</div>
                    )}
                    {(n.content || '').slice(0, 80)}{(n.content || '').length > 80 ? '...' : ''}
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                      {n.supervisor_name && `${n.supervisor_name} ・ `}
                      {n.created_at ? new Date(n.created_at).toLocaleDateString('zh-TW') : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(!summary.riskFlags || summary.riskFlags.length === 0) && (!summary.notes || summary.notes.length === 0) && (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>無記錄</div>
            )}
          </SidebarSection>

          {/* ── 業績資訊 ── */}
          <SidebarSection emoji="📊" title="業績資訊" open={openPerf} onToggle={() => setOpenPerf(v => !v)}>
            {(() => {
              const ot = summary.orderTrend;
              if (!ot?.hasData || !ot.totalTrend?.months) {
                return <div style={{ fontSize: 12, color: '#9ca3af' }}>無業績資料</div>;
              }
              const months = ot.totalTrend.months as Array<{ year: number; month: number; count: number }>;
              const maxCount = Math.max(...months.map(m => m.count), 1);
              const trendIcon = ot.totalTrend.trend === 'up' ? '📈' : ot.totalTrend.trend === 'down' ? '📉' : '➡️';
              return (
                <div>
                  {/* 摘要行 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, background: '#f8fafc', borderRadius: 6, padding: '6px 8px' }}>
                    <span style={{ fontSize: 16 }}>{trendIcon}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
                        近3月均 {ot.totalTrend.recentAvg} 件
                      </div>
                      {ot.totalTrend.changePercent !== null && (
                        <div style={{ fontSize: 10, color: ot.totalTrend.changePercent >= 0 ? '#16a34a' : '#dc2626' }}>
                          vs 前3月 {ot.totalTrend.changePercent > 0 ? '+' : ''}{ot.totalTrend.changePercent}%
                        </div>
                      )}
                    </div>
                  </div>
                  {/* 月份條形圖 */}
                  {months.slice(-6).map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: '#9ca3af', width: 32, flexShrink: 0 }}>
                        {m.month}月
                      </span>
                      <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${(m.count / maxCount) * 100}%`,
                          height: '100%',
                          background: i >= 3 ? 'linear-gradient(90deg, #0284c7, #06b6d4)' : '#cbd5e1',
                          borderRadius: 4,
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', width: 24, textAlign: 'right', flexShrink: 0 }}>
                        {m.count}
                      </span>
                    </div>
                  ))}
                  {/* 標籤分類 top 2 */}
                  {ot.byLabel && ot.byLabel.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>標籤分類（近3月均）</div>
                      {ot.byLabel.slice(0, 2).map((b: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2, color: '#374151' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{b.label}</span>
                          <span style={{ fontWeight: 600, flexShrink: 0 }}>{b.recentAvg}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </SidebarSection>

          {/* ── 評價/客訴 ── */}
          <SidebarSection emoji="⭐" title="評價 / 客訴" open={openReview} onToggle={() => setOpenReview(v => !v)}>
            {(() => {
              const fs = summary.feedbackStats;
              // 優先使用 customer_feedback_stats（直接用 app_number 查，最可靠）
              if (fs && fs.total_feedbacks > 0) {
                const byType: Record<string, number> = fs.by_type || {};
                const byUrgency: Record<string, number> = fs.by_urgency || {};
                const complaint = (byType.complaint || 0) + (byType.negative || 0);
                const praise    = (byType.praise || 0) + (byType.positive || 0) + (byType.suggestion || 0);
                const urgent    = (byUrgency.urgent_plus || 0) + (byUrgency.urgent || 0);
                const TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
                  complaint:  { label: '⚠️ 客訴',   color: '#ef4444', bg: '#fef2f2' },
                  negative:   { label: '❌ 負面',    color: '#ef4444', bg: '#fef2f2' },
                  praise:     { label: '🌟 稱讚',   color: '#16a34a', bg: '#f0fdf4' },
                  positive:   { label: '✅ 正面',   color: '#16a34a', bg: '#f0fdf4' },
                  suggestion: { label: '💡 建議',   color: '#0284c7', bg: '#eff6ff' },
                  inquiry:    { label: '❓ 諮詢',   color: '#6b7280', bg: '#f9fafb' },
                  other:      { label: '📝 其他',   color: '#6b7280', bg: '#f9fafb' },
                };
                return (
                  <div>
                    {/* 總量摘要卡 */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <div style={{ flex: 1, background: '#f8fafc', borderRadius: 6, padding: '6px 0', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>{fs.total_feedbacks}</div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>總計</div>
                      </div>
                      <div style={{ flex: 1, background: '#fef2f2', borderRadius: 6, padding: '6px 0', textAlign: 'center', border: '1px solid #fecaca' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{complaint}</div>
                        <div style={{ fontSize: 10, color: '#ef4444' }}>客訴/負面</div>
                      </div>
                      <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 6, padding: '6px 0', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{praise}</div>
                        <div style={{ fontSize: 10, color: '#16a34a' }}>稱讚/正面</div>
                      </div>
                    </div>

                    {/* 各類型分佈 */}
                    {Object.entries(byType).filter(([, v]) => v > 0).map(([type, count]) => {
                      const meta = TYPE_MAP[type] || { label: type, color: '#6b7280', bg: '#f9fafb' };
                      return (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, background: meta.bg, borderRadius: 10, padding: '1px 8px', border: `1px solid ${meta.color}33` }}>{count}</span>
                        </div>
                      );
                    })}

                    {/* 急迫度 + 狀態 */}
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
                      {urgent > 0 && (
                        <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 4 }}>
                          ⚡ 緊急/緊急+ 共 {urgent} 筆
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                        {fs.pending_count > 0 && <span style={{ fontSize: 10, background: '#fffbeb', color: '#b45309', padding: '2px 6px', borderRadius: 8 }}>待處理 {fs.pending_count}</span>}
                        {fs.processing_count > 0 && <span style={{ fontSize: 10, background: '#eff6ff', color: '#0284c7', padding: '2px 6px', borderRadius: 8 }}>處理中 {fs.processing_count}</span>}
                        {fs.resolved_count > 0 && <span style={{ fontSize: 10, background: '#f0fdf4', color: '#16a34a', padding: '2px 6px', borderRadius: 8 }}>已解決 {fs.resolved_count}</span>}
                      </div>
                      {fs.latest_feedback_at && (
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                          最新：{new Date(fs.latest_feedback_at).toLocaleDateString('zh-TW')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // 次選：用 reviews 表個別記錄（可能為空）
              const records: any[] = summary.reviews || [];
              if (records.length === 0) return <div style={{ fontSize: 12, color: '#9ca3af' }}>無評價記錄</div>;
              const bad = records.filter((r: any) => ['negative','complaint'].includes(r.review_type));
              const good = records.filter((r: any) => ['positive','praise'].includes(r.review_type));
              return (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 6, padding: '5px 0', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>{good.length}</div>
                      <div style={{ fontSize: 10, color: '#16a34a' }}>正面</div>
                    </div>
                    <div style={{ flex: 1, background: '#fef2f2', borderRadius: 6, padding: '5px 0', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{bad.length}</div>
                      <div style={{ fontSize: 10, color: '#ef4444' }}>負面/客訴</div>
                    </div>
                  </div>
                  {records.slice(0, 5).map((r: any, i: number) => {
                    const meta = REVIEW_TYPE_LABEL[r.review_type] || { label: r.review_type, bad: false };
                    const dateStr = r.event_date
                      ? new Date(r.event_date).toLocaleDateString('zh-TW')
                      : r.created_at ? new Date(r.created_at).toLocaleDateString('zh-TW') : '';
                    return (
                      <div key={i} style={{
                        background: meta.bad ? '#fef2f2' : '#f8fafc',
                        border: `1px solid ${meta.bad ? '#fecaca' : '#e5e7eb'}`,
                        borderRadius: 6, padding: '6px 8px', marginBottom: 5, fontSize: 11,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, color: meta.bad ? '#ef4444' : '#16a34a' }}>{meta.label}</span>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{dateStr}</span>
                        </div>
                        {r.content && <div style={{ color: '#374151', lineHeight: 1.4 }}>{r.content.slice(0, 80)}{r.content.length > 80 ? '...' : ''}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </SidebarSection>
        </div>
      )}
    </div>
  );
}

// ── SidebarSection ──
function SidebarSection({
  emoji, title, open, onToggle, children,
}: { emoji: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid #f3f4f6' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: '#374151',
          textAlign: 'left',
        }}
      >
        <span>{emoji}</span>
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Shared Styles ──
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};
