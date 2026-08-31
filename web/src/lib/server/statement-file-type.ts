export type StatementParserType = "csv" | "xlsx" | "xls" | "pdf";

export function statementParserType(objectKey: string, mimeType: string | null): StatementParserType | null {
  const lowerKey = objectKey.toLowerCase();
  const lowerType = mimeType?.toLowerCase() ?? "";
  if (lowerKey.endsWith(".csv") || lowerType.includes("csv") || lowerType === "text/plain") return "csv";
  if (
    lowerKey.endsWith(".xlsx") ||
    lowerType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    lowerType === "application/xlsx"
  ) {
    return "xlsx";
  }
  if (lowerKey.endsWith(".xls") || lowerType === "application/vnd.ms-excel" || lowerType === "application/xls") return "xls";
  if (lowerKey.endsWith(".pdf") || lowerType === "application/pdf" || lowerType === "application/x-pdf") return "pdf";
  return null;
}
