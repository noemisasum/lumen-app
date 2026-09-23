import {
  parseStatementRows,
  type ParsedStatementMetadata,
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
  metadata: ParsedStatementMetadata;
};

const maxPdfTextCharacters = 500_000;
const datePattern = String.raw`(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}[-\s][A-Za-z]{3,9}[-,\s]\d{2,4})`;
const amountPattern = String.raw`(?:\(?[+-]?(?:(?:[$£€¥]|[A-Z]{3,4})\s*)?\d[\d,]*\.\d+\)?(?:\s*(?:CR|DR))?)`;
const trailingAmountPattern = new RegExp(`${amountPattern}\\s*$`, "i");
const allAmountPattern = new RegExp(amountPattern, "gi");
const startPattern = new RegExp(`^(${datePattern})(?:\\s+(${datePattern}))?\\s+(.+)$`, "i");

type PdfAmountLayout = "signed" | "debitCredit" | "debitCreditBalance" | "creditDebit" | "creditDebitBalance";

type PdfStatementSection = {
  headerLineNumber: number;
  amountLayout: PdfAmountLayout;
  hasBalance: boolean;
  rows: PdfTransactionRecord[];
};

type PdfTransactionRecord = {
  lineNumber: number;
  text: string;
};

export class UnsupportedPdfStatementLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedPdfStatementLayoutError";
  }
}

export class NotBankStatementPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotBankStatementPdfError";
  }
}

export function isUnsupportedPdfStatementLayoutError(error: unknown) {
  return error instanceof UnsupportedPdfStatementLayoutError;
}

export function isNotBankStatementPdfError(error: unknown) {
  return error instanceof NotBankStatementPdfError;
}

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
    metadata: model.metadata,
  };
}

async function extractPdfText(pdfData: ArrayBuffer) {
  const PDFParse = await loadPdfParser();
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

async function loadPdfParser() {
  await installPdfCanvasPolyfills();
  const { PDFParse } = await import("pdf-parse");
  return PDFParse;
}

async function installPdfCanvasPolyfills() {
  const canvas = await import("@napi-rs/canvas");
  const globals = globalThis as Record<string, unknown>;
  globals.DOMMatrix ??= canvas.DOMMatrix;
  globals.ImageData ??= canvas.ImageData;
  globals.Path2D ??= canvas.Path2D;
}

function pdfTextToStatementRows(pdfText: string): PdfStatementTextModel {
  const lines = normalizedTextLines(pdfText);
  if (!lines.length) throw new Error("PDF statement did not contain extractable text.");
  if (isClearlyNotBankStatementPdfText(lines)) {
    throw new NotBankStatementPdfError("PDF does not appear to be a bank statement. Upload a bank statement for the selected account.");
  }
  if (!isSupportedHwPdfText(lines)) {
    throw new UnsupportedPdfStatementLayoutError("PDF statement layout is not recognized for automatic parsing and remains queued for manual parser support.");
  }

  const period = findStatementPeriod(lines);
  const metadata = findStatementMetadata(lines, period);
  const balances = findBalanceMetadata(lines);
  const openingBalance = balances.find((balance) => balance.balanceType === "opening") ?? null;
  const closingBalance = [...balances].reverse().find((balance) => balance.balanceType === "closing" || balance.balanceType === "current") ?? null;
  const transactionLines = parseTransactionLines(lines);
  if (!transactionLines.length) {
    throw new UnsupportedPdfStatementLayoutError("PDF statement did not contain recognizable transaction rows and remains queued for manual parser support.");
  }

  assignUnsignedDirections(transactionLines, openingBalance?.amount ?? null);

  const ambiguous = transactionLines.find((line) => line.signedAmount === null);
  if (ambiguous) {
    throw new UnsupportedPdfStatementLayoutError(
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

  return { rows, warnings, metadata };
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
  const hasTransactionSignals =
    /\b(date|value\s+date|posting\s+date|time)\b/.test(joined) &&
    /\b(debit|credit|withdrawal|deposit|amount|money\s+out|money\s+in)\b/.test(joined);
  const hasSupportedProviderSignal = /\bh&w\b|\bh\s*&\s*w\b|hang\s+w|\bdbs\b|standard\s+chartered|\bscb\b|\bhsbc\b|\bosl\b/i.test(joined);
  return hasSupportedProviderSignal && hasStatementSignals && hasTransactionSignals;
}

function isClearlyNotBankStatementPdfText(lines: Array<{ text: string }>) {
  const joined = lines.map((line) => line.text).join(" ").toLowerCase();
  const hasBankStatementSignals =
    /\b(bank|account\s+statement|statement\s+period|transaction\s+history|account\s+activity|opening\s+balance|closing\s+balance)\b/.test(joined) &&
    /\b(account|statement|transaction|balance|debit|credit|deposit|withdrawal|money\s+in|money\s+out)\b/.test(joined);
  if (hasBankStatementSignals) return false;
  return /\b(invoice|receipt|purchase\s+order|quotation|contract|resume|curriculum\s+vitae|tax\s+invoice)\b/.test(joined) || !/\b(statement|account|balance|transaction)\b/.test(joined);
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

function findStatementMetadata(
  lines: Array<{ lineNumber: number; text: string }>,
  period: { startDate: string | null; endDate: string | null },
): ParsedStatementMetadata {
  const metadataLines = findStatementMetadataLines(lines);
  const accountHolderNames = uniqueCompact(metadataLines.flatMap((line) => extractAccountHolderNames(line.text)));
  const accountNames = uniqueCompact(metadataLines.flatMap((line) => extractAccountNames(line.text)));
  const accountNumbers = uniqueCompact(metadataLines.flatMap((line) => extractAccountNumbers(line.text)));

  return {
    statementPeriodStart: parsePdfDate(period.startDate),
    statementPeriodEnd: parsePdfDate(period.endDate),
    accountHolderNames,
    accountNames,
    accountNumbers,
  };
}

function findStatementMetadataLines(lines: Array<{ lineNumber: number; text: string }>) {
  const transactionHeaderIndex = findFirstTransactionHeaderIndex(lines);
  const headerLines = transactionHeaderIndex === -1 ? lines.slice(0, 40) : lines.slice(0, transactionHeaderIndex);
  const anchoredMetadataLines = lines.filter((line) => isAnchoredStatementMetadataLine(line.text));
  return uniqueLines([...headerLines, ...anchoredMetadataLines]);
}

function isAnchoredStatementMetadataLine(value: string) {
  return (
    /^(?:account\s+(?:holder|owner|name|alias|number|no\.?|#)|a\/c\s*(?:number|no\.?|#)?|customer\s+name|client\s+name|entity\s+name|company\s+name)\b/i.test(
      value,
    ) || /^(?:customer|client|entity|company)\s*[:=-]\s+\S/i.test(value)
  );
}

function extractAccountHolderNames(value: string) {
  const match = value.match(
    /^(?:account\s+(?:holder|owner)|customer\s+name|client\s+name|entity\s+name|company\s+name)\b\s*[:=-]?\s+(.+)$/i,
  ) ?? value.match(/^(?:customer|client|entity|company)\s*[:=-]\s+(.+)$/i);
  if (!match) return [];
  const name = stripTrailingStatementMetadata(match[1]);
  return name ? [name] : [];
}

function extractAccountNames(value: string) {
  const match = value.match(/^(?:account\s+name|account\s+alias)\b\s*[:=-]?\s+(.+)$/i);
  if (!match) return [];
  const name = stripTrailingStatementMetadata(match[1]);
  return name && !/\b(statement|number|currency|period)\b/i.test(name) ? [name] : [];
}

function extractAccountNumbers(value: string) {
  const matches = [
    ...value.matchAll(/^(?:account\s+(?:number|no\.?|#)|a\/c\s*(?:number|no\.?|#)?|account)\b\s*[:=-]?\s+([A-Z0-9][A-Z0-9 -]{3,})/gi),
  ];
  return matches
    .map((match) => stripTrailingStatementMetadata(match[1]))
    .filter((candidate) => candidate && /(?:\d.*){4,}/.test(candidate));
}

function stripTrailingStatementMetadata(value: string) {
  return value
    .replace(/\b(?:currency|statement|period|from|to)\b.*$/i, "")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueCompact(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueLines<T extends { lineNumber?: number; text: string }>(lines: T[]) {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = `${line.lineNumber ?? ""}:${line.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  for (const section of findTransactionSections(lines)) {
    for (const line of section.rows) {
      const startMatch = line.text.match(startPattern);
      if (!startMatch) continue;

      const transactionDate = startMatch[1];
      const postedDate = startMatch[2] ?? startMatch[1];
      const remainder = startMatch[3].trim();
      const parsed = parseTransactionRemainder(remainder, section);
      if (!parsed) continue;

      const { description, reference } = splitDescriptionReference(parsed.descriptor);
      if (!description || isSummaryDescription(description)) continue;

      transactionLines.push({
        lineNumber: line.lineNumber,
        transactionDate,
        postedDate,
        description,
        reference,
        amount: Math.abs(parsed.amount),
        signedAmount: parsed.signedAmount,
        balance: parsed.balance,
        amountToken: parsed.amountToken,
        balanceToken: parsed.balanceToken,
      });
    }
  }

  return transactionLines;
}

function findTransactionSections(lines: Array<{ lineNumber: number; text: string }>): PdfStatementSection[] {
  const sections: PdfStatementSection[] = [];
  let current: PdfStatementSection | null = null;
  let currentRow: PdfTransactionRecord | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;

    const transactionHeader = findTransactionHeaderAt(lines, index);
    if (transactionHeader) {
      if (currentRow) current?.rows.push(currentRow);
      currentRow = null;
      current = {
        headerLineNumber: transactionHeader.lineNumber,
        amountLayout: detectAmountLayout(transactionHeader.text),
        hasBalance: /\bbalance\b/i.test(transactionHeader.text),
        rows: [],
      };
      sections.push(current);
      index += transactionHeader.skipCount - 1;
      continue;
    }

    if (!current || isIgnoredLine(line.text) || detectBalanceType(line.text)) {
      if (currentRow) current?.rows.push(currentRow);
      currentRow = null;
      continue;
    }

    const startMatch = line.text.match(startPattern);
    if (startMatch || isDateOnlyLine(line.text)) {
      if (currentRow && isDateOnlyLine(currentRow.text) && isDateOnlyLine(line.text)) {
        currentRow.text = `${currentRow.text} ${line.text}`.trim();
        continue;
      }
      if (currentRow) current.rows.push(currentRow);
      currentRow = { lineNumber: line.lineNumber, text: line.text };
      continue;
    }

    if (currentRow && !isSummaryDescription(line.text)) {
      currentRow.text = `${currentRow.text} ${line.text}`.trim();
    }
  }

  if (currentRow) current?.rows.push(currentRow);
  return sections;
}

function findFirstTransactionHeaderIndex(lines: Array<{ lineNumber: number; text: string }>) {
  for (let index = 0; index < lines.length; index += 1) {
    const transactionHeader = findTransactionHeaderAt(lines, index);
    if (transactionHeader) return index;
  }
  return -1;
}

function findTransactionHeaderAt(lines: Array<{ lineNumber: number; text: string }>, startIndex: number) {
  const line = lines[startIndex];
  if (!line) return null;
  if (isTransactionHeaderLine(line.text)) return { lineNumber: line.lineNumber, text: line.text, skipCount: 1 };
  if (!isTransactionHeaderFragmentLine(line.text) || !hasTransactionHeaderDateSignal(line.text)) return null;

  const headerLines = [line];
  for (let index = startIndex + 1; index < Math.min(lines.length, startIndex + 8); index += 1) {
    const nextLine = lines[index];
    if (!nextLine || !isTransactionHeaderFragmentLine(nextLine.text)) break;
    headerLines.push(nextLine);
  }

  const headerText = headerLines.map((headerLine) => headerLine.text).join(" ");
  if (isTransactionHeaderLine(headerText)) {
    return {
      lineNumber: line.lineNumber,
      text: headerText,
      skipCount: headerLines.length,
    };
  }

  return null;
}

function isTransactionHeaderLine(value: string) {
  const normalized = value.toLowerCase();
  const hasDate = hasTransactionHeaderDateSignal(normalized);
  const hasDetails = hasTransactionHeaderDetailsSignal(normalized);
  const hasAmount = hasTransactionHeaderAmountSignal(normalized);
  return hasDate && hasDetails && hasAmount;
}

function isTransactionHeaderFragmentLine(value: string) {
  if (new RegExp(datePattern, "i").test(value) || parseLastAmount(value) !== null || detectBalanceType(value)) return false;
  const normalized = value.toLowerCase();
  return (
    hasTransactionHeaderDateSignal(normalized) ||
    hasTransactionHeaderDetailsSignal(normalized) ||
    hasTransactionHeaderAmountSignal(normalized) ||
    /\bbalance\b/.test(normalized)
  );
}

function hasTransactionHeaderDateSignal(value: string) {
  return /\b(date|value\s+date|posting\s+date|transaction\s+date|time)\b/i.test(value);
}

function hasTransactionHeaderDetailsSignal(value: string) {
  return /\b(description|details|narrative|particulars|transaction|type)\b/i.test(value);
}

function hasTransactionHeaderAmountSignal(value: string) {
  return /\b(debit|credit|withdrawal|deposit|amount|money\s+out|money\s+in)\b/i.test(value);
}

function isDateOnlyLine(value: string) {
  return new RegExp(`^${datePattern}$`, "i").test(value.trim());
}

function detectAmountLayout(header: string): PdfAmountLayout {
  const normalized = header.toLowerCase();
  if (/\b(debit|withdrawal|withdrawals|money\s+out)\b/.test(normalized) && /\b(credit|deposit|deposits|money\s+in)\b/.test(normalized)) {
    const debitIndex = normalized.search(/\b(debit|withdrawal|withdrawals|money\s+out)\b/);
    const creditIndex = normalized.search(/\b(credit|deposit|deposits|money\s+in)\b/);
    const creditBeforeDebit = creditIndex !== -1 && debitIndex !== -1 && creditIndex < debitIndex;
    if (/\bbalance\b/.test(normalized)) return creditBeforeDebit ? "creditDebitBalance" : "debitCreditBalance";
    return creditBeforeDebit ? "creditDebit" : "debitCredit";
  }
  return "signed";
}

function parseTransactionRemainder(remainder: string, section: PdfStatementSection) {
  const endingMatches = trailingAmountMatches(remainder);
  if (!endingMatches.length) return null;

  if (section.amountLayout === "debitCreditBalance" || section.amountLayout === "creditDebitBalance") {
    const balanceMatch = endingMatches.at(-1);
    if (!balanceMatch) return null;
    const balanceToken = balanceMatch[0];
    const balance = parseAmount(balanceToken);
    if (balance === null) return null;

    const beforeBalance = remainder.slice(0, balanceMatch.index).trim();
    const amountMatches = trailingAmountMatches(beforeBalance);
    const firstColumnMatch = amountMatches.length >= 2 ? (amountMatches.at(-2) ?? null) : null;
    const secondColumnMatch = amountMatches.length >= 2 ? (amountMatches.at(-1) ?? null) : null;
    const debitMatch = section.amountLayout === "creditDebitBalance" ? secondColumnMatch : firstColumnMatch;
    const creditMatch = section.amountLayout === "creditDebitBalance" ? firstColumnMatch : secondColumnMatch;
    const credit = creditMatch ? parseAmount(creditMatch[0]) : null;
    const debit = debitMatch ? parseAmount(debitMatch[0]) : null;
    const singleAmountMatch = amountMatches.length === 1 ? (amountMatches[0] ?? null) : null;
    const singleAmount = singleAmountMatch ? parseAmount(singleAmountMatch[0]) : null;
    const amountMatch = nonZeroAmountMatch(debitMatch, debit) ?? nonZeroAmountMatch(creditMatch, credit) ?? nonZeroAmountMatch(singleAmountMatch, singleAmount);
    if (!amountMatch) return null;

    const signedAmount =
      debit !== null && debit !== 0
        ? -Math.abs(debit)
        : credit !== null && credit !== 0
          ? Math.abs(credit)
          : singleAmount !== null && amountHasExplicitSign(singleAmountMatch?.[0] ?? "")
            ? singleAmount
            : null;
    const amount = debit !== null && debit !== 0 ? debit : credit !== null && credit !== 0 ? credit : singleAmount;
    if (amount === null) return null;
    const descriptorEnd = firstColumnMatch?.index ?? amountMatch.index;
    return {
      descriptor: beforeBalance.slice(0, descriptorEnd).trim().replace(/\s{2,}/g, " "),
      amount: Math.abs(amount),
      signedAmount,
      balance,
      amountToken: amountMatch[0],
      balanceToken,
    };
  }

  if (section.amountLayout === "debitCredit" || section.amountLayout === "creditDebit") {
    const firstColumnMatch = endingMatches.length >= 2 ? (endingMatches.at(-2) ?? null) : null;
    const secondColumnMatch = endingMatches.length >= 2 ? (endingMatches.at(-1) ?? null) : null;
    const debitMatch = section.amountLayout === "creditDebit" ? secondColumnMatch : firstColumnMatch;
    const creditMatch = section.amountLayout === "creditDebit" ? firstColumnMatch : secondColumnMatch;
    const credit = creditMatch ? parseAmount(creditMatch[0]) : null;
    const debit = debitMatch ? parseAmount(debitMatch[0]) : null;
    const amountMatch = nonZeroAmountMatch(debitMatch, debit) ?? nonZeroAmountMatch(creditMatch, credit);
    if (!amountMatch) return null;
    const signedAmount = debit !== null && debit !== 0 ? -Math.abs(debit) : credit !== null && credit !== 0 ? Math.abs(credit) : null;
    if (signedAmount === null) return null;
    const descriptorEnd = firstColumnMatch?.index ?? amountMatch.index;
    return {
      descriptor: remainder.slice(0, descriptorEnd).trim().replace(/\s{2,}/g, " "),
      amount: Math.abs(signedAmount),
      signedAmount,
      balance: null,
      amountToken: amountMatch[0],
      balanceToken: null,
    };
  }

  const balanceToken = section.hasBalance && endingMatches.length >= 2 ? endingMatches.at(-1)?.[0] ?? null : null;
  const amountToken = section.hasBalance && endingMatches.length >= 2 ? endingMatches.at(-2)?.[0] ?? "" : endingMatches.at(-1)?.[0] ?? "";
  const amountStart = section.hasBalance && endingMatches.length >= 2 ? endingMatches.at(-2)?.index ?? -1 : endingMatches.at(-1)?.index ?? -1;
  if (!amountToken || amountStart < 1) return null;

  const amount = parseAmount(amountToken);
  const balance = balanceToken ? parseAmount(balanceToken) : null;
  if (amount === null || (balanceToken && balance === null)) return null;

  return {
    descriptor: remainder.slice(0, amountStart).trim().replace(/\s{2,}/g, " "),
    amount: Math.abs(amount),
    signedAmount: amountHasExplicitSign(amountToken) ? amount : null,
    balance,
    amountToken,
    balanceToken,
  };
}

function nonZeroAmountMatch(match: RegExpMatchArray | null, amount: number | null) {
  return match && amount !== null && amount !== 0 ? match : null;
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
  const numeric = trimmed.replace(/[$£€¥]|\b[A-Z]{3,4}\b|\bCR\b|\bDR\b|[(),\s]/gi, "");
  if (!numeric || numeric === "+" || numeric === "-") return null;
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;
  if (negative) return -Math.abs(parsed);
  if (positive) return Math.abs(parsed);
  return parsed;
}

function parsePdfDate(value: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const named = trimmed.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-,\s](\d{2,4})$/);
  if (named) {
    const month = monthNumber(named[2]);
    return month ? validIsoDate(normalizeYear(Number(named[3])), month, Number(named[1])) : null;
  }

  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!slash) return null;
  const first = Number(slash[1]);
  const second = Number(slash[2]);
  const year = normalizeYear(Number(slash[3]));
  if (first > 12 && second <= 12) return validIsoDate(year, second, first);
  if (second > 12 && first <= 12) return validIsoDate(year, first, second);
  return validIsoDate(year, second, first);
}

function normalizeYear(year: number) {
  if (year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return year;
}

function monthNumber(value: string) {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const index = months.indexOf(value.slice(0, 3).toLowerCase());
  return index === -1 ? null : index + 1;
}

function validIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
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
