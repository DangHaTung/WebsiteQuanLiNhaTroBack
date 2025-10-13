import express from "express";
import {
  getAllContracts,
  createContract,
  getContractById,
  updateContract,
  deleteContract,
} from "../controllers/contract.controller.js";

const router = express.Router();

router.get("/contracts", getAllContracts);
router.post("/contracts", createContract);
router.get("/contracts/:id", getContractById);
router.put("/contracts/:id", updateContract);
router.delete("/contracts/:id", deleteContract);

export default router;
