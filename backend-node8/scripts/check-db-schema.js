'use strict';

const config = require('../src/config');
const db = require('../src/db');

const REQUIRED_COLUMNS = {
  admin_users: {
    id: { type: 'varchar(36)', nullable: false },
    username: { type: 'varchar(80)', nullable: false },
    password_hash: { type: 'varchar(255)', nullable: false },
    is_active: { type: /^tinyint/, nullable: false },
    created_at: { type: 'int unsigned', nullable: false },
    updated_at: { type: 'int unsigned', nullable: false }
  },
  players: {
    id: { type: 'varchar(36)', nullable: false },
    external_id: { type: 'varchar(120)', nullable: false },
    created_at: { type: 'int unsigned', nullable: false },
    updated_at: { type: 'int unsigned', nullable: false }
  },
  player_daily_progress: {
    id: { type: 'varchar(36)', nullable: false },
    player_id: { type: /^varchar\(/, nullable: false },
    business_date: { type: 'varchar(10)', nullable: false },
    turnover_points: { type: 'int unsigned', nullable: false },
    unlocked_stage: { type: 'tinyint unsigned', nullable: false }
  },
  spin_records: {
    id: { type: 'varchar(36)', nullable: false },
    player_id: { type: /^varchar\(/, nullable: false },
    business_date: { type: 'varchar(10)', nullable: false },
    stage_number: { type: 'tinyint unsigned', nullable: false },
    prize_config_id: { type: 'int', nullable: true },
    prize_name: { type: 'varchar(120)', nullable: false },
    amount_points: { type: 'int unsigned', nullable: false },
    created_at: { type: 'int unsigned', nullable: false },
    probability_table: { type: 'varchar(10)', nullable: false }
  },
  award_override_rules: {
    id: { type: 'varchar(36)', nullable: false },
    player_id: { type: /^varchar\(/, nullable: false },
    business_date: { type: 'varchar(10)', nullable: false },
    stage_number: { type: 'tinyint unsigned', nullable: false },
    status: { type: 'varchar(20)', nullable: false },
    pending_key: { type: 'varchar(180)', nullable: true },
    reason: { type: 'varchar(255)', nullable: true },
    created_by_admin_id: { type: 'varchar(36)', nullable: true },
    cancelled_by_admin_id: { type: 'varchar(36)', nullable: true },
    consumed_spin_record_id: { type: 'varchar(36)', nullable: true },
    created_at: { type: 'int unsigned', nullable: false },
    updated_at: { type: 'int unsigned', nullable: false },
    consumed_at: { type: 'int unsigned', nullable: true },
    cancelled_at: { type: 'int unsigned', nullable: true }
  },
  webview_sessions: {
    id: { type: 'varchar(36)', nullable: false },
    player_id: { type: /^varchar\(/, nullable: false },
    token: { type: 'varchar(128)', nullable: false },
    expires_at: { type: 'int unsigned', nullable: false },
    created_at: { type: 'int unsigned', nullable: false }
  }
};

const OPTIONAL_COLUMNS = {
  turnover_adjustments: {
    id: { type: 'varchar(36)', nullable: false },
    player_id: { type: /^varchar\(/, nullable: false },
    business_date: { type: 'varchar(10)', nullable: false },
    amount_points: { type: 'int unsigned', nullable: false },
    source: { type: 'varchar(40)', nullable: false },
    reason: { type: 'varchar(255)', nullable: true },
    created_at: { type: 'int unsigned', nullable: false }
  }
};

const REQUIRED_UNIQUE_INDEXES = [
  { table: 'admin_users', columns: ['username'] },
  { table: 'players', columns: ['external_id'] },
  { table: 'player_daily_progress', columns: ['player_id', 'business_date'] },
  { table: 'spin_records', columns: ['player_id', 'business_date', 'stage_number'] },
  { table: 'award_override_rules', columns: ['pending_key'] },
  { table: 'webview_sessions', columns: ['token'] }
];

const REQUIRED_INDEXES = [
  { table: 'player_daily_progress', columns: ['business_date'] },
  { table: 'spin_records', columns: ['business_date'] },
  { table: 'award_override_rules', columns: ['business_date'] },
  { table: 'award_override_rules', columns: ['status'] }
];

const OPTIONAL_INDEXES = [
  { table: 'players', columns: ['created_at'] }
];

async function main() {
  const columnsByTable = await loadColumnsByTable();
  const indexInfo = await loadIndexesByTable();
  const allIndexesByTable = indexInfo.allIndexesByTable;
  const uniqueIndexesByTable = indexInfo.uniqueIndexesByTable;
  const errors = [];
  const warnings = [];

  Object.keys(REQUIRED_COLUMNS).forEach(function (tableName) {
    if (!columnsByTable[tableName]) {
      errors.push('Missing table: ' + tableName);
      return;
    }

    Object.keys(REQUIRED_COLUMNS[tableName]).forEach(function (columnName) {
      const column = columnsByTable[tableName][columnName];
      const expected = REQUIRED_COLUMNS[tableName][columnName];

      if (!column) {
        errors.push('Missing column: ' + tableName + '.' + columnName);
        return;
      }

      validateColumn(errors, tableName, columnName, column, expected);
    });
  });

  REQUIRED_UNIQUE_INDEXES.forEach(function (index) {
    if (!hasUniqueIndex(uniqueIndexesByTable[index.table], index.columns)) {
      errors.push('Missing unique index on ' + index.table + '(' + index.columns.join(', ') + ')');
    }
  });

  REQUIRED_INDEXES.forEach(function (index) {
    if (!hasIndexPrefix(allIndexesByTable[index.table], index.columns)) {
      errors.push('Missing index on ' + index.table + '(' + index.columns.join(', ') + ')');
    }
  });

  OPTIONAL_INDEXES.forEach(function (index) {
    if (!hasIndexPrefix(allIndexesByTable[index.table], index.columns)) {
      warnings.push('Optional performance index is missing: ' + index.table + '(' + index.columns.join(', ') + ')');
    }
  });

  Object.keys(OPTIONAL_COLUMNS).forEach(function (tableName) {
    if (!columnsByTable[tableName]) {
      warnings.push('Optional legacy table is missing: ' + tableName);
      return;
    }

    Object.keys(OPTIONAL_COLUMNS[tableName]).forEach(function (columnName) {
      const column = columnsByTable[tableName][columnName];
      const expected = OPTIONAL_COLUMNS[tableName][columnName];

      if (!column) {
        warnings.push('Optional legacy column is missing: ' + tableName + '.' + columnName);
        return;
      }

      validateColumn(warnings, tableName, columnName, column, expected);
    });
  });

  if (errors.length) {
    console.error('DB schema check failed for database `' + config.db.database + '`');
    errors.forEach(function (error) {
      console.error('- ' + error);
    });
    process.exitCode = 1;
    return;
  }

  console.log('DB schema check passed for database `' + config.db.database + '`');
  warnings.forEach(function (warning) {
    console.warn('warning: ' + warning);
  });
}

/**
 * @returns {Promise<Object<string, Object<string, { columnType: string, isNullable: boolean }>>>}
 */
async function loadColumnsByTable() {
  const rows = await db.query(
    [
      'SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable',
      'FROM INFORMATION_SCHEMA.COLUMNS',
      'WHERE TABLE_SCHEMA = ?'
    ].join(' '),
    [config.db.database]
  );
  const tables = {};

  rows.forEach(function (row) {
    if (!tables[row.tableName]) {
      tables[row.tableName] = {};
    }

    tables[row.tableName][row.columnName] = {
      columnType: row.columnType,
      isNullable: row.isNullable === 'YES'
    };
  });

  return tables;
}

/**
 * @returns {Promise<{ allIndexesByTable: Object<string, Array<string[]>>, uniqueIndexesByTable: Object<string, Array<string[]>> }>}
 */
async function loadIndexesByTable() {
  const rows = await db.query(
    [
      'SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName, NON_UNIQUE AS nonUnique, COLUMN_NAME AS columnName, SEQ_IN_INDEX AS seqInIndex',
      'FROM INFORMATION_SCHEMA.STATISTICS',
      'WHERE TABLE_SCHEMA = ?',
      'ORDER BY TABLE_NAME ASC, INDEX_NAME ASC, SEQ_IN_INDEX ASC'
    ].join(' '),
    [config.db.database]
  );
  const allIndexesByTable = {};
  const uniqueIndexesByTable = {};
  const currentIndexes = {};

  rows.forEach(function (row) {
    const key = row.tableName + ':' + row.indexName;

    if (!currentIndexes[key]) {
      currentIndexes[key] = {
        tableName: row.tableName,
        columns: []
      };
    }

    currentIndexes[key].columns.push(row.columnName);
    currentIndexes[key].isUnique = row.nonUnique === 0;
  });

  Object.keys(currentIndexes).forEach(function (key) {
    const index = currentIndexes[key];

    if (!allIndexesByTable[index.tableName]) {
      allIndexesByTable[index.tableName] = [];
    }

    allIndexesByTable[index.tableName].push(index.columns);

    if (!index.isUnique) {
      return;
    }

    if (!uniqueIndexesByTable[index.tableName]) {
      uniqueIndexesByTable[index.tableName] = [];
    }

    uniqueIndexesByTable[index.tableName].push(index.columns);
  });

  return {
    allIndexesByTable: allIndexesByTable,
    uniqueIndexesByTable: uniqueIndexesByTable
  };
}

/**
 * @param {string[]} messages
 * @param {string} tableName
 * @param {string} columnName
 * @param {{ columnType: string, isNullable: boolean }} column
 * @param {{ type: string|RegExp, nullable: boolean }} expected
 * @returns {void}
 */
function validateColumn(messages, tableName, columnName, column, expected) {
  if (!matchesType(column.columnType, expected.type)) {
    messages.push(
      'Column type mismatch: ' + tableName + '.' + columnName + ' is ' + column.columnType + ', expected ' + expected.type
    );
  }

  if (column.isNullable !== expected.nullable) {
    messages.push(
      'Column nullable mismatch: ' + tableName + '.' + columnName + ' is ' + (column.isNullable ? 'nullable' : 'not nullable')
    );
  }
}

/**
 * @param {string} actual
 * @param {string|RegExp} expected
 * @returns {boolean}
 */
function matchesType(actual, expected) {
  if (expected instanceof RegExp) {
    return expected.test(actual);
  }

  return actual === expected;
}

/**
 * @param {Array<string[]>|undefined} existingIndexes
 * @param {string[]} requiredColumns
 * @returns {boolean}
 */
function hasUniqueIndex(existingIndexes, requiredColumns) {
  return hasIndex(existingIndexes, requiredColumns, true);
}

/**
 * @param {Array<string[]>|undefined} existingIndexes
 * @param {string[]} requiredColumns
 * @returns {boolean}
 */
function hasIndexPrefix(existingIndexes, requiredColumns) {
  return hasIndex(existingIndexes, requiredColumns, false);
}

/**
 * @param {Array<string[]>|undefined} existingIndexes
 * @param {string[]} requiredColumns
 * @param {boolean} exact
 * @returns {boolean}
 */
function hasIndex(existingIndexes, requiredColumns, exact) {
  if (!existingIndexes) {
    return false;
  }

  for (let index = 0; index < existingIndexes.length; index += 1) {
    if (sameColumns(existingIndexes[index], requiredColumns, exact)) {
      return true;
    }
  }

  return false;
}

/**
 * @param {string[]} left
 * @param {string[]} right
 * @param {boolean} exact
 * @returns {boolean}
 */
function sameColumns(left, right, exact) {
  if (exact && left.length !== right.length) {
    return false;
  }

  if (left.length < right.length) {
    return false;
  }

  for (let index = 0; index < right.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

main()
  .catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  })
  .then(function () {
    return db.close();
  })
  .catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
