import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';

// 標籤配置
const SOURCE_LABELS: Record<string, string> = {
  google_map: 'Google MAP',
  facebook: 'Facebook',
  phone: '電話客服',
  app: 'APP 客服',
  other: '其他',
};

const TYPE_LABELS: Record<string, string> = {
  positive: '正評',
  negative: '負評',
  other: '其他',
};

const URGENCY_LABELS: Record<string, string> = {
  urgent_plus: '特急',
  urgent: '緊急',
  normal: '普通',
};

const URGENCY_COLORS: Record<string, string> = {
  urgent_plus: 'text-red-600',
  urgent: 'text-orange-600',
  normal: 'text-gray-600',
};

export default function ReviewRespondPage() {
  const { token } = useParams<{ token: string }>();
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadReview();
  }, [token]);

  const loadReview = async () => {
    try {
      const res = await api.get(`/review-response/${token}`);
      setReview(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '無效的連結或評價不存在');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!response.trim()) {
      alert('請填寫回覆內容');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/review-response/${token}/respond`, {
        content: response,
      });
      setSubmitted(true);
    } catch (err: any) {
      alert(err.response?.data?.error || '提交失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-TW');
  };

  // 載入中
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 錯誤
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">😔</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">無法載入</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // 已提交（顯示成功後重新載入）
  if (submitted) {
    // 3 秒後重新載入頁面
    setTimeout(() => {
      setSubmitted(false);
      loadReview();
    }, 2000);
    
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">回覆成功！</h1>
          <p className="text-gray-600">頁面即將重新載入...</p>
        </div>
      </div>
    );
  }

  // 已結案
  if (review.status === 'closed') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">📝</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">此評價已結案</h1>
          <p className="text-gray-600">如有其他問題，請聯繫主管。</p>
        </div>
      </div>
    );
  }

  // 不需回覆
  if (!review.requires_response) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">👍</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">這是一則正面評價！</h1>
          <p className="text-gray-600">繼續保持，加油！</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 標題 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {review.review_type === 'positive' ? '正面評價' : '評價通知'}
            </h1>
            <span className={`text-sm font-medium ${URGENCY_COLORS[review.urgency]}`}>
              {URGENCY_LABELS[review.urgency]}
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">員工</span>
              <span className="font-medium">{review.employee_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">來源</span>
              <span>{SOURCE_LABELS[review.source]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">類型</span>
              <span>{TYPE_LABELS[review.review_type]}</span>
            </div>
            {review.event_date && (
              <div className="flex justify-between">
                <span className="text-gray-500">事件日期</span>
                <span>{review.event_date}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">通知時間</span>
              <span>{formatDate(review.created_at)}</span>
            </div>
            {review.response_deadline && (
              <div className="flex justify-between">
                <span className="text-gray-500">回覆期限</span>
                <span className="text-red-600">{formatDate(review.response_deadline)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 評價內容 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-3">評價內容</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-800 whitespace-pre-wrap">
              {review.content || '（無內容）'}
            </p>
          </div>
        </div>

        {/* 對話記錄 */}
        {review.responses && review.responses.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-3">對話記錄</h2>
            <div className="space-y-3">
              {review.responses.map((resp: any) => (
                <div 
                  key={resp.id} 
                  className={`rounded-lg p-4 ${
                    resp.responder_type === 'employee' 
                      ? 'bg-blue-50 border border-blue-200 ml-4' 
                      : 'bg-yellow-50 border border-yellow-200 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${
                      resp.responder_type === 'employee' ? 'text-blue-800' : 'text-yellow-800'
                    }`}>
                      {resp.responder_type === 'employee' ? '👤 我的回覆' : '📣 公關部'}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(resp.created_at)}</span>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap">{resp.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 附件 */}
        {review.attachments && review.attachments.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-3">附件</h2>
            <div className="grid grid-cols-2 gap-4">
              {review.attachments.map((att: any) => (
                <div key={att.id} className="border rounded-lg overflow-hidden">
                  {att.file_type === 'image' ? (
                    <img
                      src={att.file_url}
                      alt={att.file_name}
                      className="w-full h-40 object-cover cursor-pointer"
                      onClick={() => window.open(att.file_url, '_blank')}
                    />
                  ) : att.file_type === 'video' ? (
                    <video src={att.file_url} controls className="w-full h-40" />
                  ) : (
                    <audio src={att.file_url} controls className="w-full p-4" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 回覆表單 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-3">您的回覆</h2>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="請說明情況或提供您的回覆..."
          />

          {/* TODO: 附件上傳 */}
          <div className="mt-4 text-sm text-gray-500 bg-gray-50 p-3 rounded">
            📎 附件上傳功能開發中...
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !response.trim()}
            className="mt-4 w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '提交回覆'}
          </button>
        </div>

        {/* 說明 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>如有任何問題，請聯繫您的主管或公關部。</p>
        </div>
      </div>
    </div>
  );
}
