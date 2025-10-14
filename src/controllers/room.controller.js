// src/controllers/room.controller.js
import Room from "../models/room.model.js";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

/**
 * Lấy tất cả phòng (có thể filter theo status/type)
 */
export const getAllRooms = async (req, res) => {
    try {
        const { status, type, q, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        
        const filter = {};
        if (status) filter.status = status;
        if (type) filter.type = type;
        if (q) filter.roomNumber = { $regex: q, $options: "i" };

        const rooms = await Room.find(filter)
            .sort({ roomNumber: 1 })
            .limit(limit)
            .skip(skip);

        const total = await Room.countDocuments(filter);

        res.status(200).json({
            message: "Lấy danh sách phòng thành công",
            success: true,
            data: rooms,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                limit: parseInt(limit),
            },
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi lấy danh sách phòng",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Lấy room theo id
 */
export const getRoomById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ 
                message: "ID phòng không hợp lệ",
                success: false 
            });

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ 
            message: "Không tìm thấy phòng",
            success: false 
        });

        res.status(200).json({
            message: "Lấy thông tin phòng thành công",
            success: true,
            data: room,
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi lấy thông tin phòng",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Tạo room mới
 */
export const createRoom = async (req, res) => {
    try {
        const {
            roomNumber,
            type,
            pricePerMonth,
            areaM2,
            floor,
            district,
            status,
            currentContractSummary,
        } = req.body;

        if (!roomNumber || !pricePerMonth) {
            return res
                .status(400)
                .json({ 
                    message: "Số phòng và giá thuê là bắt buộc",
                    success: false 
                });
        }

        // Map images from upload (multer-storage-cloudinary)
        const uploadedImages = Array.isArray(req.files)
            ? req.files.map((f) => ({ url: f.path, publicId: f.filename }))
            : [];

        const room = new Room({
            roomNumber,
            type,
            pricePerMonth,
            areaM2,
            floor,
            district,
            status,
            currentContractSummary,
            images: uploadedImages,
            coverImageUrl: uploadedImages?.[0]?.url,
        });

        const saved = await room.save();
        res.status(201).json({
            message: "Tạo phòng thành công",
            success: true,
            data: saved,
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi tạo phòng",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Update room
 */
export const updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ 
                message: "ID phòng không hợp lệ",
                success: false 
            });

        const update = { ...req.body };
        delete update._id;

        // Append new uploaded images if provided
        const uploadedImages = Array.isArray(req.files)
            ? req.files.map((f) => ({ url: f.path, publicId: f.filename }))
            : [];
        if (uploadedImages.length > 0) {
            // Push new images, keep existing ones
            const existing = await Room.findById(id).select("images coverImageUrl");
            const mergedImages = [...(existing?.images || []), ...uploadedImages];
            update.images = mergedImages;
            if (!existing?.coverImageUrl) {
                update.coverImageUrl = uploadedImages[0].url;
            }
        }

        const updated = await Room.findByIdAndUpdate(id, update, { new: true });
        if (!updated) return res.status(404).json({ 
            message: "Không tìm thấy phòng",
            success: false 
        });

        res.status(200).json({
            message: "Cập nhật phòng thành công",
            success: true,
            data: updated,
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi cập nhật phòng",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Xoá room
 */
export const deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ 
                message: "ID phòng không hợp lệ",
                success: false 
            });

        const removed = await Room.findByIdAndDelete(id);
        if (!removed) return res.status(404).json({ 
            message: "Không tìm thấy phòng",
            success: false 
        });

        res.status(200).json({
            message: "Xóa phòng thành công",
            success: true,
            data: { id: removed._id },
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi xóa phòng",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Xóa 1 ảnh của room theo publicId (Cloudinary + DB)
 */
export const removeRoomImage = async (req, res) => {
    try {
        const { id } = req.params;
        const { publicId } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "ID phòng không hợp lệ", success: false });
        }

        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({ message: "Không tìm thấy phòng", success: false });
        }

        // Gọi Cloudinary xoá ảnh
        await cloudinary.uploader.destroy(publicId);

        // Xoá trong DB
        const nextImages = (room.images || []).filter((img) => img.publicId !== publicId);
        let nextCover = room.coverImageUrl;
        if (room.coverImageUrl && (room.images || []).some((img) => img.publicId === publicId)) {
            nextCover = nextImages[0]?.url || null;
        }

        room.images = nextImages;
        room.coverImageUrl = nextCover || undefined;
        await room.save();

        return res.json({ message: "Đã xoá ảnh", success: true, data: { images: room.images, coverImageUrl: room.coverImageUrl } });
    } catch (err) {
        return res.status(500).json({ message: "Lỗi khi xoá ảnh", success: false, error: err.message });
    }
};

/**
 * Đặt ảnh đại diện theo publicId
 */
export const setRoomCoverImage = async (req, res) => {
    try {
        const { id } = req.params;
        const { publicId } = req.body;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "ID phòng không hợp lệ", success: false });
        }

        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({ message: "Không tìm thấy phòng", success: false });
        }

        const found = (room.images || []).find((img) => img.publicId === publicId);
        if (!found) {
            return res.status(404).json({ message: "Không tìm thấy ảnh với publicId", success: false });
        }

        room.coverImageUrl = found.url;
        await room.save();

        return res.json({ message: "Đã cập nhật ảnh đại diện", success: true, data: { coverImageUrl: room.coverImageUrl } });
    } catch (err) {
        return res.status(500).json({ message: "Lỗi khi cập nhật ảnh đại diện", success: false, error: err.message });
    }
};
