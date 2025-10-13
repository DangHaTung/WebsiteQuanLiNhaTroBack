console.log("✅ Đang load contract.controller.js");

import Contract from "../models/contract.model.js";

console.log("✅ Import contract.model.js thành công");

// Lấy toàn bộ hợp đồng
export const getAllContracts = async (req, res) => {
  try {
    const contracts = await Contract.find()
      .populate("tenantId", "name phone")
      .populate("roomId", "roomNumber");
    res.json({
      success: true,
      message: "Lấy danh sách hợp đồng thành công",
      data: contracts,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách hợp đồng",
      success: false,
      error: error.message,
    });
  }
};

// Tạo hợp đồng mới
