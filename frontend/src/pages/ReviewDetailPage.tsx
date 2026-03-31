import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import FileUpload from '../components/FileUpload';

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

const TYPE_COLORS: Record<string, string> = {
  positive: 'bg-green-100 text-green-800',
  negative: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-800',
};

const URGENCY_LABELS: Record<string, string> = {
  urgent_plus: '特急',
  urgent: '緊急',
  normal: '普通',
};

const URGENCY_COLORS: Record<string, string> = {
  urgent_plus: 'bg-red-600 text-white',
  urgent: 'bg-orange-500 text-white',
  normal: 'bg-gray-200 text-gray-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待處理',
  responded: '已回覆',
  closed: '已結案',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  responded: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [closeNote, setCloseNote] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/reviews/${id}`);
      toast.success('評價已刪除');
      navigate('/reviews');
    } catch (error: any) {
      toast.error(error.response?.data?.error || '刪除失敗');
    } finally {
      setDeleting(false);
    }
  };
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const res = await api.get(`/reviews/${id}`);
      setReview(res.data.data);
    } catch (error) {
      toast.error('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      await api.put(`/reviews/${id}/close`, { close_note: closeNote });
      toast.success('已結案');
      setShowCloseModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '結案失敗');
    } finally {
      setClosing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-TW');
  };

  const copyResponseLink = () => {
    const link = `${window.location.origin}/review/respond/${review.response_token}`;
    navigator.clipboard.writeText(link);
    toast.success('已複製連結');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!review) {
    return <div className="text-center py-8">找不到評價記錄</div>;
  }

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center gap-4">
        <Link to="/reviews" className="text-gray-400 hover:text-gray-600">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">評價詳情</h1>
        </div>
        {review.status !== 'closed' && (
          <button
            onClick={() => setShowCloseModal(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            結案
          </button>
        )}
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
        >
          <TrashIcon className="h-4 w-4" />
          刪除
        </button>
      </div>

      {/* 狀態標籤 */}
      <div className="flex gap-3">
        <span className={`px-3 py-1 text-sm font-medium rounded ${TYPE_COLORS[review.review_type]}`}>
          {TYPE_LABELS[review.review_type]}
        </span>
        <span className={`px-3 py-1 text-sm font-medium rounded ${URGENCY_COLORS[review.urgency]}`}>
          {URGENCY_LABELS[review.urgency]}
        </span>
        <span className={`px-3 py-1 text-sm font-medium rounded ${STATUS_COLORS[review.status]}`}>
          {STATUS_LABELS[review.status]}
        </span>
        {review.is_proxy && (
          <span className="px-3 py-1 text-sm font-medium rounded bg-orange-100 text-orange-800">
            代理處理
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 基本資訊 */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">基本資訊</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">來源</dt>
              <dd className="text-sm font-medium">{SOURCE_LABELS[review.source]}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">事件日期</dt>
              <dd className="text-sm font-medium">{review.event_date || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">建立時間</dt>
              <dd className="text-sm font-medium">{formatDate(review.created_at)}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">需要回覆</dt>
              <dd className="text-sm font-medium">{review.requires_response ? '是' : '否'}</dd>
            </div>
            {review.response_deadline && (
              <div>
                <dt className="text-sm text-gray-500">回覆期限</dt>
                <dd className="text-sm font-medium">{formatDate(review.response_deadline)}</dd>
              </div>
            )}
            {review.responded_at && (
              <div>
                <dt className="text-sm text-gray-500">回覆時間</dt>
                <dd className="text-sm font-medium">{formatDate(review.responded_at)}</dd>
              </div>
            )}
            {review.response_speed_hours != null && (
              <div>
                <dt className="text-sm text-gray-500">回覆速度</dt>
                <dd className="text-sm font-medium text-green-600">
                  {review.response_speed_hours.toFixed(1)} 小時
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* 員工資訊 + 回覆連結 */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-900 mb-4">指定員工</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">{review.employee_name || '未知'}</p>
              {review.is_proxy && (
                <p className="text-sm text-orange-600">（代理處理，非針對本人）</p>
              )}
            </div>
            {review.requires_response && review.status !== 'closed' && (
              <button
                onClick={copyResponseLink}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                📋 複製回覆連結
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 評價內容 */}
      <div className="card p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">評價內容</h2>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-gray-800 whitespace-pre-wrap">
            {review.content || '（無內容）'}
          </p>
        </div>
      </div>

      {/* 附件 */}
      {review.attachments && review.attachments.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">附件</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {review.attachments.map((att: any) => (
              <div key={att.id} className="border rounded-lg p-2">
                {att.file_type === 'image' ? (
                  <img src={att.file_url} alt={att.file_name} className="w-full h-32 object-cover rounded" />
                ) : (
                  <div className="h-32 flex items-center justify-center bg-gray-100 rounded">
                    <span className="text-2xl">
                      {att.file_type === 'video' ? '🎥' : '🎵'}
                    </span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1 truncate">{att.file_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 對話記錄 */}
      <div className="card p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">對話記錄</h2>
        
        {/* 原始評價內容 */}
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">📋 評價內容</span>
            <span className="text-xs text-gray-500">{formatDate(review.created_at)}</span>
          </div>
          <p className="text-gray-800 whitespace-pre-wrap">{review.content || '（無內容）'}</p>
        </div>

        {/* 回覆列表 */}
        {review.responses && review.responses.length > 0 && (
          <div className="space-y-3 mb-4">
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
                    {resp.responder_type === 'employee' ? '👤 員工' : '📣 公關部'}
                    {resp.responder_name && ` - ${resp.responder_name}`}
                  </span>
                  <span className="text-xs text-gray-500">{formatDate(resp.created_at)}</span>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{resp.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* 公關部回覆表單 */}
        {review.status !== 'closed' && (
          <ReviewerResponseForm reviewId={review.id} onSuccess={loadData} />
        )}
      </div>

      {/* 結案備註 */}
      {review.status === 'closed' && review.close_note && (
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">結案備註</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-800">{review.close_note}</p>
            <p className="text-xs text-gray-500 mt-2">
              結案時間：{formatDate(review.closed_at)}
            </p>
          </div>
        </div>
      )}

      {/* 結案 Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">結案評價</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                結案備註（選填）
              </label>
              <textarea
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                rows={3}
                className="input-field w-full"
                placeholder="填寫處理結果或備註..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleClose}
                disabled={closing}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                {closing ? '結案中...' : '確認結案'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認 Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-600">確認刪除</h3>
            <p className="text-gray-600 mb-4">
              確定要刪除這筆評價嗎？此操作無法復原，所有相關的回覆和附件都會一併刪除。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 公關部回覆表單元件
// ============================================
function ReviewerResponseForm({
  reviewId,
  onSuccess,
}: {
  reviewId: string;
  onSuccess: () => void;
}) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewerAttachments, setReviewerAttachments] = useState<any[]>([]);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/reviews/${reviewId}/respond`, {
        content: content,
        reviewer_name: '公關部', // TODO: 從登入用戶取得
        attachments: reviewerAttachments,
      });
      toast.success('回覆成功');
      setContent('');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '回覆失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t pt-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        追問或補充說明
      </label>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="input-field w-full"
        placeholder="輸入要追問或補充的內容..."
      />
      <div className="mt-3">
        <FileUpload
          category="responses"
          subFolder={reviewId}
          label="附件（可選）"
          maxFiles={3}
          onUploadComplete={(files) => setReviewerAttachments(files)}
        />
      </div>
      <div className="flex justify-end mt-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
        >
          {submitting ? '送出中...' : '送出回覆'}
        </button>
      </div>
    </div>
  );
}
