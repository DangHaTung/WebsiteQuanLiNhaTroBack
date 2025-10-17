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
import { authenticateToken, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";

const router = express.Router();

// Bảo vệ tất cả routes
router.use(authenticateToken);

// Chỉ ADMIN và STAFF được quản trị user
router.use(authorize('ADMIN', 'STAFF'));

router.get("/users", validateQuery(userQuerySchema), asyncHandler(getAllUsers));
router.get("/users/:id", validateParams(userParamsSchema), asyncHandler(getUserById));
router.post("/users", validateBody(createUserSchema), asyncHandler(createUser));
router.put("/users/:id", validateParams(userParamsSchema), validateBody(updateUserSchema), asyncHandler(updateUser));
router.delete("/users/:id", validateParams(userParamsSchema), asyncHandler(deleteUser));

export default router;


