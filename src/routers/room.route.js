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
// Lấy danh sách phòng (hỗ trợ filter, pagination)
// Chỉ ADMIN được phép
router.get("/rooms", authenticateToken, authorize('ADMIN'), validateQuery(roomQuerySchema), asyncHandler(getAllRooms));
// Lấy chi tiết 1 phòng theo ID
router.get("/rooms/:id", authenticateToken, authorize('ADMIN'), validateParams(roomParamsSchema), asyncHandler(getRoomById));
// Tạo phòng mới
// - Có upload ảnh (uploadRoomImages)
// - Validate body theo createRoomSchema
router.post("/rooms", authenticateToken, authorize('ADMIN'), uploadRoomImages, validateBody(createRoomSchema), asyncHandler(createRoom));
// Cập nhật thông tin phòng
// - Cho phép upload ảnh mới để thêm vào gallery
router.put("/rooms/:id", authenticateToken, authorize('ADMIN'), validateParams(roomParamsSchema), uploadRoomImages, validateBody(updateRoomSchema), asyncHandler(updateRoom));
// Xóa phòng theo ID
router.delete("/rooms/:id", authenticateToken, authorize('ADMIN'), validateParams(roomParamsSchema), asyncHandler(deleteRoom));

// Image management (cần admin/staff)
import { removeRoomImage, setRoomCoverImage } from "../controllers/room.controller.js";

// Xoá 1 ảnh theo publicId (Cloudinary)
// Route: DELETE /rooms/:id/images/:publicId
router.delete(
  "/rooms/:id/images/:publicId",
  authenticateToken,
  authorize('ADMIN'),
  validateParams(roomImageParamsSchema),
  asyncHandler(removeRoomImage)
);

// Đặt ảnh đại diện cho phòng
// Body phải chứa: { publicId: "..." }
router.post(
  "/rooms/:id/cover",
  authenticateToken,
  authorize('ADMIN'),
  validateParams(roomParamsSchema),
  validateBody(setCoverBodySchema),
  asyncHandler(setRoomCoverImage)
);

export default router;
