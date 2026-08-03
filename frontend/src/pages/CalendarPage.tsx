import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { calendarApi } from '../services/api';
import { useAuthStore } from '../stores';
import EmployeeSearchPicker from '../components/EmployeeSearchPicker';

/**
 * 行事曆 — 週檢視（已串接後端 API）
 *
 * 對應需求：三 週檢視、四/五 新增、六 排休檢查、七 標籤、十 時長、
 *          十一 衝突檢查、十三 詳情、十五 取消。
 * 資料來源：/calendar/*（排程 CRUD、小分類、排休檢查走既有 HRM 出勤 API）。
 */

// ── 可調參數（需與後端 WORK_START/END 一致）──
const WORK_START_HOUR = 11;
const WORK_END_HOUR = 21;
const HOUR_PX = 56;
const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日'];

// ── 大分類顏色 / 標籤（純前端顯示；key 與後端一致）──
interface CatStyle { name: string; block: string; dot: string; chip: string; urgent?: boolean }
const CAT: Record<string, CatStyle> = {
  routine:  { name: '例行性關懷', block: 'bg-blue-100 border-blue-300 text-blue-900',        dot: 'bg-blue-500',    chip: 'border-blue-300 bg-blue-50 text-blue-700' },
  announce: { name: '流程佈達',   block: 'bg-emerald-100 border-emerald-300 text-emerald-900', dot: 'bg-emerald-500', chip: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  project:  { name: '專案焦點',   block: 'bg-violet-100 border-violet-300 text-violet-900',    dot: 'bg-violet-500',  chip: 'border-violet-300 bg-violet-50 text-violet-700' },
  newcomer: { name: '新人輔導',   block: 'bg-amber-100 border-amber-300 text-amber-900',       dot: 'bg-amber-500',   chip: 'border-amber-300 bg-amber-50 text-amber-700' },
  urgent:   { name: '緊急案件',   block: 'bg-red-500 border-red-700 text-white ring-2 ring-red-400', dot: 'bg-red-600', chip: 'border-red-300 bg-red-50 text-red-700', urgent: true },
};
const CAT_ORDER = ['routine', 'announce', 'project', 'newcomer', 'urgent'];
const catOf = (key: string): CatStyle => CAT[key] || CAT.routine;

const DURATION_OPTIONS = [
  { value: 5, label: '5 分鐘' },
  { value: 10, label: '10 分鐘' },
  { value: 15, label: '15 分鐘' },
  { value: 30, label: '30 分鐘' },
  { value: 60, label: '1 小時' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: '待進行', completed: '已完成', cancelled: '已取消', no_show: '未執行', follow_up: '需後續追蹤',
};
// 可手動切換的狀態（取消另走取消流程）
const STATUS_FLOW = ['pending', 'completed', 'no_show', 'follow_up'];

// ── 後端排程資料型別 ──
interface Schedule {
  id: string;
  schedule_date: string;
  start_time: string;      // HH:mm:ss
  end_time: string;        // HH:mm:ss
  duration_minutes: number;
  employee_id?: string;
  employee_name: string;
  employee_app_number: string;
  store_name?: string;
  category_key: string;
  subcategory_name: string;
  note: string;
  status: string;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
  cancel_reason?: string;
}

// 日期工具 ---------------------------------------------------
const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const startOfWeek = (d: Date) => {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const minToHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const hm = (t?: string) => (t ? t.slice(0, 5) : '');

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Schedule | null>(null);
  const [form, setForm] = useState<{ open: boolean; mode: 'create' | 'edit'; initial?: Schedule; prefill?: { date?: string; start?: string } }>({ open: false, mode: 'create' });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = useMemo(
    () => Array.from({ length: WORK_END_HOUR - WORK_START_HOUR + 1 }, (_, i) => WORK_START_HOUR + i),
    [],
  );
  const rangeLabel = `${weekStart.getFullYear()}年${weekStart.getMonth() + 1}月${weekStart.getDate()}日 － ${addDays(weekStart, 6).getMonth() + 1}月${addDays(weekStart, 6).getDate()}日`;
  const todayStr = fmt(new Date());

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await calendarApi.listSchedules({
        start_date: fmt(weekStart),
        end_date: fmt(addDays(weekStart, 6)),
      });
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      setSchedules(list);
    } catch (e: any) {
      toast.error(e.response?.data?.message || '載入排程失敗');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  const gotoWeek = (delta: number) => setWeekStart((w) => addDays(w, delta * 7));
  const gotoThisWeek = () => setWeekStart(startOfWeek(new Date()));

  const openNewAt = (date: string, hour: number) => {
    setForm({ open: true, mode: 'create', prefill: { date, start: `${String(hour).padStart(2, '0')}:00` } });
  };

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">行事曆</h1>
        {loading && <span className="text-xs text-gray-400">載入中…</span>}
      </div>

      {/* 週切換列 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => gotoWeek(-1)} className="rounded-md border border-gray-300 p-2 hover:bg-gray-50" title="上一週">
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button onClick={gotoThisWeek} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">本週</button>
          <button onClick={() => gotoWeek(1)} className="rounded-md border border-gray-300 p-2 hover:bg-gray-50" title="下一週">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <span className="ml-3 text-sm font-semibold text-gray-700">{rangeLabel}</span>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {CAT_ORDER.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 text-xs text-gray-600">
              <span className={clsx('h-2.5 w-2.5 rounded-full', CAT[k].dot)} />{CAT[k].name}
            </span>
          ))}
        </div>
      </div>

      {/* 行事曆網格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-gray-200">
            <div className="bg-gray-50" />
            {days.map((d, i) => {
              const isToday = fmt(d) === todayStr;
              return (
                <div key={i} className={clsx('border-l border-gray-200 py-2 text-center', isToday && 'bg-primary-50')}>
                  <div className="text-xs text-gray-500">星期{WEEK_DAYS[i]}</div>
                  <div className={clsx('text-sm font-semibold', isToday ? 'text-primary-600' : 'text-gray-900')}>
                    {d.getMonth() + 1}月{d.getDate()}日
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-[64px_repeat(7,1fr)]">
            <div className="relative" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h, i) => (
                <div key={h} className="absolute left-0 right-0 -translate-y-1/2 pr-2 text-right text-xs text-gray-400" style={{ top: i * HOUR_PX }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {days.map((d, di) => {
              const dateStr = fmt(d);
              const daySchedules = schedules.filter((s) => s.schedule_date === dateStr);
              return (
                <div key={di} className="relative border-l border-gray-200" style={{ height: hours.length * HOUR_PX }}>
                  {hours.slice(0, -1).map((h, i) => (
                    <button key={h} onClick={() => openNewAt(dateStr, h)}
                            className="absolute left-0 right-0 border-b border-gray-100 hover:bg-primary-50/40"
                            style={{ top: i * HOUR_PX, height: HOUR_PX }}
                            title={`新增 ${String(h).padStart(2, '0')}:00 排程`} />
                  ))}
                  {daySchedules.map((s) => {
                    const startMin = toMin(hm(s.start_time));
                    const top = ((startMin - WORK_START_HOUR * 60) / 60) * HOUR_PX;
                    const height = Math.max((s.duration_minutes / 60) * HOUR_PX, 22);
                    const cat = catOf(s.category_key);
                    return (
                      <button key={s.id} onClick={() => setDetail(s)}
                              className={clsx('absolute left-1 right-1 overflow-hidden rounded border px-1.5 py-1 text-left text-xs shadow-sm', cat.block)}
                              style={{ top, height }}>
                        <div className="flex items-center gap-1 font-semibold">
                          {cat.urgent && <ExclamationTriangleIcon className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{s.employee_name}</span>
                          <span className="ml-auto shrink-0 rounded bg-black/10 px-1 text-[10px] font-medium leading-4">
                            {STATUS_LABEL[s.status] || s.status}
                          </span>
                        </div>
                        <div className="truncate opacity-90">{cat.name}｜{s.subcategory_name}</div>
                        <div className="opacity-80">{hm(s.start_time)}－{hm(s.end_time)}</div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button onClick={() => setForm({ open: true, mode: 'create', prefill: {} })}
              className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-primary-700">
        <PlusIcon className="h-5 w-5" />新增
      </button>

      {form.open && (
        <ScheduleFormModal
          mode={form.mode}
          initial={form.initial}
          prefill={form.prefill}
          onClose={() => setForm((f) => ({ ...f, open: false }))}
          onSaved={() => { setForm((f) => ({ ...f, open: false })); fetchWeek(); }}
        />
      )}
      {detail && (
        <DetailModal
          schedule={detail}
          onClose={() => setDetail(null)}
          onEdit={(s) => { setDetail(null); setForm({ open: true, mode: 'edit', initial: s }); }}
          onChanged={() => { setDetail(null); fetchWeek(); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  排程表單 Modal（新增 / 編輯共用）
// ═══════════════════════════════════════════
function ScheduleFormModal({ mode, initial, prefill, onClose, onSaved }: {
  mode: 'create' | 'edit';
  initial?: Schedule;
  prefill?: { date?: string; start?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const isEdit = mode === 'edit' && !!initial;
  const [date, setDate] = useState(initial?.schedule_date || prefill?.date || '');
  const [appNumber, setAppNumber] = useState(initial?.employee_app_number || '');
  const [category, setCategory] = useState(initial?.category_key || '');
  const [subName, setSubName] = useState(initial?.subcategory_name || '');
  const [subId, setSubId] = useState<string | undefined>(undefined);
  const [note, setNote] = useState(initial?.note || '');
  const [start, setStart] = useState(initial ? hm(initial.start_time) : (prefill?.start || ''));
  const [duration, setDuration] = useState(initial?.duration_minutes || 30);
  const [submitting, setSubmitting] = useState(false);

  // 是否需重新排休/衝突檢查：新增一定要；編輯只在改了日期/人員/時間時
  const recheckNeeded = !isEdit || !initial ||
    date !== initial.schedule_date ||
    appNumber !== initial.employee_app_number ||
    start !== hm(initial.start_time) ||
    duration !== initial.duration_minutes;

  // 排休檢查
  const [att, setAtt] = useState<{ status: 'idle' | 'loading' | 'work' | 'off' | 'unknown'; message: string }>({ status: 'idle', message: '' });
  useEffect(() => {
    if (!date || !appNumber) { setAtt({ status: 'idle', message: '' }); return; }
    let cancelled = false;
    setAtt({ status: 'loading', message: '確認排班中…' });
    calendarApi.checkAttendance(appNumber, date)
      .then((r) => { if (!cancelled) setAtt({ status: r.data.status, message: r.data.message }); })
      .catch(() => { if (!cancelled) setAtt({ status: 'unknown', message: '目前無法確認該人員的出勤狀態，請稍後再試或確認排班資料。' }); });
    return () => { cancelled = true; };
  }, [date, appNumber]);

  const endStr = start ? minToHHMM(toMin(start) + duration) : '';
  // 起始時間到 20:55 為止（至少留 5 分鐘、不超過 21:00）
  const startOptions = useMemo(() => {
    const arr: string[] = [];
    for (let m = WORK_START_HOUR * 60; m <= WORK_END_HOUR * 60 - 5; m += 5) arr.push(minToHHMM(m));
    return arr;
  }, []);
  const todayStr = fmt(new Date());

  // 需重新檢查時，排休須為「上班」才能存；未改動時不受排休狀態影響
  const attOk = !recheckNeeded || att.status === 'work';
  const canSave = Boolean(date && appNumber && attOk && category && subName && note.trim() && start && !submitting);

  const save = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      if (isEdit && initial) {
        await calendarApi.updateSchedule(initial.id, {
          schedule_date: date,
          start_time: start,
          duration_minutes: duration,
          employee_app_number: appNumber,
          category_key: category,
          subcategory_name: subName,
          subcategory_id: subId,
          note: note.trim(),
          updated_by: user?.name || user?.email,
        });
        toast.success('排程已更新。');
      } else {
        await calendarApi.createSchedule({
          schedule_date: date,
          start_time: start,
          duration_minutes: duration,
          employee_app_number: appNumber,
          category_key: category,
          subcategory_name: subName,
          subcategory_id: subId,
          note: note.trim(),
          created_by: user?.name || user?.email,
          created_by_id: user?.id,
        });
        toast.success('排程建立成功。');
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || (isEdit ? '更新失敗，請稍後再試。' : '排程建立失敗，請稍後再試。'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h2 className="text-lg font-semibold text-gray-900">{isEdit ? '編輯排程' : '新增排程'}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="h-5 w-5" /></button>
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
        <Field label="排程日期" required>
          <input type="date" value={date} min={todayStr} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2" />
        </Field>

        <Field label="選擇人員" required>
          <EmployeeSearchPicker value={appNumber} onChange={(num) => setAppNumber(num)} activeOnly />
        </Field>

        {att.status !== 'idle' && (
          <div className={clsx('flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
            att.status === 'work' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
            att.status === 'off' && 'border-red-200 bg-red-50 text-red-800',
            (att.status === 'unknown' || att.status === 'loading') && 'border-amber-200 bg-amber-50 text-amber-800',
          )}>
            {att.status === 'work' ? <CheckCircleIcon className="h-5 w-5 shrink-0" /> : <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />}
            <span>{att.message}</span>
          </div>
        )}

        <Field label="標籤分類" required>
          <div className="flex flex-wrap gap-2">
            {CAT_ORDER.map((k) => (
              <button key={k} type="button" onClick={() => { setCategory(k); setSubName(''); setSubId(undefined); }}
                className={clsx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm',
                  category === k ? CAT[k].chip + ' ring-2 ring-offset-1 ring-gray-300' : 'border-gray-300 text-gray-600 hover:bg-gray-50')}>
                <span className={clsx('h-2.5 w-2.5 rounded-full', CAT[k].dot)} />{CAT[k].name}
              </button>
            ))}
          </div>
        </Field>

        {category && (
          <Field label="標籤細項" required>
            <SubcategoryField categoryKey={category} value={subName}
              onChange={(name, id) => { setSubName(name); setSubId(id); }}
              createdBy={user?.name || user?.email} />
          </Field>
        )}

        <Field label="談話主題／備註" required>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3}
                    placeholder="本次排程預計處理的內容…" className="w-full rounded-md border border-gray-300 px-3 py-2" />
          <div className="mt-1 text-right text-xs text-gray-400">{note.length}/500</div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="預計開始時間" required>
            <select value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">請選擇</option>
              {startOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="預計談話時間" required>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full rounded-md border border-gray-300 px-3 py-2">
              {DURATION_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
        </div>

        {start && (
          <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <ClockIcon className="h-4 w-4 text-gray-400" />
            預計結束時間：<span className="font-semibold">{endStr}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
        <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">取消</button>
        <button onClick={save} disabled={!canSave}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? (isEdit ? '更新中…' : '建立中…') : (isEdit ? '儲存' : '建立')}
        </button>
      </div>
    </Overlay>
  );
}

// 小分類欄位：選 / 搜 / 新增（真 API）
function SubcategoryField({ categoryKey, value, onChange, createdBy }: {
  categoryKey: string;
  value: string;
  onChange: (name: string, id?: string) => void;
  createdBy?: string;
}) {
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    calendarApi.listSubcategories(categoryKey)
      .then((r) => setList(Array.isArray(r.data) ? r.data : r.data?.data ?? []))
      .catch(() => setList([]));
  }, [categoryKey]);
  useEffect(() => { load(); setQ(''); setAdding(false); setNewName(''); setErr(''); }, [load]);

  const filtered = list.filter((s) => s.name.includes(q.trim()));

  const addNew = async () => {
    const name = newName.trim();
    if (!name) { setErr('不可建立空白內容'); return; }
    if (name.length > 20) { setErr('小分類名稱不可超過 20 字'); return; }
    setSaving(true);
    try {
      const r = await calendarApi.createSubcategory({ category_key: categoryKey, name, created_by: createdBy });
      const created = r.data;
      setList((prev) => (prev.some((s) => s.id === created.id) ? prev : [...prev, created]));
      onChange(created.name, created.id);
      setAdding(false); setNewName(''); setErr('');
    } catch (e: any) {
      setErr(e.response?.data?.message || '新增失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="relative mb-2">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋或選擇小分類…"
               className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3" />
      </div>
      <div className="flex flex-wrap gap-2">
        {filtered.map((s) => (
          <button key={s.id} type="button" onClick={() => onChange(s.name, s.id)}
                  className={clsx('rounded-full border px-3 py-1 text-sm',
                    value === s.name ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50')}>
            {s.name}
          </button>
        ))}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)}
                  className="rounded-full border border-dashed border-gray-400 px-3 py-1 text-sm text-gray-500 hover:bg-gray-50">
            ＋ 新增小分類
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-2 flex items-center gap-2">
          <input value={newName} onChange={(e) => { setNewName(e.target.value); setErr(''); }} autoFocus
                 placeholder="輸入自訂名稱（上限 20 字）" className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" onClick={addNew} disabled={saving}
                  className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? '儲存中' : '儲存'}
          </button>
          <button type="button" onClick={() => { setAdding(false); setErr(''); }} className="rounded-md border border-gray-300 px-3 py-2 text-sm">取消</button>
        </div>
      )}
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════
//  排程詳情 Modal（含取消）
// ═══════════════════════════════════════════
function DetailModal({ schedule, onClose, onEdit, onChanged }: {
  schedule: Schedule;
  onClose: () => void;
  onEdit: (s: Schedule) => void;
  onChanged: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const cat = catOf(schedule.category_key);

  const rows: [string, string][] = [
    ['排程日期', schedule.schedule_date],
    ['時間', `${hm(schedule.start_time)}－${hm(schedule.end_time)}（${schedule.duration_minutes} 分鐘）`],
    ['人員', `${schedule.employee_name}｜${schedule.employee_app_number}${schedule.store_name ? '｜' + schedule.store_name : ''}`],
    ['標籤大分類', cat.name],
    ['標籤小分類', schedule.subcategory_name],
    ['談話主題／備註', schedule.note],
    ['建立人', schedule.created_by || '—'],
    ['排程狀態', STATUS_LABEL[schedule.status] || schedule.status],
  ];
  if (schedule.status === 'cancelled' && schedule.cancel_reason) rows.push(['取消原因', schedule.cancel_reason]);

  const doCancel = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await calendarApi.cancelSchedule(schedule.id, reason.trim(), user?.name || user?.email);
      toast.success('排程已取消。');
      onChanged();
    } catch (e: any) {
      toast.error(e.response?.data?.message || '取消失敗');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (next: string) => {
    if (next === schedule.status || busy) return;
    setBusy(true);
    try {
      await calendarApi.updateSchedule(schedule.id, { status: next, updated_by: user?.name || user?.email });
      toast.success('狀態已更新。');
      onChanged();
    } catch (e: any) {
      toast.error(e.response?.data?.message || '狀態更新失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={clsx('h-3 w-3 rounded-full', cat.dot)} />
          <h2 className="text-lg font-semibold text-gray-900">排程詳情</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="h-5 w-5" /></button>
      </div>

      <div className="space-y-3 px-5 py-4">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_1fr] gap-2 text-sm">
            <span className="text-gray-500">{k}</span>
            <span className="text-gray-900">{v}</span>
          </div>
        ))}

        {schedule.status !== 'cancelled' && !cancelling && (
          <div className="pt-1">
            <div className="mb-1 text-sm text-gray-500">更新狀態</div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FLOW.map((k) => (
                <button key={k} type="button" disabled={busy} onClick={() => changeStatus(k)}
                        className={clsx('rounded-full border px-3 py-1 text-sm disabled:opacity-50',
                          schedule.status === k ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50')}>
                  {STATUS_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
        )}

        {cancelling && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
            <label className="mb-1 block text-sm font-medium text-red-700">取消原因（必填）</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                      className="w-full rounded-md border border-red-300 px-3 py-2 text-sm" placeholder="請說明取消原因…" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
        {schedule.employee_id && !cancelling && (
          <button onClick={() => window.open(`/employees/${schedule.employee_id}`, '_blank', 'noopener')}
                  className="mr-auto rounded-md border border-primary-300 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50">
            個人頁面
          </button>
        )}
        {schedule.status !== 'cancelled' && !cancelling && (
          <button onClick={() => onEdit(schedule)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">編輯</button>
        )}
        {schedule.status !== 'cancelled' && !cancelling && (
          <button onClick={() => setCancelling(true)} className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">取消排程</button>
        )}
        {cancelling && (
          <button onClick={doCancel} disabled={!reason.trim() || busy}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy ? '處理中…' : '確認取消'}
          </button>
        )}
        <button onClick={onClose} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">關閉</button>
      </div>
    </Overlay>
  );
}

// ── 共用小元件 ──
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
