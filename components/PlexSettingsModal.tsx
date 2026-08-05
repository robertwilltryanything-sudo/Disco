import React, { useState, useEffect } from 'react';
import { PlexConfig, getPlexConfig, savePlexConfig, testPlexServerConnection, searchPlexLibrary } from '../plex';
import { PlexIcon } from './icons/PlexIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { CD } from '../types';

interface PlexSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection?: CD[];
  onUpdateCollection?: (updatedCollection: CD[]) => void;
}

export const PlexSettingsModal: React.FC<PlexSettingsModalProps> = ({ isOpen, onClose, collection = [], onUpdateCollection }) => {
  const [config, setConfig] = useState<PlexConfig>(getPlexConfig());
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Bulk matching state
  const [isBulkMatching, setIsBulkMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState<{ current: number; total: number; matched: number } | null>(null);
  const [bulkResultMsg, setBulkResultMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(getPlexConfig());
      setTestResult(null);
      setSavedSuccess(false);
      setBulkResultMsg(null);
      setMatchProgress(null);
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

  const handleBulkAutoLink = async (onlyUnlinked = true) => {
    if (!config.serverHost) return;
    savePlexConfig(config);

    const itemsToMatch = collection.filter(cd => onlyUnlinked ? !cd.plex_url : true);
    if (itemsToMatch.length === 0) {
      setBulkResultMsg('All albums already have Plex links!');
      return;
    }

    setIsBulkMatching(true);
    setBulkResultMsg(null);
    setMatchProgress({ current: 0, total: itemsToMatch.length, matched: 0 });

    let matchedCount = 0;
    const updatedCollection = [...collection];

    for (let i = 0; i < itemsToMatch.length; i++) {
      const targetCd = itemsToMatch[i];
      setMatchProgress({ current: i + 1, total: itemsToMatch.length, matched: matchedCount });

      try {
        const result = await searchPlexLibrary(targetCd.artist, targetCd.title);
        if (result && (result.hostedWebUrl || result.webUrl)) {
          const matchedUrl = result.hostedWebUrl || result.webUrl;
          const idx = updatedCollection.findIndex(c => c.id === targetCd.id);
          if (idx !== -1) {
            updatedCollection[idx] = { ...updatedCollection[idx], plex_url: matchedUrl };
            matchedCount++;
          }
        }
      } catch (err) {
        console.warn('Bulk match error for item:', targetCd.title, err);
      }
    }

    if (onUpdateCollection) {
      onUpdateCollection(updatedCollection);
    }

    setIsBulkMatching(false);
    setMatchProgress(null);
    setBulkResultMsg(`Finished! Successfully matched & linked ${matchedCount} out of ${itemsToMatch.length} albums on Plex Server.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-zinc-200 relative animate-in fade-in zoom-in-95 duration-150 my-8">
        <button 
          onClick={onClose}
          disabled={isBulkMatching}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-30"
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
            <p className="font-semibold text-amber-950">Automated Plex Linking:</p>
            <p>
              • <strong className="font-semibold text-amber-950">Bulk Auto-Link</strong>: Enter your Plex Server Host & Token below to automatically query your Plex Media Server and match hundreds of albums in 1-click!
            </p>
            <p>
              • <strong className="font-semibold text-amber-950">Manual Share Link</strong>: You can also paste direct share links from Plexamp (<code className="bg-amber-100/80 px-1 py-0.5 rounded text-[11px]">listen.plex.tv</code>) when editing any album.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Plex Server Host URL
            </label>
            <input
              type="text"
              placeholder="e.g. https://192-168-1-100.xxxx.plex.direct:32400 or https://plex.mydomain.com"
              value={config.serverHost}
              onChange={e => setConfig(c => ({ ...c, serverHost: e.target.value }))}
              disabled={isBulkMatching}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:bg-zinc-100"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Your Plex Media Server URL (e.g. custom domain or secure Plex URL).
            </p>

            {typeof window !== 'undefined' && window.location.protocol === 'https:' && config.serverHost.trim().startsWith('http://') && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-950 space-y-1">
                <p className="font-bold">⚠️ Mixed Content Warning:</p>
                <p className="text-[11px] text-amber-900">
                  Because this app runs over <strong>HTTPS</strong>, browsers automatically block raw <code>http://</code> local IP requests.
                </p>
                <p className="text-[11px] text-amber-900">
                  <strong>Solutions:</strong><br />
                  1. Use your secure Plex URL (e.g. <code>https://192-168-1-xxx.[hash].plex.direct:32400</code>).<br />
                  2. Use a public/custom domain with SSL (e.g. <code>https://plex.yourdomain.com</code>).<br />
                  3. Or run/host this application locally on <code>http://localhost</code>.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              X-Plex-Token (Optional / Recommended)
            </label>
            <input
              type="password"
              placeholder="Plex Authentication Token"
              value={config.authToken}
              onChange={e => setConfig(c => ({ ...c, authToken: e.target.value }))}
              disabled={isBulkMatching}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:bg-zinc-100"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Required if your Plex server requires authentication for searches.
            </p>
          </div>

          {config.serverHost && (
            <div className="pt-2 border-t border-zinc-100 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting || isBulkMatching}
                  className="text-xs font-medium text-amber-700 hover:text-amber-800 underline focus:outline-none disabled:opacity-50"
                >
                  {isTesting ? 'Testing connection...' : 'Test Server Connection'}
                </button>
              </div>

              {testResult && (
                <div className={`p-2.5 rounded-md text-xs ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {testResult.message}
                </div>
              )}

              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-lg space-y-2">
                <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <span>⚡</span> Bulk Auto-Link Collection from Plex Server
                </p>
                <p className="text-[11px] text-amber-900">
                  Automatically query your Plex Media Server to match all {collection.length} items in your library and save exact Plexamp rating key links.
                </p>

                {isBulkMatching && matchProgress && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs font-semibold text-amber-950">
                      <span>Matching album {matchProgress.current} of {matchProgress.total}...</span>
                      <span>{matchProgress.matched} matched</span>
                    </div>
                    <div className="w-full bg-amber-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-600 h-full transition-all duration-200" 
                        style={{ width: `${(matchProgress.current / matchProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {bulkResultMsg && (
                  <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2">
                    {bulkResultMsg}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleBulkAutoLink(true)}
                  disabled={isBulkMatching || isTesting}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isBulkMatching ? (
                    <span>Auto-Linking Albums...</span>
                  ) : (
                    <span>🔍 Auto-Link Unlinked Albums ({collection.filter(c => !c.plex_url).length})</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
          {savedSuccess && <span className="text-xs text-emerald-600 font-bold">Saved!</span>}
          <button
            onClick={onClose}
            disabled={isBulkMatching}
            className="px-4 py-2 border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-30"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isBulkMatching}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-30"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

