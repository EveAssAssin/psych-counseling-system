import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'https://psych-counseling-backend.onrender.com';

// ────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────
interface Employee { app_number: string; name: string; store_name?: string; position?: string; }
interface Category { id: string; name: string; color: string; supervisor_id?: string | null; }
interface Attachment { url: string; originalName: string; type: string; size: number; }
interface Note { id: string; content: string; category_id?: string; category_name?: string; supervisor_name: string; created_at: string; employee_app_number?: string; employee_name?: string; non_employee_name?: string; images?: string[]; attachments?: Attachment[]; }
interface AiMessage { role: 'user' | 'assistant'; content: string; }
interface AiSession { id: string; employee_name?: string; ai_type: string; title: string; created_at: string; }
interface AiPersona { id: string; ai_type: string; persona_name: string; system_prompt: string; model?: string; }
interface OrderTrendItem {
  label: string;
  recentAvg: number;
  prevAvg: number;
  trend: 'up' | 'down' | 'stable' | 'new';
  changePercent: number | null;
  months: Array<{ year: number; month: number; count: number }>;
}
interface EmployeeOrderTrend {
  hasData: boolean;
  lastSyncedMonth: string | null;
  totalTrend: OrderTrendItem;
  byLabel: OrderTrendItem[];
}
interface EmployeeSummary {
  employee: { name: string; store_name?: string; title?: string; department?: string; hire_date?: string; is_active: boolean; is_leave: boolean; leave_type?: string; } | null;
  notes: any[];
  conversations: any[];
  reviews: any[];
  riskFlags: any[];
  channelMessages: any[];
  ticketHistory: any[];
  orderTrend?: EmployeeOrderTrend;
}

const AI_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  claude: { label: 'Claude',  color: '#7c3aed', emoji: '🟣' },
  openai: { label: 'GPT-4o',  color: '#059669', emoji: '🟢' },
  gemini: { label: 'Gemini',  color: '#2563eb', emoji: '🔵' },
};

// ────────────────────────────────────────────
//  Main Page
// ────────────────────────────────────────────
export default function SupervisorHubPage() {
  const [tab, setTab] = useState<'note' | 'review' | 'ai' | 'manage'>('note');
  const [supervisor, setSupervisor] = useState<{ identifier: string; name: string; role: string } | null>(null);
  const [loginInput, setLoginInput] = useState({ identifier: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [checking, setChecking] = useState(false);

  // ── 修改密碼 ──
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [changePwd, setChangePwd] = useState({ current: '', next: '', confirm: '' });
  const [changePwdLoading, setChangePwdLoading] = useState(false);
  const [changePwdMsg, setChangePwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleChangePwd = async () => {
    if (!changePwd.current || !changePwd.next || !changePwd.confirm) {
      setChangePwdMsg({ ok: false, text: '請填寫所有欄位' }); return;
    }
    if (changePwd.next.length < 6) {
      setChangePwdMsg({ ok: false, text: '新密碼至少 6 個字元' }); return;
    }
    if (changePwd.next !== changePwd.confirm) {
      setChangePwdMsg({ ok: false, text: '新密碼與確認密碼不一致' }); return;
    }
    setChangePwdLoading(true); setChangePwdMsg(null);
    try {
      const { data } = await axios.post(`${API}/supervisor-hub/auth/change-password`, {
        identifier: supervisor!.identifier,
        currentPassword: changePwd.current,
        newPassword: changePwd.next,
      });
      if (data.success) {
        setChangePwdMsg({ ok: true, text: '密碼已成功更新！' });
        setChangePwd({ current: '', next: '', confirm: '' });
        setTimeout(() => { setShowChangePwd(false); setChangePwdMsg(null); }, 1500);
      } else {
        setChangePwdMsg({ ok: false, text: data.message || '更新失敗' });
      }
    } catch {
      setChangePwdMsg({ ok: false, text: '連線錯誤，請稍後再試' });
    }
    setChangePwdLoading(false);
  };

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
      {/* 修改密碼 Modal */}
      {showChangePwd && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:16,
        }} onClick={e => { if (e.target === e.currentTarget) { setShowChangePwd(false); setChangePwdMsg(null); setChangePwd({ current:'', next:'', confirm:'' }); }}}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:360, boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight:700, fontSize:16, color:'#1e293b', marginBottom:20 }}>🔑 修改密碼</div>

            <label style={labelStyle}>目前密碼</label>
            <input
              type="password"
              value={changePwd.current}
              onChange={e => setChangePwd(p => ({ ...p, current: e.target.value }))}
              placeholder="輸入目前密碼"
              style={{ ...inputStyle, letterSpacing:2 }}
            />

            <label style={labelStyle}>新密碼</label>
            <input
              type="password"
              value={changePwd.next}
              onChange={e => setChangePwd(p => ({ ...p, next: e.target.value }))}
              placeholder="至少 6 個字元"
              style={{ ...inputStyle, letterSpacing:2 }}
            />

            <label style={labelStyle}>確認新密碼</label>
            <input
              type="password"
              value={changePwd.confirm}
              onChange={e => setChangePwd(p => ({ ...p, confirm: e.target.value }))}
              placeholder="再次輸入新密碼"
              onKeyDown={e => e.key === 'Enter' && handleChangePwd()}
              style={{ ...inputStyle, letterSpacing:2 }}
            />

            {changePwdMsg && (
              <div style={{
                padding:'8px 12px', borderRadius:8, marginBottom:12, fontSize:13,
                background: changePwdMsg.ok ? '#f0fdf4' : '#fef2f2',
                color: changePwdMsg.ok ? '#16a34a' : '#dc2626',
                border: `1px solid ${changePwdMsg.ok ? '#bbf7d0' : '#fecaca'}`,
              }}>
                {changePwdMsg.ok ? '✅ ' : '❌ '}{changePwdMsg.text}
              </div>
            )}

            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => { setShowChangePwd(false); setChangePwdMsg(null); setChangePwd({ current:'', next:'', confirm:'' }); }}
                style={{ ...btnStyle, flex:1, background:'#f1f5f9', color:'#64748b' }}
              >
                取消
              </button>
              <button
                onClick={handleChangePwd}
                disabled={changePwdLoading}
                style={{ ...btnStyle, flex:1, background: changePwdLoading ? '#a78bfa' : '#7c3aed', color:'#fff' }}
              >
                {changePwdLoading ? '更新中...' : '確認修改'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          <button
            onClick={() => { setShowChangePwd(true); setChangePwdMsg(null); setChangePwd({ current:'', next:'', confirm:'' }); }}
            style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:8, padding:'4px 12px', cursor:'pointer', fontSize:12 }}
          >
            🔑 改密碼
          </button>
          <button onClick={() => { setSupervisor(null); sessionStorage.clear(); }}
            style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:8, padding:'4px 12px', cursor:'pointer', fontSize:12 }}>
            登出
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'#fff', borderBottom:'2px solid #e2e8f0' }}>
        {([['note','✏️ 隨手記'],['review','📋 人評會'],['ai','🤖 AI 快問'],['manage','⚙️ 管理']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex:1, padding:'12px 0', border:'none', cursor:'pointer', fontSize:13, fontWeight:tab===key?700:400,
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
        {tab === 'review' && <ReviewRecordTab supervisor={supervisor} />}
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
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isExternal, setIsExternal] = useState(false);
  const [extName, setExtName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [content, setContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // 列表
  const [notes, setNotes] = useState<Note[]>([]);
  const [listSearch, setListSearch] = useState('');
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [editPendingFiles, setEditPendingFiles] = useState<File[]>([]);
  const [editUploading, setEditUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 釘選人員（持久化到 localStorage）
  const [pinnedEmps, setPinnedEmps] = useState<Employee[]>(() => {
    try { return JSON.parse(localStorage.getItem(`pinned_emps_${supervisor.identifier}`) || '[]'); } catch { return []; }
  });
  // 摺疊狀態（預設全部展開）
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const togglePin = (emp: Employee) => {
    setPinnedEmps(prev => {
      const exists = prev.some(p => p.app_number === emp.app_number);
      const next = exists ? prev.filter(p => p.app_number !== emp.app_number) : [...prev, emp];
      localStorage.setItem(`pinned_emps_${supervisor.identifier}`, JSON.stringify(next));
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    axios.get(`${API}/supervisor-hub/categories`, { params: { supervisor_id: supervisor.identifier } })
      .then(r => setCategories(r.data || []));
    axios.get(`${API}/supervisor-hub/stores`).then(r => setStores(r.data || []));
  }, []);

  const loadNotes = (forMode?: typeof mode) => {
    const m = forMode ?? mode;
    setLoading(true);
    const params: any = { search: listSearch || undefined, limit: 50 };
    if (m !== 'all') params.supervisor_id = supervisor.identifier;
    axios.get(`${API}/supervisor-hub/notes`, { params })
      .then(r => setNotes(r.data?.data || []))
      .catch(e => {
        console.error('loadNotes error:', e);
        alert('載入記錄失敗：' + (e.response?.data?.message || e.message));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (mode === 'list' || mode === 'all') loadNotes(mode); }, [mode, listSearch]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setPendingFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!content.trim()) { alert('請輸入內容'); return; }
    if (!isExternal && !selectedEmp) { alert('請選擇人員'); return; }
    if (isExternal && !extName.trim()) { alert('請輸入姓名'); return; }
    setSaving(true);

    // 先上傳附件
    let attachments: Attachment[] = [];
    if (pendingFiles.length > 0) {
      setUploading(true);
      try {
        const formData = new FormData();
        pendingFiles.forEach(f => formData.append('files', f));
        const r = await axios.post(`${API}/supervisor-hub/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        attachments = r.data.attachments || [];
      } catch (e: any) {
        alert('附件上傳失敗：' + (e.response?.data?.message || e.message));
        setSaving(false); setUploading(false); return;
      }
      setUploading(false);
    }

    try {
      await axios.post(`${API}/supervisor-hub/notes`, {
        supervisor_id: supervisor.identifier,
        supervisor_name: supervisor.name,
        employee_app_number: selectedEmp?.app_number,
        non_employee_name: isExternal ? extName : undefined,
        is_external: isExternal,
        category_id: categoryId || undefined,
        content,
        attachments,
      });
      setSaved(true);
      setContent(''); setSelectedEmp(null); setExtName(''); setIsExternal(false);
      setCategoryId(''); setPendingFiles([]);
      setTimeout(() => { setSaved(false); setMode('list'); }, 1200);
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
    setEditUploading(true);

    // 上傳新附件
    let newAttachments: Attachment[] = [];
    if (editPendingFiles.length > 0) {
      try {
        const formData = new FormData();
        editPendingFiles.forEach(f => formData.append('files', f));
        const r = await axios.post(`${API}/supervisor-hub/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        newAttachments = r.data.attachments || [];
      } catch (e: any) {
        alert('附件上傳失敗：' + (e.response?.data?.message || e.message));
        setEditUploading(false); return;
      }
    }

    const mergedAttachments = [...(editNote.attachments || []), ...newAttachments];

    try {
      await axios.patch(`${API}/supervisor-hub/notes/${editNote.id}`, {
        content: editNote.content,
        category_id: editNote.category_id || null,
        attachments: mergedAttachments,
      }, { params: { supervisor_id: supervisor.identifier } });
      setEditNote(null);
      setEditPendingFiles([]);
      loadNotes();
    } catch (e: any) {
      alert(e.response?.data?.message || '儲存失敗');
    }
    setEditUploading(false);
  };

  // ── 按人員分組（在 JSX 外預先計算）──
  type NoteGroup = { key: string; displayName: string; latestDate: string; notes: Note[] };
  const noteGroups: NoteGroup[] = (() => {
    const groupMap: Record<string, NoteGroup> = {};
    for (const n of notes) {
      const key = n.employee_app_number || n.non_employee_name || '__ext__';
      const displayName = n.employee_name || n.non_employee_name || (n.employee_app_number ? n.employee_app_number : '外部人員');
      if (!groupMap[key]) groupMap[key] = { key, displayName, latestDate: n.created_at, notes: [] };
      groupMap[key].notes.push(n);
      if (n.created_at > groupMap[key].latestDate) groupMap[key].latestDate = n.created_at;
    }
    return Object.values(groupMap).sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  })();

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
              {/* 釘選人員快選 */}
              {pinnedEmps.length > 0 && !selectedEmp && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:11, color:'#94a3b8', marginBottom:5 }}>📌 釘選人員（點選快速記錄）</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {pinnedEmps.map(emp => (
                      <div key={emp.app_number} style={{ display:'flex', alignItems:'center', background:'#f3f0ff', borderRadius:20, border:'1px solid #c4b5fd', overflow:'hidden' }}>
                        <span onClick={() => setSelectedEmp(emp)}
                          style={{ padding:'4px 10px', fontSize:12, color:'#6d28d9', cursor:'pointer', fontWeight:600 }}>
                          {emp.name}
                        </span>
                        <button onClick={() => togglePin(emp)}
                          title="取消釘選"
                          style={{ padding:'4px 8px', background:'none', border:'none', borderLeft:'1px solid #c4b5fd', color:'#9ca3af', cursor:'pointer', fontSize:11 }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 姓名快搜 */}
              <EmployeeSearchPicker
                selected={selectedEmp}
                onSelect={emp => { setSelectedEmp(emp); setEmployees([]); }}
                placeholder="輸入姓名或員工編號搜尋..."
                pinnedEmps={pinnedEmps}
                onPin={togglePin}
              />
              {/* 按店家選 — 未選人員時顯示 */}
              {stores.length > 0 && !selectedEmp && (
                <>
                  <select style={{ ...inputStyle, color: '#475569' }}
                    onChange={async e => {
                      const storeName = e.target.value;
                      if (!storeName) { setEmployees([]); return; }
                      const r = await axios.get(`${API}/supervisor-hub/employees/search`, { params: { store_id: storeName } });
                      setEmployees(r.data || []);
                    }}>
                    <option value="">📍 或按店家篩選...</option>
                    {stores.map((s: any, i: number) => <option key={i} value={s.store_name}>{s.store_name}</option>)}
                  </select>
                  {/* 店家員工清單 */}
                  {employees.length > 0 && (
                    <div style={{ border:'1px solid #e2e8f0', borderRadius:8, maxHeight:220, overflowY:'auto', marginBottom:8, marginTop:-6 }}>
                      <div style={{ padding:'6px 12px', background:'#f8f4ff', fontSize:11, color:'#7c3aed', fontWeight:600, borderBottom:'1px solid #e2e8f0' }}>
                        共 {employees.length} 人，點選加入記錄
                      </div>
                      {employees.map(e => (
                        <div key={e.app_number}
                          style={{ padding:'8px 12px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                          onMouseEnter={el => (el.currentTarget.style.background='#f8f4ff')}
                          onMouseLeave={el => (el.currentTarget.style.background='#fff')}>
                          <span onClick={() => { setSelectedEmp(e); setEmployees([]); }}
                            style={{ fontWeight:600, color:'#1e293b', fontSize:13, flex:1, cursor:'pointer' }}>{e.name}</span>
                          <span style={{ color:'#94a3b8', fontSize:11, marginRight:8 }}>{e.position}</span>
                          <button onClick={() => togglePin(e)} title={pinnedEmps.some(p => p.app_number === e.app_number) ? '取消釘選' : '釘選'}
                            style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color: pinnedEmps.some(p => p.app_number === e.app_number) ? '#7c3aed' : '#cbd5e1' }}>
                            📌
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
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
                {c.name}{c.supervisor_id ? ' 🔹' : ''}
              </button>
            ))}
          </div>

          {/* 內容 */}
          <label style={labelStyle}>內容</label>
          <textarea style={{ ...inputStyle, minHeight:100, resize:'vertical' }} placeholder="輸入記錄內容..."
            value={content} onChange={e => setContent(e.target.value)} />

          {/* 附件上傳 */}
          <label style={labelStyle}>附件（圖片 / 影片 / 文件）</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ border:'2px dashed #c4b5fd', borderRadius:10, padding:'14px 12px', cursor:'pointer', background:'#faf5ff', marginBottom:8, textAlign:'center', color:'#7c3aed', fontSize:13 }}>
            📎 點擊選擇檔案（可多選）
          </div>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
            style={{ display:'none' }} onChange={handleFileSelect} />

          {/* 已選附件預覽 */}
          {pendingFiles.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              {pendingFiles.map((f, i) => (
                <div key={i} style={{ position:'relative', width:80, height:80, borderRadius:8, overflow:'hidden', border:'1px solid #e2e8f0', background:'#f8fafc' }}>
                  {f.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(f)} alt={f.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  ) : (
                    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}>
                      <span style={{ fontSize:22 }}>{getFileEmoji(f.type)}</span>
                      <span style={{ fontSize:9, color:'#64748b', textAlign:'center', padding:'0 4px', wordBreak:'break-all', lineHeight:1.2 }}>
                        {f.name.length > 12 ? f.name.slice(0,10)+'…' : f.name}
                      </span>
                    </div>
                  )}
                  <button onClick={() => removeFile(i)}
                    style={{ position:'absolute', top:2, right:2, background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', borderRadius:'50%', width:18, height:18, cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleSave} disabled={saving || uploading}
            style={{ ...btnStyle, background: saved ? '#22c55e':'#7c3aed', color:'#fff', width:'100%' }}>
            {uploading ? '上傳附件中...' : saving ? '儲存中...' : saved ? '✓ 已儲存！' : '儲存記錄'}
          </button>
        </div>
      )}

      {(mode === 'list' || mode === 'all') && (
        <div>
          <input style={inputStyle} placeholder="搜尋記錄內容..." value={listSearch}
            onChange={e => setListSearch(e.target.value)} />
          {loading ? <p style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>載入中...</p> :
            notes.length === 0 ? <p style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>尚無記錄</p> :
            noteGroups.map(group => {
              const isCollapsed = collapsedGroups.has(group.key);
              return (
                <div key={group.key} style={{ marginBottom:10 }}>
                  {/* 人員分組標題 */}
                  <div onClick={() => toggleGroup(group.key)}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'#f3f0ff', borderRadius:10, cursor:'pointer', border:'1px solid #ede9fe', userSelect:'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontWeight:700, color:'#6d28d9', fontSize:14 }}>{group.displayName}</span>
                      <span style={{ background:'#ede9fe', color:'#7c3aed', borderRadius:99, padding:'1px 8px', fontSize:11 }}>{group.notes.length} 筆</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:11, color:'#94a3b8' }}>最近：{new Date(group.latestDate).toLocaleDateString('zh-TW')}</span>
                      <span style={{ fontSize:12, color:'#7c3aed' }}>{isCollapsed ? '▶' : '▼'}</span>
                    </div>
                  </div>
                  {/* 展開的筆記列表 */}
                  {!isCollapsed && group.notes.map(n => (
                    <div key={n.id} style={{ ...cardStyle, marginTop:6, borderLeft:'3px solid #c4b5fd' }}>
                {editNote?.id === n.id ? (
                  <>
                    {/* 編輯分類 */}
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>分類</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        <button onClick={() => setEditNote({ ...editNote, category_id: '' })}
                          style={{ ...smallBtnStyle, background: !editNote.category_id ? '#7c3aed':'#e2e8f0', color: !editNote.category_id ? '#fff':'#475569' }}>未分類</button>
                        {categories.map(c => (
                          <button key={c.id} onClick={() => setEditNote({ ...editNote, category_id: c.id })}
                            style={{ ...smallBtnStyle, background: editNote.category_id===c.id ? c.color:'#e2e8f0', color: editNote.category_id===c.id ? '#fff':'#475569' }}>
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* 編輯內容 */}
                    <textarea style={{ ...inputStyle, minHeight:80 }} value={editNote.content} onChange={e => setEditNote({ ...editNote, content: e.target.value })} />

                    {/* 現有附件（可刪除） */}
                    {editNote.attachments && editNote.attachments.length > 0 && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>現有附件（點 ✕ 移除）</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                          {editNote.attachments.map((a, i) => (
                            <div key={i} style={{ position:'relative' }}>
                              {a.type?.startsWith('image/') ? (
                                <img src={a.url} alt={a.originalName} style={{ width:72, height:72, objectFit:'cover', borderRadius:8, border:'1px solid #e2e8f0' }} />
                              ) : (
                                <div style={{ width:72, height:72, borderRadius:8, border:'1px solid #e2e8f0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontSize:10, color:'#64748b', background:'#f8fafc', padding:4, textAlign:'center' }}>
                                  📎<br/>{a.originalName?.slice(-10)}
                                </div>
                              )}
                              <button
                                onClick={() => setEditNote({ ...editNote, attachments: editNote.attachments!.filter((_, j) => j !== i) })}
                                style={{ position:'absolute', top:-6, right:-6, background:'#ef4444', color:'#fff', border:'none', borderRadius:'50%', width:18, height:18, fontSize:11, cursor:'pointer', lineHeight:'18px', textAlign:'center', padding:0 }}>
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 待上傳的新附件 */}
                    {editPendingFiles.length > 0 && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>待上傳（{editPendingFiles.length} 個）</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {editPendingFiles.map((f, i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:4, background:'#f1f5f9', borderRadius:6, padding:'2px 8px', fontSize:12 }}>
                              <span>{f.name.length > 14 ? '...' + f.name.slice(-12) : f.name}</span>
                              <button onClick={() => setEditPendingFiles(prev => prev.filter((_, j) => j !== i))}
                                style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:0, fontSize:13 }}>✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 新增附件按鈕 */}
                    <div style={{ marginBottom:8 }}>
                      <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx"
                        ref={editFileInputRef} style={{ display:'none' }}
                        onChange={e => { if (e.target.files) { setEditPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = ''; } }} />
                      <button onClick={() => editFileInputRef.current?.click()}
                        style={{ ...smallBtnStyle, background:'#f1f5f9', color:'#475569' }}>
                        📎 新增圖片 / 附件
                      </button>
                    </div>

                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={handleUpdate} disabled={editUploading} style={{ ...btnStyle, background:'#7c3aed', color:'#fff', flex:1, opacity: editUploading ? 0.7 : 1 }}>
                        {editUploading ? '上傳中...' : '儲存'}
                      </button>
                      <button onClick={() => { setEditNote(null); setEditPendingFiles([]); }} style={{ ...btnStyle, background:'#e2e8f0', color:'#475569', flex:1 }}>取消</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                        {n.category_name && <span style={{ background:'#ede9fe', color:'#7c3aed', borderRadius:99, padding:'2px 10px', fontSize:11 }}>{n.category_name}</span>}
                        <span style={{ fontSize:12, color:'#94a3b8' }}>{n.employee_app_number || n.non_employee_name || '外部'}</span>
                      </div>
                      <span style={{ fontSize:11, color:'#cbd5e1', whiteSpace:'nowrap' }}>{new Date(n.created_at).toLocaleDateString('zh-TW')}</span>
                    </div>
                    <p style={{ margin:'0 0 8px', color:'#1e293b', lineHeight:1.6 }}>{n.content}</p>

                    {/* 附件顯示 */}
                    {n.attachments && n.attachments.length > 0 && (
                      <AttachmentViewer attachments={n.attachments} />
                    )}

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
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
                  ))}
                </div>
              );
            })
          }
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
//  Tab 2: 人評會記錄
// ────────────────────────────────────────────
interface ReviewRecord { id: string; employee_app_number?: string; employee_name?: string; categories: Array<{id?:string;name:string;color?:string}>; content: string; images?: string[]; attachments?: Attachment[]; created_by?: string; created_by_name?: string; created_at: string; }

function ReviewRecordTab({ supervisor }: { supervisor: { identifier: string; name: string; role: string } }) {
  const [mode, setMode] = useState<'write' | 'list'>('write');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [selectedCats, setSelectedCats] = useState<Array<{id?:string;name:string;color?:string}>>([]);
  const [content, setContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 列表
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [listSearch, setListSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editRecord, setEditRecord] = useState<ReviewRecord | null>(null);
  const [editPendingFiles, setEditPendingFiles] = useState<File[]>([]);
  const [editUploading, setEditUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    axios.get(`${API}/supervisor-hub/categories`, { params: { supervisor_id: supervisor.identifier } })
      .then(r => setCategories(r.data || []));
  }, []);

  const loadRecords = () => {
    setLoading(true);
    axios.get(`${API}/supervisor-hub/review-records`, { params: { limit: 100, search: listSearch || undefined } })
      .then(r => setRecords(r.data?.data || []))
      .catch(e => alert('載入失敗：' + (e.response?.data?.message || e.message)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (mode === 'list') loadRecords(); }, [mode, listSearch]);

  const toggleCat = (cat: Category) => {
    const exists = selectedCats.some(c => c.name === cat.name);
    if (exists) setSelectedCats(prev => prev.filter(c => c.name !== cat.name));
    else setSelectedCats(prev => [...prev, { id: cat.id, name: cat.name, color: cat.color }]);
  };

  const toggleGroup = (key: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const handleSave = async () => {
    if (!content.trim()) { alert('請輸入內容'); return; }
    if (selectedCats.length === 0) { alert('請至少選擇一個議題分類'); return; }
    setSaving(true);
    let attachments: Attachment[] = [];
    if (pendingFiles.length > 0) {
      setUploading(true);
      try {
        const fd = new FormData();
        pendingFiles.forEach(f => fd.append('files', f));
        const r = await axios.post(`${API}/supervisor-hub/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        attachments = r.data.attachments || [];
      } catch (e: any) { alert('附件上傳失敗：' + (e.response?.data?.message || e.message)); setSaving(false); setUploading(false); return; }
      setUploading(false);
    }
    try {
      await axios.post(`${API}/supervisor-hub/review-records`, {
        employee_app_number: selectedEmp?.app_number,
        employee_name: selectedEmp?.name,
        categories: selectedCats,
        content,
        attachments,
        created_by: supervisor.identifier,
        created_by_name: supervisor.name,
      });
      setSaved(true);
      setContent(''); setSelectedEmp(null); setSelectedCats([]); setPendingFiles([]);
      setTimeout(() => { setSaved(false); setMode('list'); }, 1200);
    } catch (e: any) { alert(e.response?.data?.message || '儲存失敗'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確認刪除？')) return;
    await axios.delete(`${API}/supervisor-hub/review-records/${id}`, { params: { supervisor_id: supervisor.identifier } });
    loadRecords();
  };

  const handleUpdate = async () => {
    if (!editRecord) return;
    setEditUploading(true);
    let newAtts: Attachment[] = [];
    if (editPendingFiles.length > 0) {
      try {
        const fd = new FormData();
        editPendingFiles.forEach(f => fd.append('files', f));
        const r = await axios.post(`${API}/supervisor-hub/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        newAtts = r.data.attachments || [];
      } catch (e: any) { alert('附件上傳失敗'); setEditUploading(false); return; }
    }
    try {
      await axios.patch(`${API}/supervisor-hub/review-records/${editRecord.id}`, {
        categories: editRecord.categories,
        content: editRecord.content,
        attachments: [...(editRecord.attachments || []), ...newAtts],
      }, { params: { supervisor_id: supervisor.identifier } });
      setEditRecord(null); setEditPendingFiles([]); loadRecords();
    } catch (e: any) { alert(e.response?.data?.message || '儲存失敗'); }
    setEditUploading(false);
  };

  // 分組
  type RGroup = { key: string; displayName: string; latestDate: string; records: ReviewRecord[] };
  const groups: RGroup[] = (() => {
    const map: Record<string, RGroup> = {};
    for (const r of records) {
      const key = r.employee_app_number || '__ext__';
      const displayName = r.employee_name || r.employee_app_number || '未指定人員';
      if (!map[key]) map[key] = { key, displayName, latestDate: r.created_at, records: [] };
      map[key].records.push(r);
      if (r.created_at > map[key].latestDate) map[key].latestDate = r.created_at;
    }
    return Object.values(map).sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  })();

  return (
    <div style={{ padding:16 }}>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {(['write','list'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ ...btnStyle, flex:1, background: mode===m ? '#0369a1':'#e2e8f0', color: mode===m ? '#fff':'#475569' }}>
            {m === 'write' ? '✍️ 新增記錄' : '📋 所有記錄'}
          </button>
        ))}
      </div>

      {mode === 'write' && (
        <div style={cardStyle}>
          <label style={labelStyle}>記錄對象（人員）</label>
          <EmployeeSearchPicker selected={selectedEmp} onSelect={setSelectedEmp} placeholder="輸入姓名或員工編號..." />

          <label style={labelStyle}>議題分類（可多選）</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
            {categories.map(c => {
              const active = selectedCats.some(s => s.name === c.name);
              return (
                <button key={c.id} onClick={() => toggleCat(c)}
                  style={{ ...smallBtnStyle, background: active ? c.color : '#e2e8f0', color: active ? '#fff' : '#475569', outline: active ? `2px solid ${c.color}` : 'none', outlineOffset: 2 }}>
                  {active ? '✓ ' : ''}{c.name}
                </button>
              );
            })}
          </div>
          {selectedCats.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
              <span style={{ fontSize:11, color:'#94a3b8' }}>已選：</span>
              {selectedCats.map((c, i) => (
                <span key={i} style={{ background: c.color || '#7c3aed', color:'#fff', borderRadius:99, padding:'1px 8px', fontSize:11 }}>{c.name}</span>
              ))}
            </div>
          )}

          <label style={labelStyle}>會議記錄內容</label>
          <textarea style={{ ...inputStyle, minHeight:120, resize:'vertical' }} placeholder="輸入本次人評會的會議內容、決議、追蹤事項..." value={content} onChange={e => setContent(e.target.value)} />

          <label style={labelStyle}>附件（圖片 / 文件）</label>
          <div onClick={() => fileInputRef.current?.click()}
            style={{ border:'2px dashed #7dd3fc', borderRadius:10, padding:'12px', cursor:'pointer', background:'#f0f9ff', marginBottom:8, textAlign:'center', color:'#0369a1', fontSize:13 }}>
            📎 點擊選擇附件
          </div>
          <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx"
            style={{ display:'none' }} onChange={e => { if (e.target.files) { setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value=''; }}} />
          {pendingFiles.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
              {pendingFiles.map((f, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:4, background:'#e0f2fe', borderRadius:6, padding:'2px 8px', fontSize:12 }}>
                  <span>{f.name.length > 14 ? '...'+f.name.slice(-12) : f.name}</span>
                  <button onClick={() => setPendingFiles(prev => prev.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:13 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleSave} disabled={saving || uploading}
            style={{ ...btnStyle, background: saved ? '#22c55e' : '#0369a1', color:'#fff', width:'100%' }}>
            {uploading ? '上傳中...' : saving ? '儲存中...' : saved ? '✓ 已儲存！' : '儲存人評會記錄'}
          </button>
        </div>
      )}

      {mode === 'list' && (
        <div>
          <input style={inputStyle} placeholder="搜尋記錄內容或人員姓名..." value={listSearch} onChange={e => setListSearch(e.target.value)} />
          {loading ? <p style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>載入中...</p> :
            records.length === 0 ? <p style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>尚無記錄</p> :
            groups.map(group => {
              const isCollapsed = collapsedGroups.has(group.key);
              return (
                <div key={group.key} style={{ marginBottom:10 }}>
                  <div onClick={() => toggleGroup(group.key)}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'#e0f2fe', borderRadius:10, cursor:'pointer', border:'1px solid #bae6fd', userSelect:'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontWeight:700, color:'#0369a1', fontSize:14 }}>{group.displayName}</span>
                      <span style={{ background:'#bae6fd', color:'#0369a1', borderRadius:99, padding:'1px 8px', fontSize:11 }}>{group.records.length} 筆</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:11, color:'#64748b' }}>最近：{new Date(group.latestDate).toLocaleDateString('zh-TW')}</span>
                      <span style={{ fontSize:12, color:'#0369a1' }}>{isCollapsed ? '▶' : '▼'}</span>
                    </div>
                  </div>
                  {!isCollapsed && group.records.map(rec => (
                    <div key={rec.id} style={{ ...cardStyle, marginTop:6, borderLeft:'3px solid #7dd3fc' }}>
                      {editRecord?.id === rec.id ? (
                        <>
                          {/* 編輯分類 */}
                          <div style={{ marginBottom:8 }}>
                            <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>議題分類（可多選）</div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                              {categories.map(c => {
                                const active = editRecord.categories.some(s => s.name === c.name);
                                return (
                                  <button key={c.id} onClick={() => {
                                    const exists = editRecord.categories.some(s => s.name === c.name);
                                    setEditRecord({ ...editRecord, categories: exists
                                      ? editRecord.categories.filter(s => s.name !== c.name)
                                      : [...editRecord.categories, { id: c.id, name: c.name, color: c.color }] });
                                  }} style={{ ...smallBtnStyle, background: active ? c.color : '#e2e8f0', color: active ? '#fff' : '#475569' }}>
                                    {active ? '✓ ' : ''}{c.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <textarea style={{ ...inputStyle, minHeight:80 }} value={editRecord.content} onChange={e => setEditRecord({ ...editRecord, content: e.target.value })} />
                          {/* 現有附件 */}
                          {editRecord.attachments && editRecord.attachments.length > 0 && (
                            <div style={{ marginBottom:8 }}>
                              <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>現有附件（點 ✕ 移除）</div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                                {editRecord.attachments.map((a, i) => (
                                  <div key={i} style={{ position:'relative' }}>
                                    {a.type?.startsWith('image/') ? (
                                      <img src={a.url} alt={a.originalName} style={{ width:64, height:64, objectFit:'cover', borderRadius:8, border:'1px solid #e2e8f0' }} />
                                    ) : (
                                      <div style={{ width:64, height:64, borderRadius:8, border:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#64748b', background:'#f8fafc', padding:2, textAlign:'center' }}>📎 {a.originalName?.slice(-8)}</div>
                                    )}
                                    <button onClick={() => setEditRecord({ ...editRecord, attachments: editRecord.attachments!.filter((_,j)=>j!==i) })}
                                      style={{ position:'absolute', top:-6, right:-6, background:'#ef4444', color:'#fff', border:'none', borderRadius:'50%', width:18, height:18, fontSize:11, cursor:'pointer', lineHeight:'18px', textAlign:'center', padding:0 }}>✕</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {editPendingFiles.length > 0 && (
                            <div style={{ marginBottom:6, display:'flex', flexWrap:'wrap', gap:4 }}>
                              {editPendingFiles.map((f,i) => (
                                <div key={i} style={{ display:'flex', alignItems:'center', gap:4, background:'#e0f2fe', borderRadius:6, padding:'2px 8px', fontSize:12 }}>
                                  <span>{f.name.slice(-12)}</span>
                                  <button onClick={() => setEditPendingFiles(prev => prev.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:13 }}>✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ marginBottom:8 }}>
                            <input type="file" multiple accept="image/*,.pdf,.doc,.docx" ref={editFileInputRef} style={{ display:'none' }}
                              onChange={e => { if (e.target.files) { setEditPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value=''; }}} />
                            <button onClick={() => editFileInputRef.current?.click()} style={{ ...smallBtnStyle, background:'#e0f2fe', color:'#0369a1' }}>📎 新增附件</button>
                          </div>
                          <div style={{ display:'flex', gap:8 }}>
                            <button onClick={handleUpdate} disabled={editUploading} style={{ ...btnStyle, background:'#0369a1', color:'#fff', flex:1, opacity:editUploading?0.7:1 }}>{editUploading?'上傳中...':'儲存'}</button>
                            <button onClick={() => { setEditRecord(null); setEditPendingFiles([]); }} style={{ ...btnStyle, background:'#e2e8f0', color:'#475569', flex:1 }}>取消</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                              {rec.categories.map((c, i) => (
                                <span key={i} style={{ background: c.color || '#0369a1', color:'#fff', borderRadius:99, padding:'2px 9px', fontSize:11 }}>{c.name}</span>
                              ))}
                            </div>
                            <span style={{ fontSize:11, color:'#cbd5e1', whiteSpace:'nowrap' }}>{new Date(rec.created_at).toLocaleDateString('zh-TW')}</span>
                          </div>
                          <p style={{ margin:'0 0 8px', color:'#1e293b', lineHeight:1.6 }}>{rec.content}</p>
                          {rec.attachments && rec.attachments.length > 0 && <AttachmentViewer attachments={rec.attachments} />}
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
                            <span style={{ fontSize:12, color:'#94a3b8' }}>記錄者：{rec.created_by_name}</span>
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={() => setEditRecord(rec)} style={{ ...smallBtnStyle, background:'#e0f2fe', color:'#0369a1' }}>編輯</button>
                              <button onClick={() => handleDelete(rec.id)} style={{ ...smallBtnStyle, background:'#fee2e2', color:'#dc2626' }}>刪除</button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })
          }
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
//  附件檢視器
// ────────────────────────────────────────────
function AttachmentViewer({ attachments }: { attachments: Attachment[] }) {
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {attachments.map((a, i) => {
          const isImage = a.type?.startsWith('image/');
          const isVideo = a.type?.startsWith('video/');
          if (isImage) {
            return (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                style={{ display:'block', width:80, height:80, borderRadius:8, overflow:'hidden', border:'1px solid #e2e8f0', flexShrink:0 }}>
                <img src={a.url} alt={a.originalName} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              </a>
            );
          }
          if (isVideo) {
            return (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:80, height:80, borderRadius:8, border:'1px solid #e2e8f0', background:'#f1f5f9', gap:4, textDecoration:'none', flexShrink:0 }}>
                <span style={{ fontSize:24 }}>🎬</span>
                <span style={{ fontSize:9, color:'#64748b', textAlign:'center', padding:'0 4px', wordBreak:'break-all' }}>
                  {a.originalName.length > 10 ? a.originalName.slice(0,9)+'…' : a.originalName}
                </span>
              </a>
            );
          }
          // Document / other
          return (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" download={a.originalName}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', borderRadius:8, border:'1px solid #e2e8f0', background:'#f8fafc', textDecoration:'none', color:'#374151', fontSize:12, flexShrink:0, maxWidth:200 }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{getFileEmoji(a.type)}</span>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.originalName}</span>
              <span style={{ color:'#94a3b8', fontSize:10, flexShrink:0 }}>⬇</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function getFileEmoji(mimeType: string): string {
  if (!mimeType) return '📎';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('msword')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📋';
  if (mimeType.includes('video')) return '🎬';
  if (mimeType.includes('audio')) return '🎵';
  if (mimeType.includes('text')) return '📃';
  return '📎';
}

// ────────────────────────────────────────────
//  Tab 2: AI 快問
// ────────────────────────────────────────────
function AiChatTab({ supervisor }: { supervisor: { identifier: string; name: string; role: string } }) {
  const [step, setStep] = useState<'select' | 'chat'>('select');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [empSummary, setEmpSummary] = useState<EmployeeSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState<Record<string, boolean>>({ notes: true, conversations: false, reviews: false, riskFlags: true, channelMessages: false, ticketHistory: false, orderTrend: true });
  const [personas, setPersonas] = useState<Record<string, string>>({});
  const [aiType, setAiType] = useState<'claude' | 'openai' | 'gemini'>('claude');
  const [session, setSession] = useState<AiSession | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    axios.get(`${API}/supervisor-hub/ai/personas`).then(r => {
      const map: Record<string, string> = {};
      (r.data || []).forEach((p: any) => {
        map[p.ai_type] = p.system_prompt?.slice(0, 40) || '';
      });
      setPersonas(map);
    });
  }, []);

  // 選人後自動載入資料彙整
  useEffect(() => {
    if (!selectedEmp) { setEmpSummary(null); return; }
    setLoadingSummary(true);
    axios.get(`${API}/supervisor-hub/ai/employee-summary/${selectedEmp.app_number}`, {
      params: { supervisor_id: supervisor.identifier },
    })
      .then(r => setEmpSummary(r.data))
      .catch(() => setEmpSummary(null))
      .finally(() => setLoadingSummary(false));
  }, [selectedEmp]);

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
  const toggleSection = (key: string) => setSummaryOpen(p => ({ ...p, [key]: !p[key] }));

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
          <EmployeeSearchPicker selected={selectedEmp} onSelect={emp => { setSelectedEmp(emp); }} placeholder="輸入姓名或員工編號..." />

          <label style={labelStyle}>選擇 AI</label>
          <div style={{ display:'flex', gap:8, marginBottom:4 }}>
            {(['claude', 'openai', 'gemini'] as const).map(ai => (
              <button key={ai} onClick={() => setAiType(ai)}
                style={{ flex:1, padding:'10px 8px', border: aiType===ai ? `2px solid ${AI_LABELS[ai].color}` : '2px solid transparent',
                  borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:13,
                  background: aiType===ai ? AI_LABELS[ai].color : '#f1f5f9',
                  color: aiType===ai ? '#fff' : '#475569', transition:'all 0.2s' }}>
                {AI_LABELS[ai].emoji} {AI_LABELS[ai].label}
              </button>
            ))}
          </div>
          {personas[aiType] && (
            <div style={{ background:'#f8f4ff', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#6d28d9', lineHeight:1.5 }}>
              💬 {personas[aiType]}…
            </div>
          )}

          <button onClick={startChat}
            style={{ ...btnStyle, background: aiInfo.color, color:'#fff', width:'100%' }}>
            {aiInfo.emoji} 開始 AI 快問
          </button>
        </div>

        {/* ── 人員資料彙整 ── */}
        {selectedEmp && (
          <div style={{ marginTop:8 }}>
            {loadingSummary ? (
              <div style={{ ...cardStyle, textAlign:'center', color:'#94a3b8', padding:24 }}>載入人員資料中...</div>
            ) : empSummary && (
              <EmployeeSummaryPanel
                emp={selectedEmp}
                summary={empSummary}
                open={summaryOpen}
                onToggle={toggleSection}
              />
            )}
          </div>
        )}
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
  const [newCatPersonal, setNewCatPersonal] = useState(false);
  const [newSvEmp, setNewSvEmp] = useState<Employee | null>(null);
  const [newSvPassword, setNewSvPassword] = useState('');
  const [editPwdId, setEditPwdId] = useState<string | null>(null);
  const [editPwdValue, setEditPwdValue] = useState('');
  const [newConfEmp, setNewConfEmp] = useState<Employee | null>(null);
  const [newConfReason, setNewConfReason] = useState('');
  const [editPersona, setEditPersona] = useState<AiPersona | null>(null);

  const loadCategories = () => {
    axios.get(`${API}/supervisor-hub/categories`, { params: { supervisor_id: supervisor.identifier } })
      .then(r => setCategories(r.data || []));
  };

  const load = () => {
    loadCategories();
    axios.get(`${API}/supervisor-hub/supervisors`).then(r => setSupervisors(r.data || []));
    axios.get(`${API}/supervisor-hub/confidential`).then(r => setConfidential(r.data || []));
    axios.get(`${API}/supervisor-hub/ai/personas`).then(r => setPersonas(r.data || []));
  };

  useEffect(() => { load(); }, []);

  const isAdmin = supervisor.role === 'admin';

  // ── 分類排序 ──
  const moveCategory = async (idx: number, dir: -1 | 1) => {
    const newCats = [...categories];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= newCats.length) return;
    [newCats[idx], newCats[targetIdx]] = [newCats[targetIdx], newCats[idx]];
    setCategories(newCats);
    await axios.patch(`${API}/supervisor-hub/categories/order`, {
      supervisor_id: supervisor.identifier,
      ordered_ids: newCats.map(c => c.id),
    });
  };

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
          <p style={{ color:'#64748b', fontSize:12, margin:'0 0 12px' }}>
            🌐 全域分類由管理員建立，🔹 個人分類只有您自己看得到。可拖曳↑↓調整順序。
          </p>

          {/* 新增分類 */}
          <div style={{ display:'flex', gap:8, marginBottom:4, alignItems:'center' }}>
            <input style={{ ...inputStyle, flex:1, margin:0 }} placeholder="分類名稱" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
            <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
              style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:4, cursor:'pointer', height:38, flexShrink:0 }} />
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:'#475569' }}>
              <input type="checkbox" checked={newCatPersonal} onChange={e => setNewCatPersonal(e.target.checked)}
                style={{ cursor:'pointer' }} />
              設為我的個人分類（只有我看得到）
            </label>
            <button onClick={async () => {
              if (!newCatName.trim()) return;
              await axios.post(`${API}/supervisor-hub/categories`,
                { name: newCatName, color: newCatColor },
                { params: { supervisor_id: newCatPersonal ? supervisor.identifier : undefined } }
              );
              setNewCatName(''); loadCategories();
            }} style={{ ...btnStyle, background:'#7c3aed', color:'#fff', marginLeft:'auto' }}>新增</button>
          </div>

          {/* 分類列表 */}
          {categories.map((c, idx) => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 0', borderBottom:'1px solid #f1f5f9' }}>
              {/* 排序按鈕 */}
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                <button onClick={() => moveCategory(idx, -1)} disabled={idx === 0}
                  style={{ background:'none', border:'none', cursor: idx===0 ? 'default':'pointer', color: idx===0 ? '#d1d5db':'#7c3aed', padding:'0 4px', fontSize:12, lineHeight:1 }}>▲</button>
                <button onClick={() => moveCategory(idx, 1)} disabled={idx === categories.length - 1}
                  style={{ background:'none', border:'none', cursor: idx===categories.length-1 ? 'default':'pointer', color: idx===categories.length-1 ? '#d1d5db':'#7c3aed', padding:'0 4px', fontSize:12, lineHeight:1 }}>▼</button>
              </div>
              <span style={{ width:14, height:14, borderRadius:'50%', background:c.color, display:'inline-block', flexShrink:0 }} />
              <span style={{ flex:1, color:'#1e293b', fontSize:14 }}>{c.name}</span>
              {c.supervisor_id
                ? <span style={{ fontSize:10, background:'#ede9fe', color:'#7c3aed', borderRadius:99, padding:'1px 7px', flexShrink:0 }}>我的</span>
                : <span style={{ fontSize:10, background:'#f1f5f9', color:'#64748b', borderRadius:99, padding:'1px 7px', flexShrink:0 }}>全域</span>
              }
              {/* 只能刪自己的分類（admin 可刪全域） */}
              {(isAdmin || c.supervisor_id === supervisor.identifier) && (
                <button onClick={async () => { await axios.delete(`${API}/supervisor-hub/categories/${c.id}`); loadCategories(); }}
                  style={{ ...smallBtnStyle, background:'#fee2e2', color:'#dc2626', flexShrink:0 }}>刪除</button>
              )}
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
//  人員資料彙整面板
// ────────────────────────────────────────────
function EmployeeSummaryPanel({
  emp, summary, open, onToggle,
}: {
  emp: Employee;
  summary: EmployeeSummary;
  open: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const { employee, notes, conversations, reviews, riskFlags, channelMessages = [], ticketHistory = [], orderTrend } = summary;
  const openFlags = riskFlags.filter((f: any) => ['open', 'acknowledged', 'in_progress'].includes(f.status));
  const openTickets = ticketHistory.filter((t: any) => !['closed', 'resolved', 'cancelled'].includes(t.status));
  const inboundMsgs = channelMessages.filter((m: any) => m.direction === 'inbound');
  const trendEmoji = { up:'📈', down:'📉', stable:'➡️', new:'🆕' };
  const trendColor = { up:'#16a34a', down:'#dc2626', stable:'#64748b', new:'#7c3aed' };

  const SectionHeader = ({ id, icon, label, count, badgeColor }: { id: string; icon: string; label: string; count: number; badgeColor?: string }) => (
    <button onClick={() => onToggle(id)}
      style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background: open[id] ? '#f8f4ff':'#f8fafc', border:'none', borderRadius: open[id] ? '10px 10px 0 0':'10px', cursor:'pointer', textAlign:'left', marginBottom: open[id] ? 0 : 8 }}>
      <span style={{ fontSize:16 }}>{icon}</span>
      <span style={{ flex:1, fontWeight:700, color:'#1e293b', fontSize:13 }}>{label}</span>
      <span style={{ background: badgeColor || (count > 0 ? '#ede9fe':'#e2e8f0'), color: badgeColor ? '#fff' : (count > 0 ? '#7c3aed':'#94a3b8'), borderRadius:99, padding:'1px 8px', fontSize:11, fontWeight:700 }}>{count}</span>
      <span style={{ color:'#94a3b8', fontSize:12 }}>{open[id] ? '▲':'▼'}</span>
    </button>
  );

  return (
    <div>
      {/* 標題卡 */}
      <div style={{ ...cardStyle, background:'linear-gradient(135deg,#7c3aed,#a855f7)', padding:'14px 16px', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ fontSize:20 }}>👤</span>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:16, color:'#fff' }}>{emp.name}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.8)', marginTop:2 }}>
              {employee?.store_name && `${employee.store_name}　`}
              {employee?.title && `${employee.title}　`}
              {emp.app_number}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
            {openFlags.length > 0 && (
              <span style={{ background:'#ef4444', color:'#fff', borderRadius:99, padding:'2px 8px', fontSize:11, fontWeight:700 }}>⚠️ {openFlags.length} 風險</span>
            )}
            {employee?.is_leave && (
              <span style={{ background:'#fbbf24', color:'#78350f', borderRadius:99, padding:'2px 8px', fontSize:11, fontWeight:700 }}>請假中</span>
            )}
            {employee && !employee.is_active && (
              <span style={{ background:'#94a3b8', color:'#fff', borderRadius:99, padding:'2px 8px', fontSize:11, fontWeight:700 }}>已停用</span>
            )}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
          {[
            { label:'隨手記', val: notes.length, color:'#c4b5fd' },
            { label:'對話', val: conversations.length, color:'#93c5fd' },
            { label:'評價', val: reviews.length, color:'#6ee7b7' },
            { label:'風險', val: riskFlags.length, color: openFlags.length > 0 ? '#fca5a5':'#cbd5e1' },
            { label:'頻道訊息', val: channelMessages.length, color:'#fde68a' },
            { label:'工單', val: ticketHistory.length, color: openTickets.length > 0 ? '#fca5a5':'#cbd5e1' },
          ].map(item => (
            <div key={item.label} style={{ textAlign:'center', flex:'1 1 50px' }}>
              <div style={{ fontWeight:800, fontSize:16, color: item.color }}>{item.val}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)' }}>{item.label}</div>
            </div>
          ))}
          {orderTrend?.hasData && (
            <div style={{ textAlign:'center', flex:'1 1 50px' }}>
              <div style={{ fontWeight:800, fontSize:16, color: trendColor[orderTrend.totalTrend.trend] }}>
                {trendEmoji[orderTrend.totalTrend.trend]}
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)' }}>接單趨勢</div>
            </div>
          )}
        </div>
      </div>

      {/* 風險標記 */}
      {riskFlags.length > 0 && (
        <div style={{ marginBottom:8 }}>
          <SectionHeader id="riskFlags" icon="⚠️" label="風險標記" count={riskFlags.length} badgeColor={openFlags.length > 0 ? '#ef4444' : undefined} />
          {open.riskFlags && (
            <div style={{ border:'1px solid #fecaca', borderTop:'none', borderRadius:'0 0 10px 10px', overflow:'hidden', marginBottom:8 }}>
              {riskFlags.map((f: any) => {
                const severityStyle: Record<string, string> = { critical:'#ef4444', high:'#f97316', medium:'#eab308', low:'#22c55e' };
                const statusLabel: Record<string, string> = { open:'未處理', acknowledged:'已確認', in_progress:'處理中', resolved:'已解決', false_positive:'誤判' };
                return (
                  <div key={f.id} style={{ padding:'10px 14px', borderBottom:'1px solid #fef2f2', background:'#fff' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background: severityStyle[f.severity] || '#94a3b8', flexShrink:0, display:'inline-block' }} />
                      <span style={{ fontWeight:700, color:'#1e293b', fontSize:13, flex:1 }}>{f.title}</span>
                      <span style={{ fontSize:10, background:'#f1f5f9', color:'#64748b', borderRadius:99, padding:'1px 7px' }}>{statusLabel[f.status] || f.status}</span>
                    </div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{f.risk_type} ｜ {new Date(f.created_at).toLocaleDateString('zh-TW')}</div>
                    {f.description && <div style={{ fontSize:12, color:'#475569', marginTop:4, lineHeight:1.5 }}>{f.description}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 主管隨手記 */}
      <div style={{ marginBottom:8 }}>
        <SectionHeader id="notes" icon="📝" label="主管隨手記" count={notes.length} />
        {open.notes && (
          <div style={{ border:'1px solid #e2e8f0', borderTop:'none', borderRadius:'0 0 10px 10px', overflow:'hidden', marginBottom:8 }}>
            {notes.length === 0 ? (
              <div style={{ padding:14, color:'#94a3b8', fontSize:13, textAlign:'center' }}>尚無隨手記</div>
            ) : notes.slice(0, 10).map((n: any) => (
              <div key={n.id} style={{ padding:'10px 14px', borderBottom:'1px solid #f8fafc', background:'#fff' }}>
                <div style={{ display:'flex', gap:6, marginBottom:4, alignItems:'center' }}>
                  {n.category_name && <span style={{ background:'#ede9fe', color:'#7c3aed', borderRadius:99, padding:'1px 8px', fontSize:10 }}>{n.category_name}</span>}
                  <span style={{ fontSize:11, color:'#94a3b8', marginLeft:'auto' }}>{n.supervisor_name} · {new Date(n.created_at).toLocaleDateString('zh-TW')}</span>
                </div>
                <div style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>{n.content}</div>
              </div>
            ))}
            {notes.length > 10 && <div style={{ padding:'8px 14px', background:'#f8fafc', fontSize:12, color:'#94a3b8', textAlign:'center' }}>…還有 {notes.length - 10} 筆</div>}
          </div>
        )}
      </div>

      {/* 對話記錄 */}
      <div style={{ marginBottom:8 }}>
        <SectionHeader id="conversations" icon="💬" label="心理輔導對話記錄" count={conversations.length} />
        {open.conversations && (
          <div style={{ border:'1px solid #e2e8f0', borderTop:'none', borderRadius:'0 0 10px 10px', overflow:'hidden', marginBottom:8 }}>
            {conversations.length === 0 ? (
              <div style={{ padding:14, color:'#94a3b8', fontSize:13, textAlign:'center' }}>尚無對話記錄</div>
            ) : conversations.slice(0, 10).map((c: any) => {
              const text = c.extracted_text || c.raw_text || '';
              return (
                <div key={c.id} style={{ padding:'10px 14px', borderBottom:'1px solid #f8fafc', background:'#fff' }}>
                  <div style={{ display:'flex', gap:6, marginBottom:4, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, color:'#64748b' }}>{c.conversation_type || '一般'} ｜ {c.interviewer_name || '未知訪談者'}</span>
                    {c.need_followup && <span style={{ background:'#fef3c7', color:'#92400e', borderRadius:99, padding:'1px 6px', fontSize:10 }}>需追蹤</span>}
                    <span style={{ fontSize:11, color:'#94a3b8', marginLeft:'auto' }}>
                      {c.conversation_date ? new Date(c.conversation_date).toLocaleDateString('zh-TW') : new Date(c.created_at).toLocaleDateString('zh-TW')}
                    </span>
                  </div>
                  {text && <div style={{ fontSize:12, color:'#475569', lineHeight:1.6 }}>{text.slice(0, 150)}{text.length > 150 ? '...' : ''}</div>}
                </div>
              );
            })}
            {conversations.length > 10 && <div style={{ padding:'8px 14px', background:'#f8fafc', fontSize:12, color:'#94a3b8', textAlign:'center' }}>…還有 {conversations.length - 10} 筆</div>}
          </div>
        )}
      </div>

      {/* 評價記錄 */}
      <div style={{ marginBottom:8 }}>
        <SectionHeader id="reviews" icon="⭐" label="評價記錄" count={reviews.length} />
        {open.reviews && (
          <div style={{ border:'1px solid #e2e8f0', borderTop:'none', borderRadius:'0 0 10px 10px', overflow:'hidden', marginBottom:8 }}>
            {reviews.length === 0 ? (
              <div style={{ padding:14, color:'#94a3b8', fontSize:13, textAlign:'center' }}>尚無評價記錄</div>
            ) : reviews.slice(0, 10).map((r: any) => {
              const typeEmoji: Record<string, string> = { positive:'✅', negative:'❌', complaint:'⚠️', praise:'🌟', other:'📝' };
              return (
                <div key={r.id} style={{ padding:'10px 14px', borderBottom:'1px solid #f8fafc', background:'#fff' }}>
                  <div style={{ display:'flex', gap:6, marginBottom:4, alignItems:'center' }}>
                    <span style={{ fontSize:13 }}>{typeEmoji[r.review_type] || '📝'}</span>
                    <span style={{ fontSize:11, color:'#64748b' }}>{r.review_type} ｜ 急迫度：{r.urgency || 'normal'}</span>
                    <span style={{ fontSize:11, color:'#94a3b8', marginLeft:'auto' }}>
                      {r.event_date ? new Date(r.event_date).toLocaleDateString('zh-TW') : new Date(r.created_at).toLocaleDateString('zh-TW')}
                    </span>
                  </div>
                  {r.content && <div style={{ fontSize:12, color:'#475569', lineHeight:1.6 }}>{r.content.slice(0, 150)}{r.content.length > 150 ? '...' : ''}</div>}
                </div>
              );
            })}
            {reviews.length > 10 && <div style={{ padding:'8px 14px', background:'#f8fafc', fontSize:12, color:'#94a3b8', textAlign:'center' }}>…還有 {reviews.length - 10} 筆</div>}
          </div>
        )}
      </div>

      {/* 官方頻道訊息 */}
      <div style={{ marginBottom:8 }}>
        <SectionHeader id="channelMessages" icon="📱" label="官方頻道訊息" count={channelMessages.length} />
        {open.channelMessages && (
          <div style={{ border:'1px solid #e2e8f0', borderTop:'none', borderRadius:'0 0 10px 10px', overflow:'hidden', marginBottom:8 }}>
            {channelMessages.length === 0 ? (
              <div style={{ padding:14, color:'#94a3b8', fontSize:13, textAlign:'center' }}>尚無頻道訊息</div>
            ) : (
              <>
                {inboundMsgs.length > 0 && (
                  <div style={{ padding:'6px 14px', background:'#fefce8', fontSize:11, color:'#854d0e' }}>
                    📊 員工本人發出 {inboundMsgs.length} 筆訊息
                  </div>
                )}
                {channelMessages.slice(0, 15).map((m: any, i: number) => {
                  const channelLabel = m.channel === 'official-line' ? '📱 LINE' : '🎫 工單留言';
                  const dirLabel: Record<string, string> = { inbound:'👤 員工', store:'🏪 門市', engineer:'🔧 工程師', reviewer:'📋 審核' };
                  const isEmployee = m.direction === 'inbound';
                  return (
                    <div key={m.id || i} style={{ padding:'8px 14px', borderBottom:'1px solid #f8fafc', background: isEmployee ? '#fffbeb':'#fff' }}>
                      <div style={{ display:'flex', gap:6, marginBottom:3, alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, color:'#64748b' }}>{channelLabel} ｜ {dirLabel[m.direction] || m.direction}</span>
                        {m.ticket_no && <span style={{ background:'#ede9fe', color:'#7c3aed', borderRadius:99, padding:'1px 6px', fontSize:10 }}>{m.ticket_no}</span>}
                        <span style={{ fontSize:11, color:'#94a3b8', marginLeft:'auto' }}>
                          {m.message_time ? new Date(m.message_time).toLocaleDateString('zh-TW') : ''}
                        </span>
                      </div>
                      {m.message_text && <div style={{ fontSize:12, color:'#374151', lineHeight:1.5 }}>{m.message_text.slice(0, 120)}{m.message_text.length > 120 ? '...' : ''}</div>}
                    </div>
                  );
                })}
                {channelMessages.length > 15 && <div style={{ padding:'8px 14px', background:'#f8fafc', fontSize:12, color:'#94a3b8', textAlign:'center' }}>…還有 {channelMessages.length - 15} 筆</div>}
              </>
            )}
          </div>
        )}
      </div>

      {/* 工單回報歷史 */}
      <div style={{ marginBottom:8 }}>
        <SectionHeader id="ticketHistory" icon="🎫" label="工單回報歷史" count={ticketHistory.length} badgeColor={openTickets.length > 0 ? '#f97316' : undefined} />
        {open.ticketHistory && (
          <div style={{ border:'1px solid #e2e8f0', borderTop:'none', borderRadius:'0 0 10px 10px', overflow:'hidden', marginBottom:8 }}>
            {ticketHistory.length === 0 ? (
              <div style={{ padding:14, color:'#94a3b8', fontSize:13, textAlign:'center' }}>尚無工單記錄</div>
            ) : (
              <>
                {openTickets.length > 0 && (
                  <div style={{ padding:'6px 14px', background:'#fff7ed', fontSize:11, color:'#9a3412' }}>
                    🔓 目前進行中工單 {openTickets.length} 筆
                  </div>
                )}
                {ticketHistory.slice(0, 15).map((t: any, i: number) => {
                  const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
                    pending:     { bg:'#fef3c7', color:'#92400e', label:'⏳ 待處理' },
                    open:        { bg:'#dbeafe', color:'#1e40af', label:'🔓 處理中' },
                    in_progress: { bg:'#e0f2fe', color:'#0c4a6e', label:'🔧 進行中' },
                    resolved:    { bg:'#dcfce7', color:'#166534', label:'✅ 已解決' },
                    closed:      { bg:'#f1f5f9', color:'#475569', label:'🔒 已關閉' },
                    cancelled:   { bg:'#fee2e2', color:'#991b1b', label:'❌ 已取消' },
                  };
                  const ss = statusStyle[t.status] || { bg:'#f1f5f9', color:'#475569', label: t.status };
                  const priorityEmoji: Record<string, string> = { urgent:'🚨', high:'🔴', medium:'🟡', low:'🟢' };
                  return (
                    <div key={t.id || i} style={{ padding:'10px 14px', borderBottom:'1px solid #f8fafc', background:'#fff' }}>
                      <div style={{ display:'flex', gap:6, marginBottom:4, alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ background: ss.bg, color: ss.color, borderRadius:99, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{ss.label}</span>
                        <span style={{ fontSize:11, color:'#64748b' }}>{priorityEmoji[t.priority] || ''} {t.ticket_no}</span>
                        <span style={{ fontSize:11, color:'#94a3b8', marginLeft:'auto' }}>
                          {t.ticket_created_at ? new Date(t.ticket_created_at).toLocaleDateString('zh-TW') : ''}
                        </span>
                      </div>
                      {(t.parent_category || t.category) && (
                        <div style={{ fontSize:10, color:'#94a3b8', marginBottom:2 }}>
                          {[t.parent_category, t.category, t.sub_category].filter(Boolean).join(' › ')}
                        </div>
                      )}
                      {t.issue_title && <div style={{ fontSize:13, color:'#1e293b', fontWeight:600 }}>{t.issue_title}</div>}
                      {t.issue_desc && <div style={{ fontSize:12, color:'#475569', marginTop:2, lineHeight:1.5 }}>{t.issue_desc.slice(0, 100)}{t.issue_desc.length > 100 ? '...' : ''}</div>}
                    </div>
                  );
                })}
                {ticketHistory.length > 15 && <div style={{ padding:'8px 14px', background:'#f8fafc', fontSize:12, color:'#94a3b8', textAlign:'center' }}>…還有 {ticketHistory.length - 15} 筆</div>}
              </>
            )}
          </div>
        )}
      </div>

      {/* 接單業績趨勢 */}
      <div style={{ marginBottom:8 }}>
        <SectionHeader
          id="orderTrend"
          icon={orderTrend?.hasData ? trendEmoji[orderTrend.totalTrend.trend] : '📊'}
          label="接單業績趨勢"
          count={orderTrend?.hasData ? orderTrend.totalTrend.recentAvg : 0}
          badgeColor={orderTrend?.hasData ? trendColor[orderTrend.totalTrend.trend] : undefined}
        />
        {open.orderTrend && (
          <div style={{ border:'1px solid #e2e8f0', borderTop:'none', borderRadius:'0 0 10px 10px', overflow:'hidden', marginBottom:8 }}>
            {!orderTrend?.hasData ? (
              <div style={{ padding:14, color:'#94a3b8', fontSize:13, textAlign:'center' }}>
                尚無業績資料，請先執行訂單同步
              </div>
            ) : (
              <>
                {/* 整體趨勢摘要 */}
                <div style={{ padding:'10px 14px', background: orderTrend.totalTrend.trend === 'down' ? '#fff7ed' : '#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:20 }}>{trendEmoji[orderTrend.totalTrend.trend]}</span>
                    <div style={{ flex:1 }}>
                      <span style={{ fontWeight:700, color: trendColor[orderTrend.totalTrend.trend], fontSize:14 }}>
                        {orderTrend.totalTrend.trend === 'up' && '接單量上升中'}
                        {orderTrend.totalTrend.trend === 'down' && '接單量下滑中'}
                        {orderTrend.totalTrend.trend === 'stable' && '接單量持平'}
                        {orderTrend.totalTrend.trend === 'new' && '近期開始接單'}
                      </span>
                      {orderTrend.totalTrend.changePercent !== null && (
                        <span style={{ marginLeft:8, fontSize:12, color: trendColor[orderTrend.totalTrend.trend] }}>
                          {orderTrend.totalTrend.changePercent > 0 ? '+' : ''}{orderTrend.totalTrend.changePercent}%
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'#64748b' }}>近3月均 <strong>{orderTrend.totalTrend.recentAvg}</strong> 單</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>前3月均 {orderTrend.totalTrend.prevAvg} 單</div>
                    </div>
                  </div>

                  {/* 月份 bar chart（簡易） */}
                  {orderTrend.totalTrend.months.length > 0 && (() => {
                    const maxCount = Math.max(...orderTrend.totalTrend.months.map(m => m.count), 1);
                    return (
                      <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:48, marginTop:6 }}>
                        {orderTrend.totalTrend.months.map((m, i) => {
                          const isRecent = i >= 3;
                          const height = Math.max((m.count / maxCount) * 40, m.count > 0 ? 4 : 0);
                          return (
                            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                              <span style={{ fontSize:10, color:'#94a3b8' }}>{m.count}</span>
                              <div style={{
                                width:'100%', height, borderRadius:'3px 3px 0 0',
                                background: isRecent
                                  ? (orderTrend.totalTrend.trend === 'down' ? '#fca5a5' : orderTrend.totalTrend.trend === 'up' ? '#86efac' : '#a5b4fc')
                                  : '#e2e8f0',
                                minHeight: m.count > 0 ? 4 : 0,
                              }} />
                              <span style={{ fontSize:9, color:'#94a3b8' }}>{m.month}月</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* 各標籤趨勢 */}
                {orderTrend.byLabel.filter((t: OrderTrendItem) => t.recentAvg > 0 || t.prevAvg > 0).map((t: OrderTrendItem) => (
                  <div key={t.label} style={{ padding:'8px 14px', borderBottom:'1px solid #f8fafc', background:'#fff', display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:14 }}>{trendEmoji[t.trend]}</span>
                    <span style={{ flex:1, fontSize:13, color:'#1e293b' }}>{t.label}</span>
                    <span style={{ fontSize:12, color:'#475569' }}>近3月均 <strong>{t.recentAvg}</strong> 單</span>
                    {t.changePercent !== null && (
                      <span style={{
                        fontSize:11, borderRadius:99, padding:'1px 7px',
                        background: t.changePercent >= 10 ? '#dcfce7' : t.changePercent <= -10 ? '#fee2e2' : '#f1f5f9',
                        color: t.changePercent >= 10 ? '#16a34a' : t.changePercent <= -10 ? '#dc2626' : '#64748b',
                        fontWeight:700,
                      }}>
                        {t.changePercent > 0 ? '+' : ''}{t.changePercent}%
                      </span>
                    )}
                  </div>
                ))}

                <div style={{ padding:'6px 14px', background:'#f8fafc', fontSize:11, color:'#94a3b8', textAlign:'right' }}>
                  同步至 {orderTrend.lastSyncedMonth}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
//  共用：員工快搜下拉
// ────────────────────────────────────────────
function EmployeeSearchPicker({
  selected, onSelect, placeholder = '輸入姓名或員工編號搜尋...', pinnedEmps, onPin
}: {
  selected: Employee | null;
  onSelect: (e: Employee | null) => void;
  placeholder?: string;
  pinnedEmps?: Employee[];
  onPin?: (e: Employee) => void;
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
          {results.map(e => {
            const isPinned = pinnedEmps?.some(p => p.app_number === e.app_number) ?? false;
            return (
              <div key={e.app_number}
                style={{ padding:'8px 12px', borderBottom:'1px solid #f8fafc', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                onMouseEnter={el => (el.currentTarget.style.background='#f8f4ff')}
                onMouseLeave={el => (el.currentTarget.style.background='#fff')}>
                <span onClick={() => { onSelect(e); setQ(''); setResults([]); }}
                  style={{ flex:1, fontWeight:600, color:'#1e293b', fontSize:13, cursor:'pointer' }}>{e.name}</span>
                <span style={{ color:'#94a3b8', fontSize:11, marginRight:8 }}>{e.store_name} · {e.app_number}</span>
                {onPin && (
                  <button onClick={ev => { ev.stopPropagation(); onPin(e); }}
                    title={isPinned ? '取消釘選' : '釘選此人員'}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color: isPinned ? '#7c3aed' : '#cbd5e1', padding:0 }}>
                    📌
                  </button>
                )}
              </div>
            );
          })}
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
