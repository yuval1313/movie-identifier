import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `You are a world-class cinephile and film expert with encyclopedic knowledge of movies and TV shows from every era, country, and genre.

Your task: identify which movie or TV show this image is from.

Carefully examine every visual detail before answering:
- Actor faces and their distinctive features
- Costumes, hairstyles, makeup -- what era/style?
- Set design, locations, architecture
- Color grading and cinematographic style (warm/cold, desaturated, high contrast?)
- Props, vehicles, weapons, technology visible
- Any text, logos, subtitles, or watermarks in the frame
- Aspect ratio and film grain (suggests era/format)
- Special effects style (practical vs CGI, and what era?)

After your analysis, return ONLY this JSON (no other text whatsoever):
{
  "movie": "Exact Movie Title in English",
  "original_title": "Original language title if non-English film",
  "year": 1994,
  "director": "Director Name",
  "actors_recognized": ["Actor 1", "Actor 2"],
  "confidence": 85,
  "reasoning": "Specific visual clues that led to this identification -- be precise",
  "scene_description": "תיאור קצר בעברית של מה קורה בסצנה ומה ההקשר שלה בסרט",
  "similar_movies": [
    { "title": "Title", "year": 1999, "reason": "סיבה קצרה בעברית" },
    { "title": "Title", "year": 2003, "reason": "סיבה קצרה בעברית" },
    { "title": "Title", "year": 2010, "reason": "סיבה קצרה בעברית" }
  ]
}

Confidence scale: 95+=certain | 80-94=very likely | 60-79=probable | 40-59=possible | <40=unknown
If confidence < 40: set "movie" to null. Still fill scene_description and similar_movies based on visual mood/genre.
For similar_movies: pick by shared director, genre, tone, themes, or era. Not just popular titles.

CRITICAL JSON rules -- your output will be parsed by JSON.parse():
- Do NOT use Hebrew gershayim (the character that looks like double-quote used in Hebrew abbreviations) inside string values
- Do NOT use Hebrew geresh (the character that looks like apostrophe used in Hebrew) inside string values
- Use only standard ASCII double-quotes for JSON structure
- No trailing commas`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const { image, mediaType } = await req.json();
  if (!image || !mediaType) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      thinking: {
        type: "enabled",
        budget_tokens: 10000,
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: image,
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    } as Parameters<typeof client.messages.create>[0]) as Awaited<ReturnType<typeof client.messages.create>>;

    const msg = response as { content: Array<{ type: string; text?: string }> };
    const textBlock = msg.content.find((b) => b.type === "text");
    const text = textBlock?.text ?? "";

    // Extract JSON by counting braces
    const start = text.indexOf("{");
    if (start === -1) {
      return NextResponse.json({ error: "Invalid model response" }, { status: 502 });
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) {
      return NextResponse.json({ error: "Invalid model response" }, { status: 502 });
    }

    const raw = text.slice(start, end + 1);
    // Remove Hebrew typographic punctuation that breaks JSON parsing
    const sanitized = raw
      .replace(/״/g, "")
      .replace(/׳/g, "");

    let result;
    try {
      result = JSON.parse(sanitized);
    } catch (parseErr) {
      console.error("JSON parse failed:", parseErr, "\nRaw:", sanitized.slice(0, 400));
      return NextResponse.json({ error: "Failed to parse model response" }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error identifying image" }, { status: 502 });
  }
}
