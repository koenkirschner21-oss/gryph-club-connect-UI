import type { ReactNode } from "react";
import { splitMessageTextWithLinks } from "../../lib/linkifyMessageText";

const linkStyle = {
  color: "#7eb8ff",
  textDecoration: "underline",
  wordBreak: "break-word" as const,
};

/** Render plain message text with safe http(s) links only. */
export function LinkedMessageText({ content }: { content: string }): ReactNode {
  const parts = splitMessageTextWithLinks(content);
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return <span key={`t-${index}`}>{part.value}</span>;
        }
        return (
          <a
            key={`l-${index}`}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
            onClick={(event) => event.stopPropagation()}
          >
            {part.value}
          </a>
        );
      })}
    </>
  );
}
