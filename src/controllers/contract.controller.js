import Contract from "../models/contract.model.js";

/**
 * Helper convert Decimal128 sang number
 */
const convertDecimal128 = (value) => {
    if (value === null || value === undefined) return null;
    return parseFloat(value.toString());
};

/**
 * Chuyển đổi contract object cho frontend
 */
const formatContract = (contract) => {
  const plain = contract.toObject();

  // Convert Decimal128 của roomId nếu có
  if (plain.roomId && plain.roomId.pricePerMonth) {
    plain.roomId.pricePerMonth = convertDecimal128(plain.roomId.pricePerMonth);
  }

  return {
    ...plain,
    deposit: convertDecimal128(contract.deposit),
    monthlyRent: convertDecimal128(contract.monthlyRent),
    pricingSnapshot: contract.pricingSnapshot
      ? {
          ...contract.pricingSnapshot,
          monthlyRent: convertDecimal128(contract.pricingSnapshot.monthlyRent),
          deposit: convertDecimal128(contract.pricingSnapshot.deposit),
        }
      : undefined,
  };
};

// Lấy danh sách hợp đồng của user hiện tại
export const getMyContracts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user._id;

    const contracts = await Contract.find({ tenantId: userId })
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber pricePerMonth")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Contract.countDocuments({ tenantId: userId });

    // Format contracts để chuyển đổi Decimal128 sang number
    const formattedContracts = contracts.map(formatContract);

    res.status(200).json({
      success: true,
      message: "Lấy danh sách hợp đồng thành công",
      data: formattedContracts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách hợp đồng",
      success: false,
      error: err.message,
    });
  }
};

// Lấy toàn bộ hợp đồng (admin)
export const getAllContracts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const contracts = await Contract.find()
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber pricePerMonth")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Contract.countDocuments();

    // Format contracts để chuyển đổi Decimal128 sang number
    const formattedContracts = contracts.map(formatContract);

    res.status(200).json({
      success: true,
      message: "Lấy danh sách hợp đồng thành công",
      data: formattedContracts,
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
    
    // Populate để trả về data đầy đủ
    const populatedContract = await Contract.findById(contract._id)
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber pricePerMonth");
    
    // Format contract để chuyển đổi Decimal128 sang number
    const formattedContract = formatContract(populatedContract);
    
    res.status(201).json({
      success: true,
      message: "Tạo hợp đồng thành công",
      data: formattedContract,
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
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber type status pricePerMonth areaM2 floor");

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    // Format contract để chuyển đổi Decimal128 sang number
    const formattedContract = formatContract(contract);

    res.status(200).json({
      success: true,
      message: "Lấy hợp đồng thành công",
      data: formattedContract,
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
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber pricePerMonth");

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng để cập nhật",
      });
    }

    // Format contract để chuyển đổi Decimal128 sang number
    const formattedContract = formatContract(contract);

    res.status(200).json({
      success: true,
      message: "Cập nhật hợp đồng thành công",
      data: formattedContract,
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
