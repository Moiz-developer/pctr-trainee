import { useEffect, useMemo, useRef } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  AutoLink,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  Heading,
  Italic,
  Link,
  List,
  Paragraph,
  Underline,
  Undo,
  type EditorConfig,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";
import { richTextToPlain } from "../../lib/richText";

/**
 * The application's one CKEditor configuration (used through RichTextField in FormField.tsx,
 * loaded lazily so the editor is only downloaded by screens that show it). The toolbar is the
 * full set of what is enabled here — and lib/richText.ts's sanitizer allows exactly the markup
 * these plugins produce, so keep the two in step. It groups into a "⋮" menu on narrow screens.
 *
 * `licenseKey: "GPL"` uses CKEditor 5 under its open-source (GPL) licence; replace it with a
 * commercial licence key if the project needs one.
 */
const BASE_CONFIG: EditorConfig = {
  licenseKey: "GPL",
  plugins: [
    Essentials,
    Paragraph,
    Heading,
    Bold,
    Italic,
    Underline,
    Link,
    AutoLink,
    List,
    BlockQuote,
    Undo,
  ],
  toolbar: [
    "heading",
    "|",
    "bold",
    "italic",
    "underline",
    "|",
    "link",
    "|",
    "bulletedList",
    "numberedList",
    "blockQuote",
    "|",
    "undo",
    "redo",
  ],
  heading: {
    options: [
      { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
      { model: "heading2", view: "h2", title: "Heading", class: "ck-heading_heading2" },
      { model: "heading3", view: "h3", title: "Subheading", class: "ck-heading_heading3" },
    ],
  },
  link: { defaultProtocol: "https://" },
};

export default function RichTextEditor({
  value,
  onChange,
  onBlur,
  label,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  label: string;
  disabled?: boolean;
}) {
  const config = useMemo<EditorConfig>(() => ({ ...BASE_CONFIG, label }), [label]);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  return (
    <CKEditor
      editor={ClassicEditor}
      config={config}
      data={value}
      disabled={disabled}
      onReady={(editor) => {
        editor.model.document.on("change:data", (_event, batch) => {
          // Only the user's edits (typing, toolbar commands, paste, undo/redo). Loading or
          // resetting the form value goes through data.set()/init, which CKEditor marks as not
          // undoable: it re-serializes the value and must not rewrite an unchanged stored one.
          if (!batch.isUndoable) return;
          const html = editor.getData();
          // An emptied editor (or one holding only blank paragraphs) is an empty field, so the
          // forms' existing "optional / required" handling of "" keeps working.
          onChangeRef.current(richTextToPlain(html) === "" ? "" : html);
        });
      }}
      onBlur={() => onBlur?.()}
    />
  );
}
