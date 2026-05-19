'use strict';

const ids = require('../utils/ids');
const time = require('../utils/time');

/**
 * `awardOverrideRules` 的 raw SQL repository。
 */
class AwardOverridesRepository {
  /**
   * 初始化 repository，保存 DB 連線。
   *
   * @param {import('../db').DatabaseConnection} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * 從資料庫列出符合篩選條件的資料。
   *
   * @param {{ businessDate: string, status?: string, playerId?: string }} filters
   * @returns {Promise<Object[]>}
   */
  async list(filters) {
    const where = ['r.businessDate = ?'];
    const params = [filters.businessDate];

    if (filters.status) {
      where.push('r.status = ?');
      params.push(filters.status);
    }

    if (filters.playerId) {
      where.push('r.playerId = ?');
      params.push(filters.playerId);
    }

    const rows = await this.db.query(this.selectSql() + ' WHERE ' + where.join(' AND ') + ' ORDER BY r.createdAt DESC, r.stageNumber ASC', params);
    return rows.map(this.mapRow);
  }

  /**
   * 從資料庫查詢符合條件的資料。
   *
   * @param {string[]} pendingKeys
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Object[]>}
   */
  async findByPendingKeys(pendingKeys, tx) {
    if (!pendingKeys.length) {
      return [];
    }

    const placeholders = pendingKeys.map(function () {
      return '?';
    }).join(', ');
    const rows = await this.getDb(tx).query(
      this.selectSql() + ' WHERE r.pendingKey IN (' + placeholders + ') ORDER BY r.stageNumber ASC',
      pendingKeys
    );

    return rows.map(this.mapRow);
  }

  /**
   * 從資料庫查詢符合條件的資料。
   *
   * @param {string} id
   * @param {string} businessDate
   * @returns {Promise<Object|null>}
   */
  async findPendingById(id, businessDate) {
    const row = await this.db.maybeOne(
      this.selectSql() + ' WHERE r.id = ? AND r.businessDate = ? AND r.status = ? LIMIT 1',
      [id, businessDate, 'pending']
    );

    return this.mapRow(row);
  }

  /**
   * 從資料庫查詢符合條件的資料。
   *
   * @param {string} playerId
   * @param {string} businessDate
   * @param {number} stageNumber
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Object|null>}
   */
  async findPendingForSpin(playerId, businessDate, stageNumber, tx) {
    const row = await this.getDb(tx).maybeOne(
      this.selectSql() + ' WHERE r.playerId = ? AND r.businessDate = ? AND r.stageNumber = ? AND r.status = ? LIMIT 1',
      [playerId, businessDate, stageNumber, 'pending']
    );

    return this.mapRow(row);
  }

  /**
   * 寫入資料庫並回傳建立後的資料物件。
   *
   * @param {Object[]} rules
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Object[]>}
   */
  async createMany(rules, tx) {
    const now = time.unixTimestampSeconds();
    const created = rules.map(function (rule) {
      return {
        id: ids.pseudoUuid(),
        playerId: rule.playerId,
        businessDate: rule.businessDate,
        stageNumber: rule.stageNumber,
        status: 'pending',
        pendingKey: rule.pendingKey,
        reason: rule.reason || null,
        createdByAdminId: rule.createdByAdminId || null,
        cancelledByAdminId: null,
        consumedSpinRecordId: null,
        createdAt: now,
        updatedAt: now,
        consumedAt: null,
        cancelledAt: null,
        player: {
          id: rule.playerId
        }
      };
    });

    for (let index = 0; index < created.length; index += 1) {
      const rule = created[index];
      await this.getDb(tx).execute(
        [
          'INSERT INTO awardOverrideRules',
          '(id, playerId, businessDate, stageNumber, status, pendingKey, reason, createdByAdminId, cancelledByAdminId, consumedSpinRecordId, createdAt, updatedAt, consumedAt, cancelledAt)',
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ].join(' '),
        [
          rule.id,
          rule.playerId,
          rule.businessDate,
          rule.stageNumber,
          rule.status,
          rule.pendingKey,
          rule.reason,
          rule.createdByAdminId,
          rule.cancelledByAdminId,
          rule.consumedSpinRecordId,
          rule.createdAt,
          rule.updatedAt,
          rule.consumedAt,
          rule.cancelledAt
        ]
      );
    }

    return created;
  }

  /**
   * 把指定派獎規則更新為 cancelled 狀態。
   *
   * @param {Object} rule
   * @param {string|undefined} adminId
   * @returns {Promise<Object>}
   */
  async cancel(rule, adminId) {
    const now = time.unixTimestampSeconds();
    await this.db.execute(
      [
        'UPDATE awardOverrideRules',
        'SET status = ?, pendingKey = NULL, cancelledByAdminId = ?, cancelledAt = ?, updatedAt = ?',
        'WHERE id = ?'
      ].join(' '),
      ['cancelled', adminId || null, now, now, rule.id]
    );

    rule.status = 'cancelled';
    rule.pendingKey = null;
    rule.cancelledByAdminId = adminId || null;
    rule.cancelledAt = now;
    rule.updatedAt = now;
    return rule;
  }

  /**
   * 把指定派獎規則標記為已被抽獎紀錄消耗。
   *
   * @param {Object} rule
   * @param {string} spinRecordId
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Object>}
   */
  async consume(rule, spinRecordId, tx) {
    const now = time.unixTimestampSeconds();
    await this.getDb(tx).execute(
      [
        'UPDATE awardOverrideRules',
        'SET status = ?, pendingKey = NULL, consumedSpinRecordId = ?, consumedAt = ?, updatedAt = ?',
        'WHERE id = ?'
      ].join(' '),
      ['consumed', spinRecordId, now, now, rule.id]
    );

    rule.status = 'consumed';
    rule.pendingKey = null;
    rule.consumedSpinRecordId = spinRecordId;
    rule.consumedAt = now;
    rule.updatedAt = now;
    return rule;
  }

  /**
   * 組合指定派獎查詢共用的 SELECT 與 JOIN SQL。
   *
   * @returns {string}
   */
  selectSql() {
    return [
      'SELECT',
      'r.id, r.playerId, r.businessDate, r.stageNumber, r.status, r.pendingKey, r.reason,',
      'r.createdByAdminId, r.cancelledByAdminId, r.consumedSpinRecordId,',
      'r.createdAt, r.updatedAt, r.consumedAt, r.cancelledAt,',
      's.businessDate AS spinBusinessDate, s.stageNumber AS spinStageNumber,',
      's.prizeName AS spinPrizeName, s.amountPoints AS spinAmountPoints, s.createdAt AS spinCreatedAt',
      'FROM awardOverrideRules r',
      'LEFT JOIN spinRecords s ON s.id = r.consumedSpinRecordId'
    ].join(' ');
  }

  /**
   * 將資料庫 row 轉成程式內使用的 camelCase 物件。
   *
   * @param {Object|null} row
   * @returns {Object|null}
   */
  mapRow(row) {
    if (!row) {
      return null;
    }

    const rule = {
      id: row.id,
      playerId: row.playerId,
      businessDate: row.businessDate,
      stageNumber: row.stageNumber,
      status: row.status,
      pendingKey: row.pendingKey,
      reason: row.reason,
      createdByAdminId: row.createdByAdminId,
      cancelledByAdminId: row.cancelledByAdminId,
      consumedSpinRecordId: row.consumedSpinRecordId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      consumedAt: row.consumedAt,
      cancelledAt: row.cancelledAt,
      player: {
        id: row.playerId
      },
      consumedSpinRecord: null
    };

    if (row.consumedSpinRecordId) {
      rule.consumedSpinRecord = {
        id: row.consumedSpinRecordId,
        playerId: row.playerId,
        businessDate: row.spinBusinessDate,
        stageNumber: row.spinStageNumber,
        prizeName: row.spinPrizeName,
        amountPoints: row.spinAmountPoints,
        createdAt: row.spinCreatedAt
      };
    }

    return rule;
  }

  /**
   * 依是否傳入 transaction connection 決定要用哪個 DB 連線。
   *
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {import('../db').DatabaseConnection}
   */
  getDb(tx) {
    return tx || this.db;
  }
}

module.exports = AwardOverridesRepository;
