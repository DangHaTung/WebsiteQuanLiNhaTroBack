import express from "express";
import {
  createMoveOutRequest,
  getMyMoveOutRequests,
  getAllMoveOutRequests,
  updateMoveOutRequestStatus,
  completeMoveOutRequest,
} from "../controllers/moveOutRequest.controller.js";
import { uploadRefundQrCode } from "../middleware/upload.middleware.js";
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { validateBody, validateParams } from "../middleware/validation.middleware.js";
import {
  createMoveOutRequestSchema,
  updateMoveOutRequestStatusSchema,
  moveOutRequestParamsSchema,
} from "../validations/moveOutRequest.validation.js";

const router = express.Router();

console.log('[moveOutRequest.route.js] Route file loaded, registering POST /move-out-requests');

// Client routes
router.post(
  "/move-out-requests",
  (req, res, next) => {
    console.log('[moveOutRequest.route] POST /api/move-out-requests matched');
    console.log('[moveOutRequest.route] URL:', req.url);
    console.log('[moveOutRequest.route] Method:', req.method);
    console.log('[moveOutRequest.route] Content-Type:', req.headers['content-type']);
    console.log('[moveOutRequest.route] req.body before parse:', req.body);
    next();
  },
  authenticateToken,
  (req, res, next) => {
    console.log('[moveOutRequest.route] After authenticateToken');
    console.log('[moveOutRequest.route] req.body:', req.body);
    
    // Luôn dùng multer để xử lý file upload (giống FinalContract)
    // Multer sẽ tự động detect multipart/form-data
    uploadRefundQrCode(req, res, (err) => {
      if (err) {
        console.log('[moveOutRequest.route] Multer error:', err.message);
        // Nếu là lỗi "no file" hoặc "field missing", bỏ qua (file là optional)
        if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.message?.includes('Unexpected field') || err.message?.includes('No file') || err.message?.includes('Missing field')) {
          console.log('[moveOutRequest.route] No file provided, continuing without file');
          return next();
        }
        // Các lỗi khác (file size, file type) thì trả về
        return next(err);
      }
      console.log('[moveOutRequest.route] req.body after multer:', req.body);
      console.log('[moveOutRequest.route] req.file after multer:', req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        secure_url: req.file.secure_url,
        public_id: req.file.public_id,
      } : 'null/undefined');
      // Parse FormData fields cho validation
      // Multer đã parse FormData vào req.body, nhưng các field là string
      // Cần convert moveOutDate từ string "YYYY-MM-DD" sang Date object cho validation
      if (req.body.moveOutDate && typeof req.body.moveOutDate === 'string') {
        try {
          req.body.moveOutDate = new Date(req.body.moveOutDate);
          console.log('[moveOutRequest.route] Parsed moveOutDate to Date:', req.body.moveOutDate);
        } catch (e) {
          console.log('[moveOutRequest.route] Failed to parse moveOutDate:', e.message);
          // Nếu không parse được, giữ nguyên string để validation báo lỗi
        }
      }
      next();
    });
  },
  validateBody(createMoveOutRequestSchema),
  asyncHandler(createMoveOutRequest)
);
router.get("/move-out-requests/my", authenticateToken, asyncHandler(getMyMoveOutRequests));

// Admin routes
router.get("/move-out-requests", authenticateToken, authorize("ADMIN"), asyncHandler(getAllMoveOutRequests));
router.put(
  "/move-out-requests/:id",
  authenticateToken,
  authorize("ADMIN"),
  validateParams(moveOutRequestParamsSchema),
  validateBody(updateMoveOutRequestStatusSchema),
  asyncHandler(updateMoveOutRequestStatus)
);
router.put(
  "/move-out-requests/:id/complete",
  authenticateToken,
  authorize("ADMIN"),
  validateParams(moveOutRequestParamsSchema),
  asyncHandler(completeMoveOutRequest)
);

export default router;

