import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { counselingApi } from '../services/api';
import SupervisorPicker, { getActingSupervisor } from '../components/SupervisorPicker';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  planning:  { label: '規劃中', cls: 'bg-gray-100 text-gray-700' },
  active:    { label: '進行中', cls: 'bg-green-100 text-green-800' },
  paused:    { label: '暫停',   cls: 'bg-yellow-100 text-yellow-800' },
  completed: { label: '已結案', cls: 'bg-primary-100 text-primary-800' },
  archived:  { label: '已封存', cls: 'bg-gray-100 text-gray-500' },
};

interface CaseRow {
  id: string;
  employee_name: string;
  employee_app_number: string;
  supervisor_name: string;
  state_tag_codes: string[];
  goal: string;
  start_date: string;
  target_end_date: string;
  status: string;
  created_at: string;
}

export default function CounselingCasesPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supervisor, setSupervisor] = useState(getActingSupervisor());

  useEffect(() => {
    const onChange = () => setSupervisor(getActingSupervisor());
    window.addEventListener('counseling.supervisor-changed', onChange);
    return () => window.removeEventListener('counseling.supervisor-changed', onChange);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: any = { limit: 100 };
    if (statusFilter) params.status = statusFilter;
    if (onlyMine && supervisor) params.supervisor_id = supervisor.id;
    counselingApi
      .listCases(params)
      .then((r) => {
        setCases(r.data?.items ?? []);
        setTotal(r.data?.total ?? 0);
      })
      .catch((e: any) => toast.error(e?.response?.data?.message || '載入失敗'))
      .finally(() => setLoading(false));
  }, [statusFilter, onlyMine, supervisor]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderOpenIcon className="h-7 w-7 text-primary-600" />
            輔導案
          </h1>
          <p className="mt-1 text-sm text-gray-500">所有正在進行與歷史的輔導案件，共 {total} 筆</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SupervisorPicker />
          <Link
            to="/counseling-cases/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700"
          >
            <PlusIcon className="h-4 w-4" />
            建立新案
          </Link>
        </div>
      </div>

      {/* 篩選 */}
      <div className="card p-3 flex items-center gap-3 flex-wrap text-sm">
        <span className="text-gray-500">狀態：</span>
        {[
          { v: '', label: '全部' },
          { v: 'active', label: '進行中' },
          { v: 'planning', label: '規劃中' },
          { v: 'paused', label: '暫停' },
          { v: 'completed', label: '已結案' },
        ].map((opt) => (
          <button
            key={opt.v}
            onClick={() => setStatusFilter(opt.v)}
            className={`px-3 py-1 rounded-md ${
              statusFilter === opt.v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
            disabled={!supervisor}
            className="rounded"
          />
          <span>只看我的</span>
        </label>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
          </div>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            尚無符合條件的案件
            <div className="mt-3">
              <Link to="/counseling-cases/new" className="text-primary-600 underline">
                建立第一筆 →
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {cases.map((c) => {
              const st = STATUS_LABEL[c.status] || { label: c.status, cls: 'bg-gray-100 text-gray-700' };
              return (
                <li key={c.id}>
                  <Link to={`/counseling-cases/${c.id}`} className="block p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-gray-900">{c.employee_name}</span>
                          <span className="text-xs text-gray-500">{c.employee_app_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                          {c.state_tag_codes?.map((t) => (
                            <span key={t} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded">
                              {t}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-gray-700 truncate">目標：{c.goal}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {c.start_date} ~ {c.target_end_date} ／ 輔導員：{c.supervisor_name}
                        </p>
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString('zh-TW')}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
