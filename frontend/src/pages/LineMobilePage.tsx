import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = (import.meta.env.VITE_API_URL || 'https://psych-counseling-backend.onrender.com');

// ── Types ──
interface Manager { id: string; name: string; role: string; }
interface Conv {
  thread_id: string;
  employee_name: string;
  employee_app_number: string;
  last_message: string;
  last_message_time: string;
  last_direction: string;
  needs_reply: boolean;
}
interface Msg {
  id: string;
  direction: string;
  message_text: string;
  message_time: string;
  author_name?: string;
}

function fmtTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
}

// ════════════════════════════════════════
//  Login Screen
// ════════════════════════════════════════
function LoginScreen({ onLogin }: { onLogin: (m: Manager) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!identifier || !password) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${API}/supervisor-hub/auth/check`, {
        params: { identifier, password },
      });
      if (data.success && data.info) {
        onLogin(data.info);
      } else {
        setError('帳號或密碼錯誤');
      }
    } catch {
      setError('登入失敗，請稍後再試');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0284c7 0%, #06b6d4 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: 32,
        width: '100%',
        maxWidth: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>LINE 訊息助理</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>管理者回覆入口</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>帳號</label>
          <input
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            placeholder="請輸入帳號"
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: '1.5px solid #e5e7eb', fontSize: 15, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>密碼</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="請輸入密碼"
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: '1.5px solid #e5e7eb', fontSize: 15, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading || !identifier || !password}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            background: loading || !identifier || !password
              ? '#93c5fd'
              : 'linear-gradient(135deg, #0284c7, #0369a1)',
            color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '登入中...' : '登入'}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  Conversation List
// ════════════════════════════════════════
function ConvList({
  manager, onSelect, onLogout,
}: {
  manager: Manager;
  onSelect: (conv: Conv) => void;
  onLogout: () => void;
}) {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const load = async (q?: string) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/line-assistant/conversations`, {
        params: { limit: 80, search: q || undefined },
      });
      setConvs(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const { data } = await axios.post(`${API}/sync/official-channel`);
      const n = data.total_created || 0;
      setSyncMsg(n > 0 ? `已取得 ${n} 則新訊息` : '已是最新');
      await load(search);
    } catch {
      setSyncMsg('同步失敗');
    }
    setSyncing(false);
  };

  const filtered = search
    ? convs.filter(c =>
        c.employee_name?.includes(search) ||
        c.employee_app_number?.includes(search) ||
        c.last_message?.includes(search))
    : convs;

  const unread = convs.filter(c => c.needs_reply).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
        color: '#fff',
        padding: '14px 16px 10px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>LINE 訊息助理</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {manager.name}
              {unread > 0 && <span style={{ marginLeft: 8, background: '#ef4444', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{unread} 待回</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={sync}
              disabled={syncing}
              style={{
                padding: '6px 12px', borderRadius: 16, border: 'none',
                background: 'rgba(255,255,255,0.2)', color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {syncing ? '⏳' : '🔄'} {syncing ? '更新中' : '更新'}
            </button>
            <button
              onClick={onLogout}
              style={{
                padding: '6px 10px', borderRadius: 16, border: 'none',
                background: 'rgba(255,255,255,0.15)', color: '#fff',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              登出
            </button>
          </div>
        </div>

        {syncMsg && (
          <div style={{ fontSize: 11, background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '3px 10px', marginBottom: 6, textAlign: 'center' }}>
            {syncMsg}
          </div>
        )}

        <input
          value={search}
          onChange={e => { setSearch(e.target.value); load(e.target.value); }}
          placeholder="搜尋員工姓名或訊息..."
          style={{
            width: '100%', padding: '9px 14px', borderRadius: 10, border: 'none',
            fontSize: 14, background: 'rgba(255,255,255,0.95)',
            outline: 'none', boxSizing: 'border-box', color: '#0f172a',
          }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>載入中...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
            {search ? '找不到符合的對話' : '尚無訊息，請點更新'}
          </div>
        )}
        {filtered.map(conv => (
          <div
            key={conv.thread_id}
            onClick={() => onSelect(conv)}
            style={{
              padding: '14px 16px',
              background: '#fff',
              borderBottom: '1px solid #f1f5f9',
              cursor: 'pointer',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: conv.needs_reply
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #06b6d4, #0284c7)',
              color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700, fontSize: 17,
            }}>
              {(conv.employee_name || '?').slice(-1)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontWeight: conv.needs_reply ? 700 : 500, fontSize: 15, color: '#0f172a' }}>
                  {conv.employee_name || conv.employee_app_number}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, marginLeft: 8 }}>
                  {fmtTime(conv.last_message_time)}
                </span>
              </div>
              <div style={{
                fontSize: 13, color: conv.needs_reply ? '#374151' : '#94a3b8',
                fontWeight: conv.needs_reply ? 500 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {conv.last_direction !== 'inbound' && <span style={{ color: '#0284c7' }}>回：</span>}
                {conv.last_message}
              </div>
            </div>
            {conv.needs_reply && (
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#ef4444', flexShrink: 0,
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  Chat View
// ════════════════════════════════════════
function ChatView({
  conv, manager, onBack,
}: {
  conv: Conv;
  manager: Manager;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; line_send_status: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [conv.thread_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${API}/line-assistant/conversations/${encodeURIComponent(conv.thread_id)}/messages`
      );
      setMessages(data.messages || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound');

  const generateAI = async () => {
    if (!lastInbound) return;
    setGenerating(true);
    setAiSuggestion('');
    try {
      const { data } = await axios.post(`${API}/line-assistant/suggest`, {
        thread_id: conv.thread_id,
        original_message: lastInbound.message_text,
        employee_app_number: conv.employee_app_number,
        employee_name: conv.employee_name,
      });
      setAiSuggestion(data.suggestion || '');
      setReplyText(data.suggestion || '');
    } catch { /* ignore */ }
    setGenerating(false);
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const { data } = await axios.post(`${API}/line-assistant/send`, {
        thread_id: conv.thread_id,
        final_reply: replyText,
        original_message: lastInbound?.message_text || '',
        ai_suggestion: aiSuggestion,
        employee_app_number: conv.employee_app_number,
        employee_name: conv.employee_name,
        sent_by: manager.id,
        sent_by_name: manager.name,
      });
      setSendResult(data);
      if (data.success) {
        setMessages(prev => [...prev, {
          id: 'local_' + Date.now(),
          direction: 'outbound',
          message_text: replyText,
          message_time: new Date().toISOString(),
          author_name: manager.name,
        }]);
        setReplyText('');
        setAiSuggestion('');
      }
    } catch (e: any) {
      setSendResult({ success: false, message: e?.response?.data?.message || '送出失敗', line_send_status: 'failed' });
    }
    setSending(false);
  };

  const copy = () => {
    if (replyText) navigator.clipboard.writeText(replyText).then(() => alert('已複製，請到 LINE 貼上發送'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
        color: '#fff',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}
        >
          ←
        </button>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 15,
        }}>
          {(conv.employee_name || '?').slice(-1)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{conv.employee_name}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>{conv.employee_app_number}</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {loading && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>載入中...</div>}
        {messages.map(m => {
          const isIn = m.direction === 'inbound';
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isIn ? 'flex-start' : 'flex-end', marginBottom: 10 }}>
              <div style={{
                maxWidth: '78%',
                background: isIn ? '#fff' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: isIn ? '#0f172a' : '#fff',
                borderRadius: isIn ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                padding: '10px 13px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {!isIn && m.author_name && (
                  <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 3 }}>{m.author_name}</div>
                )}
                <div>{m.message_text}</div>
                <div style={{ fontSize: 10, opacity: 0.55, marginTop: 3, textAlign: isIn ? 'left' : 'right' }}>
                  {fmtTime(m.message_time)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply Panel */}
      <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '10px 14px 20px' }}>
        {/* AI suggestion */}
        {aiSuggestion && (
          <div style={{
            background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10,
            padding: '10px 12px', marginBottom: 10, fontSize: 13, color: '#0369a1',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>✨ AI 建議</span>
              <button
                onClick={() => setReplyText(aiSuggestion)}
                style={{ fontSize: 11, padding: '2px 8px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                套用
              </button>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{aiSuggestion}</div>
          </div>
        )}

        {/* Send result */}
        {sendResult && (
          <div style={{
            padding: '8px 12px', marginBottom: 10, borderRadius: 8, fontSize: 13,
            background: sendResult.success ? '#f0fdf4' : '#fef2f2',
            color: sendResult.success ? '#16a34a' : '#dc2626',
            border: `1px solid ${sendResult.success ? '#bbf7d0' : '#fecaca'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{sendResult.success ? '✅ ' : '❌ '}{sendResult.message}</span>
            <button onClick={() => setSendResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
          </div>
        )}

        <textarea
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          placeholder="輸入回覆..."
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            border: '1.5px solid #e5e7eb', fontSize: 14, resize: 'none',
            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5,
          }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={generateAI}
            disabled={generating || !lastInbound}
            style={{
              flex: 1, padding: '11px', borderRadius: 10,
              border: '1.5px solid #0284c7', background: generating ? '#e0f2fe' : '#f0f9ff',
              color: '#0284c7', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {generating ? '⏳ 生成中...' : '✨ AI 建議'}
          </button>
          <button
            onClick={copy}
            disabled={!replyText.trim()}
            style={{
              padding: '11px 14px', borderRadius: 10,
              border: '1.5px solid #e5e7eb', background: '#f9fafb',
              color: '#374151', fontSize: 13, cursor: 'pointer',
            }}
          >
            📋
          </button>
          <button
            onClick={sendReply}
            disabled={!replyText.trim() || sending}
            style={{
              flex: 1, padding: '11px', borderRadius: 10, border: 'none',
              background: !replyText.trim() || sending ? '#93c5fd' : 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: !replyText.trim() || sending ? 'not-allowed' : 'pointer',
            }}
          >
            {sending ? '傳送中...' : '📤 送出'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  Main
// ════════════════════════════════════════
const SESSION_KEY = 'line_mobile_manager';

export default function LineMobilePage() {
  const [manager, setManager] = useState<Manager | null>(() => {
    try {
      const s = sessionStorage.getItem(SESSION_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [selectedConv, setSelectedConv] = useState<Conv | null>(null);

  const handleLogin = (m: Manager) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(m));
    setManager(m);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setManager(null);
    setSelectedConv(null);
  };

  if (!manager) return <LoginScreen onLogin={handleLogin} />;
  if (selectedConv) return (
    <ChatView
      conv={selectedConv}
      manager={manager}
      onBack={() => setSelectedConv(null)}
    />
  );
  return (
    <ConvList
      manager={manager}
      onSelect={setSelectedConv}
      onLogout={handleLogout}
    />
  );
}
