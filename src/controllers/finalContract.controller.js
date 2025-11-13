import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import FinalContract from "../models/finalContract.model.js";
import Contract from "../models/contract.model.js";
import Bill from "../models/bill.model.js";

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
    const isImageByUrl = base.includes("/image/upload/");
    const isRaw = file?.resource_type ? file.resource_type === "raw" : isRawByUrl;
    const isImage = file?.resource_type ? file.resource_type === "image" : isImageByUrl;
    // Cloudinary expects flags in the URL PATH, not query string.
    // Build a friendly filename WITH extension when available (prevents wrong app association on other machines)
    const basename = (file?.public_id || "download").split("/").pop();
    // Determine extension
    let ext = "";
    if (file?.format) {
      ext = `.${file.format}`;
    } else if (isRaw) {
      ext = ".pdf";
    } else {
      const match = base.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      ext = match ? `.${match[1]}` : "";
    }
    const filenameWithExt = `${basename}${ext}`;

    // Download: force attachment (do not include extension in flag param to avoid 400)
    const downloadUrl = base.replace("/upload/", "/upload/fl_attachment/");

    // Inline view:
    // - Images: base URL already delivers inline → reuse base
    // - PDFs (raw): use preview image URL for inline viewing
    // Inline: unify behavior — always equal to base
    const inlineUrl = base;

    return { ...file, viewUrl: base, downloadUrl, inlineUrl };
  };
  if (Array.isArray(obj.images)) {
    obj.images = obj.images.map(addFileLinks);
  }
  if (Array.isArray(obj.cccdFiles)) {
    obj.cccdFiles = obj.cccdFiles.map(addFileLinks);
  }
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

    // Create bill_contract for the first month rent
    // Mỗi FinalContract có 1 bill CONTRACT riêng
    await Bill.create({
      contractId: contract._id,
      finalContractId: finalContract._id, // Link to this specific FinalContract
      billingDate: new Date(),
      billType: "CONTRACT",
      status: "UNPAID",
      lineItems: [
        { item: "Tiền thuê tháng đầu", quantity: 1, unitPrice: contract.monthlyRent, lineTotal: contract.monthlyRent },
      ],
      amountDue: contract.monthlyRent,
      amountPaid: toDec(0),
      payments: [],
      note: `Bill hợp đồng (tháng đầu) cho FinalContract ${finalContract._id}`,
    });

    const populated = await FinalContract.findById(finalContract._id)
      .populate("tenantId", "fullName email phone role")
      .populate("roomId", "roomNumber pricePerMonth");

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

    return res.status(200).json({ success: true, message: "Uploaded signed contract files and finalized", data: formatFinalContract(fc) });
  } catch (err) {
    console.error("uploadFiles error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export const uploadCCCDFile = async (req, res) => {
  try {
    const { id } = req.params;
    const fc = await FinalContract.findById(id);
    if (!fc) return res.status(404).json({ success: false, message: "Final contract not found" });

    // Only admin/staff can upload CCCD (tenant cannot upload)
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) return res.status(403).json({ success: false, message: "Forbidden" });

    const files = (req.files || []).map((f) => ({
      url: f.url || f.path,
      secure_url: f.secure_url || f.path || f.url,
      public_id: f.public_id || f.filename,
      resource_type: f.resource_type,
      format: f.format,
      bytes: f.bytes || f.size,
    }));

    fc.cccdFiles = [...(fc.cccdFiles || []), ...files];
    await fc.save();

    return res.status(200).json({ success: true, message: "Uploaded CCCD files", data: formatFinalContract(fc) });
  } catch (err) {
    console.error("uploadCCCDFile error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// Stream a file inline (primarily for PDFs uploaded as raw)
export const viewFileInline = async (req, res) => {
  try {
    const { id, index } = req.params;
    const idx = parseInt(index, 10);
    const fc = await FinalContract.findById(id);
    if (!fc) return res.status(404).json({ success: false, message: "Final contract not found" });

    const isAdmin = req.user?.role === "ADMIN";
    const isOwnerTenant = fc.tenantId?.toString() === req.user?._id?.toString();
    if (!isAdmin && !isOwnerTenant) return res.status(403).json({ success: false, message: "Forbidden" });

    const files = fc.images || [];
    if (idx < 0 || idx >= files.length) {
      return res.status(404).json({ success: false, message: "File not found" });
    }
    const file = files[idx];
    const base = file?.secure_url || file?.url;
    if (!base) return res.status(404).json({ success: false, message: "File URL not available" });

    // Only proxy PDFs (raw)
    const isRawByUrl = base.includes("/raw/upload/") || file?.resource_type === "raw";
    if (!isRawByUrl) {
      // For non-PDFs, redirect to base view URL
      return res.redirect(base);
    }

    // Stream from Cloudinary and override headers for inline viewing
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

    const formattedContracts = finalContracts.map(formatFinalContract);

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
    collectIds(fc.cccdFiles);

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

    const isImages = type === "images";
    const targetArr = isImages ? (fc.images || []) : (fc.cccdFiles || []);
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
    if (isImages) {
      fc.images.splice(idx, 1);
    } else {
      fc.cccdFiles.splice(idx, 1);
    }
    await fc.save();

    return res.status(200).json({ success: true, message: "File deleted", data: { resourceType, publicId, cloudinaryDeleted: deleted } });
  } catch (err) {
    console.error("deleteFileFromFinalContract error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export default {
  createFromContract,
  getFinalContractById,
  getAllFinalContracts,
  getMyFinalContracts,
  uploadFiles,
  uploadCCCDFile,
  approveOwnerSigned,
  viewFileInline,
  getRemainingAmount,
  deleteFinalContractById,
  deleteFileFromFinalContract,
  assignTenantToFinalContract,
};