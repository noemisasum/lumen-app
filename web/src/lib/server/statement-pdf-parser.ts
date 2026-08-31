import { PDFParse } from "pdf-parse";
import {
  parseStatementRows,
  type ParsedStatementInput,
  type ParsedStatementResult,
  type StatementParserRow,
} from "@/lib/server/statement-csv-parser";
import type { BankBalanceInput } from "@/lib/server/bank-ledger";

type BalanceMetadata = {
  balanceType: BankBalanceInput["balanceType"];
  amount: number;
  lineNumber: number;
};

type ParsedTransactionLine = {
  lineNumber: number;
  transactionDate: string;
  postedDate: string;
  description: string;
  reference: string;
  amount: number;
  signedAmount: number | null;
  balance: number | null;
  amountToken: string;
  balanceToken: string | null;
};

type PdfStatementTextModel = {
  rows: StatementParserRow[];
  warnings: string[];
};

const maxPdfTextCharacters = 500_000;
const datePattern = String.raw`(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})`;
const amountPattern = String.raw`(?:\(?[+-]?(?:(?:[$£€¥]|HKD|USD|SGD|AUD|CAD|NZD)\s*)?\d[\d,]*(?:\.\d+)?\)?(?:\s*(?:CR|DR))?)`;
const trailingAmountPattern = new RegExp(`${amountPattern}\\s*$`, "i");
const allAmountPattern = new RegExp(amountPattern, "gi");

export async function parsePdfStatement(pdfData: ArrayBuffer, input: ParsedStatementInput): Promise<ParsedStatementResult> {
  const text = await extractPdfText(pdfData);
  return parsePdfStatementText(text, input);
}

export function parsePdfStatementText(pdfText: string, input: ParsedStatementInput): ParsedStatementResult {
  const model = pdfTextToStatementRows(pdfText);
  const parsed = parseStatementRows(model.rows, input, {
    fileTypeName: "PDF",
    sourceRecordPrefix: "pdf",
    sourceRowId: (row) => `${input.statementImportId}:pdf:line:${row.sourceRowNumber}`,
    balanceSourceRowId: (row, balanceType) => `${input.statementImportId}:pdf:balance:${balanceType}:line:${row.sourceRowNumber}`,
    rawPayload: (row) => pdfRawPayload(input.fileName, row),
    runningBalancePayload: (row) => pdfRawPayload(input.fileName, row),
    balancePayload: (row) => pdfRawPayload(input.fileName, row),
  });

  return {
    ...parsed,
    warnings: [...model.warnings, ...parsed.warnings],
  };
}

async function extractPdfText(pdfData: ArrayBuffer) {
  const parser = new PDFParse({ data: Buffer.from(pdfData) });
  try {
    const result = await parser.getText();
    const text = result.text.trim();
    if (!text) throw new Error("PDF statement did not contain extractable text.");
    if (text.length > maxPdfTextCharacters) throw new Error("PDF statement text is too large for automatic parsing.");
    return text;
  } finally {
    await parser.destroy();
  }
}

function pdfTextToStatementRows(pdfText: string): PdfStatementTextModel {
  const lines = normalizedTextLines(pdfText);
  if (!lines.length) throw new Error("PDF statement did not contain extractable text.");
  if (!isSupportedHwPdfText(lines)) {
    throw new Error("PDF statement is not a recognized H&W statement layout and was not imported automatically.");
  }

  const period = findStatementPeriod(lines);
  const balances = findBalanceMetadata(lines);
  const openingBalance = balances.find((balance) => balance.balanceType === "opening") ?? null;
  const closingBalance = [...balances].reverse().find((balance) => balance.balanceType === "closing" || balance.balanceType === "current") ?? null;
  const transactionLines = parseTransactionLines(lines);
  if (!transactionLines.length) {
    throw new Error("PDF statement did not contain recognizable H&W transaction rows.");
  }

  assignUnsignedDirections(transactionLines, openingBalance?.amount ?? null);

  const ambiguous = transactionLines.find((line) => line.signedAmount === null);
  if (ambiguous) {
    throw new Error(
      `PDF statement transaction on line ${ambiguous.lineNumber} has an unsigned amount without a reliable balance delta, so it was not imported automatically.`,
    );
  }

  const rows: StatementParserRow[] = [
    {
      sourceRowNumber: 0,
      fields: ["Date", "Value Date", "Description", "Reference", "Debit", "Credit", "Running Balance"],
    },
  ];

  for (const balance of balances) {
    const balanceDate = balanceDateForType(balance.balanceType, period, transactionLines);
    if (!balanceDate) continue;
    rows.push({
      sourceRowNumber: balance.lineNumber,
      fields: [balanceDate, "", balanceTypeLabel(balance.balanceType), "", "", "", amountText(balance.amount)],
    });
  }

  for (const line of transactionLines) {
    const signedAmount = line.signedAmount ?? 0;
    rows.push({
      sourceRowNumber: line.lineNumber,
      fields: [
        line.transactionDate,
        line.postedDate,
        line.description,
        line.reference,
        signedAmount < 0 ? amountText(Math.abs(signedAmount)) : "",
        signedAmount > 0 ? amountText(signedAmount) : "",
        line.balance === null ? "" : amountText(line.balance),
      ],
    });
  }

  const warnings: string[] = [];
  if (closingBalance && transactionLines.at(-1)?.balance !== null && transactionLines.at(-1)?.balance !== closingBalance.amount) {
    warnings.push("PDF statement closing balance did not match the last parsed running balance.");
  }

  return { rows, warnings };
}

function normalizedTextLines(pdfText: string) {
  return pdfText
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line, index) => ({ lineNumber: index + 1, text: line.trim().replace(/\s+/g, " ") }))
    .filter((line) => line.text);
}

function isSupportedHwPdfText(lines: Array<{ text: string }>) {
  const joined = lines.map((line) => line.text).join(" ").toLowerCase();
  const hasStatementSignals = /\b(statement|account\s+activity|transaction\s+history)\b/.test(joined);
  const hasTransactionSignals = /\b(date|value\s+date)\b/.test(joined) && /\b(debit|credit|amount)\b/.test(joined) && /\bbalance\b/.test(joined);
  const hasHwSignal = /\bh&w\b|\bh\s*&\s*w\b|hang\s+w/i.test(joined);
  return hasHwSignal && hasStatementSignals && hasTransactionSignals;
}

function findStatementPeriod(lines: Array<{ text: string }>) {
  for (const line of lines) {
    const dates = [...line.text.matchAll(new RegExp(datePattern, "g"))].map((match) => match[0]);
    if (dates.length >= 2 && /\b(period|from|to|statement)\b/i.test(line.text)) {
      return { startDate: dates[0], endDate: dates[1] };
    }
  }
  return { startDate: null, endDate: null };
}

function findBalanceMetadata(lines: Array<{ lineNumber: number; text: string }>): BalanceMetadata[] {
  const balances: BalanceMetadata[] = [];
  for (const line of lines) {
    const balanceType = detectBalanceType(line.text);
    if (!balanceType) continue;
    const amount = parseLastAmount(line.text);
    if (amount === null) continue;
    balances.push({ balanceType, amount, lineNumber: line.lineNumber });
  }
  return balances;
}

function detectBalanceType(value: string): BankBalanceInput["balanceType"] | null {
  const normalized = value.toLowerCase();
  if (/\bopening\s+balance\b/.test(normalized)) return "opening";
  if (/\bclosing\s+balance\b/.test(normalized)) return "closing";
  if (/\bavailable\s+balance\b/.test(normalized)) return "available";
  if (/\bcurrent\s+balance\b|\blatest\s+balance\b/.test(normalized)) return "current";
  if (/\bstatement\s+balance\b/.test(normalized)) return "statement";
  return null;
}

function parseTransactionLines(lines: Array<{ lineNumber: number; text: string }>): ParsedTransactionLine[] {
  const transactionLines: ParsedTransactionLine[] = [];
  const startPattern = new RegExp(`^(${datePattern})(?:\\s+(${datePattern}))?\\s+(.+)$`, "i");

  for (const line of lines) {
    if (isIgnoredLine(line.text)) continue;
    const startMatch = line.text.match(startPattern);
    if (!startMatch) continue;

    const transactionDate = startMatch[1];
    const postedDate = startMatch[2] ?? startMatch[1];
    const remainder = startMatch[3].trim();
    const amountMatches = [...remainder.matchAll(allAmountPattern)].filter((match) => typeof match.index === "number");
    if (!amountMatches.length) continue;

    const endingMatches = trailingAmountMatches(remainder);
    if (!endingMatches.length) continue;
    const balanceToken = endingMatches.length >= 2 ? endingMatches.at(-1)?.[0] ?? null : null;
    const amountToken = endingMatches.length >= 2 ? endingMatches.at(-2)?.[0] ?? "" : endingMatches.at(-1)?.[0] ?? "";
    const amountStart = endingMatches.length >= 2 ? endingMatches.at(-2)?.index ?? -1 : endingMatches.at(-1)?.index ?? -1;
    if (!amountToken || amountStart < 1) continue;

    const amount = parseAmount(amountToken);
    const balance = balanceToken ? parseAmount(balanceToken) : null;
    if (amount === null || (balanceToken && balance === null)) continue;

    const descriptor = remainder.slice(0, amountStart).trim().replace(/\s{2,}/g, " ");
    const { description, reference } = splitDescriptionReference(descriptor);
    if (!description || isSummaryDescription(description)) continue;

    transactionLines.push({
      lineNumber: line.lineNumber,
      transactionDate,
      postedDate,
      description,
      reference,
      amount: Math.abs(amount),
      signedAmount: amountHasExplicitSign(amountToken) ? amount : null,
      balance,
      amountToken,
      balanceToken,
    });
  }

  return transactionLines;
}

function trailingAmountMatches(value: string) {
  const matches: RegExpMatchArray[] = [];
  let remaining = value.trim();

  while (remaining) {
    const match = remaining.match(trailingAmountPattern);
    if (!match || match.index === undefined) break;
    matches.unshift(match);
    remaining = remaining.slice(0, match.index).trim();
  }

  return matches;
}

function assignUnsignedDirections(transactionLines: ParsedTransactionLine[], openingBalance: number | null) {
  let previousBalance = openingBalance;

  for (const line of transactionLines) {
    if (line.signedAmount === null && line.balance !== null && previousBalance !== null) {
      const delta = roundMoney(line.balance - previousBalance);
      if (roundMoney(Math.abs(delta)) === roundMoney(line.amount)) {
        line.signedAmount = delta;
      }
    }

    if (line.balance !== null) previousBalance = line.balance;
  }
}

function isIgnoredLine(value: string) {
  return /\b(page\s+\d+\s+of\s+\d+|continued|generated|important notice|total debit|total credit|number of transaction)\b/i.test(value);
}

function isSummaryDescription(value: string) {
  return /^(total|summary|opening balance|closing balance|available balance|current balance|latest balance)\b/i.test(value);
}

function splitDescriptionReference(value: string) {
  const compacted = value.trim().replace(/\s+/g, " ");
  const referenceMatch = compacted.match(/\b(?:ref(?:erence)?(?:\s+no\.?| number)?|bank reference(?: number)?)[:\s]+([A-Z0-9][A-Z0-9/-]{2,})$/i);
  if (referenceMatch?.index !== undefined) {
    return {
      description: compacted.slice(0, referenceMatch.index).trim(),
      reference: referenceMatch[1],
    };
  }

  const trailingReference = compacted.match(/\s([A-Z]{2,}[-/][A-Z0-9/-]+|[A-Z0-9]{4,}-\d{2,})$/);
  if (trailingReference?.index !== undefined) {
    return {
      description: compacted.slice(0, trailingReference.index).trim(),
      reference: trailingReference[1],
    };
  }

  return { description: compacted, reference: "" };
}

function balanceDateForType(
  balanceType: BankBalanceInput["balanceType"],
  period: { startDate: string | null; endDate: string | null },
  transactionLines: ParsedTransactionLine[],
) {
  if (balanceType === "opening") return period.startDate ?? transactionLines[0]?.transactionDate ?? null;
  if (balanceType === "closing" || balanceType === "current" || balanceType === "statement") {
    return period.endDate ?? transactionLines.at(-1)?.transactionDate ?? null;
  }
  return transactionLines.at(-1)?.transactionDate ?? period.endDate ?? null;
}

function balanceTypeLabel(balanceType: BankBalanceInput["balanceType"]) {
  switch (balanceType) {
    case "opening":
      return "Opening Balance";
    case "closing":
      return "Closing Balance";
    case "available":
      return "Available Balance";
    case "current":
      return "Current Balance";
    case "statement":
      return "Statement Balance";
    default:
      return "Reported Balance";
  }
}

function parseLastAmount(value: string) {
  const matches = [...value.matchAll(allAmountPattern)];
  const last = matches.at(-1)?.[0];
  return last ? parseAmount(last) : null;
}

function parseAmount(value: string) {
  const trimmed = value.trim();
  const negative = /^\(/.test(trimmed) || /^\s*-/.test(trimmed) || /\bDR\b/i.test(trimmed);
  const positive = /\bCR\b/i.test(trimmed);
  const numeric = trimmed.replace(/[$£€¥]|HKD|USD|SGD|AUD|CAD|NZD|\bCR\b|\bDR\b|[(),\s]/gi, "");
  if (!numeric || numeric === "+" || numeric === "-") return null;
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;
  if (negative) return -Math.abs(parsed);
  if (positive) return Math.abs(parsed);
  return parsed;
}

function amountHasExplicitSign(value: string) {
  return /^\s*\(|[+-]|\b(?:CR|DR)\b/i.test(value);
}

function amountText(value: number) {
  return roundMoney(value).toFixed(2);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function pdfRawPayload(fileName: string | null | undefined, row: StatementParserRow) {
  return {
    fileName: fileName ?? null,
    sourceLineNumber: row.sourceRowNumber,
    fields: row.fields,
  };
}
