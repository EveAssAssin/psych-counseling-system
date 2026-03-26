import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import { conversationsApi } from '../services/api';
import toast from 'react-hot-toast';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await conversationsApi.search({ limit: 50 });
      setConversations(response.data.data);
      setTotal(response.data.total);
    } catch (error) {
      toast.error('載入對話列表失敗');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'badge-moderate',
      extracting: 'badge-moderate',
      extracted: 'badge-low',
      analyzing: 'badge-moderate',
      completed: 'badge-low',
      failed: 'badge-critical',
    };
    return badges[status] || 'badge-low';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      pending: '待處理',
      extracting: '抽取中',
      extracted: '已抽取',
      analyzing: '分析中',
      completed: '已完成',
      failed: '失敗',
    };
    return texts[status] || status;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">對話記錄</h1>
          <p className="mt-1 text-sm text-gray-500">共 {total} 筆對話</p>
        </div>
        <Link to="/conversations/new" className="btn-primary">
          <PlusIcon className="h-5 w-5 mr-2" />
          新增對話
        </Link>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            尚無對話記錄
            <br />
            <Link to="/conversations/new" className="text-primary-600 hover:underline mt-2 inline-block">
              建立第一筆對話
            </Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">訪談者</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">優先級</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {conversations.map((conv) => (
                <tr key={conv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {conv.conversation_date 
                      ? new Date(conv.conversation_date).toLocaleDateString('zh-TW')
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {conv.conversation_type || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {conv.interviewer_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={conv.priority === 'high' || conv.priority === 'urgent' ? 'badge-high' : 'badge-low'}>
                      {conv.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusBadge(conv.intake_status)}>
                      {getStatusText(conv.intake_status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <Link
                      to={`/conversations/${conv.id}`}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      查看詳情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
