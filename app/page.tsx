"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Film, Search, X, AlertCircle, Clapperboard, Play } from "lucide-react";

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

function youtubeTrailerUrl(title: string, year?: number) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${year ?? ""} official trailer`)}`;
}

function SimilarMovieCard({ film }: { film: SimilarMovieWithPoster }) {
  return (
    <a
      href={youtubeTrailerUrl(film.title, film.year)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-xl overflow-hidden transition-all group"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.25)" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.6)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)")}
    >
      <div className="w-16 shrink-0 relative overflow-hidden" style={{ background: "#1a1a2e", minHeight: 88 }}>
        {film.poster
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={film.poster} alt={film.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Film className="w-6 h-6" style={{ color: "#7C3AED" }} /></div>
        }
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition" style={{ background: "rgba(0,0,0,0.5)" }}>
          <Play className="w-6 h-6 fill-white text-white" />
        </div>
      </div>
      <div className="py-3 pr-2 min-w-0">
        <p className="text-white text-sm font-medium leading-tight">
          {film.title} <span style={{ color: "#6B7280" }}>({film.year})</span>
        </p>
        <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: "#9CA3AF" }}>{film.reason}</p>
        <p className="text-xs mt-1.5 opacity-0 group-hover:opacity-100 transition" style={{ color: "#06B6D4" }}>צפה בטריילר ←</p>
      </div>
    </a>
  );
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>("");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<MovieResult | null>(null);
  const [similarWithPosters, setSimilarWithPosters] = useState<SimilarMovieWithPoster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setResult(null); setError(null);
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
      setPreview(dataUrl); setMediaType("image/jpeg"); setImage(dataUrl.split(",")[1]);
    };
    img.src = objectUrl;
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const identify = async () => {
    if (!image) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/identify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, mediaType }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה");
      setResult(data);
    } catch (err) { setError(err instanceof Error ? err.message : "שגיאה"); }
    finally { setLoading(false); }
  };

  const reset = () => { setImage(null); setPreview(null); setResult(null); setError(null); setSimilarWithPosters([]); };

  const confidenceColor = !result ? "#6B7280" : result.confidence >= 80 ? "#10B981" : result.confidence >= 50 ? "#F59E0B" : "#EF4444";

  return (
    <main
      dir="rtl"
      className="min-h-screen flex flex-col items-center px-4 py-16 relative overflow-hidden"
      style={{ background: "#0d0d14", fontFamily: "var(--font-rubik), sans-serif", color: "white" }}
    >
      {/* Decorative lines */}
      <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none overflow-hidden">
        <div className="absolute top-24 right-0 w-32 h-px" style={{ background: "linear-gradient(to left, #7C3AED, transparent)" }} />
        <div className="absolute top-24 right-0 w-px h-32" style={{ background: "linear-gradient(to bottom, #7C3AED, transparent)" }} />
        <div className="absolute bottom-40 left-0 w-24 h-px" style={{ background: "linear-gradient(to right, #EC4899, transparent)" }} />
        <div className="absolute bottom-40 left-0 w-px h-24" style={{ background: "linear-gradient(to bottom, #EC4899, transparent)" }} />
        <div className="absolute top-1/3 left-8 w-3 h-3 rounded-full border" style={{ borderColor: "#7C3AED" }} />
        <div className="absolute top-1/2 right-12 w-24 h-px" style={{ background: "linear-gradient(to left, #06B6D4, transparent)" }} />
      </div>

      {/* Header */}
      <div className="text-center mb-10 relative z-10">
        <h1
          className="mb-2 tracking-widest"
          style={{
            fontFamily: "var(--font-karantina), sans-serif",
            fontSize: "clamp(3rem, 10vw, 5rem)",
            fontWeight: 700,
            color: "#4a9ebe",
            lineHeight: 1.1,
          }}
        >
          מזהה סרטים
        </h1>
        <p style={{ color: "#9CA3AF", fontSize: "0.95rem" }}>
          העלה תמונה מסרט — המערכת תזהה מאיזה סרט היא נלקחה
        </p>
      </div>

      <div className="w-full max-w-xl relative z-10">
        {/* Upload Zone */}
        {!preview ? (
          <div
            className="rounded-2xl p-14 flex flex-col items-center gap-4 cursor-pointer transition-all"
            style={{
              border: `2px dashed ${dragging ? "#7C3AED" : "#374151"}`,
              background: dragging ? "rgba(124,58,237,0.05)" : "rgba(255,255,255,0.02)",
            }}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="w-12 h-12" style={{ color: dragging ? "#7C3AED" : "#4B5563" }} />
            <p style={{ color: "#D1D5DB" }}>גרור תמונה לכאן</p>
            <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>או לחץ לבחירת קובץ</p>
            <p style={{ color: "#374151", fontSize: "0.75rem" }}>JPG, PNG, WEBP</p>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Image Preview */}
            <div className="relative rounded-2xl overflow-hidden" style={{ border: "1px solid #374151" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="תמונה שהועלתה" className="w-full object-cover max-h-80" />
              <button onClick={reset} className="absolute top-3 left-3 rounded-full p-1.5 transition" style={{ background: "rgba(0,0,0,0.6)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Identify Button */}
            {!result && (
              <button
                onClick={identify}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
                style={{
                  background: loading ? "rgba(124,58,237,0.3)" : "transparent",
                  border: "2px solid #7C3AED",
                  color: loading ? "#7C3AED" : "white",
                }}
                onMouseEnter={e => !loading && (e.currentTarget.style.background = "rgba(124,58,237,0.15)")}
                onMouseLeave={e => !loading && (e.currentTarget.style.background = "transparent")}
              >
                {loading ? (
                  <><div className="w-5 h-5 border-2 border-purple-700 border-t-purple-300 rounded-full animate-spin" />מזהה סרט...</>
                ) : (
                  <><Search className="w-5 h-5" />זהה סרט</>
                )}
              </button>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)" }}>
                <AlertCircle className="w-5 h-5 shrink-0" style={{ color: "#F87171" }} />
                <p style={{ color: "#FCA5A5" }}>{error}</p>
              </div>
            )}

            {/* Result Card */}
            {result && (
              <div className="rounded-2xl p-6 space-y-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(6,182,212,0.3)" }}>
                {result.movie ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-bold leading-tight">{result.movie}</h2>
                        {result.original_title && result.original_title !== result.movie && (
                          <p className="text-sm mt-0.5" style={{ color: "#9CA3AF" }}>{result.original_title}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-sm" style={{ color: "#9CA3AF" }}>
                          {result.year && <span>{result.year}</span>}
                          {result.director && <><span>·</span><span>במאי: {result.director}</span></>}
                        </div>
                      </div>
                      <a
                        href={youtubeTrailerUrl(result.movie, result.year)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition shrink-0"
                        style={{ border: "1px solid #EC4899", background: "rgba(236,72,153,0.15)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(236,72,153,0.3)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(236,72,153,0.15)")}
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        טריילר
                      </a>
                    </div>

                    {/* Confidence Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span style={{ color: "#9CA3AF" }}>רמת ביטחון</span>
                        <span className="font-semibold" style={{ color: confidenceColor }}>{result.confidence}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1F2937" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${result.confidence}%`, background: confidenceColor }} />
                      </div>
                    </div>

                    {/* Actors */}
                    {result.actors_recognized && result.actors_recognized.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {result.actors_recognized.map(actor => (
                          <span key={actor} className="px-2.5 py-1 rounded-full text-xs" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.4)", color: "#C4B5FD" }}>
                            {actor}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Reasoning */}
                    {result.reasoning && (
                      <div className="rounded-lg px-3 py-2" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)" }}>
                        <p className="text-xs mb-0.5" style={{ color: "#06B6D4" }}>איך זיהינו</p>
                        <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>{result.reasoning}</p>
                      </div>
                    )}

                    {/* Scene Description */}
                    {result.scene_description && (
                      <div className="pt-4" style={{ borderTop: "1px solid #1F2937" }}>
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

                {/* Similar Movies */}
                {similarWithPosters.length > 0 && (
                  <div className="space-y-2" style={{ borderTop: "1px solid #1F2937", paddingTop: "1rem" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Clapperboard className="w-4 h-4" style={{ color: "#7C3AED" }} />
                      <p className="text-sm font-semibold">אולי תאהב גם</p>
                      <span className="text-xs mr-auto" style={{ color: "#6B7280" }}>לחץ לצפייה בטריילר</span>
                    </div>
                    {similarWithPosters.map(film => <SimilarMovieCard key={film.title} film={film} />)}
                  </div>
                )}

                <button
                  onClick={reset}
                  className="w-full py-2.5 rounded-xl text-sm transition"
                  style={{ border: "1px solid #374151", color: "#9CA3AF" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.color = "white"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#374151"; e.currentTarget.style.color = "#9CA3AF"; }}
                >
                  העלה תמונה אחרת
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
