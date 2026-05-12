'use strict';

const ids = require('../utils/ids');
const time = require('../utils/time');

/**
 * Raw SQL repository for `award_override_rules`.
 */
class AwardOverridesRepository {
  /**
   * @param {import('../db').DatabaseConnection} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * @param {{ businessDate: string, status?: string, playerId?: string }} filters
   * @returns {Promise<Object[]>}
   */
  async list(filters) {
    const where = ['r.business_date = ?'];
    const params = [filters.businessDate];

    if (filters.status) {
      where.push('r.status = ?');
      params.push(filters.status);
    }

    if (filters.playerId) {
      where.push('r.player_id = ?');
      params.push(filters.playerId);
    }

    const rows = await this.db.query(this.selectSql() + ' WHERE ' + where.join(' AND ') + ' ORDER BY r.created_at DESC, r.stage_number ASC', params);
    return rows.map(this.mapRow);
  }

  /**
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
      this.selectSql() + ' WHERE r.pending_key IN (' + placeholders + ') ORDER BY r.stage_number ASC',
      pendingKeys
    );

    return rows.map(this.mapRow);
  }

  /**
   * @param {string} id
   * @param {string} businessDate
   * @returns {Promise<Object|null>}
   */
  async findPendingById(id, businessDate) {
    const row = await this.db.maybeOne(
      this.selectSql() + ' WHERE r.id = ? AND r.business_date = ? AND r.status = ? LIMIT 1',
      [id, businessDate, 'pending']
    );

    return this.mapRow(row);
  }

  /**
   * @param {string} playerId
   * @param {string} businessDate
   * @param {number} stageNumber
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Object|null>}
   */
  async findPendingForSpin(playerId, businessDate, stageNumber, tx) {
    const row = await this.getDb(tx).maybeOne(
      this.selectSql() + ' WHERE r.player_id = ? AND r.business_date = ? AND r.stage_number = ? AND r.status = ? LIMIT 1',
      [playerId, businessDate, stageNumber, 'pending']
    );

    return this.mapRow(row);
  }

  /**
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
        player: rule.player
      };
    });

    for (let index = 0; index < created.length; index += 1) {
      const rule = created[index];
      await this.getDb(tx).execute(
        [
          'INSERT INTO award_override_rules',
          '(id, player_id, business_date, stage_number, status, pending_key, reason, created_by_admin_id, cancelled_by_admin_id, consumed_spin_record_id, created_at, updated_at, consumed_at, cancelled_at)',
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
   * @param {Object} rule
   * @param {string|undefined} adminId
   * @returns {Promise<Object>}
   */
  async cancel(rule, adminId) {
    const now = time.unixTimestampSeconds();
    await this.db.execute(
      [
        'UPDATE award_override_rules',
        'SET status = ?, pending_key = NULL, cancelled_by_admin_id = ?, cancelled_at = ?, updated_at = ?',
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
   * @param {Object} rule
   * @param {string} spinRecordId
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Object>}
   */
  async consume(rule, spinRecordId, tx) {
    const now = time.unixTimestampSeconds();
    await this.getDb(tx).execute(
      [
        'UPDATE award_override_rules',
        'SET status = ?, pending_key = NULL, consumed_spin_record_id = ?, consumed_at = ?, updated_at = ?',
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
   * @returns {string}
   */
  selectSql() {
    return [
      'SELECT',
      'r.id, r.player_id, r.business_date, r.stage_number, r.status, r.pending_key, r.reason,',
      'r.created_by_admin_id, r.cancelled_by_admin_id, r.consumed_spin_record_id,',
      'r.created_at, r.updated_at, r.consumed_at, r.cancelled_at,',
      'p.external_id, p.created_at AS player_created_at, p.updated_at AS player_updated_at,',
      's.business_date AS spin_business_date, s.stage_number AS spin_stage_number,',
      's.prize_name AS spin_prize_name, s.amount_points AS spin_amount_points, s.created_at AS spin_created_at',
      'FROM award_override_rules r',
      'INNER JOIN players p ON p.id = r.player_id',
      'LEFT JOIN spin_records s ON s.id = r.consumed_spin_record_id'
    ].join(' ');
  }

  /**
   * @param {Object|null} row
   * @returns {Object|null}
   */
  mapRow(row) {
    if (!row) {
      return null;
    }

    const rule = {
      id: row.id,
      playerId: row.player_id,
      businessDate: row.business_date,
      stageNumber: row.stage_number,
      status: row.status,
      pendingKey: row.pending_key,
      reason: row.reason,
      createdByAdminId: row.created_by_admin_id,
      cancelledByAdminId: row.cancelled_by_admin_id,
      consumedSpinRecordId: row.consumed_spin_record_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      consumedAt: row.consumed_at,
      cancelledAt: row.cancelled_at,
      player: {
        id: row.player_id,
        externalId: row.external_id,
        createdAt: row.player_created_at,
        updatedAt: row.player_updated_at
      },
      consumedSpinRecord: null
    };

    if (row.consumed_spin_record_id) {
      rule.consumedSpinRecord = {
        id: row.consumed_spin_record_id,
        playerId: row.player_id,
        businessDate: row.spin_business_date,
        stageNumber: row.spin_stage_number,
        prizeName: row.spin_prize_name,
        amountPoints: row.spin_amount_points,
        createdAt: row.spin_created_at
      };
    }

    return rule;
  }

  /**
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {import('../db').DatabaseConnection}
   */
  getDb(tx) {
    return tx || this.db;
  }
}

module.exports = AwardOverridesRepository;
