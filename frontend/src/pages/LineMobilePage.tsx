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
  is_system_message?: boolean;
  is_manual_insert?: boolean;
}
interface EmployeeSummary {
  riskFlags: any[];
  notes: any[];
  orderTrend: any;
  feedbackStats: any;
  reviews: any[];
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
//  Mobile Employee Info Panel
// ════════════════════════════════════════
function MobileEmpInfoPanel({ summary, loading }: { summary: EmployeeSummary | null; loading: boolean }) {
  const [section, setSection] = useState<'ai' | 'orders' | 'feedback'>('ai');

  const secBtn = (key: 'ai' | 'orders' | 'feedback', label: string) => (
    <button
      onClick={() => setSection(key)}
      style={{
        flex: 1, padding: '6px 0', border: 'none',
        background: section === key ? '#0284c7' : '#e2e8f0',
        color: section === key ? '#fff' : '#475569',
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        borderRadius: 6, transition: 'all 0.15s',
      }}
    >{label}</button>
  );

  if (loading) {
    return (
      <div style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        載入員工資訊中...
      </div>
    );
  }
  if (!summary) {
    return (
      <div style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        無員工資料
      </div>
    );
  }

  const { riskFlags, notes, orderTrend, feedbackStats } = summary;

  const renderAI = () => (
    <div>
      {/* Risk flags */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>⚠️ 風險標記 ({riskFlags?.length || 0})</div>
        {!riskFlags?.length ? (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>無風險標記</div>
        ) : riskFlags.slice(0, 3).map((f: any, i: number) => {
          const color = f.severity === 'critical' ? '#dc2626' : f.severity === 'high' ? '#f97316' : '#f59e0b';
          return (
            <div key={i} style={{ background: '#fff', border: `1px solid ${color}30`, borderLeft: `3px solid ${color}`, borderRadius: 6, padding: '5px 8px', marginBottom: 4, fontSize: 11 }}>
              <span style={{ color, fontWeight: 700 }}>{f.severity?.toUpperCase()}</span>
              <span style={{ marginLeft: 6, color: '#374151' }}>{f.title || f.risk_type}</span>
            </div>
          );
        })}
      </div>
      {/* Notes */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>📝 備註 ({notes?.length || 0})</div>
        {!notes?.length ? (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>無備註</div>
        ) : notes.slice(0, 2).map((n: any, i: number) => (
          <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 8px', marginBottom: 4, fontSize: 11 }}>
            <span style={{ color: '#92400e' }}>{n.content}</span>
            {n.supervisor_name && <span style={{ color: '#a78bfa', marginLeft: 6 }}>— {n.supervisor_name}</span>}
          </div>
        ))}
      </div>
    </div>
  );

  const renderOrders = () => {
    const tt = orderTrend?.totalTrend;
    const months = tt?.months?.slice(-4) || [];
    return (
      <div>
        {!orderTrend?.hasData ? (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>無業績資料</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1, background: '#f0f9ff', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0284c7' }}>{tt?.recentAvg?.toFixed(1) || 0}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>近期均單</div>
              </div>
              <div style={{ flex: 1, background: tt?.trend === 'up' ? '#f0fdf4' : tt?.trend === 'down' ? '#fef2f2' : '#f8fafc', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: tt?.trend === 'up' ? '#16a34a' : tt?.trend === 'down' ? '#dc2626' : '#64748b' }}>
                  {tt?.trend === 'up' ? '↑' : tt?.trend === 'down' ? '↓' : '—'}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{tt?.changePercent != null ? `${tt.changePercent > 0 ? '+' : ''}${tt.changePercent.toFixed(0)}%` : '趨勢'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 50 }}>
              {months.map((m: any, i: number) => {
                const maxVal = Math.max(...months.map((x: any) => x.count), 1);
                const h = Math.max(8, (m.count / maxVal) * 44);
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: '100%', height: h, background: '#0284c7', borderRadius: '3px 3px 0 0', opacity: 0.7 + (i * 0.1) }} />
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>{m.month}月</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderFeedback = () => {
    const fs = feedbackStats;
    if (!fs || fs.total_feedbacks === 0) {
      return <div style={{ fontSize: 11, color: '#94a3b8' }}>無客訴評價資料</div>;
    }
    const byType = fs.by_type || {};
    const byUrgency = fs.by_urgency || {};
    return (
      <div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
          {[
            { label: '總計', val: fs.total_feedbacks, color: '#6366f1' },
            { label: '待處理', val: fs.pending_count, color: '#f59e0b' },
            { label: '處理中', val: fs.processing_count, color: '#0284c7' },
            { label: '已結案', val: fs.resolved_count, color: '#16a34a' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ flex: '1 0 40%', background: '#f8fafc', border: `1px solid ${color}30`, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {Object.entries(byType).filter(([, v]) => (v as number) > 0).map(([k, v]) => {
            const labelMap: Record<string, string> = { complaint: '投訴', praise: '稱讚', suggestion: '建議', inquiry: '詢問', other: '其他' };
            const colorMap: Record<string, string> = { complaint: '#fee2e2', praise: '#d1fae5', suggestion: '#dbeafe', inquiry: '#fef3c7', other: '#f3f4f6' };
            return (
              <span key={k} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: colorMap[k] || '#f3f4f6', color: '#374151' }}>
                {labelMap[k] || k}: {v as number}
              </span>
            );
          })}
        </div>
        {(byUrgency.urgent_plus || byUrgency.urgent) ? (
          <div style={{ fontSize: 10, color: '#dc2626' }}>
            🚨 緊急：{(byUrgency.urgent_plus || 0) + (byUrgency.urgent || 0)} 件
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 14px' }}>
      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {secBtn('ai', '🤖 AI總結')}
        {secBtn('orders', '📊 業績')}
        {secBtn('feedback', '⭐ 評價')}
      </div>
      {/* Content */}
      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
        {section === 'ai' && renderAI()}
        {section === 'orders' && renderOrders()}
        {section === 'feedback' && renderFeedback()}
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

  // 員工資訊面板
  const [showEmpInfo, setShowEmpInfo] = useState(false);
  const [empSummary, setEmpSummary] = useState<EmployeeSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // 補入歷史回覆
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);
  const [insertText, setInsertText] = useState('');
  const [insertTime, setInsertTime] = useState('');
  const [inserting, setInserting] = useState(false);

  // 顯示系統訊息切換
  const [showSystemMsgs, setShowSystemMsgs] = useState(false);

  useEffect(() => {
    loadMessages();
  }, [conv.thread_id]);

  useEffect(() => {
    if (!conv.employee_app_number) return;
    setSummaryLoading(true);
    axios.get(`${API}/supervisor-hub/ai/employee-summary/${conv.employee_app_number}`)
      .then(r => setEmpSummary(r.data))
      .catch(() => setEmpSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [conv.employee_app_number]);

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

  // 補入歷史主管回覆
  const openInsert = (afterMsgId: string, afterTime: string) => {
    setInsertAfterId(afterMsgId);
    setInsertText('');
    // 預設時間：該訊息時間 + 1 分鐘
    const t = new Date(new Date(afterTime).getTime() + 60000);
    setInsertTime(t.toISOString().slice(0, 16)); // datetime-local format
  };

  const submitInsert = async () => {
    if (!insertText.trim() || !insertTime) return;
    setInserting(true);
    try {
      await axios.post(`${API}/line-assistant/insert-historical`, {
        thread_id: conv.thread_id,
        message_text: insertText,
        message_time: new Date(insertTime).toISOString(),
        employee_app_number: conv.employee_app_number,
        employee_name: conv.employee_name,
        sent_by: manager.id,
        sent_by_name: manager.name,
      });
      setInsertAfterId(null);
      setInsertText('');
      await loadMessages();
    } catch { alert('補入失敗'); }
    setInserting(false);
  };

  // 切換系統訊息標記
  const toggleSystemMsg = async (msg: Msg) => {
    const next = !msg.is_system_message;
    try {
      await axios.patch(`${API}/line-assistant/messages/${msg.id}/system-flag`, {
        is_system_message: next,
      });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_system_message: next } : m));
    } catch { alert('標記失敗'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
        color: '#fff',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 10,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
        >
          ←
        </button>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 15, flexShrink: 0,
        }}>
          {(conv.employee_name || '?').slice(-1)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{conv.employee_name}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>{conv.employee_app_number}</div>
        </div>
        {/* 員工資訊切換按鈕 */}
        <button
          onClick={() => setShowEmpInfo(v => !v)}
          style={{
            padding: '5px 10px', borderRadius: 14, border: 'none',
            background: showEmpInfo ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)',
            color: '#fff', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', flexShrink: 0,
            outline: showEmpInfo ? '1.5px solid rgba(255,255,255,0.6)' : 'none',
          }}
        >
          👤 {showEmpInfo ? '收合' : '資訊'}
        </button>
      </div>

      {/* Employee Info Panel */}
      {showEmpInfo && (
        <div style={{ flexShrink: 0 }}>
          <MobileEmpInfoPanel summary={empSummary} loading={summaryLoading} />
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {loading && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>載入中...</div>}

        {/* 系統訊息統計列 */}
        {(() => {
          const sysCount = messages.filter(m => m.is_system_message).length;
          if (sysCount === 0) return null;
          return (
            <div
              onClick={() => setShowSystemMsgs(v => !v)}
              style={{
                textAlign: 'center', fontSize: 11, color: '#94a3b8',
                padding: '4px 0 8px', cursor: 'pointer', userSelect: 'none',
              }}
            >
              {showSystemMsgs ? '▲ 隱藏' : '▼ 顯示'} {sysCount} 則系統自動訊息
            </div>
          );
        })()}

        {messages.map((m) => {
          const isIn = m.direction === 'inbound';
          const isSys = !!m.is_system_message;

          // 系統訊息折疊
          if (isSys && !showSystemMsgs) return null;

          return (
            <div key={m.id}>
              {/* 訊息氣泡 */}
              <div style={{ display: 'flex', justifyContent: isIn ? 'flex-start' : 'flex-end', marginBottom: 4, alignItems: 'flex-end', gap: 6 }}>
                {/* 系統訊息標記按鈕（左側） */}
                {isIn && (
                  <button
                    onClick={() => toggleSystemMsg(m)}
                    title={isSys ? '取消系統訊息標記' : '標記為系統訊息（自動回覆）'}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 14, opacity: isSys ? 1 : 0.25, padding: '0 2px',
                      flexShrink: 0,
                    }}
                  >
                    🤖
                  </button>
                )}

                <div style={{
                  maxWidth: '78%',
                  background: isSys
                    ? '#f1f5f9'
                    : isIn ? '#fff' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: isSys ? '#94a3b8' : isIn ? '#0f172a' : '#fff',
                  borderRadius: isIn ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                  padding: '10px 13px',
                  boxShadow: isSys ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  border: isSys ? '1px dashed #cbd5e1' : 'none',
                  position: 'relative',
                }}>
                  {isSys && (
                    <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 3 }}>系統訊息</div>
                  )}
                  {m.is_manual_insert && !isIn && (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>📝 補入</div>
                  )}
                  {!isIn && m.author_name && (
                    <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 3 }}>{m.author_name}</div>
                  )}
                  <div>{m.message_text}</div>
                  <div style={{ fontSize: 10, opacity: 0.55, marginTop: 3, textAlign: isIn ? 'left' : 'right' }}>
                    {fmtTime(m.message_time)}
                  </div>
                </div>

                {/* 系統訊息標記按鈕（右側） */}
                {!isIn && (
                  <button
                    onClick={() => toggleSystemMsg(m)}
                    title={isSys ? '取消系統訊息標記' : '標記為系統訊息'}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 14, opacity: isSys ? 1 : 0.25, padding: '0 2px',
                      flexShrink: 0,
                    }}
                  >
                    🤖
                  </button>
                )}
              </div>

              {/* 補入主管回覆按鈕（每則訊息下方） */}
              {insertAfterId === m.id ? (
                <div style={{
                  margin: '6px 0 10px',
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 12,
                  padding: 12,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>
                    📝 補入主管回覆（歷史紀錄）
                  </div>
                  <textarea
                    value={insertText}
                    onChange={e => setInsertText(e.target.value)}
                    placeholder="輸入歷史回覆內容..."
                    rows={3}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: '1px solid #bbf7d0', fontSize: 13, resize: 'none',
                      outline: 'none', boxSizing: 'border-box', marginBottom: 8,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="datetime-local"
                      value={insertTime}
                      onChange={e => setInsertTime(e.target.value)}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 8,
                        border: '1px solid #bbf7d0', fontSize: 12, outline: 'none',
                      }}
                    />
                    <button
                      onClick={submitInsert}
                      disabled={inserting || !insertText.trim()}
                      style={{
                        padding: '7px 14px', borderRadius: 8, border: 'none',
                        background: inserting || !insertText.trim() ? '#86efac' : '#16a34a',
                        color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {inserting ? '補入中...' : '確認補入'}
                    </button>
                    <button
                      onClick={() => setInsertAfterId(null)}
                      style={{
                        padding: '7px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
                        background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', marginBottom: 8, marginTop: 2 }}>
                  <button
                    onClick={() => openInsert(m.id, m.message_time)}
                    style={{
                      background: 'none',
                      border: '1px dashed #94a3b8',
                      borderRadius: 12,
                      cursor: 'pointer',
                      fontSize: 11,
                      color: '#64748b',
                      padding: '3px 14px',
                    }}
                  >
                    ＋ 補入主管回覆
                  </button>
                </div>
              )}
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
