import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'https://psych-counseling-backend.onrender.com';

// ────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────
interface Employee { app_number: string; name: string; store_name?: string; position?: string; }
interface Category { id: string; name: string; color: string; }
interface Note { id: string; content: string; category_name?: string; supervisor_name: string; created_at: string; employee_app_number?: string; non_employee_name?: string; images?: string[]; }
interface AiMessage { role: 'user' | 'assistant'; content: string; }
interface AiSession { id: string; employee_name?: string; ai_type: string; title: string; created_at: string; }
interface AiPersona { id: string; ai_type: string; persona_name: string; system_prompt: string; model?: string; }

const AI_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  claude: { label: 'Claude',  color: '#7c3aed', emoji: '🟣' },
  openai: { label: 'GPT-4o',  color: '#059669', emoji: '🟢' },
  gemini: { label: 'Gemini',  color: '#2563eb', emoji: '🔵' },
};

// ────────────────────────────────────────────
//  Main Page
// ────────────────────────────────────────────
export default function SupervisorHubPage() {
  const [tab, setTab] = useState<'note' | 'ai' | 'manage'>('note');
  const [supervisor, setSupervisor] = useState<{ identifier: string; name: string; role: string } | null>(null);
  const [loginInput, setLoginInput] = useState({ identifier: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [checking, setChecking] = useState(false);

  // ── 登入 ──
  const handleLogin = async () => {
    if (!loginInput.identifier.trim() || !loginInput.password.trim()) {
      setLoginError('請輸入員工編號與密碼'); return;
    }
    setChecking(true); setLoginError('');
    try {
      const { data } = await axios.get(`${API}/supervisor-hub/auth/check`, {
        params: { identifier: loginInput.identifier, password: loginInput.password },
      });
      if (data.authorized) {
        const sv = { identifier: loginInput.identifier, name: data.name, role: data.role || 'supervisor' };
        setSupervisor(sv);
        sessionStorage.setItem('sv_identifier', loginInput.identifier);
        sessionStorage.setItem('sv_name', data.name);
        sessionStorage.setItem('sv_role', data.role || 'supervisor');
      } else {
        setLoginError('您沒有使用此功能的權限，請聯繫系統管理員。');
      }
    } catch { setLoginError('連線錯誤，請稍後再試。'); }
    setChecking(false);
  };

  // 嘗試恢復 session
  useEffect(() => {
    const id = sessionStorage.getItem('sv_identifier');
    const nm = sessionStorage.getItem('sv_name');
    const rl = sessionStorage.getItem('sv_role') || 'supervisor';
    if (id && nm) setSupervisor({ identifier: id, name: nm, role: rl });
  }, []);

  if (!supervisor) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f1f5f9' }}>
        <div style={{ background:'#fff', borderRadius:16, padding:32, width:360, boxShadow:'0 4px 24px rgba(0,0,0,0.10)' }}>
          <div style={{ fontSize:28, marginBottom:8, textAlign:'center' }}>🧠</div>
          <h2 style={{ textAlign:'center', marginBottom:4, color:'#1e293b' }}>主管輔助中心</h2>
          <p style={{ textAlign:'center', color:'#64748b', fontSize:13, marginBottom:24 }}>隨手記 + AI 快問</p>
          <label style={labelStyle}>員工編號</label>
          <input style={inputStyle} value={loginInput.identifier}
            onChange={e => setLoginInput(p => ({...p, identifier: e.target.value}))}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="輸入員工編號" />
          <label style={labelStyle}>密碼</label>
          <input style={{ ...inputStyle, letterSpacing: 2 }} type="password" value={loginInput.password}
            onChange={e => setLoginInput(p => ({...p, password: e.target.value}))}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="輸入密碼" />
          {loginError && <p style={{ color:'#ef4444', fontSize:13, marginBottom:8 }}>{loginError}</p>}
          <button onClick={handleLogin} disabled={checking}
            style={{ ...btnStyle, background:'#7c3aed', color:'#fff', width:'100%' }}>
            {checking ? '驗證中...' : '進入系統'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f1f5f9' }}>
      {/* Header */}
      <div style={{ background:'#7c3aed', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>🧠</span>
          <span style={{ color:'#fff', fontWeight:700, fontSize:16 }}>主管輔助中心</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:'#e9d5ff', fontSize:13 }}>{supervisor.name}</span>
            {supervisor.role === 'admin' && (
              <span style={{ background:'#fbbf24', color:'#78350f', fontSize:10, fontWeight:700, borderRadius:99, padding:'1px 7px' }}>超管</span>
            )}
          </div>
          <button onClick={() => { setSupervisor(null); sessionStorage.clear(); }}
            style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:8, padding:'4px 12px', cursor:'pointer', fontSize:12 }}>
            登出
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'#fff', borderBottom:'2px solid #e2e8f0' }}>
        {([['note','✏️ 隨手記'],['ai','🤖 AI 快問'],['manage','⚙️ 管理']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex:1, padding:'14px 0', border:'none', cursor:'pointer', fontSize:14, fontWeight:tab===key?700:400,
              color: tab===key ? '#7c3aed' : '#64748b',
              borderBottom: tab===key ? '3px solid #7c3aed' : '3px solid transparent',
              background:'transparent', transition:'all 0.2s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth:720, margin:'0 auto', padding:'0 0 80px 0' }}>
        {tab === 'note'   && <QuickNoteTab supervisor={supervisor} />}
        {tab === 'ai'     && <AiChatTab supervisor={supervisor} />}
        {tab === 'manage' && <ManageTab supervisor={supervisor} />}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
//  Tab 1: 隨手記
// ────────────────────────────────────────────
function QuickNoteTab({ supervisor }: { supervisor: { identifier: string; name: string; role: string } }) {
  const [mode, setMode] = useState<'write' | 'list' | 'all'>('write');
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isExternal, setIsExternal] = useState(false);
  const [extName, setExtName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // 列表
  const [notes, setNotes] = useState<Note[]>([]);
  const [listSearch, setListSearch] = useState('');
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/supervisor-hub/categories`).then(r => setCategories(r.data || []));
    axios.get(`${API}/supervisor-hub/stores`).then(r => setStores(r.data || []));
  }, []);

  useEffect(() => {
    if (!searchQ.trim()) { setEmployees([]); return; }
    const t = setTimeout(() => {
      axios.get(`${API}/supervisor-hub/employees/search`, { params: { q: searchQ } })
        .then(r => setEmployees(r.data || []));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const loadNotes = (forMode?: typeof mode) => {
    const m = forMode ?? mode;
    setLoading(true);
    const params: any = { search: listSearch || undefined, limit: 50 };
    if (m !== 'all') params.supervisor_id = supervisor.identifier;
    axios.get(`${API}/supervisor-hub/notes`, { params })
      .then(r => setNotes(r.data?.data || [])).finally(() => setLoading(false));
  };

  useEffect(() => { if (mode === 'list' || mode === 'all') loadNotes(mode); }, [mode, listSearch]);

  const handleSave = async () => {
    if (!content.trim()) { alert('請輸入內容'); return; }
    if (!isExternal && !selectedEmp) { alert('請選擇人員'); return; }
    if (isExternal && !extName.trim()) { alert('請輸入姓名'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/supervisor-hub/notes`, {
        supervisor_id: supervisor.identifier,
        supervisor_name: supervisor.name,
        employee_app_number: selectedEmp?.app_number,
        non_employee_name: isExternal ? extName : undefined,
        is_external: isExternal,
        category_id: categoryId || undefined,
        content,
        images,
      });
      setSaved(true);
      setContent(''); setSelectedEmp(null); setExtName(''); setIsExternal(false); setCategoryId(''); setImages([]);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { alert(e.response?.data?.message || '儲存失敗'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確認刪除？')) return;
    await axios.delete(`${API}/supervisor-hub/notes/${id}`, { params: { supervisor_id: supervisor.identifier } });
    loadNotes();
  };

  const handleUpdate = async () => {
    if (!editNote) return;
    await axios.patch(`${API}/supervisor-hub/notes/${editNote.id}`, { content: editNote.content }, { params: { supervisor_id: supervisor.identifier } });
    setEditNote(null); loadNotes();
  };

  return (
    <div style={{ padding:16 }}>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {(['write','list'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ ...btnStyle, flex:1, background: mode===m ? '#7c3aed':'#e2e8f0', color: mode===m ? '#fff':'#475569' }}>
            {m === 'write' ? '✏️ 新增記錄' : '📋 我的記錄'}
          </button>
        ))}
        {supervisor.role === 'admin' && (
          <button onClick={() => setMode('all')}
            style={{ ...btnStyle, flex:1, background: mode==='all' ? '#dc2626':'#e2e8f0', color: mode==='all' ? '#fff':'#475569' }}>
            👁 所有記錄
          </button>
        )}
      </div>

      {mode === 'write' && (
        <div style={cardStyle}>
          {/* 人員選擇 */}
          <label style={labelStyle}>記錄對象</label>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <button onClick={() => setIsExternal(false)} style={{ ...smallBtnStyle, background: !isExternal ? '#7c3aed':'#e2e8f0', color: !isExternal ? '#fff':'#475569' }}>公司人員</button>
            <button onClick={() => setIsExternal(true)} style={{ ...smallBtnStyle, background: isExternal ? '#7c3aed':'#e2e8f0', color: isExternal ? '#fff':'#475569' }}>外部人員</button>
          </div>

          {!isExternal ? (
            <>
              <input style={inputStyle} placeholder="輸入姓名或員工編號搜尋..." value={searchQ}
                onChange={e => { setSearchQ(e.target.value); setSelectedEmp(null); }} />
              {selectedEmp ? (
                <div style={{ background:'#f3f0ff', borderRadius:8, padding:'8px 12px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:600, color:'#6d28d9' }}>{selectedEmp.name} <span style={{ fontWeight:400, color:'#7c3aed', fontSize:12 }}>{selectedEmp.store_name}</span></span>
                  <button onClick={() => { setSelectedEmp(null); setSearchQ(''); }} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:16 }}>✕</button>
                </div>
              ) : employees.length > 0 && (
                <div style={{ border:'1px solid #e2e8f0', borderRadius:8, maxHeight:180, overflowY:'auto', marginBottom:8 }}>
                  {employees.map(e => (
                    <div key={e.app_number} onClick={() => { setSelectedEmp(e); setSearchQ(''); setEmployees([]); }}
                      style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid #f1f5f9' }}
                      onMouseEnter={el => (el.currentTarget.style.background='#f8fafc')}
                      onMouseLeave={el => (el.currentTarget.style.background='#fff')}>
                      <span style={{ fontWeight:600 }}>{e.name}</span>
                      <span style={{ color:'#94a3b8', fontSize:12, marginLeft:8 }}>{e.store_name} · {e.position}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* 按店家選 */}
              {stores.length > 0 && !selectedEmp && (
                <select style={{ ...inputStyle, color:'#475569' }} onChange={async e => {
                  if (!e.target.value) return;
                  const r = await axios.get(`${API}/supervisor-hub/employees/search`, { params: { store_id: e.target.value } });
                  setEmployees(r.data || []);
                }}>
                  <option value="">📍 或按店家篩選...</option>
                  {stores.map((s, i) => <option key={i} value={s.store_id || s.store_name}>{s.store_name}</option>)}
                </select>
              )}
            </>
          ) : (
            <input style={inputStyle} placeholder="外部人員姓名" value={extName} onChange={e => setExtName(e.target.value)} />
          )}

          {/* 分類 */}
          <label style={labelStyle}>紀錄分類</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
            <button onClick={() => setCategoryId('')}
              style={{ ...smallBtnStyle, background: !categoryId ? '#7c3aed':'#e2e8f0', color: !categoryId ? '#fff':'#475569' }}>未分類</button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setCategoryId(c.id)}
                style={{ ...smallBtnStyle, background: categoryId===c.id ? c.color:'#e2e8f0', color: categoryId===c.id ? '#fff':'#475569' }}>
                {c.name}
              </button>
            ))}
          </div>

          {/* 內容 */}
          <label style={labelStyle}>內容</label>
          <textarea style={{ ...inputStyle, minHeight:100, resize:'vertical' }} placeholder="輸入記錄內容..."
            value={content} onChange={e => setContent(e.target.value)} />

          <button onClick={handleSave} disabled={saving}
            style={{ ...btnStyle, background: saved ? '#22c55e':'#7c3aed', color:'#fff', width:'100%' }}>
            {saving ? '儲存中...' : saved ? '✓ 已儲存！' : '儲存記錄'}
          </button>
        </div>
      )}

      {mode === 'list' && (
        <div>
          <input style={inputStyle} placeholder="搜尋記錄內容..." value={listSearch}
            onChange={e => setListSearch(e.target.value)} />
          {loading ? <p style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>載入中...</p> :
            notes.length === 0 ? <p style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>尚無記錄</p> :
            notes.map(n => (
              <div key={n.id} style={cardStyle}>
                {editNote?.id === n.id ? (
                  <>
                    <textarea style={{ ...inputStyle, minHeight:80 }} value={editNote.content} onChange={e => setEditNote({ ...editNote, content: e.target.value })} />
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={handleUpdate} style={{ ...btnStyle, background:'#7c3aed', color:'#fff', flex:1 }}>儲存</button>
                      <button onClick={() => setEditNote(null)} style={{ ...btnStyle, background:'#e2e8f0', color:'#475569', flex:1 }}>取消</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        {n.category_name && <span style={{ background:'#ede9fe', color:'#7c3aed', borderRadius:99, padding:'2px 10px', fontSize:11 }}>{n.category_name}</span>}
                        <span style={{ fontSize:12, color:'#94a3b8' }}>{n.employee_app_number || n.non_employee_name || '外部'}</span>
                      </div>
                      <span style={{ fontSize:11, color:'#cbd5e1' }}>{new Date(n.created_at).toLocaleDateString('zh-TW')}</span>
                    </div>
                    <p style={{ margin:'0 0 8px', color:'#1e293b', lineHeight:1.6 }}>{n.content}</p>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'#94a3b8' }}>記錄者：{n.supervisor_name}</span>
                      <div style={{ display:'flex', gap:6 }}>
                        {(supervisor.role === 'admin' || n.supervisor_name === supervisor.name) && (
                          <button onClick={() => setEditNote(n)} style={{ ...smallBtnStyle, background:'#f1f5f9', color:'#475569' }}>編輯</button>
                        )}
                        {(supervisor.role === 'admin' || n.supervisor_name === supervisor.name) && (
                          <button onClick={() => handleDelete(n.id)} style={{ ...smallBtnStyle, background:'#fee2e2', color:'#dc2626' }}>刪除</button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
//  Tab 2: AI 快問
// ────────────────────────────────────────────
function AiChatTab({ supervisor }: { supervisor: { identifier: string; name: string; role: string } }) {
  const [step, setStep] = useState<'select' | 'chat'>('select');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [aiType, setAiType] = useState<'claude' | 'openai' | 'gemini'>('claude');
  const [session, setSession] = useState<AiSession | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQ.trim()) { setEmployees([]); return; }
    const t = setTimeout(() => {
      axios.get(`${API}/supervisor-hub/employees/search`, { params: { q: searchQ } })
        .then(r => setEmployees(r.data || []));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSessions = async () => {
    const r = await axios.get(`${API}/supervisor-hub/ai/sessions`, { params: { supervisor_id: supervisor.identifier } });
    setSessions(r.data || []);
  };

  const startChat = async () => {
    if (!selectedEmp) { alert('請選擇人員'); return; }
    try {
      const r = await axios.post(`${API}/supervisor-hub/ai/sessions`, {
        supervisor_id: supervisor.identifier,
        supervisor_name: supervisor.name,
        employee_app_number: selectedEmp.app_number,
        employee_name: selectedEmp.name,
        ai_type: aiType,
      });
      setSession(r.data);
      setMessages([]);
      setStep('chat');
    } catch (e: any) {
      alert(e.response?.data?.message || '建立對話失敗');
    }
  };

  const loadSession = async (s: AiSession) => {
    setSession(s);
    const r = await axios.get(`${API}/supervisor-hub/ai/sessions/${s.id}/messages`);
    const msgs = (r.data || []).filter((m: any) => m.role !== 'system').map((m: any) => ({ role: m.role, content: m.content }));
    setMessages(msgs);
    setStep('chat');
    setShowHistory(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || !session) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setSending(true);
    try {
      const r = await axios.post(`${API}/supervisor-hub/ai/chat`, {
        session_id: session.id,
        supervisor_id: supervisor.identifier,
        content: userMsg,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: r.data.content }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ 錯誤：${e.response?.data?.message || '請稍後再試'}` }]);
    }
    setSending(false);
  };

  const aiInfo = AI_LABELS[aiType] || AI_LABELS.claude;

  if (step === 'select') {
    return (
      <div style={{ padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ margin:0, color:'#1e293b' }}>選擇討論對象</h3>
          <button onClick={async () => { await loadSessions(); setShowHistory(true); }} style={{ ...smallBtnStyle, background:'#e2e8f0', color:'#475569' }}>📜 歷史對話</button>
        </div>

        {showHistory && (
          <div style={{ ...cardStyle, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <strong>歷史對話</strong>
              <button onClick={() => setShowHistory(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}>✕</button>
            </div>
            {sessions.length === 0 ? <p style={{ color:'#94a3b8', textAlign:'center' }}>尚無歷史對話</p> :
              sessions.map(s => (
                <div key={s.id} onClick={() => loadSession(s)}
                  style={{ padding:'8px 0', borderBottom:'1px solid #f1f5f9', cursor:'pointer', display:'flex', justifyContent:'space-between' }}>
                  <div>
                    <span style={{ fontWeight:600, color:'#1e293b', fontSize:13 }}>{s.title}</span>
                    <span style={{ marginLeft:8, fontSize:11, ...aiLabelStyle(s.ai_type) }}>{AI_LABELS[s.ai_type]?.emoji} {AI_LABELS[s.ai_type]?.label}</span>
                  </div>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>{new Date(s.created_at).toLocaleDateString('zh-TW')}</span>
                </div>
              ))
            }
          </div>
        )}

        <div style={cardStyle}>
          <label style={labelStyle}>搜尋人員</label>
          <input style={inputStyle} placeholder="輸入姓名或員工編號..." value={searchQ}
            onChange={e => { setSearchQ(e.target.value); setSelectedEmp(null); }} />
          {selectedEmp ? (
            <div style={{ background:'#f3f0ff', borderRadius:8, padding:'8px 12px', marginBottom:12, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontWeight:600, color:'#6d28d9' }}>{selectedEmp.name} <span style={{ fontWeight:400, color:'#7c3aed', fontSize:12 }}>{selectedEmp.store_name}</span></span>
              <button onClick={() => { setSelectedEmp(null); setSearchQ(''); }} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer' }}>✕</button>
            </div>
          ) : employees.length > 0 && (
            <div style={{ border:'1px solid #e2e8f0', borderRadius:8, maxHeight:160, overflowY:'auto', marginBottom:12 }}>
              {employees.map(e => (
                <div key={e.app_number} onClick={() => { setSelectedEmp(e); setSearchQ(''); setEmployees([]); }}
                  style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid #f1f5f9' }}>
                  <span style={{ fontWeight:600 }}>{e.name}</span>
                  <span style={{ color:'#94a3b8', fontSize:12, marginLeft:8 }}>{e.store_name}</span>
                </div>
              ))}
            </div>
          )}

          <label style={labelStyle}>選擇 AI</label>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {(['claude', 'openai', 'gemini'] as const).map(ai => (
              <button key={ai} onClick={() => setAiType(ai)}
                style={{ flex:1, padding:'10px 0', border:'none', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:13,
                  background: aiType===ai ? AI_LABELS[ai].color : '#e2e8f0',
                  color: aiType===ai ? '#fff' : '#475569', transition:'all 0.2s' }}>
                {AI_LABELS[ai].emoji} {AI_LABELS[ai].label}
              </button>
            ))}
          </div>

          <button onClick={startChat}
            style={{ ...btnStyle, background: aiInfo.color, color:'#fff', width:'100%' }}>
            {aiInfo.emoji} 開始 AI 快問
          </button>
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 130px)' }}>
      {/* Chat header */}
      <div style={{ background:'#fff', padding:'10px 16px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={() => setStep('select')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#7c3aed' }}>←</button>
        <div>
          <div style={{ fontWeight:700, color:'#1e293b', fontSize:14 }}>{session?.title}</div>
          <div style={{ fontSize:11, color: AI_LABELS[session?.ai_type || 'claude']?.color }}>
            {AI_LABELS[session?.ai_type || 'claude']?.emoji} {AI_LABELS[session?.ai_type || 'claude']?.label}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>
            <div style={{ fontSize:32, marginBottom:8 }}>{AI_LABELS[session?.ai_type || 'claude']?.emoji}</div>
            <p>我已彙整 <strong style={{ color:'#7c3aed' }}>{session?.employee_name}</strong> 的相關資料，請開始提問！</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display:'flex', justifyContent: m.role==='user' ? 'flex-end':'flex-start' }}>
            <div style={{
              maxWidth:'80%', padding:'10px 14px', borderRadius: m.role==='user' ? '18px 18px 4px 18px':'18px 18px 18px 4px',
              background: m.role==='user' ? '#7c3aed':'#fff',
              color: m.role==='user' ? '#fff':'#1e293b',
              boxShadow:'0 1px 4px rgba(0,0,0,0.08)',
              fontSize:14, lineHeight:1.6, whiteSpace:'pre-wrap',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{ background:'#fff', padding:'10px 16px', borderRadius:18, boxShadow:'0 1px 4px rgba(0,0,0,0.08)', color:'#94a3b8' }}>
              思考中...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ background:'#fff', padding:12, borderTop:'1px solid #e2e8f0', display:'flex', gap:8 }}>
        <input
          style={{ flex:1, border:'1px solid #e2e8f0', borderRadius:24, padding:'10px 16px', fontSize:14, outline:'none' }}
          placeholder="輸入問題..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <button onClick={sendMessage} disabled={sending || !input.trim()}
          style={{ background: AI_LABELS[session?.ai_type || 'claude']?.color, color:'#fff', border:'none', borderRadius:24, padding:'10px 20px', cursor:'pointer', fontWeight:600 }}>
          送出
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
//  Tab 3: 管理（分類 + 主管 + 機密名單 + AI 人格）
// ────────────────────────────────────────────
function ManageTab({ supervisor }: { supervisor: { identifier: string; name: string; role: string } }) {
  const [section, setSection] = useState<'categories' | 'supervisors' | 'confidential' | 'personas'>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [confidential, setConfidential] = useState<any[]>([]);
  const [personas, setPersonas] = useState<AiPersona[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#7c3aed');
  const [newSvEmp, setNewSvEmp] = useState<Employee | null>(null);
  const [newSvPassword, setNewSvPassword] = useState('');
  const [editPwdId, setEditPwdId] = useState<string | null>(null);
  const [editPwdValue, setEditPwdValue] = useState('');
  const [newConfEmp, setNewConfEmp] = useState<Employee | null>(null);
  const [newConfReason, setNewConfReason] = useState('');
  const [editPersona, setEditPersona] = useState<AiPersona | null>(null);

  const load = () => {
    axios.get(`${API}/supervisor-hub/categories`).then(r => setCategories(r.data || []));
    axios.get(`${API}/supervisor-hub/supervisors`).then(r => setSupervisors(r.data || []));
    axios.get(`${API}/supervisor-hub/confidential`).then(r => setConfidential(r.data || []));
    axios.get(`${API}/supervisor-hub/ai/personas`).then(r => setPersonas(r.data || []));
  };

  useEffect(() => { load(); }, []);

  const isAdmin = supervisor.role === 'admin';

  return (
    <div style={{ padding:16 }}>
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {([['categories','分類'],['supervisors','主管名單'],['confidential','AI 機密'],['personas','AI 人格']] as const).map(([k, l]) => {
          const adminOnly = k !== 'categories';
          if (adminOnly && !isAdmin) return null;
          return (
            <button key={k} onClick={() => setSection(k)}
              style={{ ...smallBtnStyle, background: section===k ? '#7c3aed':'#e2e8f0', color: section===k ? '#fff':'#475569' }}>{l}</button>
          );
        })}
      </div>

      {/* 分類管理 */}
      {section === 'categories' && (
        <div style={cardStyle}>
          <h4 style={{ margin:'0 0 12px', color:'#1e293b' }}>紀錄分類</h4>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input style={{ ...inputStyle, flex:1, margin:0 }} placeholder="分類名稱" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
            <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
              style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:4, cursor:'pointer', height:38 }} />
            <button onClick={async () => {
              if (!newCatName.trim()) return;
              await axios.post(`${API}/supervisor-hub/categories`, { name: newCatName, color: newCatColor });
              setNewCatName(''); load();
            }} style={{ ...btnStyle, background:'#7c3aed', color:'#fff' }}>新增</button>
          </div>
          {categories.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid #f1f5f9' }}>
              <span style={{ width:16, height:16, borderRadius:'50%', background:c.color, display:'inline-block' }} />
              <span style={{ flex:1, color:'#1e293b' }}>{c.name}</span>
              <button onClick={async () => { await axios.delete(`${API}/supervisor-hub/categories/${c.id}`); load(); }}
                style={{ ...smallBtnStyle, background:'#fee2e2', color:'#dc2626' }}>刪除</button>
            </div>
          ))}
        </div>
      )}

      {/* 主管名單（admin only） */}
      {section === 'supervisors' && isAdmin && (
        <div style={cardStyle}>
          <h4 style={{ margin:'0 0 12px', color:'#1e293b' }}>有權使用的主管</h4>
          <EmployeeSearchPicker selected={newSvEmp} onSelect={setNewSvEmp} placeholder="搜尋人員加入主管名單..." />
          {newSvEmp && (
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <input style={{ ...inputStyle, flex:1, margin:0, letterSpacing:1 }} type="password" placeholder="設定登入密碼" value={newSvPassword} onChange={e => setNewSvPassword(e.target.value)} />
              <button onClick={async () => {
                if (!newSvPassword.trim()) { alert('請設定密碼'); return; }
                const res = await axios.post(`${API}/supervisor-hub/supervisors`, { identifier: newSvEmp!.app_number, name: newSvEmp!.name, display_name: newSvEmp!.name });
                if (res.data?.id) {
                  await axios.patch(`${API}/supervisor-hub/supervisors/${res.data.id}/password`, { password: newSvPassword });
                }
                setNewSvEmp(null); setNewSvPassword(''); load();
              }} style={{ ...btnStyle, background:'#7c3aed', color:'#fff', whiteSpace:'nowrap' }}>新增主管</button>
            </div>
          )}
          {supervisors.map((s: any) => (
            <div key={s.id} style={{ borderBottom:'1px solid #f1f5f9', padding:'6px 0' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ flex:1 }}>
                  <span style={{ fontWeight:600, color:'#1e293b' }}>{s.name}</span>
                  <span style={{ color:'#94a3b8', fontSize:12, marginLeft:8 }}>{s.identifier}</span>
                  {s.role === 'admin' && <span style={{ marginLeft:6, fontSize:10, background:'#fef3c7', color:'#92400e', borderRadius:99, padding:'1px 6px' }}>超管</span>}
                </div>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background: s.is_active ? '#dcfce7':'#fee2e2', color: s.is_active ? '#16a34a':'#dc2626' }}>
                  {s.is_active ? '啟用' : '停用'}
                </span>
                <button onClick={() => { setEditPwdId(s.id); setEditPwdValue(''); }}
                  style={{ ...smallBtnStyle, background:'#ede9fe', color:'#7c3aed' }}>🔑 密碼</button>
                <button onClick={async () => { await axios.delete(`${API}/supervisor-hub/supervisors/${s.id}`); load(); }}
                  style={{ ...smallBtnStyle, background:'#fee2e2', color:'#dc2626' }}>停用</button>
              </div>
              {editPwdId === s.id && (
                <div style={{ display:'flex', gap:8, marginTop:6, marginLeft:8 }}>
                  <input type="password" style={{ ...inputStyle, flex:1, margin:0, fontSize:13, letterSpacing:1 }}
                    placeholder="輸入新密碼" value={editPwdValue} onChange={e => setEditPwdValue(e.target.value)} />
                  <button onClick={async () => {
                    if (!editPwdValue.trim()) return;
                    await axios.patch(`${API}/supervisor-hub/supervisors/${s.id}/password`, { password: editPwdValue });
                    setEditPwdId(null); setEditPwdValue('');
                  }} style={{ ...smallBtnStyle, background:'#7c3aed', color:'#fff' }}>確認</button>
                  <button onClick={() => setEditPwdId(null)} style={{ ...smallBtnStyle, background:'#e2e8f0', color:'#475569' }}>取消</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* AI 機密名單（admin only） */}
      {section === 'confidential' && isAdmin && (
        <div style={cardStyle}>
          <h4 style={{ margin:'0 0 4px', color:'#1e293b' }}>AI 機密名單</h4>
          <p style={{ color:'#64748b', fontSize:12, marginBottom:12 }}>列入名單的人員可以被記錄隨手記，但 AI 無法討論其資料。</p>
          <EmployeeSearchPicker selected={newConfEmp} onSelect={setNewConfEmp} placeholder="搜尋人員加入 AI 機密名單..." />
          {newConfEmp && (
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <input style={{ ...inputStyle, flex:1, margin:0 }} placeholder="列入原因（選填）" value={newConfReason} onChange={e => setNewConfReason(e.target.value)} />
              <button onClick={async () => {
                await axios.post(`${API}/supervisor-hub/confidential`, { employee_app_number: newConfEmp!.app_number, reason: newConfReason, created_by: supervisor.identifier });
                setNewConfEmp(null); setNewConfReason(''); load();
              }} style={{ ...btnStyle, background:'#dc2626', color:'#fff', whiteSpace:'nowrap' }}>加入名單</button>
            </div>
          )}
          {confidential.map((c: any) => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid #f1f5f9' }}>
              <div style={{ flex:1 }}>
                <span style={{ fontWeight:600, color:'#1e293b' }}>{c.employee_name || c.employee_app_number}</span>
                {c.reason && <span style={{ color:'#94a3b8', fontSize:12, marginLeft:8 }}>（{c.reason}）</span>}
              </div>
              <button onClick={async () => { await axios.delete(`${API}/supervisor-hub/confidential/${c.id}`); load(); }}
                style={{ ...smallBtnStyle, background:'#fee2e2', color:'#dc2626' }}>移除</button>
            </div>
          ))}
        </div>
      )}

      {/* AI 人格設定（admin only） */}
      {section === 'personas' && isAdmin && (
        <div>
          {personas.map(p => (
            <div key={p.id} style={cardStyle}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:20 }}>{AI_LABELS[p.ai_type]?.emoji}</span>
                  <div>
                    <div style={{ fontWeight:700, color:'#1e293b' }}>{p.persona_name}</div>
                    <div style={{ fontSize:11, color: AI_LABELS[p.ai_type]?.color }}>{AI_LABELS[p.ai_type]?.label} · {p.model}</div>
                  </div>
                </div>
                <button onClick={() => setEditPersona(p)} style={{ ...smallBtnStyle, background:'#ede9fe', color:'#7c3aed' }}>編輯</button>
              </div>
              {editPersona?.id === p.id ? (
                <>
                  <label style={labelStyle}>顯示名稱</label>
                  <input style={inputStyle} value={editPersona.persona_name} onChange={e => setEditPersona({ ...editPersona, persona_name: e.target.value })} />
                  <label style={labelStyle}>模型版本</label>
                  <input style={inputStyle} value={editPersona.model || ''} onChange={e => setEditPersona({ ...editPersona, model: e.target.value })} />
                  <label style={labelStyle}>人格提示詞（System Prompt）</label>
                  <textarea style={{ ...inputStyle, minHeight:120, resize:'vertical' }} value={editPersona.system_prompt}
                    onChange={e => setEditPersona({ ...editPersona, system_prompt: e.target.value })} />
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={async () => {
                      await axios.patch(`${API}/supervisor-hub/ai/personas/${editPersona.id}`, {
                        persona_name: editPersona.persona_name, system_prompt: editPersona.system_prompt, model: editPersona.model,
                      });
                      setEditPersona(null); load();
                    }} style={{ ...btnStyle, background:'#7c3aed', color:'#fff', flex:1 }}>儲存</button>
                    <button onClick={() => setEditPersona(null)} style={{ ...btnStyle, background:'#e2e8f0', color:'#475569', flex:1 }}>取消</button>
                  </div>
                </>
              ) : (
                <p style={{ fontSize:12, color:'#64748b', margin:0, lineHeight:1.6 }}>{p.system_prompt.slice(0, 80)}...</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
//  共用：員工快搜下拉
// ────────────────────────────────────────────
function EmployeeSearchPicker({
  selected, onSelect, placeholder = '輸入姓名或員工編號搜尋...'
}: {
  selected: Employee | null;
  onSelect: (e: Employee | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Employee[]>([]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      axios.get(`${API}/supervisor-hub/employees/search`, { params: { q } })
        .then(r => setResults(r.data || []));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (selected) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f3f0ff', borderRadius:8, padding:'6px 10px', marginBottom:8 }}>
        <span style={{ flex:1, fontWeight:600, color:'#6d28d9', fontSize:13 }}>
          {selected.name}
          <span style={{ fontWeight:400, color:'#7c3aed', fontSize:11, marginLeft:6 }}>{selected.store_name} · {selected.app_number}</span>
        </span>
        <button onClick={() => { onSelect(null); setQ(''); }} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:16 }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ position:'relative', marginBottom:8 }}>
      <input
        style={{ ...inputStyle, margin:0 }}
        placeholder={placeholder}
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      {results.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, maxHeight:200, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.1)' }}>
          {results.map(e => (
            <div key={e.app_number}
              onClick={() => { onSelect(e); setQ(''); setResults([]); }}
              style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid #f8fafc', display:'flex', justifyContent:'space-between', alignItems:'center' }}
              onMouseEnter={el => (el.currentTarget.style.background='#f8f4ff')}
              onMouseLeave={el => (el.currentTarget.style.background='#fff')}>
              <span style={{ fontWeight:600, color:'#1e293b', fontSize:13 }}>{e.name}</span>
              <span style={{ color:'#94a3b8', fontSize:11 }}>{e.store_name} · {e.app_number}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
//  Helpers / Styles
// ────────────────────────────────────────────
const labelStyle: React.CSSProperties = { display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:4, marginTop:8 };
const inputStyle: React.CSSProperties = { display:'block', width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:10, fontSize:14, outline:'none', marginBottom:8, boxSizing:'border-box', background:'#fff' };
const btnStyle: React.CSSProperties = { padding:'10px 16px', border:'none', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:600 };
const smallBtnStyle: React.CSSProperties = { padding:'5px 12px', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 };
const cardStyle: React.CSSProperties = { background:'#fff', borderRadius:12, padding:16, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' };
const aiLabelStyle = (aiType: string): React.CSSProperties => ({ fontSize:11, padding:'1px 6px', borderRadius:99, background: '#f3f4f6', color: AI_LABELS[aiType]?.color || '#6b7280' });
