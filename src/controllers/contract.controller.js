import mongoose from "mongoose";
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
    console.log('[refundDeposit] Start processing refund for contract:', req.params.id);
    console.log('[refundDeposit] Body:', req.body);
    
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { id } = req.params;
    const { 
      electricityKwh = 0, 
      waterM3 = 0,
      occupantCount,
      vehicleCount = 0,
      damageAmount = 0, 
      damageNote = "",
      method = "BANK", 
      transactionId, 
      note 
    } = req.body || {};

    const contract = await Contract.findById(id)
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber pricePerMonth type");

    if (!contract) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng" });
    }

    if (contract.depositRefunded) {
      return res.status(400).json({ success: false, message: "Đã hoàn cọc trước đó" });
    }

    // Tính số người ở (nếu không được truyền)
    const finalOccupantCount = occupantCount !== undefined 
      ? occupantCount 
      : 1 + (contract.coTenants?.filter(ct => !ct.leftAt).length || 0);

    // Tính tổng tiền cọc theo nghiệp vụ:
    // Tiền cọc = 1 tháng tiền phòng (monthlyRent)
    // Vì: Khoản 1 (Cọc giữ phòng) + Khoản 2 (Cọc 1 tháng tiền phòng) = 1 tháng tiền phòng
    
    let totalDepositPaid = 0;
    
    // Cách đơn giản: Tiền cọc = 1 tháng tiền phòng
    if (contract.roomId && typeof contract.roomId === 'object') {
      const monthlyRent = convertDecimal128(contract.roomId.pricePerMonth) || convertDecimal128(contract.monthlyRent) || 0;
      if (monthlyRent > 0) {
        totalDepositPaid = monthlyRent;
        console.log(`[refundDeposit] Using monthlyRent as total deposit: ${totalDepositPaid}`);
      }
    }
    
    // Fallback: nếu không có monthlyRent, dùng contract.deposit
    if (totalDepositPaid === 0) {
      totalDepositPaid = convertDecimal128(contract.monthlyRent) || convertDecimal128(contract.deposit) || 0;
      console.log(`[refundDeposit] Using contract.monthlyRent/deposit as fallback: ${totalDepositPaid}`);
    }
    
    console.log(`[refundDeposit] Total deposit paid: ${totalDepositPaid}`);

    // Tính dịch vụ tháng cuối (BỎ tiền thuê phòng)
    console.log('[refundDeposit] Calculating service fees...');
    const { calculateRoomMonthlyFees } = await import("../services/billing/monthlyBill.service.js");
    const serviceFees = await calculateRoomMonthlyFees({
      roomId: contract.roomId._id,
      electricityKwh: Number(electricityKwh),
      waterM3: Number(waterM3),
      occupantCount: finalOccupantCount,
      vehicleCount: Number(vehicleCount) || 0,
      excludeRent: true, // BỎ tiền thuê phòng
    });
    console.log('[refundDeposit] Service fees calculated:', serviceFees.totalAmount);

    const damageAmountNum = Number(damageAmount) || 0;
    const refundAmount = totalDepositPaid - serviceFees.totalAmount - damageAmountNum;
    
    console.log('[refundDeposit] Calculation: totalDepositPaid=', totalDepositPaid, 'serviceFees=', serviceFees.totalAmount, 'damage=', damageAmountNum, 'refund=', refundAmount);

    // Cập nhật contract (giữ lại co-tenants, không xóa)
    contract.status = "ENDED"; // Set sang ENDED khi hoàn cọc
    contract.depositRefunded = true;
    contract.depositRefund = {
      amount: mongoose.Types.Decimal128.fromString(refundAmount.toFixed(2)),
      refundedAt: new Date(),
      method,
      transactionId,
      note,
      damageAmount: mongoose.Types.Decimal128.fromString(damageAmountNum.toFixed(2)),
      damageNote,
      finalMonthServiceFee: mongoose.Types.Decimal128.fromString(serviceFees.totalAmount.toFixed(2)),
    };
    await contract.save();

    // 1. Cancel FinalContract của người thuê chính (KHÔNG cancel FinalContract của co-tenant)
    // FinalContract đã được import ở trên (dòng 375)
    
    // Tìm FinalContract của người thuê chính:
    // - originContractId = contract._id (FinalContract chính)
    // - KHÔNG phải isCoTenant = true (không phải FinalContract của co-tenant)
    // - tenantId = contract.tenantId (người thuê chính)
    const finalContractQuery = {
      originContractId: contract._id, // Chỉ tìm FinalContract có originContractId = contract._id (người thuê chính)
      isCoTenant: { $ne: true }, // KHÔNG phải FinalContract của co-tenant
      status: { $in: ["DRAFT", "WAITING_SIGN", "SIGNED"] }
    };
    
    // Nếu có tenantId, thêm điều kiện tenantId để chắc chắn
    if (contract.tenantId) {
      finalContractQuery.tenantId = contract.tenantId;
    }
    
    const mainTenantFinalContract = await FinalContract.findOne(finalContractQuery);
    
    if (mainTenantFinalContract) {
      console.log(`[refundDeposit] Found FinalContract ${mainTenantFinalContract._id} (status: ${mainTenantFinalContract.status}) for main tenant ${contract.tenantId}, canceling...`);
      mainTenantFinalContract.status = "CANCELED";
      await mainTenantFinalContract.save();
      console.log(`[refundDeposit] FinalContract ${mainTenantFinalContract._id} canceled successfully`);
    } else {
      console.log(`[refundDeposit] No FinalContract found for main tenant contract ${contract._id}`);
      console.log(`[refundDeposit] Search query:`, JSON.stringify(finalContractQuery, null, 2));
    }
    
    // 2. Xử lý co-tenants: Tạo FinalContract mới cho co-tenant (nếu chưa có)
    const activeCoTenants = contract.coTenants?.filter(ct => !ct.leftAt && ct.userId) || [];
    
    if (activeCoTenants.length > 0) {
      console.log(`[refundDeposit] Found ${activeCoTenants.length} active co-tenant(s), processing...`);
      
      // Kiểm tra FinalContract của co-tenants
      const coTenantFinalContracts = await FinalContract.find({
        linkedContractId: contract._id,
        isCoTenant: true,
        status: { $in: ["DRAFT", "WAITING_SIGN", "SIGNED"] }
      }).select("_id tenantId status");
      
      console.log(`[refundDeposit] Existing co-tenant FinalContracts:`, coTenantFinalContracts.length);
      
      // Với mỗi co-tenant chưa có FinalContract, tạo FinalContract mới
      for (const coTenant of activeCoTenants) {
        const hasFinalContract = coTenantFinalContracts.some(fc => 
          fc.tenantId?.toString() === coTenant.userId?.toString()
        );
        
        if (!hasFinalContract && coTenant.userId) {
          console.log(`[refundDeposit] Creating new FinalContract for co-tenant ${coTenant.fullName} (userId: ${coTenant.userId})`);
          
          // Tạo FinalContract mới cho co-tenant
          const newCoTenantFinalContract = await FinalContract.create({
            tenantId: coTenant.userId,
            roomId: contract.roomId._id,
            startDate: contract.startDate,
            endDate: contract.endDate,
            deposit: contract.deposit, // Co-tenant cũng có cọc riêng
            monthlyRent: contract.monthlyRent,
            pricingSnapshot: {
              roomNumber: contract.pricingSnapshot?.roomNumber || contract.roomId?.roomNumber,
              monthlyRent: contract.monthlyRent,
              deposit: contract.deposit,
            },
            status: "DRAFT",
            linkedContractId: contract._id,
            isCoTenant: true,
          });
          
          console.log(`[refundDeposit] Created FinalContract ${newCoTenantFinalContract._id} for co-tenant ${coTenant.fullName}`);
        } else {
          console.log(`[refundDeposit] Co-tenant ${coTenant.fullName} already has FinalContract, keeping active`);
        }
      }
    } else {
      console.log(`[refundDeposit] No active co-tenants found`);
    }

    // 3. Cập nhật Checkin: set depositDisposition = "REFUNDED"
    const checkin = await Checkin.findOne({ contractId: contract._id });

    if (checkin) {
      console.log(`[refundDeposit] Found Checkin ${checkin._id}, setting depositDisposition = REFUNDED...`);
      checkin.depositDisposition = "REFUNDED";
      await checkin.save();
      console.log(`[refundDeposit] Checkin ${checkin._id} updated successfully`);
    } else {
      console.log(`[refundDeposit] No Checkin found for contract ${contract._id}`);
    }

    return res.status(200).json({ 
      success: true, 
      message: "Hoàn cọc thành công", 
      data: {
        contract: formatContract(contract),
        calculation: {
          deposit: depositAmount,
          serviceFees: serviceFees.totalAmount,
          serviceFeesBreakdown: serviceFees.breakdown,
          damageAmount: damageAmountNum,
          refundAmount: refundAmount,
        }
      }
    });
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

    const contract = await Contract.findById(id).populate("roomId");
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    // Validate loại phòng
    const room = contract.roomId;
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    // Phòng đơn (SINGLE) không được thêm người ở cùng
    if (room.type === "SINGLE") {
      return res.status(400).json({
        success: false,
        message: "Phòng đơn không thể thêm người ở cùng",
      });
    }

    // Phòng đôi (DOUBLE) chỉ được thêm 1 người ở cùng
    const currentCoTenantsCount = contract.coTenants?.filter(ct => !ct.leftAt).length || 0;
    if (room.type === "DOUBLE" && currentCoTenantsCount >= 1) {
      return res.status(400).json({
        success: false,
        message: "Phòng đôi chỉ được thêm tối đa 1 người ở cùng",
      });
    }

    // Kiểm tra đã tồn tại chưa (theo phone)
    const exists = contract.coTenants?.find((ct) => ct.phone === phone && !ct.leftAt);
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

    // Cập nhật occupantCount của phòng
    const Room = (await import("../models/room.model.js")).default;
    const activeCoTenantsCount = contract.coTenants?.filter(ct => !ct.leftAt).length || 0;
    // occupantCount = 1 (người thuê chính) + số người ở cùng
    const newOccupantCount = 1 + activeCoTenantsCount;
    
    await Room.findByIdAndUpdate(room._id, {
      occupantCount: newOccupantCount
    });

    console.log(`✅ Added co-tenant ${fullName} to contract ${id}, updated room ${room.roomNumber} occupantCount to ${newOccupantCount}`);

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
