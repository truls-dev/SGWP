import { useState, useEffect, useCallback } from 'react';
import type { Export } from '@shared/schema';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number | null): string {
  if (!ms) return '';
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}:${remainSecs.toString().padStart(2, '0')}`;
}

interface ExportHistoryPanelProps {
  onLoadScript?: (scriptData: string) => void;
}

export function ExportHistoryPanel({ onLoadScript }: ExportHistoryPanelProps) {
  const [exports, setExports] = useState<Export[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchExports = useCallback(async () => {
    try {
      const res = await fetch('/api/exports');
      if (res.ok) {
        const data = await res.json();
        setExports(data);
      }
    } catch (e) {
      console.error('Failed to fetch exports:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExports();
    const interval = setInterval(fetchExports, 10000);
    return () => clearInterval(interval);
  }, [fetchExports]);

  const handleDownload = async (exp: Export) => {
    setDownloading(exp.id);
    try {
      const res = await fetch(`/api/exports/${exp.id}/download`);
      if (!res.ok) throw new Error('Failed to get download URL');
      const { downloadUrl } = await res.json();
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = exp.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Download failed:', e);
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (exp: Export) => {
    if (!confirm(`Delete "${exp.fileName}"? This cannot be undone.`)) return;
    setDeleting(exp.id);
    try {
      const res = await fetch(`/api/exports/${exp.id}`, { method: 'DELETE' });
      if (res.ok) {
        setExports(prev => prev.filter(e => e.id !== exp.id));
      }
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeleting(null);
    }
  };

  const handleLoadScript = (exp: Export) => {
    if (!exp.scriptData || !onLoadScript) return;
    if (!confirm('Load this script? This will replace your current script and cast.')) return;
    onLoadScript(exp.scriptData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-[#33B5FF] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (exports.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="text-3xl">📁</div>
        <p className="text-sm text-gray-400">No exports yet</p>
        <p className="text-[10px] text-gray-600">Your exported videos will appear here for cross-device access</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {exports.map(exp => (
        <div
          key={exp.id}
          data-testid={`export-item-${exp.id}`}
          className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{exp.fileName}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-gray-400">{formatBytes(exp.fileSize)}</span>
                {exp.durationMs && (
                  <span className="text-[10px] text-gray-400">{formatDuration(exp.durationMs)}</span>
                )}
                <span className="text-[10px] text-gray-500">{formatDate(exp.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              data-testid={`download-export-${exp.id}`}
              onClick={() => handleDownload(exp)}
              disabled={downloading === exp.id}
              className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#33B5FF] text-white hover:bg-[#2da5ef] transition-all disabled:opacity-50"
            >
              {downloading === exp.id ? 'Getting link...' : 'Download'}
            </button>
            {exp.scriptData && onLoadScript && (
              <button
                data-testid={`load-script-${exp.id}`}
                onClick={() => handleLoadScript(exp)}
                className="py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#FFFC00]/10 border border-[#FFFC00]/30 text-[#FFFC00] hover:bg-[#FFFC00]/20 transition-all"
              >
                Load Script
              </button>
            )}
            <button
              data-testid={`delete-export-${exp.id}`}
              onClick={() => handleDelete(exp)}
              disabled={deleting === exp.id}
              className="py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 text-gray-400 hover:border-red-500/50 hover:text-red-400 transition-all disabled:opacity-50"
            >
              {deleting === exp.id ? '...' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
