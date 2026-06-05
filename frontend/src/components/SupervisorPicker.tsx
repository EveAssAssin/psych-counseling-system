import { useEffect, useState } from 'react';
import { counselingApi } from '../services/api';

export interface ActingSupervisor {
  id: string;
  identifier: string;
  name: string;
  role?: string;
  has_line_binding?: boolean;
}

const LS_KEY = 'counseling.acting_supervisor';

export function getActingSupervisor(): ActingSupervisor | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActingSupervisor(s: ActingSupervisor | null) {
  if (!s) localStorage.removeItem(LS_KEY);
  else localStorage.setItem(LS_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('counseling.supervisor-changed'));
}

export default function SupervisorPicker() {
  const [list, setList] = useState<ActingSupervisor[]>([]);
  const [current, setCurrent] = useState<ActingSupervisor | null>(getActingSupervisor());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    counselingApi
      .listSupervisors()
      .then((r) => setList(r.data ?? []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const s = list.find((x) => x.id === id) || null;
    setCurrent(s);
    setActingSupervisor(s);
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">身份：</span>
      <select
        className="border border-gray-300 rounded-md px-2 py-1 bg-white"
        value={current?.id ?? ''}
        onChange={handleChange}
        disabled={loading}
      >
        <option value="">{loading ? '載入中...' : '— 請選擇輔導員 —'}</option>
        {list.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}（{s.identifier}）{s.has_line_binding ? ' ✓LINE' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
