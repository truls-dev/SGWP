import { useState, useEffect, useRef, useCallback } from 'react';

interface BgVideo {
  filename: string;
  url: string;
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

const CATEGORIES = ['All', 'Gaming', 'Cooking', 'Satisfying', 'Nature', 'Sports', 'Other'];

export default function VideoGalleryModal({ open, onClose, onSelect, onUpload, currentVideoUrl }: VideoGalleryModalProps) {
  const [videos, setVideos] = useState<BgVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

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

  const generateThumbnail = useCallback((url: string) => {
    if (thumbnails[url]) return;
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    video.src = url;
    video.onloadeddata = () => {
      video.currentTime = 1;
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 180;
        canvas.height = 320;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setThumbnails(prev => ({ ...prev, [url]: dataUrl }));
        }
      } catch {}
      video.src = '';
    };
    video.onerror = () => {
      setThumbnails(prev => ({ ...prev, [url]: 'error' }));
    };
  }, [thumbnails]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (!open) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const url = (entry.target as HTMLElement).dataset.videoUrl;
            if (url && !thumbnails[url]) {
              generateThumbnail(url);
            }
          }
        });
      },
      { threshold: 0.1 }
    );
    return () => observerRef.current?.disconnect();
  }, [open, generateThumbnail, thumbnails]);

  const thumbRef = useCallback((node: HTMLDivElement | null) => {
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

  if (!open) return null;

  const filtered = videos.filter(v => {
    if (filter !== 'All' && v.category !== filter) return false;
    if (search && !v.filename.toLowerCase().includes(search.toLowerCase())) return false;
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
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Background Videos</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-all">
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/10 space-y-3">
          <input
            type="text"
            placeholder="Search videos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-[#FF0054]/50 transition-colors"
            data-testid="video-gallery-search"
          />
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${filter === cat ? 'bg-[#FF0054] text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                data-testid={`video-category-${cat.toLowerCase()}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
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

            {loading && videos.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-16">
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 border-2 border-[#FF0054] border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-[10px] text-gray-500">Loading catalog...</p>
                </div>
              </div>
            )}

            {!loading && filtered.length === 0 && videos.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-16">
                <div className="text-center space-y-2">
                  <i className="fa-solid fa-film text-3xl text-gray-600"></i>
                  <p className="text-[10px] text-gray-500">No background videos in catalog yet.</p>
                  <p className="text-[9px] text-gray-600">Upload your own or add videos to bg-videos.json</p>
                </div>
              </div>
            )}

            {!loading && filtered.length === 0 && videos.length > 0 && (
              <div className="col-span-full flex items-center justify-center py-16">
                <p className="text-[10px] text-gray-500">No videos match your search.</p>
              </div>
            )}

            {filtered.map((video, i) => {
              const isSelected = currentVideoUrl === video.url;
              const thumb = thumbnails[video.url];
              return (
                <div
                  key={video.url}
                  ref={thumbRef}
                  data-video-url={video.url}
                  data-testid={`video-item-${i}`}
                  onClick={() => { onSelect(video.url); onClose(); }}
                  className={`aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer relative group transition-all hover:scale-[1.03] active:scale-95 ${isSelected ? 'ring-2 ring-[#FF0054] ring-offset-2 ring-offset-[#1a1a2e]' : 'hover:ring-1 hover:ring-white/30'}`}
                >
                  {thumb && thumb !== 'error' ? (
                    <img src={thumb} alt={video.filename} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                      {thumb === 'error' ? (
                        <i className="fa-solid fa-triangle-exclamation text-gray-600"></i>
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                  )}

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

                  <p className="absolute bottom-2 left-2 right-2 text-[8px] text-white font-bold truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {video.filename.replace(/\.[^.]+$/, '')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
