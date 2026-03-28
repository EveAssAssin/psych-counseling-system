import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, ChatBubbleLeftRightIcon, TicketIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { employeesApi, conversationsApi, analysisApi, officialChannelApi } from '../services/api';
import { EmployeeInsightTab } from '../components/EmployeeInsightTab';
import toast from 'react-hot-toast';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<any>(null);
  const [officialMessages, setOfficialMessages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'insight' | 'conversations' | 'official'>('insight');
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
