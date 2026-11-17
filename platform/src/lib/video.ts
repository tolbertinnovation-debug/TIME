// Videos in lessons, and the links lecturers paste for live classes.

// The 11-character id of a YouTube video, from any of the links YouTube gives out, or null.
export function youtubeId(input: string): string | null {
  let url: URL;
  try { url = new URL(input.trim()); } catch { return null; }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(first)) id = second ?? null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

// The player address. "nocookie" is YouTube's privacy mode: it sets no cookies until the video plays.
export const youtubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`;

// Which service a meeting link belongs to, for the Join button: "Join on Google Meet".
export function meetingService(link: string): string | null {
  let host: string;
  try { host = new URL(link).hostname.toLowerCase(); } catch { return null; }
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (is("meet.google.com")) return "Google Meet";
  if (is("zoom.us") || is("zoom.com")) return "Zoom";
  if (is("teams.microsoft.com") || is("teams.live.com")) return "Microsoft Teams";
  if (is("whatsapp.com") || is("wa.me")) return "WhatsApp";
  if (is("jit.si")) return "Jitsi Meet";
  if (is("webex.com")) return "Webex";
  return null;
}
