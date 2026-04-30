import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UsersIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowPathIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { employeesApi, conversationsApi, riskFlagsApi, analysisApi, syncApi } from '../services/api';
import toast from 'react-hot-toast';

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
  const [loading, setLoading] = useState(true);
  const [syncingChannel, setSyncingChannel] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [empStats, convStats, riskStats, highRisk, syncStatusRes] = await Promise.all([
        employeesApi.getStats(),
        conversationsApi.getStats(),
        riskFlagsApi.getStats(),
        analysisApi.getHighRisk(5),
        syncApi.getStatus().catch(() => ({ data: null })),
      ]);

      setStats({
        employees: empStats.data,
        conversations: convStats.data,
        riskFlags: riskStats.data,
      });

      setHighRiskItems(highRisk.data);
      if (syncStatusRes.data) setSyncStatus(syncStatusRes.data);
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

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
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

        <div className="card p-5">
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

        <div className="card p-5">
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

        <div className="card p-5">
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

      {/* Sync Status */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">資料同步狀態</h3>
          </div>
          <button
            onClick={handleSyncOfficialChannel}
            disabled={syncingChannel}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowPathIcon className={`h-4 w-4 ${syncingChannel ? 'animate-spin' : ''}`} />
            {syncingChannel ? '同步中...' : '立即同步官方頻道'}
          </button>
        </div>
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

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/conversations/new"
          className="card p-5 hover:shadow-md transition-shadow"
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
          className="card p-5 hover:shadow-md transition-shadow"
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
          className="card p-5 hover:shadow-md transition-shadow"
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
  );
}
