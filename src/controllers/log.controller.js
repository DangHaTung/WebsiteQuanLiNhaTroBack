import Log from '../models/log.model.js';
import User from '../models/user.model.js';

// Tạo log mới
export const createLog = async (req, res) => {
  try {
    const logData = {
      ...req.body,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID,
    };

    const log = new Log(logData);
    await log.save();

    res.status(201).json({
      message: 'Log được tạo thành công',
      data: log,
    });
  } catch (error) {
    res.status(400).json({ 
      message: 'Lỗi khi tạo log',
      error: error.message 
    });
  }
};

// Lấy danh sách logs với phân trang và filter
export const getLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      level, 
      entity, 
      actorId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Xây dựng filter
    const filter = {};
    if (level) filter.level = level;
    if (entity) filter['context.entity'] = entity;
    if (actorId) filter['context.actorId'] = actorId;
    
    // Filter theo ngày
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Xây dựng sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Tính toán pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Thực hiện query
    const logs = await Log.find(filter)
      .populate('context.actorId', 'fullName email role')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Đếm tổng số records
    const total = await Log.countDocuments(filter);

    res.json({
      message: 'Lấy danh sách logs thành công',
      data: logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi khi lấy danh sách logs',
      error: error.message 
    });
  }
};

// Lấy log theo ID
export const getLogById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const log = await Log.findById(id)
      .populate('context.actorId', 'fullName email role');
    
    if (!log) {
      return res.status(404).json({ 
        message: 'Không tìm thấy log' 
      });
    }

    res.json({
      message: 'Lấy log thành công',
      data: log,
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi khi lấy log',
      error: error.message 
    });
  }
};

// Cập nhật log
export const updateLog = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const log = await Log.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    ).populate('context.actorId', 'fullName email role');

    if (!log) {
      return res.status(404).json({ 
        message: 'Không tìm thấy log để cập nhật' 
      });
    }

    res.json({
      message: 'Cập nhật log thành công',
      data: log,
    });
  } catch (error) {
    res.status(400).json({ 
      message: 'Lỗi khi cập nhật log',
      error: error.message 
    });
  }
};

// Xóa log
export const deleteLog = async (req, res) => {
  try {
    const { id } = req.params;
    
    const log = await Log.findByIdAndDelete(id);
    
    if (!log) {
      return res.status(404).json({ 
        message: 'Không tìm thấy log để xóa' 
      });
    }

    res.json({
      message: 'Xóa log thành công',
      data: log,
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi khi xóa log',
      error: error.message 
    });
  }
};

// Thống kê logs
export const getLogStats = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'level' } = req.query;

    // Xây dựng match condition
    const matchCondition = {};
    if (startDate || endDate) {
      matchCondition.createdAt = {};
      if (startDate) matchCondition.createdAt.$gte = new Date(startDate);
      if (endDate) matchCondition.createdAt.$lte = new Date(endDate);
    }

    let pipeline = [
      { $match: matchCondition }
    ];

    // Group theo level hoặc entity
    if (groupBy === 'level') {
      pipeline.push({
        $group: {
          _id: '$level',
          count: { $sum: 1 },
          latestLog: { $max: '$createdAt' }
        }
      });
    } else if (groupBy === 'entity') {
      pipeline.push({
        $group: {
          _id: '$context.entity',
          count: { $sum: 1 },
          latestLog: { $max: '$createdAt' }
        }
      });
    } else if (groupBy === 'actor') {
      pipeline.push({
        $group: {
          _id: '$context.actorId',
          count: { $sum: 1 },
          latestLog: { $max: '$createdAt' }
        }
      });
      pipeline.push({
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'actor'
        }
      });
      pipeline.push({
        $unwind: { path: '$actor', preserveNullAndEmptyArrays: true }
      });
    }

    pipeline.push({ $sort: { count: -1 } });

    const stats = await Log.aggregate(pipeline);

    // Thống kê tổng quan
    const totalLogs = await Log.countDocuments(matchCondition);
    const errorLogs = await Log.countDocuments({ ...matchCondition, level: 'ERROR' });
    const warningLogs = await Log.countDocuments({ ...matchCondition, level: 'WARN' });
    const infoLogs = await Log.countDocuments({ ...matchCondition, level: 'INFO' });

    res.json({
      message: 'Lấy thống kê logs thành công',
      data: {
        summary: {
          total: totalLogs,
          errors: errorLogs,
          warnings: warningLogs,
          info: infoLogs,
        },
        details: stats,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi khi lấy thống kê logs',
      error: error.message 
    });
  }
};

// Lấy logs theo entity cụ thể
export const getLogsByEntity = async (req, res) => {
  try {
    const { entity, entityId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const filter = {
      'context.entity': entity,
      'context.entityId': entityId,
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await Log.find(filter)
      .populate('context.actorId', 'fullName email role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Log.countDocuments(filter);

    res.json({
      message: `Lấy logs của ${entity} thành công`,
      data: logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi khi lấy logs theo entity',
      error: error.message 
    });
  }
};

// Xóa logs cũ (cleanup)
export const cleanupOldLogs = async (req, res) => {
  try {
    const { days = 30, level } = req.query;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const filter = {
      createdAt: { $lt: cutoffDate }
    };
    
    if (level) {
      filter.level = level;
    }

    const result = await Log.deleteMany(filter);

    res.json({
      message: `Xóa thành công ${result.deletedCount} logs cũ hơn ${days} ngày`,
      data: {
        deletedCount: result.deletedCount,
        cutoffDate,
        filter,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Lỗi khi xóa logs cũ',
      error: error.message 
    });
  }
};
