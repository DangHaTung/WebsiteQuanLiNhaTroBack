console.log("✅ Đã bắt đầu load contract.route.js");

import express from "express";
import { getAllContracts, createContract, getContractById } from "../controllers/contract.controller.js";

console.log("✅ Import contract.controller.js thành công");

const router = express.Router();

router.get("/contracts", getAllContracts);
router.post("/contracts", createContract);
router.get("/contracts/:id", getContractById);

console.log("✅ Contract route loaded");

export default router;
