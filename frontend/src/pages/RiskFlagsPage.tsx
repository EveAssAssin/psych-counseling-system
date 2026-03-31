import { useState, useEffect } from 'react';
// import { Link } from 'react-router-dom';
import { riskFlagsApi } from '../services/api';
import toast from 'react-hot-toast';

export default function RiskFlagsPage() {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    try {
      const response = await riskFlagsApi.getOpen({ limit: 50 });
      setFlags(response.data.data || []);
    } catch (error) {
      toast.error('載入風險標記失敗');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const badges: Record<string, string> = {
      low: 'badge-low',
      moderate: 'badge-moderate',
      high: 'badge-high',
      critical: 'badge-critical',
    };
    return badges[severity] || 'badge-low';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">風險標記</h1>
        <p className="mt-1 text-sm text-gray-500">需要關注的高風險案例</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : flags.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            目前沒有開放的風險標記 🎉
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {flags.map((flag) => (
              <li key={flag.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={getSeverityBadge(flag.severity)}>
                        {flag.severity}
                      </span>
                      <span className="text-sm text-gray-500">{flag.risk_type}</span>
                    </div>
                    <h3 className="mt-1 text-sm font-medium text-gray-900">{flag.title}</h3>
                    {flag.description && (
                      <p className="mt-1 text-sm text-gray-600">{flag.description}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                      建立於 {new Date(flag.created_at).toLocaleString('zh-TW')}
                    </p>
                  </div>
                  <div className="ml-4">
                    <span className="text-xs text-gray-500">{flag.status}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
