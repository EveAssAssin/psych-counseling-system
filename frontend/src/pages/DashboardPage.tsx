import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UsersIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowPathIcon,
  ClockIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { employeesApi, conversationsApi, riskFlagsApi, analysisApi, syncApi, calendarApi } from '../services/api';
import toast from 'react-hot-toast';

// 本月訪談時數 — 大分類（顏色與行事曆一致）
const DASH_CATS = [
  { key: 'routine', name: '例行性關懷', color: 'bg-blue-500', hex: '#3b82f6' },
  { key: 'announce', name: '流程佈達', color: 'bg-emerald-500', hex: '#10b981' },
  { key: 'project', name: '專案焦點', color: 'bg-violet-500', hex: '#8b5cf6' },
  { key: 'newcomer', name: '新人輔導', color: 'bg-amber-500', hex: '#f59e0b' },
  { key: 'urgent', name: '緊急案件', color: 'bg-red-500', hex: '#ef4444' },
  { key: 'unfit', name: '不適任評估', color: 'bg-slate-500', hex: '#64748b' },
];
const fmtHM = (min: number) => {
  if (!min) return '0 分';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} 小時 ${m} 分` : `${m} 分`;
};

interface TalkData { total: number; byCat: Record<string, number> }

// 排程總覽輔助
const hm = (t?: string) => (t ? t.slice(0, 5) : '');
const catName = (key: string) => DASH_CATS.find((c) => c.key === key)?.name || key;
const SCHED_STATUS_LABEL: Record<string, string> = {
  pending: '待進行', completed: '已完成', cancelled: '已取消', no_show: '未執行', follow_up: '需後續追蹤',
};
const isOverdue = (s: any) =>
  s.status !== 'completed' && new Date(`${s.schedule_date}T${hm(s.end_time)}:00`).getTime() < Date.now();

// 排程清單卡片
// 在職員工卡：新人 / 風險 數字，滑鼠移上顯示名單浮動視窗
function NamePopover({ label, count, list, danger }: {
  label: string;
  count: number;
  list: { name: string; store_name?: string; tags?: string[] }[];
  danger?: boolean;
}) {
  const has = list && list.length > 0;
  const twoCol = list.length > 8; // 一欄寫不下時分兩欄，避免出現捲軸
  return (
    <div className="relative group flex items-baseline">
      <span className={`text-2xl font-semibold ${danger ? 'text-danger-600' : 'text-gray-900'} ${
        has ? 'cursor-help underline decoration-dotted decoration-gray-300 underline-offset-4' : ''
      }`}>
        {count}
      </span>
      <span className="ml-1 text-sm text-gray-500">{label}</span>
      {has && (
        <div className={`absolute left-0 top-full z-50 mt-1 hidden rounded-lg border border-gray-200 bg-white p-2 text-left shadow-xl group-hover:block ${twoCol ? 'w-[26rem]' : 'w-56'}`}>
          <p className="mb-1 px-1 text-xs font-medium text-gray-500">{label}（{count}）</p>
          <ul className={`grid gap-x-4 text-sm text-gray-700 ${twoCol ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {list.map((p, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 px-1 py-0.5">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-gray-400">
                  {danger && p.tags && p.tags.length ? p.tags.join('、') : (p.store_name || '')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SchedCard({ title, schedules, accent, onReschedule, onOpen, emptyText }: {
  title: string;
  schedules: any[];
  accent: 'red' | 'blue' | 'indigo';
  onReschedule?: (s: any) => void;
  onOpen: () => void;
  emptyText?: string;
}) {
  const dot = accent === 'red' ? 'bg-red-500' : accent === 'blue' ? 'bg-blue-500' : 'bg-indigo-500';
  // 低調底色強調（不鮮豔）：逾期偏紅、今日偏藍、明日偏靛
  const tint = accent === 'red'
    ? 'bg-red-50/60 border-red-100'
    : accent === 'blue'
    ? 'bg-blue-50/60 border-blue-100'
    : 'bg-indigo-50/60 border-indigo-100';
  return (
    <div className={`card p-5 border ${tint}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{schedules.length}</span>
        </div>
        <button onClick={onOpen} className="text-xs text-primary-600 hover:text-primary-500">前往行事曆 →</button>
      </div>
      {schedules.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">{emptyText || '目前沒有排程'}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {schedules.slice(0, 8).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {s.employee_name}
                  <span className="ml-2 text-xs font-normal text-gray-400">{hm(s.start_time)}–{hm(s.end_time)}</span>
                </p>
                <p className="truncate text-xs text-gray-500">
                  {accent === 'red' && <span className="text-gray-400">{s.schedule_date || '無'} · </span>}
                  {catName(s.category_key) || '無'}｜{s.subcategory_name || '無'}
                  <span className="ml-1 text-gray-400">· {SCHED_STATUS_LABEL[s.status] || s.status || '無'}</span>
                </p>
              </div>
              {onReschedule && (
                s.rescheduled_at ? (
                  <span className="shrink-0 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">已安排</span>
                ) : (
                  <button onClick={() => onReschedule(s)}
                          className="shrink-0 rounded-md border border-primary-300 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50">
                    重新安排
                  </button>
                )
              )}
            </li>
          ))}
          {schedules.length > 8 && (
            <li className="pt-2 text-center text-xs text-gray-400">還有 {schedules.length - 8} 筆…</li>
          )}
        </ul>
      )}
    </div>
  );
}

// 訪談時數甜甜圈圖：中央顯示總時數，圖例顯示各分類時數與百分比
function TalkDonut({ label, data }: { label: string; data: TalkData }) {
  const size = 168, stroke = 20, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;
  const total = data.total;
  let acc = 0;
  const segs = DASH_CATS.map((cat) => {
    const m = data.byCat[cat.key] || 0;
    const frac = total > 0 ? m / total : 0;
    const seg = { cat, m, frac, offset: acc };
    acc += frac;
    return seg;
  }).filter((s) => s.m > 0);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 text-xs font-medium text-gray-500">{label}</div>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
          {segs.map((s) => (
            <circle key={s.cat.key} cx={cx} cy={cy} r={r} fill="none" stroke={s.cat.hex} strokeWidth={stroke}
                    strokeDasharray={`${s.frac * circ} ${circ - s.frac * circ}`}
                    strokeDashoffset={-s.offset * circ} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-lg font-bold text-gray-900">{fmtHM(total)}</div>
          <div className="text-[11px] text-gray-400">訪談時數</div>
        </div>
      </div>
      <div className="mt-3 w-full space-y-1">
        {segs.length === 0 ? (
          <div className="text-center text-xs text-gray-400">無資料</div>
        ) : segs.map((s) => (
          <div key={s.cat.key} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.cat.hex }} />
            <span className="truncate text-gray-600">{s.cat.name}</span>
            <span className="ml-auto shrink-0 font-medium text-gray-900">{fmtHM(s.m)}</span>
            <span className="w-10 shrink-0 text-right text-gray-400">{Math.round(s.frac * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Stats {
  employees: {
    total: number; active: number; regular?: number; newcomer?: number; risk?: number;
    newcomerList?: { id?: string; name: string; store_name?: string }[];
    riskList?: { id?: string; name: string; store_name?: string; tags?: string[] }[];
  };
  conversations: { total: number; pending: number; needFollowup: number };
  riskFlags: { open: number; critical: number; high: number };
}

interface SyncStatus {
  cursors: Record<string, { last_synced_at: string | null; last_record_time: string | null; total_synced: number }>;
  recentLogs: any[];
}

interface HighRiskItem {
  id: string;
  conversation_intake_id?: string;
  employee_id: string;
  employee_name?: string;
  risk_level: string;
  summary?: string;
  created_at: string;
}

const getRiskLevelBadge = (level: string) => {
  const badges: Record<string, string> = {
    low: 'badge-low',
    moderate: 'badge-moderate',
    high: 'badge-high',
    critical: 'badge-critical',
  };
  return badges[level] || 'badge-low';
};

const getRiskLevelText = (level: string) => {
  const texts: Record<string, string> = {
    low: '低',
    moderate: '中',
    high: '高',
    critical: '極高',
  };
  return texts[level] || level;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [highRiskItems, setHighRiskItems] = useState<HighRiskItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [monthTalk, setMonthTalk] = useState<TalkData>({ total: 0, byCat: {} });
  const [todayTalk, setTodayTalk] = useState<TalkData>({ total: 0, byCat: {} });
  const [sched, setSched] = useState<{ overdue: any[]; today: any[]; tomorrow: any[] }>({ overdue: [], today: [], tomorrow: [] });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [syncingChannel, setSyncingChannel] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 本月日期範圍
      const now = new Date();
      const y = now.getFullYear();
      const mo = now.getMonth();
      const pad = (n: number) => String(n).padStart(2, '0');
      const first = `${y}-${pad(mo + 1)}-01`;
      const last = `${y}-${pad(mo + 1)}-${pad(new Date(y, mo + 1, 0).getDate())}`;
      // 排程總覽用寬範圍（近一年 ~ 明天），一次抓完逾期/今日/明日
      const fmtD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const wideStart = new Date(now); wideStart.setFullYear(now.getFullYear() - 1);
      const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);

      const [empStats, convStats, riskStats, highRisk, syncStatusRes, calRes, schedRes] = await Promise.all([
        employeesApi.getStats(),
        conversationsApi.getStats(),
        riskFlagsApi.getStats(),
        analysisApi.getHighRisk(5),
        syncApi.getStatus().catch(() => ({ data: null })),
        calendarApi.listSchedules({ start_date: first, end_date: last }).catch(() => ({ data: [] as any[] })),
        calendarApi.listSchedules({ start_date: fmtD(wideStart), end_date: fmtD(tomorrow) }).catch(() => ({ data: [] as any[] })),
      ]);

      setStats({
        employees: empStats.data,
        conversations: convStats.data,
        riskFlags: riskStats.data,
      });

      setHighRiskItems(highRisk.data);
      if (syncStatusRes.data) setSyncStatus(syncStatusRes.data);

      // 本月 / 今日訪談時數（實際訪談時間，全部訪談方式，依大分類加總）
      const todayStr = `${y}-${pad(mo + 1)}-${pad(now.getDate())}`;
      const monthScheds: any[] = Array.isArray(calRes.data) ? calRes.data : calRes.data?.data ?? [];
      const mByCat: Record<string, number> = {};
      const tByCat: Record<string, number> = {};
      let mTotal = 0;
      let tTotal = 0;
      for (const s of monthScheds) {
        const mins = s.actual_minutes || 0;
        if (!mins) continue;
        mByCat[s.category_key] = (mByCat[s.category_key] || 0) + mins;
        mTotal += mins;
        if (s.schedule_date === todayStr) {
          tByCat[s.category_key] = (tByCat[s.category_key] || 0) + mins;
          tTotal += mins;
        }
      }
      setMonthTalk({ total: mTotal, byCat: mByCat });
      setTodayTalk({ total: tTotal, byCat: tByCat });

      // 排程總覽：逾期（全部未完成）/ 今日 / 明日
      const tomorrowStr = fmtD(tomorrow);
      const allS: any[] = Array.isArray(schedRes.data) ? schedRes.data : schedRes.data?.data ?? [];
      const byTime = (a: any, b: any) =>
        (a.schedule_date + a.start_time > b.schedule_date + b.start_time ? 1 : -1);
      setSched({
        overdue: allS.filter(isOverdue).sort(byTime),
        today: allS.filter((s) => s.schedule_date === todayStr).sort(byTime),
        tomorrow: allS.filter((s) => s.schedule_date === tomorrowStr).sort(byTime),
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOfficialChannel = async () => {
    if (syncingChannel) return;
    setSyncingChannel(true);
    toast.loading('正在同步官方頻道訊息...', { id: 'sync-channel' });
    try {
      const res = await syncApi.syncOfficialChannel();
      const result = res.data;
      toast.success(
        `同步完成！新增 ${result.total_created} 筆，更新 ${result.total_updated} 筆`,
        { id: 'sync-channel', duration: 5000 }
      );
      // 重新載入同步狀態
      const statusRes = await syncApi.getStatus();
      if (statusRes.data) setSyncStatus(statusRes.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || '同步失敗', { id: 'sync-channel' });
    } finally {
      setSyncingChannel(false);
    }
  };

  const formatSyncTime = (isoStr: string | null) => {
    if (!isoStr) return '尚未同步';
    return new Date(isoStr).toLocaleString('zh-TW');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">儀表板</h1>
        <p className="mt-1 text-sm text-gray-500">系統總覽與重要指標</p>
      </div>

      {/* 重要指標 + 快速操作（合併區塊，置頂） */}
      {/* overflow-visible：避免新人/風險浮動視窗被卡片裁切 */}
      <div className="card p-5 space-y-5 overflow-visible relative z-20">
        {/* Stats cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UsersIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">在職員工</dt>
                  <dd className="flex items-baseline gap-1.5 flex-wrap">
                    <div className="flex items-baseline">
                      <span className="text-2xl font-semibold text-gray-900">
                        {stats?.employees.regular || 0}
                      </span>
                      <span className="ml-1 text-sm text-gray-500">正職</span>
                    </div>
                    <span className="text-gray-300">｜</span>
                    <NamePopover label="新人" count={stats?.employees.newcomer || 0}
                                 list={stats?.employees.newcomerList || []} />
                    <span className="text-gray-300">｜</span>
                    <NamePopover label="風險" count={stats?.employees.risk || 0}
                                 list={stats?.employees.riskList || []} danger />
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">對話記錄</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {stats?.conversations.total || 0}
                    </div>
                    {(stats?.conversations.pending || 0) > 0 && (
                      <span className="ml-2 text-sm text-warning-600">
                        {stats?.conversations.pending} 待處理
                      </span>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-danger-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">開放風險標記</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {stats?.riskFlags.open || 0}
                    </div>
                    {(stats?.riskFlags.critical || 0) > 0 && (
                      <span className="ml-2 text-sm text-danger-600">
                        {stats?.riskFlags.critical} 極高風險
                      </span>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowTrendingUpIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">需追蹤</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {stats?.conversations.needFollowup || 0}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions（含資料同步狀態，共 4 格） */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/conversations/new"
            className="rounded-lg border border-gray-100 bg-gray-50 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-primary-100 rounded-lg p-3">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">新增對話記錄</p>
                <p className="text-sm text-gray-500">輸入或上傳對話內容</p>
              </div>
            </div>
          </Link>

          <Link
            to="/employees"
            className="rounded-lg border border-gray-100 bg-gray-50 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                <UsersIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">搜尋員工</p>
                <p className="text-sm text-gray-500">查看員工狀態與記錄</p>
              </div>
            </div>
          </Link>

          <Link
            to="/query"
            className="rounded-lg border border-gray-100 bg-gray-50 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                <ArrowTrendingUpIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">智能問答</p>
                <p className="text-sm text-gray-500">詢問員工狀態</p>
              </div>
            </div>
          </Link>

          {/* 第 4 格：資料同步狀態 */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                  <ClockIcon className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">資料同步狀態</p>
              </div>
              <button type="button" onClick={() => setSyncOpen((v) => !v)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      title={syncOpen ? '收合' : '展開'}>
                <ChevronDownIcon className={`h-5 w-5 transition-transform ${syncOpen ? '' : '-rotate-90'}`} />
              </button>
            </div>
            <button
              onClick={handleSyncOfficialChannel}
              disabled={syncingChannel}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`h-4 w-4 ${syncingChannel ? 'animate-spin' : ''}`} />
              {syncingChannel ? '同步中...' : '立即同步官方頻道'}
            </button>
            {syncOpen && (
              <div className="mt-3 space-y-2 text-xs">
                <div className="rounded-md bg-white p-2">
                  <p className="font-medium text-gray-500">LINE 官方訊息</p>
                  <p className="text-gray-900">最後同步：{formatSyncTime(syncStatus?.cursors?.['official-channel-line']?.last_synced_at ?? null)}</p>
                  <p className="text-gray-500">累計 {syncStatus?.cursors?.['official-channel-line']?.total_synced ?? 0} 筆</p>
                </div>
                <div className="rounded-md bg-white p-2">
                  <p className="font-medium text-gray-500">工單留言</p>
                  <p className="text-gray-900">最後同步：{formatSyncTime(syncStatus?.cursors?.['official-channel-comments']?.last_synced_at ?? null)}</p>
                  <p className="text-gray-500">累計 {syncStatus?.cursors?.['official-channel-comments']?.total_synced ?? 0} 筆</p>
                </div>
                {syncStatus?.recentLogs && syncStatus.recentLogs.length > 0 && (
                  <div className="space-y-1">
                    {syncStatus.recentLogs.slice(0, 3).map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between">
                        <span className="text-gray-600">
                          {log.sync_type === 'official_channel' ? '官方頻道' :
                           log.sync_type === 'employee_full' ? '員工同步' :
                           log.sync_type === 'external_daily' ? '每日同步' : log.sync_type}
                        </span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded font-medium ${
                          log.status === 'completed' ? 'bg-green-100 text-green-700' :
                          log.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                          log.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.status === 'completed' ? '成功' :
                           log.status === 'partial' ? '部分成功' :
                           log.status === 'failed' ? '失敗' :
                           log.status === 'running' ? '執行中' : log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 訪談時數（實際）— 今日 / 本月 */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500">訪談時數（實際）</p>
          <p className="text-xs text-gray-400">全部訪談方式</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <TalkDonut label="今日" data={todayTalk} />
          <TalkDonut label={`本月（${new Date().getMonth() + 1} 月）`} data={monthTalk} />
        </div>

        {todayTalk.total === 0 && monthTalk.total === 0 && (
          <p className="mt-3 text-center text-xs text-gray-400">目前尚無填寫實際訪談時間的排程。</p>
        )}
      </div>

      {/* 排程總覽：逾期 / 今日 / 明日 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SchedCard title="逾期排程" schedules={sched.overdue} accent="red" emptyText="無"
                   onReschedule={(s) => navigate(`/calendar?reschedule=${s.id}`)}
                   onOpen={() => navigate('/calendar')} />
        <SchedCard title="今日排程" schedules={sched.today} accent="blue" onOpen={() => navigate('/calendar')} />
        <SchedCard title="明日排程" schedules={sched.tomorrow} accent="indigo" onOpen={() => navigate('/calendar')} />
      </div>

      {/* 風險 / 追蹤 三欄：AI 標記風險 / 輔導員標記風險 / 新人追蹤 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 左：AI 標記風險 */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">AI 標記風險</h3>
            <Link to="/risk-flags" className="text-xs text-primary-600 hover:text-primary-500">查看全部 →</Link>
          </div>
          <ul className="max-h-96 divide-y divide-gray-100 overflow-auto">
            {highRiskItems.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-400">目前沒有高風險項目</li>
            ) : (
              highRiskItems.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.conversation_intake_id
                      ? `/conversations/${item.conversation_intake_id}`
                      : `/employees/${item.employee_id}`}
                    className="block px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-primary-600">{item.employee_name || '未知員工'}</p>
                      <span className={`shrink-0 ${getRiskLevelBadge(item.risk_level)}`}>
                        {getRiskLevelText(item.risk_level)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">{item.summary || '無摘要'}</p>
                    <p className="mt-1 text-xs text-gray-400">{new Date(item.created_at).toLocaleString('zh-TW')}</p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* 中：輔導員標記風險（員工 risk_tags） */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">輔導員標記風險</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {stats?.employees.riskList?.length || 0}
            </span>
          </div>
          <ul className="max-h-96 divide-y divide-gray-100 overflow-auto">
            {(stats?.employees.riskList?.length || 0) === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-400">目前沒有輔導員標記</li>
            ) : (
              stats!.employees.riskList!.map((r, i) => {
                const inner = (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-gray-900">{r.name}</p>
                      {r.store_name && <span className="shrink-0 text-xs text-gray-400">{r.store_name}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(r.tags || []).map((t) => (
                        <span key={t} className="rounded-full border border-danger-200 bg-danger-50 px-2 py-0.5 text-xs text-danger-700">{t}</span>
                      ))}
                    </div>
                  </>
                );
                return (
                  <li key={r.id || i}>
                    {r.id ? (
                      <Link to={`/employees/${r.id}`} className="block px-4 py-3 hover:bg-gray-50">{inner}</Link>
                    ) : (
                      <div className="px-4 py-3">{inner}</div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* 右：新人追蹤 */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">新人追蹤</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {stats?.employees.newcomerList?.length || 0}
            </span>
          </div>
          <ul className="max-h-96 divide-y divide-gray-100 overflow-auto">
            {(stats?.employees.newcomerList?.length || 0) === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-400">目前沒有新人</li>
            ) : (
              stats!.employees.newcomerList!.map((r, i) => {
                const inner = (
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">{r.name}</p>
                    {r.store_name && <span className="shrink-0 text-xs text-gray-400">{r.store_name}</span>}
                  </div>
                );
                return (
                  <li key={r.id || i}>
                    {r.id ? (
                      <Link to={`/employees/${r.id}`} className="block px-4 py-3 hover:bg-gray-50">{inner}</Link>
                    ) : (
                      <div className="px-4 py-3">{inner}</div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

    </div>
  );
}
