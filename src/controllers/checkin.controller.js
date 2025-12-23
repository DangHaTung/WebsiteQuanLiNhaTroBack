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

// Chuyển Decimal128 / {$numberDecimal} / string -> number
function toNum(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  // Mongoose Decimal128 may serialize as {$numberDecimal: "..."}
  try {
    if (typeof v === "object" && "$numberDecimal" in v) {
      const n = parseFloat(v.$numberDecimal);
      return Number.isNaN(n) ? 0 : n;
    }
  } catch { /* ignore */ }
  if (v?.toString) {
    const n = parseFloat(v.toString());
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function idToString(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v._id) return String(v._id);
  return String(v);
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
      // Danh sách xe của khách thuê
      vehicles,
    } = req.body || {};

    // Validate các trường bắt buộc
    if (!roomId || !checkinDate || !duration || deposit === undefined) {
      return res.status(400).json({ success: false, message: "roomId, checkinDate, duration, deposit are required" });
    }

    // Validate thời hạn thuê: tối thiểu 1 tháng, tối đa 36 tháng (3 năm)
    const durationNum = Number(duration);
    if (isNaN(durationNum) || durationNum < 1) {
      return res.status(400).json({ success: false, message: "Thời hạn thuê tối thiểu là 1 tháng" });
    }
    if (durationNum > 36) {
      return res.status(400).json({ success: false, message: "Thời hạn thuê tối đa là 36 tháng (3 năm)" });
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

    // Validate tiền cọc không vượt quá tiền phòng 1 tháng
    const monthlyRent = Number(room.pricePerMonth || 0);
    if (monthlyRent > 0 && depositNum > monthlyRent) {
      return res.status(400).json({ 
        success: false, 
        message: `Tiền cọc không được vượt quá tiền phòng 1 tháng (${monthlyRent.toLocaleString('vi-VN')} VNĐ)` 
      });
    }

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

    // Parse vehicles nếu là string (từ FormData)
    let parsedVehicles = [];
    if (vehicles) {
      try {
        parsedVehicles = typeof vehicles === 'string' ? JSON.parse(vehicles) : vehicles;
      } catch (e) {
        console.error("Error parsing vehicles:", e);
      }
    }

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
      vehicles: parsedVehicles,
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
      vehicles,
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
      vehicles,
    });

    if (!roomId || !checkinDate || !duration || deposit === undefined) {
      return res.status(400).json({ success: false, message: "roomId, checkinDate, duration, deposit are required" });
    }

    // Validate thời hạn thuê: tối thiểu 1 tháng, tối đa 36 tháng (3 năm)
    const durationNum = Number(duration);
    if (isNaN(durationNum) || durationNum < 1) {
      return res.status(400).json({ success: false, message: "Thời hạn thuê tối thiểu là 1 tháng" });
    }
    if (durationNum > 36) {
      return res.status(400).json({ success: false, message: "Thời hạn thuê tối đa là 36 tháng (3 năm)" });
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

    // Validate tiền cọc không vượt quá tiền phòng 1 tháng
    const monthlyRent = Number(room.pricePerMonth || 0);
    if (monthlyRent > 0 && depositNum > monthlyRent) {
      return res.status(400).json({ 
        success: false, 
        message: `Tiền cọc không được vượt quá tiền phòng 1 tháng (${monthlyRent.toLocaleString('vi-VN')} VNĐ)` 
      });
    }

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

    // Parse vehicles nếu là string (từ FormData)
    let parsedVehicles = [];
    if (vehicles) {
      try {
        parsedVehicles = typeof vehicles === 'string' ? JSON.parse(vehicles) : vehicles;
      } catch (e) {
        console.error("Error parsing vehicles:", e);
      }
    }

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
      vehicles: parsedVehicles,
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
    expiresAt.setDate(expiresAt.getDate() + 5); // Valid for 5 days

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

    // Fallback: một số checkin (vd: tạo từ "+ thuê thêm phòng") không set tenantId/tenantSnapshot.
    // -> Lấy tenantId từ contractId.tenantId và bơm vào tenantSnapshot để FE không bị N/A.
    const tenantIdsToFetch = new Set();
    const tenantIdsNeedIdentityOrAddress = new Set();
    for (const c of checkins) {
      const hasSnapshot =
        !!c.tenantSnapshot?.fullName ||
        !!c.tenantSnapshot?.phone ||
        !!c.tenantSnapshot?.email;
      if (hasSnapshot) continue;
      const tid = idToString(c.tenantId) || idToString(c.contractId?.tenantId) || idToString(c.finalContractId?.tenantId);
      if (tid) tenantIdsToFetch.add(tid);
    }
    const usersById = new Map();
    if (tenantIdsToFetch.size > 0) {
      const users = await User.find({ _id: { $in: Array.from(tenantIdsToFetch) } }).select("fullName email phone role");
      for (const u of users) usersById.set(String(u._id), u);
    }

    // Fallback CCCD/địa chỉ: User model không có, nên lấy từ checkin snapshot mới nhất của tenant
    for (const c of checkins) {
      const tid = idToString(c.tenantId) || idToString(c.contractId?.tenantId) || idToString(c.finalContractId?.tenantId);
      if (!tid) continue;
      const missingIdentity = !c.tenantSnapshot?.identityNo;
      const missingAddress = !c.tenantSnapshot?.address;
      if (missingIdentity || missingAddress) tenantIdsNeedIdentityOrAddress.add(tid);
    }
    const snapshotByTenant = new Map();
    if (tenantIdsNeedIdentityOrAddress.size > 0) {
      const snapshots = await Checkin.find({
        tenantId: { $in: Array.from(tenantIdsNeedIdentityOrAddress) },
        status: { $ne: "CANCELED" },
        $or: [
          { "tenantSnapshot.identityNo": { $exists: true, $ne: "" } },
          { "tenantSnapshot.address": { $exists: true, $ne: "" } },
        ],
      })
        .sort({ createdAt: -1 })
        .select("tenantId tenantSnapshot createdAt");
      for (const s of snapshots) {
        const tid = idToString(s.tenantId);
        if (!tid) continue;
        if (!snapshotByTenant.has(tid)) {
          snapshotByTenant.set(tid, s.tenantSnapshot || {});
        }
      }
    }

    const total = await Checkin.countDocuments(filter);

    // Convert Decimal128 to numbers and ensure all fields are included
    const formattedCheckins = checkins.map(c => {
      const obj = c.toObject();
      // ✅ Ensure deposit/monthlyRent exist even for checkins created without these fields
      const depositSource = obj.deposit ?? obj.contractId?.deposit ?? obj.roomId?.pricePerMonth;
      const rentSource = obj.monthlyRent ?? obj.contractId?.monthlyRent ?? obj.roomId?.pricePerMonth;
      obj.deposit = toNum(depositSource);
      obj.monthlyRent = toNum(rentSource);

      // ✅ Ensure tenantSnapshot exists for FE display
      const tid = idToString(obj.tenantId) || idToString(obj.contractId?.tenantId) || idToString(obj.finalContractId?.tenantId);
      const u = tid ? usersById.get(String(tid)) : null;
      const snap = tid ? snapshotByTenant.get(String(tid)) : null;
      if (u) {
        obj.tenantSnapshot = {
          ...(obj.tenantSnapshot || {}),
          fullName: obj.tenantSnapshot?.fullName || u.fullName || "",
          phone: obj.tenantSnapshot?.phone || u.phone || "",
          email: obj.tenantSnapshot?.email || u.email || "",
          identityNo: obj.tenantSnapshot?.identityNo || snap?.identityNo || obj.contractId?.tenantSnapshot?.identityNo || "",
          address: obj.tenantSnapshot?.address || snap?.address || "",
          note: obj.tenantSnapshot?.note || obj.notes || "",
        };
        // Nếu checkin thiếu tenantId thì gắn minimal object để client dùng khi cần
        if (!obj.tenantId) {
          obj.tenantId = { _id: String(u._id), fullName: u.fullName, email: u.email, phone: u.phone, role: u.role };
        }
      } else if (snap) {
        // Không có user (hiếm) nhưng vẫn có snapshot từ checkin trước
        obj.tenantSnapshot = {
          ...(obj.tenantSnapshot || {}),
          identityNo: obj.tenantSnapshot?.identityNo || snap?.identityNo || obj.contractId?.tenantSnapshot?.identityNo || "",
          address: obj.tenantSnapshot?.address || snap?.address || "",
        };
      }

      // Ensure initialElectricReading is included if it exists
      if (obj.initialElectricReading !== undefined && obj.initialElectricReading !== null) {
        obj.initialElectricReading = Number(obj.initialElectricReading);
      }
      // Ensure receiptPaidAt is included if it exists (for calculating expiration deadline)
      // Luôn trả về receiptPaidAt nếu có (không cần check if)
      obj.receiptPaidAt = obj.receiptPaidAt || null;
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

// Gia hạn phiếu thu - thêm tiền cọc và thời hạn
export const extendReceipt = async (req, res) => {
  try {
    const user = req.user;
    if (!user?._id) return res.status(401).json({ success: false, message: "Unauthorized" });

    // Chỉ ADMIN mới được phép gia hạn
    if (user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { id: checkinId } = req.params;
    const { additionalDeposit } = req.body;

    // Validate
    if (!checkinId) {
      return res.status(400).json({ 
        success: false, 
        message: "checkinId is required" 
      });
    }

    if (!additionalDeposit) {
      return res.status(400).json({ 
        success: false, 
        message: "additionalDeposit is required" 
      });
    }

    // Validate số tiền cọc tối thiểu 500,000 VNĐ
    const depositNum = Number(additionalDeposit);
    if (isNaN(depositNum) || depositNum < 500000) {
      return res.status(400).json({ 
        success: false, 
        message: "Tiền cọc gia hạn tối thiểu là 500,000 VNĐ" 
      });
    }

    // Kiểm tra checkin (populate receiptBillId để lấy ID)
    const checkin = await Checkin.findById(checkinId).populate("receiptBillId");
    if (!checkin) {
      return res.status(404).json({ success: false, message: "Checkin not found" });
    }

    // Kiểm tra xem có FinalContract đã được ký chưa
    if (checkin.finalContractId) {
      const FinalContract = (await import("../models/finalContract.model.js")).default;
      const finalContract = await FinalContract.findById(checkin.finalContractId);
      
      if (finalContract && finalContract.status === "SIGNED") {
        return res.status(400).json({
          success: false,
          message: "Không thể gia hạn phiếu thu vì hợp đồng đã được ký"
        });
      }
    }

    // Kiểm tra checkin đã thanh toán phiếu thu chưa (phải có receiptPaidAt)
    if (!checkin.receiptPaidAt) {
      return res.status(400).json({ 
        success: false, 
        message: "Chưa thanh toán phiếu thu ban đầu, không thể gia hạn" 
      });
    }

    // Kiểm tra contract
    const contract = await Contract.findById(checkin.contractId);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    // Kiểm tra số lần đã gia hạn: đếm số RECEIPT bills đã PAID (trừ bill đầu tiên)
    const Bill = (await import("../models/bill.model.js")).default;
    const allReceiptBills = await Bill.find({
      contractId: contract._id,
      billType: "RECEIPT",
      status: "PAID"
    }).sort({ createdAt: 1 }); // Sắp xếp theo thời gian tạo
    
    // Lấy receiptBillId đầu tiên (bill phiếu thu ban đầu)
    const firstReceiptBillId = checkin.receiptBillId 
      ? (typeof checkin.receiptBillId === 'object' ? checkin.receiptBillId._id : checkin.receiptBillId)
      : null;
    
    // Đếm số lần gia hạn: số RECEIPT bills đã PAID trừ bill đầu tiên
    const extensionCount = allReceiptBills.filter(bill => {
      const billId = bill._id.toString();
      return billId !== firstReceiptBillId?.toString();
    }).length;
    
    // Validate: chỉ cho phép gia hạn tối đa 3 lần
    if (extensionCount >= 3) {
      return res.status(400).json({ 
        success: false, 
        message: "Đã gia hạn tối đa 3 lần, không thể gia hạn thêm" 
      });
    }

    // Tính toán giá trị mới: chỉ cộng thêm tiền cọc, không thay đổi thời hạn thuê
    const currentDeposit = Number(checkin.deposit?.toString() || 0);
    const newDeposit = currentDeposit + depositNum;

    // Cập nhật checkin: chỉ cập nhật deposit
    // KHÔNG reset receiptPaidAt ở đây - sẽ được set lại khi thanh toán bill RECEIPT mới
    checkin.deposit = toDec(newDeposit);
    await checkin.save();

    // Cập nhật contract deposit
    contract.deposit = toDec(newDeposit);
    await contract.save();

    // Cập nhật CONTRACT bill nếu đã có (tính lại tiền cọc còn lại)
    const existingContractBills = await Bill.find({
      contractId: contract._id,
      billType: "CONTRACT",
      status: { $ne: "PAID" } // Chỉ cập nhật bills chưa thanh toán
    });

    // Cập nhật CONTRACT bill nếu đã có (tính lại tiền cọc còn lại)
    for (const contractBill of existingContractBills) {
      // Tính tổng tất cả RECEIPT bills đã thanh toán (PAID)
      const receiptBills = await Bill.find({
        contractId: contract._id,
        billType: "RECEIPT",
        status: "PAID"
      });
      
      const totalReceiptPaid = receiptBills.reduce((sum, bill) => {
        return sum + Number(bill.amountPaid?.toString() || 0);
      }, 0);
      
      // Tiền cọc còn lại = 1 tháng tiền phòng - tổng đã thanh toán ở RECEIPT bills
      // Logic: Tiền cọc 1 tháng tiền phòng = monthlyRent, nếu đã đóng qua RECEIPT thì trừ đi
      const monthlyRentNum = Number(contract.monthlyRent?.toString() || 0);
      const depositRemaining = Math.max(0, monthlyRentNum - totalReceiptPaid);
      
      // Cập nhật lineItems trong CONTRACT bill
      if (contractBill.lineItems && contractBill.lineItems.length > 0) {
        const depositItem = contractBill.lineItems.find((item) => 
          item.item && item.item.includes("Tiền cọc")
        );
        
        if (depositItem) {
          depositItem.unitPrice = toDec(depositRemaining);
          depositItem.lineTotal = toDec(depositRemaining);
          
          // Tính lại amountDue = tiền thuê tháng đầu + tiền cọc còn lại
          const firstMonthRentItem = contractBill.lineItems.find((item) => 
            item.item && item.item.includes("Tiền thuê tháng đầu")
          );
          const firstMonthRent = firstMonthRentItem 
            ? Number(firstMonthRentItem.lineTotal?.toString() || 0)
            : monthlyRentNum;
          
          contractBill.amountDue = toDec(depositRemaining + firstMonthRent);
          contractBill.amountPaid = toDec(totalReceiptPaid); // Cập nhật amountPaid = tổng đã thanh toán ở RECEIPT
          await contractBill.save();
        }
      }
    }

    // Tạo bill RECEIPT mới cho tiền cọc gia hạn
    const receiptLineItems = [
      {
        item: "Gia hạn đặt cọc giữ phòng",
        quantity: 1,
        unitPrice: toDec(depositNum),
        lineTotal: toDec(depositNum),
      },
    ];

    const receiptBillPayload = {
      contractId: contract._id,
      billingDate: new Date(),
      billType: "RECEIPT",
      status: "UNPAID", // Mới tạo là "Chờ thanh toán", chỉ chuyển sang PENDING_CASH_CONFIRM khi khách yêu cầu thanh toán tiền mặt
      lineItems: receiptLineItems,
      amountDue: toDec(depositNum),
      amountPaid: toDec(0),
      payments: [],
      note: `Gia hạn thời hạn cọc giữ phòng, tiền cọc thêm: ${depositNum.toLocaleString("vi-VN")} VNĐ`,
    };

    if (checkin.tenantId) {
      receiptBillPayload.tenantId = checkin.tenantId;
    }

    const newReceiptBill = await Bill.create(receiptBillPayload);

    // Cập nhật checkin với receiptBillId mới
    checkin.receiptBillId = newReceiptBill._id;
    await checkin.save();

    // 📝 Log extend receipt
    const logService = (await import("../services/log.service.js")).default;
    await logService.logUpdate({
      entity: 'CHECKIN',
      entityId: checkin._id,
      actorId: user._id,
      data: {
        action: 'EXTEND_RECEIPT',
        additionalDeposit: depositNum,
        newDeposit,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Gia hạn thành công! Tiền cọc thêm: ${depositNum.toLocaleString("vi-VN")} VNĐ. Thời hạn cọc giữ phòng được reset lại 3 ngày.`,
      data: {
        checkinId: checkin._id,
        receiptBillId: newReceiptBill._id,
        newDeposit,
      },
    });
  } catch (err) {
    console.error("extendReceipt error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: err.message 
    });
  }
};

// Cập nhật danh sách xe cho checkin
export const updateVehicles = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { id } = req.params;
    const { vehicles } = req.body;

    const checkin = await Checkin.findById(id);
    if (!checkin) return res.status(404).json({ success: false, message: "Checkin not found" });

    // Validate vehicles array
    if (!Array.isArray(vehicles)) {
      return res.status(400).json({ success: false, message: "vehicles must be an array" });
    }

    // Validate từng xe
    const validTypes = ['motorbike', 'electric_bike', 'bicycle'];
    for (const vehicle of vehicles) {
      if (!vehicle.type || !validTypes.includes(vehicle.type)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid vehicle type: ${vehicle.type}. Must be one of: ${validTypes.join(', ')}` 
        });
      }
    }

    // Cập nhật vehicles
    checkin.vehicles = vehicles;
    await checkin.save();

    // 📝 Log update vehicles
    await logService.logUpdate({
      entity: 'CHECKIN',
      entityId: checkin._id,
      actorId: req.user._id,
      data: {
        action: 'UPDATE_VEHICLES',
        vehicleCount: vehicles.length,
        vehicles: vehicles,
      },
    });

    return res.status(200).json({ 
      success: true, 
      message: "Cập nhật danh sách xe thành công", 
      data: { 
        checkinId: checkin._id, 
        vehicles: checkin.vehicles 
      } 
    });
  } catch (err) {
    console.error("updateVehicles error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Lấy thông tin checkin theo ID
export const getCheckinById = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { id } = req.params;
    const checkin = await Checkin.findById(id)
      .populate("tenantId", "fullName email phone role")
      .populate("staffId", "fullName email phone role")
      .populate("roomId", "roomNumber pricePerMonth type floor areaM2")
      .populate("contractId")
      .populate("receiptBillId");

    if (!checkin) return res.status(404).json({ success: false, message: "Checkin not found" });

    // Convert Decimal128 to numbers
    const obj = checkin.toObject();
    // ✅ Ensure deposit/monthlyRent exist even for checkins created without these fields
    const depositSource = obj.deposit ?? obj.contractId?.deposit ?? obj.roomId?.pricePerMonth;
    const rentSource = obj.monthlyRent ?? obj.contractId?.monthlyRent ?? obj.roomId?.pricePerMonth;
    obj.deposit = toNum(depositSource);
    obj.monthlyRent = toNum(rentSource);

    // ✅ Ensure tenantSnapshot exists for FE display (fallback via contractId.tenantId)
    const tid = idToString(obj.tenantId) || idToString(obj.contractId?.tenantId) || idToString(obj.finalContractId?.tenantId);
    if (tid) {
      let u = null;
      // Nếu tenantId đã populate thì có sẵn thông tin
      if (obj.tenantId && typeof obj.tenantId === "object" && obj.tenantId.fullName) {
        u = obj.tenantId;
      } else {
        u = await User.findById(tid).select("fullName email phone role");
      }
      // CCCD/địa chỉ: lấy từ snapshot checkin mới nhất của tenant (trừ chính record này)
      let prevSnap = null;
      const missingIdentity = !obj.tenantSnapshot?.identityNo;
      const missingAddress = !obj.tenantSnapshot?.address;
      if (missingIdentity || missingAddress) {
        prevSnap = await Checkin.findOne({
          tenantId: tid,
          _id: { $ne: obj._id },
          status: { $ne: "CANCELED" },
          $or: [
            { "tenantSnapshot.identityNo": { $exists: true, $ne: "" } },
            { "tenantSnapshot.address": { $exists: true, $ne: "" } },
          ],
        })
          .sort({ createdAt: -1 })
          .select("tenantSnapshot");
      }
      if (u) {
        obj.tenantSnapshot = {
          ...(obj.tenantSnapshot || {}),
          fullName: obj.tenantSnapshot?.fullName || u.fullName || "",
          phone: obj.tenantSnapshot?.phone || u.phone || "",
          email: obj.tenantSnapshot?.email || u.email || "",
          identityNo: obj.tenantSnapshot?.identityNo || prevSnap?.tenantSnapshot?.identityNo || obj.contractId?.tenantSnapshot?.identityNo || "",
          address: obj.tenantSnapshot?.address || prevSnap?.tenantSnapshot?.address || "",
          note: obj.tenantSnapshot?.note || obj.notes || "",
        };
        if (!obj.tenantId) {
          obj.tenantId = { _id: String(u._id), fullName: u.fullName, email: u.email, phone: u.phone, role: u.role };
        }
      }
    }

    if (obj.initialElectricReading !== undefined && obj.initialElectricReading !== null) {
      obj.initialElectricReading = Number(obj.initialElectricReading);
    }
    obj.receiptPaidAt = obj.receiptPaidAt || null;

    return res.status(200).json({ success: true, data: obj });
  } catch (err) {
    console.error("getCheckinById error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export default { createCashCheckin, createOnlineCheckin, getPrintableSample, downloadSampleDocx, cancelCheckin, getAllCheckins, completeCheckin, extendReceipt, updateVehicles, getCheckinById };
