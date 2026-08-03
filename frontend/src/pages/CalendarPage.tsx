import { useMemo, useState } from 'react';
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

/**
 * 行事曆 — 週檢視（Phase 1 UI 原型 / 假資料）
 *
 * ⚠️ 本頁目前使用「假資料」示範版型與互動流程，尚未串接後端。
 *    後端 API（排程 CRUD、仁友/HRM 排休檢查、衝突檢查、小分類字典）確認資料來源後再接。
 *
 * 設計對應需求：
 *  - 三、週檢視：週切換、日期區間、小時時間軸、依時間定位的排程
 *  - 四/五、右下角固定＋新增、新增排程表單全欄位
 *  - 六、排休檢查狀態（上班 / 休假 / 無法取得）
 *  - 七、標籤大分類（5 項固定 + 顏色）、小分類（選 / 搜 / 新增）
 *  - 十、談話時長 + 自動計算結束時間
 *  - 十一、衝突檢查（整段時間重疊，非只比開始時間）
 */

// ── 可調參數（之後改為公司設定）──
const WORK_START_HOUR = 11;  // 時間軸起點
const WORK_END_HOUR = 21;    // 時間軸終點
const HOUR_PX = 56;          // 每小時像素高度
const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日'];

// ── 標籤大分類（固定 5 項，各自顏色。用完整 class 字串避免 Tailwind purge）──
interface Category {
  key: string;
  name: string;
  block: string;   // 排程方塊底色 + 文字
  dot: string;     // 圖例小圓點
  chip: string;    // 選取按鈕
  urgent?: boolean;
}
const CATEGORIES: Category[] = [
  { key: 'routine',  name: '例行性關懷', block: 'bg-blue-100 border-blue-300 text-blue-900',       dot: 'bg-blue-500',   chip: 'border-blue-300 bg-blue-50 text-blue-700' },
  { key: 'announce', name: '流程佈達',   block: 'bg-emerald-100 border-emerald-300 text-emerald-900', dot: 'bg-emerald-500', chip: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  { key: 'project',  name: '專案焦點',   block: 'bg-violet-100 border-violet-300 text-violet-900',   dot: 'bg-violet-500',  chip: 'border-violet-300 bg-violet-50 text-violet-700' },
  { key: 'newcomer', name: '新人輔導',   block: 'bg-amber-100 border-amber-300 text-amber-900',      dot: 'bg-amber-500',   chip: 'border-amber-300 bg-amber-50 text-amber-700' },
  { key: 'urgent',   name: '緊急案件',   block: 'bg-red-500 border-red-700 text-white ring-2 ring-red-400', dot: 'bg-red-600', chip: 'border-red-300 bg-red-50 text-red-700', urgent: true },
];
const catOf = (key: string) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];

const DURATION_OPTIONS = [
  { value: 5, label: '5 分鐘' },
  { value: 10, label: '10 分鐘' },
  { value: 15, label: '15 分鐘' },
  { value: 30, label: '30 分鐘' },
  { value: 60, label: '1 小時' },
];

// ── 小分類字典（假資料，之後改為 DB）──
const SUBCATEGORIES: Record<string, string[]> = {
  routine:  ['月度關懷', '狀態追蹤', '滿意度確認'],
  announce: ['公告佈達', '政策說明', '流程變更'],
  project:  ['專案啟動', '進度檢視', '結案回顧'],
  newcomer: ['第一週關懷', '工作適應', '教學進度確認', '系統操作問題'],
  urgent:   ['情緒事件', '衝突處理', '緊急約談'],
};

// ── 員工搜尋（假資料，之後改為 employeesApi.search）──
interface MockEmp { app_number: string; name: string; store: string; off?: string[] }
const MOCK_EMPLOYEES: MockEmp[] = [
  { app_number: 'A001', name: '王小明', store: '中壢門市' },
  { app_number: 'A015', name: '王小美', store: '板橋門市', off: [] },
  { app_number: 'A023', name: '陳大文', store: '新竹門市' },
  { app_number: 'A047', name: '林靜怡', store: '桃園門市', off: ['ALL'] }, // 示範「休假」路徑
  { app_number: 'A088', name: '張家豪', store: '中壢門市' },
];

// ── 排程假資料 ──
interface Schedule {
  id: string;
  date: string;        // YYYY-MM-DD
  start: string;       // HH:mm
  duration: number;    // 分鐘
  empName: string;
  empNumber: string;
  store: string;
  category: string;    // key
  subcategory: string;
  note: string;
  status: string;
  createdBy: string;
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
  const dow = (x.getDay() + 6) % 7; // 週一=0
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const minToHHMM = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// 產生本週假排程（以本週一為基準推算）
function buildMockSchedules(weekStart: Date): Schedule[] {
  const d = (n: number) => fmt(addDays(weekStart, n));
  return [
    { id: 's1', date: d(0), start: '12:00', duration: 30, empName: '王小明', empNumber: 'A001', store: '中壢門市', category: 'newcomer', subcategory: '第一週關懷', note: '確認新人第一週工作適應狀況及任務系統使用情形。', status: '待進行', createdBy: '主管A' },
    { id: 's2', date: d(0), start: '14:00', duration: 60, empName: '張家豪', empNumber: 'A088', store: '中壢門市', category: 'routine', subcategory: '月度關懷', note: '月度例行關懷。', status: '待進行', createdBy: '主管A' },
    { id: 's3', date: d(2), start: '11:30', duration: 15, empName: '王小美', empNumber: 'A015', store: '板橋門市', category: 'announce', subcategory: '流程變更', note: '佈達新的請假流程。', status: '待進行', createdBy: '主管A' },
    { id: 's4', date: d(3), start: '15:00', duration: 30, empName: '陳大文', empNumber: 'A023', store: '新竹門市', category: 'project', subcategory: '進度檢視', note: '專案週進度檢視。', status: '待進行', createdBy: '主管A' },
    { id: 's5', date: d(1), start: '16:30', duration: 30, empName: '林靜怡', empNumber: 'A047', store: '桃園門市', category: 'urgent', subcategory: '情緒事件', note: '緊急：需儘快約談了解狀況。', status: '待進行', createdBy: '主管A' },
  ];
}

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [schedules, setSchedules] = useState<Schedule[]>(() => buildMockSchedules(startOfWeek(new Date())));
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<Schedule | null>(null);
  const [prefill, setPrefill] = useState<{ date?: string; start?: string }>({});

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = useMemo(
    () => Array.from({ length: WORK_END_HOUR - WORK_START_HOUR + 1 }, (_, i) => WORK_START_HOUR + i),
    [],
  );
  const rangeLabel = `${weekStart.getFullYear()}年${weekStart.getMonth() + 1}月${weekStart.getDate()}日 － ${addDays(weekStart, 6).getMonth() + 1}月${addDays(weekStart, 6).getDate()}日`;

  const gotoWeek = (delta: number) => {
    const ns = addDays(weekStart, delta * 7);
    setWeekStart(ns);
    setSchedules(buildMockSchedules(ns));
  };
  const gotoThisWeek = () => {
    const ns = startOfWeek(new Date());
    setWeekStart(ns);
    setSchedules(buildMockSchedules(ns));
  };

  const todayStr = fmt(new Date());

  const openNewAt = (date: string, hour: number) => {
    setPrefill({ date, start: `${String(hour).padStart(2, '0')}:00` });
    setShowNew(true);
  };

  const handleCreate = (s: Schedule) => {
    setSchedules((prev) => [...prev, s]);
    setShowNew(false);
  };

  return (
    <div className="relative">
      {/* 標題 + 原型提示 */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">行事曆</h1>
        <p className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
          UI 原型 · 目前為假資料，尚未串接後端
        </p>
      </div>

      {/* 週切換列 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => gotoWeek(-1)} className="rounded-md border border-gray-300 p-2 hover:bg-gray-50" title="上一週">
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button onClick={gotoThisWeek} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50">
            本週
          </button>
          <button onClick={() => gotoWeek(1)} className="rounded-md border border-gray-300 p-2 hover:bg-gray-50" title="下一週">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <span className="ml-3 text-sm font-semibold text-gray-700">{rangeLabel}</span>
        </div>
        {/* 圖例 */}
        <div className="hidden items-center gap-3 md:flex">
          {CATEGORIES.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 text-xs text-gray-600">
              <span className={clsx('h-2.5 w-2.5 rounded-full', c.dot)} />
              {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* 行事曆網格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="min-w-[900px]">
          {/* 星期標頭 */}
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

          {/* 時間軸 + 欄位 */}
          <div className="grid grid-cols-[64px_repeat(7,1fr)]">
            {/* 時間軸 */}
            <div className="relative" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h, i) => (
                <div key={h} className="absolute left-0 right-0 -translate-y-1/2 pr-2 text-right text-xs text-gray-400"
                     style={{ top: i * HOUR_PX }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* 七天欄位 */}
            {days.map((d, di) => {
              const dateStr = fmt(d);
              const daySchedules = schedules.filter((s) => s.date === dateStr);
              return (
                <div key={di} className="relative border-l border-gray-200" style={{ height: hours.length * HOUR_PX }}>
                  {/* 小時格線（點擊可新增）*/}
                  {hours.slice(0, -1).map((h, i) => (
                    <button
                      key={h}
                      onClick={() => openNewAt(dateStr, h)}
                      className="absolute left-0 right-0 border-b border-gray-100 hover:bg-primary-50/40"
                      style={{ top: i * HOUR_PX, height: HOUR_PX }}
                      title={`新增 ${String(h).padStart(2, '0')}:00 排程`}
                    />
                  ))}
                  {/* 排程方塊 */}
                  {daySchedules.map((s) => {
                    const top = ((toMin(s.start) - WORK_START_HOUR * 60) / 60) * HOUR_PX;
                    const height = Math.max((s.duration / 60) * HOUR_PX, 22);
                    const cat = catOf(s.category);
                    const endStr = minToHHMM(toMin(s.start) + s.duration);
                    return (
                      <button
                        key={s.id}
                        onClick={() => setDetail(s)}
                        className={clsx(
                          'absolute left-1 right-1 overflow-hidden rounded border px-1.5 py-1 text-left text-xs shadow-sm',
                          cat.block,
                        )}
                        style={{ top, height }}
                      >
                        <div className="flex items-center gap-1 font-semibold">
                          {cat.urgent && <ExclamationTriangleIcon className="h-3 w-3 shrink-0" />}
                          {s.empName}
                        </div>
                        <div className="truncate opacity-90">{cat.name}｜{s.subcategory}</div>
                        <div className="opacity-80">{s.start}－{endStr}</div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 右下角固定新增按鈕 */}
      <button
        onClick={() => { setPrefill({}); setShowNew(true); }}
        className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-primary-700"
      >
        <PlusIcon className="h-5 w-5" />
        新增
      </button>

      {showNew && (
        <NewScheduleModal
          prefill={prefill}
          existing={schedules}
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}
      {detail && <DetailModal schedule={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════
//  新增排程 Modal
// ═══════════════════════════════════════════
function NewScheduleModal({
  prefill, existing, onClose, onCreate,
}: {
  prefill: { date?: string; start?: string };
  existing: Schedule[];
  onClose: () => void;
  onCreate: (s: Schedule) => void;
}) {
  const [date, setDate] = useState(prefill.date || '');
  const [emp, setEmp] = useState<MockEmp | null>(null);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [note, setNote] = useState('');
  const [start, setStart] = useState(prefill.start || '');
  const [duration, setDuration] = useState<number>(30);

  // 排休檢查（假資料）：選了日期+人員才檢查
  type AttStatus = 'idle' | 'work' | 'off' | 'unknown';
  const attendance: AttStatus = useMemo(() => {
    if (!date || !emp) return 'idle';
    if (emp.off?.includes('ALL')) return 'off';        // 示範休假
    return 'work';
  }, [date, emp]);

  const endStr = start ? minToHHMM(toMin(start) + duration) : '';

  // 衝突檢查（整段重疊，非只比開始時間）
  const conflict = useMemo(() => {
    if (!date || !start) return null;
    const s = toMin(start);
    const e = s + duration;
    for (const it of existing) {
      if (it.date !== date) continue;
      const is = toMin(it.start);
      const ie = is + it.duration;
      const overlap = s < ie && e > is;
      if (!overlap) continue;
      if (emp && it.empNumber === emp.app_number) return { type: 'emp', msg: '該人員於此時段已有其他排程，請重新選擇時間。' };
      return { type: 'self', msg: '您於此時段已有其他排程，請確認是否調整時間。' };
    }
    return null;
  }, [date, start, duration, emp, existing]);

  // 開始時間選項（5 分鐘間隔）
  const startOptions = useMemo(() => {
    const arr: string[] = [];
    for (let m = WORK_START_HOUR * 60; m <= WORK_END_HOUR * 60; m += 5) arr.push(minToHHMM(m));
    return arr;
  }, []);

  const subs = category ? SUBCATEGORIES[category] || [] : [];

  // 需求：同人員重疊禁止；同管理者重疊預設禁止 → 兩種衝突都擋
  const canCreate = Boolean(
    date && emp && attendance === 'work' && category && subcategory && note.trim() && start && duration && !conflict,
  );

  const create = () => {
    if (!emp) return;
    onCreate({
      id: 'new-' + Date.now(),
      date, start, duration,
      empName: emp.name, empNumber: emp.app_number, store: emp.store,
      category, subcategory, note: note.trim(),
      status: '待進行', createdBy: '我',
    });
  };

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h2 className="text-lg font-semibold text-gray-900">新增排程</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="h-5 w-5" /></button>
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
        {/* 排程日期 */}
        <Field label="排程日期" required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                 className="w-full rounded-md border border-gray-300 px-3 py-2" />
        </Field>

        {/* 人員搜尋 */}
        <Field label="選擇人員" required>
          <MockPicker value={emp} onChange={setEmp} />
        </Field>

        {/* 排休檢查 */}
        {attendance !== 'idle' && (
          <div className={clsx(
            'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
            attendance === 'work' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
            attendance === 'off' && 'border-red-200 bg-red-50 text-red-800',
            attendance === 'unknown' && 'border-amber-200 bg-amber-50 text-amber-800',
          )}>
            {attendance === 'work' && <><CheckCircleIcon className="h-5 w-5 shrink-0" /><span>已確認該人員當日有上班，可繼續建立排程。</span></>}
            {attendance === 'off' && <><ExclamationTriangleIcon className="h-5 w-5 shrink-0" /><span>該人員當日休假，無法建立排程。請重新選擇日期或人員。</span></>}
            {attendance === 'unknown' && <><ExclamationTriangleIcon className="h-5 w-5 shrink-0" /><span>目前無法確認該人員的出勤狀態，請稍後再試或確認排班資料。</span></>}
          </div>
        )}

        {/* 標籤大分類 */}
        <Field label="標籤分類" required>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.key} type="button"
                onClick={() => { setCategory(c.key); setSubcategory(''); }}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm',
                  category === c.key ? c.chip + ' ring-2 ring-offset-1 ring-gray-300' : 'border-gray-300 text-gray-600 hover:bg-gray-50',
                )}>
                <span className={clsx('h-2.5 w-2.5 rounded-full', c.dot)} />{c.name}
              </button>
            ))}
          </div>
        </Field>

        {/* 標籤小分類 */}
        {category && (
          <Field label="標籤細項" required>
            <SubcategoryField
              options={subs}
              value={subcategory}
              onChange={setSubcategory}
            />
          </Field>
        )}

        {/* 談話主題 */}
        <Field label="談話主題／備註" required>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3}
                    placeholder="本次排程預計處理的內容…"
                    className="w-full rounded-md border border-gray-300 px-3 py-2" />
          <div className="mt-1 text-right text-xs text-gray-400">{note.length}/500</div>
        </Field>

        {/* 開始時間 + 時長 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="預計開始時間" required>
            <select value={start} onChange={(e) => setStart(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">請選擇</option>
              {startOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="預計談話時間" required>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2">
              {DURATION_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
        </div>

        {/* 結束時間 */}
        {start && (
          <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <ClockIcon className="h-4 w-4 text-gray-400" />
            預計結束時間：<span className="font-semibold">{endStr}</span>
          </div>
        )}

        {/* 衝突提示 */}
        {conflict && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
            <span>{conflict.msg}</span>
          </div>
        )}
      </div>

      {/* 動作列 */}
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
        <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">取消</button>
        <button onClick={create} disabled={!canCreate}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
          建立
        </button>
      </div>
    </Overlay>
  );
}

// 小分類欄位：選 / 搜 / 新增
function SubcategoryField({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const [list, setList] = useState<string[]>(options);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');

  // options 變動時（切換大分類）重置
  useMemo(() => { setList(options); setQ(''); setAdding(false); setNewName(''); setErr(''); }, [options]);

  const filtered = list.filter((s) => s.includes(q.trim()));

  const addNew = () => {
    const name = newName.trim();
    if (!name) { setErr('不可建立空白內容'); return; }
    if (name.length > 20) { setErr('小分類名稱不可超過 20 字'); return; }
    if (list.some((s) => s === name)) { setErr('此小分類已存在，請直接選擇既有項目。'); return; }
    setList((prev) => [...prev, name]);
    onChange(name);
    setAdding(false);
    setNewName('');
    setErr('');
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
          <button key={s} type="button" onClick={() => onChange(s)}
                  className={clsx('rounded-full border px-3 py-1 text-sm',
                    value === s ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50')}>
            {s}
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
                 placeholder="輸入自訂名稱（上限 20 字）"
                 className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" onClick={addNew} className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700">儲存</button>
          <button type="button" onClick={() => { setAdding(false); setErr(''); }} className="rounded-md border border-gray-300 px-3 py-2 text-sm">取消</button>
        </div>
      )}
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

// 人員搜尋（假資料版）
function MockPicker({ value, onChange }: { value: MockEmp | null; onChange: (e: MockEmp | null) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const results = q.trim()
    ? MOCK_EMPLOYEES.filter((e) => e.name.includes(q) || e.app_number.toLowerCase().includes(q.toLowerCase()) || e.store.includes(q))
    : [];

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary-300 bg-primary-50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-primary-900">{value.name}<span className="ml-2 text-xs font-normal text-primary-700">{value.app_number}</span></p>
          <p className="truncate text-xs text-primary-700">{value.store}</p>
        </div>
        <button type="button" onClick={() => { onChange(null); setQ(''); }} className="text-primary-600 hover:text-red-600"><XMarkIcon className="h-4 w-4" /></button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
               placeholder="輸入姓名／員工編號／門市搜尋…"
               className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3" />
      </div>
      {open && q && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="p-3 text-center text-sm text-gray-500">查無符合人員</div>
          ) : results.map((e) => (
            <button key={e.app_number} type="button" onClick={() => { onChange(e); setOpen(false); }}
                    className="block w-full border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-primary-50">
              <p className="text-sm font-medium text-gray-900">{e.name}<span className="ml-2 text-xs font-normal text-gray-500">{e.app_number}</span></p>
              <p className="text-xs text-gray-500">{e.store}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  排程詳情 Modal
// ═══════════════════════════════════════════
function DetailModal({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
  const cat = catOf(schedule.category);
  const endStr = minToHHMM(toMin(schedule.start) + schedule.duration);
  const rows: [string, string][] = [
    ['排程日期', schedule.date],
    ['時間', `${schedule.start}－${endStr}（${schedule.duration} 分鐘）`],
    ['人員', `${schedule.empName}｜${schedule.empNumber}｜${schedule.store}`],
    ['標籤大分類', cat.name],
    ['標籤小分類', schedule.subcategory],
    ['談話主題／備註', schedule.note],
    ['建立人', schedule.createdBy],
    ['排程狀態', schedule.status],
  ];
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
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
        <button className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-400" disabled title="下一階段">編輯</button>
        <button className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-400" disabled title="下一階段">取消排程</button>
        <button onClick={onClose} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">關閉</button>
      </div>
    </Overlay>
  );
}

// ── 共用小元件 ──
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
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
