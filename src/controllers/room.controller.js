// src/controllers/room.controller.js
import Room from "../models/room.model.js";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

/**
 * Helper convert Decimal128 sang number
 */
const convertDecimal128 = (value) => {
    if (value === null || value === undefined) return null;
    return parseFloat(value.toString());
};

/**
 * Chuyển đổi room object cho frontend
 */
const formatRoom = (room) => ({
    ...room.toObject(),
    pricePerMonth: convertDecimal128(room.pricePerMonth),
});

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

        const roomsData = rooms.map(formatRoom);

        res.status(200).json({
            message: "Lấy danh sách phòng thành công",
            success: true,
            data: roomsData,
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
            data: formatRoom(room),
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
            return res.status(400).json({ 
                message: "Số phòng và giá thuê là bắt buộc",
                success: false 
            });
        }

        let uploadedImages = [];
        if (Array.isArray(req.files)) {
            uploadedImages = req.files.map((f) => ({ url: f.path, publicId: f.filename }));
        } else if (req.files && (req.files.images || req.files.image)) {
            const list = [
                ...(Array.isArray(req.files.images) ? req.files.images : []),
                ...(Array.isArray(req.files.image) ? req.files.image : []),
            ];
            uploadedImages = list.map((f) => ({ url: f.path, publicId: f.filename }));
        }

        let bodyImages = [];
        if (Array.isArray(req.body?.images)) {
            try {
                if (typeof req.body.images === "string") {
                    const parsed = JSON.parse(req.body.images);
                    if (Array.isArray(parsed)) req.body.images = parsed;
                }
            } catch {}
            bodyImages = (Array.isArray(req.body.images) ? req.body.images : [])
                .map((it) => (typeof it === "string" ? { url: it } : it))
                .filter((it) => it && it.url);
        } else if (typeof req.body?.images === "string") {
            try {
                const parsed = JSON.parse(req.body.images);
                if (Array.isArray(parsed)) {
                    bodyImages = parsed
                        .map((it) => (typeof it === "string" ? { url: it } : it))
                        .filter((it) => it && it.url);
                }
            } catch {}
        }

        const room = new Room({
            roomNumber,
            type,
            pricePerMonth,
            areaM2,
            floor,
            district,
            status,
            currentContractSummary,
            images: [...bodyImages, ...uploadedImages],
            coverImageUrl: (bodyImages?.[0]?.url) || (uploadedImages?.[0]?.url),
        });

        const saved = await room.save();

        res.status(201).json({
            message: "Tạo phòng thành công",
            success: true,
            data: formatRoom(saved),
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

        let uploadedImages = [];
        if (Array.isArray(req.files)) {
            uploadedImages = req.files.map((f) => ({ url: f.path, publicId: f.filename }));
        } else if (req.files && (req.files.images || req.files.image)) {
            const list = [
                ...(Array.isArray(req.files.images) ? req.files.images : []),
                ...(Array.isArray(req.files.image) ? req.files.image : []),
            ];
            uploadedImages = list.map((f) => ({ url: f.path, publicId: f.filename }));
        }

        let bodyImagesUpdate = [];
        if (Array.isArray(req.body?.images) || typeof req.body?.images === "string") {
            try {
                if (typeof req.body.images === "string") {
                    const parsed = JSON.parse(req.body.images);
                    if (Array.isArray(parsed)) req.body.images = parsed;
                }
            } catch {}
            bodyImagesUpdate = (Array.isArray(req.body.images) ? req.body.images : [])
                .map((it) => (typeof it === "string" ? { url: it } : it))
                .filter((it) => it && it.url);
        }

        if (uploadedImages.length > 0) {
            const existing = await Room.findById(id).select("images coverImageUrl");
            const mergedImages = [...(existing?.images || []), ...uploadedImages];
            update.images = mergedImages;
            if (!existing?.coverImageUrl) update.coverImageUrl = uploadedImages[0].url;
        }
        if (bodyImagesUpdate.length > 0) {
            const existing = await Room.findById(id).select("images coverImageUrl");
            const mergedImages = [...(existing?.images || []), ...bodyImagesUpdate];
            update.images = mergedImages;
            if (!existing?.coverImageUrl) update.coverImageUrl = bodyImagesUpdate[0].url;
        }

        const updated = await Room.findByIdAndUpdate(id, update, { new: true });
        if (!updated) return res.status(404).json({ 
            message: "Không tìm thấy phòng",
            success: false 
        });

        res.status(200).json({
            message: "Cập nhật phòng thành công",
            success: true,
            data: formatRoom(updated),
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
        const { id, publicId } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "ID phòng không hợp lệ", success: false });

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ message: "Không tìm thấy phòng", success: false });

        await cloudinary.uploader.destroy(publicId);

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
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "ID phòng không hợp lệ", success: false });

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ message: "Không tìm thấy phòng", success: false });

        const found = (room.images || []).find((img) => img.publicId === publicId);
        if (!found) return res.status(404).json({ message: "Không tìm thấy ảnh với publicId", success: false });

        room.coverImageUrl = found.url;
        await room.save();

        return res.json({ message: "Đã cập nhật ảnh đại diện", success: true, data: { coverImageUrl: room.coverImageUrl } });
    } catch (err) {
        return res.status(500).json({ message: "Lỗi khi cập nhật ảnh đại diện", success: false, error: err.message });
    }
};
