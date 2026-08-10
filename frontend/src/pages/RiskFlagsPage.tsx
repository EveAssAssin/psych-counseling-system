import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { riskFlagsApi } from '../services/api';
import toast from 'react-hot-toast';

interface RiskEmployee {
  employee_id: string;
  name: string;
  store_name?: string | null;
  app_number?: string;
  is_active?: boolean;
  ai_flags: { severity: string; risk_type: string; title: string; created_at: string }[];
  ai_count: number;
  risk_tags: string[];
  has_ai: boolean;
  has_counselor: boolean;
}

type Filter = 'all' | 'ai' | 'counselor' | 'both';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'ai', label: 'AI 標記' },
  { key: 'counselor', label: '輔導員標記' },
  { key: 'both', label: 'AI＋輔導員' },
];

const severityBadge = (s: string) => {
  const m: Record<string, string> = {
    low: 'badge-low', moderate: 'badge-moderate', high: 'badge-high', critical: 'badge-critical',
  };
  return m[s] || 'badge-low';
};
// 取員工 AI 標記中最高的嚴重度
const topSeverity = (flags: RiskEmployee['ai_flags']): string | null => {
  const order = ['critical', 'high', 'moderate', 'low'];
  for (const lv of order) if (flags.some((f) => f.severity === lv)) return lv;
  return null;
};

export default function RiskFlagsPage() {
  const [rows, setRows] = useState<RiskEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await riskFlagsApi.getEmployees();
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      toast.error('載入風險標記失敗（後端需已部署並執行 migration 025）');
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => ({
    all: rows.length,
    ai: rows.filter((r) => r.has_ai).length,
    counselor: rows.filter((r) => r.has_counselor).length,
    both: rows.filter((r) => r.has_ai && r.has_counselor).length,
  }), [rows]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'ai': return rows.filter((r) => r.has_ai);
      case 'counselor': return rows.filter((r) => r.has_counselor);
      case 'both': return rows.filter((r) => r.has_ai && r.has_counselor);
      default: return rows;
    }
  }, [rows, filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">風險標記</h1>
        <p className="mt-1 text-sm text-gray-500">以員工為單位彙整 AI 與輔導員的風險標記</p>
      </div>

      {/* 篩選器 */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            此分類目前沒有風險標記 🎉
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filtered.map((r) => {
              const sev = topSeverity(r.ai_flags);
              return (
                <li key={r.employee_id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link to={`/employees/${r.employee_id}`}
                              className="text-sm font-medium text-gray-900 hover:text-primary-600">
                          {r.name}
                        </Link>
                        {r.store_name && <span className="text-xs text-gray-400">· {r.store_name}</span>}
                        {r.is_active === false && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">已離職</span>
                        )}
                      </div>

                      {/* 標記來源 */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {r.has_ai && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                            AI 標記 {r.ai_count}
                            {sev && <span className={`ml-1 ${severityBadge(sev)}`}>{sev}</span>}
                          </span>
                        )}
                        {r.has_counselor && r.risk_tags.map((t) => (
                          <span key={t} className="inline-flex items-center rounded-full border border-danger-200 bg-danger-50 px-2 py-0.5 text-xs text-danger-700">
                            {t}
                          </span>
                        ))}
                        {r.has_ai && r.has_counselor && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            兩者皆有
                          </span>
                        )}
                      </div>

                      {/* AI 標記細項 */}
                      {r.has_ai && (
                        <ul className="mt-2 space-y-1">
                          {r.ai_flags.slice(0, 3).map((f, i) => (
                            <li key={i} className="text-xs text-gray-500">
                              <span className={severityBadge(f.severity)}>{f.severity}</span>
                              <span className="ml-2 text-gray-400">{f.risk_type}</span>
                              <span className="ml-2 text-gray-700">{f.title}</span>
                            </li>
                          ))}
                          {r.ai_flags.length > 3 && (
                            <li className="text-xs text-gray-400">還有 {r.ai_flags.length - 3} 筆…</li>
                          )}
                        </ul>
                      )}
                    </div>
                    <Link to={`/employees/${r.employee_id}`}
                          className="shrink-0 text-xs text-primary-600 hover:text-primary-500">
                      查看員工 →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
