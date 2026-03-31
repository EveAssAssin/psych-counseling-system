import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { employeesApi } from '../services/api';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  employeeappnumber: string;
  name: string;
  department?: string;
  store_name?: string;
  is_active: boolean;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async (query?: string) => {
    try {
      setLoading(true);
      const response = await employeesApi.search({ q: query, limit: 50 });
      setEmployees(response.data.data);
      setTotal(response.data.total);
    } catch (error) {
      toast.error('載入員工列表失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadEmployees(search);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">員工管理</h1>
          <p className="mt-1 text-sm text-gray-500">共 {total} 位員工</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋員工姓名、編號..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <button type="submit" className="btn-primary">
          搜尋
        </button>
      </form>

      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            沒有找到員工資料
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">編號</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">部門</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">門市</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {emp.employeeappnumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {emp.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {emp.department || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {emp.store_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={emp.is_active ? 'badge-low' : 'badge-high'}>
                      {emp.is_active ? '在職' : '離職'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <Link
                      to={`/employees/${emp.id}`}
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
