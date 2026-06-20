"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Film, Search, X, AlertCircle, Clapperboard, Play, Plus } from "lucide-react";

interface SimilarMovie { title: string; year: number; reason: string; }
interface SimilarMovieWithPoster extends SimilarMovie { poster: string | null; }
interface MovieResult {
  movie: string | null;
  original_title?: string;
  year?: number;
  director?: string;
  actors_recognized?: string[];
  reasoning?: string;
  confidence: number;
  scene_description: string;
  similar_movies?: SimilarMovie[];
}

interface ImageEntry { base64: string; mediaType: string; preview: string; }

function youtubeTrailerUrl(title: string, year?: number) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${year ?? ""} official trailer`)}`;
}

function GradientBorderCard({ children, from, to }: { children: React.ReactNode; from: string; to: string }) {
  return (
    <div style={{ padding: 1, borderRadius: 16, background: `linear-gradient(135deg, ${from}, ${to})` }}>
      <div style={{ borderRadius: 15, background: "#0f0f1c", padding: "1rem 1.25rem" }}>
        {children}
      </div>
    </div>
  );
}

function SimilarMovieCard({ film }: { film: SimilarMovieWithPoster }) {
  return (
    <a href={youtubeTrailerUrl(film.title, film.year)} target="_blank" rel="noopener noreferrer" className="group block" style={{ padding: 1, borderRadius: 14, background: "linear-gradient(135deg, #7C3AED44, #06B6D444)" }}>
      <div className="flex gap-3 transition-all" style={{ borderRadius: 13, background: "#0f0f1c", overflow: "hidden" }}
        onMouseEnter={e => (e.currentTarget.style.background = "#141426")}
        onMouseLeave={e => (e.currentTarget.style.background = "#0f0f1c")}
      >
        <div className="shrink-0 relative" style={{ width: 64, minHeight: 88, background: "#1a1a2e" }}>
          {film.poster
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={film.poster} alt={film.title} className="w-full h-full object-cover absolute inset-0" />
            : <div className="w-full h-full flex items-center justify-center" style={{ minHeight: 88 }}><Film className="w-6 h-6" style={{ color: "#7C3AED" }} /></div>
          }
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition" style={{ background: "rgba(0,0,0,0.55)" }}>
            <Play className="w-5 h-5 fill-white text-white" />
          </div>
        </div>
        <div className="py-3 pr-2 min-w-0">
          <p className="text-white text-sm font-medium leading-tight">{film.title} <span style={{ color: "#6B7280" }}>({film.year})</span></p>
          <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: "#9CA3AF" }}>{film.reason}</p>
          <p className="text-xs mt-1 opacity-0 group-hover:opacity-100 transition" style={{ color: "#06B6D4" }}>צפה בטריילר ←</p>
        </div>
      </div>
    </a>
  );
}

function compressFile(file: File): Promise<ImageEntry> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg", preview: dataUrl });
    };
    img.src = objectUrl;
  });
}

export default function Home() {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [result, setResult] = useState<MovieResult | null>(null);
  const [similarWithPosters, setSimilarWithPosters] = useState<SimilarMovieWithPoster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!result?.similar_movies?.length) { setSimilarWithPosters([]); return; }
    const movies = result.similar_movies;
    setSimilarWithPosters(movies.map(m => ({ ...m, poster: null })));
    movies.forEach(async (film, i) => {
      try {
        const res = await fetch(`/api/poster?title=${encodeURIComponent(film.title)}&year=${film.year}`);
        const data = await res.json();
        setSimilarWithPosters(prev => { const next = [...prev]; next[i] = { ...next[i], poster: data.poster ?? null }; return next; });
      } catch { /* keep null */ }
    });
  }, [result]);

  const addFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (images.length >= 3) return;
    setResult(null); setError(null);
    const entry = await compressFile(file);
    setImages(prev => [...prev, entry]);
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setResult(null); setError(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) addFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const identify = async () => {
    if (!images.length) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: images.map(i => ({ image: i.base64, mediaType: i.mediaType })) }),
      });
      let data: { error?: string } & Record<string, unknown>;
      try { data = await res.json(); }
      catch { throw new Error("הזיהוי לקח יותר מדי זמן — נסה עם תמונה אחת או קטנה יותר"); }
      if (!res.ok) throw new Error(data.error || "שגיאה");
      setResult(data as MovieResult);
    } catch (err) { setError(err instanceof Error ? err.message : "שגיאה"); }
    finally { setLoading(false); }
  };

  const reset = () => { setImages([]); setResult(null); setError(null); setSimilarWithPosters([]); };

  const confidenceColor = !result ? "#6B7280" : result.confidence >= 80 ? "#10B981" : result.confidence >= 50 ? "#F59E0B" : "#EF4444";

  return (
    <main dir="rtl" className="min-h-screen flex flex-col items-center px-4 py-16 relative overflow-hidden"
      style={{ background: "#0d0d16", fontFamily: "var(--font-rubik), sans-serif", color: "white" }}>

      {/* Decorative animated snake lines */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="snake-h absolute" style={{ top: 80, left: 0, right: 0 }} />
        <div className="snake-v absolute" style={{ top: 0, bottom: 0, right: 0 }} />
        <div className="snake-h absolute" style={{ bottom: 120, left: 0, right: 0 }} />
        <div className="snake-v-pink absolute" style={{ top: 0, bottom: 0, left: 0 }} />
        <div className="snake-h-cyan absolute" style={{ top: "45%", left: 0, right: 0 }} />
        <div className="absolute rounded-full" style={{ top: -100, right: -100, width: 300, height: 300, background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)" }} />
        <div className="absolute rounded-full" style={{ bottom: -80, left: -80, width: 250, height: 250, background: "radial-gradient(circle, rgba(236,72,153,0.05) 0%, transparent 70%)" }} />
      </div>

      {/* Header */}
      <div className="text-center mb-10 relative z-10">
        <h1 className="tracking-widest leading-none mb-1 select-none" style={{ fontFamily: "var(--font-karantina), sans-serif", fontSize: "clamp(3.5rem, 12vw, 6rem)", fontWeight: 700, WebkitTextStroke: "2px #4a9ebe", color: "transparent", letterSpacing: "0.08em" }}>מזהה</h1>
        <h1 className="tracking-widest leading-none mb-4" style={{ fontFamily: "var(--font-karantina), sans-serif", fontSize: "clamp(3.5rem, 12vw, 6rem)", fontWeight: 700, background: "linear-gradient(135deg, #7C3AED, #EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.08em" }}>סרטים</h1>
        <div className="mx-auto mb-5" style={{ width: 80, height: 2, background: "linear-gradient(to right, #7C3AED, #EC4899)" }} />
        <p style={{ color: "#9CA3AF", fontSize: "0.95rem" }}>העלה עד 3 תמונות מאותו סרט — ככל שתוסיף יותר, הזיהוי יהיה מדויק יותר</p>
      </div>

      <div className="w-full max-w-xl relative z-10">
        {images.length === 0 ? (
          /* Upload zone */
          <div style={{ padding: 1, borderRadius: 20, background: dragging ? "linear-gradient(135deg, #7C3AED, #EC4899)" : "linear-gradient(135deg, #7C3AED33, #EC489933)" }}>
            <div
              className="flex flex-col items-center gap-4 cursor-pointer transition-all"
              style={{ borderRadius: 19, background: "#0f0f1c", padding: "4rem 2rem" }}
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => inputRef.current?.click()}
            >
              <div className="rounded-full flex items-center justify-center" style={{ width: 64, height: 64, background: "linear-gradient(135deg, #7C3AED22, #EC489922)", border: "1px solid #7C3AED55" }}>
                <Upload className="w-7 h-7" style={{ color: dragging ? "#EC4899" : "#7C3AED" }} />
              </div>
              <p style={{ color: "#D1D5DB" }}>גרור תמונה לכאן</p>
              <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>או לחץ לבחירת קובץ</p>
              <p style={{ color: "#374151", fontSize: "0.75rem" }}>JPG, PNG, WEBP</p>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && addFile(e.target.files[0])} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image grid */}
            <div className="grid gap-3" style={{ gridTemplateColumns: images.length === 1 ? "1fr" : "repeat(3, 1fr)" }}>
              {images.map((img, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden" style={{ border: "1px solid #ffffff15", aspectRatio: images.length === 1 ? "16/9" : "1/1" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt={`תמונה ${idx + 1}`} className="w-full h-full object-cover" />
                  {!result && (
                    <button onClick={() => removeImage(idx)} className="absolute top-2 left-2 rounded-full p-1 transition" style={{ background: "rgba(0,0,0,0.75)", border: "1px solid #ffffff20" }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-xs" style={{ background: "rgba(0,0,0,0.65)", color: "#9CA3AF" }}>{idx + 1}</div>
                </div>
              ))}

              {/* Add more slot — up to 3 total */}
              {!result && images.length < 3 && (
                <div
                  className="rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all"
                  style={{ border: "1px dashed #7C3AED55", aspectRatio: "1/1", background: "#7C3AED08" }}
                  onClick={() => extraInputRef.current?.click()}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#7C3AED99"; e.currentTarget.style.background = "#7C3AED14"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#7C3AED55"; e.currentTarget.style.background = "#7C3AED08"; }}
                >
                  <Plus className="w-5 h-5" style={{ color: "#7C3AED" }} />
                  <span className="text-xs" style={{ color: "#6B7280" }}>הוסף תמונה</span>
                  <input ref={extraInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && addFile(e.target.files[0])} />
                </div>
              )}
            </div>

            {/* Image count indicator */}
            {!result && (
              <div className="flex items-center gap-2 justify-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="rounded-full transition-all" style={{ width: 6, height: 6, background: i < images.length ? "#7C3AED" : "#ffffff18" }} />
                ))}
                <span className="text-xs mr-1" style={{ color: "#6B7280" }}>{images.length}/3 תמונות</span>
              </div>
            )}

            {/* Identify button */}
            {!result && (
              <button onClick={identify} disabled={loading} className="w-full rounded-xl font-bold text-lg transition-all" style={{ padding: 1, background: "transparent" }}>
                <div className="w-full py-3.5 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all"
                  style={{ background: loading ? "linear-gradient(135deg, #7C3AED33, #EC489933)" : "linear-gradient(135deg, #7C3AED, #EC4899)", color: loading ? "#9CA3AF" : "white", cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading
                    ? <><div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />מזהה סרט...</>
                    : <><Search className="w-5 h-5" />זהה סרט</>}
                </div>
              </button>
            )}

            {/* Error */}
            {error && (
              <GradientBorderCard from="#EF444444" to="#EC489944">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" style={{ color: "#F87171" }} />
                  <p style={{ color: "#FCA5A5" }}>{error}</p>
                </div>
              </GradientBorderCard>
            )}

            {/* Result */}
            {result && (
              <GradientBorderCard from="#7C3AED" to="#06B6D4">
                <div className="space-y-4">
                  {result.movie ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-2xl font-bold leading-tight">{result.movie}</h2>
                          {result.original_title && result.original_title !== result.movie && (
                            <p className="text-sm mt-0.5" style={{ color: "#9CA3AF" }}>{result.original_title}</p>
                          )}
                          <div className="flex gap-3 mt-1 text-sm" style={{ color: "#9CA3AF" }}>
                            {result.year && <span>{result.year}</span>}
                            {result.director && <><span>·</span><span>{result.director}</span></>}
                          </div>
                        </div>
                        <a href={youtubeTrailerUrl(result.movie, result.year)} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all"
                          style={{ background: "linear-gradient(135deg, #EC489922, #7C3AED22)", border: "1px solid #EC489966", color: "white" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "linear-gradient(135deg, #EC489944, #7C3AED44)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "linear-gradient(135deg, #EC489922, #7C3AED22)")}
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />טריילר
                        </a>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span style={{ color: "#9CA3AF" }}>רמת ביטחון</span>
                          <span className="font-semibold" style={{ color: confidenceColor }}>{result.confidence}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1F2937" }}>
                          <div className="h-full rounded-full" style={{ width: `${result.confidence}%`, background: `linear-gradient(to left, ${confidenceColor}, ${confidenceColor}99)` }} />
                        </div>
                      </div>

                      {result.actors_recognized && result.actors_recognized.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {result.actors_recognized.map(actor => (
                            <span key={actor} className="px-2.5 py-1 rounded-full text-xs" style={{ background: "#7C3AED22", border: "1px solid #7C3AED55", color: "#C4B5FD" }}>{actor}</span>
                          ))}
                        </div>
                      )}

                      {result.reasoning && (
                        <div className="rounded-lg px-3 py-2" style={{ background: "#06B6D411", border: "1px solid #06B6D422" }}>
                          <p className="text-xs mb-0.5" style={{ color: "#06B6D4" }}>איך זיהינו</p>
                          <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>{result.reasoning}</p>
                        </div>
                      )}

                      {result.scene_description && (
                        <div className="pt-4" style={{ borderTop: "1px solid #ffffff10" }}>
                          <p className="text-xs mb-1" style={{ color: "#6B7280" }}>על הסצנה</p>
                          <p className="text-sm leading-relaxed" style={{ color: "#D1D5DB" }}>{result.scene_description}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-lg mb-2" style={{ color: "#9CA3AF" }}>לא ניתן לזהות את הסרט</p>
                      {result.scene_description && <p className="text-sm" style={{ color: "#6B7280" }}>{result.scene_description}</p>}
                    </div>
                  )}

                  {similarWithPosters.length > 0 && (
                    <div className="space-y-2 pt-4" style={{ borderTop: "1px solid #ffffff10" }}>
                      <div className="flex items-center gap-2 mb-3">
                        <Clapperboard className="w-4 h-4" style={{ color: "#7C3AED" }} />
                        <p className="text-sm font-semibold">אולי תאהב גם</p>
                        <span className="text-xs mr-auto" style={{ color: "#6B7280" }}>לחץ לטריילר</span>
                      </div>
                      {similarWithPosters.map(film => <SimilarMovieCard key={film.title} film={film} />)}
                    </div>
                  )}

                  <button onClick={reset} className="w-full py-2.5 rounded-xl text-sm transition-all"
                    style={{ border: "1px solid #ffffff15", color: "#9CA3AF" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#7C3AED66"; e.currentTarget.style.color = "white"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#ffffff15"; e.currentTarget.style.color = "#9CA3AF"; }}
                  >
                    העלה תמונות חדשות
                  </button>
                </div>
              </GradientBorderCard>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
