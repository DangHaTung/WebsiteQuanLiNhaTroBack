import express from "express";
import {
    getAllRooms,
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom,
} from "../controllers/room.controller.js";
import { 
  createRoomSchema, 
  updateRoomSchema, 
  roomParamsSchema,
  roomQuerySchema 
} from "../validations/room.validation.js";
import { 
  validateBody, 
  validateParams, 
  validateQuery 
} from "../middleware/validation.middleware.js";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// Tất cả route đều cần xác thực
router.use(authenticateToken);

// Chỉ ADMIN và STAFF mới có thể quản lý rooms
router.use(authorize('ADMIN', 'STAFF'));

router.get("/rooms", validateQuery(roomQuerySchema), asyncHandler(getAllRooms));
router.get("/rooms/:id", validateParams(roomParamsSchema), asyncHandler(getRoomById));
router.post("/rooms", validateBody(createRoomSchema), asyncHandler(createRoom));
router.put("/rooms/:id", validateParams(roomParamsSchema), validateBody(updateRoomSchema), asyncHandler(updateRoom));
router.delete("/rooms/:id", validateParams(roomParamsSchema), asyncHandler(deleteRoom));

export default router;
