import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DESCRIBE_PROMPT = `You are a forensic visual analyst. Describe this image in extreme detail for the purpose of identifying which movie or TV show it is from.

Describe everything you observe:
1. PEOPLE: Describe every person visible -- approximate age, hair color/style, facial features, expression, body language. Do you recognize any actors? Name them if so.
2. COSTUMES: Describe clothing, accessories, makeup, hairstyles in detail. What era/decade do they suggest?
3. SETTING: Where does this take place? Interior/exterior? What country/city? What time period? Describe architecture, furniture, decor, landscape.
4. OBJECTS & PROPS: List every significant object, vehicle, weapon, technology, or prop visible.
5. VISUAL STYLE: Describe the color palette, lighting, film grain/quality, aspect ratio. Does it look like a big-budget Hollywood film, indie, foreign, animated? What decade was it likely filmed?
6. TEXT/LOGOS: Is there any visible text, signs, logos, subtitles, or watermarks in the frame?
7. MOOD & GENRE: What genre does this suggest? Action, drama, comedy, horror, sci-fi, fantasy, period piece?

Be extremely specific. This description will be used to identify the exact movie.`;

const IDENTIFY_PROMPT = (description: string) => `You are a world-class cinephile with encyclopedic knowledge of every movie and TV show ever made.

A visual analyst has examined a movie screenshot and provided this detailed description:

---
${description}
---

Using this description AND the image itself, identify which movie or TV show this is from.

Cross-reference every clue: the actors, costumes, setting, visual style, props, and genre all together.
Think of multiple candidates, then pick the one that best matches ALL clues simultaneously.

Return ONLY this JSON (no other text):
{
  "movie": "Exact Movie Title in English",
  "original_title": "Original language title if non-English film",
  "year": 1994,
  "director": "Director Name",
  "actors_recognized": ["Actor 1", "Actor 2"],
  "confidence": 85,
  "reasoning": "Which specific clues from the description confirmed this identification",
  "scene_description": "תיאור קצר בעברית של מה קורה בסצנה ומה ההקשר שלה בסרט",
  "similar_movies": [
    { "title": "Title", "year": 1999, "reason": "סיבה קצרה בעברית" },
    { "title": "Title", "year": 2003, "reason": "סיבה קצרה בעברית" },
    { "title": "Title", "year": 2010, "reason": "סיבה קצרה בעברית" }
  ]
}

Confidence scale: 95+=certain | 80-94=very likely | 60-79=probable | 40-59=possible | <40=unknown
If confidence < 40: set "movie" to null. Still fill scene_description and similar_movies.
For similar_movies: pick by shared director, genre, tone, themes, or era.

CRITICAL JSON rules:
- Do NOT use Hebrew gershayim or geresh characters inside string values
- Use only standard ASCII double-quotes for JSON structure
- No trailing commas`;

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return null;
  return text.slice(start, end + 1).replace(/״/g, "").replace(/׳/g, "");
}

function getTextFromResponse(response: Awaited<ReturnType<typeof client.messages.create>>): string {
  const msg = response as { content: Array<{ type: string; text?: string }> };
  return msg.content.find((b) => b.type === "text")?.text ?? "";
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const { image, mediaType } = await req.json();
  if (!image || !mediaType) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const imageContent = {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: image,
    },
  };

  try {
    // Pass 1: detailed visual description with extended thinking
    const describeResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      thinking: { type: "enabled", budget_tokens: 5000 },
      messages: [{
        role: "user",
        content: [imageContent, { type: "text", text: DESCRIBE_PROMPT }],
      }],
    } as Parameters<typeof client.messages.create>[0]) as Awaited<ReturnType<typeof client.messages.create>>;

    const description = getTextFromResponse(describeResponse);
    if (!description) {
      return NextResponse.json({ error: "Failed to describe image" }, { status: 502 });
    }

    // Pass 2: identify movie using description + image, with more thinking budget
    const identifyResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      thinking: { type: "enabled", budget_tokens: 20000 },
      messages: [{
        role: "user",
        content: [imageContent, { type: "text", text: IDENTIFY_PROMPT(description) }],
      }],
    } as Parameters<typeof client.messages.create>[0]) as Awaited<ReturnType<typeof client.messages.create>>;

    const identifyText = getTextFromResponse(identifyResponse);
    const jsonStr = extractJson(identifyText);
    if (!jsonStr) {
      return NextResponse.json({ error: "Invalid model response" }, { status: 502 });
    }

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("JSON parse failed:", parseErr, "\nRaw:", jsonStr.slice(0, 400));
      return NextResponse.json({ error: "Failed to parse model response" }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error identifying image" }, { status: 502 });
  }
}
