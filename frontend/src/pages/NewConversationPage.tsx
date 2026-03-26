import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { conversationsApi, employeesApi } from '../services/api';
import toast from 'react-hot-toast';

export default function NewConversationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedEmployeeId = searchParams.get('employee_id');

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchingEmployees, setSearchingEmployees] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [formData, setFormData] = useState({
    employee_id: preselectedEmployeeId || '',
    conversation_date: new Date().toISOString().slice(0, 16),
    conversation_type: '一對一面談',
    interviewer_name: '',
    background_note: '',
    raw_text: '',
    priority: 'normal',
    need_followup: false,
  });

  useEffect(() => {
    if (preselectedEmployeeId) {
      loadEmployee(preselectedEmployeeId);
    }
  }, [preselectedEmployeeId]);

  const loadEmployee = async (id: string) => {
    try {
      const response = await employeesApi.getById(id);
      setEmployees([response.data]);
    } catch (error) {
      console.error('Failed to load employee');
    }
  };

  const searchEmployees = async (query: string) => {
    if (!query || query.length < 2) {
      setEmployees([]);
      return;
    }
    try {
      setSearchingEmployees(true);
      const response = await employeesApi.search({ q: query, limit: 10 });
      setEmployees(response.data.data);
    } catch (error) {
      console.error('Failed to search employees');
    } finally {
      setSearchingEmployees(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employee_id) {
      toast.error('請選擇員工');
      return;
    }
    if (!formData.raw_text.trim()) {
      toast.error('請輸入對話內容');
      return;
    }

    try {
      setLoading(true);
      const response = await conversationsApi.create({
        ...formData,
        conversation_date: new Date(formData.conversation_date).toISOString(),
      });
      toast.success('對話記錄已建立！');
      navigate(`/conversations/${response.data.id}`);
    } catch (error) {
      toast.error('建立失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">新增對話記錄</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-4">
          {/* 員工選擇 */}
          <div>
            <label className="label">員工 *</label>
            <input
              type="text"
              placeholder="搜尋員工姓名或編號..."
              value={employeeSearch}
              onChange={(e) => {
                setEmployeeSearch(e.target.value);
                searchEmployees(e.target.value);
              }}
              className="input"
            />
            {employees.length > 0 && (
              <ul className="mt-2 border rounded-md divide-y max-h-40 overflow-y-auto">
                {employees.map((emp) => (
                  <li
                    key={emp.id}
                    onClick={() => {
                      setFormData({ ...formData, employee_id: emp.id });
                      setEmployeeSearch(`${emp.name} (${emp.employeeappnumber})`);
                      setEmployees([]);
                    }}
                    className="p-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <span className="font-medium">{emp.name}</span>
                    <span className="text-gray-500 ml-2">{emp.employeeappnumber}</span>
                  </li>
                ))}
              </ul>
            )}
            {formData.employee_id && (
              <p className="text-sm text-green-600 mt-1">✓ 已選擇員工</p>
            )}
          </div>

          {/* 對話日期 */}
          <div>
            <label className="label">對話日期時間</label>
            <input
              type="datetime-local"
              value={formData.conversation_date}
              onChange={(e) => setFormData({ ...formData, conversation_date: e.target.value })}
              className="input"
            />
          </div>

          {/* 對話類型 */}
          <div>
            <label className="label">對話類型</label>
            <select
              value={formData.conversation_type}
              onChange={(e) => setFormData({ ...formData, conversation_type: e.target.value })}
              className="input"
            >
              <option value="一對一面談">一對一面談</option>
              <option value="電話訪談">電話訪談</option>
              <option value="訊息對話">訊息對話</option>
              <option value="會議記錄">會議記錄</option>
              <option value="其他">其他</option>
            </select>
          </div>

          {/* 訪談者 */}
          <div>
            <label className="label">訪談者姓名</label>
            <input
              type="text"
              value={formData.interviewer_name}
              onChange={(e) => setFormData({ ...formData, interviewer_name: e.target.value })}
              placeholder="例如：王經理"
              className="input"
            />
          </div>

          {/* 背景說明 */}
          <div>
            <label className="label">背景說明</label>
            <textarea
              value={formData.background_note}
              onChange={(e) => setFormData({ ...formData, background_note: e.target.value })}
              placeholder="訪談的背景或目的..."
              rows={2}
              className="input"
            />
          </div>

          {/* 對話內容 */}
          <div>
            <label className="label">對話內容 *</label>
            <textarea
              value={formData.raw_text}
              onChange={(e) => setFormData({ ...formData, raw_text: e.target.value })}
              placeholder="請輸入或貼上對話內容..."
              rows={10}
              className="input"
              required
            />
          </div>

          {/* 優先級 */}
          <div className="flex gap-6">
            <div>
              <label className="label">優先級</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="input"
              >
                <option value="low">低</option>
                <option value="normal">一般</option>
                <option value="high">高</option>
                <option value="urgent">緊急</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="need_followup"
                checked={formData.need_followup}
                onChange={(e) => setFormData({ ...formData, need_followup: e.target.checked })}
                className="h-4 w-4 text-primary-600 rounded"
              />
              <label htmlFor="need_followup" className="ml-2 text-sm text-gray-700">
                需要追蹤
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? '建立中...' : '建立對話記錄'}
          </button>
        </div>
      </form>
    </div>
  );
}
