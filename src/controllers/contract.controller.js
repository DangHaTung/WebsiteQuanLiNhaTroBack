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
export const createContract = async (req, res) => {
  try {
    const contract = new Contract(req.body);
    await contract.save();
    res.status(201).json({
      success: true,
      message: "Tạo hợp đồng thành công",
      data: contract,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi tạo hợp đồng",
      success: false,
      error: error.message,
    });
  }
};

// Lấy hợp đồng theo ID
export const getContractById = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate("tenantId", "name phone")
      .populate("roomId", "roomNumber");
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }
    
    res.json({
      success: true,
      message: "Lấy hợp đồng thành công",
      data: contract,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi lấy hợp đồng",
      success: false,
      error: error.message,
    });
  }
};
