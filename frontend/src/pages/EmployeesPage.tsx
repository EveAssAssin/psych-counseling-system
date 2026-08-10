import { useState, useEffect, useMemo, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { MagnifyingGlassIcon, XMarkIcon, ChatBubbleLeftRightIcon, ShieldCheckIcon, UsersIcon } from '@heroicons/react/24/outline';
import { employeesApi, storesApi, officialChannelApi } from '../services/api';
import { useAuthStore } from '../stores';
import PermissionsTab from '../components/PermissionsTab';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  employeeappnumber: string;
  name: string;
  department?: string;
  store_name?: string;
  store_id?: string;
  person_type?: string; // store / nonstore / special / excluded
  job_tags?: string[];  // 店長/副店長/正職/新人（人工）
  risk_tags?: string[]; // 危險/準淘汰/高關注（人工）
  is_active: boolean;
}

// 職稱標籤選項
const JOB_TAGS = ['店長', '副店長', '正職', '新人'];
// 風險標記選項
const RISK_TAGS = ['危險', '準淘汰', '高關注'];

interface ChannelMessage {
  id: string;
  channel: string;
  direction: string;
  message_text: string;
  message_time: string;
  ticket_no?: string;
  author_name?: string;
}

// 人員單位標籤
const unitLabel = (pt?: string) =>
  pt === 'store' ? '門市人員' : (pt === 'nonstore' || pt === 'special') ? '總部人員' : '—';

// 門市 → 四大區域對照（依實際門市歸屬設定）
const REGION_GROUPS: Record<string, string[]> = {
  新北區: ['林口', '中壢', '板橋', '永和'],
  新竹區: ['新竹', '竹北', '六家'],
  台中區: ['東山', '潭子', '大里', '中科', '中清', '大墩'],
  高雄區: ['鼎山', '南京', '高應大', '文山', '熱河', '高美', '新左營', '楠梓'],
};
const REGIONS = Object.keys(REGION_GROUPS);

// 依文字（門市名稱/區域）判斷所屬四大區
function classifyRegion(text?: string): string | undefined {
  if (!text) return undefined;
  for (const [region, keywords] of Object.entries(REGION_GROUPS)) {
    if (keywords.some((k) => text.includes(k))) return region;
  }
  return undefined;
}

export default function EmployeesPage() {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.roles?.includes('admin') ?? false;

  const [tab, setTab] = useState<'employees' | 'permissions'>('employees');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [storeRegion, setStoreRegion] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // 篩選條件
  const [search, setSearch] = useState('');
  const [unit, setUnit] = useState<'all' | 'store' | 'hq'>('all');
  const [region, setRegion] = useState<string>('all');
  const [store, setStore] = useState<string>('all');
  const [jobTag, setJobTag] = useState<string>('all');
  const [riskTag, setRiskTag] = useState<string>('all'); // all / any / 危險 / 準淘汰 / 高關注
  const [showInactive, setShowInactive] = useState(false);

  // 對話記錄 Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEmployee, setModalEmployee] = useState<Employee | null>(null);
  const [modalMessages, setModalMessages] = useState<ChannelMessage[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [empRes, storeRes] = await Promise.all([
        employeesApi.search({ limit: 9999 }),
        storesApi.list().catch(() => ({ data: [] as any[] })),
      ]);
      setEmployees(empRes.data.data || []);

      // 門市 → 四大區域 對照（以門市名稱或 region 文字歸類）
      const stores: any[] = Array.isArray(storeRes.data) ? storeRes.data : storeRes.data?.data ?? [];
      const map: Record<string, string> = {};
      for (const s of stores) {
        const bucket = classifyRegion(s.name) || classifyRegion(s.region);
        if (s.id && bucket) map[s.id] = bucket;
      }
      setStoreRegion(map);
    } catch (error) {
      toast.error('載入員工列表失敗');
    } finally {
      setLoading(false);
    }
  };

  // 依所屬門市帶出區域：優先用員工的門市名稱歸類，其次用 store_id 對照，再其次用部門文字
  const empRegion = (emp: Employee): string | undefined =>
    classifyRegion(emp.store_name) ||
    (emp.store_id ? storeRegion[emp.store_id] : undefined) ||
    classifyRegion(emp.department);

  // 所屬門市選項：門市人員的門市名稱，若已選區域則只列該區
  const storeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const emp of employees) {
      if (emp.person_type !== 'store' || !emp.store_name) continue;
      if (region !== 'all' && classifyRegion(emp.store_name) !== region) continue;
      set.add(emp.store_name);
    }
    return Array.from(set).sort();
  }, [employees, region]);

  // 選「總部人員」時，區域/門市篩選停用並自動回全部
  const handleUnitChange = (v: 'all' | 'store' | 'hq') => {
    setUnit(v);
    if (v === 'hq') { setRegion('all'); setStore('all'); }
  };

  // 換區域時清掉門市選擇（避免殘留不屬於該區的門市）
  const handleRegionChange = (v: string) => {
    setRegion(v);
    setStore('all');
  };

  const clearFilters = () => {
    setSearch('');
    setUnit('all');
    setRegion('all');
    setStore('all');
    setJobTag('all');
    setRiskTag('all');
  };

  // 即時篩選（搜尋 + 單位 + 區域 同時生效，全部條件皆須符合）
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((emp) => {
      // 排除帳號（多建/測試/系統）：完全隱藏，連「顯示離職」也不顯示
      if (emp.person_type === 'excluded') return false;
      if (q) {
        const hit =
          emp.name?.toLowerCase().includes(q) ||
          emp.employeeappnumber?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (unit === 'store' && emp.person_type !== 'store') return false;
      if (unit === 'hq' && !(emp.person_type === 'nonstore' || emp.person_type === 'special')) return false;
      if (region !== 'all' && empRegion(emp) !== region) return false;
      if (store !== 'all' && emp.store_name !== store) return false;
      if (jobTag !== 'all' && !(emp.job_tags || []).includes(jobTag)) return false;
      if (riskTag === 'any' && (emp.risk_tags || []).length === 0) return false;
      if (riskTag !== 'all' && riskTag !== 'any' && !(emp.risk_tags || []).includes(riskTag)) return false;
      if (!showInactive && emp.is_active === false) return false;
      return true;
    });
  }, [employees, search, unit, region, store, jobTag, riskTag, showInactive, storeRegion]);

  const regionDisabled = unit === 'hq';

  const openConversationModal = async (emp: Employee) => {
    setModalEmployee(emp);
    setModalOpen(true);
    setModalLoading(true);
    setModalMessages([]);
    try {
      const res = await officialChannelApi.getByAppNumber(emp.employeeappnumber, 200);
      setModalMessages(res.data || []);
    } catch {
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

  const getChannelLabel = (channel: string) => (channel === 'official-line' ? 'LINE' : '工單留言');
  const getChannelColor = (channel: string) =>
    channel === 'official-line' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
  const getDirectionLabel = (direction: string) => {
    const labels: Record<string, string> = { inbound: '員工', store: '門市', engineer: '工程師', reviewer: '審核人員' };
    return labels[direction] || direction;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">員工管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tab === 'employees' ? `共 ${employees.length} 位員工` : '管理可登入本系統的人員與其角色'}
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            <button type="button" onClick={() => setTab('employees')}
              className={`inline-flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium ${
                tab === 'employees' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              <UsersIcon className="h-4 w-4" />員工列表
            </button>
            <button type="button" onClick={() => setTab('permissions')}
              className={`inline-flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium ${
                tab === 'permissions' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              <ShieldCheckIcon className="h-4 w-4" />權限管理
            </button>
          </nav>
        </div>
      )}

      {tab === 'permissions' && isAdmin && <PermissionsTab />}

      {tab === 'employees' && (
      <>
      {/* 搜尋 */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input type="text" placeholder="搜尋員工姓名、編號..." value={search}
               onChange={(e) => setSearch(e.target.value)} className="input pl-10 w-full" />
      </div>

      {/* 篩選器 */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">人員單位</label>
          <select value={unit} onChange={(e) => handleUnitChange(e.target.value as any)}
                  className="input min-w-[140px]">
            <option value="all">全部人員</option>
            <option value="store">門市人員</option>
            <option value="hq">總部人員</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">所屬區域</label>
          <select value={region} onChange={(e) => handleRegionChange(e.target.value)} disabled={regionDisabled}
                  className="input min-w-[140px] disabled:bg-gray-100 disabled:text-gray-400">
            <option value="all">全部區域</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">所屬門市</label>
          <select value={store} onChange={(e) => setStore(e.target.value)} disabled={regionDisabled}
                  className="input min-w-[140px] disabled:bg-gray-100 disabled:text-gray-400">
            <option value="all">全部門市</option>
            {storeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">職稱</label>
          <select value={jobTag} onChange={(e) => setJobTag(e.target.value)} className="input min-w-[120px]">
            <option value="all">全部職稱</option>
            {JOB_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">風險</label>
          <select value={riskTag} onChange={(e) => setRiskTag(e.target.value)} className="input min-w-[120px]">
            <option value="all">全部風險</option>
            <option value="any">有任一風險標記</option>
            {RISK_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <button type="button" onClick={clearFilters}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          清除篩選
        </button>

        {/* 右側：離職開關 + 人數 */}
        <div className="ml-auto flex items-center gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
                   className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            顯示離職人員
          </label>
          <span className="text-sm text-gray-600">
            符合條件：<span className="font-semibold text-gray-900">{filtered.length}</span> 人
          </span>
        </div>
      </div>

      {regionDisabled && (
        <p className="text-xs text-amber-600">總部人員不適用門市區域篩選。</p>
      )}

      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            查無符合條件的人員，請調整篩選條件。
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">編號</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">單位</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">門市／部門</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">區域</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">職稱</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{emp.employeeappnumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{emp.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unitLabel(emp.person_type)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.store_name || emp.department || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{empRegion(emp) || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {emp.job_tags && emp.job_tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {emp.job_tags.map((t) => (
                          <span key={t} className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700">{t}</span>
                        ))}
                      </div>
                    ) : <span className="text-sm text-gray-400">-</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={emp.is_active ? 'badge-low' : 'badge-high'}>{emp.is_active ? '在職' : '離職'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-3">
                    <button onClick={() => openConversationModal(emp)}
                            className="text-green-600 hover:text-green-900 inline-flex items-center gap-1" title="查看對話紀錄">
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />對話紀錄
                    </button>
                    <Link to={`/employees/${emp.id}`} className="text-primary-600 hover:text-primary-900">查看詳情</Link>
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
          <Transition.Child as={Fragment}
            enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child as={Fragment}
                enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                        {modalEmployee?.name} 的對話紀錄
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {modalEmployee?.employeeappnumber} · LINE 訊息與工單留言
                      </p>
                    </div>
                    <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                    {modalLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                      </div>
                    ) : modalMessages.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">尚無對話紀錄</div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-500">共 {modalMessages.length} 筆紀錄</p>
                        {modalMessages.map((msg) => (
                          <div key={msg.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getChannelColor(msg.channel)}`}>
                                {getChannelLabel(msg.channel)}
                              </span>
                              <span className="text-xs text-gray-500">{getDirectionLabel(msg.direction)}</span>
                              {msg.ticket_no && <span className="text-xs text-gray-400">{msg.ticket_no}</span>}
                              <span className="text-xs text-gray-400 ml-auto">
                                {new Date(msg.message_time).toLocaleString('zh-TW')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 whitespace-pre-wrap">{msg.message_text}</p>
                            {msg.author_name && <p className="text-xs text-gray-400 mt-1">留言者：{msg.author_name}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end px-6 py-3 border-t border-gray-200 bg-gray-50">
                    <button onClick={() => setModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                      關閉
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
      </>
      )}
    </div>
  );
}
