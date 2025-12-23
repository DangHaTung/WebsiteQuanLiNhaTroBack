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
    const { page = 1, limit = 100, status, tenantId } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) {
      // Nếu client yêu cầu cụ thể status, dùng status đó
      filter.status = status;
    }
    if (tenantId) {
      // Filter theo tenantId nếu có
      filter.tenantId = tenantId;
    }
    // Nếu không có status filter, lấy tất cả (ACTIVE, ENDED, CANCELED) - để frontend có thể hiển thị tất cả

    const contracts = await Contract.find(filter)
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber pricePerMonth status")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Filter thêm: loại bỏ contracts có room status = AVAILABLE (để đảm bảo tính nhất quán)
    // Vì nếu room đã về AVAILABLE thì contract không nên còn ACTIVE
    // ✅ FIX: Chỉ hiển thị contracts đã thuê chính thức (room status = OCCUPIED)
    // Không hiển thị contracts có room status = DEPOSITED (mới cọc, chưa có hợp đồng chính thức)
    const Room = (await import("../models/room.model.js")).default;
    const filteredContracts = [];
    
    for (const contract of contracts) {
      if (contract.roomId) {
        const roomId = typeof contract.roomId === 'object' ? contract.roomId._id : contract.roomId;
        if (roomId) {
          const room = await Room.findById(roomId).select("status");
          if (room) {
            // ✅ FIX: Chỉ hiển thị contract nếu room status = OCCUPIED (đã thuê chính thức)
            // Bỏ qua nếu room status = AVAILABLE hoặc DEPOSITED
            if (room.status === "AVAILABLE") {
              // Room đã về trống → contract không nên còn ACTIVE (không nhất quán)
              if (contract.status === "ACTIVE") {
                console.log(`⚠️ Skipping contract ${contract._id} - room ${roomId} is AVAILABLE but contract is ACTIVE`);
                continue;
              }
              // Các contract CANCELED hoặc ENDED với room AVAILABLE vẫn hiển thị để user biết lịch sử
            } else if (room.status === "DEPOSITED") {
              // ✅ FIX: Room chỉ mới được cọc, chưa có hợp đồng chính thức → Bỏ qua (không hiển thị trong "Quản lý người ở cùng")
              console.log(`⚠️ Skipping contract ${contract._id} - room ${roomId} is DEPOSITED (only deposited, not officially rented yet)`);
              continue;
            }
            // Room status = OCCUPIED → Contract đã thuê chính thức → Hiển thị
          }
        }
      }
      // Các contract với room OCCUPIED, CANCELED, ENDED đều được thêm vào
      filteredContracts.push(contract);
    }

    const total = await Contract.countDocuments(filter);

    // Format contracts để chuyển đổi Decimal128 sang number
    const formattedContracts = filteredContracts.map(formatContract);
    
    // Deduplicate by _id để tránh trả về duplicate
    const uniqueContracts = Array.from(
      new Map(formattedContracts.map(c => [c._id.toString(), c])).values()
    );
    
    // Sắp xếp: ACTIVE lên đầu, sau đó ENDED, cuối cùng CANCELED
    // Thứ tự ưu tiên: ACTIVE = 0, ENDED = 1, CANCELED = 2
    const statusOrder = {
      ACTIVE: 0,
      ENDED: 1,
      CANCELED: 2,
    };
    
    uniqueContracts.sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 999;
      const orderB = statusOrder[b.status] ?? 999;
      if (orderA !== orderB) {
        return orderA - orderB; // Sắp xếp theo status
      }
      // Nếu cùng status, sắp xếp theo createdAt mới nhất trước
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    
    console.log(`📊 getAllContracts: Found ${contracts.length} contracts, filtered: ${filteredContracts.length}, after dedup: ${uniqueContracts.length}`);

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
      vehicles = [], // Danh sách xe chi tiết từ check-in
      damageAmount = 0, 
      damageNote = "",
      method = "BANK", 
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
      : 1 + (contract.coTenants?.filter(ct => ct.status === "ACTIVE").length || 0);

    // Tính tổng tiền cọc theo nghiệp vụ:
    // Tiền cọc = Cọc giữ phòng (RECEIPT bill) + Cọc còn lại (CONTRACT bill - phần cọc)
    // Logic: Lấy từ bills thực tế đã thanh toán
    
    let totalDepositPaid = 0;
    const Bill = (await import("../models/bill.model.js")).default;
    const Checkin = (await import("../models/checkin.model.js")).default;
    
    // 1. Lấy RECEIPT bill (Cọc giữ phòng)
    const checkin = await Checkin.findOne({ contractId: contract._id });
    if (checkin && checkin.receiptBillId) {
      const receiptBill = await Bill.findById(checkin.receiptBillId);
      if (receiptBill && receiptBill.status === "PAID") {
        const receiptPaid = convertDecimal128(receiptBill.amountPaid) || 0;
        totalDepositPaid += receiptPaid;
        console.log(`[refundDeposit] Found RECEIPT bill: amountPaid=${receiptPaid}`);
      }
    }
    
    // 2. Lấy CONTRACT bill (Cọc còn lại - phần "Tiền cọc (1 tháng tiền phòng)")
    // Tìm FinalContract liên quan
    const FinalContract = (await import("../models/finalContract.model.js")).default;
    const finalContract = await FinalContract.findOne({
      originContractId: contract._id,
      isCoTenant: { $ne: true },
      status: { $in: ["DRAFT", "WAITING_SIGN", "SIGNED"] }
    });
    
    if (finalContract) {
      const contractBills = await Bill.find({
        finalContractId: finalContract._id,
        billType: "CONTRACT",
        status: "PAID"
      });
      
      if (contractBills.length > 0) {
        const contractBill = contractBills[0]; // Lấy bill đầu tiên
        // Tìm lineItem có chứa "cọc" hoặc "Tiền cọc"
        if (contractBill.lineItems && Array.isArray(contractBill.lineItems)) {
          const depositLineItem = contractBill.lineItems.find(item => 
            item.item && (
              item.item.toLowerCase().includes('cọc') || 
              item.item.toLowerCase().includes('deposit')
            )
          );
          
          if (depositLineItem) {
            const contractDeposit = convertDecimal128(depositLineItem.lineTotal) || 0;
            totalDepositPaid += contractDeposit;
            console.log(`[refundDeposit] Found CONTRACT bill deposit: ${contractDeposit}`);
          } else {
            // Fallback: nếu không tìm thấy lineItem cọc, lấy lineItem thứ 2 (thường là cọc)
            if (contractBill.lineItems.length >= 2) {
              const contractDeposit = convertDecimal128(contractBill.lineItems[1].lineTotal) || 0;
              totalDepositPaid += contractDeposit;
              console.log(`[refundDeposit] Found CONTRACT bill deposit (fallback): ${contractDeposit}`);
            }
          }
        }
      }
    }
    
    // Fallback: nếu không tìm thấy bills, dùng monthlyRent
    if (totalDepositPaid === 0) {
      if (contract.roomId && typeof contract.roomId === 'object') {
        const monthlyRent = convertDecimal128(contract.roomId.pricePerMonth) || convertDecimal128(contract.monthlyRent) || 0;
        if (monthlyRent > 0) {
          totalDepositPaid = monthlyRent;
          console.log(`[refundDeposit] Using monthlyRent as fallback: ${totalDepositPaid}`);
        }
      }
      
      if (totalDepositPaid === 0) {
        totalDepositPaid = convertDecimal128(contract.monthlyRent) || convertDecimal128(contract.deposit) || 0;
        console.log(`[refundDeposit] Using contract.monthlyRent/deposit as final fallback: ${totalDepositPaid}`);
      }
    }
    
    console.log(`[refundDeposit] Total deposit paid (RECEIPT + CONTRACT): ${totalDepositPaid}`);

    // Tính dịch vụ tháng cuối (BỎ tiền thuê phòng)
    console.log('[refundDeposit] Calculating service fees...');
    console.log('[refundDeposit] vehicles from body:', vehicles, 'type:', typeof vehicles, 'isArray:', Array.isArray(vehicles));
    
    // Parse vehicles nếu là string (từ JSON)
    let parsedVehicles = [];
    if (vehicles) {
      if (typeof vehicles === 'string') {
        try {
          parsedVehicles = JSON.parse(vehicles);
        } catch (e) {
          console.error('[refundDeposit] Error parsing vehicles from string:', e);
          parsedVehicles = [];
        }
      } else if (Array.isArray(vehicles)) {
        parsedVehicles = vehicles;
      }
    }
    
    console.log('[refundDeposit] parsedVehicles:', parsedVehicles);
    
    const { calculateRoomMonthlyFees } = await import("../services/billing/monthlyBill.service.js");
    // Sử dụng vehicles nếu có, nếu không thì dùng vehicleCount (backward compatible)
    const finalVehicleCount = Array.isArray(parsedVehicles) && parsedVehicles.length > 0 
      ? parsedVehicles.length 
      : Number(vehicleCount) || 0;
    
    // Validate roomId
    if (!contract.roomId || !contract.roomId._id) {
      console.error('[refundDeposit] contract.roomId is missing or invalid:', contract.roomId);
      return res.status(400).json({ 
        success: false, 
        message: "Hợp đồng không có thông tin phòng hợp lệ" 
      });
    }
    
    const roomId = contract.roomId._id;
    console.log('[refundDeposit] Calling calculateRoomMonthlyFees with:', {
      roomId: roomId,
      electricityKwh: Number(electricityKwh),
      waterM3: Number(waterM3),
      occupantCount: finalOccupantCount,
      vehicleCount: finalVehicleCount,
      vehicles: parsedVehicles,
      excludeRent: true,
    });
    
    let serviceFees;
    try {
      serviceFees = await calculateRoomMonthlyFees({
        roomId: roomId,
        electricityKwh: Number(electricityKwh),
        waterM3: Number(waterM3),
        occupantCount: finalOccupantCount,
        vehicleCount: finalVehicleCount,
        vehicles: Array.isArray(parsedVehicles) ? parsedVehicles : [], // Gửi vehicles chi tiết
        excludeRent: true, // BỎ tiền thuê phòng
      });
      console.log('[refundDeposit] Service fees calculated:', serviceFees.totalAmount);
    } catch (error) {
      console.error('[refundDeposit] Error calculating service fees:', error);
      throw new Error(`Lỗi khi tính phí dịch vụ: ${error.message}`);
    }

    // Đảm bảo serviceFees.totalAmount là number
    const serviceFeesAmount = typeof serviceFees.totalAmount === 'number' 
      ? serviceFees.totalAmount 
      : Number(serviceFees.totalAmount) || 0;

    const damageAmountNum = Number(damageAmount) || 0;
    const refundAmount = totalDepositPaid - serviceFeesAmount - damageAmountNum;
    
    console.log('[refundDeposit] Calculation: totalDepositPaid=', totalDepositPaid, 'serviceFees=', serviceFees.totalAmount, 'damage=', damageAmountNum, 'refund=', refundAmount);

    // Thời điểm kết thúc/hủy do hoàn cọc (dùng để hiển thị "Hủy:" ở UI)
    // Lưu ý: nghiệp vụ set status=ENDED nhưng UI cần mốc thời gian (canceledAt) để hiển thị.
    const endedAt = new Date();

    // Cập nhật contract (giữ lại co-tenants, không xóa)
    contract.status = "ENDED"; // Set sang ENDED khi hoàn cọc
    // Dùng field canceledAt như "ngày hết hiệu lực" để UI hiển thị nhất quán
    contract.canceledAt = endedAt;
    
    // Đánh dấu tất cả co-tenants là hết hiệu lực (status = EXPIRED) khi hợp đồng kết thúc
    if (contract.coTenants && contract.coTenants.length > 0) {
      contract.coTenants = contract.coTenants.map(ct => {
        if (ct.status === "ACTIVE") {
          ct.status = "EXPIRED";
        }
        return ct;
      });
      console.log(`[refundDeposit] Marked ${contract.coTenants.filter(ct => ct.status === "EXPIRED").length} co-tenant(s) as EXPIRED when contract ended`);
    }
    
    contract.depositRefunded = true;
    contract.depositRefund = {
      amount: mongoose.Types.Decimal128.fromString(refundAmount.toFixed(2)),
      refundedAt: endedAt,
      method,
      note,
      damageAmount: mongoose.Types.Decimal128.fromString(damageAmountNum.toFixed(2)),
      damageNote,
      finalMonthServiceFee: mongoose.Types.Decimal128.fromString(serviceFeesAmount.toFixed(2)),
      initialDeposit: mongoose.Types.Decimal128.fromString(totalDepositPaid.toFixed(2)), // Lưu tiền cọc ban đầu (1 tháng tiền phòng) để hiển thị đúng
    };
    await contract.save();
    
    // Gửi thông báo cho client sau khi hoàn cọc thành công
    try {
      const { emitToUser } = await import("../services/socket/socket.service.js");
      if (contract.tenantId) {
        const tenantId = typeof contract.tenantId === 'object' ? contract.tenantId._id : contract.tenantId;
        const roomNumber = contract.roomId?.roomNumber || 'N/A';
        
        const notification = {
          type: 'DEPOSIT_REFUNDED',
          contractId: contract._id,
          moveOutRequestId: null, // Sẽ được set nếu có MoveOutRequest
          roomNumber: roomNumber,
          tenantId: tenantId.toString(),
          tenantName: contract.tenantId?.fullName || 'Khách hàng',
          refundAmount: refundAmount,
          method: method,
          refundedAt: new Date(),
          message: `Tiền cọc hoàn lại cho phòng ${roomNumber} đã được xử lý. Số tiền: ${refundAmount.toLocaleString('vi-VN')} VNĐ. Vui lòng xác nhận đã nhận được tiền.`,
          timestamp: new Date(),
        };
        
        // Tìm MoveOutRequest liên quan để cập nhật status và lấy ID
        // CHỈ tìm APPROVED (chưa hoàn cọc), không tìm WAITING_CONFIRMATION hoặc COMPLETED
        const MoveOutRequest = (await import("../models/moveOutRequest.model.js")).default;
        const moveOutRequest = await MoveOutRequest.findOne({ 
          contractId: contract._id,
          status: "APPROVED" // CHỈ tìm APPROVED, không tìm WAITING_CONFIRMATION hoặc COMPLETED
        });
        
        if (moveOutRequest) {
          // Set status = WAITING_CONFIRMATION (chờ khách xác nhận) thay vì COMPLETED
          const oldStatus = moveOutRequest.status;
          moveOutRequest.status = "WAITING_CONFIRMATION";
          moveOutRequest.refundProcessed = true;
          moveOutRequest.refundedAt = endedAt; // Lưu thời gian hoàn cọc
          await moveOutRequest.save();
          
          // Verify sau khi save
          const verifyRequest = await MoveOutRequest.findById(moveOutRequest._id);
          console.log(`[refundDeposit] Updated MoveOutRequest ${moveOutRequest._id}: ${oldStatus} -> ${verifyRequest.status}`);
          console.log(`[refundDeposit] refundProcessed: ${verifyRequest.refundProcessed}, refundedAt: ${verifyRequest.refundedAt}`);
          console.log(`[refundDeposit] refundConfirmed: ${verifyRequest.refundConfirmed}`);
          
          notification.moveOutRequestId = moveOutRequest._id.toString();
        } else {
          console.log(`[refundDeposit] No APPROVED MoveOutRequest found for contract ${contract._id}`);
        }
        
        emitToUser(tenantId.toString(), 'deposit-refunded', notification);
        console.log(`📤 [refundDeposit] Đã gửi thông báo hoàn cọc đến tenant ${contract.tenantId?.fullName || tenantId}`);
      }
    } catch (notifError) {
      console.error('[refundDeposit] Lỗi khi gửi thông báo:', notifError);
      // Không throw error để không block refund flow
    }

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
      // ✅ Ghi thời điểm hủy để UI hiển thị ở cột "Thời gian"
      mainTenantFinalContract.canceledAt = endedAt;
      await mainTenantFinalContract.save();
      console.log(`[refundDeposit] FinalContract ${mainTenantFinalContract._id} canceled successfully`);
    } else {
      console.log(`[refundDeposit] No FinalContract found for main tenant contract ${contract._id}`);
      console.log(`[refundDeposit] Search query:`, JSON.stringify(finalContractQuery, null, 2));
    }
    
    // 2. Xử lý co-tenants: Tạo FinalContract mới cho co-tenant (nếu chưa có)
    const activeCoTenants = contract.coTenants?.filter(ct => ct.status === "ACTIVE" && ct.userId) || [];
    
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
    // Sử dụng lại biến checkin đã lấy ở trên (dòng 411)
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
          deposit: totalDepositPaid,
          serviceFees: serviceFeesAmount,
          serviceFeesBreakdown: serviceFees.breakdown,
          damageAmount: damageAmountNum,
          refundAmount: refundAmount,
        }
      }
    });
  } catch (error) {
    console.error("refundDeposit error:", error);
    console.error("refundDeposit error stack:", error.stack);
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi khi hoàn cọc", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
      status: "ACTIVE", // Mặc định là ACTIVE khi thêm mới
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
// Admin thêm người ở cùng vào contract (có thể chọn user có sẵn hoặc tạo mới)
export const addCoTenant = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { id } = req.params;
    const { existingUserId, fullName, phone, email, password, identityNo } = req.body;

    // Nếu chọn user có sẵn, chỉ cần existingUserId
    // Nếu tạo mới, cần fullName, phone, email, password
    if (!existingUserId && (!fullName || !phone || !email || !password)) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn người dùng có sẵn hoặc điền đầy đủ thông tin (fullName, phone, email, password)",
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
    const currentCoTenantsCount = contract.coTenants?.filter(ct => ct.status === "ACTIVE").length || 0;
    if (room.type === "DOUBLE" && currentCoTenantsCount >= 1) {
      return res.status(400).json({
        success: false,
        message: "Phòng đôi chỉ được thêm tối đa 1 người ở cùng",
      });
    }

    const User = (await import("../models/user.model.js")).default;
    let user;

    // Không cho thêm trùng với người thuê chính (main tenant)
    const mainTenantId = contract.tenantId ? contract.tenantId.toString() : null;

    if (existingUserId) {
      // Chọn user có sẵn
      user = await User.findById(existingUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Người dùng không tồn tại",
        });
      }

      // ✅ Không cho chọn tài khoản chủ trọ/admin làm "người ở cùng"
      if ((user.role || "").toUpperCase() !== "TENANT") {
        return res.status(400).json({
          success: false,
          message: "Không thể thêm tài khoản chủ trọ/admin làm người ở cùng. Vui lòng chọn tài khoản TENANT.",
        });
      }

      // ✅ Không cho thêm chính người thuê chính vào danh sách người ở cùng
      if (mainTenantId && user._id?.toString() === mainTenantId) {
        return res.status(400).json({
          success: false,
          message: "Không thể thêm người thuê chính làm người ở cùng",
        });
      }

      // Kiểm tra user này đã được thêm vào contract chưa
      const existingIndex = (contract.coTenants || []).findIndex(
        (ct) => ct.userId?.toString() === existingUserId
      );
      if (existingIndex !== -1) {
        // Nếu đã từng tồn tại: tránh duplicate record -> nếu đang ACTIVE thì báo lỗi, nếu EXPIRED thì kích hoạt lại
        const existed = contract.coTenants[existingIndex];
        if (existed.status === "ACTIVE") {
          return res.status(400).json({
            success: false,
            message: "Người dùng này đã được thêm vào hợp đồng",
          });
        }
        existed.status = "ACTIVE";
        existed.joinedAt = new Date();
        existed.leftAt = undefined;
        existed.fullName = user.fullName;
        existed.phone = user.phone;
        existed.email = user.email;
        existed.identityNo = user.identityNo;
        await contract.save();
        console.log(`✅ Reactivated existing co-tenant ${user._id} (${user.fullName}) in contract ${id}`);
      }

      console.log(`✅ Using existing user ${user._id} (${user.fullName}) as co-tenant`);
    } else {
      // Tạo user mới
      const bcrypt = (await import("bcrypt")).default;

      // Kiểm tra đã tồn tại chưa (theo phone)
      const existsByPhone = contract.coTenants?.find((ct) => ct.phone === phone && ct.status === "ACTIVE");
      if (existsByPhone) {
        return res.status(400).json({
          success: false,
          message: "Số điện thoại này đã được thêm vào hợp đồng",
        });
      }

      // Check email đã tồn tại chưa
      const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email hoặc số điện thoại đã được sử dụng trong hệ thống",
        });
      }

      // ✅ Không cho tạo mới trùng email/phone với người thuê chính (nếu có)
      if (mainTenantId) {
        try {
          const main = await User.findById(mainTenantId).select("email phone");
          if (main) {
            const mainEmail = (main.email || "").toString().toLowerCase();
            const mainPhone = (main.phone || "").toString();
            if (mainEmail && (email || "").toString().toLowerCase() === mainEmail) {
              return res.status(400).json({
                success: false,
                message: "Email trùng với người thuê chính, không thể thêm làm người ở cùng",
              });
            }
            if (mainPhone && (phone || "").toString() === mainPhone) {
              return res.status(400).json({
                success: false,
                message: "Số điện thoại trùng với người thuê chính, không thể thêm làm người ở cùng",
              });
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Tạo user
      user = await User.create({
        fullName,
        email,
        phone,
        passwordHash,
        role: "TENANT",
        identityNo,
      });

      console.log(`✅ Created new user ${user._id} for co-tenant ${fullName}`);
    }

    // Thêm vào coTenants với userId
    if (!contract.coTenants) contract.coTenants = [];
    // Nếu branch existingUserId đã reactivate thì không push thêm nữa
    const alreadyActive = contract.coTenants.some((ct) => ct.userId?.toString() === user._id?.toString() && ct.status === "ACTIVE");
    if (!alreadyActive) {
      contract.coTenants.push({
        userId: user._id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        identityNo: user.identityNo || identityNo,
        joinedAt: new Date(),
        status: "ACTIVE", // Mặc định là ACTIVE khi thêm mới
      });
    }

    await contract.save();

    // Cập nhật occupantCount của phòng
    const Room = (await import("../models/room.model.js")).default;
    const activeCoTenantsCount = contract.coTenants?.filter(ct => ct.status === "ACTIVE").length || 0;
    // occupantCount = 1 (người thuê chính) + số người ở cùng
    const newOccupantCount = 1 + activeCoTenantsCount;
    
    await Room.findByIdAndUpdate(room._id, {
      occupantCount: newOccupantCount
    });

    console.log(`✅ Added co-tenant ${user.fullName} to contract ${id}, updated room ${room.roomNumber} occupantCount to ${newOccupantCount}`);

    return res.status(200).json({
      success: true,
      message: existingUserId 
        ? "Thêm người ở cùng thành công."
        : "Thêm người ở cùng thành công. Họ có thể đăng nhập ngay bây giờ.",
      data: {
        contract: formatContract(contract),
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
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

// ============== removeCoTenant ==============
// POST /api/contracts/:id/remove-cotenant/:userId
// Admin gỡ người ở cùng khỏi contract (không xóa tài khoản)
export const removeCoTenant = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { id, userId } = req.params;

    const contract = await Contract.findById(id).populate("roomId");
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    const activeIndex = (contract.coTenants || []).findIndex(
      (ct) => ct.userId?.toString() === userId?.toString() && ct.status === "ACTIVE"
    );

    if (activeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người ở cùng đang hoạt động trong hợp đồng này",
      });
    }

    // Đánh dấu hết hiệu lực (không xóa record để giữ lịch sử)
    contract.coTenants[activeIndex].status = "EXPIRED";
    contract.coTenants[activeIndex].leftAt = new Date();
    await contract.save();

    // Cập nhật occupantCount của phòng: giảm 1 (không nhỏ hơn 1 nếu phòng đang OCCUPIED)
    try {
      const Room = (await import("../models/room.model.js")).default;
      const roomId = contract.roomId?._id || contract.roomId;
      if (roomId) {
        const room = await Room.findById(roomId).select("occupantCount status");
        if (room) {
          const current = Number(room.occupantCount || 0);
          const next = Math.max(room.status === "OCCUPIED" ? 1 : 0, current - 1);
          room.occupantCount = next;
          await room.save();
        }
      }
    } catch (e) {
      console.warn("Cannot update room occupantCount after removing co-tenant:", e?.message || e);
    }

    // Return updated contract (populate tenant/room for FE)
    const populated = await Contract.findById(id)
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber pricePerMonth status occupantCount");

    return res.status(200).json({
      success: true,
      message: "Đã gỡ người ở cùng khỏi phòng",
      data: formatContract(populated),
    });
  } catch (error) {
    console.error("removeCoTenant error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi gỡ người ở cùng",
      error: error.message,
    });
  }
};
