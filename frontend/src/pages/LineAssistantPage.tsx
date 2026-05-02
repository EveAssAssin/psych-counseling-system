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
              {selectedConv?.needs_reply && (
                <div style={{
                  marginLeft: 'auto',
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
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {msgLoading && <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>載入訊息中...</div>}
              {!msgLoading && messages.map((m: Message) => (
                <MessageBubble key={m.id} message={m} />
              ))}
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

// ── MessageBubble ──
function MessageBubble({ message }: { message: Message }) {
  const isInbound = message.direction === 'inbound';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isInbound ? 'flex-start' : 'flex-end',
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: '70%',
        background: isInbound ? '#fff' : 'linear-gradient(135deg, #0284c7, #0369a1)',
        color: isInbound ? '#111827' : '#fff',
        borderRadius: isInbound ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
        padding: '10px 14px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        fontSize: 14,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        <div>{message.message_text}</div>
        <div style={{
          fontSize: 11,
          marginTop: 4,
          opacity: 0.65,
          textAlign: isInbound ? 'left' : 'right',
        }}>
          {!isInbound && message.author_name && <span style={{ marginRight: 6 }}>{message.author_name}</span>}
          {fmtTime(message.message_time)}
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
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>AI 在生成回覆建議時會參考這些規範</p>
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
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {cat}
          </div>
          {(guidelines as Guideline[])
            .filter(g => g.category === cat)
            .map(g => (
              <div key={g.id} style={{
                background: '#fff',
                border: `1px solid ${g.is_active ? '#e5e7eb' : '#f3f4f6'}`,
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 8,
                opacity: g.is_active ? 1 : 0.5,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#111827' }}>
                    {g.title}
                    {!g.is_active && <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>（已停用）</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>{g.content}</div>
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
