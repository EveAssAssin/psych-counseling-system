import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SparklesIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  FireIcon,
  CalendarDaysIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { api } from '../services/api';
import toast from 'react-hot-toast';

// ============================================
// 型別
// ============================================
interface TopicItem { topic: string; count: number; percentage: number; examples: string[] }
interface RiskEmployee {
  employee_id: string; name: string; department?: string; store_name?: string;
  risk_level: 'high' | 'critical'; risk_signals: string[];
  negative_reviews: number; urgent_tickets: number; pending_reviews: number;
}
interface TimelineEvent { date: string; category: string; summary: string; count: number; significance: string }
interface DataStats {
  total_employees_involved: number; official_messages: number; tickets: number;
  reviews: { total: number; positive: number; negative: number; pending: number };
  conversations: number;
  by_day: Array<{ date: string; messages: number; tickets: number; reviews: number }>;
}
interface AnalysisResult {
  period: { start: string; end: string; days: number };
  target: 'all' | 'single';
  employee?: { id: string; name: string; department?: string };
  data_stats: DataStats;
  hot_topics: TopicItem[];
  risk_employees: RiskEmployee[];
  timeline_summary: TimelineEvent[];
  ai_summary: string;
  key_findings: string[];
  recommended_actions: string[];
  analyzed_at: string;
}

// ============================================
// 輔助元件
// ============================================
function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function TopicBar({ topic, count, percentage, rank }: { topic: string; count: number; percentage: number; rank: number }) {
  const rankColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-400', 'bg-blue-300'];
  const color = rankColors[rank] || 'bg-gray-300';
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-6 text-center text-sm font-bold text-gray-400">#{rank + 1}</span>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-800">{topic}</span>
          <span className="text-sm text-gray-500">{count} 次（{percentage}%）</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full">
          <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(percentage * 2, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// 主頁面
// ============================================
export default function PeriodAnalysisPage() {
  const today = new Date().toISOString().split('T')[0];
  const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(oneMonthAgo);
  const [endDate, setEndDate] = useState(today);
  const [targetMode, setTargetMode] = useState<'all' | 'single'>('all');
  const [employeeId, setEmployeeId] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_employeeSearch, _setEmployeeSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!startDate || !endDate) { toast.error('請選擇時間區段'); return; }
    if (new Date(startDate) > new Date(endDate)) { toast.error('開始日期不能晚於結束日期'); return; }
    if (targetMode === 'single' && !employeeId) { toast.error('請輸入員工編號或 UUID'); return; }

    setLoading(true);
    setResult(null);
    try {
      const body: any = { start_date: startDate, end_date: endDate };
      if (targetMode === 'single') body.employee_id = employeeId;
      const res = await api.post('/period-analysis', body);
      setResult(res.data);
      toast.success('分析完成');
    } catch (e: any) {
      toast.error('分析失敗：' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* 標題 */}
      <div className="flex items-center gap-3">
        <SparklesIcon className="h-7 w-7 text-primary-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">時段 AI 分析</h1>
          <p className="text-sm text-gray-500">指定時間區段，AI 彙整所有資料來源並產生洞察報告</p>
        </div>
      </div>

      {/* 條件設定 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
          分析條件
        </h2>

        {/* 時間區段 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">開始日期</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
          <span className="text-gray-400 mt-5">～</span>
          <div>
            <label className="block text-xs text-gray-500 mb-1">結束日期</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>

          {/* 快速選擇 */}
          <div className="flex gap-2 mt-5 flex-wrap">
            {[
              { label: '近 7 天', days: 7 },
              { label: '近 30 天', days: 30 },
              { label: '近 90 天', days: 90 },
            ].map(({ label, days }) => (
              <button key={days} onClick={() => {
                const end = new Date();
                const start = new Date(Date.now() - days * 86400000);
                setStartDate(start.toISOString().split('T')[0]);
                setEndDate(end.toISOString().split('T')[0]);
              }} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 分析對象 */}
        <div>
          <label className="block text-xs text-gray-500 mb-2">分析對象</label>
          <div className="flex gap-3">
            <button onClick={() => setTargetMode('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${targetMode === 'all' ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
              <UserGroupIcon className="h-4 w-4 inline mr-1.5" />全體員工
            </button>
            <button onClick={() => setTargetMode('single')}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${targetMode === 'single' ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
              單一員工
            </button>
          </div>

          {targetMode === 'single' && (
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">員工 UUID</label>
              <input value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                placeholder="請貼上員工 UUID"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-80 focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              <p className="text-xs text-gray-400 mt-1">可從員工管理頁面的網址列取得</p>
            </div>
          )}
        </div>

        {/* 執行按鈕 */}
        <button onClick={handleAnalyze} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm transition">
          {loading ? (
            <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />AI 分析中…</>
          ) : (
            <><SparklesIcon className="h-4 w-4" />開始分析</>
          )}
        </button>
      </div>

      {/* 分析結果 */}
      {result && (
        <div className="space-y-5">
          {/* 期間標題 */}
          <div className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-100 rounded-xl p-5">
            <p className="text-xs text-primary-600 font-medium mb-1">
              {result.target === 'single' && result.employee
                ? `${result.employee.name}（${result.employee.department || ''}）`
                : '全體員工'} · {result.period.start} ～ {result.period.end}（{result.period.days} 天）
            </p>
            <p className="text-gray-800 leading-relaxed">{result.ai_summary}</p>
            <p className="text-xs text-gray-400 mt-2">分析時間：{new Date(result.analyzed_at).toLocaleString('zh-TW')}</p>
          </div>

          {/* 資料量統計 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <ChartBarIcon className="h-4 w-4 text-gray-400" />資料量統計
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard icon="👥" label="涉及員工" value={result.data_stats.total_employees_involved} sub="人" />
              <StatCard icon="💬" label="LINE 訊息" value={result.data_stats.official_messages} sub="則" />
              <StatCard icon="🎫" label="工單" value={result.data_stats.tickets} sub="筆" />
              <StatCard icon="⭐" label="評價"
                value={result.data_stats.reviews.total}
                sub={`負評 ${result.data_stats.reviews.negative} · 待處理 ${result.data_stats.reviews.pending}`} />
              <StatCard icon="🗣" label="主管面談" value={result.data_stats.conversations} sub="筆" />
            </div>
          </div>

          {/* 主要發現 + 建議行動 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <FireIcon className="h-4 w-4 text-orange-500" />重要發現
              </h2>
              <ul className="space-y-2">
                {result.key_findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <SparklesIcon className="h-4 w-4 text-primary-500" />建議行動
              </h2>
              <ul className="space-y-2">
                {result.recommended_actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 text-primary-500">✓</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 熱門議題 */}
          {result.hot_topics.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FireIcon className="h-4 w-4 text-red-400" />熱門議題 Top {result.hot_topics.length}
                <span className="text-xs text-gray-400 font-normal">（依出現頻率排序）</span>
              </h2>
              <div className="divide-y divide-gray-50">
                {result.hot_topics.map((t, i) => (
                  <TopicBar key={i} rank={i} topic={t.topic} count={t.count} percentage={t.percentage} />
                ))}
              </div>
            </div>
          )}

          {/* 高風險員工名單（全體模式） */}
          {result.target === 'all' && result.risk_employees.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                需關注員工
                <span className="text-xs text-gray-400 font-normal">（本期量化訊號偏高）</span>
              </h2>
              <div className="space-y-3">
                {result.risk_employees.map(emp => (
                  <div key={emp.employee_id}
                    className={`flex items-start justify-between p-3 rounded-lg border ${emp.risk_level === 'critical' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${emp.risk_level === 'critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {emp.risk_level === 'critical' ? '⚠️ 特別關注' : '⚡ 需關注'}
                        </span>
                        <span className="font-medium text-gray-900">{emp.name}</span>
                        {emp.store_name && <span className="text-xs text-gray-500">{emp.store_name}</span>}
                      </div>
                      <div className="flex gap-3 text-xs text-gray-600">
                        {emp.negative_reviews > 0 && <span>負評 {emp.negative_reviews} 筆</span>}
                        {emp.urgent_tickets > 0 && <span>緊急工單 {emp.urgent_tickets} 筆</span>}
                        {emp.pending_reviews > 0 && <span>待處理評價 {emp.pending_reviews} 筆</span>}
                      </div>
                    </div>
                    <Link to={`/employees/${emp.employee_id}`}
                      className="text-xs text-primary-600 hover:text-primary-800 ml-4 flex-shrink-0">
                      查看員工 →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 週別時間軸 */}
          {result.timeline_summary.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CalendarDaysIcon className="h-4 w-4 text-gray-400" />週別事件摘要
              </h2>
              <div className="space-y-2">
                {result.timeline_summary.map((t, i) => (
                  <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${t.significance === 'high' ? 'bg-red-50' : t.significance === 'medium' ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                    <span className="text-xs font-medium text-gray-500 w-24 flex-shrink-0">{t.date}</span>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.significance === 'high' ? 'bg-red-400' : t.significance === 'medium' ? 'bg-yellow-400' : 'bg-gray-300'}`} />
                    <span className="text-sm text-gray-700 flex-1">{t.summary}</span>
                    <span className="text-xs text-gray-400">{t.count} 件</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
