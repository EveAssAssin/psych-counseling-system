import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { MagnifyingGlassIcon, XMarkIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { employeesApi, officialChannelApi } from '../services/api';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  employeeappnumber: string;
  name: string;
  department?: string;
  store_name?: string;
  is_active: boolean;
}

interface ChannelMessage {
  id: string;
  channel: string;
  direction: string;
  message_text: string;
  message_time: string;
  ticket_no?: string;
  author_name?: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  // 對話記錄 Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEmployee, setModalEmployee] = useState<Employee | null>(null);
  const [modalMessages, setModalMessages] = useState<ChannelMessage[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async (query?: string) => {
    try {
      setLoading(true);
      const response = await employeesApi.search({ q: query, limit: 9999 });
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

  const openConversationModal = async (emp: Employee) => {
    setModalEmployee(emp);
    setModalOpen(true);
    setModalLoading(true);
    setModalMessages([]);

    try {
      // 優先用 appNumber 查，因為 employee_id 可能對不上
      const res = await officialChannelApi.getByAppNumber(emp.employeeappnumber, 200);
      setModalMessages(res.data || []);
    } catch {
      // fallback: 用 employee_id 查
      try {
        const res = await officialChannelApi.getByEmployeeId(emp.id, 200);
        setModalMessages(res.data || []);
      } catch {
        toast.error('載入對話記錄失敗');
      }
    } finally {
      setModalLoading(false);
    }
  };

  const getChannelLabel = (channel: string) => {
    return channel === 'official-line' ? 'LINE' : '工單留言';
  };

  const getChannelColor = (channel: string) => {
    return channel === 'official-line'
      ? 'bg-green-100 text-green-800'
      : 'bg-blue-100 text-blue-800';
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
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-3">
                    <button
                      onClick={() => openConversationModal(emp)}
                      className="text-green-600 hover:text-green-900 inline-flex items-center gap-1"
                      title="查看對話紀錄"
                    >
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
                      對話紀錄
                    </button>
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

      {/* 對話紀錄 Modal */}
      <Transition.Root show={modalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setModalOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                        {modalEmployee?.name} 的對話紀錄
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {modalEmployee?.employeeappnumber} · LINE 訊息與工單留言
                      </p>
                    </div>
                    <button
                      onClick={() => setModalOpen(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                    {modalLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                      </div>
                    ) : modalMessages.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        尚無對話紀錄
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-500">共 {modalMessages.length} 筆紀錄</p>
                        {modalMessages.map((msg) => (
                          <div key={msg.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getChannelColor(msg.channel)}`}>
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
                              <span className="text-xs text-gray-400 ml-auto">
                                {new Date(msg.message_time).toLocaleString('zh-TW')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 whitespace-pre-wrap">{msg.message_text}</p>
                            {msg.author_name && (
                              <p className="text-xs text-gray-400 mt-1">留言者：{msg.author_name}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end px-6 py-3 border-t border-gray-200 bg-gray-50">
                    <button
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      關閉
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
}
