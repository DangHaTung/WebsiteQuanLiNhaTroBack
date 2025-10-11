import express from "express";
import { getAllBills, createBill, updateBill, deleteBill } from "../controllers/bill.controller.js";

const router = express.Router();

router.get("/bills", getAllBills);
router.post("/bills", createBill);
router.put("/bills/:id", updateBill);
router.delete("/bills/:id", deleteBill);

export default router;
