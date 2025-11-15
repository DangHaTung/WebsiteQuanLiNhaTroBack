import Contract from "../models/contract.model.js";
import Checkin from "../models/checkin.model.js";
import Bill from "../models/bill.model.js";
import User from "../models/user.model.js";
import Room from "../models/room.model.js";

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
    const { page = 1, limit = 100, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const contracts = await Contract.find(filter)
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber pricePerMonth")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Contract.countDocuments(filter);

    // Format contracts để chuyển đổi Decimal128 sang number
    const formattedContracts = contracts.map(formatContract);
    
    // Deduplicate by _id để tránh trả về duplicate
    const uniqueContracts = Array.from(
      new Map(formattedContracts.map(c => [c._id.toString(), c])).values()
    );
    
    console.log(`📊 getAllContracts: Found ${contracts.length} contracts, after dedup: ${uniqueContracts.length}`);

    res.status(200).json({
      success: true,
      message: "Lấy danh sách hợp đồng thành công",
      data: uniqueContracts,
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
  // console.log("DEBUG createContract body:", req.body, "user:", req.user?.id);
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

// Trả về dữ liệu in ấn cho biên lai/hợp đồng
export const getPrintableContract = async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await Contract.findById(id)
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber type status pricePerMonth areaM2 floor");

    if (!contract) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng" });
    }

    const checkin = await Checkin.findOne({ contractId: contract._id });
    // Chặn in hợp đồng mẫu nếu phiếu thu chưa thanh toán
    if (checkin?.receiptBillId) {
      const receipt = await Bill.findById(checkin.receiptBillId);
      if (!receipt) {
        return res.status(404).json({ success: false, message: "Không tìm thấy phiếu thu đặt cọc" });
      }
      if (receipt.billType === "RECEIPT" && receipt.status !== "PAID") {
        return res.status(403).json({ success: false, message: "Phiếu thu chưa thanh toán — không thể in hợp đồng mẫu" });
      }
    }

    const printable = {
      documentType: "RECEIPT_CONTRACT",
      contractId: String(contract._id),
      createdAt: contract.createdAt,
      status: contract.status,
      tenant: {
        fullName: contract.tenantSnapshot?.fullName || contract.tenantId?.fullName || "",
        phone: contract.tenantSnapshot?.phone || contract.tenantId?.phone || "",
        email: contract.tenantSnapshot?.email || contract.tenantId?.email || "",
        identityNo: contract.tenantSnapshot?.identityNo || "",
        note: contract.tenantSnapshot?.note || (checkin?.notes || ""),
      },
      room: {
        roomNumber: contract.pricingSnapshot?.roomNumber || contract.roomId?.roomNumber || "",
        floor: contract.roomId?.floor || null,
        areaM2: contract.roomId?.areaM2 || null,
      },
      dates: {
        checkinDate: checkin?.checkinDate || contract.startDate,
        startDate: contract.startDate,
        endDate: contract.endDate,
      },
      pricing: {
        deposit: convertDecimal128(contract.deposit) || convertDecimal128(contract.pricingSnapshot?.deposit) || 0,
        monthlyRent: convertDecimal128(contract.monthlyRent) || convertDecimal128(contract.pricingSnapshot?.monthlyRent) || 0,
      },
      organization: {
        name: process.env.ORG_NAME || "Nhà trọ ABC",
        address: process.env.ORG_ADDRESS || "Địa chỉ ...",
        phone: process.env.ORG_PHONE || "...",
      },
    };

    return res.status(200).json({ success: true, message: "Dữ liệu in hợp đồng/biên lai", data: printable });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi khi lấy dữ liệu in", error: error.message });
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
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa hợp đồng.",
      });
    }

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

// Hoàn cọc khi hợp đồng kết thúc (không gia hạn)
export const refundDeposit = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { id } = req.params;
    const { method = "BANK", transactionId, note } = req.body || {};

    const contract = await Contract.findById(id).populate("tenantId");
    if (!contract) return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng" });

    if (contract.status !== "ENDED") {
      return res.status(400).json({ success: false, message: "Hợp đồng chưa ở trạng thái ENDED" });
    }
    if (contract.depositRefunded) {
      return res.status(200).json({ success: true, message: "Đã hoàn cọc trước đó", data: contract });
    }

    // Kiểm tra công nợ còn lại
    const bills = await Bill.find({ contractId: contract._id });
    let remaining = 0;
    let totalPaid = 0;
    for (const b of bills) {
      const due = convertDecimal128(b.amountDue) || 0;
      const paid = convertDecimal128(b.amountPaid) || 0;
      remaining += Math.max(0, due - paid);
      totalPaid += paid;
    }
    if (remaining > 0.0001) {
      return res.status(400).json({ success: false, message: "Còn công nợ chưa thanh toán — không thể hoàn cọc" });
    }

    const depositRequired = convertDecimal128(contract.deposit) || 0;
    if (totalPaid + 0.0001 < depositRequired) {
      return res.status(400).json({ success: false, message: "Chưa thanh toán đủ tiền cọc" });
    }

    contract.depositRefunded = true;
    contract.depositRefund = {
      amount: contract.deposit,
      refundedAt: new Date(),
      method,
      transactionId,
      note,
    };
    await contract.save();

    return res.status(200).json({ success: true, message: "Hoàn cọc thành công", data: formatContract(contract) });
  } catch (error) {
    console.error("refundDeposit error:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi hoàn cọc", error: error.message });
  }
};

// ============== linkCoTenantToContract ==============
// POST /api/admin/contracts/:id/link-cotenant
// Admin link user (đã thanh toán FinalContract) vào Contract như co-tenant
export const linkCoTenantToContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, finalContractId } = req.body;

    if (!userId || !finalContractId) {
      return res.status(400).json({
        success: false,
        message: "userId and finalContractId are required",
      });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    // Kiểm tra FinalContract
    const FinalContract = (await import("../models/finalContract.model.js")).default;
    const finalContract = await FinalContract.findById(finalContractId);
    if (!finalContract) {
      return res.status(404).json({ success: false, message: "FinalContract not found" });
    }

    if (!finalContract.isCoTenant || finalContract.linkedContractId?.toString() !== id) {
      return res.status(400).json({
        success: false,
        message: "FinalContract is not linked to this contract",
      });
    }

    // Kiểm tra user
    const User = (await import("../models/user.model.js")).default;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Kiểm tra đã tồn tại chưa
    const exists = contract.coTenants?.find((ct) => ct.userId?.toString() === userId);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "User already linked as co-tenant",
      });
    }

    // Thêm vào coTenants
    if (!contract.coTenants) contract.coTenants = [];
    contract.coTenants.push({
      userId: userId,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      identityNo: user.identityNo,
      joinedAt: new Date(),
      finalContractId: finalContractId,
    });

    await contract.save();

    console.log(`✅ Linked user ${userId} as co-tenant to contract ${id}`);

    return res.status(200).json({
      success: true,
      message: "Linked co-tenant successfully",
      data: formatContract(contract),
    });
  } catch (error) {
    console.error("linkCoTenantToContract error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi link co-tenant",
      error: error.message,
    });
  }
};

// ============== addCoTenant ==============
// POST /api/contracts/:id/add-cotenant
// Admin thêm người ở cùng vào contract và tạo user luôn
export const addCoTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, email, password, identityNo } = req.body;

    if (!fullName || !phone || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "fullName, phone, email, and password are required",
      });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    // Kiểm tra đã tồn tại chưa (theo phone)
    const exists = contract.coTenants?.find((ct) => ct.phone === phone);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại này đã được thêm vào hợp đồng",
      });
    }

    // Tạo user mới
    const User = (await import("../models/user.model.js")).default;
    const bcrypt = (await import("bcrypt")).default;

    // Check email đã tồn tại chưa
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email hoặc số điện thoại đã được sử dụng",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Tạo user
    const newUser = await User.create({
      fullName,
      email,
      phone,
      passwordHash,
      role: "TENANT",
      identityNo,
    });

    console.log(`✅ Created user ${newUser._id} for co-tenant ${fullName}`);

    // Thêm vào coTenants với userId
    if (!contract.coTenants) contract.coTenants = [];
    contract.coTenants.push({
      userId: newUser._id,
      fullName,
      phone,
      email,
      identityNo,
      joinedAt: new Date(),
    });

    await contract.save();

    console.log(`✅ Added co-tenant ${fullName} to contract ${id}`);

    return res.status(200).json({
      success: true,
      message: "Thêm người ở cùng thành công. Họ có thể đăng nhập ngay bây giờ.",
      data: {
        contract: formatContract(contract),
        user: {
          _id: newUser._id,
          fullName: newUser.fullName,
          email: newUser.email,
          phone: newUser.phone,
        },
      },
    });
  } catch (error) {
    console.error("addCoTenant error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi thêm người ở cùng",
      error: error.message,
    });
  }
};
