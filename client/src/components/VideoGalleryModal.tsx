import { useState, useEffect, useRef, useCallback } from 'react';

interface BgVideo {
  filename: string;
  url: string;
  thumbnail?: string;
  duration?: string;
  category?: string;
}

interface VideoGalleryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  onUpload: () => void;
  currentVideoUrl?: string;
}

export default function VideoGalleryModal({ open, onClose, onSelect, onUpload, currentVideoUrl }: VideoGalleryModalProps) {
  const [videos, setVideos] = useState<BgVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/bg-videos.json')
      .then(r => r.json())
      .then((data: BgVideo[]) => {
        setVideos(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open]);

  const handleThumbError = useCallback((url: string) => {
    setFailedThumbs(prev => new Set(prev).add(url));
  }, []);

  if (!open) return null;

  const filtered = videos.filter(v => {
    if (search && !v.filename.toLowerCase().includes(search.toLowerCase())) return false;
    const thumb = v.thumbnail;
    if (!thumb || failedThumbs.has(thumb)) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-[95vw] max-w-[700px] max-h-[85vh] bg-[#1a1a2e] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Background Videos</h2>
            <span className="text-[9px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-all" data-testid="video-gallery-close">
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/10">
          <input
            type="text"
            placeholder="Search by number (e.g. 103)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-[#FF0054]/50 transition-colors"
            data-testid="video-gallery-search"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            <button
              onClick={() => { onUpload(); onClose(); }}
              className="aspect-[9/16] rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 hover:border-[#FF0054]/50 hover:bg-white/5 transition-all group"
              data-testid="video-gallery-upload"
            >
              <i className="fa-solid fa-cloud-arrow-up text-xl text-gray-500 group-hover:text-[#FF0054] transition-colors"></i>
              <span className="text-[9px] font-black text-gray-500 group-hover:text-gray-300 uppercase">Upload Video</span>
              <span className="text-[8px] text-gray-600">Select File</span>
            </button>

            {loading && (
              <div className="col-span-full flex items-center justify-center py-16">
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 border-2 border-[#FF0054] border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-[10px] text-gray-500">Loading catalog...</p>
                </div>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-16">
                <div className="text-center space-y-2">
                  <i className="fa-solid fa-film text-3xl text-gray-600"></i>
                  <p className="text-[10px] text-gray-500">
                    {search ? 'No videos match your search.' : 'No background videos available.'}
                  </p>
                </div>
              </div>
            )}

            {filtered.map((video, i) => {
              const isSelected = currentVideoUrl === video.url;
              return (
                <div
                  key={video.url}
                  data-testid={`video-item-${i}`}
                  onClick={() => { onSelect(video.url); onClose(); }}
                  className={`aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer relative group transition-all hover:scale-[1.03] active:scale-95 ${isSelected ? 'ring-2 ring-[#FF0054] ring-offset-2 ring-offset-[#1a1a2e]' : 'hover:ring-1 hover:ring-white/30'}`}
                >
                  <img
                    src={video.thumbnail}
                    alt={video.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={() => video.thumbnail && handleThumbError(video.thumbnail)}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  {video.duration && (
                    <span className="absolute top-2 right-2 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                      {video.duration}
                    </span>
                  )}

                  {isSelected && (
                    <div className="absolute bottom-2 left-2 w-5 h-5 bg-[#FF0054] rounded-full flex items-center justify-center">
                      <i className="fa-solid fa-check text-white text-[8px]"></i>
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[9px] text-white font-bold truncate">
                      {video.filename}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
