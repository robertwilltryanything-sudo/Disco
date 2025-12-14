import React, { useState, useRef, useEffect } from 'react';
import { CameraIcon } from './icons/CameraIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface AlbumScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageBase64: string) => void;
}

const AlbumScanner: React.FC<AlbumScannerProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const cleanupCamera = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
      }
    };

    if (isOpen) {
      const getCamera = async () => {
        setError(null);
        setIsLoading(true);
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          streamRef.current = mediaStream;
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          if (err instanceof Error) {
              if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                  setError("Camera permission denied. Please enable it in your browser settings.");
              } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                  setError("No camera found. Please connect a camera and try again.");
              } else {
                   setError("Could not access the camera. Please try again.");
              }
          } else {
             setError("An unknown error occurred while accessing the camera.");
          }
        } finally {
            setIsLoading(false);
        }
      };
      getCamera();
    }
    
    return cleanupCamera;
  }, [isOpen]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= video.HAVE_METADATA) {
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64 = dataUrl.split(',')[1];
        onCapture(base64);
      }
    }
  };
  
  const handleLoadedData = () => {
    setIsLoading(false);
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg w-full max-w-lg relative overflow-hidden">
        <div className="p-4 border-b border-zinc-200">
            <h2 className="text-xl font-bold text-center text-zinc-800">Scan Album Cover</h2>
        </div>
        <div className="p-4 bg-zinc-900 aspect-video relative flex items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-900 z-10">
                <SpinnerIcon className="h-8 w-8 mb-2" />
                <p>Starting camera...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4 z-10">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-contain ${isLoading || error ? 'opacity-0' : 'opacity-100'}`}
            onLoadedData={handleLoadedData}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
        <div className="p-4 flex flex-col sm:flex-row items-center justify-center gap-4 bg-zinc-50">
          <button
            onClick={handleCapture}
            disabled={!!error || isLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-3 px-6 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-50 focus:ring-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CameraIcon className="h-6 w-6" />
            Capture
          </button>
          <button
            onClick={onClose}
            className="w-full sm:w-auto py-3 px-6 rounded-lg bg-white text-zinc-700 font-medium border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-50 focus:ring-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlbumScanner;