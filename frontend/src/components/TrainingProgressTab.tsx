import { useEffect, useState } from 'react';
import { AcademicCapIcon } from '@heroicons/react/24/outline';
import { employeesApi } from '../services/api';

interface Props {
  appNumber: string;
}

// 依層級給不同底色（與 LMS TIER_NAMES 0~3 對應）
const TIER_COLORS: Record<number, string> = {
  0: 'bg-gray-100 text-gray-700',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-indigo-100 text-indigo-700',
  3: 'bg-purple-100 text-purple-700',
};

/**
 * 教育訓練學習進度分頁
 * 呼叫本後端中介 API（/employees/learning-progress/:appnumber），
 * 後端再代查 LMS，顯示員工目前學習層級（current_tier）與進度百分比。
 */
export default function TrainingProgressTab({ appNumber }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const r = await employeesApi.getLearningProgress(appNumber);
        if (alive) setData(r.data);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [appNumber]);

  if (loading) return <p className="text-sm text-gray-500">載入中…</p>;
  if (error || !data) return <p className="text-sm text-gray-500">無法取得教育訓練資料。</p>;

  if (!data.available) {
    const msg =
      data.reason === 'not_configured'
        ? '教育訓練系統尚未完成串接設定。'
        : '目前無法連線教育訓練系統。';
    return <p className="text-sm text-gray-500">{msg}</p>;
  }
  if (data.found === false) {
    return (
      <p className="text-sm text-gray-500">
        教育訓練系統查無此員工（app_number: {appNumber}）。
      </p>
    );
  }
  if (data.has_enrollment === false) {
    return <p className="text-sm text-gray-500">此員工目前沒有教育訓練報名紀錄。</p>;
  }

  const tier = data.current_tier ?? 0;
  const pct = data.progress_percent ?? 0;
  const tierColor = TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${tierColor}`}
        >
          <AcademicCapIcon className="h-4 w-4" />
          Tier {tier}・{data.tier_name}
        </span>
        {data.track_name && <span className="text-sm text-gray-500">{data.track_name}</span>}
      </div>

      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>學習進度</span>
          <span>
            {data.completed_items}/{data.total_items} 項・{pct}%
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-gray-400">狀態</dt>
          <dd className="font-medium">{data.status ?? '-'}</dd>
        </div>
        {data.title_text && (
          <div>
            <dt className="text-gray-400">稱號</dt>
            <dd className="font-medium">{data.title_text}</dd>
          </div>
        )}
      </dl>

      <p className="text-xs text-gray-400">資料來源：教育訓練 LMS</p>
    </div>
  );
}
