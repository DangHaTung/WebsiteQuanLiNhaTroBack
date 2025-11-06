import Util from "../models/util.model.js";
import mongoose from "mongoose";

/**
 * Format utility object cho frontend
 */
const formatUtil = (util) => {
    const obj = util.toObject();
    return {
        _id: obj._id,
        name: obj.name,
        condition: obj.condition,
        description: obj.description,
        brand: obj.brand,
        model: obj.model,
        purchaseDate: obj.purchaseDate,
        warrantyExpiryDate: obj.warrantyExpiryDate,
        lastMaintenanceDate: obj.lastMaintenanceDate,
        notes: obj.notes,
        isActive: obj.isActive,
        room: obj.room,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
    };
};

/**
 * Lấy tất cả utilities (có thể filter theo name, condition, room)
 */
export const getAllUtils = async (req, res) => {
    try {
        const { name, condition, room, isActive, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        
        const filter = {};
        if (name) filter.name = name;
        if (condition) filter.condition = condition;
        if (room) filter.room = room;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const utils = await Util.find(filter)
            .populate('room', 'roomNumber type status')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        const total = await Util.countDocuments(filter);

        const utilsData = utils.map(formatUtil);

        res.status(200).json({
            message: "Lấy danh sách utilities thành công",
            success: true,
            data: utilsData,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                limit: parseInt(limit),
            },
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi lấy danh sách utilities",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Lấy utility theo id
 */
export const getUtilById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ 
                message: "ID utility không hợp lệ",
                success: false 
            });

        const util = await Util.findById(id).populate('room', 'roomNumber type status');
        if (!util) return res.status(404).json({ 
            message: "Không tìm thấy utility",
            success: false 
        });

        res.status(200).json({
            message: "Lấy thông tin utility thành công",
            success: true,
            data: formatUtil(util),
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi lấy thông tin utility",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Tạo utility mới
 */
export const createUtil = async (req, res) => {
    try {
        const {
            name,
            condition,
            description,
            brand,
            model,
            purchaseDate,
            warrantyExpiryDate,
            lastMaintenanceDate,
            notes,
            room,
        } = req.body;

        // Validate room ID if provided
        if (room && !mongoose.isValidObjectId(room)) {
            return res.status(400).json({ 
                message: "Room ID không hợp lệ",
                success: false 
            });
        }

        const util = new Util({
            name,
            condition,
            description,
            brand,
            model,
            purchaseDate,
            warrantyExpiryDate,
            lastMaintenanceDate,
            notes,
            room,
        });

        const saved = await util.save();
        const populated = await saved.populate('room', 'roomNumber type status');

        res.status(201).json({
            message: "Tạo utility thành công",
            success: true,
            data: formatUtil(populated),
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi tạo utility",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Cập nhật utility
 */
export const updateUtil = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ 
                message: "ID utility không hợp lệ",
                success: false 
            });

        const updateData = { ...req.body };
        
        // Validate room ID if provided
        if (updateData.room && !mongoose.isValidObjectId(updateData.room)) {
            return res.status(400).json({ 
                message: "Room ID không hợp lệ",
                success: false 
            });
        }

        const util = await Util.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('room', 'roomNumber type status');

        if (!util) return res.status(404).json({ 
            message: "Không tìm thấy utility",
            success: false 
        });

        res.status(200).json({
            message: "Cập nhật utility thành công",
            success: true,
            data: formatUtil(util),
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi cập nhật utility",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Xóa utility (soft delete)
 */
export const deleteUtil = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ 
                message: "ID utility không hợp lệ",
                success: false 
            });

        const util = await Util.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!util) return res.status(404).json({ 
            message: "Không tìm thấy utility",
            success: false 
        });

        res.status(200).json({
            message: "Xóa utility thành công",
            success: true,
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi xóa utility",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Lấy utilities theo room
 */
export const getUtilsByRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        if (!mongoose.isValidObjectId(roomId))
            return res.status(400).json({ 
                message: "Room ID không hợp lệ",
                success: false 
            });

        const utils = await Util.find({ room: roomId, isActive: true })
            .populate('room', 'roomNumber type status')
            .sort({ createdAt: -1 });

        const utilsData = utils.map(formatUtil);

        res.status(200).json({
            message: "Lấy utilities theo room thành công",
            success: true,
            data: utilsData,
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi lấy utilities theo room",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Lấy utilities bị hỏng
 */
export const getBrokenUtils = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const utils = await Util.find({ condition: 'broken', isActive: true })
            .populate('room', 'roomNumber type status')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        const total = await Util.countDocuments({ condition: 'broken', isActive: true });

        const utilsData = utils.map(formatUtil);

        res.status(200).json({
            message: "Lấy danh sách utilities bị hỏng thành công",
            success: true,
            data: utilsData,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                limit: parseInt(limit),
            },
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi lấy danh sách utilities bị hỏng",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Cập nhật condition của utility
 */
export const updateUtilCondition = async (req, res) => {
    try {
        const { id } = req.params;
        const { condition, notes } = req.body;

        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ 
                message: "ID utility không hợp lệ",
                success: false 
            });

        if (!UTILITY_CONDITIONS.includes(condition)) {
            return res.status(400).json({ 
                message: "Condition không hợp lệ",
                success: false 
            });
        }

        const util = await Util.findById(id);
        if (!util) return res.status(404).json({ 
            message: "Không tìm thấy utility",
            success: false 
        });

        await util.updateCondition(condition, notes);
        const populated = await util.populate('room', 'roomNumber type status');

        res.status(200).json({
            message: "Cập nhật condition thành công",
            success: true,
            data: formatUtil(populated),
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi cập nhật condition",
            success: false,
            error: err.message 
        });
    }
};