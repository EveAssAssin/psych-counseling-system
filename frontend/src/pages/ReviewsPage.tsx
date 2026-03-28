import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { api } from '../services/api';
import toast from 'react-hot-toast';

// 類型定義
interface Review {
  id: string;
  employee_id: string;
  employee_name?: string;
  is_proxy: boolean;
  source: string;
  review_type: string;
  urgency: string;
  content?: string;
  status: string;
  requires_response: boolean;
  responded_at?: string;
  response_speed_hours?: number;
  created_at: string;
}

interface Stats {
  total: number;
  pending: number;
  responded: number;
  closed: number;
  by_type: Record<string, number>;
  by_source: Record<string, number>;
}

// 標籤配置
const SOURCE_LABELS: Record<string, string> = {
  google_map: 'Google MAP',
  facebook: 'Facebook',
  phone: '電話客服',
  app: 'APP 客服',
  other: '其他',
};

const TYPE_LABELS: Record<string, string> = {
  positive: '正評',
  negative: '負評',
  other: '其他',
};

const TYPE_COLORS: Record<string, string> = {
  positive: 'bg-green-100 text-green-800',
  negative: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-800',
};

const URGENCY_LABELS: Record<string, string> = {
  urgent_plus: '特急',
  urgent: '緊急',
  normal: '普通',
};

const URGENCY_COLORS: Record<string, string> = {
  urgent_plus: 'bg-red-600 text-white',
  urgent: 'bg-orange-500 text-white',
  normal: 'bg-gray-200 text-gray-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待處理',
  responded: '已回覆',
  closed: '已結案',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  responded: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 篩選條件
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [filterType, filterStatus, filterSource]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterType) params.review_type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterSource) params.source = filterSource;

      const [reviewsRes, statsRes] = await Promise.all([
        api.get('/reviews', { params }),
        api.get('/reviews/stats'),
      ]);

      setReviews(reviewsRes.data.data || []);
      setStats(statsRes.data.data);
    } catch (error) {
      toast.error('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">評價管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理客訴、負評與正面評價</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          新增評價
        </button>
      </div>

      {/* 統計卡片 */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="text-sm text-gray-500">總數</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-yellow-600">待處理</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-blue-600">已回覆</div>
            <div className="text-2xl font-bold text-blue-600">{stats.responded}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-gray-500">已結案</div>
            <div className="text-2xl font-bold text-gray-500">{stats.closed}</div>
          </div>
        </div>
      )}

      {/* 篩選 */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input-field w-32"
          >
            <option value="">所有類型</option>
            <option value="positive">正評</option>
            <option value="negative">負評</option>
            <option value="other">其他</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field w-32"
          >
            <option value="">所有狀態</option>
            <option value="pending">待處理</option>
            <option value="responded">已回覆</option>
            <option value="closed">已結案</option>
          </select>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="input-field w-40"
          >
            <option value="">所有來源</option>
            <option value="google_map">Google MAP</option>
            <option value="facebook">Facebook</option>
            <option value="phone">電話客服</option>
            <option value="app">APP 客服</option>
            <option value="other">其他</option>
          </select>
        </div>
      </div>

      {/* 評價列表 */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            尚無評價記錄
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">緊急</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">來源</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">員工</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">內容</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">回覆速度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reviews.map((review) => (
                <tr key={review.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(review.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${TYPE_COLORS[review.review_type]}`}>
                      {TYPE_LABELS[review.review_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${URGENCY_COLORS[review.urgency]}`}>
                      {URGENCY_LABELS[review.urgency]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {SOURCE_LABELS[review.source]}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-gray-900">
                      {review.employee_name || '未知'}
                    </span>
                    {review.is_proxy && (
                      <span className="ml-1 text-xs text-orange-600">(代理)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                    {review.content || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[review.status]}`}>
                      {STATUS_LABELS[review.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {review.response_speed_hours != null
                      ? `${review.response_speed_hours.toFixed(1)} 小時`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      to={`/reviews/${review.id}`}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 新增評價 Modal */}
      {showCreateModal && (
        <CreateReviewModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// ============================================
// 新增評價 Modal
// ============================================
function CreateReviewModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const [formData, setFormData] = useState({
    source: 'google_map',
    review_type: 'negative',
    urgency: 'normal',
    content: '',
    is_proxy: false,
    requires_response: true,
    event_date: new Date().toISOString().split('T')[0],
  });

  // 搜尋員工
  useEffect(() => {
    if (employeeSearch.length < 1) {
      setEmployees([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/employees', { params: { q: employeeSearch, limit: 10 } });
        setEmployees(res.data.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [employeeSearch]);

  // 根據 review_type 自動設定 requires_response
  useEffect(() => {
    if (formData.review_type === 'positive') {
      setFormData(prev => ({ ...prev, requires_response: false }));
    } else if (formData.review_type === 'negative') {
      setFormData(prev => ({ ...prev, requires_response: true }));
    }
  }, [formData.review_type]);

  const handleSubmit = async () => {
    if (!selectedEmployee) {
      toast.error('請選擇員工');
      return;
    }

    setLoading(true);
    try {
      await api.post('/reviews', {
        employee_id: selectedEmployee.id,
        ...formData,
      });
      toast.success('評價已建立');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '建立失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">新增評價</h2>
        </div>

        <div className="p-6 space-y-4">
          {/* 員工搜尋 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              指定員工 *
            </label>
            {selectedEmployee ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">{selectedEmployee.name}</span>
                <span className="text-sm text-gray-500">
                  {selectedEmployee.department} / {selectedEmployee.store_name}
                </span>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="ml-auto text-red-600 text-sm"
                >
                  移除
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="輸入員工姓名搜尋..."
                  className="input-field w-full"
                />
                {searching && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full"></div>
                  </div>
                )}
                {employees.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {employees.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setEmployeeSearch('');
                          setEmployees([]);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50"
                      >
                        <span className="font-medium">{emp.name}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          {emp.department} / {emp.store_name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 是否代理處理 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_proxy"
              checked={formData.is_proxy}
              onChange={(e) => setFormData({ ...formData, is_proxy: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="is_proxy" className="text-sm text-gray-700">
              代理處理（此評價不是針對該員工本人，而是由他代為處理）
            </label>
          </div>

          {/* 來源 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">來源</label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="input-field w-full"
            >
              <option value="google_map">Google MAP</option>
              <option value="facebook">Facebook</option>
              <option value="phone">電話客服</option>
              <option value="app">APP 客服</option>
              <option value="other">其他</option>
            </select>
          </div>

          {/* 類型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">評價類型</label>
            <div className="flex gap-4">
              {['positive', 'negative', 'other'].map((type) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="review_type"
                    value={type}
                    checked={formData.review_type === type}
                    onChange={(e) => setFormData({ ...formData, review_type: e.target.value })}
                  />
                  <span className={`px-2 py-1 text-sm rounded ${TYPE_COLORS[type]}`}>
                    {TYPE_LABELS[type]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 緊急程度 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">緊急程度</label>
            <div className="flex gap-4">
              {['urgent_plus', 'urgent', 'normal'].map((urgency) => (
                <label key={urgency} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="urgency"
                    value={urgency}
                    checked={formData.urgency === urgency}
                    onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                  />
                  <span className={`px-2 py-1 text-sm rounded ${URGENCY_COLORS[urgency]}`}>
                    {URGENCY_LABELS[urgency]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 事件日期 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">事件日期</label>
            <input
              type="date"
              value={formData.event_date}
              onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
              className="input-field w-full"
            />
          </div>

          {/* 是否需要回覆（僅 other 類型可選） */}
          {formData.review_type === 'other' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requires_response"
                checked={formData.requires_response}
                onChange={(e) => setFormData({ ...formData, requires_response: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="requires_response" className="text-sm text-gray-700">
                需要員工回覆
              </label>
            </div>
          )}

          {/* 內容說明 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              內容說明（給員工看）
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              className="input-field w-full"
              placeholder="請描述評價內容或客訴詳情..."
            />
          </div>

          {/* TODO: 附件上傳 */}
          <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
            📎 附件上傳功能開發中...
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedEmployee}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? '建立中...' : '建立評價'}
          </button>
        </div>
      </div>
    </div>
  );
}
