import DOMPurify from "dompurify";

/**
 * Rich text (RichTextField / CKEditor) is stored as HTML, but content saved before the editor
 * existed is plain text. These helpers let every display site handle both, and are the only
 * place stored HTML is turned into markup.
 */

// What the editor's toolbar can produce (components/ui/RichTextEditor.tsx) and nothing more:
// no scripts, styles, images, iframes, forms or event-handler attributes.
const ALLOWED_TAGS = [
  "p",
  "br",
  "h2",
  "h3",
  "strong",
  "em",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
];

const SAFE_LINK = /^(?:https?:|mailto:|tel:)/i;

const HTML_TAG = /<\/?(p|br|h[23]|strong|em|u|a|ul|ol|li|blockquote)\b[^>]*>/i;

/** True when the stored value is editor HTML rather than legacy plain text. */
export function looksLikeHtml(value: string): boolean {
  return HTML_TAG.test(value);
}

/**
 * Sanitizes stored rich text for rendering: tag and attribute allowlist (only `href` survives,
 * and only for http(s), mailto and tel links — `javascript:`, `data:` and everything else is
 * dropped), then every link is forced to open in a new tab without giving the target page access
 * to this one.
 */
export function sanitizeRichText(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href"],
    ALLOWED_URI_REGEXP: SAFE_LINK,
  });
  return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

/** Plain-text version of stored rich text, for previews (line-clamped cards, list rows). */
export function richTextToPlain(value: string): string {
  if (!looksLikeHtml(value)) return value;
  const spaced = sanitizeRichText(value).replace(/<\/(p|h[23]|li|blockquote)>|<br\s*\/?>/gi, "$& ");
  const text = new DOMParser().parseFromString(spaced, "text/html").body.textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Turns legacy plain text into editor HTML (blank line → paragraph, newline → line break), so
 * opening an old record in the editor keeps its line breaks instead of collapsing them.
 * Editor HTML and empty values pass through unchanged.
 */
export function toEditorHtml(value: string): string {
  if (value === "" || looksLikeHtml(value)) return value;
  return value
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
