import { useEffect, useState } from 'react';
import { AcademicCapIcon } from '@heroicons/react/24/outline';
import { employeesApi } from '../services/api';

interface Props {
  appNumber: string;
  erpid?: string;
}

// 依層級給不同底色（與 LMS TIER_NAMES 0~3 對應）
const TIER_COLORS: Record<number, string> = {
  0: 'bg-gray-100 text-gray-700',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-indigo-100 text-indigo-700',
  3: 'bg-purple-100 text-purple-700',
};

// 課程狀態 → 中文標籤與底色
const STATUS_LABEL: Record<string, string> = {
  available: '可開始',
  in_progress: '進行中',
  pending_confirm: '待確認',
  done: '已完成',
  locked: '未解鎖',
};
const STATUS_CLASS: Record<string, string> = {
  done: 'bg-green-100 text-green-700',
  pending_confirm: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  available: 'bg-gray-100 text-gray-600',
  locked: 'bg-gray-100 text-gray-400',
};

const fmtDate = (s?: string | null) => (s ? String(s).slice(0, 10) : '-');

/**
 * 教育訓練分頁
 * 上方摘要（層級 + 進度）走 learning-progress（app_number，可靠）。
 * 下方課程明細與層級考試成績走 employee-training（erpid）。
 */
export default function TrainingProgressTab({ appNumber, erpid }: Props) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [s, d] = await Promise.allSettled([
          employeesApi.getLearningProgress(appNumber),
          erpid ? employeesApi.getEmployeeTraining(erpid) : Promise.resolve(null),
        ]);
        if (!alive) return;
        setSummary(s.status === 'fulfilled' && s.value ? s.value.data : { available: false, reason: 'error' });
        setDetail(d.status === 'fulfilled' && d.value ? d.value.data : null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [appNumber, erpid]);

  if (loading) return <p className="text-sm text-gray-500">載入中…</p>;
  if (!summary) return <p className="text-sm text-gray-500">無法取得教育訓練資料。</p>;

  if (!summary.available) {
    const msg =
      summary.reason === 'not_configured'
        ? '教育訓練系統尚未完成串接設定。'
        : '目前無法連線教育訓練系統。';
    return <p className="text-sm text-gray-500">{msg}</p>;
  }
  if (summary.found === false) {
    return (
      <p className="text-sm text-gray-500">
        教育訓練系統查無此員工（app_number: {appNumber}）。
      </p>
    );
  }
  if (summary.has_enrollment === false) {
    return <p className="text-sm text-gray-500">此員工目前沒有教育訓練報名紀錄。</p>;
  }

  const tier = summary.current_tier ?? 0;
  const pct = summary.progress_percent ?? 0;
  const tierColor = TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-700';

  // detail 可能不可用（無 erpid / 未設定 / 查無）
  const courses: any[] = detail?.available && Array.isArray(detail.courses) ? detail.courses : [];
  const exams: any[] = detail?.available && Array.isArray(detail.exams) ? detail.exams : [];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 摘要 */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${tierColor}`}
          >
            <AcademicCapIcon className="h-4 w-4" />
            Tier {tier}・{summary.tier_name}
          </span>
          {summary.track_name && <span className="text-sm text-gray-500">{summary.track_name}</span>}
        </div>
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>學習進度</span>
            <span>
              {summary.completed_items}/{summary.total_items} 項・{pct}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 課程明細 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">課程明細</h3>
        {!erpid ? (
          <p className="text-sm text-gray-400">此員工缺少 ERP 編號，無法取得課程明細。</p>
        ) : !detail?.available ? (
          <p className="text-sm text-gray-400">目前無法取得課程明細。</p>
        ) : courses.length === 0 ? (
          <p className="text-sm text-gray-400">尚無課程資料。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b">
                  <th className="py-2 pr-4 font-medium">課程</th>
                  <th className="py-2 pr-4 font-medium">層</th>
                  <th className="py-2 pr-4 font-medium">狀態</th>
                  <th className="py-2 font-medium">完成日期</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4">{c.title}</td>
                    <td className="py-2 pr-4 text-gray-500">{c.tier_name ?? '-'}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs ${
                          STATUS_CLASS[c.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">{fmtDate(c.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 層級考試成績 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">層級考試成績</h3>
        {!erpid ? (
          <p className="text-sm text-gray-400">此員工缺少 ERP 編號，無法取得成績。</p>
        ) : !detail?.available ? (
          <p className="text-sm text-gray-400">目前無法取得成績。</p>
        ) : exams.length === 0 ? (
          <p className="text-sm text-gray-400">尚無考試成績。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b">
                  <th className="py-2 pr-4 font-medium">層級</th>
                  <th className="py-2 pr-4 font-medium">分數</th>
                  <th className="py-2 pr-4 font-medium">結果</th>
                  <th className="py-2 font-medium">考試日期</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4">{e.tier_name}</td>
                    <td className="py-2 pr-4">{e.score ?? '-'}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs ${
                          e.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {e.passed ? '通過' : '未通過'}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">{fmtDate(e.examined_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">資料來源：教育訓練 LMS</p>
    </div>
  );
}
