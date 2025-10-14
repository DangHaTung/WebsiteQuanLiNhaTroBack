// src/routers/room.route.js
import express from "express";
import {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
} from "../controllers/room.controller.js";
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/security.middleware.js";
import { 
  createRoomSchema, 
  updateRoomSchema, 
  roomQuerySchema,
  validate 
} from "../validations/index.js";

const router = express.Router();

// Public routes (không cần authentication)
router.get("/rooms", validate(roomQuerySchema, "query"), getAllRooms);
router.get("/rooms/:id", validateObjectId("id"), getRoomById);

// Protected routes (cần authentication)
router.post("/rooms", verifyToken, requireRole("ADMIN", "LANDLORD"), validate(createRoomSchema), createRoom);
router.put("/rooms/:id", verifyToken, requireRole("ADMIN", "LANDLORD"), validateObjectId("id"), validate(updateRoomSchema), updateRoom);
router.delete("/rooms/:id", verifyToken, requireRole("ADMIN"), validateObjectId("id"), deleteRoom);

export default router;
