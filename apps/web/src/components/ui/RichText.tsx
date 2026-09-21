import { useMemo } from "react";
import { looksLikeHtml, sanitizeRichText } from "../../lib/richText";

/**
 * Displays stored rich text (written with RichTextField). Editor HTML is sanitized
 * (lib/richText.ts) before it is rendered; anything that is not HTML — content saved as plain
 * text before the editor existed — is shown as text, exactly as before.
 */
export function RichText({ value, className = "" }: { value: string; className?: string }) {
  const html = useMemo(() => (looksLikeHtml(value) ? sanitizeRichText(value) : null), [value]);

  if (html === null) {
    return <p className={`whitespace-pre-wrap ${className}`}>{value}</p>;
  }
  return <div className={`rich-text ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
