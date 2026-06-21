import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { counselingApi } from '../services/api';
import SupervisorPicker, { getActingSupervisor } from '../components/SupervisorPicker';
import EmployeeSearchPicker from '../components/EmployeeSearchPicker';

const METHOD_OPTIONS = [
  { v: 'phone', label: '電話訪談' },
  { v: 'face_to_face', label: '面談' },
  { v: 'line_text', label: 'LINE 文字' },
  { v: 'observation', label: '實地觀察' },
  { v: 'group', label: '小組對談' },
  { v: 'written', label: '書面溝通' },
];

interface StateTag {
  code: string;
  label: string;
  description?: string;
  default_duration_days?: number;
}

interface DraftItem {
  sequence: number;
  scheduled_date: string;
  method: string;
  objective: string;
  recommended_actions: any;
  estimated_minutes: number;
}

export default function NewCounselingCasePage() {
  const navigate = useNavigate();
  const supervisor = getActingSupervisor();

  // Step 1 form state
  const [stateTags, setStateTags] = useState<StateTag[]>([]);
  const [empAppNum, setEmpAppNum] = useState('');
  const [pickedTags, setPickedTags] = useState<string[]>([]);
  const [stateDesc, setStateDesc] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [methods, setMethods] = useState<string[]>(['phone', 'face_to_face']);

  // Step 2 (draft preview)
  const [step, setStep] = useState<1 | 2>(1);
  const [drafting, setDrafting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [workdayDates, setWorkdayDates] = useState<string[]>([]);

  useEffect(() => {
    counselingApi.listStateTags().then((r) => setStateTags(r.data ?? [])).catch(() => {});
  }, []);

  // 選某 tag 時自動帶 default_duration_days（只在還沒手動改過 endDate 時）
  useEffect(() => {
    if (pickedTags.length === 0) return;
    const days = Math.max(...pickedTags.map((c) => stateTags.find((t) => t.code === c)?.default_duration_days || 14));
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    setEndDate(d.toISOString().slice(0, 10));
  }, [pickedTags, startDate, stateTags]);

  const handleDraft = async () => {
    if (!supervisor) {
      toast.error('請先在上方選擇身份（輔導員）');
      return;
    }
    if (!empAppNum.trim() || pickedTags.length === 0 || !goal.trim() || methods.length === 0) {
      toast.error('請填齊員工工號、狀態、目標、可用方法');
      return;
    }
    setDrafting(true);
    try {
      const r = await counselingApi.createDraft({
        employee_app_number: empAppNum.trim(),
        supervisor_id: supervisor.id,
        state_tag_codes: pickedTags,
        state_description: stateDesc.trim() || undefined,
        goal: goal.trim(),
        start_date: startDate,
        target_end_date: endDate,
        allowed_methods: methods,
      });
      setDraftToken(r.data.draft_token);
      setDraftItems(r.data.items ?? []);
      setAiSummary(r.data.summary || '');
      setWorkdayDates(r.data.workday_dates ?? []);
      setStep(2);
      toast.success(`AI 生成 ${r.data.items?.length || 0} 個排程節點`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'AI 草稿生成失敗');
    } finally {
      setDrafting(false);
    }
  };

  const handleConfirm = async () => {
    if (!draftToken) return;
    setConfirming(true);
    try {
      const r = await counselingApi.confirmCase({
        draft_token: draftToken,
        adjusted_plan_items: draftItems,
        adjusted_summary: aiSummary,
      });
      toast.success('案件已建立');
      navigate(`/counseling-cases/${r.data.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '建立失敗');
    } finally {
      setConfirming(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setDraftItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sequence: i + 1 })));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SparklesIcon className="h-7 w-7 text-primary-600" />
            建立輔導案
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {step === 1 ? '填寫案件基本資料，AI 將自動產生排程草稿' : '檢視並調整 AI 排程，確認後寫入案件'}
          </p>
        </div>
        <SupervisorPicker />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className={`px-3 py-1 rounded-full ${step === 1 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          ① 填表
        </span>
        <span className="text-gray-400">→</span>
        <span className={`px-3 py-1 rounded-full ${step === 2 ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
          ② AI 草稿確認
        </span>
      </div>

      {step === 1 && (
        <div className="card p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">員工</label>
            <EmployeeSearchPicker
              value={empAppNum}
              onChange={(appNum) => setEmpAppNum(appNum)}
              placeholder="輸入姓名搜尋員工..."
            />
            <p className="text-xs text-gray-500 mt-1">輸入姓名（中文 / 英文 / 工號）會即時搜尋，點選後填入</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">狀態標籤（可多選）</label>
            <div className="flex flex-wrap gap-2 items-center">
              {stateTags.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() =>
                    setPickedTags((prev) => (prev.includes(t.code) ? prev.filter((x) => x !== t.code) : [...prev, t.code]))
                  }
                  className={`px-3 py-1 rounded-md text-sm border ${
                    pickedTags.includes(t.code)
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-primary-300'
                  }`}
                  title={t.description}
                >
                  {t.label}
                </button>
              ))}
              <NewStateTagButton onCreated={(t) => { setStateTags(prev => [...prev, t]); setPickedTags(prev => [...prev, t.code]); }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">狀態自由說明（選填）</label>
            <textarea
              value={stateDesc}
              onChange={(e) => setStateDesc(e.target.value)}
              rows={2}
              placeholder="例如：最近兩週請假頻率異常增加，跟主管對話時情緒明顯低落"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">輔導目標</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="例如：釐清離職原因並評估留任可能"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">預計結束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">允許的輔導方法</label>
            <div className="flex flex-wrap gap-2">
              {METHOD_OPTIONS.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => setMethods((prev) => (prev.includes(m.v) ? prev.filter((x) => x !== m.v) : [...prev, m.v]))}
                  className={`px-3 py-1 rounded-md text-sm border ${
                    methods.includes(m.v)
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-primary-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => navigate('/counseling-cases')}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleDraft}
              disabled={drafting}
              className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {drafting ? '生成中...' : (<><SparklesIcon className="h-4 w-4" /> AI 生成排程草稿</>)}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-4 bg-primary-50 border-l-4 border-primary-600">
            <p className="text-sm font-semibold text-primary-800 mb-1">AI 摘要</p>
            <textarea
              value={aiSummary}
              onChange={(e) => setAiSummary(e.target.value)}
              rows={3}
              className="w-full bg-white border border-primary-200 rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-primary-700 mt-2">
              期間內可用工作日：{workdayDates.length} 天
            </p>
          </div>

          <div className="card p-0">
            <div className="px-4 py-2 border-b text-sm font-medium text-gray-700 flex items-center justify-between">
              <span>排程節點（可調整、刪除）</span>
              <span className="text-xs text-gray-500">共 {draftItems.length} 個節點</span>
            </div>
            <ul className="divide-y divide-gray-200">
              {draftItems.map((it, idx) => (
                <li key={idx} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="text-xs font-bold text-primary-600 w-6 pt-2">#{it.sequence}</div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="date"
                          value={it.scheduled_date}
                          onChange={(e) => updateItem(idx, { scheduled_date: e.target.value })}
                          className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                        <select
                          value={it.method}
                          onChange={(e) => updateItem(idx, { method: e.target.value })}
                          className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                        >
                          {methods.map((m) => (
                            <option key={m} value={m}>
                              {METHOD_OPTIONS.find((o) => o.v === m)?.label || m}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={it.estimated_minutes}
                          onChange={(e) => updateItem(idx, { estimated_minutes: parseInt(e.target.value, 10) || 30 })}
                          className="border border-gray-300 rounded-md px-2 py-1 text-sm w-20"
                          min={5}
                          max={180}
                        />
                        <span className="text-xs text-gray-500">分鐘</span>
                        <button onClick={() => removeItem(idx)} className="ml-auto text-xs text-red-600 hover:text-red-800">
                          刪除
                        </button>
                      </div>
                      <input
                        type="text"
                        value={it.objective}
                        onChange={(e) => updateItem(idx, { objective: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                        placeholder="這次要達成什麼"
                      />
                      {it.recommended_actions && Object.keys(it.recommended_actions).length > 0 && (
                        <details className="text-xs text-gray-600">
                          <summary className="cursor-pointer">AI 建議做法</summary>
                          <pre className="mt-1 p-2 bg-gray-50 rounded whitespace-pre-wrap">
{JSON.stringify(it.recommended_actions, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              ← 回上一步
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming || draftItems.length === 0}
              className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {confirming ? '建立中...' : '確認建立案件'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewStateTagButton({ onCreated }: { onCreated: (t: any) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [duration, setDuration] = useState(14);
  const [saving, setSaving] = useState(false);

  const makeCode = () => {
    // 簡單用時間戳作為唯一 code（label 由 user 填）
    return 'custom_' + Date.now().toString(36);
  };

  const save = async () => {
    const lbl = label.trim();
    if (!lbl) {
      toast.error('請填顯示名稱');
      return;
    }
    setSaving(true);
    try {
      const code = makeCode();
      const r = await counselingApi.upsertStateTag({
        code,
        label: lbl,
        description: desc.trim() || undefined,
        default_duration_days: duration,
        severity: 'moderate',
      });
      toast.success('已新增狀態');
      onCreated(r.data);
      setOpen(false);
      setLabel(''); setDesc(''); setDuration(14);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '新增失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1 rounded-md text-sm border border-dashed border-primary-300 text-primary-700 hover:bg-primary-50"
      >
        + 新增自訂狀態
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">新增自訂狀態標籤</h3>
              <p className="text-xs text-gray-500 mt-1">新增後可供本案與未來案件使用</p>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div>
                <label className="block text-xs text-gray-600 mb-1">顯示名稱 *</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="例如：家庭因素 / 家人重病"
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">說明</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={2}
                  placeholder="什麼狀況會歸到這類"
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">建議輔導期（天）</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10) || 14)}
                  min={1}
                  className="w-32 border border-gray-300 rounded-md px-2 py-1.5"
                />
              </div>
            </div>
            <div className="p-3 border-t flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm">
                取消
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-1.5 bg-primary-600 text-white rounded-md text-sm disabled:opacity-50"
              >
                {saving ? '新增中...' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
