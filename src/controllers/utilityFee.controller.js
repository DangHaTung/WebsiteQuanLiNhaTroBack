// Controller quản lý phí tiện ích
import UtilityFee from "../models/utilityFee.model.js";

/**
 * Lấy tất cả utility fees
 * GET /api/utility-fees
 */
export const getAllUtilityFees = async (req, res) => {
  try {
    const fees = await UtilityFee.find().sort({ type: 1 });
    
    res.status(200).json({
      success: true,
      message: "Lấy danh sách phí tiện ích thành công",
      data: fees,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phí tiện ích",
      error: err.message,
    });
  }
};

/**
 * Lấy utility fee theo type
 * GET /api/utility-fees/:type
 */
export const getUtilityFeeByType = async (req, res) => {
  try {
    const { type } = req.params;
    
    const fee = await UtilityFee.findOne({ type, isActive: true });
    
    if (!fee) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy cấu hình phí cho ${type}`,
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Lấy thông tin phí tiện ích thành công",
      data: fee,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin phí tiện ích",
      error: err.message,
    });
  }
};

/**
 * Tạo hoặc cập nhật utility fee
 * POST /api/utility-fees
 */
export const createOrUpdateUtilityFee = async (req, res) => {
  try {
    const { type, description, baseRate, electricityTiers, vatPercent, isActive } = req.body;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Type là bắt buộc",
      });
    }
    
    // Tìm fee hiện tại
    let fee = await UtilityFee.findOne({ type, isActive: true });
    
    if (fee) {
      // Cập nhật
      fee.description = description || fee.description;
      fee.baseRate = baseRate !== undefined ? baseRate : fee.baseRate;
      fee.electricityTiers = electricityTiers || fee.electricityTiers;
      fee.vatPercent = vatPercent !== undefined ? vatPercent : fee.vatPercent;
      fee.isActive = isActive !== undefined ? isActive : fee.isActive;
      
      await fee.save();
      
      return res.status(200).json({
        success: true,
        message: "Cập nhật phí tiện ích thành công",
        data: fee,
      });
    } else {
      // Tạo mới
      fee = new UtilityFee({
        type,
        description,
        baseRate: baseRate || 0,
        electricityTiers: electricityTiers || [],
        vatPercent: vatPercent !== undefined ? vatPercent : 8,
        isActive: isActive !== undefined ? isActive : true,
      });
      
      await fee.save();
      
      return res.status(201).json({
        success: true,
        message: "Tạo phí tiện ích thành công",
        data: fee,
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo/cập nhật phí tiện ích",
      error: err.message,
    });
  }
};

/**
 * Xóa utility fee (soft delete)
 * DELETE /api/utility-fees/:id
 */
export const deleteUtilityFee = async (req, res) => {
  try {
    const { id } = req.params;
    
    const fee = await UtilityFee.findById(id);
    
    if (!fee) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phí tiện ích",
      });
    }
    
    fee.isActive = false;
    await fee.save();
    
    res.status(200).json({
      success: true,
      message: "Xóa phí tiện ích thành công",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa phí tiện ích",
      error: err.message,
    });
  }
};

export default {
  getAllUtilityFees,
  getUtilityFeeByType,
  createOrUpdateUtilityFee,
  deleteUtilityFee,
};
