import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores';

/**
 * 統一入口頁面
 *
 * 樂活統一入口跳轉到此頁，URL 帶 ?app_number=A1234
 * 流程：
 *   1. 從 URL 讀 app_number
 *   2. 呼叫 POST /auth/by-app-number 自動登入
 *   3. 成功 → 拿到 JWT、存 localStorage、更新 store、導 dashboard
 *      （若帶 ?redirect=/some/path 則導向指定路徑）
 *   4. 失敗 → 顯示具體原因（找不到員工 / 未授權 / 帳號停用）
 */
export default function EntryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [appNumber, setAppNumber] = useState<string>('');

  useEffect(() => {
    const appNum = searchParams.get('app_number');
    const redirect = searchParams.get('redirect') || '/dashboard';

    if (!appNum) {
      setError({
        title: '網址不完整',
        message: '此頁面需要從樂活統一入口跳轉，URL 必須帶 ?app_number=員工編號。',
      });
      return;
    }
    setAppNumber(appNum);

    // 呼叫 by-app-number 自動登入
    authApi
      .loginByAppNumber(appNum)
      .then(async (res) => {
        const token = res.data?.access_token;
        if (!token) {
          setError({
            title: '登入失敗',
            message: '伺服器未回傳 token，請聯絡系統管理員。',
          });
          return;
        }
        // 透過 useAuthStore.login 存 token + 載入 user/roles
        await login(token);
        // 導到目標頁
        navigate(redirect, { replace: true });
      })
      .catch((err) => {
        const status = err?.response?.status;
        const serverMsg = err?.response?.data?.message;
        if (status === 404) {
          setError({
            title: '找不到員工',
            message: serverMsg || `系統中找不到員工編號「${appNum}」。請確認編號是否正確，或聯絡系統管理員。`,
          });
        } else if (status === 403) {
          setError({
            title: '尚未取得存取權限',
            message: serverMsg || `您（員工編號 ${appNum}）尚未被授權使用此系統。請聯絡系統管理員開通權限。`,
          });
        } else {
          setError({
            title: '登入失敗',
            message: serverMsg || `無法登入。錯誤：${err?.message || '未知錯誤'}`,
          });
        }
      });
  }, [searchParams, navigate, login]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">{error.title}</h1>
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{error.message}</p>
          {appNumber && (
            <p className="text-xs text-gray-400 mt-4">員工編號：{appNumber}</p>
          )}
          <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-500">
            如有疑問請聯絡系統管理員開通權限
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">正在驗證身分…</p>
        {appNumber && <p className="text-xs text-gray-400 mt-1">員工編號：{appNumber}</p>}
      </div>
    </div>
  );
}
