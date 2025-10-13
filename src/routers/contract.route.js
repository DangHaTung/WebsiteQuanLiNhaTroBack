console.log("✅ Đã bắt đầu load contract.route.js");

import express from "express";
import { getAllContracts } from "../controllers/contract.controller.js";

console.log("✅ Import contract.controller.js thành công");

const router = express.Router();

router.get("/contracts", getAllContracts);

console.log("✅ Contract route loaded");

export default router;
