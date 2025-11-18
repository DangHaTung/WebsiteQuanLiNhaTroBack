import express from "express";
import { getAllRooms, getRoomById } from "../controllers/room.controller.js";
import { validateParams, validateQuery } from "../middleware/validation.middleware.js";
import { roomParamsSchema, roomQuerySchema } from "../validations/room.validation.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// Public routes - không cần authentication
router.get("/rooms/public", validateQuery(roomQuerySchema), asyncHandler(getAllRooms));
router.get("/rooms/public/:id", validateParams(roomParamsSchema), asyncHandler(getRoomById));

export default router;
