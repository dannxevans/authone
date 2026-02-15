import { useState, useRef } from 'react';
import jsQR from 'jsqr';

interface QrUploadProps {
  onDetected: (uri: string) => void;
}

export default function QrUpload({ onDetected }: QrUploadProps) {
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError('');
    setScanning(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported');
          setScanning(false);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);

        if (!result) {
          setError('No QR code found in the image. Try a clearer screenshot.');
          setScanning(false);
          return;
        }

        if (!result.data.startsWith('otpauth://')) {
          setError('QR code is not an authenticator code.');
          setScanning(false);
          return;
        }

        setScanning(false);
        onDetected(result.data);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl p-8 text-center cursor-pointer transition-colors"
      >
        <div className="flex justify-center mb-2">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400">
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 5l1.5-2h3L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-white font-medium text-sm">
          Drop a screenshot here or click to browse
        </p>
        <p className="text-gray-500 text-xs mt-1">
          Screenshot your QR code and upload it
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {scanning && (
        <p className="text-center text-gray-400 text-sm">Scanning image...</p>
      )}

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
