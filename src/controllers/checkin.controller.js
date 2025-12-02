import mongoose from "mongoose";
import Contract from "../models/contract.model.js";
import Bill from "../models/bill.model.js";
import Room from "../models/room.model.js";
import Checkin from "../models/checkin.model.js";
import User from "../models/user.model.js";
import { buildSampleContractDocBuffer } from "../services/docx.service.js";
import logService from "../services/log.service.js";

// ==============================
// Helper functions
// ==============================

// Chuyển số sang Decimal128 của Mongoose
function toDec(n) {
  return mongoose.Types.Decimal128.fromString(Number(n).toFixed(2));
}

// Thêm số tháng vào ngày
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Number(months));
  return d;
}

// ==============================
// Tạo check-in với phiếu thu tiền mặt (OFFLINE)
// ==============================
export const createCashCheckin = async (req, res) => {
  try {
    const user = req.user;
    if (!user?._id) return res.status(401).json({ success: false, message: "Unauthorized" });

    // Kiểm tra role: chỉ ADMIN mới được phép tạo check-in offline
    const role = user.role;
    if (!(["ADMIN"].includes(role))) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
// Lấy dữ liệu từ body
    const {
      roomId,
      checkinDate,
      duration,
      deposit,
      notes,
      identityNo,
      address,
      initialElectricReading,
      // Nếu đã có tài khoản thì gửi kèm tenantId
      tenantId,
    } = req.body || {};

    // Validate các trường bắt buộc
    if (!roomId || !checkinDate || !duration || deposit === undefined) {
      return res.status(400).json({ success: false, message: "roomId, checkinDate, duration, deposit are required" });
    }

    // Validate tiền cọc tối thiểu 500,000 VNĐ
    const depositNum = Number(deposit);
    if (isNaN(depositNum) || depositNum < 500000) {
      return res.status(400).json({ success: false, message: "Tiền cọc giữ phòng tối thiểu là 500,000 VNĐ" });
    }

    // Validate upload ảnh CCCD
    if (!req.files || !req.files.cccdFront || !req.files.cccdBack) {
      return res.status(400).json({ success: false, message: "Vui lòng upload đầy đủ ảnh CCCD mặt trước và mặt sau" });
    }

    // Lấy thông tin phòng
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    // Lấy thông tin tenant nếu có tenantId
    let tenantInfo = null;
    if (tenantId) {
      tenantInfo = await User.findById(tenantId);
      if (!tenantInfo) {
        return res.status(404).json({ success: false, message: "Tenant not found" });
      }
    }

    // Tính ngày bắt đầu và kết thúc check-in
    const startDate = new Date(checkinDate);
    const endDate = addMonths(startDate, duration);
    const monthlyRent = Number(room.pricePerMonth || 0);

    // Xử lý ảnh CCCD
    const cccdFrontFile = Array.isArray(req.files.cccdFront) ? req.files.cccdFront[0] : req.files.cccdFront;
    const cccdBackFile = Array.isArray(req.files.cccdBack) ? req.files.cccdBack[0] : req.files.cccdBack;

    const cccdImages = {
      front: {
        url: cccdFrontFile.path,
        secure_url: cccdFrontFile.secure_url || cccdFrontFile.path,
        public_id: cccdFrontFile.filename,
        resource_type: cccdFrontFile.resource_type || "image",
        format: cccdFrontFile.format,
        bytes: cccdFrontFile.size,
      },
      back: {
        url: cccdBackFile.path,
        secure_url: cccdBackFile.secure_url || cccdBackFile.path,
        public_id: cccdBackFile.filename,
        resource_type: cccdBackFile.resource_type || "image",
        format: cccdBackFile.format,
        bytes: cccdBackFile.size,
      },
    };

    // 1) Ghi nhận bản ghi Checkin trước — nguồn dữ liệu gốc cho thông tin khách
    const checkinRecord = await Checkin.create({
      tenantId: tenantId || undefined,
      staffId: user._id,
      roomId,
      checkinDate: startDate,
      durationMonths: Number(duration),
      deposit: toDec(deposit),
      monthlyRent: toDec(monthlyRent),
      tenantSnapshot: {
        identityNo: identityNo || "",
        fullName: tenantInfo?.fullName || "",
        phone: tenantInfo?.phone || "",
        address: (address && address.trim()) || (tenantInfo?.address && tenantInfo.address.trim()) || "",
      },
      initialElectricReading: initialElectricReading !== undefined && initialElectricReading !== null && initialElectricReading !== "" 
        ? Number(initialElectricReading) 
        : undefined,
      cccdImages,
      notes,
      status: "CREATED",
    });

    // 2) Tạo hợp đồng tạm thời (Contract)
    const contractPayload = {
      roomId,
      startDate,
      endDate,
      deposit: toDec(deposit),
      monthlyRent: toDec(monthlyRent),
      status: "ACTIVE",
      pricingSnapshot: {
        roomNumber: room.roomNumber,
        monthlyRent: toDec(monthlyRent),
        deposit: toDec(deposit),
      },
      tenantSnapshot: checkinRecord.tenantSnapshot || {},
    };
    if (tenantId) {
      contractPayload.tenantId = tenantId;
    }
    const contract = await Contract.create(contractPayload);

    const receiptLineItems = [
      {
        item: "Đặt cọc",
        quantity: 1,
        unitPrice: toDec(deposit),
        lineTotal: toDec(deposit),
      },
    ];

    const receiptBillPayload = {
      contractId: contract._id,
      billingDate: new Date(),
      billType: "RECEIPT",
      status: "PENDING_CASH_CONFIRM",
      lineItems: receiptLineItems,
      amountDue: toDec(Number(deposit)),
      amountPaid: toDec(0),
      payments: [],
      note: notes,
    };
    // Thêm tenantId vào receiptBill nếu có
    if (tenantId) {
      receiptBillPayload.tenantId = tenantId;
    }
    const receiptBill = await Bill.create(receiptBillPayload);

    // 3) Cập nhật Checkin để liên kết contractId
    checkinRecord.contractId = contract._id;
    checkinRecord.receiptBillId = receiptBill._id;
    await checkinRecord.save();

    // 📝 Log checkin creation
    await logService.logCreate({
      entity: 'CHECKIN',
      entityId: checkinRecord._id,
      actorId: user._id,
      data: {
        roomId: room.roomNumber,
        deposit: Number(deposit),
        durationMonths: Number(duration),
        paymentMethod: 'CASH',
      },
    });

    return res.status(201).json({
      success: true,
      message: "Tạo hợp đồng tạm và bill phiếu thu (OFFLINE) thành công",
      data: {
        checkinId: checkinRecord._id,
        contractId: contract._id,
        receiptBillId: receiptBill._id,
      },
    });
  } catch (err) {
    console.error("createCashCheckin error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ==============================
// Tạo check-in ONLINE với payment link
// ==============================
export const createOnlineCheckin = async (req, res) => {
  try {
    const user = req.user;
    if (!user?._id) return res.status(401).json({ success: false, message: "Unauthorized" });
    const role = user.role;
    if (!("ADMIN" === role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Lấy dữ liệu từ request
    const {
      roomId,
      checkinDate,
      duration,
      deposit,
      notes,
      identityNo,
      address,
      initialElectricReading,
      tenantId,
    } = req.body || {};

    // Debug log
    console.log("createOnlineCheckin - req.body:", {
      roomId,
      checkinDate,
      duration,
      deposit,
      address,
      initialElectricReading,
      tenantId,
    });

    if (!roomId || !checkinDate || !duration || deposit === undefined) {
      return res.status(400).json({ success: false, message: "roomId, checkinDate, duration, deposit are required" });
    }

    // Validate tiền cọc tối thiểu 500,000 VNĐ
    const depositNum = Number(deposit);
    if (isNaN(depositNum) || depositNum < 500000) {
      return res.status(400).json({ success: false, message: "Tiền cọc giữ phòng tối thiểu là 500,000 VNĐ" });
    }

    // Kiểm tra upload ảnh CCCD
    if (!req.files || !req.files.cccdFront || !req.files.cccdBack) {
      return res.status(400).json({ success: false, message: "Vui lòng upload đầy đủ ảnh CCCD mặt trước và mặt sau" });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    // Lấy thông tin tenant nếu có tenantId
    let tenantInfo = null;
    if (tenantId) {
      tenantInfo = await User.findById(tenantId);
      if (!tenantInfo) {
        return res.status(404).json({ success: false, message: "Tenant not found" });
      }
    }

    const startDate = new Date(checkinDate);
    const endDate = addMonths(startDate, duration);
    const monthlyRent = Number(room.pricePerMonth || 0);

    // Xử lý ảnh CCCD
    const cccdFrontFile = Array.isArray(req.files.cccdFront) ? req.files.cccdFront[0] : req.files.cccdFront;
    const cccdBackFile = Array.isArray(req.files.cccdBack) ? req.files.cccdBack[0] : req.files.cccdBack;

    const cccdImages = {
      front: {
        url: cccdFrontFile.path,
        secure_url: cccdFrontFile.secure_url || cccdFrontFile.path,
        public_id: cccdFrontFile.filename,
        resource_type: cccdFrontFile.resource_type || "image",
        format: cccdFrontFile.format,
        bytes: cccdFrontFile.size,
      },
      back: {
        url: cccdBackFile.path,
        secure_url: cccdBackFile.secure_url || cccdBackFile.path,
        public_id: cccdBackFile.filename,
        resource_type: cccdBackFile.resource_type || "image",
        format: cccdBackFile.format,
        bytes: cccdBackFile.size,
      },
    };

    // Tạo bản ghi Checkin
    const checkinRecord = await Checkin.create({
      tenantId: tenantId || undefined,
      staffId: user._id,
      roomId,
      checkinDate: startDate,
      durationMonths: Number(duration),
      deposit: toDec(deposit),
      monthlyRent: toDec(monthlyRent),
      tenantSnapshot: {
        identityNo: identityNo || "",
        fullName: tenantInfo?.fullName || "",
        phone: tenantInfo?.phone || "",
        address: (address && address.trim()) || (tenantInfo?.address && tenantInfo.address.trim()) || "",
      },
      initialElectricReading: initialElectricReading !== undefined && initialElectricReading !== null && initialElectricReading !== "" 
        ? Number(initialElectricReading) 
        : undefined,
      cccdImages,
      notes,
      status: "CREATED",
    });

    const contractPayload = {
      roomId,
      startDate,
      endDate,
      deposit: toDec(deposit),
      monthlyRent: toDec(monthlyRent),
      status: "ACTIVE",
      pricingSnapshot: {
        roomNumber: room.roomNumber,
        monthlyRent: toDec(monthlyRent),
        deposit: toDec(deposit),
      },
      tenantSnapshot: checkinRecord.tenantSnapshot || {},
    };
    if (tenantId) contractPayload.tenantId = tenantId;
    const contract = await Contract.create(contractPayload);

    const receiptBillPayload = {
      contractId: contract._id,
      billingDate: new Date(),
      billType: "RECEIPT",
      status: "UNPAID", // Mới tạo là "Chờ thanh toán", chỉ chuyển sang PENDING_CASH_CONFIRM khi khách yêu cầu thanh toán tiền mặt
      lineItems: [
        { item: "Đặt cọc", quantity: 1, unitPrice: toDec(deposit), lineTotal: toDec(deposit) },
      ],
      amountDue: toDec(Number(deposit)),
      amountPaid: toDec(0),
      payments: [],
      note: notes,
    };
    // Thêm tenantId vào receiptBill nếu có
    if (tenantId) {
      receiptBillPayload.tenantId = tenantId;
    }
    const receiptBill = await Bill.create(receiptBillPayload);

    checkinRecord.contractId = contract._id;
    checkinRecord.receiptBillId = receiptBill._id;
    await checkinRecord.save();

    // Generate payment token for public payment link
    const crypto = (await import("crypto")).default;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Valid for 30 days

    receiptBill.paymentToken = token;
    receiptBill.paymentTokenExpires = expiresAt;
    await receiptBill.save();

    // Build payment URL
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const paymentUrl = `${frontendUrl}/public/payment/${receiptBill._id}/${token}`;

    // Note: Email sẽ được gửi sau khi có thông tin từ tenantId hoặc admin có thể generate link sau
    // Không gửi email tự động nữa vì không có thông tin email trong form

    return res.status(201).json({
      success: true,
      message: "Tạo hợp đồng tạm và bill phiếu thu (ONLINE) thành công.",
      data: {
        checkinId: checkinRecord._id,
        contractId: contract._id,
        receiptBillId: receiptBill._id,
        paymentUrl,
        paymentToken: token,
      },
    });
  } catch (err) {
    console.error("createOnlineCheckin error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export const getPrintableSample = async (req, res) => {
  try {
    const { id } = req.params; // checkinId
    const checkin = await Checkin.findById(id).populate("roomId");
    if (!checkin) return res.status(404).json({ success: false, message: "Checkin not found" });

    // Kiểm tra phiếu thu đã thanh toán chưa
    if (!checkin.receiptBillId) {
      return res.status(400).json({ success: false, message: "Chưa tạo phiếu thu cho check-in này" });
    }
    const bill = await Bill.findById(checkin.receiptBillId);
    if (!bill) return res.status(404).json({ success: false, message: "Receipt bill not found" });
    if (bill.status !== "PAID") {
      return res.status(403).json({ success: false, message: "Phiếu thu chưa thanh toán — không thể in hợp đồng mẫu" });
    }

    const printable = {
      documentType: "CONTRACT_SAMPLE",
      checkinId: String(checkin._id),
      createdAt: checkin.createdAt,
      tenant: {
        fullName: checkin.tenantSnapshot?.fullName || "",
        phone: checkin.tenantSnapshot?.phone || "",
        identityNo: checkin.tenantSnapshot?.identityNo || "",
        address: checkin.tenantSnapshot?.address || "",
        note: checkin.tenantSnapshot?.note || checkin.notes || "",
      },
      room: {
        roomNumber: checkin.roomId?.roomNumber || "",
        floor: checkin.roomId?.floor || null,
        areaM2: checkin.roomId?.areaM2 || null,
      },
      dates: {
        checkinDate: checkin.checkinDate,
        startDate: checkin.checkinDate,
        endDate: addMonths(checkin.checkinDate, checkin.durationMonths),
      },
      pricing: {
        deposit: Number(checkin.deposit?.toString() || 0),
        monthlyRent: Number(checkin.monthlyRent?.toString() || 0),
      },
      organization: {
        name: process.env.ORG_NAME || "Nhà trọ ABC",
        address: process.env.ORG_ADDRESS || "Địa chỉ ...",
        phone: process.env.ORG_PHONE || "...",
      },
    };

    return res.status(200).json({ success: true, message: "Dữ liệu in hợp đồng mẫu từ Checkin", data: printable });
  } catch (err) {
    console.error("getPrintableSample error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Tạo và tải hợp đồng mẫu (DOCX) từ Checkin
export const downloadSampleDocx = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { id } = req.params;
    const checkin = await Checkin.findById(id).populate("roomId");
    if (!checkin) return res.status(404).json({ success: false, message: "Checkin not found" });

    // Phiếu thu đặt cọc phải đã thanh toán trước khi tạo mẫu
    if (!checkin.receiptBillId) {
      return res.status(400).json({ success: false, message: "Chưa tạo phiếu thu cho check-in này" });
    }
    const bill = await Bill.findById(checkin.receiptBillId);
    if (!bill) return res.status(404).json({ success: false, message: "Receipt bill not found" });
    if (bill.status !== "PAID") {
      return res.status(403).json({ success: false, message: "Phiếu thu chưa thanh toán — không thể tạo hợp đồng mẫu" });
    }

    // Lấy thông tin tenant mới nhất từ database nếu có tenantId
    if (checkin.tenantId) {
      const tenant = await User.findById(checkin.tenantId);
      if (tenant) {
        // Cập nhật tenantSnapshot với thông tin mới nhất
        checkin.tenantSnapshot = {
          ...checkin.tenantSnapshot,
          fullName: tenant.fullName || checkin.tenantSnapshot?.fullName || "",
          phone: tenant.phone || checkin.tenantSnapshot?.phone || "",
          address: tenant.address || checkin.tenantSnapshot?.address || "",
          identityNo: checkin.tenantSnapshot?.identityNo || "",
        };
      }
    }

    const buffer = await buildSampleContractDocBuffer(checkin, {
      name: process.env.ORG_NAME,
      address: process.env.ORG_ADDRESS,
      owner: process.env.ORG_OWNER,
    });
    const filename = `HopDongMau-${String(checkin._id)}.docx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error("downloadSampleDocx error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


// Hủy check-in trước khi ký hợp đồng cuối: mất 100% tiền cọc
export const cancelCheckin = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { id } = req.params; // checkinId
    const { reason } = req.body || {};
    const checkin = await Checkin.findById(id);
    if (!checkin) return res.status(404).json({ success: false, message: "Checkin not found" });

    // Bỏ validate - có thể hủy bất cứ lúc nào (kể cả chưa thanh toán)
    // Nếu đã thanh toán thì mất 100% cọc, nếu chưa thanh toán thì không có gì để mất
    const receipt = checkin.receiptBillId ? await Bill.findById(checkin.receiptBillId) : null;

    // Đánh dấu check-in hủy
    checkin.status = "CANCELED";
    // Nếu đã thanh toán thì mất 100% cọc
    if (receipt && receipt.status === "PAID") {
    checkin.depositDisposition = "FORFEIT";
    }
    if (reason) {
      checkin.notes = [checkin.notes, `Cancel reason: ${reason}`].filter(Boolean).join("\n");
    }
    await checkin.save();

    return res.status(200).json({ success: true, message: "Đã hủy check-in — mất 100% tiền cọc", data: { checkinId: checkin._id, status: checkin.status, depositDisposition: checkin.depositDisposition } });
  } catch (err) {
    console.error("cancelCheckin error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Get all checkins (Admin only) with pagination
export const getAllCheckins = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { page = 1, limit = 10, status, contractId } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (contractId) filter.contractId = contractId;

    const checkins = await Checkin.find(filter)
      .populate("tenantId", "fullName email phone role")
      .populate("staffId", "fullName email phone role")
      .populate("roomId", "roomNumber pricePerMonth type floor areaM2")
      .populate("contractId")
      .populate("receiptBillId")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Checkin.countDocuments(filter);

    // Convert Decimal128 to numbers and ensure all fields are included
    const formattedCheckins = checkins.map(c => {
      const obj = c.toObject();
      obj.deposit = obj.deposit ? parseFloat(obj.deposit.toString()) : 0;
      obj.monthlyRent = obj.monthlyRent ? parseFloat(obj.monthlyRent.toString()) : 0;
      // Ensure initialElectricReading is included if it exists
      if (obj.initialElectricReading !== undefined && obj.initialElectricReading !== null) {
        obj.initialElectricReading = Number(obj.initialElectricReading);
      }
      // Ensure receiptPaidAt is included if it exists (for calculating expiration deadline)
      if (obj.receiptPaidAt) {
        obj.receiptPaidAt = obj.receiptPaidAt;
      }
      return obj;
    });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách check-in thành công",
      data: formattedCheckins,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("getAllCheckins error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Đánh dấu check-in hoàn thành
export const completeCheckin = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { id } = req.params;
    const checkin = await Checkin.findById(id);
    if (!checkin) return res.status(404).json({ success: false, message: "Checkin not found" });

    // Kiểm tra phiếu thu đã thanh toán chưa
    if (!checkin.receiptBillId) {
      return res.status(400).json({ success: false, message: "Chưa có phiếu thu để xác nhận" });
    }
    const bill = await Bill.findById(checkin.receiptBillId);
    if (!bill) return res.status(404).json({ success: false, message: "Receipt bill not found" });
    if (bill.status !== "PAID") {
      return res.status(400).json({ success: false, message: "Phiếu thu chưa thanh toán — không thể hoàn thành check-in" });
    }

    // Đánh dấu hoàn thành
    checkin.status = "COMPLETED";
    await checkin.save();

    return res.status(200).json({ success: true, message: "Đã đánh dấu check-in hoàn thành", data: checkin });
  } catch (err) {
    console.error("completeCheckin error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export default { createCashCheckin, createOnlineCheckin, getPrintableSample, downloadSampleDocx, cancelCheckin, getAllCheckins, completeCheckin };
