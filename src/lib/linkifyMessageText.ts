/** Safe URL detection for chat / rich text without executing HTML. */

const URL_FIND_REGEX =
  /\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi;

const UNSAFE_SCHEME_REGEX = /^(javascript|data|vbscript|file|blob):/i;

export type MessageTextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

function normalizeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (UNSAFE_SCHEME_REGEX.test(parsed.protocol)) {
    return null;
  }

  return parsed.toString();
}

/** Split plain message text into safe text/link parts (no HTML). */
export function splitMessageTextWithLinks(content: string): MessageTextPart[] {
  if (!content) return [];

  const parts: MessageTextPart[] = [];
  let lastIndex = 0;
  const regex = new RegExp(URL_FIND_REGEX.source, URL_FIND_REGEX.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const raw = match[1] ?? match[0];
    const start = match.index;
    if (start > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, start) });
    }

    const href = normalizeHref(raw);
    if (href) {
      parts.push({ type: "link", value: raw, href });
    } else {
      parts.push({ type: "text", value: raw });
    }

    lastIndex = start + raw.length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: content }];
}
