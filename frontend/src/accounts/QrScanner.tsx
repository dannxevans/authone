import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface QrScannerProps {
  onDetected: (uri: string) => void;
}

export default function QrScanner({ onDetected }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let stopped = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setScanning(true);
          scan();
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Camera access denied';
        setError(
          msg.includes('Permission denied') || msg.includes('NotAllowed')
            ? 'Camera permission denied. Use the "Upload image" tab instead.'
            : `Camera error: ${msg}`
        );
      }
    };

    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);

      if (result?.data.startsWith('otpauth://')) {
        stopCamera();
        onDetected(result.data);
        return;
      }

      rafRef.current = requestAnimationFrame(scan);
    };

    void startCamera();

    return () => {
      stopped = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  return (
    <div className="space-y-3">
      {error ? (
        <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-3 py-4 text-center">
          {error}
        </div>
      ) : (
        <>
          <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-xs mx-auto">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* Viewfinder overlay */}
                <div className="w-48 h-48 border-2 border-white/60 rounded-xl relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-blue-400 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-blue-400 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-blue-400 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-blue-400 rounded-br-xl" />
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-center text-gray-400 text-xs">
            Point camera at your authenticator QR code
          </p>
        </>
      )}
    </div>
  );
}
