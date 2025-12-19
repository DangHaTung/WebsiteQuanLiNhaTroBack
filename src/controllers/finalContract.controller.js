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
  } catch { }
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

  // ✅ Fallback canceledAt:
  // Một số luồng auto-hủy (vd: hoàn cọc) trước đây chỉ set status=CANCELED nhưng chưa lưu canceledAt.
  // Nếu thiếu canceledAt, lấy từ originContractId.depositRefund.refundedAt hoặc originContractId.canceledAt.
  if (obj.status === "CANCELED" && !obj.canceledAt) {
    const origin = obj.originContractId;
    const fromRefund = origin?.depositRefund?.refundedAt;
    const fromCanceled = origin?.canceledAt;
    obj.canceledAt = fromRefund || fromCanceled || obj.canceledAt;
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
    const CheckinModel = (await import("../models/checkin.model.js")).default;
    const checkin = await CheckinModel.findOne({ contractId: contract._id });
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

    // Lấy tổng số tiền đã thanh toán ở tất cả các phiếu thu cọc giữ phòng (RECEIPT bills)
    // QUAN TRỌNG: Chỉ tính các RECEIPT bills còn hạn (chưa quá 3 ngày từ receiptPaidAt)
    // Nếu phiếu thu đã hết hạn (checkin bị hủy hoặc quá 3 ngày), tiền đó không được tính vào tiền cọc
    // Logic: Khi phiếu thu hết hạn, khách mất tiền đó (không được tính vào tiền cọc)
    
    // Tìm checkin hiện tại (chưa bị hủy) có receiptPaidAt mới nhất
    // Lấy checkin mới nhất nếu có nhiều (trường hợp gia hạn)
    const activeCheckins = await CheckinModel.find({
      contractId: contract._id,
      receiptPaidAt: { $exists: true, $ne: null },
      status: { $ne: "CANCELED" } // Chỉ tính checkin chưa bị hủy
    }).sort({ receiptPaidAt: -1 }).limit(1);
    
    const activeCheckin = activeCheckins && activeCheckins.length > 0 ? activeCheckins[0] : null;
    
    const now = new Date();
    let receiptBillPaidAmount = 0;
    let allReceiptBills = []; // Khai báo ở ngoài để dùng sau
    
    if (activeCheckin && activeCheckin.receiptPaidAt) {
      // Tính expiration date = receiptPaidAt + 3 ngày
      const receiptPaidAt = new Date(activeCheckin.receiptPaidAt);
      const expirationDate = new Date(receiptPaidAt);
      expirationDate.setDate(expirationDate.getDate() + 3);
      
      // Chỉ tính nếu phiếu thu còn hạn (chưa quá 3 ngày)
      if (expirationDate > now) {
        // Tìm tất cả RECEIPT bills đã PAID cho contract này
        // Nếu checkin còn hạn, tính tổng tất cả các receipt bills đã PAID
        // (bao gồm cả các bills từ lần cọc trước khi gia hạn)
        allReceiptBills = await Bill.find({
          contractId: contract._id,
          billType: "RECEIPT",
          status: "PAID"
        });
        
        // Tính tổng amountPaid từ tất cả các receipt bills
        receiptBillPaidAmount = allReceiptBills.reduce((sum, bill) => {
          return sum + (toNum(bill.amountPaid) || 0);
        }, 0);
      }
      // Nếu phiếu thu đã hết hạn (expirationDate <= now), không tính vào tiền cọc (receiptBillPaidAmount = 0)
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
    // Logic đúng:
    // - CONTRACT bill chỉ có 2 lineItems:
    //   1. "Tiền thuê tháng đầu" = 5tr (chờ thanh toán)
    //   2. "Tiền cọc (1 tháng tiền phòng)" = monthlyRent - receiptBillPaidAmount = 5tr - 3tr = 2tr (chờ thanh toán)
    // 
    // - Khoản 1 "Cọc giữ phòng" được frontend lấy từ RECEIPT bill riêng (không nằm trong CONTRACT bill)
    // - amountDue = tổng 2 khoản trong CONTRACT bill = 5tr + 2tr = 7tr
    // - amountPaid = số tiền đã đóng ở phiếu thu (để frontend tính toán) = 3tr
    const monthlyRentNum = toNum(contract.monthlyRent);
    if (!monthlyRentNum || monthlyRentNum <= 0) {
      throw new Error(`Invalid monthlyRent: ${monthlyRentNum}. Contract monthlyRent is required and must be > 0.`);
    }
    const depositRemaining = Math.max(0, monthlyRentNum - receiptBillPaidAmount); // Cọc còn lại phải đóng: 5tr - 3tr = 2tr
    const totalRemainingAmount = monthlyRentNum + depositRemaining; // Tổng 2 khoản trong CONTRACT bill: 5tr + 2tr = 7tr
    
    // Validate các giá trị trước khi tạo bill
    if (isNaN(depositRemaining) || isNaN(totalRemainingAmount) || isNaN(receiptBillPaidAmount)) {
      throw new Error(`Invalid calculation: depositRemaining=${depositRemaining}, totalRemainingAmount=${totalRemainingAmount}, receiptBillPaidAmount=${receiptBillPaidAmount}`);
    }

    // ✅ SỬA LẠI LOGIC: Tiền cọc ở phiếu thu CHỈ được tính vào "Tiền cọc (1 tháng tiền phòng)" (khoản 2)
    // KHÔNG được tính vào "Tiền thuê tháng đầu" (khoản 3)
    // Vì vậy, status LUÔN là UNPAID khi mới tạo, vì khoản 3 (Tiền thuê tháng đầu) chưa thanh toán
    // amountPaid = receiptBillPaidAmount (để frontend biết đã đóng bao nhiêu ở phiếu thu, chỉ tính vào khoản 2)
    let initialStatus = "UNPAID"; // LUÔN là UNPAID vì khoản 3 chưa thanh toán
    let initialAmountPaid = receiptBillPaidAmount; // Số tiền đã đóng ở phiếu thu (chỉ tính vào khoản 2)
    
    // ✅ KHÔNG BAO GIỜ set status = PAID khi mới tạo, vì:
    // - Khoản 3 "Tiền thuê tháng đầu" LUÔN chưa thanh toán khi mới tạo bill CONTRACT
    // - receiptBillPaidAmount chỉ là tiền cọc giữ phòng, không phải tiền thuê tháng đầu

    // Copy payments từ tất cả các receipt bills đã PAID
    let initialPayments = [];
    if (allReceiptBills && allReceiptBills.length > 0) {
      for (const receiptBill of allReceiptBills) {
        if (receiptBill.payments && Array.isArray(receiptBill.payments) && receiptBill.payments.length > 0) {
          try {
            const billPayments = receiptBill.payments.map(p => {
              // Chỉ copy các field hợp lệ, loại bỏ _id và các field không cần thiết
              return {
                paidAt: p.paidAt || new Date(),
                amount: p.amount,
                method: p.method || 'UNKNOWN',
                provider: p.provider || 'UNKNOWN',
                transactionId: p.transactionId || '',
                note: p.note ? `${p.note} (từ phiếu thu cọc giữ phòng)` : "Từ phiếu thu cọc giữ phòng",
                metadata: p.metadata || {}
              };
            });
            initialPayments = initialPayments.concat(billPayments);
          } catch (err) {
            console.warn(`⚠️ Error copying payments from receipt bill ${receiptBill._id}:`, err.message);
            // Bỏ qua bill này nếu có lỗi
          }
        }
      }
    }

    // Log để debug
    console.log(`📋 Creating CONTRACT bill for contract ${contract._id}:`);
    console.log(`   - receiptBillPaidAmount (đã đóng ở phiếu thu): ${receiptBillPaidAmount.toLocaleString("vi-VN")} đ`);
    console.log(`   - monthlyRentNum: ${monthlyRentNum.toLocaleString("vi-VN")} đ`);
    console.log(`   - depositRemaining (Cọc còn lại): ${depositRemaining.toLocaleString("vi-VN")} đ`);
    console.log(`   - totalRemainingAmount (tổng 2 khoản trong CONTRACT bill): ${totalRemainingAmount.toLocaleString("vi-VN")} đ`);
    console.log(`   - initialAmountPaid (để frontend tính toán): ${initialAmountPaid.toLocaleString("vi-VN")} đ`);
    console.log(`   - initialStatus: ${initialStatus}`);
    console.log(`   - initialPayments count: ${initialPayments.length}`);
    
    const contractBill = await Bill.create({
      contractId: contract._id,
      finalContractId: finalContract._id, // Link to this specific FinalContract
      billingDate: new Date(),
      billType: "CONTRACT",
      status: initialStatus,
      lineItems: [
        { 
          item: "Tiền thuê tháng đầu", 
          quantity: 1, 
          unitPrice: contract.monthlyRent, 
          lineTotal: contract.monthlyRent 
        },
        { 
          item: "Tiền cọc (1 tháng tiền phòng)", 
          quantity: 1, 
          unitPrice: toDec(depositRemaining), 
          lineTotal: toDec(depositRemaining) 
        },
      ],
      // amountDue = tổng 2 khoản trong CONTRACT bill (7tr = 5tr + 2tr)
      amountDue: toDec(totalRemainingAmount), // 7tr
      amountPaid: toDec(initialAmountPaid), // 3tr (đã đóng ở phiếu thu, để frontend tính toán)
      payments: initialPayments,
      note: `Bill hợp đồng. Tiền thuê tháng đầu: ${monthlyRentNum.toLocaleString("vi-VN")} đ. Tiền cọc còn lại: ${depositRemaining.toLocaleString("vi-VN")} đ. Đã đóng ở phiếu thu cọc giữ phòng: ${receiptBillPaidAmount.toLocaleString("vi-VN")} đ. Tổng phải đóng: ${totalRemainingAmount.toLocaleString("vi-VN")} đ.`,
    });
    
    console.log(`✅ Created CONTRACT bill ${contractBill._id}`);

    const populated = await FinalContract.findById(finalContract._id)
      .populate("tenantId", "fullName email phone role")
      .populate("roomId", "roomNumber pricePerMonth");

    // Cập nhật checkin để gán finalContractId
    await CheckinModel.updateOne(
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

    // Hủy tất cả bills (CONTRACT và RECEIPT) liên quan đến FinalContract này (chỉ hủy nếu chưa thanh toán)
    const Bill = (await import("../models/bill.model.js")).default;
    
    // Hủy bills CONTRACT
    const contractBills = await Bill.find({
      finalContractId: fc._id,
      billType: "CONTRACT"
    });

    for (const bill of contractBills) {
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
    
    // Hủy bills RECEIPT liên quan đến Contract gốc (nếu có)
    if (fc.originContractId) {
      const originContractId = typeof fc.originContractId === 'object' && fc.originContractId._id
        ? fc.originContractId._id
        : fc.originContractId;
      
      const receiptBills = await Bill.find({
        contractId: originContractId,
        billType: "RECEIPT"
      });
      
      for (const bill of receiptBills) {
        // Chỉ hủy nếu bill chưa thanh toán
        if (bill.status !== "PAID") {
          bill.status = "VOID";
          bill.note = bill.note ? `${bill.note} [Đã hủy do hủy hợp đồng chính thức]` : "Đã hủy do hủy hợp đồng chính thức";
          await bill.save();
          console.log(`✅ Hủy bill RECEIPT ${bill._id} do hủy FinalContract ${fc._id}`);
        } else {
          console.log(`⚠️ Không thể hủy bill RECEIPT ${bill._id} vì đã thanh toán`);
        }
      }
    }

    fc.status = "CANCELED";
    fc.canceledAt = new Date(); // Lưu ngày hủy
    await fc.save();

    // Lấy roomId để xử lý
    const roomId = (fc.roomId && typeof fc.roomId === 'object' && fc.roomId._id)
      ? fc.roomId._id
      : (fc.roomId || null);

    // Hủy Contract ACTIVE liên quan (originContractId) và tất cả Contract ACTIVE trong phòng
    const Contract = (await import("../models/contract.model.js")).default;
    const Checkin = (await import("../models/checkin.model.js")).default;

    if (roomId) {
      // Hủy Contract ACTIVE liên quan (originContractId)
      if (fc.originContractId) {
        const originContractId = typeof fc.originContractId === 'object' && fc.originContractId._id
          ? fc.originContractId._id
          : fc.originContractId;

        const originContract = await Contract.findById(originContractId);
        if (originContract && originContract.status === "ACTIVE") {
          originContract.status = "CANCELED";
          originContract.canceledAt = new Date(); // Lưu ngày hủy
          await originContract.save();
          console.log(`✅ Canceled origin Contract ${originContractId} when canceling FinalContract ${fc._id}`);
        }
      }

      // Hủy tất cả Contract ACTIVE khác trong cùng phòng
      const allActiveContracts = await Contract.find({
        roomId: roomId,
        status: "ACTIVE"
      });

      for (const contract of allActiveContracts) {
        contract.status = "CANCELED";
        contract.canceledAt = new Date(); // Lưu ngày hủy
        
        // Đánh dấu tất cả co-tenants là hết hiệu lực (status = EXPIRED)
        if (contract.coTenants && contract.coTenants.length > 0) {
          contract.coTenants = contract.coTenants.map(ct => {
            if (ct.status === "ACTIVE") {
              ct.status = "EXPIRED";
            }
            return ct;
          });
          console.log(`✅ Marked ${contract.coTenants.filter(ct => ct.status === "EXPIRED").length} co-tenant(s) as EXPIRED when canceling Contract ${contract._id}`);
        }
        
        await contract.save();
        console.log(`✅ Canceled Contract ${contract._id} in room ${roomId} when canceling FinalContract ${fc._id}`);

        // Hủy TẤT CẢ Checkin liên quan đến Contract này (không chỉ status = "CREATED")
        const checkins = await Checkin.find({
          contractId: contract._id,
          status: { $ne: "CANCELED" } // Tìm tất cả checkin chưa bị hủy
        });

        for (const checkin of checkins) {
          checkin.status = "CANCELED";
          await checkin.save();
          console.log(`✅ Canceled Checkin ${checkin._id} when canceling Contract ${contract._id}`);

          // Hủy receipt bill nếu chưa thanh toán
          if (checkin.receiptBillId) {
            const receiptBill = await Bill.findById(checkin.receiptBillId);
            if (receiptBill && receiptBill.status !== "PAID") {
              receiptBill.status = "VOID";
              receiptBill.note = receiptBill.note
                ? `${receiptBill.note} [Đã hủy do hủy hợp đồng chính thức]`
                : "Đã hủy do hủy hợp đồng chính thức";
              await receiptBill.save();
              console.log(`✅ Canceled receipt bill ${receiptBill._id} when canceling Checkin ${checkin._id}`);
            }
          }
        }
        
        // ✅ SỬA LẠI: Hủy TẤT CẢ RECEIPT bills liên quan đến Contract này (không chỉ qua checkin.receiptBillId)
        // Vì có thể có RECEIPT bills được tạo từ nơi khác hoặc không được link qua checkin
        const allReceiptBills = await Bill.find({
          contractId: contract._id,
          billType: "RECEIPT",
          status: { $ne: "PAID" } // Chỉ hủy nếu chưa thanh toán
        });
        
        for (const receiptBill of allReceiptBills) {
          receiptBill.status = "VOID";
          receiptBill.note = receiptBill.note
            ? `${receiptBill.note} [Đã hủy do hủy hợp đồng chính thức]`
            : "Đã hủy do hủy hợp đồng chính thức";
          await receiptBill.save();
          console.log(`✅ Canceled receipt bill ${receiptBill._id} when canceling Contract ${contract._id}`);
        }
      }
    }

    // Cập nhật trạng thái phòng: khi hủy hợp đồng, phòng về trạng thái trống và số người ở về 0
    try {
      const Room = (await import("../models/room.model.js")).default;
      
      if (roomId) {
        // Khi hủy hợp đồng, phòng luôn về trạng thái trống và số người ở về 0
        await Room.findByIdAndUpdate(roomId, {
          status: "AVAILABLE",
          occupantCount: 0
        });
        console.log(`✅ Updated room ${roomId} status to AVAILABLE and occupantCount to 0 (after canceling FinalContract ${fc._id})`);
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
    const { extensionMonths, newRentPrice } = req.body;

    // Validate
    if (!extensionMonths || extensionMonths <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số tháng gia hạn không hợp lệ (phải > 0)"
      });
    }

    if (extensionMonths > 36) {
      return res.status(400).json({
        success: false,
        message: "Không thể gia hạn quá 36 tháng"
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

    // Tính thời hạn hợp đồng hiện tại (từ startDate đến endDate)
    const startDate = new Date(finalContract.startDate);
    const currentEndDate = new Date(finalContract.endDate);
    const currentDurationMonths = (currentEndDate.getFullYear() - startDate.getFullYear()) * 12 
      + (currentEndDate.getMonth() - startDate.getMonth());
    
    // Validate: Nếu thời hạn hợp đồng hiện tại >= 36 tháng thì không thể gia hạn thêm
    if (currentDurationMonths >= 36) {
      return res.status(400).json({
        success: false,
        message: `Không thể gia hạn hợp đồng. Thời hạn hợp đồng hiện tại đã đạt tối đa 36 tháng (${currentDurationMonths} tháng)`
      });
    }

    // Validate: Nếu gia hạn thêm sẽ vượt quá 36 tháng tổng cộng
    const totalDurationAfterExtension = currentDurationMonths + parseInt(extensionMonths);
    if (totalDurationAfterExtension > 36) {
      return res.status(400).json({
        success: false,
        message: `Không thể gia hạn thêm ${extensionMonths} tháng. Thời hạn hợp đồng sau gia hạn sẽ là ${totalDurationAfterExtension} tháng, vượt quá giới hạn 36 tháng. Số tháng tối đa có thể gia hạn: ${36 - currentDurationMonths} tháng`
      });
    }

    // Tính endDate mới
    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + parseInt(extensionMonths));

    // Lưu endDate cũ và giá thuê cũ để log
    const oldEndDate = finalContract.endDate;
    const oldRentPrice = toNum(finalContract.monthlyRent);

    // Cập nhật endDate
    finalContract.endDate = newEndDate;

    // Cập nhật giá thuê mới nếu có
    if (newRentPrice !== null && newRentPrice !== undefined && newRentPrice > 0) {
      finalContract.monthlyRent = toDec(newRentPrice);
      // Cập nhật pricingSnapshot nếu có
      if (finalContract.pricingSnapshot) {
        finalContract.pricingSnapshot.monthlyRent = toDec(newRentPrice);
      }
    }

    // Lưu lịch sử gia hạn vào metadata
    if (!finalContract.metadata) finalContract.metadata = {};
    if (!finalContract.metadata.extensions) finalContract.metadata.extensions = [];

    const extensionRecord = {
      extendedAt: new Date(),
      extendedBy: req.user._id,
      previousEndDate: oldEndDate,
      newEndDate: newEndDate,
      extensionMonths: parseInt(extensionMonths)
    };

    // Thêm thông tin giá thuê mới nếu có thay đổi
    if (newRentPrice !== null && newRentPrice !== undefined && newRentPrice > 0 && newRentPrice !== oldRentPrice) {
      extensionRecord.previousRentPrice = oldRentPrice;
      extensionRecord.newRentPrice = newRentPrice;
    }

    finalContract.metadata.extensions.push(extensionRecord);

    await finalContract.save();

    // Cập nhật Contract gốc (nếu có)
    if (finalContract.originContractId) {
      try {
        const updateData = { endDate: newEndDate };
        // Cập nhật giá thuê nếu có thay đổi
        if (newRentPrice !== null && newRentPrice !== undefined && newRentPrice > 0 && newRentPrice !== oldRentPrice) {
          updateData.monthlyRent = toDec(newRentPrice);
        }
        await Contract.findByIdAndUpdate(finalContract.originContractId, updateData);
        console.log(`✅ Updated origin Contract ${finalContract.originContractId} endDate to ${newEndDate}${updateData.monthlyRent ? ` and monthlyRent to ${newRentPrice}` : ''}`);
      } catch (err) {
        console.warn("Cannot update origin Contract endDate:", err);
      }
    }

    // Cập nhật giá phòng trong Room model nếu có thay đổi giá
    if (newRentPrice !== null && newRentPrice !== undefined && newRentPrice > 0 && newRentPrice !== oldRentPrice && finalContract.roomId) {
      try {
        const Room = (await import("../models/room.model.js")).default;
        await Room.findByIdAndUpdate(finalContract.roomId, {
          pricePerMonth: toDec(newRentPrice)
        });
        console.log(`✅ Updated Room ${finalContract.roomId} pricePerMonth to ${newRentPrice}`);
      } catch (err) {
        console.warn("Cannot update Room pricePerMonth:", err);
      }
    }

    const rentPriceChanged = newRentPrice !== null && newRentPrice !== undefined && newRentPrice > 0 && newRentPrice !== oldRentPrice;
    const logMessage = rentPriceChanged 
      ? `✅ Extended FinalContract ${id}: ${oldEndDate} → ${newEndDate} (+${extensionMonths} months), Rent: ${oldRentPrice} → ${newRentPrice}`
      : `✅ Extended FinalContract ${id}: ${oldEndDate} → ${newEndDate} (+${extensionMonths} months)`;
    
    console.log(logMessage);

    const extensionData = {
      previousEndDate: oldEndDate,
      newEndDate: newEndDate,
      extensionMonths: parseInt(extensionMonths),
      extendedAt: new Date(),
      extendedBy: req.user.email || req.user._id
    };

    if (rentPriceChanged) {
      extensionData.previousRentPrice = oldRentPrice;
      extensionData.newRentPrice = newRentPrice;
    }

    return res.status(200).json({
      success: true,
      message: rentPriceChanged 
        ? `Gia hạn hợp đồng thành công thêm ${extensionMonths} tháng và cập nhật giá thuê mới ${newRentPrice.toLocaleString('vi-VN')} VNĐ/tháng`
        : `Gia hạn hợp đồng thành công thêm ${extensionMonths} tháng`,
      data: {
        finalContract: formatFinalContract(finalContract),
        extension: extensionData
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

// Rent Additional Room - Thuê thêm phòng cho tenant hiện tại
// POST /api/final-contracts/rent-additional-room
export const rentAdditionalRoom = async (req, res) => {
  try {
    const { tenantId, roomId, startDate, endDate, depositAmount } = req.body;

    // Validate input
    if (!tenantId || !roomId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "tenantId, roomId, startDate, and endDate are required"
      });
    }

    // Kiểm tra tenant có tồn tại không
    const User = (await import("../models/user.model.js")).default;
    const tenant = await User.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    // ✅ Lấy snapshot CCCD/địa chỉ từ lần check-in trước (vì User model không lưu identity/address)
    const CheckinSnapshotModel = (await import("../models/checkin.model.js")).default;
    const latestSnapshotCheckin = await CheckinSnapshotModel.findOne({
      tenantId: tenantId,
      status: { $ne: "CANCELED" },
      $or: [
        { "tenantSnapshot.identityNo": { $exists: true, $ne: "" } },
        { "tenantSnapshot.address": { $exists: true, $ne: "" } },
      ],
    })
      .sort({ createdAt: -1 })
      .select("tenantSnapshot");
    const prevSnapshot = latestSnapshotCheckin?.tenantSnapshot || {};

    // Kiểm tra tenant đã có ít nhất 1 hợp đồng SIGNED chưa
    const existingContract = await FinalContract.findOne({
      tenantId: tenantId,
      status: "SIGNED"
    });

    if (!existingContract) {
      return res.status(400).json({
        success: false,
        message: "Tenant chưa có hợp đồng nào được ký. Vui lòng tạo hợp đồng đầu tiên qua quy trình thông thường."
      });
    }

    // Kiểm tra phòng có tồn tại và trống không
    const Room = (await import("../models/room.model.js")).default;
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    if (room.status !== "AVAILABLE") {
      return res.status(400).json({
        success: false,
        message: `Phòng ${room.roomNumber} không còn trống (status: ${room.status})`
      });
    }

    // Tạo Contract mới
    const contract = await Contract.create({
      tenantId: tenantId,
      roomId: roomId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      deposit: toDec(depositAmount || room.pricePerMonth), // Mặc định cọc = 1 tháng tiền phòng
      monthlyRent: room.pricePerMonth,
      pricingSnapshot: {
        roomNumber: room.roomNumber,
        monthlyRent: room.pricePerMonth,
        deposit: toDec(depositAmount || room.pricePerMonth),
      },
      status: "ACTIVE",
      isAdditionalRoom: true, // Đánh dấu là phòng thuê thêm
    });

    // Tạo FinalContract
    const finalContract = await FinalContract.create({
      tenantId: tenantId,
      roomId: roomId,
      originContractId: contract._id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      deposit: toDec(depositAmount || room.pricePerMonth),
      monthlyRent: room.pricePerMonth,
      pricingSnapshot: {
        roomNumber: room.roomNumber,
        monthlyRent: room.pricePerMonth,
        deposit: toDec(depositAmount || room.pricePerMonth),
      },
      terms: `Hợp đồng thuê thêm phòng ${room.roomNumber} cho khách hàng ${tenant.fullName}. Thời hạn: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}.`,
      status: "DRAFT",
    });

    // Tạo Bill CONTRACT (Tiền thuê tháng đầu + Tiền cọc)
    const monthlyRentNum = toNum(room.pricePerMonth);
    const depositNum = depositAmount || monthlyRentNum;
    const totalAmount = monthlyRentNum + depositNum;

    const bill = await Bill.create({
      contractId: contract._id,
      finalContractId: finalContract._id,
      billingDate: new Date(),
      billType: "CONTRACT",
      status: "UNPAID",
      lineItems: [
        {
          item: `Tiền thuê tháng đầu - Phòng ${room.roomNumber}`,
          quantity: 1,
          unitPrice: room.pricePerMonth,
          lineTotal: room.pricePerMonth
        },
        {
          item: `Tiền cọc - Phòng ${room.roomNumber}`,
          quantity: 1,
          unitPrice: toDec(depositNum),
          lineTotal: toDec(depositNum)
        },
      ],
      amountDue: toDec(totalAmount),
      amountPaid: toDec(0),
      note: `Hợp đồng thuê thêm phòng ${room.roomNumber} cho ${tenant.fullName}`,
    });

    // ✅ SỬA LẠI: Kiểm tra xem đã có checkin ACTIVE cho phòng này chưa
    // Nếu có, hủy checkin cũ và RECEIPT bills liên quan trước khi tạo mới
    const Checkin = (await import("../models/checkin.model.js")).default;
    // Bill đã được import ở đầu file
    
    // Tìm tất cả checkin ACTIVE (chưa bị hủy) cho phòng này
    // Chỉ hủy checkin liên quan đến hợp đồng thuê thêm phòng (có finalContractId với status DRAFT hoặc chưa SIGNED)
    const existingCheckins = await Checkin.find({
      roomId: roomId,
      status: { $ne: "CANCELED" },
      finalContractId: { $exists: true, $ne: null } // Chỉ tìm checkin có finalContractId (hợp đồng thuê thêm phòng)
    });
    
    // Hủy tất cả checkin cũ và RECEIPT bills liên quan
    // Chỉ hủy checkin có FinalContract chưa SIGNED (DRAFT hoặc CANCELED)
    for (const existingCheckin of existingCheckins) {
      // Kiểm tra FinalContract status - query trực tiếp thay vì populate
      if (existingCheckin.finalContractId) {
        const finalContractId = typeof existingCheckin.finalContractId === 'object' 
          ? existingCheckin.finalContractId._id 
          : existingCheckin.finalContractId;
        
        const finalContract = await FinalContract.findById(finalContractId).select('status');
        if (finalContract && finalContract.status === "SIGNED") {
          console.log(`⚠️ Skipping Checkin ${existingCheckin._id} because FinalContract is SIGNED`);
          continue; // Không hủy checkin của hợp đồng đã SIGNED
        }
      }
      
      // Hủy checkin
      existingCheckin.status = "CANCELED";
      await existingCheckin.save();
      console.log(`✅ Canceled existing Checkin ${existingCheckin._id} before creating new one for room ${room.roomNumber}`);
      
      // Hủy RECEIPT bills liên quan nếu chưa thanh toán
      if (existingCheckin.receiptBillId) {
        const receiptBill = await Bill.findById(existingCheckin.receiptBillId);
        if (receiptBill && receiptBill.status !== "PAID") {
          receiptBill.status = "VOID";
          receiptBill.note = receiptBill.note
            ? `${receiptBill.note} [Đã hủy do tạo hợp đồng thuê thêm phòng mới]`
            : "Đã hủy do tạo hợp đồng thuê thêm phòng mới";
          await receiptBill.save();
          console.log(`✅ Canceled receipt bill ${receiptBill._id} when creating new contract for room ${room.roomNumber}`);
        }
      }
      
      // Hủy tất cả RECEIPT bills khác liên quan đến contract của checkin này
      if (existingCheckin.contractId) {
        const contractId = typeof existingCheckin.contractId === 'object' 
          ? existingCheckin.contractId._id 
          : existingCheckin.contractId;
        
        const allReceiptBills = await Bill.find({
          contractId: contractId,
          billType: "RECEIPT",
          status: { $ne: "PAID" }
        });
        
        for (const receiptBill of allReceiptBills) {
          receiptBill.status = "VOID";
          receiptBill.note = receiptBill.note
            ? `${receiptBill.note} [Đã hủy do tạo hợp đồng thuê thêm phòng mới]`
            : "Đã hủy do tạo hợp đồng thuê thêm phòng mới";
          await receiptBill.save();
          console.log(`✅ Canceled receipt bill ${receiptBill._id} when creating new contract for room ${room.roomNumber}`);
        }
      }
    }
    
    // Tính số tháng thuê
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    
    // Tạo Checkin record mới
    await Checkin.create({
      tenantId: tenantId, // ✅ gắn người thuê để hiển thị ở admin/checkins
      contractId: contract._id,
      finalContractId: finalContract._id,
      roomId: roomId,
      staffId: req.user._id, // Admin đang tạo
      durationMonths: durationMonths,
      status: "CREATED",
      checkinDate: new Date(startDate),
      // ✅ set tiền/ snapshot để UI không bị N/A (và không phụ thuộc việc load users ở FE)
      deposit: toDec(depositNum),
      monthlyRent: room.pricePerMonth,
      tenantSnapshot: {
        fullName: tenant?.fullName || "",
        phone: tenant?.phone || "",
        email: tenant?.email || "",
        identityNo: prevSnapshot?.identityNo || "",
        address: prevSnapshot?.address || "",
        note: "Thuê thêm phòng",
      },
    });

    // Cập nhật Room: status = OCCUPIED, occupantCount = 1 (chỉ người thuê chính)
    await Room.findByIdAndUpdate(roomId, {
      status: "OCCUPIED",
      occupantCount: 1,
    });

    console.log(`✅ Created additional room contract: FinalContract ${finalContract._id}, Bill ${bill._id}`);

    // Populate data
    const populated = await FinalContract.findById(finalContract._id)
      .populate("tenantId", "fullName email phone role")
      .populate("roomId", "roomNumber pricePerMonth");

    // 📝 Log
    await logService.logCreate({
      entity: 'FINALCONTRACT',
      entityId: finalContract._id,
      actorId: req.user?._id,
      data: {
        roomId: room.roomNumber,
        tenantId: tenantId,
        isAdditionalRoom: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Tạo hợp đồng thuê thêm phòng ${room.roomNumber} thành công`,
      data: {
        finalContract: formatFinalContract(populated),
        contract: contract,
        bill: bill,
      },
    });
  } catch (error) {
    console.error("rentAdditionalRoom error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo hợp đồng thuê thêm phòng",
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
  rentAdditionalRoom,
};