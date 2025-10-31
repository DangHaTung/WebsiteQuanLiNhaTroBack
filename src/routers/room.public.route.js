import express from "express";
import { getAllRooms, getRoomById } from "../controllers/room.controller.js";
import { roomParamsSchema, roomQuerySchema } from "../validations/room.validation.js";
import { validateParams, validateQuery } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// PUBLIC ROUTES - KHÔNG CẦN AUTHENTICATION
router.get("/rooms/public", validateQuery(roomQuerySchema), asyncHandler(getAllRooms));
router.get("/rooms/public/:id", validateParams(roomParamsSchema), asyncHandler(getRoomById));

export default router;

