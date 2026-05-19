'use strict';

const config = require('../src/config');
const db = require('../src/db');

const REQUIRED_COLUMNS = {
  adminUsers: {
    id: { type: 'varchar(36)', nullable: false },
    username: { type: 'varchar(80)', nullable: false },
    passwordHash: { type: 'varchar(255)', nullable: false },
    isActive: { type: /^tinyint/, nullable: false },
    createdAt: { type: 'int unsigned', nullable: false },
    updatedAt: { type: 'int unsigned', nullable: false }
  },
  players: {
    id: { type: 'varchar(120)', nullable: false },
    createdAt: { type: 'int unsigned', nullable: false },
    updatedAt: { type: 'int unsigned', nullable: false }
  },
  playerDailyProgress: {
    id: { type: 'varchar(36)', nullable: false },
    playerId: { type: 'varchar(120)', nullable: false },
    businessDate: { type: 'varchar(10)', nullable: false },
    turnoverPoints: { type: 'int unsigned', nullable: false },
    unlockedStage: { type: 'tinyint unsigned', nullable: false }
  },
  spinRecords: {
    id: { type: 'varchar(36)', nullable: false },
    playerId: { type: 'varchar(120)', nullable: false },
    businessDate: { type: 'varchar(10)', nullable: false },
    stageNumber: { type: 'tinyint unsigned', nullable: false },
    prizeConfigId: { type: 'int', nullable: true },
    prizeName: { type: 'varchar(120)', nullable: false },
    amountPoints: { type: 'int unsigned', nullable: false },
    createdAt: { type: 'int unsigned', nullable: false },
    probabilityTable: { type: 'varchar(10)', nullable: false }
  },
  awardOverrideRules: {
    id: { type: 'varchar(36)', nullable: false },
    playerId: { type: 'varchar(120)', nullable: false },
    businessDate: { type: 'varchar(10)', nullable: false },
    stageNumber: { type: 'tinyint unsigned', nullable: false },
    status: { type: 'varchar(20)', nullable: false },
    pendingKey: { type: 'varchar(180)', nullable: true },
    reason: { type: 'varchar(255)', nullable: true },
    createdByAdminId: { type: 'varchar(36)', nullable: true },
    cancelledByAdminId: { type: 'varchar(36)', nullable: true },
    consumedSpinRecordId: { type: 'varchar(36)', nullable: true },
    createdAt: { type: 'int unsigned', nullable: false },
    updatedAt: { type: 'int unsigned', nullable: false },
    consumedAt: { type: 'int unsigned', nullable: true },
    cancelledAt: { type: 'int unsigned', nullable: true }
  },
  webviewSessions: {
    id: { type: 'varchar(36)', nullable: false },
    playerId: { type: 'varchar(120)', nullable: false },
    token: { type: 'varchar(128)', nullable: false },
    expiresAt: { type: 'int unsigned', nullable: false },
    createdAt: { type: 'int unsigned', nullable: false }
  }
};

const REQUIRED_UNIQUE_INDEXES = [
  { table: 'adminUsers', columns: ['username'] },
  { table: 'playerDailyProgress', columns: ['playerId', 'businessDate'] },
  { table: 'spinRecords', columns: ['playerId', 'businessDate', 'stageNumber'] },
  { table: 'awardOverrideRules', columns: ['pendingKey'] },
  { table: 'webviewSessions', columns: ['token'] }
];

const REQUIRED_INDEXES = [
  { table: 'playerDailyProgress', columns: ['businessDate'] },
  { table: 'spinRecords', columns: ['businessDate'] },
  { table: 'awardOverrideRules', columns: ['businessDate'] },
  { table: 'awardOverrideRules', columns: ['status'] }
];

const OPTIONAL_INDEXES = [
  { table: 'players', columns: ['createdAt'] }
];

const FORBIDDEN_COLUMNS = {
  players: ['external_id']
};

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

  Object.keys(FORBIDDEN_COLUMNS).forEach(function (tableName) {
    const tableColumns = columnsByTable[tableName];
    if (!tableColumns) {
      return;
    }

    FORBIDDEN_COLUMNS[tableName].forEach(function (columnName) {
      if (tableColumns[columnName]) {
        errors.push('Forbidden legacy column exists: ' + tableName + '.' + columnName);
      }
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
