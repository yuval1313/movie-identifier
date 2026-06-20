"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Film, Search, X, AlertCircle, Clapperboard, Play } from "lucide-react";

interface SimilarMovie {
  title: string;
  year: number;
  reason: string;
}

interface SimilarMovieWithPoster extends SimilarMovie {
  poster: string | null;
}

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
  const q = encodeURIComponent(`${title} ${year ?? ""} official trailer`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

function SimilarMovieCard({ film }: { film: SimilarMovieWithPoster }) {
  return (
    <a
      href={youtubeTrailerUrl(film.title, film.year)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 bg-gray-800/60 hover:bg-gray-800 rounded-xl overflow-hidden border border-gray-700/50 hover:border-amber-500/40 transition-all group"
    >
      {/* Poster */}
      <div className="w-16 shrink-0 bg-gray-700 relative overflow-hidden">
        {film.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={film.poster} alt={film.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center min-h-[88px]">
            <Film className="w-6 h-6 text-gray-500" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
          <Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition fill-white" />
        </div>
      </div>

      {/* Info */}
      <div className="py-3 pr-1 min-w-0">
        <p className="text-white text-sm font-medium leading-tight">
          {film.title}{" "}
          <span className="text-gray-500 font-normal">({film.year})</span>
        </p>
        <p className="text-gray-400 text-xs mt-1 leading-relaxed line-clamp-2">{film.reason}</p>
        <p className="text-amber-400 text-xs mt-1.5 opacity-0 group-hover:opacity-100 transition">
          צפה בטריילר ←
        </p>
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

  // Fetch posters for similar movies after result arrives
  useEffect(() => {
    if (!result?.similar_movies?.length) {
      setSimilarWithPosters([]);
      return;
    }
    const movies = result.similar_movies;
    setSimilarWithPosters(movies.map((m) => ({ ...m, poster: null })));

    movies.forEach(async (film, i) => {
      try {
        const res = await fetch(
          `/api/poster?title=${encodeURIComponent(film.title)}&year=${film.year}`
        );
        const data = await res.json();
        setSimilarWithPosters((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], poster: data.poster ?? null };
          return next;
        });
      } catch {
        // keep null poster
      }
    });
  }, [result]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setResult(null);
    setError(null);

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
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setPreview(dataUrl);
      setMediaType("image/jpeg");
      setImage(dataUrl.split(",")[1]);
    };
    img.src = objectUrl;
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const identify = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה לא ידועה");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setSimilarWithPosters([]);
  };

  const confidenceColor =
    !result ? "" :
    result.confidence >= 80 ? "bg-green-500" :
    result.confidence >= 50 ? "bg-yellow-500" :
    "bg-red-500";

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-start py-16 px-4" dir="rtl">
      {/* Header */}
      <div className="mb-3 text-center">
        <h1
          className="text-5xl font-bold tracking-widest mb-3"
          style={{ color: "#4a9ebe", fontFamily: "var(--font-karantina), sans-serif" }}
        >
          מזהה סרטים
        </h1>
      </div>
      <p className="text-gray-400 mb-10 text-center text-sm tracking-wide" style={{ fontFamily: "var(--font-rubik), sans-serif" }}>
        העלה תמונה מסרט — המערכת תזהה מאיזה סרט היא נלקחה
      </p>

      {/* Upload Zone */}
      {!preview ? (
        <div
          className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-14 flex flex-col items-center gap-4 cursor-pointer transition-all
            ${dragging ? "border-amber-400 bg-amber-400/5" : "border-gray-600 hover:border-gray-400"}`}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className={`w-12 h-12 ${dragging ? "text-amber-400" : "text-gray-500"}`} />
          <p className="text-lg text-gray-300">גרור תמונה לכאן</p>
          <p className="text-sm text-gray-500">או לחץ לבחירת קובץ</p>
          <p className="text-xs text-gray-600">JPG, PNG, WEBP</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="w-full max-w-xl space-y-5">
          {/* Image Preview */}
          <div className="relative rounded-2xl overflow-hidden border border-gray-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="תמונה שהועלתה" className="w-full object-cover max-h-80" />
            <button
              onClick={reset}
              className="absolute top-3 left-3 bg-black/60 hover:bg-black/80 rounded-full p-1.5 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Identify Button */}
          {!result && (
            <button
              onClick={identify}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-900 disabled:text-amber-600 text-black font-bold text-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  מזהה סרט...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  זהה סרט
                </>
              )}
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-5">
              {result.movie ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-bold text-white leading-tight">{result.movie}</h2>
                      {result.original_title && result.original_title !== result.movie && (
                        <p className="text-gray-400 text-sm mt-0.5">{result.original_title}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-gray-400 text-sm">
                        {result.year && <span>{result.year}</span>}
                        {result.director && <><span>·</span><span>במאי: {result.director}</span></>}
                      </div>
                    </div>
                    {/* Trailer link for identified movie */}
                    <a
                      href={youtubeTrailerUrl(result.movie, result.year)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold text-white transition shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      טריילר
                    </a>
                  </div>

                  {/* Confidence Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-400">רמת ביטחון</span>
                      <span className="font-semibold text-white">{result.confidence}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${confidenceColor}`}
                        style={{ width: `${result.confidence}%` }}
                      />
                    </div>
                  </div>

                  {/* Actors */}
                  {result.actors_recognized && result.actors_recognized.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {result.actors_recognized.map((actor) => (
                        <span key={actor} className="px-2.5 py-1 bg-gray-800 border border-gray-600 rounded-full text-xs text-gray-300">
                          {actor}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Reasoning */}
                  {result.reasoning && (
                    <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                      <p className="text-xs text-amber-400/80 mb-0.5">איך זיהינו</p>
                      <p className="text-gray-400 text-xs leading-relaxed">{result.reasoning}</p>
                    </div>
                  )}

                  {/* Scene Description */}
                  {result.scene_description && (
                    <div className="border-t border-gray-700 pt-4">
                      <p className="text-xs text-gray-500 mb-1">על הסצנה</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{result.scene_description}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-400 text-lg mb-2">לא ניתן לזהות את הסרט</p>
                  {result.scene_description && (
                    <p className="text-gray-500 text-sm">{result.scene_description}</p>
                  )}
                </div>
              )}

              {/* Similar Movies */}
              {similarWithPosters.length > 0 && (
                <div className="border-t border-gray-700 pt-4 space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Clapperboard className="w-4 h-4 text-amber-400" />
                    <p className="text-sm font-semibold text-white">אולי תאהב גם</p>
                    <span className="text-xs text-gray-500 mr-auto">לחץ לצפייה בטריילר</span>
                  </div>
                  {similarWithPosters.map((film) => (
                    <SimilarMovieCard key={film.title} film={film} />
                  ))}
                </div>
              )}

              {/* Try Again */}
              <button
                onClick={reset}
                className="w-full py-2.5 rounded-xl border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white transition text-sm"
              >
                העלה תמונה אחרת
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
