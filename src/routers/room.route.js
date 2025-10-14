// src/routers/room.route.js
import express from "express";
import {
    getAllRooms,
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom,
} from "../controllers/room.controller.js";

const router = express.Router();

router.get("/rooms", getAllRooms);
router.get("/rooms/:id", getRoomById);
router.post("/rooms", createRoom);
router.put("/rooms/:id", updateRoom);
router.delete("/rooms/:id", deleteRoom);

export default router;
