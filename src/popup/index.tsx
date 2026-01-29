import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Shield, Play, Square, Download, Settings as SettingsIcon } from 'lucide-react';
import '../index.css';

const Popup = () => {
    const [tab, setTab] = useState<'dashboard' | 'settings'>('dashboard');
    const [isScanning, setIsScanning] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [totalReviews, setTotalReviews] = useState(0);
    const [waitingInfo, setWaitingInfo] = useState<{ until: number } | null>(null);
    const [countdown, setCountdown] = useState<number>(0);

    // Delay settings
    const [delayMin, setDelayMin] = useState(2000);
    const [delayMax, setDelayMax] = useState(5000);

    // Countdown effect
    useEffect(() => {
        if (!waitingInfo) {
            setCountdown(0);
            return;
        }

        const interval = setInterval(() => {
            const left = Math.ceil((waitingInfo.until - Date.now()) / 1000);
            if (left <= 0) {
                setCountdown(0);
                setWaitingInfo(null);
            } else {
                setCountdown(left);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [waitingInfo]);

    // Helper functions
    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
    };

    const handleSaveSettings = () => {
        chrome.storage.local.set({
            delaySettings: { min: delayMin, max: delayMax }
        });
        addLog(`Settings saved: ${delayMin}-${delayMax}ms delay`);
        setTab('dashboard');
    };

    const toggleScan = () => {
        if (isScanning) {
            setIsScanning(false);
            chrome.runtime.sendMessage({ type: 'STOP_SCRAPING' });
            addLog('Stopped scanning');
        } else {
            setIsScanning(true);
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.url) {
                    chrome.runtime.sendMessage({ type: 'START_SCRAPING', url: tabs[0].url });
                    addLog('Starting scan on current URL...');
                }
            });
        }
    };

    const handleExportCSV = async () => {
        const response: any = await chrome.runtime.sendMessage({ type: 'DOWNLOAD_CSV' });
        if (response.success && response.csv) {
            const blob = new Blob([response.csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `amazon-reviews-${Date.now()}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            addLog(`Exported ${totalReviews} reviews to CSV`);
        } else {
            addLog('Export failed: ' + (response.error || 'Unknown error'));
        }
    };

    // Initialize
    useEffect(() => {
        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response: any) => {
            if (response) {
                setIsScanning(response.isScanning);
                setTotalReviews(response.total);
            }
        });

        // Load delay settings
        chrome.storage.local.get(['delaySettings'], (result) => {
            if (result.delaySettings) {
                setDelayMin(result.delaySettings.min);
                setDelayMax(result.delaySettings.max);
            }
        });

        // Listen for updates
        const listener = (message: any) => {
            if (message.type === 'STATS_UPDATED') {
                setTotalReviews(message.payload.total);
                if (message.payload.lastLog) addLog(message.payload.lastLog);
            }
            if (message.type === 'LOG') {
                const logMsg = message.payload?.message || message.message;
                if (logMsg) addLog(logMsg);
            }
            if (message.type === 'WAITING_STATUS') {
                setWaitingInfo({ until: Date.now() + message.payload.duration });
                addLog(`⏳ Waiting ${Math.round(message.payload.duration / 1000)}s for next action...`);
            }
            if (message.type === 'SCRAPING_COMPLETE') {
                setIsScanning(false);
                addLog(`🎉 Scraping complete! Total: ${message.payload.total} reviews`);
            }
            if (message.type === 'SCRAPING_STARTED') {
                setIsScanning(true);
                addLog('▶️ Scraping started');
            }
            if (message.type === 'SCRAPING_STOPPED') {
                setIsScanning(false);
                addLog('⏹️ Scraping stopped');
            }
        };
        chrome.runtime.onMessage.addListener(listener);

        return () => chrome.runtime.onMessage.removeListener(listener);
    }, []);

    return (
        <div className="w-[400px] h-[600px] bg-gradient-to-br from-slate-50 to-slate-100 font-sans">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white shadow-lg">
                <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6" />
                    <div>
                        <h1 className="text-lg font-bold">Amazon Review Scraper</h1>
                        <p className="text-xs text-blue-100">Auto-resume • All filters</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-white">
                <button
                    onClick={() => setTab('dashboard')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${tab === 'dashboard'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    Dashboard
                </button>
                <button
                    onClick={() => setTab('settings')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${tab === 'settings'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <SettingsIcon className="w-4 h-4" />
                        Settings
                    </div>
                </button>
            </div>

            {/* Content */}
            {tab === 'dashboard' ? (
                <div className="p-4 space-y-4">
                    {/* Stats Card */}
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide">Collected Reviews</p>
                                <p className="text-3xl font-bold text-slate-800 mt-1">{totalReviews}</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-medium ${isScanning ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                {isScanning ? 'Running...' : 'Idle'}
                            </div>
                        </div>

                        {/* Countdown */}
                        {countdown > 0 && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                Next action in {countdown}s
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex gap-2">
                        <button
                            onClick={toggleScan}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium shadow-sm transition-all ${isScanning
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                                }`}
                        >
                            {isScanning ? (
                                <>
                                    <Square className="w-4 h-4" />
                                    Stop
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    Start
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleExportCSV}
                            disabled={totalReviews === 0}
                            className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-all flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    </div>

                    {/* Logs */}
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                        <h2 className="text-sm font-semibold text-slate-700 mb-3">Activity Logs</h2>
                        <div className="h-64 overflow-y-auto space-y-1 text-xs font-mono bg-slate-50 p-3 rounded border border-slate-200">
                            {logs.length === 0 ? (
                                <p className="text-slate-400 text-center py-8">No activity yet. Click Start to begin.</p>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className="text-slate-600 leading-relaxed">
                                        {log}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="text-center text-xs text-slate-500">
                        <p>Auto-scrapes all star filters (1★ → 5★)</p>
                        <p className="mt-1">Delay: {delayMin / 1000}-{delayMax / 1000}s between pages</p>
                    </div>
                </div>
            ) : (
                <div className="p-4 space-y-4">
                    {/* Timing Settings */}
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                        <h2 className="text-sm font-semibold text-slate-700 mb-4">⏱️ Timing Configuration</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-2">
                                    Minimum Delay (ms)
                                </label>
                                <input
                                    type="number"
                                    value={delayMin}
                                    onChange={(e) => setDelayMin(Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    min="1000"
                                    max="10000"
                                    step="500"
                                />
                                <p className="text-xs text-slate-500 mt-1">{delayMin / 1000} seconds</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-2">
                                    Maximum Delay (ms)
                                </label>
                                <input
                                    type="number"
                                    value={delayMax}
                                    onChange={(e) => setDelayMax(Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    min="1000"
                                    max="15000"
                                    step="500"
                                />
                                <p className="text-xs text-slate-500 mt-1">{delayMax / 1000} seconds</p>
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-xs text-blue-800">
                                    💡 <strong>Recommended:</strong> 2000-5000ms (2-5 seconds)
                                </p>
                                <p className="text-xs text-blue-700 mt-1">
                                    Higher delays = slower but safer (less likely to trigger rate limits)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSaveSettings}
                        className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-sm transition-all"
                    >
                        Save Configuration
                    </button>

                    {/* Info */}
                    <div className="text-xs text-slate-500 text-center space-y-1">
                        <p>⚡ Changes take effect on next page navigation</p>
                        <p>🔄 Extension will wait random time between min-max</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// Render
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<Popup />);
}
