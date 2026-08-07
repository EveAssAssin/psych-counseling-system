import { useEffect, useMemo, useState } from 'react';
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

interface MonthSummary {
  month: string;      // YYYY-MM
  label: string;      // 例如 2026年8月
  work: number;       // 出勤天數
  off: number;        // 排休
  personal: number;   // 事假
  sick: number;       // 病假
  annual: number;     // 特休
  official: number;   // 公假
  otherLeave: number; // 其他假
  overtimeMin: number; // 加班分鐘
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 從時間字串抓 HH:mm → 分鐘
function toMinutes(t?: string): number | null {
  if (!t) return null;
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
function overtimeMinutes(ot?: { startTime: string; endTime: string } | null): number {
  if (!ot) return 0;
  const s = toMinutes(ot.startTime);
  const e = toMinutes(ot.endTime);
  if (s == null || e == null) return 0;
  const diff = e - s;
  return diff > 0 ? diff : 0;
}
function fmtHM(min: number): string {
  if (!min) return '0';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} 小時${m ? ` ${m} 分` : ''}` : `${m} 分`;
}

/**
 * 員工出勤 / 休假：以「月份」為單位的統計摘要。
 * 資料來自左手 HRM API #28（含 排休/上班/各類假別/加班）。
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
    // 取「上個月 1 號 ~ 這個月底」，讓月統計較完整
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    counselingApi
      .getEmployeeAttendance(appNumber, { start_date: fmtDate(start), end_date: fmtDate(end) })
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

  const months = useMemo<MonthSummary[]>(() => {
    const days: Day[] = data?.days || [];
    const map = new Map<string, MonthSummary>();
    const get = (ym: string): MonthSummary => {
      if (!map.has(ym)) {
        const [y, m] = ym.split('-');
        map.set(ym, {
          month: ym, label: `${y}年${Number(m)}月`,
          work: 0, off: 0, personal: 0, sick: 0, annual: 0, official: 0, otherLeave: 0, overtimeMin: 0,
        });
      }
      return map.get(ym)!;
    };
    for (const d of days) {
      if (!d.workDate) continue;
      const ym = String(d.workDate).slice(0, 7);
      const s = get(ym);
      const r = d.attendanceResult || '';
      if (r.includes('上班')) s.work++;
      if (d.dayOff || r.includes('排休')) s.off++;
      if (d.annualLeave) s.annual++;
      for (const l of d.leaveItems || []) {
        const t = l.leaveRuleTypeTitle || '';
        if (t.includes('事假')) s.personal++;
        else if (t.includes('病假')) s.sick++;
        else if (t.includes('特休') || t.includes('年假')) s.annual++;
        else if (t.includes('公假')) s.official++;
        else s.otherLeave++;
      }
      s.overtimeMin += overtimeMinutes(d.overTime);
    }
    return Array.from(map.values()).sort((a, b) => (a.month > b.month ? -1 : 1));
  }, [data]);

  if (!appNumber) return null;

  const latest = months[0];

  return (
    <div className="card">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-primary-600" />
          <span className="font-medium text-gray-900">員工出勤 / 休假（月統計）</span>
          {!loading && !err && latest && (
            <span className="text-xs text-gray-500">
              {latest.label}：出勤 {latest.work} 天 · 排休 {latest.off}
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
          ) : months.length === 0 ? (
            <div className="text-gray-500 text-xs">此期間內沒有出勤資料</div>
          ) : (
            <>
              <div className="text-xs text-gray-500 mb-3">
                期間：{data?.range?.start} ~ {data?.range?.end}
              </div>
              <div className="space-y-3">
                {months.map((m) => (
                  <div key={m.month} className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-gray-900">{m.label}</span>
                      <span className="text-xs text-gray-500">出勤 {m.work} 天</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
                      <span>排休 <b>{m.off}</b></span>
                      <span>事假 <b>{m.personal}</b></span>
                      <span>病假 <b>{m.sick}</b></span>
                      <span>特休 <b>{m.annual}</b></span>
                      <span>公假 <b>{m.official}</b></span>
                      {m.otherLeave > 0 && <span>其他假 <b>{m.otherLeave}</b></span>}
                      <span>加班 <b>{fmtHM(m.overtimeMin)}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
