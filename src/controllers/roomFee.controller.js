import mongoose from "mongoose";
import Room from "../models/room.model.js";
import RoomFee from "../models/roomFee.model.js";
import UtilityFee from "../models/utilityFee.model.js";
import { calculateElectricityCost, DEFAULT_ELECTRICITY_TIERS } from "../services/utility/electricity.service.js";

const formatRoomFee = (rf) => {
  const obj = rf.toObject();
  return {
    _id: obj._id,
    roomId: obj.roomId,
    appliedTypes: obj.appliedTypes,
    feeRefs: obj.feeRefs,
    isActive: obj.isActive,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

export const assignRoomFees = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { appliedTypes = [] } = req.body;

    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ success: false, message: "Room ID không hợp lệ" });
    }
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Không tìm thấy phòng" });

    // Deactivate previous active assignment for the room
    await RoomFee.updateMany({ roomId, isActive: true }, { $set: { isActive: false } });

    // Resolve current active UtilityFee refs for provided types
    const refs = {};
    for (const t of appliedTypes) {
      const active = await UtilityFee.findOne({ type: t, isActive: true });
      if (active) refs[t] = active._id;
    }

    const rf = new RoomFee({ roomId, appliedTypes, feeRefs: refs });
    const saved = await rf.save();
    res.status(201).json({ success: true, message: "Gán phí cho phòng thành công", data: formatRoomFee(saved) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi gán phí cho phòng", error: err.message });
  }
};

export const getRoomFees = async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ success: false, message: "Room ID không hợp lệ" });
    }
    const rf = await RoomFee.findOne({ roomId, isActive: true });
    if (!rf) return res.status(404).json({ success: false, message: "Phòng chưa được gán phí" });
    res.status(200).json({ success: true, message: "Lấy phí phòng thành công", data: formatRoomFee(rf) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy phí phòng", error: err.message });
  }
};

// Calculate fees for a room
// Electricity: tiered kWh + VAT
// Parking: baseRate * occupantCount
// Water/Internet: flat baseRate per room
// Cleaning: baseRate * occupantCount
export const calculateRoomFees = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { kwh = 0, occupantCount = 0 } = req.body; // water/internet/cleaning are flat

    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ success: false, message: "Room ID không hợp lệ" });
    }
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Không tìm thấy phòng" });

    const rf = await RoomFee.findOne({ roomId, isActive: true });
    if (!rf) return res.status(404).json({ success: false, message: "Phòng chưa được gán phí" });

    const breakdown = [];
    let total = 0;

    // Electricity
    if (rf.appliedTypes.includes("electricity")) {
      const activeEl = await UtilityFee.findOne({ type: "electricity", isActive: true });
      const tiers = activeEl?.electricityTiers?.length ? activeEl.electricityTiers : DEFAULT_ELECTRICITY_TIERS;
      const vatPercent = typeof activeEl?.vatPercent === "number" ? activeEl.vatPercent : 8;
      const resEl = calculateElectricityCost(kwh, tiers, vatPercent);
      breakdown.push({ type: "electricity", kwh, tiers, subtotal: resEl.subtotal, vat: resEl.vat, total: resEl.total });
      total += resEl.total;
    }

    // Water flat
    if (rf.appliedTypes.includes("water")) {
      const active = await UtilityFee.findOne({ type: "water", isActive: true });
      const amount = active?.baseRate || 0;
      breakdown.push({ type: "water", baseRate: amount, total: amount });
      total += amount;
    }

    // Internet flat
    if (rf.appliedTypes.includes("internet")) {
      const active = await UtilityFee.findOne({ type: "internet", isActive: true });
      const amount = active?.baseRate || 0;
      breakdown.push({ type: "internet", baseRate: amount, total: amount });
      total += amount;
    }

    // Cleaning per occupant
    if (rf.appliedTypes.includes("cleaning")) {
      const active = await UtilityFee.findOne({ type: "cleaning", isActive: true });
      const rate = active?.baseRate || 0;
      const count = Number(occupantCount) || 0;
      const amount = rate * count;
      breakdown.push({ type: "cleaning", baseRate: rate, occupantCount: count, total: amount });
      total += amount;
    }

    // Parking per occupant
    if (rf.appliedTypes.includes("parking")) {
      const active = await UtilityFee.findOne({ type: "parking", isActive: true });
      const rate = active?.baseRate || 0;
      const amount = rate * (Number(occupantCount) || 0);
      breakdown.push({ type: "parking", baseRate: rate, occupantCount: Number(occupantCount) || 0, total: amount });
      total += amount;
    }

    res.status(200).json({ success: true, message: "Tính phí phòng thành công", data: { roomId, breakdown, total } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi tính phí phòng", error: err.message });
  }
};