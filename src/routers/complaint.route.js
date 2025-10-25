import express from "express";
import { 
    createComplaint, 
    getAllComplaints, 
    getComplaintById, 
    updateComplaintStatus, 
    deleteComplaint, 
    getComplaintsByTenantId 
} from "../controllers/complaint.controller.js";
import { 
    createComplaintSchema, 
    updateComplaintStatusSchema 
} from "../validations/complaint.validation.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// Tạo complaint mới
router.post("/", authenticateToken, validateBody(createComplaintSchema), asyncHandler(createComplaint));

// Lấy danh sách tất cả complaints (admin)
router.get("/", authenticateToken, asyncHandler(getAllComplaints));

// Lấy complaint theo ID
router.get("/:id", authenticateToken, asyncHandler(getComplaintById));

// Cập nhật status complaint (admin)
router.put("/:id/status", authenticateToken, validateBody(updateComplaintStatusSchema), asyncHandler(updateComplaintStatus));

// Xóa complaint
router.delete("/:id", authenticateToken, asyncHandler(deleteComplaint));

// Lấy complaints theo tenantId
router.get("/tenant/:tenantId", authenticateToken, asyncHandler(getComplaintsByTenantId));

export default router;
