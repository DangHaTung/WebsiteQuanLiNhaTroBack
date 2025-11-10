import mongoose from "mongoose";
import UtilityFee, { FEE_TYPES } from "../models/utilityFee.model.js";
import { calculateElectricityCost, DEFAULT_ELECTRICITY_TIERS } from "../services/utility/electricity.service.js";

const formatFee = (fee) => {
  const obj = fee.toObject();
  return {
    _id: obj._id,
    type: obj.type,
    description: obj.description,
    baseRate: obj.baseRate,
    electricityTiers: obj.electricityTiers,
    vatPercent: obj.vatPercent,
    isActive: obj.isActive,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

export const getAllFees = async (req, res) => {
  try {
    const { type, isActive, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const filter = {};
    if (type) filter.type = type;
    if (typeof isActive !== "undefined") filter.isActive = isActive === "true";

    const fees = await UtilityFee.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await UtilityFee.countDocuments(filter);
    res.status(200).json({
      message: "Lấy danh sách phí tiện ích thành công",
      success: true,
      data: fees.map(formatFee),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách phí", error: err.message });
  }
};

export const getFeeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    const fee = await UtilityFee.findById(id);
    if (!fee) return res.status(404).json({ success: false, message: "Không tìm thấy phí" });
    res.status(200).json({ success: true, message: "Lấy phí thành công", data: formatFee(fee) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy phí", error: err.message });
  }
};

export const createFee = async (req, res) => {
  try {
    const { type, description, baseRate, electricityTiers, vatPercent, isActive } = req.body;

    // If creating active fee, deactivate previous active of same type
    if (isActive) {
      await UtilityFee.updateMany({ type, isActive: true }, { $set: { isActive: false } });
    }

    const fee = new UtilityFee({ type, description, baseRate, electricityTiers, vatPercent, isActive });
    const saved = await fee.save();
    res.status(201).json({ success: true, message: "Tạo phí tiện ích thành công", data: formatFee(saved) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi tạo phí", error: err.message });
  }
};

export const updateFee = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "ID không hợp lệ" });

    const updateData = { ...req.body };
    if (updateData.isActive === true) {
      const current = await UtilityFee.findById(id);
      if (current) {
        await UtilityFee.updateMany({ type: current.type, isActive: true }, { $set: { isActive: false } });
      }
    }

    const fee = await UtilityFee.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!fee) return res.status(404).json({ success: false, message: "Không tìm thấy phí" });
    res.status(200).json({ success: true, message: "Cập nhật phí thành công", data: formatFee(fee) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật phí", error: err.message });
  }
};

export const deleteFee = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    const fee = await UtilityFee.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!fee) return res.status(404).json({ success: false, message: "Không tìm thấy phí" });
    res.status(200).json({ success: true, message: "Xoá phí thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi xoá phí", error: err.message });
  }
};

// Calculate electricity fee independent from room utilities
export const calculateElectricity = async (req, res) => {
  try {
    const { kwh } = req.body;
    if (typeof kwh !== "number" || kwh < 0) {
      return res.status(400).json({ success: false, message: "kWh phải là số không âm" });
    }

    // Use active config if exists, otherwise default tiers and 8% VAT
    const active = await UtilityFee.findOne({ type: "electricity", isActive: true });
    const tiers = active?.electricityTiers?.length ? active.electricityTiers : DEFAULT_ELECTRICITY_TIERS;
    const vatPercent = typeof active?.vatPercent === "number" ? active.vatPercent : 8;
    const result = calculateElectricityCost(kwh, tiers, vatPercent);

    res.status(200).json({
      success: true,
      message: "Tính tiền điện thành công",
      data: {
        input: { kwh },
        tiers,
        result,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi tính tiền điện", error: err.message });
  }
};