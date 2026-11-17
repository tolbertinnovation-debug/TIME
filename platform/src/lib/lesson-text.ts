// How a lecturer formats a lesson, using a few marks that are easy to type on a phone:
//
//   # Heading            a heading           (## for a smaller one)
//   - item               a bullet list
//   1. item              a numbered list
//   **important**        bold
//
// Everything else is a paragraph; a blank line starts a new one. The result is a list of
// blocks that the page turns into elements, so nothing a lecturer types is ever treated as HTML.
export type Inline = { text: string; bold: boolean };
export type Block =
  | { type: "heading"; level: 2 | 3; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let rest = text;
  for (;;) {
    const m = /\*\*(\S(?:.*?\S)?)\*\*/.exec(rest);
    if (!m) break;
    if (m.index > 0) parts.push({ text: rest.slice(0, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) parts.push({ text: rest, bold: false });
  return parts;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;
const HEADING = /^\s*(#{1,3})\s+(.*)$/;

export function parseLesson(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", content: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { endParagraph(); continue; }
    const heading = HEADING.exec(line);
    if (heading) {
      endParagraph();
      // "#" is the lesson's main heading (h2 on the page, under the title); "##" and "###" are smaller.
      blocks.push({ type: "heading", level: heading[1].length === 1 ? 2 : 3, content: parseInline(heading[2].trim()) });
      continue;
    }
    const bullet = BULLET.exec(line), numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      endParagraph();
      const ordered = !bullet;
      const item = parseInline((bullet ?? numbered)![1].trim());
      const last = blocks[blocks.length - 1];
      if (last?.type === "list" && last.ordered === ordered) last.items.push(item);
      else blocks.push({ type: "list", ordered, items: [item] });
      continue;
    }
    paragraph.push(line.trim());
  }
  endParagraph();
  return blocks;
}
