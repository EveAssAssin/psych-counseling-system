import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { counselingApi } from '../services/api';
import SupervisorPicker, { getActingSupervisor } from '../components/SupervisorPicker';

const METHOD_LABEL: Record<string, string> = {
  phone: '電話',
  face_to_face: '面談',
  line_text: 'LINE 文字',
  observation: '實地觀察',
  group: '小組',
  written: '書面',
};

interface Task {
  plan_item_id: string;
  case_id: string;
  scheduled_date: string;
  sequence: number;
  method: string;
  objective: string;
  recommended_actions: any;
  estimated_minutes: number;
  employee_name: string;
  employee_app_number: string;
  case_goal: string;
  state_tag_codes: string[];
}

export default function CounselingTodayPage() {
  const [supervisor, setSupervisor] = useState(getActingSupervisor());
  const [todayDate, setTodayDate] = useState(new Date().toISOString().slice(0, 10));
  const [today, setToday] = useState<Task[]>([]);
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onChange = () => setSupervisor(getActingSupervisor());
    window.addEventListener('counseling.supervisor-changed', onChange);
    return () => window.removeEventListener('counseling.supervisor-changed', onChange);
  }, []);

  const load = useCallback(async () => {
    if (!supervisor) {
      setToday([]);
      setOverdue([]);
      return;
    }
    setLoading(true);
    try {
      const [todayR, overdueR] = await Promise.all([
        counselingApi.getToday({ date: todayDate, supervisor_id: supervisor.id }),
        counselingApi.getOverdue(supervisor.id),
      ]);
      setToday(todayR.data?.tasks ?? []);
      setOverdue(overdueR.data?.tasks ?? []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '載入今日任務失敗');
    } finally {
      setLoading(false);
    }
  }, [supervisor, todayDate]);

  useEffect(() => { load(); }, [load]);

  // 同案聚合
  const byCase = today.reduce<Record<string, Task[]>>((acc, t) => {
    (acc[t.case_id] = acc[t.case_id] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDaysIcon className="h-7 w-7 text-primary-600" />
            今日輔導任務
          </h1>
          <p className="mt-1 text-sm text-gray-500">所有輔導員的當日排程，可選擇身份檢視</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={todayDate}
            onChange={(e) => setTodayDate(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
          />
          <SupervisorPicker />
        </div>
      </div>

      {!supervisor && (
        <div className="card p-6 text-center text-gray-500">
          請先在右上選擇身份（輔導員）以檢視任務
        </div>
      )}

      {supervisor && overdue.length > 0 && (
        <div className="card p-4 border-l-4 border-warning-500 bg-warning-50">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-warning-800">
                過期未完成：{overdue.length} 項
              </h3>
              <ul className="mt-1 text-sm text-warning-700 space-y-1">
                {overdue.slice(0, 5).map((t) => (
                  <li key={t.plan_item_id}>
                    {t.scheduled_date} ／ {t.employee_name}（{METHOD_LABEL[t.method] || t.method}）—{' '}
                    <Link to={`/counseling-cases/${t.case_id}`} className="text-primary-700 underline">
                      開案
                    </Link>
                  </li>
                ))}
                {overdue.length > 5 && (
                  <li className="text-warning-600">... 還有 {overdue.length - 5} 項</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {supervisor && (
        <div className="card">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
            </div>
          ) : Object.keys(byCase).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {todayDate === new Date().toISOString().slice(0, 10)
                ? '🎉 今天沒有排程任務'
                : '此日期無排程任務'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {Object.entries(byCase).map(([caseId, tasks]) => {
                const first = tasks[0];
                return (
                  <li key={caseId} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{first.employee_name}</span>
                          <span className="text-xs text-gray-500">{first.employee_app_number}</span>
                          {first.state_tag_codes?.map((c) => (
                            <span key={c} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded">
                              {c}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">目標：{first.case_goal}</p>
                        <ul className="space-y-1">
                          {tasks.map((t) => (
                            <li key={t.plan_item_id} className="text-sm text-gray-800">
                              • <span className="font-medium">[{METHOD_LABEL[t.method] || t.method}]</span>{' '}
                              {t.objective}
                              <span className="text-gray-400 ml-2">~ {t.estimated_minutes} 分</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Link
                        to={`/counseling-cases/${caseId}`}
                        className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                      >
                        開啟案件 →
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
