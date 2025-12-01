import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import FinalContract from "../models/finalContract.model.js";
import Contract from "../models/contract.model.js";
import Bill from "../models/bill.model.js";
import logService from "../services/log.service.js";
import notificationService from "../services/notification/notification.service.js";

const toDec = (n) => mongoose.Types.Decimal128.fromString(Number(n).toFixed(2));
const toNum = (d) => (d === null || d === undefined ? 0 : parseFloat(d.toString()));

// Convert Decimal128 values to plain numbers in FinalContract response
const toNumber = (v) => {
  if (v === null || v === undefined) return null;
  // If v is Decimal128 instance or {$numberDecimal: ...}
  try {
    if (typeof v === "object" && "$numberDecimal" in v) return parseFloat(v.$numberDecimal);
  } catch {}
  const s = v?.toString ? v.toString() : String(v);
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
};

const formatFinalContract = (fc) => {
  const obj = fc?.toObject ? fc.toObject() : fc;
  if (!obj) return obj;
  obj.deposit = toNumber(obj.deposit);
  obj.monthlyRent = toNumber(obj.monthlyRent);
  if (obj.pricingSnapshot) {
    obj.pricingSnapshot.deposit = toNumber(obj.pricingSnapshot.deposit);
    obj.pricingSnapshot.monthlyRent = toNumber(obj.pricingSnapshot.monthlyRent);
  }
  if (obj.roomId && obj.roomId.pricePerMonth !== undefined) {
    obj.roomId.pricePerMonth = toNumber(obj.roomId.pricePerMonth);
  }

  // Add helper view/download URLs for uploaded files (images/PDFs)
  const addFileLinks = (file) => {
    const base = file?.secure_url || file?.url;
    if (!base) return file;
    // Robustly detect resource type even if old records miss resource_type/format
    const isRawByUrl = base.includes("/raw/upload/");
    const isRaw = file?.resource_type ? file.resource_type === "raw" : isRawByUrl;

    // Download: force attachment (do not include extension in flag param to avoid 400)
    const downloadUrl = base.replace("/upload/", "/upload/fl_attachment/");

    // Inline view: Remove fl_attachment if exists, then add fl_inline for PDFs
    let inlineUrl = base.replace("/upload/fl_attachment/", "/upload/");
    if (isRaw || file?.format === "pdf") {
      // For PDFs, ensure fl_inline flag for browser viewing
      inlineUrl = inlineUrl.replace("/upload/", "/upload/fl_inline/");
    }

    return { ...file, viewUrl: inlineUrl, downloadUrl, inlineUrl };
  };
  if (Array.isArray(obj.images)) {
    obj.images = obj.images.map(addFileLinks);
  }
  // CCCD files removed - no longer storing CCCD per legal requirements
  return obj;
};

const ensureAccessToContract = (req, contract) => {
  const isAdmin = req.user?.role === "ADMIN";
  const isOwnerTenant = contract?.tenantId?.toString() === req.user?._id?.toString();
  return isAdmin || isOwnerTenant;
};

const sumPaymentsForContract = async (contractId) => {
  const bills = await Bill.find({ contractId });
  let paid = 0;
  for (const b of bills) {
    paid += toNum(b.amountPaid);
  }
  return paid;
};

export const createFromContract = async (req, res) => {
  try {
    const { contractId, terms, tenantId: tenantIdFromBody } = req.body || {};
    if (!contractId) {
      return res.status(400).json({ success: false, message: "contractId is required" });
    }

    const contract = await Contract.findById(contractId).populate("tenantId").populate("roomId");
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    if (!ensureAccessToContract(req, contract)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Verify deposit paid before allowing draft generation
    const depositPaid = await sumPaymentsForContract(contract._id);
    const depositRequired = toNum(contract.deposit);
    if (depositPaid < depositRequired) {
      return res.status(400).json({ success: false, message: "Deposit not fully paid yet" });
    }

    // Scan flags no longer required per updated business rule
    const checkin = await (await import("../models/checkin.model.js")).default.findOne({ contractId: contract._id });
    if (!checkin) {
      return res.status(400).json({ success: false, message: "Check-in record not found for contract" });
    }

    // Kiểm tra xem phiếu thu (receipt) này đã có FinalContract nào với bill CONTRACT đã thanh toán chưa
    // Logic: Nếu cọc chưa được thanh toán hợp đồng nào, vẫn được tạo lại
    if (checkin.receiptBillId) {
      // Tìm tất cả FinalContract liên quan đến checkin này (qua contractId)
      const allFinalContractsForCheckin = await FinalContract.find({ originContractId: contract._id });
      
      // Kiểm tra xem có FinalContract nào có bill CONTRACT đã thanh toán không
      for (const fc of allFinalContractsForCheckin) {
        const existingBills = await Bill.find({ 
          finalContractId: fc._id,
          billType: "CONTRACT"
        });
        const contractBill = existingBills.find(b => b.billType === "CONTRACT");
        
        // Nếu có bill CONTRACT đã thanh toán, không cho tạo lại
        if (contractBill && contractBill.status === "PAID") {
          return res.status(400).json({ 
            success: false, 
            message: "Không thể tạo lại hóa đơn hợp đồng vì cọc này đã được thanh toán hợp đồng. Vui lòng tạo hợp đồng mới." 
          });
        }
      }
      
      // Nếu có FinalContract chưa bị hủy và bill chưa thanh toán, vẫn không cho tạo lại (tránh duplicate)
      const activeFinalContract = allFinalContractsForCheckin.find(fc => fc.status !== "CANCELED");
      if (activeFinalContract) {
        return res.status(400).json({ 
          success: false, 
          message: "Đã tồn tại hợp đồng chính thức cho contract này. Vui lòng hủy hợp đồng cũ trước khi tạo lại." 
        });
      }
      
      // Nếu tất cả FinalContract đã bị hủy và không có bill CONTRACT nào đã thanh toán, cho phép tạo lại
      if (allFinalContractsForCheckin.length > 0) {
        console.log(`⚠️ Found CANCELED FinalContract(s) for contract ${contract._id}. Allowing recreation because no bill CONTRACT is PAID.`);
      }
    }

    // Lấy số tiền đã thanh toán ở phiếu thu cọc giữ phòng
    let receiptBillPaidAmount = 0;
    if (checkin.receiptBillId) {
      const receiptBill = await Bill.findById(checkin.receiptBillId);
      if (receiptBill) {
        receiptBillPaidAmount = toNum(receiptBill.amountPaid) || 0;
      }
    }

    // Determine tenantId: prefer contract.tenantId, else allow missing (gán sau)
    const tenantForFinal = contract.tenantId?._id || contract.tenantId || tenantIdFromBody;

    const finalContract = await FinalContract.create({
      tenantId: tenantForFinal || undefined,
      roomId: contract.roomId?._id || contract.roomId,
      originContractId: contract._id,
      startDate: contract.startDate,
      endDate: contract.endDate,
      deposit: contract.deposit,
      monthlyRent: contract.monthlyRent,
      pricingSnapshot: {
        roomNumber: contract.pricingSnapshot?.roomNumber || contract.roomId?.roomNumber,
        monthlyRent: contract.pricingSnapshot?.monthlyRent || contract.monthlyRent,
        deposit: contract.pricingSnapshot?.deposit || contract.deposit,
      },
      terms: terms || `Hợp đồng thuê phòng giữa bên B (người thuê: ${contract.tenantId?.fullName || ""}) và bên A (chủ nhà). Phòng: ${contract.roomId?.roomNumber || ""}. Thời hạn: ${new Date(contract.startDate).toLocaleDateString()} - ${new Date(contract.endDate).toLocaleDateString()}. Tiền cọc: ${depositRequired}. Tiền thuê hàng tháng: ${toNum(contract.monthlyRent)}.`,
      status: "DRAFT",
    });

    // Create 1 bill CONTRACT gộp: Tiền thuê tháng đầu + Tiền cọc (1 tháng tiền phòng)
    // Logic mới:
    // - Tiền thuê tháng đầu: 5tr (chờ thanh toán)
    // - Tiền cọc 1 tháng tiền phòng: 5tr - 500k (đã cọc giữ phòng) = 4tr5 (chờ thanh toán)
    // - Tổng phải đóng: 5tr + 4tr5 = 9tr5
    // 
    // amountDue = số tiền còn lại phải đóng (9tr5)
    // amountPaid = số tiền đã đóng (500k từ phiếu thu cọc giữ phòng)
    const monthlyRentNum = toNum(contract.monthlyRent);
    const depositRemaining = Math.max(0, monthlyRentNum - receiptBillPaidAmount); // Cọc còn lại phải đóng: 5tr - 500k = 4tr5
    const totalRemainingAmount = monthlyRentNum + depositRemaining; // Tổng còn lại: 5tr + 4tr5 = 9tr5
    
    // Xác định status ban đầu
    // Khi mới tạo: status = UNPAID (chờ thanh toán)
    // Vì các khoản 2 và 3 chưa thanh toán, chỉ có khoản 1 (cọc giữ phòng) đã thanh toán
    let initialStatus = "UNPAID";
    let initialAmountPaid = receiptBillPaidAmount; // 500k
    if (receiptBillPaidAmount >= totalRemainingAmount) {
      // Nếu đã đóng đủ tổng (9tr5), thì status = PAID
      initialStatus = "PAID";
      initialAmountPaid = totalRemainingAmount;
    } else if (receiptBillPaidAmount > 0) {
      // Nếu đã đóng một phần (500k), nhưng vẫn để UNPAID vì các khoản 2 và 3 chưa thanh toán
      // Chỉ khi thanh toán thêm thì mới chuyển sang PARTIALLY_PAID hoặc PAID
      initialStatus = "UNPAID";
    }

    // Copy payments từ receipt bill nếu có
    let initialPayments = [];
    if (checkin.receiptBillId) {
      const receiptBill = await Bill.findById(checkin.receiptBillId);
      if (receiptBill && receiptBill.payments && receiptBill.payments.length > 0) {
        initialPayments = receiptBill.payments.map(p => ({
          ...p,
          note: p.note ? `${p.note} (từ phiếu thu cọc giữ phòng)` : "Từ phiếu thu cọc giữ phòng"
        }));
      }
    }

    await Bill.create({
      contractId: contract._id,
      finalContractId: finalContract._id, // Link to this specific FinalContract
      billingDate: new Date(),
      billType: "CONTRACT",
      status: initialStatus,
      lineItems: [
        { item: "Tiền thuê tháng đầu", quantity: 1, unitPrice: contract.monthlyRent, lineTotal: contract.monthlyRent },
        { item: "Tiền cọc (1 tháng tiền phòng)", quantity: 1, unitPrice: toDec(depositRemaining), lineTotal: toDec(depositRemaining) },
      ],
      // amountDue = số tiền còn lại phải đóng (9tr5)
      amountDue: toDec(totalRemainingAmount), // 9tr5
      amountPaid: toDec(initialAmountPaid), // 500k
      payments: initialPayments,
      note: `Bill hợp đồng. Tiền thuê tháng đầu: ${monthlyRentNum.toLocaleString("vi-VN")} đ. Tiền cọc còn lại: ${depositRemaining.toLocaleString("vi-VN")} đ. Đã đóng ở phiếu thu cọc giữ phòng: ${receiptBillPaidAmount.toLocaleString("vi-VN")} đ. Tổng phải đóng: ${totalRemainingAmount.toLocaleString("vi-VN")} đ.`,
    });

    const populated = await FinalContract.findById(finalContract._id)
      .populate("tenantId", "fullName email phone role")
      .populate("roomId", "roomNumber pricePerMonth");

    // Cập nhật checkin để gán finalContractId
    const Checkin = (await import("../models/checkin.model.js")).default;
    await Checkin.updateOne(
      { contractId: contract._id },
      { $set: { finalContractId: finalContract._id } }
    );

    // 📝 Log final contract creation
    await logService.logCreate({
      entity: 'FINALCONTRACT',
      entityId: finalContract._id,
      actorId: req.user?._id,
      data: {
        roomId: contract.roomId?.roomNumber,
        tenantId: tenantForFinal,
        deposit: toNum(contract.deposit),
        monthlyRent: toNum(contract.monthlyRent),
      },
    });

    // 🔔 Send contract signed notification
    try {
      await notificationService.notifyContractSigned(populated);
    } catch (notifError) {
      console.error('❌ Error sending contract notification:', notifError.message);
    }

    return res.status(201).json({ success: true, message: "Final contract draft created", data: formatFinalContract(populated) });
  } catch (err) {
    console.error("createFromContract error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export const getFinalContractById = async (req, res) => {
  try {
    const { id } = req.params;
    const fc = await FinalContract.findById(id)
      .populate("tenantId", "fullName email phone role")
      .populate("roomId", "roomNumber pricePerMonth")
      .populate("originContractId");
    if (!fc) return res.status(404).json({ success: false, message: "Final contract not found" });

    // Access control: tenant or admin/staff
    const isAdmin = req.user?.role === "ADMIN";
    const isOwnerTenant = fc.tenantId?._id?.toString() === req.user?._id?.toString();
    if (!isAdmin && !isOwnerTenant) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    return res.json({ success: true, data: formatFinalContract(fc) });
  } catch (err) {
    console.error("getFinalContractById error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export const uploadFiles = async (req, res) => {
  try {
    const { id } = req.params;
    const fc = await FinalContract.findById(id);
    if (!fc) return res.status(404).json({ success: false, message: "Final contract not found" });

    // Only admin/staff can upload (tenant cannot upload)
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    // ✅ VALIDATION: Kiểm tra bill CONTRACT đã thanh toán chưa
    // CONTRACT bill được tạo với finalContractId, không phải contractId
    const contractBill = await Bill.findOne({
      finalContractId: fc._id,
      billType: "CONTRACT",
    });
    
    if (!contractBill) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy hóa đơn tháng đầu (CONTRACT bill)"
      });
    }
    
    if (contractBill.status !== "PAID") {
      return res.status(400).json({
        success: false,
        message: "Vui lòng thanh toán hóa đơn tháng đầu trước khi upload hợp đồng"
      });
    }

    const files = (req.files || []).map((f) => ({
      // Prefer Cloudinary-provided URLs; do not force image URLs for PDFs
      url: f.url || f.path,
      secure_url: f.secure_url || f.path || f.url,
      public_id: f.public_id || f.filename,
      resource_type: f.resource_type,
      format: f.format,
      bytes: f.bytes || f.size,
    }));

    fc.images = [...(fc.images || []), ...files];
    // Upload hợp đồng ký tay → coi như hồ sơ đã đầy đủ chữ ký, finalize ngay
    fc.tenantSignedAt = fc.tenantSignedAt || new Date();
    fc.ownerApprovedAt = new Date();
    fc.finalizedAt = new Date();
    fc.status = "SIGNED";
    await fc.save();

    // Cập nhật trạng thái phòng thành OCCUPIED
    try {
      const Room = (await import("../models/room.model.js")).default;
      await Room.findByIdAndUpdate(fc.roomId, { status: "OCCUPIED" });
      console.log(`✅ Updated room ${fc.roomId} status to OCCUPIED`);
    } catch (err) {
      console.warn("Cannot update room status:", err);
    }

    return res.status(200).json({ success: true, message: "Uploaded signed contract files and finalized", data: formatFinalContract(fc) });
  } catch (err) {
    console.error("uploadFiles error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


// Stream a file inline (primarily for PDFs uploaded as raw)
export const viewFileInline = async (req, res) => {
  try {
    const { id, type, index } = req.params;
    const idx = parseInt(index, 10);
    const fc = await FinalContract.findById(id);
    if (!fc) return res.status(404).json({ success: false, message: "Final contract not found" });

    const isAdmin = req.user?.role === "ADMIN";
    const isOwnerTenant = fc.tenantId?.toString() === req.user?._id?.toString();
    if (!isAdmin && !isOwnerTenant) return res.status(403).json({ success: false, message: "Forbidden" });

    // Select correct file array based on type (only images/contract files, no CCCD)
    const files = fc.images || [];
    if (idx < 0 || idx >= files.length) {
      return res.status(404).json({ success: false, message: "File not found" });
    }
    const file = files[idx];
    const base = file?.secure_url || file?.url;
    if (!base) return res.status(404).json({ success: false, message: "File URL not available" });

    // Check if it's a PDF/raw file
    const isRawByUrl = base.includes("/raw/upload/") || file?.resource_type === "raw" || file?.format === "pdf";
    if (!isRawByUrl) {
      // For non-PDFs (images), redirect to Cloudinary URL
      return res.redirect(base);
    }

    // Stream PDF from Cloudinary and override headers for inline viewing
    const axios = (await import("axios")).default;
    const response = await axios.get(base, { responseType: "stream" });
    res.setHeader("Content-Type", "application/pdf");
    const basename = (file?.public_id || "document").split("/").pop();
    res.setHeader("Content-Disposition", `inline; filename="${basename}.pdf"`);
    response.data.pipe(res);
  } catch (err) {
    console.error("viewFileInline error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export const approveOwnerSigned = async (req, res) => {
  try {
    const { id } = req.params;
    const fc = await FinalContract.findById(id);
    if (!fc) return res.status(404).json({ success: false, message: "Final contract not found" });

    // Only admin/staff can approve
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    fc.ownerApprovedAt = new Date();
    if (fc.tenantSignedAt) {
      fc.status = "SIGNED";
      fc.finalizedAt = new Date();
    } else {
      fc.status = "WAITING_SIGN";
    }
    await fc.save();

    return res.status(200).json({ success: true, message: "Owner signature approved", data: formatFinalContract(fc) });
  } catch (err) {
    console.error("approveOwnerSigned error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Get all final contracts (Admin only) with pagination
export const getAllFinalContracts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, tenantId, roomId } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (tenantId) filter.tenantId = tenantId;
    if (roomId) filter.roomId = roomId;

    const finalContracts = await FinalContract.find(filter)
      .populate("tenantId", "fullName email phone role")
      .populate("roomId", "roomNumber pricePerMonth type")
      .populate("originContractId")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await FinalContract.countDocuments(filter);

    const formattedContracts = finalContracts.map(formatFinalContract);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách hợp đồng chính thức thành công",
      data: formattedContracts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("getAllFinalContracts error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Get my final contracts (Tenant)
export const getMyFinalContracts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user._id;

    const finalContracts = await FinalContract.find({ tenantId: userId })
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber pricePerMonth")
      .populate("originContractId")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await FinalContract.countDocuments({ tenantId: userId });

    // Đếm số người ở trong mỗi phòng
    const formattedContracts = await Promise.all(finalContracts.map(async (fc) => {
      const formatted = formatFinalContract(fc);
      if (fc.roomId?._id) {
        // Đếm số FinalContract SIGNED có cùng roomId
        const occupantCount = await FinalContract.countDocuments({
          roomId: fc.roomId._id,
          status: "SIGNED",
          tenantId: { $exists: true, $ne: null }
        });
        formatted.occupantCount = occupantCount;
      }
      return formatted;
    }));

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách hợp đồng chính thức của tôi thành công",
      data: formattedContracts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error("getMyFinalContracts error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export const getRemainingAmount = async (req, res) => {
  try {
    const { id } = req.params;
    const fc = await FinalContract.findById(id);
    if (!fc) return res.status(404).json({ success: false, message: "Final contract not found" });

    // Access control
    const isAdmin = req.user?.role === "ADMIN";
    const isOwnerTenant = fc.tenantId?.toString() === req.user?._id?.toString();
    if (!isAdmin && !isOwnerTenant) return res.status(403).json({ success: false, message: "Forbidden" });

    // Calculate remaining across all bills of origin contract
    const bills = await Bill.find({ contractId: fc.originContractId || undefined });
    let remaining = 0;
    for (const b of bills) {
      const due = toNum(b.amountDue);
      const paid = toNum(b.amountPaid);
      remaining += Math.max(0, due - paid);
    }

    return res.status(200).json({ success: true, data: { remaining } });
  } catch (err) {
    console.error("getRemainingAmount error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export const deleteFinalContractById = async (req, res) => {
  try {
    const { id } = req.params;
    const fc = await FinalContract.findById(id);
    if (!fc) {
      return res.status(404).json({ success: false, message: "Final contract not found" });
    }

    // Only admin/staff can delete final contracts
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Collect Cloudinary public_ids grouped by resource_type
    const imageIds = [];
    const rawIds = [];
    const collectIds = (arr) => {
      for (const f of arr || []) {
        const pid = f?.public_id;
        const rtype = f?.resource_type;
        if (!pid) continue;
        if (rtype === "raw") rawIds.push(pid);
        else imageIds.push(pid);
      }
    };
    collectIds(fc.images);
    // CCCD files removed - no longer storing CCCD per legal requirements

    const deletion = { images: { requested: imageIds.length, deleted: 0 }, raws: { requested: rawIds.length, deleted: 0 } };
    // Best-effort delete on Cloudinary
    try {
      if (imageIds.length) {
        const resp = await cloudinary.api.delete_resources(imageIds, { resource_type: "image" });
        // Count successes from response.deleted
        const delMap = resp?.deleted || {};
        deletion.images.deleted = Object.values(delMap).filter((v) => v === "deleted").length;
      }
    } catch (e) {
      console.warn("Cloudinary image deletion error:", e?.message || e);
    }
    try {
      if (rawIds.length) {
        const resp = await cloudinary.api.delete_resources(rawIds, { resource_type: "raw" });
        const delMap = resp?.deleted || {};
        deletion.raws.deleted = Object.values(delMap).filter((v) => v === "deleted").length;
      }
    } catch (e) {
      console.warn("Cloudinary raw deletion error:", e?.message || e);
    }

    await FinalContract.findByIdAndDelete(id);

    return res.status(200).json({ success: true, message: "Final contract deleted", data: deletion });
  } catch (err) {
    console.error("deleteFinalContractById error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Gán tenantId cho FinalContract sau khi tạo tài khoản TENANT
export const assignTenantToFinalContract = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const { id } = req.params;
    const { tenantId } = req.body || {};
    if (!tenantId) return res.status(400).json({ success: false, message: "tenantId is required" });

    const fc = await FinalContract.findById(id);
    if (!fc) return res.status(404).json({ success: false, message: "Final contract not found" });

    // Cho phép cập nhật hoặc gán mới
    fc.tenantId = tenantId;
    await fc.save();
    
    // ✅ Cũng update Contract.tenantId để tenant có thể thấy bills
    if (fc.originContractId) {
      try {
        await Contract.findByIdAndUpdate(fc.originContractId, { tenantId });
        console.log(`✅ Updated Contract ${fc.originContractId} with tenantId ${tenantId}`);
      } catch (err) {
        console.warn("Cannot update Contract tenantId:", err);
      }
    }
    
    return res.status(200).json({ success: true, message: "Assigned tenant to final contract", data: formatFinalContract(fc) });
  } catch (err) {
    console.error("assignTenantToFinalContract error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export const deleteFileFromFinalContract = async (req, res) => {
  try {
    const { id, type, index } = req.params;
    const idx = parseInt(index, 10);
    const fc = await FinalContract.findById(id);
    if (!fc) {
      return res.status(404).json({ success: false, message: "Final contract not found" });
    }

    // Only admin/staff can delete files on final contracts
  const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Only allow deleting images/contract files (no CCCD)
    if (type !== "images") {
      return res.status(400).json({ success: false, message: "Only contract files can be deleted" });
    }

    const targetArr = fc.images || [];
    if (idx < 0 || idx >= targetArr.length) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    const file = targetArr[idx];
    const publicId = file?.public_id;
    const resourceType = file?.resource_type || (file?.secure_url || file?.url || "").includes("/raw/upload/") ? "raw" : "image";

    let deleted = false;
    try {
      if (publicId) {
        const resp = await cloudinary.api.delete_resources([publicId], { resource_type: resourceType });
        const delMap = resp?.deleted || {};
        const status = delMap[publicId];
        deleted = status === "deleted";
      }
    } catch (e) {
      console.warn("Cloudinary delete single file error:", e?.message || e);
    }

    // Remove from array and save
    fc.images.splice(idx, 1);
    await fc.save();

    return res.status(200).json({ success: true, message: "File deleted", data: { resourceType, publicId, cloudinaryDeleted: deleted } });
  } catch (err) {
    console.error("deleteFileFromFinalContract error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ============== createForCoTenant ==============
// POST /api/admin/finalcontracts/create-for-cotenant
// Admin tạo FinalContract cho người ở cùng
export const createForCoTenant = async (req, res) => {
  try {
    const { linkedContractId, tenantInfo, depositAmount, startDate } = req.body;

    if (!linkedContractId || !tenantInfo || !depositAmount) {
      return res.status(400).json({ 
        success: false, 
        message: "linkedContractId, tenantInfo, and depositAmount are required" 
      });
    }

    // Kiểm tra Contract chính có tồn tại không
    const mainContract = await Contract.findById(linkedContractId).populate("roomId");
    if (!mainContract) {
      return res.status(404).json({ success: false, message: "Main contract not found" });
    }

    if (mainContract.status !== "ACTIVE") {
      return res.status(400).json({ success: false, message: "Main contract is not active" });
    }

    // Tạo FinalContract cho người ở cùng
    const finalContract = await FinalContract.create({
      roomId: mainContract.roomId._id,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: mainContract.endDate,
      deposit: toDec(depositAmount),
      monthlyRent: mainContract.monthlyRent,
      pricingSnapshot: {
        roomNumber: mainContract.roomId.roomNumber,
        monthlyRent: mainContract.monthlyRent,
        deposit: toDec(depositAmount),
      },
      status: "DRAFT",
      linkedContractId: linkedContractId,
      isCoTenant: true,
    });

    // Tạo Bill RECEIPT cho người ở cùng
    const bill = await Bill.create({
      finalContractId: finalContract._id,
      billingDate: new Date(),
      billType: "RECEIPT",
      status: "UNPAID",
      lineItems: [
        {
          item: `Tiền cọc phòng ${mainContract.roomId.roomNumber} (Người ở cùng)`,
          quantity: 1,
          unitPrice: toDec(depositAmount),
          lineTotal: toDec(depositAmount),
        },
      ],
      amountDue: toDec(depositAmount),
      amountPaid: toDec(0),
      note: `FinalContract cho người ở cùng: ${tenantInfo.fullName}`,
    });

    console.log(`✅ Created FinalContract for co-tenant: ${finalContract._id}, Bill: ${bill._id}`);

    // Generate payment link
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const paymentLink = `${frontendUrl}/checkin?finalContractId=${finalContract._id}`;

    return res.status(201).json({
      success: true,
      message: "FinalContract created for co-tenant",
      data: {
        finalContract: formatFinalContract(finalContract),
        bill: bill,
        paymentLink: paymentLink,
        tenantInfo: tenantInfo,
      },
    });
  } catch (err) {
    console.error("createForCoTenant error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Cancel FinalContract (soft delete)
export const cancelFinalContract = async (req, res) => {
  try {
    const { id } = req.params;
    const fc = await FinalContract.findById(id);
    if (!fc) {
      return res.status(404).json({ success: false, message: "Final contract not found" });
    }
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (fc.status === "CANCELED") {
      return res.status(400).json({ success: false, message: "Final contract already canceled" });
    }
    
    // Hủy tất cả bills CONTRACT liên quan đến FinalContract này (chỉ hủy nếu chưa thanh toán)
    const Bill = (await import("../models/bill.model.js")).default;
    const bills = await Bill.find({ 
      finalContractId: fc._id,
      billType: "CONTRACT"
    });
    
    for (const bill of bills) {
      // Chỉ hủy nếu bill chưa thanh toán hoặc chỉ thanh toán một phần
      if (bill.status !== "PAID") {
        bill.status = "VOID";
        bill.note = bill.note ? `${bill.note} [Đã hủy do hủy hợp đồng chính thức]` : "Đã hủy do hủy hợp đồng chính thức";
        await bill.save();
        console.log(`✅ Hủy bill CONTRACT ${bill._id} do hủy FinalContract ${fc._id}`);
      } else {
        console.log(`⚠️ Không thể hủy bill CONTRACT ${bill._id} vì đã thanh toán`);
      }
    }
    
    fc.status = "CANCELED";
    await fc.save();
    
    // Cập nhật trạng thái phòng: kiểm tra xem còn FinalContract SIGNED nào khác trong phòng này không
    try {
      const Room = (await import("../models/room.model.js")).default;
      // Lấy roomId - có thể là object (đã populate) hoặc ObjectId
      const roomId = (fc.roomId && typeof fc.roomId === 'object' && fc.roomId._id) 
        ? fc.roomId._id 
        : (fc.roomId || null);
      
      if (roomId) {
        // Đếm số FinalContract SIGNED còn lại trong phòng này (không bao gồm hợp đồng vừa hủy)
        const remainingSignedContracts = await FinalContract.countDocuments({
          roomId: roomId,
          status: "SIGNED",
          _id: { $ne: fc._id }, // Loại bỏ hợp đồng vừa hủy
          tenantId: { $exists: true, $ne: null }
        });
        
        // Cập nhật phòng dựa trên số hợp đồng SIGNED còn lại
        if (remainingSignedContracts === 0) {
          // Không còn hợp đồng SIGNED nào → phòng trở về trạng thái trống
          await Room.findByIdAndUpdate(roomId, {
            status: "AVAILABLE",
            occupantCount: 0
          });
          console.log(`✅ Updated room ${roomId} status to AVAILABLE and occupantCount to 0 (no signed contracts remaining)`);
        } else {
          // Vẫn còn hợp đồng SIGNED → cập nhật số người ở
          await Room.findByIdAndUpdate(roomId, {
            occupantCount: remainingSignedContracts
          });
          console.log(`✅ Updated room ${roomId} occupantCount to ${remainingSignedContracts} (${remainingSignedContracts} signed contracts remaining)`);
        }
      } else {
        console.warn(`⚠️ Cannot update room: FinalContract ${fc._id} has no roomId`);
      }
    } catch (err) {
      console.warn("Cannot update room status/occupantCount after canceling contract:", err);
    }
    
    return res.status(200).json({ success: true, message: "Final contract canceled successfully", data: formatFinalContract(fc) });
  } catch (err) {
    console.error("cancelFinalContract error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Extend contract (gia hạn hợp đồng)
// PUT /api/final-contracts/:id/extend
export const extendContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { extensionMonths } = req.body;
    
    // Validate
    if (!extensionMonths || extensionMonths <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số tháng gia hạn không hợp lệ (phải > 0)"
      });
    }
    
    // Tìm FinalContract
    const finalContract = await FinalContract.findById(id)
      .populate("tenantId", "fullName email phone")
      .populate("roomId", "roomNumber");
      
    if (!finalContract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng"
      });
    }
    
    // Chỉ cho phép gia hạn hợp đồng SIGNED
    if (finalContract.status !== "SIGNED") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể gia hạn hợp đồng đã ký (status = SIGNED)"
      });
    }
    
    // Tính endDate mới
    const currentEndDate = new Date(finalContract.endDate);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + parseInt(extensionMonths));
    
    // Lưu endDate cũ để log
    const oldEndDate = finalContract.endDate;
    
    // Cập nhật endDate
    finalContract.endDate = newEndDate;
    
    // Lưu lịch sử gia hạn vào metadata
    if (!finalContract.metadata) finalContract.metadata = {};
    if (!finalContract.metadata.extensions) finalContract.metadata.extensions = [];
    
    finalContract.metadata.extensions.push({
      extendedAt: new Date(),
      extendedBy: req.user._id,
      previousEndDate: oldEndDate,
      newEndDate: newEndDate,
      extensionMonths: parseInt(extensionMonths)
    });
    
    await finalContract.save();
    
    // Cập nhật Contract gốc (nếu có)
    if (finalContract.originContractId) {
      try {
        await Contract.findByIdAndUpdate(finalContract.originContractId, {
          endDate: newEndDate
        });
        console.log(`✅ Updated origin Contract ${finalContract.originContractId} endDate to ${newEndDate}`);
      } catch (err) {
        console.warn("Cannot update origin Contract endDate:", err);
      }
    }
    
    console.log(`✅ Extended FinalContract ${id}: ${oldEndDate} → ${newEndDate} (+${extensionMonths} months)`);
    
    return res.status(200).json({
      success: true,
      message: `Gia hạn hợp đồng thành công thêm ${extensionMonths} tháng`,
      data: {
        finalContract: formatFinalContract(finalContract),
        extension: {
          previousEndDate: oldEndDate,
          newEndDate: newEndDate,
          extensionMonths: parseInt(extensionMonths),
          extendedAt: new Date(),
          extendedBy: req.user.email || req.user._id
        }
      }
    });
  } catch (error) {
    console.error("extendContract error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi gia hạn hợp đồng",
      error: error.message
    });
  }
};

// Get contracts expiring soon
// GET /api/final-contracts/expiring-soon?days=30
export const getExpiringSoonContracts = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));
    futureDate.setHours(23, 59, 59, 999);
    
    const contracts = await FinalContract.find({
      status: "SIGNED",
      endDate: {
        $gte: today,
        $lte: futureDate
      }
    })
    .populate("tenantId", "fullName email phone")
    .populate("roomId", "roomNumber pricePerMonth")
    .populate("originContractId")
    .sort({ endDate: 1 });
    
    const formattedContracts = contracts.map(formatFinalContract);
    
    return res.status(200).json({
      success: true,
      message: `Tìm thấy ${contracts.length} hợp đồng sắp hết hạn trong ${days} ngày tới`,
      data: formattedContracts,
      count: contracts.length,
      filter: {
        days: parseInt(days),
        from: today,
        to: futureDate
      }
    });
  } catch (error) {
    console.error("getExpiringSoonContracts error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách hợp đồng sắp hết hạn",
      error: error.message
    });
  }
};

export default {
  createFromContract,
  getFinalContractById,
  getAllFinalContracts,
  getMyFinalContracts,
  uploadFiles,
  approveOwnerSigned,
  viewFileInline,
  getRemainingAmount,
  deleteFinalContractById,
  deleteFileFromFinalContract,
  assignTenantToFinalContract,
  createForCoTenant,
  cancelFinalContract,
  extendContract,
  getExpiringSoonContracts,
};