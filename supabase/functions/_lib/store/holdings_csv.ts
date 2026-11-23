// CSV parsing for POST /v1/user/holdings/import. Pure, no database.
// Ported as is from apps/product-api/src/routes/holdings-import-routes.ts.

export const MAX_DATA_ROWS = 500;

const HEADER_ALIASES: Record<"ticker" | "shares" | "cost_basis", string[]> = {
  ticker: ["ticker", "symbol"],
  shares: ["shares", "quantity", "qty"],
  cost_basis: ["cost_basis", "cost basis", "costbasis", "cost"],
};

export interface CsvRow {
  line: number;
  cells: string[];
}

export interface CsvColumns {
  ticker: number;
  shares: number;
  cost_basis: number;
}

export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

// Accepts "1,234.5" and "$170.20" as broker exports often write them.
// undefined = empty cell, null = not a non-negative number.
export function parseAmount(value: string | undefined): number | undefined | null {
  const cleaned = value?.replace(/[$,\s]/g, "") ?? "";
  if (cleaned.length === 0) return undefined;
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function findColumn(header: string[], field: keyof typeof HEADER_ALIASES): number {
  return header.findIndex((cell) => HEADER_ALIASES[field].includes(cell.toLowerCase()));
}

export type ParsedCsv =
  | { ok: true; rows: CsvRow[]; columns: CsvColumns }
  | { ok: false; errorMessage: string };

// Splits lines, drops blank ones, reads an optional header, and checks the row cap.
export function parseHoldingsCsv(csv: string): ParsedCsv {
  const lines = csv
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((text, index) => ({ line: index + 1, cells: splitCsvLine(text) }))
    .filter((row) => row.cells.some((cell) => cell.length > 0));

  let columns: CsvColumns = { ticker: 0, shares: 1, cost_basis: 2 };
  const first = lines[0]?.cells ?? [];
  if (findColumn(first, "ticker") >= 0) {
    columns = {
      ticker: findColumn(first, "ticker"),
      shares: findColumn(first, "shares"),
      cost_basis: findColumn(first, "cost_basis"),
    };
    if (columns.shares < 0) {
      return { ok: false, errorMessage: "CSV header must include a shares (or quantity) column." };
    }
    lines.shift();
  }

  if (lines.length > MAX_DATA_ROWS) {
    return { ok: false, errorMessage: `CSV may contain at most ${MAX_DATA_ROWS} holdings.` };
  }
  return { ok: true, rows: lines, columns };
}
