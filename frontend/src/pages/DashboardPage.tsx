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
  { key: 'routine', name: '例行性關懷', color: 'bg-blue-500' },
  { key: 'announce', name: '流程佈達', color: 'bg-emerald-500' },
  { key: 'project', name: '專案焦點', color: 'bg-violet-500' },
  { key: 'newcomer', name: '新人輔導', color: 'bg-amber-500' },
  { key: 'urgent', name: '緊急案件', color: 'bg-red-500' },
  { key: 'unfit', name: '不適任評估', color: 'bg-slate-500' },
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
function SchedCard({ title, schedules, accent, onReschedule, onOpen, emptyText }: {
  title: string;
  schedules: any[];
  accent: 'red' | 'blue' | 'indigo';
  onReschedule?: (s: any) => void;
  onOpen: () => void;
  emptyText?: string;
}) {
  const dot = accent === 'red' ? 'bg-red-500' : accent === 'blue' ? 'bg-blue-500' : 'bg-indigo-500';
  return (
    <div className="card p-5">
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

function TalkBar({ label, data }: { label: string; data: TalkData }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{fmtHM(data.total)}</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {data.total > 0 &&
          DASH_CATS.map((c) => {
            const m = data.byCat[c.key] || 0;
            if (!m) return null;
            return <div key={c.key} className={c.color} style={{ width: `${(m / data.total) * 100}%` }} title={`${c.name}：${fmtHM(m)}`} />;
          })}
      </div>
    </div>
  );
}

interface Stats {
  employees: { total: number; active: number };
  conversations: { total: number; pending: number; needFollowup: number };
  riskFlags: { open: number; critical: number; high: number };
}

interface SyncStatus {
  cursors: Record<string, { last_synced_at: string | null; last_record_time: string | null; total_synced: number }>;
  recentLogs: any[];
}

interface HighRiskItem {
  id: string;
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
      <div className="card p-5 space-y-5">
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
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {stats?.employees.active || 0}
                    </div>
                    <span className="ml-2 text-sm text-gray-500">
                      / {stats?.employees.total || 0}
                    </span>
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

        {/* Quick actions */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
      </div>

      {/* 訪談時數（實際）— 今日 / 本月 */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500">訪談時數（實際）</p>
          <p className="text-xs text-gray-400">全部訪談方式</p>
        </div>

        <div className="space-y-3">
          <TalkBar label="今日" data={todayTalk} />
          <TalkBar label={`本月（${new Date().getMonth() + 1} 月）`} data={monthTalk} />
        </div>

        {/* 圖例 */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {DASH_CATS.map((c) => (
            <div key={c.key} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`h-2.5 w-2.5 rounded-full ${c.color}`} />
              {c.name}
            </div>
          ))}
        </div>

        {todayTalk.total === 0 && monthTalk.total === 0 && (
          <p className="mt-2 text-xs text-gray-400">目前尚無填寫實際訪談時間的排程。</p>
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

      {/* Sync Status */}
      <div className="card p-5">
        <div className={`flex items-center justify-between ${syncOpen ? 'mb-4' : ''}`}>
          <div className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">資料同步狀態</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncOfficialChannel}
              disabled={syncingChannel}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`h-4 w-4 ${syncingChannel ? 'animate-spin' : ''}`} />
              {syncingChannel ? '同步中...' : '立即同步官方頻道'}
            </button>
            <button type="button" onClick={() => setSyncOpen((v) => !v)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title={syncOpen ? '收合' : '展開'}>
              <ChevronDownIcon className={`h-5 w-5 transition-transform ${syncOpen ? '' : '-rotate-90'}`} />
            </button>
          </div>
        </div>
        {syncOpen && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-500">LINE 官方訊息</p>
            <p className="text-sm text-gray-900 mt-1">
              最後同步：{formatSyncTime(syncStatus?.cursors?.['official-channel-line']?.last_synced_at ?? null)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              累計同步 {syncStatus?.cursors?.['official-channel-line']?.total_synced ?? 0} 筆
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-500">工單留言</p>
            <p className="text-sm text-gray-900 mt-1">
              最後同步：{formatSyncTime(syncStatus?.cursors?.['official-channel-comments']?.last_synced_at ?? null)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              累計同步 {syncStatus?.cursors?.['official-channel-comments']?.total_synced ?? 0} 筆
            </p>
          </div>
        </div>
        {syncStatus?.recentLogs && syncStatus.recentLogs.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">最近同步紀錄</p>
            <div className="space-y-1">
              {syncStatus.recentLogs.slice(0, 3).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    {log.sync_type === 'official_channel' ? '官方頻道' :
                     log.sync_type === 'employee_full' ? '員工同步' :
                     log.sync_type === 'external_daily' ? '每日同步' : log.sync_type}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
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
                    <span className="text-gray-400">
                      {new Date(log.started_at).toLocaleString('zh-TW')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </>)}
      </div>

      {/* High risk list */}
      <div className="card">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              近期高風險分析
            </h3>
            <Link
              to="/risk-flags"
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              查看全部 →
            </Link>
          </div>
        </div>
        <ul role="list" className="divide-y divide-gray-200">
          {highRiskItems.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-500">
              目前沒有高風險項目
            </li>
          ) : (
            highRiskItems.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/conversations/${item.id}`}
                  className="block hover:bg-gray-50"
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-primary-600 truncate">
                        {item.employee_name || '未知員工'}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <span className={getRiskLevelBadge(item.risk_level)}>
                          風險: {getRiskLevelText(item.risk_level)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {item.summary || '無摘要'}
                      </p>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleString('zh-TW')}
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>

    </div>
  );
}
