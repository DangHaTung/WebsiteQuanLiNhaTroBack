import express from "express";

import { login, register } from "../controllers/auth.controller.js";
import { loginSchema, registerSchema } from "../validations/auth.validation.js";

const router = express.Router();
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  next();
};

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);

export default router;
