// src/controllers/room.controller.js
import Room from "../models/room.model.js";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

/**
 * Helper convert Decimal128 sang number
 */
const convertDecimal128 = (value) => {
    if (value === null || value === undefined) return null;
    return parseFloat(value.toString());
};

/**
 * Format room object cho frontend
 */
const formatRoom = (room) => {
  const obj = room.toObject();
  return {
    _id: obj._id,
    roomNumber: obj.roomNumber,
    type: obj.type,
    pricePerMonth: convertDecimal128(obj.pricePerMonth),
    areaM2: obj.areaM2,
    floor: obj.floor,
    status: obj.status,
    image: obj.coverImageUrl || (obj.images?.[0]?.url || ""),
    images: Array.isArray(obj.images) ? obj.images.map(i => i.url || "") : [],
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt || new Date().toISOString(),
    currentContractSummary: obj.currentContractSummary
      ? {
          contractId: obj.currentContractSummary.contractId || "",
          tenantName: obj.currentContractSummary.tenantName || "",
          startDate: obj.currentContractSummary.startDate || "",
          endDate: obj.currentContractSummary.endDate || "",
          monthlyRent: convertDecimal128(obj.currentContractSummary.monthlyRent),
        }
      : undefined,
  };
};

/**
 * Lấy tất cả phòng (có thể filter theo status/type)
 */
export const getAllRooms = async (req, res) => {
    try {
        const { status, type, q, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        
        const filter = {};
        if (status) filter.status = status;
        if (type) filter.type = type;
        if (q) filter.roomNumber = { $regex: q, $options: "i" };

        const rooms = await Room.find(filter)
            .sort({ roomNumber: 1 })
            .limit(limit)
            .skip(skip);

        const total = await Room.countDocuments(filter);

        // Đếm số người ở cho mỗi phòng (từ Contract)
        const Contract = (await import("../models/contract.model.js")).default;
        const Bill = (await import("../models/bill.model.js")).default;
        const Checkin = (await import("../models/checkin.model.js")).default;
        
        const roomsData = await Promise.all(rooms.map(async (room) => {
            const formatted = formatRoom(room);
            
            // Nếu phòng đã được cọc (DEPOSITED) thì occupantCount = 0
            if (room.status === "DEPOSITED") {
                formatted.occupantCount = 0;
            } else {
                // Kiểm tra xem có receipt bill chưa thanh toán không
                // Nếu có receipt chưa thanh toán (UNPAID hoặc PENDING_CASH_CONFIRM), thì occupantCount = 0
                const checkinWithUnpaidReceipt = await Checkin.findOne({
                    roomId: room._id,
                    status: "CREATED", // Chưa hoàn thành
                    receiptBillId: { $exists: true }
                });
                
                if (checkinWithUnpaidReceipt && checkinWithUnpaidReceipt.receiptBillId) {
                    const receiptBill = await Bill.findById(checkinWithUnpaidReceipt.receiptBillId);
                    if (receiptBill && (receiptBill.status === "UNPAID" || receiptBill.status === "PENDING_CASH_CONFIRM")) {
                        // Có receipt chưa thanh toán → occupantCount = 0
                        formatted.occupantCount = 0;
                    } else {
                        // Receipt đã thanh toán → tính từ contract
                        const activeContract = await Contract.findOne({
                            roomId: room._id,
                            status: "ACTIVE"
                        });
                        
                        if (activeContract) {
                            const coTenantsCount = activeContract.coTenants?.filter(ct => !ct.leftAt).length || 0;
                            formatted.occupantCount = 1 + coTenantsCount;
                        } else {
                            formatted.occupantCount = room.occupantCount || 0;
                        }
                    }
                } else {
                    // Không có checkin hoặc đã hoàn thành → tính từ contract
                    const activeContract = await Contract.findOne({
                        roomId: room._id,
                        status: "ACTIVE"
                    });
                    
                    if (activeContract) {
                        // Đếm: 1 người thuê chính + số người ở cùng (chưa rời đi)
                        const coTenantsCount = activeContract.coTenants?.filter(ct => !ct.leftAt).length || 0;
                        formatted.occupantCount = 1 + coTenantsCount; // 1 = người thuê chính
                    } else {
                        formatted.occupantCount = room.occupantCount || 0;
                    }
                }
            }
            
            return formatted;
        }));

        res.status(200).json({
            message: "Lấy danh sách phòng thành công",
            success: true,
            data: roomsData,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                limit: parseInt(limit),
            },
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi lấy danh sách phòng",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Lấy room theo id
 */
export const getRoomById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ 
                message: "ID phòng không hợp lệ",
                success: false 
            });

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ 
            message: "Không tìm thấy phòng",
            success: false 
        });

        const formattedRoom = formatRoom(room);

        // Lấy utilities (nội thất) của phòng - ẩn các item bị hỏng ở client
        const Util = (await import("../models/util.model.js")).default;
        const utils = await Util.find({ room: id, isActive: true, condition: { $ne: "broken" } })
            .sort({ createdAt: -1 });
        
        // Format utilities
        const formatUtil = (util) => {
            const obj = util.toObject ? util.toObject() : util;
            return {
                _id: obj._id,
                name: obj.name,
                condition: obj.condition,
                description: obj.description || "",
            };
        };

        formattedRoom.utilities = utils.map(formatUtil);

        // Lấy phiếu thu (checkins) liên quan đến phòng này
        const Checkin = (await import("../models/checkin.model.js")).default;
        const checkins = await Checkin.find({ roomId: id })
            .populate("tenantId", "fullName email phone")
            .populate("staffId", "fullName email")
            .populate("receiptBillId")
            .populate("contractId")
            .sort({ createdAt: -1 });

        // Format checkins
        const formatCheckin = (checkin) => {
            const obj = checkin.toObject ? checkin.toObject() : checkin;
            return {
                _id: obj._id,
                tenantId: obj.tenantId,
                staffId: obj.staffId,
                roomId: obj.roomId,
                contractId: obj.contractId,
                receiptBillId: obj.receiptBillId,
                checkinDate: obj.checkinDate,
                durationMonths: obj.durationMonths,
                deposit: convertDecimal128(obj.deposit),
                monthlyRent: convertDecimal128(obj.monthlyRent),
                tenantSnapshot: obj.tenantSnapshot,
                cccdImages: obj.cccdImages,
                notes: obj.notes,
                attachments: obj.attachments,
                status: obj.status,
                depositDisposition: obj.depositDisposition,
                receiptPaidAt: obj.receiptPaidAt,
                createdAt: obj.createdAt,
                updatedAt: obj.updatedAt,
            };
        };

        formattedRoom.checkins = checkins.map(formatCheckin);

        // Lấy hợp đồng (contracts) liên quan đến phòng này
        const Contract = (await import("../models/contract.model.js")).default;
        const contracts = await Contract.find({ roomId: id })
            .populate("tenantId", "fullName email phone")
            .sort({ createdAt: -1 });

        // Format contracts
        const formatContract = (contract) => {
            const obj = contract.toObject ? contract.toObject() : contract;
            return {
                _id: obj._id,
                tenantId: obj.tenantId,
                roomId: obj.roomId,
                startDate: obj.startDate,
                endDate: obj.endDate,
                deposit: convertDecimal128(obj.deposit),
                monthlyRent: convertDecimal128(obj.monthlyRent),
                status: obj.status,
                pricingSnapshot: obj.pricingSnapshot,
                tenantSnapshot: obj.tenantSnapshot,
                depositRefunded: obj.depositRefunded,
                depositRefund: obj.depositRefund,
                coTenants: obj.coTenants,
                createdAt: obj.createdAt,
                updatedAt: obj.updatedAt,
            };
        };

        formattedRoom.contracts = contracts.map(formatContract);

        // Lấy hóa đơn (bills) liên quan đến phòng này (qua contracts)
        const Bill = (await import("../models/bill.model.js")).default;
        const contractIds = contracts.map(c => c._id);
        const bills = await Bill.find({ 
            contractId: { $in: contractIds }
        })
            .populate("contractId")
            .sort({ createdAt: -1 });

        // Format bills
        const formatBill = (bill) => {
            const obj = bill.toObject ? bill.toObject() : bill;
            return {
                _id: obj._id,
                contractId: obj.contractId,
                billingDate: obj.billingDate,
                billType: obj.billType,
                status: obj.status,
                lineItems: obj.lineItems?.map(item => {
                    const plainItem = item.toObject ? item.toObject() : item;
                    return {
                        ...plainItem,
                        unitPrice: convertDecimal128(plainItem.unitPrice),
                        lineTotal: convertDecimal128(plainItem.lineTotal),
                    };
                }) || [],
                amountDue: convertDecimal128(obj.amountDue),
                amountPaid: convertDecimal128(obj.amountPaid),
                payments: obj.payments?.map(payment => ({
                    ...payment,
                    amount: convertDecimal128(payment.amount),
                })) || [],
                note: obj.note,
                createdAt: obj.createdAt,
                updatedAt: obj.updatedAt,
            };
        };

        formattedRoom.bills = bills.map(formatBill);

        // Lấy hóa đơn phiếu thu (receipt bills) từ checkins
        const receiptBillIds = checkins
            .filter(c => c.receiptBillId)
            .map(c => c.receiptBillId);
        
        if (receiptBillIds.length > 0) {
            const receiptBills = await Bill.find({ 
                _id: { $in: receiptBillIds }
            })
                .populate("contractId")
                .sort({ createdAt: -1 });
            
            formattedRoom.receiptBills = receiptBills.map(formatBill);
        } else {
            formattedRoom.receiptBills = [];
        }

        res.status(200).json({
            message: "Lấy thông tin phòng thành công",
            success: true,
            data: formattedRoom,
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi lấy thông tin phòng",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Tạo room mới
 */
export const createRoom = async (req, res) => {
    try {
        const {
            roomNumber,
            type,
            pricePerMonth,
            areaM2,
            floor,
            status,
            currentContractSummary,
        } = req.body;

        if (!roomNumber || !pricePerMonth) {
            return res.status(400).json({ 
                message: "Số phòng và giá thuê là bắt buộc",
                success: false 
            });
        }

        // Kiểm tra trùng tên phòng
        const existingRoom = await Room.findOne({ 
            roomNumber: roomNumber.trim() 
        });
        if (existingRoom) {
            return res.status(400).json({ 
                message: `Số phòng "${roomNumber}" đã tồn tại. Vui lòng chọn số phòng khác.`,
                success: false 
            });
        }

        let uploadedImages = [];
        if (Array.isArray(req.files)) {
            uploadedImages = req.files.map((f) => ({ url: f.path, publicId: f.filename }));
        } else if (req.files && (req.files.images || req.files.image)) {
            const list = [
                ...(Array.isArray(req.files.images) ? req.files.images : []),
                ...(Array.isArray(req.files.image) ? req.files.image : []),
            ];
            uploadedImages = list.map((f) => ({ url: f.path, publicId: f.filename }));
        }

        let bodyImages = [];
        if (Array.isArray(req.body?.images)) {
            try {
                if (typeof req.body.images === "string") {
                    const parsed = JSON.parse(req.body.images);
                    if (Array.isArray(parsed)) req.body.images = parsed;
                }
            } catch {}
            bodyImages = (Array.isArray(req.body.images) ? req.body.images : [])
                .map((it) => (typeof it === "string" ? { url: it } : it))
                .filter((it) => it && it.url);
        } else if (typeof req.body?.images === "string") {
            try {
                const parsed = JSON.parse(req.body.images);
                if (Array.isArray(parsed)) {
                    bodyImages = parsed
                        .map((it) => (typeof it === "string" ? { url: it } : it))
                        .filter((it) => it && it.url);
                }
            } catch {}
        }

        const room = new Room({
            roomNumber,
            type,
            pricePerMonth,
            areaM2,
            floor,
            status,
            currentContractSummary,
            images: [...bodyImages, ...uploadedImages],
            coverImageUrl: (bodyImages?.[0]?.url) || (uploadedImages?.[0]?.url),
        });

        const saved = await room.save();

        res.status(201).json({
            message: "Tạo phòng thành công",
            success: true,
            data: formatRoom(saved),
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi tạo phòng",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Update room
 */
export const updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ 
                message: "ID phòng không hợp lệ",
                success: false 
            });

        // Kiểm tra trùng tên phòng nếu có cập nhật roomNumber
        if (req.body.roomNumber) {
            const existingRoom = await Room.findOne({ 
                roomNumber: req.body.roomNumber.trim(),
                _id: { $ne: id } // Loại trừ phòng hiện tại
            });
            if (existingRoom) {
                return res.status(400).json({ 
                    message: `Số phòng "${req.body.roomNumber}" đã tồn tại. Vui lòng chọn số phòng khác.`,
                    success: false 
                });
            }
        }

        const update = { ...req.body };
        delete update._id;

        // Xử lý ảnh upload mới
        let uploadedImages = [];
        if (Array.isArray(req.files)) {
            uploadedImages = req.files.map((f) => ({ url: f.path, publicId: f.filename }));
        } else if (req.files && (req.files.images || req.files.image)) {
            const list = [
                ...(Array.isArray(req.files.images) ? req.files.images : []),
                ...(Array.isArray(req.files.image) ? req.files.image : []),
            ];
            uploadedImages = list.map((f) => ({ url: f.path, publicId: f.filename }));
        }

        // Parse danh sách ảnh cũ từ body.existingImages (ảnh cũ giữ lại)
        let existingImages = [];
        if (req.body?.existingImages) {
            try {
                const parsed = typeof req.body.existingImages === "string" 
                    ? JSON.parse(req.body.existingImages) 
                    : req.body.existingImages;
                
                if (Array.isArray(parsed)) {
                    existingImages = parsed
                        .map((it) => (typeof it === "string" ? { url: it } : it))
                        .filter((it) => it && it.url);
                }
            } catch (e) {
                console.warn("Failed to parse existingImages:", e);
            }
        }

        // Logic xử lý ảnh:
        // - Nếu có existingImages → REPLACE với danh sách này + ảnh mới upload
        // - Nếu không có existingImages nhưng có upload mới → CHỈ thêm ảnh mới (merge)
        if (req.body?.existingImages !== undefined) {
            // User đã gửi danh sách ảnh cũ (có thể rỗng nếu xóa hết) → REPLACE
            update.images = [...existingImages, ...uploadedImages];
            
            // Cập nhật coverImageUrl
            if (update.images.length > 0) {
                update.coverImageUrl = update.images[0].url;
            } else {
                update.coverImageUrl = null; // Xóa hết ảnh
            }
        } else if (uploadedImages.length > 0) {
            // Không có existingImages nhưng có upload mới → MERGE (giữ ảnh cũ + thêm mới)
            const existing = await Room.findById(id).select("images coverImageUrl");
            const mergedImages = [...(existing?.images || []), ...uploadedImages];
            update.images = mergedImages;
            if (!existing?.coverImageUrl && mergedImages.length > 0) {
                update.coverImageUrl = mergedImages[0].url;
            }
        }

        const updated = await Room.findByIdAndUpdate(id, update, { new: true });
        if (!updated) return res.status(404).json({ 
            message: "Không tìm thấy phòng",
            success: false 
        });

        res.status(200).json({
            message: "Cập nhật phòng thành công",
            success: true,
            data: formatRoom(updated),
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi cập nhật phòng",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Xoá room
 */
export const deleteRoom = async (req, res) => {
    try {
        if (!req.user || req.user.role !== "ADMIN") {
            return res.status(403).json({
                message: "Bạn không có quyền xóa phòng.",
                success: false,
            });
        }

        const { id } = req.params;
        if (!mongoose.isValidObjectId(id))
            return res.status(400).json({ 
                message: "ID phòng không hợp lệ",
                success: false 
            });

        const removed = await Room.findByIdAndDelete(id);
        if (!removed) return res.status(404).json({ 
            message: "Không tìm thấy phòng",
            success: false 
        });

        res.status(200).json({
            message: "Xóa phòng thành công",
            success: true,
            data: { id: removed._id },
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi khi xóa phòng",
            success: false,
            error: err.message 
        });
    }
};

/**
 * Xóa 1 ảnh của room theo publicId (Cloudinary + DB)
 */
export const removeRoomImage = async (req, res) => {
    try {
        const { id, publicId } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "ID phòng không hợp lệ", success: false });

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ message: "Không tìm thấy phòng", success: false });

        await cloudinary.uploader.destroy(publicId);

        const nextImages = (room.images || []).filter((img) => img.publicId !== publicId);
        let nextCover = room.coverImageUrl;
        if (room.coverImageUrl && (room.images || []).some((img) => img.publicId === publicId)) {
            nextCover = nextImages[0]?.url || null;
        }

        room.images = nextImages;
        room.coverImageUrl = nextCover || undefined;
        await room.save();

        return res.json({ message: "Đã xoá ảnh", success: true, data: { images: room.images, coverImageUrl: room.coverImageUrl } });
    } catch (err) {
        return res.status(500).json({ message: "Lỗi khi xoá ảnh", success: false, error: err.message });
    }
};

/**
 * Đặt ảnh đại diện theo publicId
 */
export const setRoomCoverImage = async (req, res) => {
    try {
        const { id } = req.params;
        const { publicId } = req.body;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "ID phòng không hợp lệ", success: false });

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ message: "Không tìm thấy phòng", success: false });

        const found = (room.images || []).find((img) => img.publicId === publicId);
        if (!found) return res.status(404).json({ message: "Không tìm thấy ảnh với publicId", success: false });

        room.coverImageUrl = found.url;
        await room.save();

        return res.json({ message: "Đã cập nhật ảnh đại diện", success: true, data: { coverImageUrl: room.coverImageUrl } });
    } catch (err) {
        return res.status(500).json({ message: "Lỗi khi cập nhật ảnh đại diện", success: false, error: err.message });
    }
};
