import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, ChatBubbleLeftRightIcon, TicketIcon, SparklesIcon, StarIcon, AcademicCapIcon } from '@heroicons/react/24/outline';
import { employeesApi, conversationsApi, analysisApi, officialChannelApi, achievementsApi } from '../services/api';
import { EmployeeInsightTab } from '../components/EmployeeInsightTab';
import EmployeeAttendancePanel from '../components/EmployeeAttendancePanel';
import TrainingProgressTab from '../components/TrainingProgressTab';
import toast from 'react-hot-toast';

const JOB_TAGS = ['店長', '副店長', '正職', '新人'];
const RISK_TAGS = ['危險', '準淘汰', '高關注'];
const RECORD_TYPES = ['事實', '感受'];
const FACT_CATEGORIES = ['表揚', '懲處', '事件', '貢獻', '爭議'];
const hasData = (s: string) => /[0-9０-９]/.test(s || '');
const todayStr = () => new Date().toISOString().slice(0, 10);

// 由入職日推算年資（無入職日時回傳 '-'）。目前資料來源尚未提供入職日，故多為 '-'。
const tenureText = (hireDate?: string): string => {
  if (!hireDate) return '-';
  const start = new Date(hireDate);
  if (isNaN(start.getTime())) return '-';
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) return '-';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y > 0 ? `${y} 年` : ''}${m > 0 ? `${m} 個月` : ''}` || '未滿 1 個月';
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<any>(null);
  const [jobTags, setJobTags] = useState<string[]>([]);
  const [savingJob, setSavingJob] = useState(false);
  const [riskTags, setRiskTags] = useState<string[]>([]);
  const [savingRisk, setSavingRisk] = useState(false);
  const [hireDate, setHireDate] = useState('');
  const [expectedResignDate, setExpectedResignDate] = useState('');
  const [savingDates, setSavingDates] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<any>(null);
  const [officialMessages, setOfficialMessages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'insight' | 'conversations' | 'achievements' | 'official' | 'training'>('insight');
  const [achievements, setAchievements] = useState<any[]>([]);
  const [showAchForm, setShowAchForm] = useState(false);
  const [achForm, setAchForm] = useState({ record_type: '事實', title: '', content: '', record_date: todayStr(), category: '' });
  const [savingAch, setSavingAch] = useState(false);
  const [feelingTags, setFeelingTags] = useState<any[]>([]);
  const [newFeeling, setNewFeeling] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadAchievements = async () => {
    if (!id) return;
    try {
      const r = await achievementsApi.listByEmployee(id);
      setAchievements(Array.isArray(r.data) ? r.data : r.data?.data ?? []);
    } catch { setAchievements([]); }
    try {
      const r = await achievementsApi.listFeelingTags();
      setFeelingTags(Array.isArray(r.data) ? r.data : r.data?.data ?? []);
    } catch { /* 字典非關鍵 */ }
  };
  useEffect(() => { loadAchievements(); }, [id]);

  const addFeelingTag = async () => {
    const name = newFeeling.trim();
    if (!name) return;
    try {
      const r = await achievementsApi.createFeelingTag(name);
      setFeelingTags((prev) => (prev.some((t) => t.id === r.data.id) ? prev : [...prev, r.data]));
      setAchForm((f) => ({ ...f, category: r.data.name }));
      setNewFeeling('');
    } catch (e: any) {
      toast.error(e.response?.data?.message || '新增標籤失敗');
    }
  };

  const saveAchievement = async () => {
    if (!achForm.title.trim() || !achForm.content.trim() || !achForm.record_date) {
      toast.error('請填標題、內容與日期');
      return;
    }
    // 事實防呆：內容需含數據
    if (achForm.record_type === '事實' && !hasData(achForm.content)) {
      toast.error('「事實」需要數據佐證：內容必須包含具體數據（數字）。');
      return;
    }
    setSavingAch(true);
    try {
      await achievementsApi.create({
        employee_id: id!,
        record_type: achForm.record_type,
        title: achForm.title.trim(),
        content: achForm.content.trim(),
        record_date: achForm.record_date,
        category: achForm.category || undefined,
      });
      toast.success('事蹟已新增。');
      setAchForm({ record_type: '事實', title: '', content: '', record_date: todayStr(), category: '' });
      setShowAchForm(false);
      loadAchievements();
    } catch (e: any) {
      toast.error(e.response?.data?.message || '新增失敗（後端需部署並執行 migration 022/023）');
    } finally {
      setSavingAch(false);
    }
  };
  const removeAchievement = async (aid: string) => {
    if (!window.confirm('確定刪除這筆事蹟？')) return;
    try {
      await achievementsApi.delete(aid);
      setAchievements((prev) => prev.filter((x) => x.id !== aid));
      toast.success('已刪除。');
    } catch (e: any) {
      toast.error(e.response?.data?.message || '刪除失敗');
    }
  };

  const loadData = async () => {
    try {
      const [empRes, convRes, analysisRes] = await Promise.all([
        employeesApi.getById(id!),
        conversationsApi.getByEmployee(id!),
        analysisApi.getLatestByEmployee(id!),
      ]);
      setEmployee(empRes.data);
      setJobTags(Array.isArray(empRes.data?.job_tags) ? empRes.data.job_tags : []);
      setRiskTags(Array.isArray(empRes.data?.risk_tags) ? empRes.data.risk_tags : []);
      setHireDate(empRes.data?.hire_date ? String(empRes.data.hire_date).slice(0, 10) : '');
      setExpectedResignDate(empRes.data?.expected_resignation_date ? String(empRes.data.expected_resignation_date).slice(0, 10) : '');
      setConversations(convRes.data);
      setLatestAnalysis(analysisRes.data?.found !== false ? analysisRes.data : null);

      // 載入官方頻道訊息
      try {
        const msgRes = await officialChannelApi.getByEmployeeId(id!, 100);
        setOfficialMessages(msgRes.data || []);
      } catch (e) {
        console.log('No official channel messages');
        setOfficialMessages([]);
      }
    } catch (error) {
      toast.error('載入員工資料失敗');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!employee) {
    return <div className="text-center py-8">找不到員工資料</div>;
  }

  const getRiskBadge = (level?: string) => {
    const badges: Record<string, string> = {
      low: 'badge-low',
      moderate: 'badge-moderate',
      high: 'badge-high',
      critical: 'badge-critical',
    };
    return badges[level || ''] || 'badge-low';
  };

  const getChannelLabel = (channel: string) => {
    return channel === 'official-line' ? 'LINE 訊息' : '工單留言';
  };

  const getDirectionLabel = (direction: string) => {
    const labels: Record<string, string> = {
      inbound: '員工',
      store: '門市',
      engineer: '工程師',
      reviewer: '審核人員',
    };
    return labels[direction] || direction;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/employees" className="text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{employee.name}</h1>
          <p className="text-sm text-gray-500">{employee.employeeappnumber}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 員工資訊 */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">基本資訊</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">部門</dt>
              <dd className="text-sm font-medium">{employee.department || employee.groupname || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">門市</dt>
              <dd className="text-sm font-medium">{employee.store_name || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">職稱</dt>
              <dd className="text-sm font-medium">{employee.title || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 mb-1">到職日</dt>
              <dd>
                <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)}
                       className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                <p className="mt-1 text-xs text-gray-500">年資：{tenureText(hireDate)}</p>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 mb-1">預計離職日</dt>
              <dd>
                <input type="date" value={expectedResignDate} onChange={(e) => setExpectedResignDate(e.target.value)}
                       className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                <button type="button" disabled={savingDates}
                  onClick={async () => {
                    setSavingDates(true);
                    try {
                      const patch = {
                        hire_date: hireDate || null,
                        expected_resignation_date: expectedResignDate || null,
                      };
                      await employeesApi.update(id!, patch as any);
                      setEmployee((e: any) => ({ ...e, ...patch }));
                      toast.success('日期已更新。');
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || '更新失敗（後端需已部署並執行 migration 026）');
                    } finally {
                      setSavingDates(false);
                    }
                  }}
                  className="mt-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                  {savingDates ? '儲存中…' : '儲存到職日／預計離職日'}
                </button>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">狀態</dt>
              <dd>
                <span className={employee.is_active ? 'badge-low' : 'badge-high'}>
                  {employee.is_active ? '在職' : '離職'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 mb-1">職稱標籤（可多選）</dt>
              <dd>
                <div className="flex flex-wrap gap-2">
                  {JOB_TAGS.map((t) => {
                    const selected = jobTags.includes(t);
                    return (
                      <button key={t} type="button"
                        onClick={() => setJobTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
                          selected ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}>
                        {t}
                      </button>
                    );
                  })}
                </div>
                <button type="button" disabled={savingJob}
                  onClick={async () => {
                    setSavingJob(true);
                    try {
                      await employeesApi.update(id!, { job_tags: jobTags });
                      setEmployee((e: any) => ({ ...e, job_tags: jobTags }));
                      toast.success('職稱標籤已更新。');
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || '更新失敗（後端需已部署並執行 migration 020）');
                    } finally {
                      setSavingJob(false);
                    }
                  }}
                  className="mt-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                  {savingJob ? '儲存中…' : '儲存職稱標籤'}
                </button>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 mb-1">風險標記（可多選）</dt>
              <dd>
                <div className="flex flex-wrap gap-2">
                  {RISK_TAGS.map((t) => {
                    const selected = riskTags.includes(t);
                    return (
                      <button key={t} type="button"
                        onClick={() => setRiskTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
                          selected ? 'border-danger-400 bg-danger-50 text-danger-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}>
                        {t}
                      </button>
                    );
                  })}
                </div>
                <button type="button" disabled={savingRisk}
                  onClick={async () => {
                    setSavingRisk(true);
                    try {
                      await employeesApi.update(id!, { risk_tags: riskTags });
                      setEmployee((e: any) => ({ ...e, risk_tags: riskTags }));
                      toast.success('風險標記已更新。');
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || '更新失敗（後端需已部署並執行 migration 025）');
                    } finally {
                      setSavingRisk(false);
                    }
                  }}
                  className="mt-2 rounded-md bg-danger-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-danger-700 disabled:opacity-50">
                  {savingRisk ? '儲存中…' : '儲存風險標記'}
                </button>
              </dd>
            </div>
          </dl>
        </div>

        {/* 最新分析 */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-900 mb-4">最新分析結果</h2>
          {latestAnalysis ? (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div>
                  <span className="text-sm text-gray-500">風險等級</span>
                  <div className={getRiskBadge(latestAnalysis.risk_level)}>
                    {latestAnalysis.risk_level}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">壓力等級</span>
                  <div className={getRiskBadge(latestAnalysis.stress_level)}>
                    {latestAnalysis.stress_level}
                  </div>
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-500">心理狀態</span>
                <p className="text-sm mt-1">{latestAnalysis.current_psychological_state}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">摘要</span>
                <p className="text-sm mt-1">{latestAnalysis.summary}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">尚無分析記錄</p>
          )}
        </div>
      </div>

      {/* 本月出勤 / 休假摘要 */}
      {employee.employeeappnumber && (
        <EmployeeAttendancePanel appNumber={employee.employeeappnumber} />
      )}

      {/* Tab 切換 */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('insight')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'insight'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <SparklesIcon className="h-4 w-4 inline mr-2" />
              AI 分析
            </button>
            <button
              onClick={() => setActiveTab('conversations')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'conversations'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4 inline mr-2" />
              對話記錄 ({conversations.length})
            </button>
            <button
              onClick={() => setActiveTab('achievements')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'achievements'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <StarIcon className="h-4 w-4 inline mr-2" />
              事蹟紀錄 ({achievements.length})
            </button>
            <button
              onClick={() => setActiveTab('official')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'official'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TicketIcon className="h-4 w-4 inline mr-2" />
              官方頻道訊息 ({officialMessages.length})
            </button>
            <button
              onClick={() => setActiveTab('training')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'training'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <AcademicCapIcon className="h-4 w-4 inline mr-2" />
              教育訓練
            </button>
          </nav>
        </div>

        {/* AI 分析 Tab */}
        {activeTab === 'insight' && (
          <div className="p-6">
            <EmployeeInsightTab 
              employeeAppNumber={employee.employeeappnumber} 
              employeeName={employee.name}
            />
          </div>
        )}

        {/* 對話記錄 Tab */}
        {activeTab === 'conversations' && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">對話記錄</h2>
              <Link to={`/conversations/new?employee_id=${id}`} className="btn-primary text-sm">
                新增對話
              </Link>
            </div>
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">尚無對話記錄</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {conversations.map((conv) => (
                  <li key={conv.id}>
                    <Link to={`/conversations/${conv.id}`} className="block p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {conv.conversation_type || '對話記錄'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(conv.conversation_date).toLocaleDateString('zh-TW')}
                          </p>
                        </div>
                        <span className={`badge-${conv.priority === 'high' ? 'high' : 'low'}`}>
                          {conv.intake_status}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* 事蹟紀錄 Tab */}
        {activeTab === 'achievements' && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">事蹟紀錄</h2>
                <p className="text-xs text-gray-500 mt-1">表揚／懲處／事件／貢獻等，會作為 AI 分析的資料來源</p>
              </div>
              <button onClick={() => setShowAchForm((v) => !v)} className="btn-primary text-sm">
                {showAchForm ? '取消' : '新增一筆'}
              </button>
            </div>

            {showAchForm && (
              <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-3">
                {/* 大分類：事實 / 感受 */}
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">大分類</p>
                  <div className="flex gap-2">
                    {RECORD_TYPES.map((rt) => (
                      <button key={rt} type="button" onClick={() => setAchForm({ ...achForm, record_type: rt, category: '' })}
                              className={`rounded-full border px-4 py-1.5 text-sm ${achForm.record_type === rt ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                        {rt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input value={achForm.title} onChange={(e) => setAchForm({ ...achForm, title: e.target.value })}
                         placeholder="標題" className="input sm:col-span-2 px-4 py-3" />
                  <input type="date" value={achForm.record_date} onChange={(e) => setAchForm({ ...achForm, record_date: e.target.value })}
                         className="input px-4 py-3" />
                </div>

                {/* 子標籤 */}
                {achForm.record_type === '事實' ? (
                  <div className="flex flex-wrap gap-2">
                    {FACT_CATEGORIES.map((c) => (
                      <button key={c} type="button" onClick={() => setAchForm({ ...achForm, category: achForm.category === c ? '' : c })}
                              className={`rounded-full border px-3 py-1 text-sm ${achForm.category === c ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {feelingTags.length === 0 && <span className="text-xs text-gray-400">尚無感受標籤，於下方新增</span>}
                      {feelingTags.map((t) => (
                        <button key={t.id} type="button" onClick={() => setAchForm({ ...achForm, category: achForm.category === t.name ? '' : t.name })}
                                className={`rounded-full border px-3 py-1 text-sm ${achForm.category === t.name ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                          {t.name}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input value={newFeeling} onChange={(e) => setNewFeeling(e.target.value)} maxLength={20}
                             placeholder="新增感受標籤（可重用）" className="input flex-1 px-3 py-2" />
                      <button type="button" onClick={addFeelingTag} className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">新增標籤</button>
                    </div>
                  </div>
                )}

                <textarea value={achForm.content} onChange={(e) => setAchForm({ ...achForm, content: e.target.value })}
                          rows={5} placeholder={achForm.record_type === '事實' ? '內容（需包含具體數據，例如：遲到 3 次、業績 120%）…' : '內容…'}
                          className="input w-full p-3 leading-relaxed" />
                {achForm.record_type === '事實' && (
                  <p className={`text-xs ${hasData(achForm.content) ? 'text-gray-400' : 'text-amber-600'}`}>
                    「事實」內容需包含具體數據（數字）才能儲存。
                  </p>
                )}

                <div className="flex justify-end">
                  <button onClick={saveAchievement} disabled={savingAch} className="btn-primary text-sm disabled:opacity-50">
                    {savingAch ? '儲存中…' : '儲存'}
                  </button>
                </div>
              </div>
            )}

            {achievements.length === 0 ? (
              <div className="p-8 text-center text-gray-500">尚無事蹟紀錄</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {achievements.map((a) => (
                  <li key={a.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {a.title}
                          {a.record_type && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{a.record_type}</span>}
                          {a.category && <span className="ml-1 rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700">{a.category}</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {a.record_date ? new Date(a.record_date).toLocaleDateString('zh-TW') : ''}
                          {a.created_by ? ` · ${a.created_by}` : ''}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{a.content}</p>
                      </div>
                      <button onClick={() => removeAchievement(a.id)} className="shrink-0 text-xs text-gray-400 hover:text-red-600">刪除</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* 教育訓練 Tab */}
        {activeTab === 'training' && (
          <div className="p-6">
            <TrainingProgressTab appNumber={employee.employeeappnumber} />
          </div>
        )}

        {/* 官方頻道訊息 Tab */}
        {activeTab === 'official' && (
          <>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">官方頻道訊息</h2>
              <p className="text-xs text-gray-500 mt-1">LINE 訊息與工單留言紀錄</p>
            </div>
            {officialMessages.length === 0 ? (
              <div className="p-8 text-center text-gray-500">尚無官方頻道訊息</div>
            ) : (
              <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {officialMessages.map((msg) => (
                  <li key={msg.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            msg.channel === 'official-line' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {getChannelLabel(msg.channel)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {getDirectionLabel(msg.direction)}
                          </span>
                          {msg.ticket_no && (
                            <span className="text-xs text-gray-400">
                              {msg.ticket_no}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900">{msg.message_text}</p>
                        {msg.author_name && (
                          <p className="text-xs text-gray-400 mt-1">
                            留言者：{msg.author_name}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                        {new Date(msg.message_time).toLocaleString('zh-TW')}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
