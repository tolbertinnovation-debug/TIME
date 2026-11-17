import { describe, expect, it } from "vitest";
import { parseInline, parseLesson } from "../../src/lib/lesson-text";
import { meetingService, youtubeId } from "../../src/lib/video";

const plain = (t: string) => [{ text: t, bold: false }];

describe("lesson formatting", () => {
  it("keeps plain lessons as paragraphs, split at blank lines", () => {
    expect(parseLesson("First paragraph.\n\nSecond paragraph.")).toEqual([
      { type: "paragraph", content: plain("First paragraph.") }, { type: "paragraph", content: plain("Second paragraph.") },
    ]);
  });
  it("reads headings, bullet lists and numbered lists", () => {
    expect(parseLesson("# The cash book\nIt records money.\n\n- Sales\n- Purchases\n\n## Steps\n1. Open the book\n2) Write the date")).toEqual([
      { type: "heading", level: 2, content: plain("The cash book") },
      { type: "paragraph", content: plain("It records money.") },
      { type: "list", ordered: false, items: [plain("Sales"), plain("Purchases")] },
      { type: "heading", level: 3, content: plain("Steps") },
      { type: "list", ordered: true, items: [plain("Open the book"), plain("Write the date")] },
    ]);
  });
  it("marks bold text, and leaves stray stars alone", () => {
    expect(parseInline("Keep **every receipt** safe.")).toEqual([{ text: "Keep ", bold: false }, { text: "every receipt", bold: true }, { text: " safe.", bold: false }]);
    expect(parseInline("2 * 3 ** 4")).toEqual(plain("2 * 3 ** 4"));
  });
  it("never produces HTML: tags stay as the text that was typed", () => {
    const [block] = parseLesson('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(block).toEqual({ type: "paragraph", content: plain('<script>alert(1)</script> <img src=x onerror=alert(1)>') });
  });
  it("does not turn a price or a hashtag inside a sentence into a heading or list", () => {
    expect(parseLesson("Rice costs LRD 500 - a fair price. Use #2 pencils.")).toEqual([{ type: "paragraph", content: plain("Rice costs LRD 500 - a fair price. Use #2 pencils.") }]);
  });
});

describe("YouTube links", () => {
  it("finds the video in every kind of link YouTube gives", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?si=abc", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
      "https://www.youtube.com/embed/dQw4w9WgXcQ", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/live/dQw4w9WgXcQ",
    ]) expect(youtubeId(link), link).toBe("dQw4w9WgXcQ");
  });
  it("refuses anything else", () => {
    for (const bad of ["", "dQw4w9WgXcQ", "http://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/123456", "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=short", "https://www.youtube.com/@channel", "javascript:alert(1)"]) {
      expect(youtubeId(bad), bad).toBeNull();
    }
  });
});

describe("meeting links", () => {
  it("names the service", () => {
    expect(meetingService("https://meet.google.com/abc-defg-hij")).toBe("Google Meet");
    expect(meetingService("https://us02web.zoom.us/j/123456789")).toBe("Zoom");
    expect(meetingService("https://teams.microsoft.com/l/meetup-join/x")).toBe("Microsoft Teams");
    expect(meetingService("https://chat.whatsapp.com/abc")).toBe("WhatsApp");
    expect(meetingService("https://meet.jit.si/TIME-week1")).toBe("Jitsi Meet");
  });
  it("gives nothing for other links, including look-alikes", () => {
    expect(meetingService("https://example.org/class")).toBeNull();
    expect(meetingService("https://zoom.us.evil.example/j/1")).toBeNull();
    expect(meetingService("not a link")).toBeNull();
  });
});
