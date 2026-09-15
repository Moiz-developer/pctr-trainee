/**
 * Minimal ambient declaration for the `mammoth` package (Phase 2I: DOCUMENT
 * viewer). Mammoth ships no types of its own and no `@types/mammoth`
 * package exists on npm — this declares only the one function this project
 * actually uses.
 */
declare module "mammoth" {
  export interface ConvertToHtmlMessage {
    type: string;
    message: string;
  }

  export interface ConvertToHtmlResult {
    value: string;
    messages: ConvertToHtmlMessage[];
  }

  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ConvertToHtmlResult>;
}
