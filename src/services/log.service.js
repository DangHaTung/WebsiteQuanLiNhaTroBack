import Log from '../models/log.model.js';

/**
 * Log Service - Helper để ghi log dễ dàng từ bất kỳ đâu
 * 
 * Usage:
 * import logService from '../services/log.service.js';
 * 
 * await logService.info({
 *   entity: 'ROOM',
 *   entityId: room._id,
 *   actorId: req.user._id,
 *   message: 'Tạo phòng mới',
 *   diff: { roomNumber: room.roomNumber }
 * });
 */

class LogService {
  /**
   * Ghi log với level INFO
   */
  async info({ entity, entityId, actorId, message, diff = null }) {
    return this.createLog({
      level: 'INFO',
      entity,
      entityId,
      actorId,
      message,
      diff,
    });
  }

  /**
   * Ghi log với level WARN
   */
  async warn({ entity, entityId, actorId, message, diff = null }) {
    return this.createLog({
      level: 'WARN',
      entity,
      entityId,
      actorId,
      message,
      diff,
    });
  }

  /**
   * Ghi log với level ERROR
   */
  async error({ entity, entityId, actorId, message, diff = null, error = null }) {
    const errorDetails = error ? {
      errorMessage: error.message,
      errorStack: error.stack,
    } : null;

    return this.createLog({
      level: 'ERROR',
      entity,
      entityId,
      actorId,
      message,
      diff: diff || errorDetails,
    });
  }

  /**
   * Helper chung để tạo log
   */
  async createLog({ level, entity, entityId, actorId, message, diff }) {
    try {
      // Validate required fields
      if (!entity || !entityId || !message) {
        console.warn('⚠️ Log service: Missing required fields', { entity, entityId, message });
        return null;
      }

      // Map entity to model name for entityRef
      const entityRefMap = {
        'ROOM': 'Room',
        'CONTRACT': 'Contract',
        'BILL': 'Bill',
        'USER': 'User',
        'CHECKIN': 'Checkin',
        'FINALCONTRACT': 'FinalContract',
        'PAYMENT': 'Payment',
      };

      const entityRef = entityRefMap[entity] || entity;

      const log = await Log.create({
        level: level || 'INFO',
        message,
        context: {
          entity,
          entityId,
          actorId: actorId || null,
          diff: diff || null,
          entityRef,
        },
      });

      console.log(`📝 Log created: [${level}] ${entity} - ${message}`);
      return log;
    } catch (err) {
      // Không throw error để không block business logic
      console.error('❌ Log service error:', err.message);
      return null;
    }
  }

  /**
   * Log cho action CREATE
   */
  async logCreate({ entity, entityId, actorId, data }) {
    return this.info({
      entity,
      entityId,
      actorId,
      message: `Tạo ${this.getEntityName(entity)} mới`,
      diff: { action: 'CREATE', data },
    });
  }

  /**
   * Log cho action UPDATE
   */
  async logUpdate({ entity, entityId, actorId, before, after }) {
    return this.info({
      entity,
      entityId,
      actorId,
      message: `Cập nhật ${this.getEntityName(entity)}`,
      diff: { action: 'UPDATE', before, after },
    });
  }

  /**
   * Log cho action DELETE
   */
  async logDelete({ entity, entityId, actorId, data }) {
    return this.warn({
      entity,
      entityId,
      actorId,
      message: `Xóa ${this.getEntityName(entity)}`,
      diff: { action: 'DELETE', data },
    });
  }

  /**
   * Log cho action PAYMENT
   */
  async logPayment({ entity, entityId, actorId, amount, provider, status, billDetails = null }) {
    const diffData = { action: 'PAYMENT', amount, provider, status };
    
    // Thêm thông tin chi tiết nếu có
    if (billDetails) {
      Object.assign(diffData, billDetails);
    }
    
    return this.info({
      entity,
      entityId,
      actorId,
      message: `Thanh toán ${this.getEntityName(entity)} - ${provider}`,
      diff: diffData,
    });
  }

  /**
   * Helper: Lấy tên entity tiếng Việt
   */
  getEntityName(entity) {
    const names = {
      'ROOM': 'phòng',
      'CONTRACT': 'hợp đồng',
      'BILL': 'hóa đơn',
      'USER': 'người dùng',
      'CHECKIN': 'checkin',
      'FINALCONTRACT': 'hợp đồng chính thức',
      'PAYMENT': 'thanh toán',
    };
    return names[entity] || entity.toLowerCase();
  }
}

// Export singleton instance
export default new LogService();
