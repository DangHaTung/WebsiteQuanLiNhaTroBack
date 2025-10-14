// src/controllers/room.controller.js
import Room from "../models/room.model.js";
import mongoose from "mongoose";

/**
 * Lấy tất cả phòng (có thể filter theo status/type)
 */
export const getAllRooms = async (req, res) => {
    try {
        const { status, type, q } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (type) filter.type = type;
        if (q) filter.roomNumber = { $regex: q, $options: "i" };

        const rooms = await Room.find(filter).sort({ roomNumber: 1 });
        res.json({
            message: "Fetched all rooms successfully",
            total: rooms.length,
            data: rooms,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Lấy room theo id
 */
export const getRoomById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ error: "Invalid room id" });

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ error: "Room not found" });

        res.json({
            message: "Fetched room successfully",
            data: room,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
                .json({ error: "roomNumber and pricePerMonth are required" });
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
        });

        const saved = await room.save();
        res.status(201).json({
            message: "Room created successfully",
            data: saved,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Update room
 */
export const updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ error: "Invalid room id" });

        const update = req.body;
        delete update._id;

        const updated = await Room.findByIdAndUpdate(id, update, { new: true });
        if (!updated) return res.status(404).json({ error: "Room not found" });

        res.json({
            message: "Room updated successfully",
            data: updated,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Xoá room
 */
export const deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ error: "Invalid room id" });

        const removed = await Room.findByIdAndDelete(id);
        if (!removed) return res.status(404).json({ error: "Room not found" });

        res.json({
            message: "Room deleted successfully",
            id: removed._id,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
