// Dynamically loads a Noto Sans JP font subset that covers only the
// characters we need for the current OG image. This keeps the font
// payload small (a few KB instead of multi-megabytes).
//
// IMPORTANT: Satori (which powers next/og's ImageResponse) only accepts
// TTF, OTF, or WOFF — it does NOT accept WOFF2 or EOT. Google Fonts
// decides which format to serve based on the User-Agent:
//   - Modern UA (Chrome/Firefox/Safari)         → WOFF2  ❌ (can't parse)
//   - Very old UA (IE6/7)                        → EOT    ❌ (can't parse)
//   - Older but still WOFF-aware UA (IE9–IE11)   → WOFF   ✅
// We send an IE11 UA so we always get WOFF.
//
// Falls back to null if anything fails; ImageResponse will then render
// using its default fonts (Inter), so non-Latin glyphs will not show.

const UA =
  "Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko";

async function loadGoogleFont(
  family: string,
  weight: number,
  text: string,
): Promise<ArrayBuffer | null> {
  try {
    const cssUrl =
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}` +
      `&text=${encodeURIComponent(text)}`;
    const css = await fetch(cssUrl, { headers: { "User-Agent": UA } }).then(r =>
      r.text(),
    );
    // Prefer truetype/opentype/woff in that order. Satori cannot read woff2/eot.
    const match =
      css.match(
        /src:\s*url\(([^)]+)\)\s*format\(['"]?(truetype|opentype|woff)['"]?\)/i,
      ) ??
      // Some legacy CSS lacks format(). Take whatever URL comes first.
      css.match(/src:\s*url\(([^)]+)\)/);
    if (!match) return null;
    const fontUrl = match[1].replace(/^['"]|['"]$/g, "");
    const buf = await fetch(fontUrl).then(r => r.arrayBuffer());
    return buf;
  } catch {
    return null;
  }
}

export async function loadNotoJp(
  text: string,
  weight: 400 | 700 = 700,
): Promise<ArrayBuffer | null> {
  if (!text) return null;
  return loadGoogleFont("Noto Sans JP", weight, text);
}
