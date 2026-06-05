import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, ChatBubbleLeftRightIcon, CalendarIcon, ClipboardDocumentListIcon, PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { counselingApi } from '../services/api';
import SupervisorPicker, { getActingSupervisor } from '../components/SupervisorPicker';

const METHOD_LABEL: Record<string, string> = {
  phone: '電話', face_to_face: '面談', line_text: 'LINE 文字',
  observation: '實地觀察', group: '小組', written: '書面',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  done: 'bg-green-100 text-green-700',
  skipped: 'bg-gray-100 text-gray-400 line-through',
  rescheduled: 'bg-yellow-100 text-yellow-700',
};

export default function CounselingCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'timeline' | 'executions' | 'ai'>('timeline');
  const [supervisor, setSupervisor] = useState(getActingSupervisor());

  useEffect(() => {
    const onChange = () => setSupervisor(getActingSupervisor());
    window.addEventListener('counseling.supervisor-changed', onChange);
    return () => window.removeEventListener('counseling.supervisor-changed', onChange);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await counselingApi.getCase(id);
      setCaseData(r.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading && !caseData) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
      </div>
    );
  }
  if (!caseData) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/counseling-cases" className="text-gray-500 hover:text-gray-700">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {caseData.employee_name} · {caseData.goal}
        </h1>
        <div className="ml-auto"><SupervisorPicker /></div>
      </div>

      {/* 概要卡 */}
      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-500">員工</p>
          <p className="font-medium">{caseData.employee_name}（{caseData.employee_app_number}）</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">輔導員</p>
          <p className="font-medium">{caseData.supervisor_name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">期間</p>
          <p className="font-medium">{caseData.start_date} ~ {caseData.target_end_date}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">狀態</p>
          <p className="font-medium">{caseData.status}</p>
        </div>
        <div className="col-span-2 md:col-span-4">
          <p className="text-xs text-gray-500">狀態標籤</p>
          <div className="flex gap-1 mt-1 flex-wrap">
            {caseData.state_tag_codes?.map((c: string) => (
              <span key={c} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded">{c}</span>
            ))}
          </div>
        </div>
        {caseData.ai_plan_summary && (
          <div className="col-span-2 md:col-span-4">
            <p className="text-xs text-gray-500">AI 計畫摘要</p>
            <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{caseData.ai_plan_summary}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <TabBtn active={tab === 'timeline'} onClick={() => setTab('timeline')} icon={<CalendarIcon className="h-4 w-4" />}>
          時間軸（{caseData.plan_items?.length || 0}）
        </TabBtn>
        <TabBtn active={tab === 'executions'} onClick={() => setTab('executions')} icon={<ClipboardDocumentListIcon className="h-4 w-4" />}>
          執行紀錄（{caseData.executions?.length || 0}）
        </TabBtn>
        <TabBtn active={tab === 'ai'} onClick={() => setTab('ai')} icon={<ChatBubbleLeftRightIcon className="h-4 w-4" />}>
          AI 討論
        </TabBtn>
      </div>

      {tab === 'timeline' && (
        <TimelineTab caseData={caseData} reload={load} supervisor={supervisor} />
      )}
      {tab === 'executions' && (
        <ExecutionsTab caseData={caseData} />
      )}
      {tab === 'ai' && (
        <AiTab caseId={caseData.id} supervisor={supervisor} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 inline-flex items-center gap-1 ${
        active ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────
//  Timeline tab
// ─────────────────────────────────────────
function TimelineTab({ caseData, reload, supervisor }: { caseData: any; reload: () => void; supervisor: any }) {
  const [execModal, setExecModal] = useState<any | null>(null);

  return (
    <div className="card p-0">
      {(caseData.plan_items || []).length === 0 ? (
        <div className="p-8 text-center text-gray-500">無排程節點</div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {caseData.plan_items.map((it: any) => (
            <li key={it.id} className="p-3 flex items-start gap-3">
              <div className="text-center w-20 flex-shrink-0">
                <p className="text-xs text-gray-500">#{it.sequence}</p>
                <p className="text-sm font-semibold">{it.scheduled_date}</p>
                <span className={`inline-block text-xs px-2 py-0.5 rounded mt-1 ${STATUS_BADGE[it.status] || ''}`}>
                  {it.status}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium text-primary-700">[{METHOD_LABEL[it.method] || it.method}]</span> {it.objective}
                </p>
                {it.recommended_actions && Object.keys(it.recommended_actions).length > 0 && (
                  <details className="text-xs text-gray-600 mt-1">
                    <summary className="cursor-pointer">查看 AI 建議</summary>
                    <pre className="mt-1 p-2 bg-gray-50 rounded whitespace-pre-wrap text-xs">
{JSON.stringify(it.recommended_actions, null, 2)}
                    </pre>
                  </details>
                )}
                {it.original_scheduled_date && (
                  <p className="text-xs text-gray-400 mt-1">原排於 {it.original_scheduled_date}</p>
                )}
              </div>
              <div className="flex-shrink-0">
                {it.status === 'pending' && (
                  <button
                    onClick={() => setExecModal(it)}
                    className="text-xs px-3 py-1 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                  >
                    填執行紀錄
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {execModal && (
        <ExecutionModal
          caseId={caseData.id}
          planItem={execModal}
          supervisor={supervisor}
          onClose={() => setExecModal(null)}
          onSaved={() => { setExecModal(null); reload(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────
//  Executions tab
// ─────────────────────────────────────────
function ExecutionsTab({ caseData }: { caseData: any }) {
  if ((caseData.executions || []).length === 0) {
    return <div className="card p-8 text-center text-gray-500">尚無執行紀錄</div>;
  }
  return (
    <div className="card p-0">
      <ul className="divide-y divide-gray-200">
        {caseData.executions.map((e: any) => (
          <li key={e.id} className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-800">
                {new Date(e.executed_at).toLocaleString('zh-TW')} · {METHOD_LABEL[e.actual_method] || e.actual_method}
              </span>
              <span className="text-xs text-gray-500">
                {e.recorded_by_name} {e.mood_score ? `· 情緒 ${e.mood_score}/5` : ''}
              </span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{e.what_happened}</p>
            {e.employee_reaction && (
              <p className="text-xs text-gray-500 mt-1">員工反應：{e.employee_reaction}</p>
            )}
            {e.next_action_hint && (
              <p className="text-xs text-gray-500 mt-1">下一步想法：{e.next_action_hint}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────
//  AI tab
// ─────────────────────────────────────────
function AiTab({ caseId, supervisor }: { caseId: string; supervisor: any }) {
  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supervisor) return;
    setLoading(true);
    counselingApi
      .openAiSession(caseId, supervisor.identifier)
      .then(async (r) => {
        setSession(r.data);
        const msgs = await counselingApi.listAiMessages(r.data.id, supervisor.identifier);
        setMessages(msgs.data ?? []);
      })
      .catch((e: any) => toast.error(e?.response?.data?.message || '開啟 AI 對話失敗'))
      .finally(() => setLoading(false));
  }, [caseId, supervisor]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !session || !supervisor) return;
    setSending(true);
    const localUserMsg = { id: 'tmp', role: 'user', content: input.trim(), created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, localUserMsg]);
    const content = input.trim();
    setInput('');
    try {
      const r = await counselingApi.sendAiMessage(session.id, supervisor.identifier, content);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== 'tmp'),
        r.data.user_message,
        r.data.assistant_message,
      ]);
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== 'tmp'));
      toast.error(e?.response?.data?.message || 'AI 回應失敗');
    } finally {
      setSending(false);
    }
  };

  if (!supervisor) {
    return <div className="card p-8 text-center text-gray-500">請先在右上選擇身份（輔導員）</div>;
  }
  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="card p-0 flex flex-col" style={{ height: '70vh' }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">
            開始跟 AI 討論這個案件吧。AI 會自動帶入案件目標、近期執行紀錄、員工 insight。
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xl px-3 py-2 rounded-lg whitespace-pre-wrap text-sm ${
                  m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {sending && <div className="text-xs text-gray-500 text-center">AI 思考中...</div>}
        <div ref={endRef} />
      </div>
      <div className="border-t p-3 flex items-end gap-2">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="輸入訊息... （Ctrl/⌘+Enter 送出）"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
          disabled={sending}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="px-3 py-2 bg-primary-600 text-white rounded-md disabled:opacity-50"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  Execution modal
// ─────────────────────────────────────────
function ExecutionModal({ caseId, planItem, supervisor, onClose, onSaved }: any) {
  const [actualMethod, setActualMethod] = useState(planItem.method);
  const [duration, setDuration] = useState<number | ''>(planItem.estimated_minutes || 30);
  const [what, setWhat] = useState('');
  const [reaction, setReaction] = useState('');
  const [nextHint, setNextHint] = useState('');
  const [mood, setMood] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!supervisor) {
      toast.error('請先選擇身份');
      return;
    }
    if (!what.trim()) {
      toast.error('經過描述必填');
      return;
    }
    setSaving(true);
    try {
      await counselingApi.createExecution(caseId, {
        plan_item_id: planItem.id,
        actual_method: actualMethod,
        duration_minutes: duration || undefined,
        what_happened: what.trim(),
        employee_reaction: reaction.trim() || undefined,
        next_action_hint: nextHint.trim() || undefined,
        mood_score: mood || undefined,
        recorded_by: supervisor.id,
        recorded_by_name: supervisor.name,
      });
      toast.success('執行紀錄已存');
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900">填寫執行紀錄</h3>
          <p className="text-xs text-gray-500 mt-1">{planItem.scheduled_date} · {planItem.objective}</p>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">實際方法</label>
              <select
                value={actualMethod}
                onChange={(e) => setActualMethod(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5"
              >
                {Object.entries(METHOD_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">耗時（分鐘）</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value, 10) : '')}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">經過 *</label>
            <textarea
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">員工反應</label>
            <textarea
              value={reaction}
              onChange={(e) => setReaction(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">下一步想法</label>
            <textarea
              value={nextHint}
              onChange={(e) => setNextHint(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">員工當下情緒 (1-5)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMood(mood === n ? '' : n)}
                  className={`w-8 h-8 rounded-md border text-sm ${
                    mood === n ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 bg-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm">取消</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 bg-primary-600 text-white rounded-md text-sm disabled:opacity-50"
          >
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
