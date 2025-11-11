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
  roomQuerySchema,
  roomImageParamsSchema,
  setCoverBodySchema,
} from "../validations/room.validation.js";
import { 
  validateBody, 
  validateParams, 
  validateQuery 
} from "../middleware/validation.middleware.js";
import { authenticateToken, authorize, optionalAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { uploadRoomImages } from "../middleware/upload.middleware.js";

const router = express.Router();

// ===== PROTECTED ROUTES - CẦN ADMIN/STAFF =====
// Public routes đã được tách ra file riêng: room.public.route.js
// KHÔNG DÙNG router.use() vì nó sẽ áp dụng cho TẤT CẢ route kể cả /rooms/public
// Thay vào đó, thêm middleware trực tiếp vào từng route
router.get("/rooms", authenticateToken, authorize('ADMIN'), validateQuery(roomQuerySchema), asyncHandler(getAllRooms));
router.get("/rooms/:id", authenticateToken, authorize('ADMIN'), validateParams(roomParamsSchema), asyncHandler(getRoomById));
router.post("/rooms", authenticateToken, authorize('ADMIN'), uploadRoomImages, validateBody(createRoomSchema), asyncHandler(createRoom));
router.put("/rooms/:id", authenticateToken, authorize('ADMIN'), validateParams(roomParamsSchema), uploadRoomImages, validateBody(updateRoomSchema), asyncHandler(updateRoom));
router.delete("/rooms/:id", authenticateToken, authorize('ADMIN'), validateParams(roomParamsSchema), asyncHandler(deleteRoom));

// Image management (cần admin/staff)
import { removeRoomImage, setRoomCoverImage } from "../controllers/room.controller.js";

router.delete(
  "/rooms/:id/images/:publicId",
  authenticateToken,
  authorize('ADMIN'),
  validateParams(roomImageParamsSchema),
  asyncHandler(removeRoomImage)
);

router.post(
  "/rooms/:id/cover",
  authenticateToken,
  authorize('ADMIN'),
  validateParams(roomParamsSchema),
  validateBody(setCoverBodySchema),
  asyncHandler(setRoomCoverImage)
);

export default router;
