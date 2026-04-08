import { useState, useEffect, useCallback } from 'react';
import {
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import { syncApi } from '../services/api';
import toast from 'react-hot-toast';

// 資料源定義
interface DataSource {
  id: string;
  name: string;
  description: string;
  syncType: string;         // sync_logs 中的 sync_type
  cursorKeys: string[];     // sync_cursors 中的 key
  triggerFn: () => Promise<any>;
  schedule: string;         // 排程說明
  icon: string;             // emoji icon
}

const DATA_SOURCES: DataSource[] = [
  {
    id: 'employees',
    name: '員工主檔',
    description: '從左手系統 API 同步員工基本資料（姓名、門市、職稱等）',
    syncType: 'employee_full',
    cursorKeys: [],
    triggerFn: () => syncApi.syncEmployees(),
    schedule: '每日 05:00 / 每月 5 日 04:00',
    icon: '👥',
  },
  {
    id: 'official-channel',
    name: '官方頻道訊息',
    description: '從工單系統同步 LINE 官方帳號訊息與工單留言',
    syncType: 'official_channel',
    cursorKeys: ['official-channel-line', 'official-channel-comments'],
    triggerFn: () => syncApi.syncOfficialChannel(),
    schedule: '每日 05:30',
    icon: '💬',
  },
  {
    id: 'ticket-history',
    name: '工單回報歷史',
    description: '從工單系統同步員工提報的工單紀錄（含對話時間軸）',
    syncType: 'ticket_history',
    cursorKeys: ['ticket-history'],
    triggerFn: () => syncApi.syncTicketHistory(),
    schedule: '每日 06:00',
    icon: '🎫',
  },
  {
    id: 'review-data',
    name: '評價/客訴資料',
    description: '同步客戶評價、負評客訴、回覆對話紀錄及處理速度追蹤',
    syncType: 'review_sync',
    cursorKeys: ['review-data'],
    triggerFn: () => syncApi.syncReviewData(),
    schedule: '每日 06:30',
    icon: '⭐',
  },
  {
    id: 'daily',
    name: '每日資料同步',
    description: '多來源每日增量資料同步',
    syncType: 'external_daily',
    cursorKeys: [],
    triggerFn: () => syncApi.syncDaily(),
    schedule: '每日 07:00',
    icon: '📊',
  },
];

interface SyncLog {
  id: string;
  sync_type: string;
  source_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  total_fetched: number;
  total_created: number;
  total_updated: number;
  total_skipped: number;
  total_failed: number;
  error_message: string | null;
  error_details: any;
  triggered_by: string | null;
  trigger_type: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '從未同步';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return '剛剛';
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  if (diffHour < 24) return `${diffHour} 小時前`;
  return `${diffDay} 天前`;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: any; label: string }> = {
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon, label: '成功' },
    partial: { color: 'bg-yellow-100 text-yellow-800', icon: ExclamationTriangleIcon, label: '部分成功' },
    failed: { color: 'bg-red-100 text-red-800', icon: XCircleIcon, label: '失敗' },
    running: { color: 'bg-blue-100 text-blue-800', icon: ArrowPathIcon, label: '執行中' },
    started: { color: 'bg-blue-100 text-blue-800', icon: ArrowPathIcon, label: '啟動中' },
  };
  const c = config[status] || { color: 'bg-gray-100 text-gray-800', icon: ClockIcon, label: status };
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.color}`}>
      <Icon className={`h-3.5 w-3.5 ${status === 'running' ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}

function DataSourceCard({
  source,
  logs,
  cursors,
  onSync,
}: {
  source: DataSource;
  logs: SyncLog[];
  cursors: Record<string, any>;
  onSync: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const sourceLogs = logs.filter((l) => l.sync_type === source.syncType);
  const latestLog = sourceLogs[0];

  // 計算最後同步時間
  const lastSyncTime = latestLog?.finished_at || latestLog?.started_at || null;

  // 計算總同步數量
  const cursorTotal = source.cursorKeys.reduce((sum, key) => {
    return sum + (cursors[key]?.total_synced || 0);
  }, 0);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    toast.loading(`正在同步 ${source.name}...`, { id: `sync-${source.id}` });

    try {
      const res = await source.triggerFn();
      const result = res.data;
      toast.success(
        `${source.name} 同步完成！新增 ${result.total_created || 0}，更新 ${result.total_updated || 0}`,
        { id: `sync-${source.id}`, duration: 5000 },
      );
      onSync();
    } catch (error: any) {
      toast.error(error.response?.data?.message || `${source.name} 同步失敗`, {
        id: `sync-${source.id}`,
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{source.icon}</span>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{source.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{source.description}</p>
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '同步中...' : '立即同步'}
          </button>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">最後同步</p>
            <p className="text-sm font-medium text-gray-900">{formatRelativeTime(lastSyncTime)}</p>
            <p className="text-xs text-gray-400">{formatDateTime(lastSyncTime)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">最近狀態</p>
            {latestLog ? <StatusBadge status={latestLog.status} /> : <span className="text-sm text-gray-400">-</span>}
          </div>
          <div>
            <p className="text-xs text-gray-500">排程時間</p>
            <p className="text-sm font-medium text-gray-900">{source.schedule}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">累計同步</p>
            <p className="text-sm font-medium text-gray-900">
              {cursorTotal > 0 ? `${cursorTotal} 筆` : latestLog ? `${latestLog.total_fetched} 筆 (最近)` : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-2 bg-gray-50 hover:bg-gray-100 text-sm text-gray-600 border-t border-gray-200"
      >
        {expanded ? (
          <>
            <ChevronUpIcon className="h-4 w-4" /> 收起歷史日誌
          </>
        ) : (
          <>
            <ChevronDownIcon className="h-4 w-4" /> 展開歷史日誌 ({sourceLogs.length} 筆)
          </>
        )}
      </button>

      {/* Expanded logs */}
      {expanded && (
        <div className="border-t border-gray-200">
          {sourceLogs.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 text-center">尚無同步紀錄</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">時間</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">狀態</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">抓取</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">新增</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">更新</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">失敗</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">觸發</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">耗時</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sourceLogs.map((log) => {
                    const duration =
                      log.started_at && log.finished_at
                        ? Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                        : null;
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {formatDateTime(log.started_at)}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={log.status} />
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-900 text-right">{log.total_fetched}</td>
                        <td className="px-4 py-2 text-xs text-green-600 text-right font-medium">
                          {log.total_created > 0 ? `+${log.total_created}` : '-'}
                        </td>
                        <td className="px-4 py-2 text-xs text-blue-600 text-right font-medium">
                          {log.total_updated > 0 ? log.total_updated : '-'}
                        </td>
                        <td className="px-4 py-2 text-xs text-right font-medium">
                          {log.total_failed > 0 ? (
                            <span className="text-red-600">{log.total_failed}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {log.trigger_type === 'manual' ? '手動' : '排程'}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                          {duration !== null ? `${duration}s` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DataManagementPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [cursors, setCursors] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [logsRes, statusRes] = await Promise.all([
        syncApi.getLogs(100),
        syncApi.getStatus(),
      ]);
      setLogs(logsRes.data);
      setCursors(statusRes.data.cursors || {});
    } catch (error) {
      console.error('Failed to fetch sync data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // 每 30 秒自動重新整理
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // 總覽統計
  const totalSources = DATA_SOURCES.length;
  const recentFailures = logs.filter(
    (l) => l.status === 'failed' && new Date(l.started_at) > new Date(Date.now() - 24 * 60 * 60 * 1000),
  ).length;
  const todayLogs = logs.filter(
    (l) => new Date(l.started_at).toDateString() === new Date().toDateString(),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Cog6ToothIcon className="h-7 w-7 text-primary-600" />
            資料管理
          </h1>
          <p className="mt-1 text-sm text-gray-500">管理各資料源的同步狀態、排程、手動觸發與歷史日誌</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
        >
          <ArrowPathIcon className="h-4 w-4" />
          重新整理
        </button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <SignalIcon className="h-5 w-5 text-primary-600" />
            <p className="text-sm font-medium text-gray-500">資料源總數</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900">{totalSources}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-blue-600" />
            <p className="text-sm font-medium text-gray-500">今日同步次數</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900">{todayLogs.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className={`h-5 w-5 ${recentFailures > 0 ? 'text-red-600' : 'text-green-600'}`} />
            <p className="text-sm font-medium text-gray-500">24h 內失敗</p>
          </div>
          <p className={`mt-2 text-3xl font-bold ${recentFailures > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {recentFailures}
          </p>
        </div>
      </div>

      {/* Data source cards */}
      <div className="space-y-4">
        {DATA_SOURCES.map((source) => (
          <DataSourceCard
            key={source.id}
            source={source}
            logs={logs}
            cursors={cursors}
            onSync={fetchData}
          />
        ))}
      </div>
    </div>
  );
}
