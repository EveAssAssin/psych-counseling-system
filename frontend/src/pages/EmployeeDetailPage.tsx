import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { employeesApi, conversationsApi, analysisApi } from '../services/api';
import toast from 'react-hot-toast';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [empRes, convRes, analysisRes] = await Promise.all([
        employeesApi.getById(id!),
        conversationsApi.getByEmployee(id!),
        analysisApi.getLatestByEmployee(id!),
      ]);
      setEmployee(empRes.data);
      setConversations(convRes.data);
      setLatestAnalysis(analysisRes.data?.found !== false ? analysisRes.data : null);
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
              <dd className="text-sm font-medium">{employee.department || '-'}</dd>
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
              <dt className="text-sm text-gray-500">狀態</dt>
              <dd>
                <span className={employee.is_active ? 'badge-low' : 'badge-high'}>
                  {employee.is_active ? '在職' : '離職'}
                </span>
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

      {/* 對話記錄 */}
      <div className="card">
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
      </div>
    </div>
  );
}
