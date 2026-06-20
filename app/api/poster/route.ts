import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  const year = searchParams.get("year");

  if (!title) return NextResponse.json({ poster: null });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return NextResponse.json({ poster: null });

  try {
    const query = encodeURIComponent(title);
    const yearParam = year ? `&year=${year}` : "";
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${query}${yearParam}&language=en-US&page=1`
    );
    if (!res.ok) return NextResponse.json({ poster: null });

    const data = await res.json();
    const movie = data.results?.[0];
    if (!movie?.poster_path) return NextResponse.json({ poster: null });

    return NextResponse.json({
      poster: `https://image.tmdb.org/t/p/w300${movie.poster_path}`,
    });
  } catch {
    return NextResponse.json({ poster: null });
  }
}
