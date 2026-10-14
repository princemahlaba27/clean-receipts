import * as SQLite from 'expo-sqlite';

import { isCategory, type Category } from '../services/receiptParser';
import { createId } from '../services/ids';
import type { LineItem, StoredReceipt } from '../types';

type ReceiptRow = {
  id: string;
  merchant: string;
  date: string;
  category: string;
  subtotal: number;
  tax: number;
  total: number;
  reference: string;
  image_path: string;
  deductible: number;
  created_at: number;
};

type LineRow = {
  id: string;
  receipt_id: string;
  label: string;
  amount: number;
  qty: number | null;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function database(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('tax-vault.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS receipts (
          id TEXT PRIMARY KEY NOT NULL,
          merchant TEXT NOT NULL,
          date TEXT NOT NULL,
          category TEXT NOT NULL,
          subtotal REAL NOT NULL,
          tax REAL NOT NULL,
          total REAL NOT NULL,
          reference TEXT NOT NULL,
          image_path TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS line_items (
          id TEXT PRIMARY KEY NOT NULL,
          receipt_id TEXT NOT NULL,
          label TEXT NOT NULL,
          amount REAL NOT NULL,
          qty REAL NOT NULL DEFAULT 1,
          FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      await addColumn(db, 'receipts', 'deductible', 'INTEGER NOT NULL DEFAULT 1');
      await addColumn(db, 'line_items', 'qty', 'REAL NOT NULL DEFAULT 1');
      return db;
    });
  }
  return databasePromise;
}

export async function countReceipts(): Promise<number> {
  const db = await database();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM receipts');
  return row?.count ?? 0;
}

export async function listReceipts(): Promise<StoredReceipt[]> {
  const db = await database();
  const receipts = await db.getAllAsync<ReceiptRow>('SELECT * FROM receipts ORDER BY date DESC, created_at DESC');
  const lines = await db.getAllAsync<LineRow>('SELECT * FROM line_items');
  const grouped = new Map<string, LineItem[]>();
  for (const line of lines) {
    const bucket = grouped.get(line.receipt_id) ?? [];
    bucket.push({ id: line.id, label: line.label, amount: line.amount, qty: line.qty ?? 1 });
    grouped.set(line.receipt_id, bucket);
  }
  return receipts.map((row) => ({
    id: row.id,
    merchant: row.merchant,
    date: row.date,
    category: categoryOrOther(row.category),
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    reference: row.reference,
    imagePath: row.image_path,
    deductible: row.deductible !== 0,
    createdAt: row.created_at,
    lineItems: grouped.get(row.id) ?? [],
  }));
}

export async function insertReceipt(input: {
  merchant: string;
  date: string;
  category: Category;
  subtotal: number;
  tax: number;
  total: number;
  reference: string;
  imagePath: string;
  deductible: boolean;
  lineItems: LineItem[];
}): Promise<string> {
  const db = await database();
  const id = createId();
  const createdAt = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO receipts (id, merchant, date, category, subtotal, tax, total, reference, image_path, deductible, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.merchant, input.date, input.category, input.subtotal, input.tax, input.total, input.reference, input.imagePath, input.deductible ? 1 : 0, createdAt],
    );
    for (const item of input.lineItems) {
      await db.runAsync(
        'INSERT INTO line_items (id, receipt_id, label, amount, qty) VALUES (?, ?, ?, ?, ?)',
        [item.id || createId(), id, item.label, item.amount, item.qty || 1],
      );
    }
  });
  return id;
}

function categoryOrOther(value: string): Category {
  return isCategory(value) ? value : 'Other';
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await database();
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

async function addColumn(db: SQLite.SQLiteDatabase, table: string, column: string, definition: string): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (columns.some((item) => item.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
