import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { conversationsApi, employeesApi } from '../services/api';
import { useAuthStore } from '../stores';
import toast from 'react-hot-toast';
import FileUpload from '../components/FileUpload';

export default function NewConversationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedEmployeeId = searchParams.get('employee_id');
  const currentUser = useAuthStore((state) => state.user);

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchingEmployees, setSearchingEmployees] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState({
    employee_id: preselectedEmployeeId || '',
    conversation_date: new Date().toISOString().slice(0, 16),
    conversation_type: '一對一面談',
    interviewer_name: currentUser?.name || '',
    background_note: '',
    raw_text: '',
    priority: 'normal',
    need_followup: false,
  });

  const [conversationAttachments, setConversationAttachments] = useState<any[]>([]);

  // ── 智慧匯入（音檔轉錄 / 逐字稿清理）相關 state ──
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<string>('');
  const [suggestions, setSuggestions] = useState<any | null>(null);
  const [rawTranscript, setRawTranscript] = useState<string>('');
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (preselectedEmployeeId) {
      loadEmployee(preselectedEmployeeId);
    }
  }, [preselectedEmployeeId]);

  // 等登入者資料載入後自動填入訪談者（若尚未自行修改過）
  useEffect(() => {
    if (currentUser?.name) {
      setFormData((prev) =>
        prev.interviewer_name ? prev : { ...prev, interviewer_name: currentUser.name! }
      );
    }
  }, [currentUser?.name]);

  const loadEmployee = async (id: string) => {
    try {
      const response = await employeesApi.getById(id);
      setEmployees([response.data]);
    } catch (error) {
      console.error('Failed to load employee');
    }
  };

  // 員工搜尋：一個字即可觸發，250ms debounce 避免每打字都送請求
  const searchEmployees = (query: string) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    if (!query || query.length < 1) {
      setEmployees([]);
      setSearchingEmployees(false);
      return;
    }
    setSearchingEmployees(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const response = await employeesApi.search({ q: query, limit: 10 });
        setEmployees(response.data.data);
      } catch (error) {
        console.error('Failed to search employees');
        setEmployees([]);
      } finally {
        setSearchingEmployees(false);
      }
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // ── 智慧匯入：上傳音檔或逐字稿 ──
  const handleTranscribeUpload = async (file: File) => {
    // 客戶端防呆：超過上限直接擋下並提示，避免送出後才失敗讓使用者誤以為系統故障
    const MAX_UPLOAD_MB = 25; // 對齊後端 MAX_FILE_SIZE 與 Whisper 25MB 上限
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(
        `檔案 ${(file.size / 1024 / 1024).toFixed(1)}MB 超過上限 ${MAX_UPLOAD_MB}MB，無法上傳。請壓縮或分段後再試。`
      );
      if (audioInputRef.current) audioInputRef.current.value = '';
      return;
    }
    setSuggestions(null);
    setRawTranscript('');
    setTranscribing(true);
    setTranscribeProgress(
      file.type.startsWith('audio/') || /\.(mp3|m4a|wav|webm|ogg|flac)$/i.test(file.name)
        ? '正在使用 Whisper 轉錄音檔（可能需要 1–3 分鐘）…'
        : '正在分析逐字稿…'
    );
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (currentUser?.name) fd.append('hint_interviewer_name', currentUser.name);
      if (formData.employee_id) fd.append('hint_employee_id', formData.employee_id);
      fd.append('language', 'zh');

      const res = await conversationsApi.transcribe(fd);
      setRawTranscript(res.data.raw_transcript || '');
      setSuggestions(res.data.suggestions || null);
      toast.success('智慧匯入完成，請檢視 AI 建議並選擇套用');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '上傳失敗';
      toast.error(msg);
    } finally {
      setTranscribing(false);
      setTranscribeProgress('');
      // 清空 input 讓使用者可以重新選同一個檔案
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  // ── 套用 AI 建議到表單 ──
  const applySuggestion = (
    target: 'employee' | 'interviewer' | 'background' | 'text' | 'all',
  ) => {
    if (!suggestions) return;
    const updates: any = {};
    if (target === 'employee' || target === 'all') {
      if (suggestions.employee_match?.employee_id) {
        updates.employee_id = suggestions.employee_match.employee_id;
        const empName = suggestions.employee_match.employee_name;
        const appNum = suggestions.employee_match.employeeappnumber;
        if (empName && appNum) setEmployeeSearch(`${empName} (${appNum})`);
        setEmployees([]);
      }
    }
    if (target === 'interviewer' || target === 'all') {
      if (suggestions.interviewer_name) {
        updates.interviewer_name = suggestions.interviewer_name;
      }
    }
    if (target === 'background' || target === 'all') {
      if (suggestions.background_note) {
        updates.background_note = suggestions.background_note;
      }
    }
    if (target === 'text' || target === 'all') {
      if (suggestions.cleaned_text) {
        updates.raw_text = suggestions.cleaned_text;
      }
    }
    setFormData((prev) => ({ ...prev, ...updates }));
    toast.success(target === 'all' ? '已套用所有建議' : '已套用建議');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employee_id) {
      toast.error('請選擇員工');
      return;
    }
    if (!formData.raw_text.trim()) {
      toast.error('請輸入對話內容');
      return;
    }

    try {
      setLoading(true);
      const response = await conversationsApi.create({
        ...formData,
        conversation_date: new Date(formData.conversation_date).toISOString(),
        attachments: conversationAttachments,
      });
      toast.success('對話記錄已建立！');
      navigate(`/conversations/${response.data.id}`);
    } catch (error) {
      toast.error('建立失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">新增對話記錄</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 智慧匯入區塊：上傳音檔/逐字稿，AI 自動轉錄 + 清理 + 識別員工/主管/背景 */}
        <div className="card p-6 space-y-4 border-2 border-dashed border-blue-300 bg-blue-50/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-800">⚡ 智慧匯入（選用）</h2>
              <p className="text-sm text-gray-600 mt-1">
                上傳會議錄音（mp3/m4a/wav）或逐字稿（txt），系統會自動轉文字、清理、修錯字、
                標註發言者，並幫你預填員工、訪談者、背景說明。建議都會經過你的確認才會生效。
              </p>
            </div>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg,.flac,.txt,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleTranscribeUpload(f);
              }}
              className="hidden"
              disabled={transcribing}
            />
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              disabled={transcribing}
              className="btn-primary whitespace-nowrap"
            >
              {transcribing ? '處理中…' : '選擇檔案'}
            </button>
          </div>

          {transcribing && (
            <div className="bg-white border rounded-md p-3 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                {transcribeProgress}
              </div>
            </div>
          )}

          {suggestions && (
            <div className="bg-white border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800">AI 建議（信心 {Math.round((suggestions.confidence_score || 0) * 100)}%）</span>
                <button
                  type="button"
                  onClick={() => applySuggestion('all')}
                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  全部套用
                </button>
              </div>

              {/* 員工建議 */}
              {suggestions.employee_match && (
                <div className="flex items-start justify-between gap-3 border-t pt-3">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">員工</div>
                    <div className="text-sm">
                      AI 辨識：<span className="font-medium">{suggestions.employee_match.detected_name}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        suggestions.employee_match.confidence === 'high' ? 'bg-green-100 text-green-700' :
                        suggestions.employee_match.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>信心：{suggestions.employee_match.confidence}</span>
                    </div>
                    {suggestions.employee_match.employee_id ? (
                      <div className="text-xs text-gray-600 mt-1">
                        ✓ 已對應到員工：{suggestions.employee_match.employee_name} ({suggestions.employee_match.employeeappnumber})
                      </div>
                    ) : (
                      <div className="text-xs text-orange-600 mt-1">
                        ⚠️ {suggestions.employee_match.note || '未能對應到資料庫，請手動選擇'}
                      </div>
                    )}
                  </div>
                  {suggestions.employee_match.employee_id && (
                    <button type="button" onClick={() => applySuggestion('employee')} className="text-sm px-3 py-1 border border-blue-600 text-blue-600 rounded hover:bg-blue-50">套用</button>
                  )}
                </div>
              )}

              {/* 訪談者建議 */}
              {suggestions.interviewer_name && (
                <div className="flex items-start justify-between gap-3 border-t pt-3">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">訪談者（主管）</div>
                    <div className="text-sm">AI 辨識：<span className="font-medium">{suggestions.interviewer_name}</span></div>
                  </div>
                  <button type="button" onClick={() => applySuggestion('interviewer')} className="text-sm px-3 py-1 border border-blue-600 text-blue-600 rounded hover:bg-blue-50">套用</button>
                </div>
              )}

              {/* 背景說明建議 */}
              {suggestions.background_note && (
                <div className="flex items-start justify-between gap-3 border-t pt-3">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">背景說明</div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{suggestions.background_note}</div>
                  </div>
                  <button type="button" onClick={() => applySuggestion('background')} className="text-sm px-3 py-1 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 whitespace-nowrap">套用</button>
                </div>
              )}

              {/* 清理後對話內容 */}
              {suggestions.cleaned_text && (
                <div className="flex items-start justify-between gap-3 border-t pt-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500">清理後對話內容（{suggestions.cleaned_text.length} 字）</div>
                    <div className="text-sm text-gray-700 mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap border rounded p-2 bg-gray-50">
                      {suggestions.cleaned_text.substring(0, 500)}{suggestions.cleaned_text.length > 500 ? '…' : ''}
                    </div>
                  </div>
                  <button type="button" onClick={() => applySuggestion('text')} className="text-sm px-3 py-1 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 whitespace-nowrap">套用</button>
                </div>
              )}

              {/* 風險訊號 */}
              {Array.isArray(suggestions.preliminary_risk_signals) && suggestions.preliminary_risk_signals.length > 0 && (
                <div className="border-t pt-3">
                  <div className="text-xs text-gray-500">🚨 AI 初判風險訊號（僅供參考，請依正式分析為準）</div>
                  <ul className="text-sm text-orange-700 mt-1 list-disc list-inside space-y-1">
                    {suggestions.preliminary_risk_signals.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 辨識錯字候選 */}
              {Array.isArray(suggestions.potential_transcription_errors) && suggestions.potential_transcription_errors.length > 0 && (
                <div className="border-t pt-3">
                  <div className="text-xs text-gray-500">📝 AI 修正的辨識錯字（請複核）</div>
                  <ul className="text-xs text-gray-600 mt-1 space-y-1">
                    {suggestions.potential_transcription_errors.map((e: any, i: number) => (
                      <li key={i}>
                        <span className="line-through text-red-500">{e.suspicious_text}</span>
                        {' → '}
                        <span className="text-green-700 font-medium">{e.likely_correct}</span>
                        <span className="text-gray-400 ml-1">（{e.reason}）</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 原始稿（可展開） */}
              {rawTranscript && (
                <details className="border-t pt-3">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">展開原始轉錄稿（含時間戳，{rawTranscript.length} 字）</summary>
                  <pre className="text-xs text-gray-600 mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap border rounded p-2 bg-gray-50">{rawTranscript}</pre>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="card p-6 space-y-4">
          {/* 員工選擇 */}
          <div>
            <label className="label">員工 *</label>
            <input
              type="text"
              placeholder="搜尋員工姓名或編號（輸入一個字即可）..."
              value={employeeSearch}
              onChange={(e) => {
                setEmployeeSearch(e.target.value);
                if (formData.employee_id) {
                  setFormData({ ...formData, employee_id: '' });
                }
                searchEmployees(e.target.value);
              }}
              className="input"
            />
            {searchingEmployees && (
              <p className="text-sm text-gray-500 mt-1">搜尋中…</p>
            )}
            {employees.length > 0 && (
              <ul className="mt-2 border rounded-md divide-y max-h-60 overflow-y-auto">
                {employees.map((emp) => (
                  <li
                    key={emp.id}
                    onClick={() => {
                      setFormData({ ...formData, employee_id: emp.id });
                      setEmployeeSearch(`${emp.name} (${emp.employeeappnumber})`);
                      setEmployees([]);
                    }}
                    className="p-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <span className="font-medium">{emp.name}</span>
                    <span className="text-gray-500 ml-2">{emp.employeeappnumber}</span>
                    {emp.store_name && (
                      <span className="text-gray-400 ml-2 text-sm">{emp.store_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!searchingEmployees && employeeSearch && employees.length === 0 && !formData.employee_id && (
              <p className="text-sm text-gray-500 mt-1">找不到符合的員工</p>
            )}
            {formData.employee_id && (
              <p className="text-sm text-green-600 mt-1">✓ 已選擇員工</p>
            )}
          </div>

          {/* 對話日期 */}
          <div>
            <label className="label">對話日期時間</label>
            <input
              type="datetime-local"
              value={formData.conversation_date}
              onChange={(e) => setFormData({ ...formData, conversation_date: e.target.value })}
              className="input"
            />
          </div>

          {/* 對話類型 */}
          <div>
            <label className="label">對話類型</label>
            <select
              value={formData.conversation_type}
              onChange={(e) => setFormData({ ...formData, conversation_type: e.target.value })}
              className="input"
            >
              <option value="一對一面談">一對一面談</option>
              <option value="電話訪談">電話訪談</option>
              <option value="訊息對話">訊息對話</option>
              <option value="會議記錄">會議記錄</option>
              <option value="其他">其他</option>
            </select>
          </div>

          {/* 訪談者 */}
          <div>
            <label className="label">訪談者姓名</label>
            <input
              type="text"
              value={formData.interviewer_name}
              onChange={(e) => setFormData({ ...formData, interviewer_name: e.target.value })}
              placeholder="例如：王經理"
              className="input"
            />
          </div>

          {/* 背景說明 */}
          <div>
            <label className="label">背景說明</label>
            <textarea
              value={formData.background_note}
              onChange={(e) => setFormData({ ...formData, background_note: e.target.value })}
              placeholder="訪談的背景或目的..."
              rows={2}
              className="input"
            />
          </div>

          {/* 對話內容 */}
          <div>
            <label className="label">對話內容 *</label>
            <textarea
              value={formData.raw_text}
              onChange={(e) => setFormData({ ...formData, raw_text: e.target.value })}
              placeholder="請輸入或貼上對話內容..."
              rows={10}
              className="input"
              required
            />
          </div>

          {/* 附件上傳 */}
          <FileUpload
            category="conversations"
            label="附件（對話截圖、錄音等）"
            onUploadComplete={(files) => setConversationAttachments(files)}
          />

          {/* 優先級 */}
          <div className="flex gap-6">
            <div>
              <label className="label">優先級</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="input"
              >
                <option value="low">低</option>
                <option value="normal">一般</option>
                <option value="high">高</option>
                <option value="urgent">緊急</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="need_followup"
                checked={formData.need_followup}
                onChange={(e) => setFormData({ ...formData, need_followup: e.target.checked })}
                className="h-4 w-4 text-primary-600 rounded"
              />
              <label htmlFor="need_followup" className="ml-2 text-sm text-gray-700">
                需要追蹤
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? '建立中...' : '建立對話記錄'}
          </button>
        </div>
      </form>
    </div>
  );
}
