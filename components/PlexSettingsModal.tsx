import React, { useState, useEffect } from 'react';
import { PlexConfig, getPlexConfig, savePlexConfig, testPlexServerConnection } from '../plex';
import { PlexIcon } from './icons/PlexIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface PlexSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlexSettingsModal: React.FC<PlexSettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<PlexConfig>(getPlexConfig());
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getPlexConfig());
      setTestResult(null);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    savePlexConfig(config);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await testPlexServerConnection(config.serverHost, config.authToken);
    setTestResult(res);
    setIsTesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-zinc-200 relative animate-in fade-in zoom-in-95 duration-150">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <XCircleIcon className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-lg">
            <PlexIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Plexamp Integration</h2>
            <p className="text-xs text-zinc-500">Configure deep links and local server details</p>
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3 text-xs text-amber-900 space-y-1.5">
            <p className="font-semibold text-amber-950">How Plex & Plexamp Links Work:</p>
            <p>
              • <strong className="font-semibold text-amber-950">Search Plex Web</strong>: Opens hosted Plex Web or your local Plex Media Server search in a new tab with your album or artist pre-filled.
            </p>
            <p>
              • <strong className="font-semibold text-amber-950">Plexamp App</strong>: Launches the native Plexamp desktop or mobile application (`plexamp://`) and automatically copies the cleaned search query to your clipboard for instant pasting.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Plex Server Host URL (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. http://192.168.1.100:32400 or http://localhost:32400"
              value={config.serverHost}
              onChange={e => setConfig(c => ({ ...c, serverHost: e.target.value }))}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Provide your local server address to test network accessibility.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              X-Plex-Token (Optional)
            </label>
            <input
              type="password"
              placeholder="Plex Authentication Token"
              value={config.authToken}
              onChange={e => setConfig(c => ({ ...c, authToken: e.target.value }))}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {config.serverHost && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="text-xs font-medium text-amber-700 hover:text-amber-800 underline focus:outline-none disabled:opacity-50"
              >
                {isTesting ? 'Testing connection...' : 'Test Local Plex Server Connection'}
              </button>

              {testResult && (
                <div className={`mt-2 p-2.5 rounded-md text-xs ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {testResult.message}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
          {savedSuccess && <span className="text-xs text-emerald-600 font-bold">Saved!</span>}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
