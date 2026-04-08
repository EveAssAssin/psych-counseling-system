import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { employeesApi } from '../services/api';

/**
 * 統一入口頁面
 * 讀取 URL 參數 app_number（人員編號），自動查找員工並跳轉到詳情頁
 * 網址格式：/entry?app_number=A001&uid=LINE_UID
 */
export default function EntryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const appNumber = searchParams.get('app_number');
    // uid 保留備用，未來可做 LINE 身份驗證
    // const uid = searchParams.get('uid');

    if (!appNumber) {
      setError('網址缺少 app_number 參數');
      return;
    }

    // 用人員編號查找員工 UUID
    employeesApi
      .getByAppNumber(appNumber)
      .then((res) => {
        const employee = res.data;
        if (employee && employee.id) {
          // 跳轉到員工詳情頁
          navigate(`/employees/${employee.id}`, { replace: true });
        } else {
          setError(`找不到人員編號：${appNumber}`);
        }
      })
      .catch(() => {
        setError(`查詢失敗，人員編號：${appNumber}`);
      });
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-gray-600 text-lg">{error}</p>
          <button
            onClick={() => navigate('/employees')}
            className="mt-4 text-primary-600 underline text-sm"
          >
            前往員工列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">正在載入員工資料…</p>
      </div>
    </div>
  );
}
