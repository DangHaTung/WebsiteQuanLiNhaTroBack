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
// Parking: baseRate * vehicleCount
// Water: baseRate * occupantCount (tính theo số người)
// Internet: flat baseRate per room
// Cleaning: baseRate * occupantCount
export const calculateRoomFees = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Debug: Log raw req.body trước khi destructure
    console.log(`[calculateRoomFees] Raw req.body:`, JSON.stringify(req.body));
    console.log(`[calculateRoomFees] req.body keys:`, Object.keys(req.body || {}));
    console.log(`[calculateRoomFees] req.body.vehicleCount:`, req.body?.vehicleCount, typeof req.body?.vehicleCount);
    
    const { kwh = 0, occupantCount = 0, vehicleCount = 0 } = req.body; // water/internet/cleaning are flat
    
    // Debug: Log sau khi destructure
    console.log(`[calculateRoomFees] After destructure: kwh=${kwh}, occupantCount=${occupantCount}, vehicleCount=${vehicleCount}`);

    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ success: false, message: "Room ID không hợp lệ" });
    }
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Không tìm thấy phòng" });

    const rf = await RoomFee.findOne({ roomId, isActive: true });
    if (!rf) return res.status(404).json({ success: false, message: "Phòng chưa được gán phí" });

    const breakdown = [];
    let total = 0;

    // Tiền thuê phòng (rent)
    const monthlyRent = room.pricePerMonth ? parseFloat(room.pricePerMonth.toString()) : 0;
    if (monthlyRent > 0) {
      breakdown.push({ type: "rent", baseRate: monthlyRent, total: monthlyRent });
      total += monthlyRent;
    }

    // Electricity
    if (rf.appliedTypes.includes("electricity") && kwh > 0) {
      const activeEl = await UtilityFee.findOne({ type: "electricity", isActive: true });
      
      // Debug: Kiểm tra tiers từ database
      console.log(`[calculateRoomFees] Found activeEl:`, activeEl ? {
        _id: activeEl._id,
        type: activeEl.type,
        electricityTiersCount: activeEl.electricityTiers?.length || 0,
        electricityTiers: activeEl.electricityTiers,
        vatPercent: activeEl.vatPercent,
      } : 'null');
      
      // Sửa logic: Chỉ dùng DEFAULT nếu không có tiers trong DB hoặc tiers là mảng rỗng
      let tiers;
      if (activeEl?.electricityTiers && Array.isArray(activeEl.electricityTiers) && activeEl.electricityTiers.length > 0) {
        tiers = activeEl.electricityTiers;
        console.log(`[calculateRoomFees] Using tiers from DB: ${tiers.length} tiers`);
      } else {
        tiers = DEFAULT_ELECTRICITY_TIERS;
        console.log(`[calculateRoomFees] Using DEFAULT_ELECTRICITY_TIERS: ${tiers.length} tiers`);
      }
      
      const vatPercent = typeof activeEl?.vatPercent === "number" ? activeEl.vatPercent : 8;
      
      // Debug logging
      console.log(`[calculateRoomFees] Electricity calculation: kwh=${kwh}, tiers count=${tiers?.length || 0}, vatPercent=${vatPercent}`);
      if (tiers && tiers.length > 0) {
        console.log(`[calculateRoomFees] Tiers:`, JSON.stringify(tiers, null, 2));
      }
      
      const resEl = calculateElectricityCost(kwh, tiers, vatPercent);
      
      console.log(`[calculateRoomFees] Electricity result: subtotal=${resEl.subtotal}, vat=${resEl.vat}, total=${resEl.total}`);
      if (resEl.items && resEl.items.length > 0) {
        console.log(`[calculateRoomFees] Electricity items:`, JSON.stringify(resEl.items, null, 2));
      }
      
      breakdown.push({ type: "electricity", kwh, tiers: resEl.items, subtotal: resEl.subtotal, vat: resEl.vat, total: resEl.total });
      total += resEl.total;
    }

    // Water per occupant
    if (rf.appliedTypes.includes("water") && occupantCount > 0) {
      const active = await UtilityFee.findOne({ type: "water", isActive: true });
      const rate = active?.baseRate || 0;
      const amount = rate * (Number(occupantCount) || 0);
      breakdown.push({ type: "water", baseRate: rate, occupantCount: Number(occupantCount) || 0, total: amount });
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

    // Parking per vehicle (dùng vehicleCount thay vì occupantCount)
    // Debug: Kiểm tra parking
    console.log(`[calculateRoomFees] Parking check: appliedTypes includes parking=${rf.appliedTypes.includes("parking")}, vehicleCount from req.body=${vehicleCount}, typeof=${typeof vehicleCount}`);
    
    if (rf.appliedTypes.includes("parking")) {
      const active = await UtilityFee.findOne({ type: "parking", isActive: true });
      const rate = active?.baseRate || 0;
      const vehicleCountNum = Number(vehicleCount) || 0;
      
      console.log(`[calculateRoomFees] Parking: rate=${rate}, vehicleCountNum=${vehicleCountNum}, active=${active ? 'found' : 'not found'}, req.body=`, JSON.stringify(req.body));
      
      // Tính parking - luôn thêm vào breakdown để hiển thị, kể cả khi vehicleCount = 0
      if (rate > 0) {
        const amount = rate * vehicleCountNum;
        breakdown.push({ type: "parking", baseRate: rate, vehicleCount: vehicleCountNum, total: amount });
        total += amount;
        console.log(`[calculateRoomFees] Parking added to breakdown: vehicleCount=${vehicleCountNum}, rate=${rate}, amount=${amount}`);
      } else {
        // Vẫn thêm vào breakdown với amount = 0 để hiển thị
        breakdown.push({ type: "parking", baseRate: 0, vehicleCount: vehicleCountNum, total: 0 });
        console.log(`[calculateRoomFees] Parking rate is 0, but still added to breakdown with vehicleCount=${vehicleCountNum}`);
      }
    } else {
      console.log(`[calculateRoomFees] Parking not in appliedTypes: ${rf.appliedTypes.join(', ')}`);
    }

    res.status(200).json({ success: true, message: "Tính phí phòng thành công", data: { roomId, breakdown, total } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi tính phí phòng", error: err.message });
  }
};