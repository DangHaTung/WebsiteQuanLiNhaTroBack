import express from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/user.controller.js";
import {
  createUserSchema,
  updateUserSchema,
  userParamsSchema,
  userQuerySchema,
} from "../validations/user.validation.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validation.middleware.js";
import { authenticateToken, authorize, optionalAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// Public routes - không cần authentication nhưng có thể lấy thông tin user nếu có token
router.get("/users", optionalAuth, validateQuery(userQuerySchema), asyncHandler(getAllUsers));
router.get("/users/:id", optionalAuth, validateParams(userParamsSchema), asyncHandler(getUserById));

// Protected routes - cần authentication và authorization
router.post("/users", authenticateToken, authorize('ADMIN', 'STAFF'), validateBody(createUserSchema), asyncHandler(createUser));
router.put("/users/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(userParamsSchema), validateBody(updateUserSchema), asyncHandler(updateUser));
router.delete("/users/:id", authenticateToken, authorize('ADMIN', 'STAFF'), validateParams(userParamsSchema), asyncHandler(deleteUser));

export default router;


