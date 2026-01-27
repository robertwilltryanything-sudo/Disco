// Added missing React import to satisfy namespace usage
import React, { useState, useRef, useEffect } from 'react';
import { CameraIcon } from './icons/CameraIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { XIcon } from './icons/XIcon';

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
            video: { 
              facingMode: 'environment',
              width: { ideal: 1080 },
              height: { ideal: 1080 }
            },
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
        // Optimize image size for API consumption (max 1024px)
        const MAX_DIMENSION = 1024;
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        
        // Export as JPEG with 0.8 quality to further reduce payload size
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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
      <div className="bg-white rounded-lg w-full max-w-2xl relative overflow-hidden shadow-2xl">
        <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-black/20 focus:outline-none focus:ring-2 focus:ring-zinc-500 z-20 transition-colors"
            aria-label="Close scanner"
        >
            <XIcon className="h-6 w-6" />
        </button>

        <div className="p-4 border-b border-zinc-200">
            <h2 className="text-xl font-bold text-center text-zinc-800">Scan Album Cover</h2>
        </div>
        <div className="p-4 bg-zinc-900 aspect-square relative flex items-center justify-center overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-900 z-10">
                <SpinnerIcon className="h-10 w-10 mb-2 animate-spin" />
                <p className="font-medium">Starting camera...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4 z-10">
              <p className="text-red-400 font-medium">{error}</p>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isLoading || error ? 'opacity-0' : 'opacity-100'}`}
            onLoadedData={handleLoadedData}
          />
          <div className={`absolute inset-0 pointer-events-none border-[30px] border-black/30 flex items-center justify-center ${isLoading || error ? 'hidden' : 'block'}`}>
             <div className="w-full h-full border-2 border-white/50 rounded-lg"></div>
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
        <div className="p-6 flex flex-col sm:flex-row items-center justify-center gap-4 bg-zinc-50">
          <button
            onClick={handleCapture}
            disabled={!!error || isLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-zinc-900 text-white font-bold py-4 px-10 rounded-xl hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-50 focus:ring-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
          >
            <CameraIcon className="h-6 w-6" />
            Capture Cover
          </button>
          <button
            onClick={onClose}
            className="w-full sm:w-auto py-4 px-10 rounded-xl bg-white text-zinc-700 font-bold border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-50 focus:ring-zinc-800 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlbumScanner;