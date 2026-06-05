import { useEffect, useRef, useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { employeesApi } from '../services/api';

interface EmpRow {
  id: string;
  employeeappnumber: string;
  name: string;
  department?: string;
  store_name?: string;
  title?: string;
  is_active?: boolean;
}

interface Props {
  /** 目前選定的 app_number；空字串代表未選 */
  value: string;
  /** 選擇 / 清除時觸發。空字串代表清除 */
  onChange: (appNumber: string, employee?: EmpRow) => void;
  placeholder?: string;
  /** 是否只搜在職員工，預設 true */
  activeOnly?: boolean;
  /** 顯示時要不要也帶 app_number 在後面，預設 true */
  showAppNumber?: boolean;
  /** 自動聚焦 */
  autoFocus?: boolean;
}

export default function EmployeeSearchPicker({
  value,
  onChange,
  placeholder = '輸入姓名搜尋員工...',
  activeOnly = true,
  showAppNumber = true,
  autoFocus = false,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EmpRow[]>([]);
  const [picked, setPicked] = useState<EmpRow | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 外部傳 value 進來但本地還沒解析過 → 反查一次
  useEffect(() => {
    if (!value) {
      setPicked(null);
      return;
    }
    if (picked && picked.employeeappnumber === value) return;
    employeesApi
      .getByAppNumber(value)
      .then((r) => setPicked(r.data?.data || r.data || null))
      .catch(() => setPicked(null));
  }, [value, picked]);

  // 點外面關下拉
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const doSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.length < 1) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await employeesApi.search({
          q,
          is_active: activeOnly ? true : undefined,
          limit: 12,
        });
        // 後端回 { data: [...], total } 或 { data: { data: [...] } } 不一定，做容錯
        const list: EmpRow[] = r.data?.data ?? r.data?.items ?? r.data ?? [];
        setResults(Array.isArray(list) ? list : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    doSearch(q);
  };

  const handlePick = (emp: EmpRow) => {
    setPicked(emp);
    setQuery('');
    setResults([]);
    setOpen(false);
    onChange(emp.employeeappnumber, emp);
  };

  const handleClear = () => {
    setPicked(null);
    setQuery('');
    setResults([]);
    onChange('');
  };

  // 已選狀態：顯示 chip + 清除
  if (picked) {
    return (
      <div className="border border-primary-300 rounded-md px-3 py-2 bg-primary-50 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary-900 truncate">
            {picked.name}
            {showAppNumber && <span className="ml-2 text-xs text-primary-700 font-normal">{picked.employeeappnumber}</span>}
          </p>
          <p className="text-xs text-primary-700 truncate">
            {picked.department || ''}
            {picked.store_name ? ` · ${picked.store_name}` : ''}
            {picked.title ? ` · ${picked.title}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="text-primary-600 hover:text-red-600 flex-shrink-0"
          title="清除選擇"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // 搜尋狀態
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query && setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2"
        />
      </div>
      {open && (query || loading) && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center text-sm text-gray-500">搜尋中...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-center text-sm text-gray-500">
              無符合 “{query}” 的員工
            </div>
          ) : (
            <ul>
              {results.map((emp) => (
                <li key={emp.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(emp)}
                    className="w-full text-left px-3 py-2 hover:bg-primary-50 border-b border-gray-100 last:border-0"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {emp.name}
                      <span className="ml-2 text-xs text-gray-500 font-normal">{emp.employeeappnumber}</span>
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {emp.department || ''}
                      {emp.store_name ? ` · ${emp.store_name}` : ''}
                      {emp.title ? ` · ${emp.title}` : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
