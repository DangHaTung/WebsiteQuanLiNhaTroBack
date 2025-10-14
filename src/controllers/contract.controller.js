import Contract from "../models/contract.model.js";

// Lấy toàn bộ hợp đồng
export const getAllContracts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const contracts = await Contract.find()
      .populate("tenantId", "fullName phone")
      .populate("roomId", "roomNumber")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Contract.countDocuments();

    res.status(200).json({
      success: true,
      message: "Lấy danh sách hợp đồng thành công",
      data: contracts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit),
      },
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
      .populate("tenantId", "fullName phone")
      .populate("roomId", "roomNumber");

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    res.status(200).json({
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

// Cập nhật hợp đồng
export const updateContract = async (req, res) => {
  try {
    const contract = await Contract.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    })
      .populate("tenantId", "fullName phone")
      .populate("roomId", "roomNumber");

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng để cập nhật",
      });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật hợp đồng thành công",
      data: contract,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi cập nhật hợp đồng",
      success: false,
      error: error.message,
    });
  }
};

// Xóa hợp đồng
export const deleteContract = async (req, res) => {
  try {
    const contract = await Contract.findByIdAndDelete(req.params.id);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng để xóa",
      });
    }

    res.status(200).json({
      success: true,
      message: "Xóa hợp đồng thành công",
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi xóa hợp đồng",
      success: false,
      error: error.message,
    });
  }
};
