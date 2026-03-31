import { useState, useRef } from 'react';
import { XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface UploadedFile {
  url: string;
  path: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface FileUploadProps {
  category: 'reviews' | 'responses' | 'conversations';
  subFolder?: string;
  onUploadComplete?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  accept?: string;
  label?: string;
}

export default function FileUpload({
  category,
  subFolder,
  onUploadComplete,
  maxFiles = 5,
  accept = 'image/*,video/*,audio/*',
  label = '上傳檔案',
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    if (files.length + selectedFiles.length > maxFiles) {
      setError(`最多只能上傳 ${maxFiles} 個檔案`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const uploadPromises = Array.from(selectedFiles).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        if (subFolder) {
          formData.append('subFolder', subFolder);
        }

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.message || '上傳失敗');
        }

        return response.json();
      });

      const results = await Promise.all(uploadPromises);
      const newFiles = [...files, ...results];
      setFiles(newFiles);
      onUploadComplete?.(newFiles);
    } catch (err: any) {
      setError(err.message || '上傳失敗');
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onUploadComplete?.(newFiles);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    return '📄';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${uploading ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'}`}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span>上傳中...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <ArrowUpTrayIcon className="h-8 w-8" />
            <span>點擊或拖曳檔案至此</span>
            <span className="text-xs text-gray-400">支援圖片、影片、音訊（最多 {maxFiles} 個）</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              {file.mimeType.startsWith('image/') ? (
                <img src={file.url} alt={file.fileName} className="w-12 h-12 object-cover rounded" />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center bg-gray-200 rounded text-2xl">
                  {getFileIcon(file.mimeType)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{file.fileName}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)}</p>
              </div>
              <button type="button" onClick={() => removeFile(index)} className="p-1 text-gray-400 hover:text-red-500">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
