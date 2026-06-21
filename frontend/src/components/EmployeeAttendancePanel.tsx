import { useEffect, useState } from 'react';
import { CalendarDaysIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { counselingApi } from '../services/api';

interface Day {
  workDate: string;
  attendanceResult: string;
  groupName?: string;
  dayOff?: { dayOffDate: string; groupName: string } | null;
  annualLeave?: { startTime: string; endTime: string; description: string } | null;
  leaveItems?: Array<{ leaveRuleTypeTitle: string; description: string; startTime: string; endTime: string }>;
  overTime?: { startTime: string; endTime: string; description: string } | null;
}

interface Props {
  appNumber: string;
}

/**
 * 顯示員工最近 30 天 + 未來 14 天的出勤摘要，重點放在「哪些日子放假」。
 * 資料來自左手 HRM API #28。
 */
export default function EmployeeAttendancePanel({ appNumber }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!appNumber) return;
    setLoading(true);
    setErr(null);
    counselingApi
      .getEmployeeAttendance(appNumber)
      .then((r) => {
        if (r.data?.success === false) {
          setErr(r.data.message || '取得失敗');
          setData(r.data);
        } else {
          setData(r.data);
        }
      })
      .catch((e: any) => {
        setErr(e?.response?.data?.message || e?.message || '查詢失敗');
      })
      .finally(() => setLoading(false));
  }, [appNumber]);

  if (!appNumber) return null;

  // 篩出休假類的日子
  const days: Day[] = data?.days || [];
  const offDays = days.filter((d) => {
    const r = d.attendanceResult || '';
    return r.includes('休') || r.includes('假') || (d.leaveItems && d.leaveItems.length > 0);
  });

  // 分組：過去 / 未來
  const today = new Date().toISOString().slice(0, 10);
  const pastOff = offDays.filter((d) => d.workDate < today);
  const futureOff = offDays.filter((d) => d.workDate >= today);

  return (
    <div className="card">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-primary-600" />
          <span className="font-medium text-gray-900">員工最近出勤 / 休假</span>
          {!loading && !err && (
            <span className="text-xs text-gray-500">
              已過去 {pastOff.length} 天放假 · 未來 {futureOff.length} 天放假
            </span>
          )}
          {loading && <span className="text-xs text-gray-400">載入中...</span>}
          {err && <span className="text-xs text-red-500">{err}</span>}
        </div>
        {expanded ? <ChevronUpIcon className="h-4 w-4 text-gray-400" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-4 text-sm">
          {loading ? (
            <div className="text-center text-gray-500 py-4">載入中...</div>
          ) : err ? (
            <div className="text-red-600 text-xs">
              {err}
              <p className="text-gray-500 mt-1">
                常見原因：員工 ERP ID 缺失 / 左手 API 連線失敗 / 此員工不在 HRM 系統內
              </p>
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-500 mb-3">
                期間：{data?.range?.start} ~ {data?.range?.end}（共 {days.length} 天）
              </div>

              {futureOff.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-primary-700 mb-1">⏭ 未來 14 天放假</p>
                  <ul className="space-y-1">
                    {futureOff.map((d) => (
                      <li key={d.workDate} className="flex items-baseline gap-2 text-xs">
                        <span className="font-mono text-gray-700">{d.workDate}</span>
                        <span className="px-1.5 py-0.5 rounded bg-warning-100 text-warning-800">{d.attendanceResult}</span>
                        {d.leaveItems && d.leaveItems.length > 0 && (
                          <span className="text-gray-600">
                            {d.leaveItems.map((l) => `${l.leaveRuleTypeTitle}${l.description ? '：' + l.description : ''}`).join(' / ')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pastOff.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">⏮ 過去 30 天放假</p>
                  <ul className="space-y-1">
                    {pastOff.slice(0, 15).map((d) => (
                      <li key={d.workDate} className="flex items-baseline gap-2 text-xs">
                        <span className="font-mono text-gray-700">{d.workDate}</span>
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{d.attendanceResult}</span>
                        {d.leaveItems && d.leaveItems.length > 0 && (
                          <span className="text-gray-600">
                            {d.leaveItems.map((l) => `${l.leaveRuleTypeTitle}${l.description ? '：' + l.description : ''}`).join(' / ')}
                          </span>
                        )}
                      </li>
                    ))}
                    {pastOff.length > 15 && (
                      <li className="text-xs text-gray-400">... 另有 {pastOff.length - 15} 天</li>
                    )}
                  </ul>
                </div>
              )}

              {pastOff.length === 0 && futureOff.length === 0 && (
                <div className="text-gray-500 text-xs">此期間內沒有休假紀錄</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
