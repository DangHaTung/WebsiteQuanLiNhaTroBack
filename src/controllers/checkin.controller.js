import mongoose from "mongoose";
import Contract from "../models/contract.model.js";
import Bill from "../models/bill.model.js";
import Room from "../models/room.model.js";

function toDec(n) {
  return mongoose.Types.Decimal128.fromString(Number(n).toFixed(2));
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Number(months));
  return d;
}

export const createCashCheckin = async (req, res) => {
  try {
    const user = req.user;
    if (!user?._id) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { roomId, checkinDate, duration, deposit, notes } = req.body || {};
    if (!roomId || !checkinDate || !duration || deposit === undefined) {
      return res.status(400).json({ success: false, message: "roomId, checkinDate, duration, deposit are required" });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    const startDate = new Date(checkinDate);
    const endDate = addMonths(startDate, duration);
    const monthlyRent = Number(room.pricePerMonth || 0);

    const contract = await Contract.create({
      tenantId: user._id,
      roomId,
      startDate,
      endDate,
      deposit: toDec(deposit),
      monthlyRent: toDec(monthlyRent),
      status: "ACTIVE",
      pricingSnapshot: {
        roomNumber: room.roomNumber,
        monthlyRent: toDec(monthlyRent),
        deposit: toDec(deposit),
      },
    });

    const lineItems = [
      {
        item: "Đặt cọc",
        quantity: 1,
        unitPrice: toDec(deposit),
        lineTotal: toDec(deposit),
      },
      {
        item: "Tiền thuê tháng đầu",
        quantity: 1,
        unitPrice: toDec(monthlyRent),
        lineTotal: toDec(monthlyRent),
      },
    ];

    const amountDue = Number(deposit) + Number(monthlyRent);

    const bill = await Bill.create({
      contractId: contract._id,
      billingDate: new Date(),
      status: "UNPAID",
      lineItems,
      amountDue: toDec(amountDue),
      amountPaid: toDec(0),
      payments: [],
      note: notes,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo hợp đồng và hóa đơn (CASH) thành công",
      data: {
        contractId: contract._id,
        billId: bill._id,
      },
    });
  } catch (err) {
    console.error("createCashCheckin error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export default { createCashCheckin };
