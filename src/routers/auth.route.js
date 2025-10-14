import express from "express";
import { login, register } from "../controllers/auth.controller.js";
import { loginSchema, registerSchema } from "../validations/auth.validation.js";
import { validate } from "../validations/index.js";

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);

export default router;
