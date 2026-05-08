import mysql from 'mysql2/promise';

interface TimeColumn {
  tableName: string;
  columnName: string;
  comment: string;
}

const timeColumns: TimeColumn[] = [
  { tableName: 'admin_users', columnName: 'created_at', comment: '帳號建立 Unix timestamp 秒數' },
  { tableName: 'admin_users', columnName: 'updated_at', comment: '帳號最後更新 Unix timestamp 秒數' },
  { tableName: 'players', columnName: 'created_at', comment: '玩家資料建立 Unix timestamp 秒數' },
  { tableName: 'players', columnName: 'updated_at', comment: '玩家資料最後更新 Unix timestamp 秒數' },
  { tableName: 'turnover_adjustments', columnName: 'created_at', comment: '異動建立 Unix timestamp 秒數' },
  { tableName: 'spin_records', columnName: 'created_at', comment: '抽獎建立 Unix timestamp 秒數' },
  { tableName: 'demo_sessions', columnName: 'expires_at', comment: 'token 過期 Unix timestamp 秒數' },
  { tableName: 'demo_sessions', columnName: 'created_at', comment: 'session 建立 Unix timestamp 秒數' },
];

function envNumber(name: string, fallback: number) {
  const value = process.env[name];
  return value ? Number(value) : fallback;
}

function quoteIdentifier(value: string) {
  return `\`${value.replace(/`/g, '``')}\``;
}

async function columnType(connection: mysql.Connection, database: string, tableName: string, columnName: string) {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    `SELECT DATA_TYPE AS dataType
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [database, tableName, columnName],
  );

  return rows[0]?.dataType as string | undefined;
}

async function convertColumn(connection: mysql.Connection, database: string, column: TimeColumn) {
  const type = await columnType(connection, database, column.tableName, column.columnName);

  if (!type) {
    console.log(`skip ${column.tableName}.${column.columnName}: column not found`);
    return;
  }

  const table = quoteIdentifier(column.tableName);
  const originalColumn = quoteIdentifier(column.columnName);

  if (type === 'int') {
    await connection.query(`ALTER TABLE ${table} MODIFY ${originalColumn} INT UNSIGNED NOT NULL COMMENT ?`, [column.comment]);
    console.log(`ok ${column.tableName}.${column.columnName}: already int`);
    return;
  }

  const temporaryColumn = quoteIdentifier(`${column.columnName}_unix_tmp`);

  await connection.query(`ALTER TABLE ${table} ADD COLUMN ${temporaryColumn} INT UNSIGNED NULL COMMENT ?`, [column.comment]);
  await connection.query(`UPDATE ${table} SET ${temporaryColumn} = UNIX_TIMESTAMP(${originalColumn})`);
  await connection.query(`ALTER TABLE ${table} DROP COLUMN ${originalColumn}`);
  await connection.query(`ALTER TABLE ${table} CHANGE ${temporaryColumn} ${originalColumn} INT UNSIGNED NOT NULL COMMENT ?`, [column.comment]);
  console.log(`converted ${column.tableName}.${column.columnName}: ${type} -> int unsigned`);
}

async function main() {
  const database = process.env.DB_DATABASE ?? 'wheel_event';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: envNumber('DB_PORT', 3306),
    user: process.env.DB_USERNAME ?? 'wheel_app',
    password: process.env.DB_PASSWORD ?? 'wheel_password',
    database,
    multipleStatements: false,
  });

  try {
    for (const column of timeColumns) {
      await convertColumn(connection, database, column);
    }
  } finally {
    await connection.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
