import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores';
import toast from 'react-hot-toast';

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      toast.error('登入失敗: ' + error);
      navigate('/login');
      return;
    }

    if (token) {
      login(token)
        .then(() => {
          toast.success('登入成功！');
          navigate('/dashboard');
        })
        .catch((err) => {
          toast.error('登入失敗: ' + err.message);
          navigate('/login');
        });
    } else {
      toast.error('無效的登入回應');
      navigate('/login');
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="max-w-md w-full space-y-8 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
      <p className="text-gray-600">正在處理登入...</p>
    </div>
  );
}
