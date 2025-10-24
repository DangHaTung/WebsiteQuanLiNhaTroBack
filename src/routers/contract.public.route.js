import express from "express";
import { getMyContracts, getContractById } from "../controllers/contract.controller.js";
import { validatePagination, validateParams } from "../middleware/validation.middleware.js";
import { contractParamsSchema } from "../validations/contract.validation.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// Route cho client xem contracts của mình (cần auth nhưng không cần admin)
router.get("/contracts/my-contracts", authenticateToken, validatePagination(), asyncHandler(getMyContracts));

// Route cho client xem contract theo ID (cần auth nhưng không cần admin)
router.get("/contracts/public/:id", authenticateToken, validateParams(contractParamsSchema), asyncHandler(getContractById));

export default router;

