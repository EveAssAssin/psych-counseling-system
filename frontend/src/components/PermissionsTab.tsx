import { useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { permissionsApi, employeesApi } from '../services/api';
import toast from 'react-hot-toast';

type AppRole = 'admin' | 'counselor';

interface PermissionRecord {
  user_role_id: string;
  user_id: string;
  email: string | null;
  user_name: string | null;
  user_is_active: boolean;
  last_login_at: string | null;
  employee_id: string | null;
  app_number: string | null;
  erp_id: string | null;
  employee_name: string | null;
  department: string | null;
  store_name: string | null;
  title: string | null;
  role: AppRole;
  scope_type: string | null;
  role_is_active: boolean;
  granted_at: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: '超級管理者',
  counselor: '輔導人員',
};

const ROLE_BADGE_CLASSES: Record<AppRole, string> = {
  admin: 'bg-purple-100 text-purple-800',
  counselor: 'bg-blue-100 text-blue-800',
};

export default function PermissionsTab() {
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<'' | AppRole>('');
  const [showInactive, setShowInactive] = useState(false);

  // 新增權限 modal
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [grantSearch, setGrantSearch] = useState('');
  const [grantSearchResults, setGrantSearchResults] = useState<any[]>([]);
  const [grantSelectedEmp, setGrantSelectedEmp] = useState<any | null>(null);
  const [grantSelectedRole, setGrantSelectedRole] = useState<AppRole>('counselor');
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const grantSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const res = await permissionsApi.list({ only_active: false });
      setPermissions(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '載入權限列表失敗');
    } finally {
      setLoading(false);
    }
  };

  const filtered = permissions.filter((p) => {
    if (filterRole && p.role !== filterRole) return false;
    if (!showInactive && !p.role_is_active) return false;
    return true;
  });

  const searchEmployees = (q: string) => {
    if (grantSearchTimerRef.current) clearTimeout(grantSearchTimerRef.current);
    if (!q || q.length < 1) {
      setGrantSearchResults([]);
      return;
    }
    grantSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await employeesApi.search({ q, limit: 10 });
        setGrantSearchResults(res.data.data);
      } catch {
        setGrantSearchResults([]);
      }
    }, 250);
  };

  const handleGrant = async () => {
    if (!grantSelectedEmp) {
      toast.error('請先選擇員工');
      return;
    }
    try {
      setGrantSubmitting(true);
      await permissionsApi.grant({
        app_number: grantSelectedEmp.employeeappnumber,
        role: grantSelectedRole,
      });
      toast.success(`已指派「${ROLE_LABELS[grantSelectedRole]}」給 ${grantSelectedEmp.name}`);
      setGrantModalOpen(false);
      setGrantSelectedEmp(null);
      setGrantSearch('');
      setGrantSearchResults([]);
      await loadPermissions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '指派失敗');
    } finally {
      setGrantSubmitting(false);
    }
  };

  const handleChangeRole = async (rec: PermissionRecord, newRole: AppRole) => {
    if (newRole === rec.role) return;
    if (!confirm(`確定將 ${rec.employee_name} 的角色改為「${ROLE_LABELS[newRole]}」？`)) return;
    try {
      await permissionsApi.update(rec.user_role_id, { role: newRole });
      toast.success('角色已更新');
      await loadPermissions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '更新失敗');
    }
  };

  const handleToggleActive = async (rec: PermissionRecord) => {
    const action = rec.role_is_active ? '停用' : '啟用';
    if (!confirm(`確定${action} ${rec.employee_name} 的權限？`)) return;
    try {
      await permissionsApi.update(rec.user_role_id, { is_active: !rec.role_is_active });
      toast.success(`已${action}`);
      await loadPermissions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `${action}失敗`);
    }
  };

  const handleRevoke = async (rec: PermissionRecord) => {
    if (!confirm(`確定撤銷 ${rec.employee_name} 的「${ROLE_LABELS[rec.role]}」權限？\n\n撤銷後該員工將無法登入系統。`)) return;
    try {
      await permissionsApi.revoke(rec.user_role_id);
      toast.success('已撤銷');
      await loadPermissions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '撤銷失敗');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="input"
          >
            <option value="">全部角色</option>
            <option value="admin">超級管理者</option>
            <option value="counselor">輔導人員</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            顯示已停用
          </label>
        </div>
        <button
          type="button"
          onClick={() => setGrantModalOpen(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <UserPlusIcon className="h-4 w-4" />
          新增權限
        </button>
      </div>

      {/* 統計 */}
      <div className="text-sm text-gray-600">
        共 {filtered.length} 筆權限
        （超級管理者 {filtered.filter((p) => p.role === 'admin').length} ／
        輔導人員 {filtered.filter((p) => p.role === 'counselor').length}）
      </div>

      {/* 表格 */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            尚未指派任何權限。點「新增權限」開始建立第一個使用者。
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">員工編號</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">部門 / 門市</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">最後登入</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((p) => (
                <tr key={p.user_role_id} className={!p.role_is_active ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 text-sm text-gray-900">{p.app_number || '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.employee_name || p.user_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {p.department || '—'}
                    {p.store_name && <span className="text-xs text-gray-400 ml-1">／{p.store_name}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.role}
                      onChange={(e) => handleChangeRole(p, e.target.value as AppRole)}
                      disabled={!p.role_is_active}
                      className={`text-xs px-2 py-1 rounded border-0 ${ROLE_BADGE_CLASSES[p.role]} disabled:cursor-not-allowed`}
                    >
                      <option value="admin">超級管理者</option>
                      <option value="counselor">輔導人員</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {p.role_is_active ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">有效</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">已停用</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.last_login_at ? new Date(p.last_login_at).toLocaleString('zh-TW') : '從未登入'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(p)}
                      className="text-yellow-600 hover:text-yellow-800 text-xs"
                    >
                      {p.role_is_active ? '停用' : '啟用'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(p)}
                      className="text-red-600 hover:text-red-800 text-xs inline-flex items-center gap-1"
                    >
                      <TrashIcon className="h-3 w-3" />
                      撤銷
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 新增權限 Modal */}
      <Transition.Root show={grantModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setGrantModalOpen(false)}>
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
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="bg-white rounded-lg shadow-xl w-full max-w-md">
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                      <PlusIcon className="h-5 w-5" /> 新增權限
                    </Dialog.Title>
                    <button onClick={() => setGrantModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="px-6 py-4 space-y-4">
                    {/* 員工搜尋 */}
                    <div>
                      <label className="label">員工 *</label>
                      <input
                        type="text"
                        placeholder="輸入員工姓名或編號（一個字即可）..."
                        value={grantSearch}
                        onChange={(e) => {
                          setGrantSearch(e.target.value);
                          setGrantSelectedEmp(null);
                          searchEmployees(e.target.value);
                        }}
                        className="input"
                      />
                      {grantSearchResults.length > 0 && !grantSelectedEmp && (
                        <ul className="mt-2 border rounded max-h-40 overflow-y-auto divide-y">
                          {grantSearchResults.map((emp) => (
                            <li
                              key={emp.id}
                              onClick={() => {
                                setGrantSelectedEmp(emp);
                                setGrantSearch(`${emp.name} (${emp.employeeappnumber})`);
                                setGrantSearchResults([]);
                              }}
                              className="p-2 hover:bg-gray-50 cursor-pointer text-sm"
                            >
                              <span className="font-medium">{emp.name}</span>
                              <span className="text-gray-500 ml-2">{emp.employeeappnumber}</span>
                              {emp.store_name && <span className="text-gray-400 ml-2 text-xs">{emp.store_name}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {grantSelectedEmp && (
                        <p className="text-sm text-green-600 mt-1">
                          ✓ 已選：{grantSelectedEmp.name}（{grantSelectedEmp.employeeappnumber}）
                        </p>
                      )}
                    </div>

                    {/* 角色 */}
                    <div>
                      <label className="label">角色 *</label>
                      <select
                        value={grantSelectedRole}
                        onChange={(e) => setGrantSelectedRole(e.target.value as AppRole)}
                        className="input"
                      >
                        <option value="counselor">輔導人員（一般使用）</option>
                        <option value="admin">超級管理者（可管理權限）</option>
                      </select>
                    </div>

                    <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded p-2">
                      ⚠️ 指派後，該員工透過樂活統一入口（URL 帶 app_number）即可登入系統。
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 px-6 py-3 border-t bg-gray-50">
                    <button onClick={() => setGrantModalOpen(false)} className="btn-secondary">取消</button>
                    <button
                      onClick={handleGrant}
                      disabled={!grantSelectedEmp || grantSubmitting}
                      className="btn-primary"
                    >
                      {grantSubmitting ? '指派中…' : '指派權限'}
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
