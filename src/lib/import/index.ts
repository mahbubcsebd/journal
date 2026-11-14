import { csvToGrid, decodeText, htmlToGrid, xlsxToGrid } from "./table";
import { parseReportGrid, ReportParseError, type ParsedReport } from "./parse-report";

export { ReportParseError, type ParsedReport };

export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

export async function parseReportFile(name: string, buf: ArrayBuffer, offsetHours = 0): Promise<ParsedReport> {
  if (buf.byteLength > MAX_IMPORT_BYTES) throw new ReportParseError("File is larger than 8 MB.");
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "xlsx") return parseReportGrid(await xlsxToGrid(buf), offsetHours);
  const text = decodeText(buf);
  if (ext === "html" || ext === "htm" || /<table/i.test(text.slice(0, 5000))) {
    return parseReportGrid(htmlToGrid(text), offsetHours);
  }
  if (ext === "csv" || ext === "txt") return parseReportGrid(csvToGrid(text), offsetHours);
  throw new ReportParseError("Unsupported file. Upload an MT5 report (.html / .xlsx) or a .csv file.");
}
