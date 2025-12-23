import express from "express";
import { login, register, resetPassword } from "../controllers/auth.controller.js";
import { loginSchema, registerSchema, resetPasswordSchema } from "../validations/auth.validation.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", validateBody(registerSchema), asyncHandler(register));
router.post("/login", validateBody(loginSchema), asyncHandler(login));
router.put("/reset-password", authenticateToken, validateBody(resetPasswordSchema), asyncHandler(resetPassword));

export default router;
