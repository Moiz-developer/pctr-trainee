import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ApiClientError } from "../../../services/api/client";
import { getMediaAccessUrl, MEDIA_ACCESS_URL_STALE_MS } from "../../../services/api/media";

// Exported so callers (ProtectedFileViewer.tsx) can detect a spreadsheet the same way
// DocumentLessonViewer.tsx exports DOCX_MIME.
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const XLS_MIME = "application/vnd.ms-excel";

type SheetTable = { name: string; rows: string[][] };

// A safety cap, not a product limit: a pathologically large sheet (tens of thousands of rows or
// columns) rendered as one DOM table would freeze the tab. Generous enough that every realistic
// template/report still shows in full.
const MAX_ROWS = 500;
const MAX_COLS = 60;

function columnLabel(index: number): string {
  // Spreadsheet-style column headers (A, B, ..., Z, AA, AB, ...) — purely for orientation, since
  // the sheet's own first row (if any) is rendered as an ordinary data row, not consumed as a header.
  let label = "";
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/**
 * In-app viewer for `.xls`/`.xlsx` (Document preview UI consistency unit). Parses the workbook
 * entirely client-side with `xlsx` (SheetJS) — the same "fetch the signed URL, convert in the
 * browser, never send bytes anywhere else" shape DocumentLessonViewer.tsx already established for
 * DOCX. Cells are read into plain string arrays and rendered as ordinary React table cells —
 * never `dangerouslySetInnerHTML` — so there is nothing here for DOMPurify to need to sanitize.
 */
export function SpreadsheetViewer({ mediaAssetId }: { mediaAssetId: string }) {
  const [sheets, setSheets] = useState<SheetTable[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(true);

  const accessUrlQuery = useQuery({
    queryKey: ["media-access-url", mediaAssetId],
    queryFn: () => getMediaAccessUrl(mediaAssetId),
    staleTime: MEDIA_ACCESS_URL_STALE_MS,
    refetchOnWindowFocus: false,
  });
  const signedUrl = accessUrlQuery.data?.url;

  useEffect(() => {
    if (!signedUrl) return;
    let cancelled = false;

    void (async () => {
      // Reset state for the new signed URL inside the async callback, not synchronously at the
      // top of the effect body — see DocumentLessonViewer.tsx's identical comment.
      setIsParsing(true);
      setParseError(null);
      setSheets(null);
      setActiveIndex(0);
      try {
        const [XLSX, fileResponse] = await Promise.all([import("xlsx"), fetch(signedUrl)]);
        if (!fileResponse.ok) throw new Error("download failed");
        const arrayBuffer = await fileResponse.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        if (cancelled) return;

        const parsed = workbook.SheetNames.map((name): SheetTable => {
          const sheet = workbook.Sheets[name];
          const rows = sheet
            ? XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" })
            : [];
          return {
            name,
            rows: rows
              .slice(0, MAX_ROWS)
              .map((row) => row.slice(0, MAX_COLS).map((cell) => String(cell ?? ""))),
          };
        });
        setSheets(parsed);
      } catch {
        if (!cancelled) {
          setParseError(
            "This spreadsheet could not be displayed — the file may be corrupted or in an unsupported format.",
          );
        }
      } finally {
        if (!cancelled) setIsParsing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedUrl]);

  if (accessUrlQuery.isLoading || isParsing) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading spreadsheet…
      </div>
    );
  }

  if (accessUrlQuery.isError) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-red-600">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {accessUrlQuery.error instanceof ApiClientError
          ? accessUrlQuery.error.message
          : "Couldn't load this spreadsheet."}
        <button
          type="button"
          className="cursor-pointer font-medium underline"
          onClick={() => void accessUrlQuery.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (parseError) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-red-600">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {parseError}
      </div>
    );
  }

  if (!sheets || sheets.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-400">
        This spreadsheet has no sheets to display.
      </p>
    );
  }

  const active = sheets[activeIndex] ?? sheets[0]!;
  const colCount = Math.min(MAX_COLS, Math.max(1, ...active.rows.map((row) => row.length)));

  return (
    <div
      className="protected-content rounded-lg bg-slate-100 p-3 sm:p-6"
      onContextMenu={(event) => event.preventDefault()}
    >
      {sheets.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                index === activeIndex
                  ? "border-indigo-900 bg-indigo-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-indigo-900 hover:text-indigo-900"
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-[65vh] overflow-auto rounded-md border border-slate-200 bg-white shadow-[0_1px_4px_rgba(49,44,133,0.10)]">
        {active.rows.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-400">This sheet is empty.</p>
        ) : (
          <table className="w-full min-w-max border-collapse text-left text-xs">
            <thead>
              <tr className="sticky top-0 bg-slate-50">
                {Array.from({ length: colCount }, (_, col) => (
                  <th
                    key={col}
                    className="border-b border-r border-slate-200 px-2 py-1 font-semibold text-slate-500 last:border-r-0"
                  >
                    {columnLabel(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/60">
                  {Array.from({ length: colCount }, (_, col) => (
                    <td
                      key={col}
                      className="whitespace-nowrap border-b border-r border-slate-100 px-2 py-1 text-slate-700 last:border-r-0"
                    >
                      {row[col] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
