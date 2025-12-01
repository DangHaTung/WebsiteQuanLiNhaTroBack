import mongoose from "mongoose";
import Bill from "../models/bill.model.js";
import Contract from "../models/contract.model.js";
import logService from "../services/log.service.js";
import notificationService from "../services/notification/notification.service.js";

// Helper convert Decimal128 sang number
// Nếu value null/undefined trả về null, ngược lại parseFloat
const convertDecimal128 = (value) => {
    if (value === null || value === undefined) return null;
    return parseFloat(value.toString());
};

// Chuyển đổi bill object sang dạng frontend-friendly
// Decimal128 → number, lineItems + payments map sang dạng plain object
const formatBill = (bill) => ({
    ...bill.toObject(),
    amountDue: convertDecimal128(bill.amountDue),
    amountPaid: convertDecimal128(bill.amountPaid),
    lineItems: bill.lineItems?.map(item => {
        const plainItem = item.toObject ? item.toObject() : item;
        return {
            ...plainItem,
            unitPrice: convertDecimal128(plainItem.unitPrice),
            lineTotal: convertDecimal128(plainItem.lineTotal),
        };
    }) || [],
    payments: bill.payments?.map(payment => ({
        ...payment,
        amount: convertDecimal128(payment.amount),
    })) || [],
});

/**
 * Helper: Lấy tất cả contractIds và finalContractIds của user
 * Bao gồm cả co-tenant
 */
const getUserContractIds = async (userId) => {
    const FinalContract = (await import("../models/finalContract.model.js")).default;
    
    // Tìm tất cả FinalContracts của user
    const finalContracts = await FinalContract.find({ tenantId: userId }).select('_id');
    const finalContractIds = finalContracts.map(fc => fc._id);
    
    // Tìm Contracts (bao gồm co-tenants)
    const contracts = await Contract.find({
        $or: [
            { tenantId: userId }, // User là người chính
            { "coTenants.userId": userId } // User là người ở cùng
        ]
    }).select('_id');
    const contractIds = contracts.map(c => c._id);
    
    return { contractIds, finalContractIds };
};

/**
 * getMyBills
 * ----------------
 * Lấy danh sách hóa đơn của tenant
 * Input: req.user._id
 * Output: mảng hóa đơn đã format
 * Quyền hạn: tenant
 * Lưu ý: bao gồm hóa đơn từ hợp đồng chính và co-tenant
 */
export const getMyBills = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user._id;

    // Lấy tất cả contractIds và finalContractIds (bao gồm co-tenant)
    const { contractIds, finalContractIds } = await getUserContractIds(userId);

    // Lọc finalContractIds: chỉ lấy FinalContract chưa bị hủy
    const FinalContract = (await import("../models/finalContract.model.js")).default;
    const activeFinalContracts = await FinalContract.find({ 
      _id: { $in: finalContractIds },
      status: { $ne: "CANCELED" }
    }).select('_id');
    const activeFinalContractIds = activeFinalContracts.map(fc => fc._id);

    // Tìm bills từ cả Contract và FinalContract, hoặc bills có tenantId = userId (RECEIPT bills)
    const filterConditions = [];
    if (contractIds.length > 0) {
      filterConditions.push({ contractId: { $in: contractIds } });
    }
    if (activeFinalContractIds.length > 0) {
      filterConditions.push({ finalContractId: { $in: activeFinalContractIds } });
    }
    // Thêm điều kiện lấy bills có tenantId = userId (cho RECEIPT bills)
    filterConditions.push({ tenantId: userId });

    // Nếu không có điều kiện nào, trả về mảng rỗng
    if (filterConditions.length === 0) {
      return res.status(200).json({
        message: "Lấy danh sách hóa đơn thành công",
        success: true,
        data: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalRecords: 0,
          limit: parseInt(limit),
        },
      });
    }

    let filter = filterConditions.length > 1 
      ? { $or: filterConditions }
      : filterConditions[0];
    
    // Chỉ hiển thị bills đã publish (không phải DRAFT) và không bị hủy (không phải VOID)
    filter = { ...filter, status: { $nin: ["DRAFT", "VOID"] } };

    const bills = await Bill.find(filter)
      .populate("contractId")
      .populate({
        path: "finalContractId",
        select: "_id status"
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    // Filter thêm: loại bỏ bills của FinalContract đã bị hủy
    const filteredBills = bills.filter(bill => {
      if (bill.finalContractId) {
        const finalContract = bill.finalContractId;
        const finalContractStatus = typeof finalContract === 'object' && finalContract.status 
          ? finalContract.status 
          : null;
        // Nếu FinalContract đã bị hủy, không hiển thị bill này
        if (finalContractStatus === "CANCELED") {
          return false;
        }
      }
      return true;
    });

    // Format bills để chuyển đổi Decimal128 sang number (sử dụng filteredBills)
    const formattedBills = filteredBills.map(formatBill);
    
    // Tính lại total: đếm tất cả bills sau khi filter (không giới hạn limit)
    // Lưu ý: pagination có thể không chính xác 100% vì filter sau khi query
    // Nhưng đây là cách tốt nhất để đảm bảo không hiển thị bills của FinalContract đã hủy
    const allBillsForCount = await Bill.find(filter)
      .populate({
        path: "finalContractId",
        select: "_id status"
      });
    const filteredBillsForCount = allBillsForCount.filter(bill => {
      if (bill.finalContractId) {
        const finalContract = bill.finalContractId;
        const finalContractStatus = typeof finalContract === 'object' && finalContract.status 
          ? finalContract.status 
          : null;
        if (finalContractStatus === "CANCELED") {
          return false;
        }
      }
      return true;
    });
    const total = filteredBillsForCount.length;

    res.status(200).json({
      message: "Lấy danh sách hóa đơn thành công",
      success: true,
      data: formattedBills,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách hóa đơn",
      success: false,
      error: err.message,
    });
  }
};

/**
 * getAllBills
 * ----------------
 * Lấy tất cả hóa đơn (admin)
 * Input: query params: filter, pagination
 * Output: mảng hóa đơn
 * Quyền hạn: admin
 * Lưu ý: hỗ trợ filter theo trạng thái, tenant, room
 */
export const getAllBills = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, billType, contractId, finalContractId } = req.query;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = {};
    if (status && status !== "ALL") {
      filter.status = status;
    }
    if (billType && billType !== "ALL") {
      filter.billType = billType;
    }
    if (contractId) {
      filter.contractId = contractId;
    }
    if (finalContractId) {
      filter.finalContractId = finalContractId;
    }

    const bills = await Bill.find(filter)
      .populate("contractId")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Bill.countDocuments(filter);

    // Format bills để chuyển đổi Decimal128 sang number
    const formattedBills = bills.map(formatBill);

    res.status(200).json({
      message: "Lấy danh sách hóa đơn thành công",
      success: true,
      data: formattedBills,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách hóa đơn",
      success: false,
      error: err.message,
    });
  }
};

/**
 * getBillById
 * ----------------
 * Lấy chi tiết một hóa đơn
 * Input: billId
 * Output: chi tiết bill đã format
 * Quyền hạn: tenant (chỉ bill của họ) hoặc admin
 */
export const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id).populate("contractId");
    if (!bill) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn",
        success: false,
      });
    }

    // Format bill để chuyển đổi Decimal128 sang number
    const formattedBill = formatBill(bill);

    res.status(200).json({
      message: "Lấy hóa đơn thành công",
      success: true,
      data: formattedBill,
    });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi khi lấy hóa đơn",
      success: false,
      error: err.message,
    });
  }
};

/**
 * createBill
 * ----------------
 * Tạo một hóa đơn mới
 * Input: req.body chứa lineItems, contractId/finalContractId, dueDate
 * Output: bill mới
 * Quyền hạn: admin
 * Lưu ý: kiểm tra hợp đồng tồn tại, tính toán amountTotal
 */
export const createBill = async (req, res) => {
  try {
    const bill = new Bill(req.body);
    await bill.save();
    
    // Populate và format bill
    const populatedBill = await Bill.findById(bill._id)
      .populate("contractId")
      .populate("tenantId", "fullName email")
      .populate("roomId", "roomNumber");
    const formattedBill = formatBill(populatedBill);
    
    // 📝 Log bill creation
    await logService.logCreate({
      entity: 'BILL',
      entityId: bill._id,
      actorId: req.user?._id,
      data: {
        billType: bill.billType,
        amountDue: convertDecimal128(bill.amountDue),
        status: bill.status,
      },
    });

    // 🔔 Send notification to tenant
    try {
      await notificationService.notifyBillCreated(populatedBill);
    } catch (notifError) {
      console.error('❌ Error sending bill notification:', notifError.message);
      // Don't block bill creation if notification fails
    }
    
    res.status(201).json({
      message: "Tạo hóa đơn thành công",
      success: true,
      data: formattedBill,
    });
  } catch (err) {
    res.status(400).json({
      message: "Không thể tạo hóa đơn",
      success: false,
      error: err.message,
    });
  }
};

/**
 * updateBill
 * ----------------
 * Cập nhật thông tin hóa đơn (lineItems, dueDate)
 * Input: billId, body
 * Output: bill đã cập nhật
 * Quyền hạn: admin
 * Lưu ý: không cho phép cập nhật bill đã hủy hoặc đã thanh toán
 */
export const updateBill = async (req, res) => {
  try {
    // Lấy hóa đơn hiện tại để kiểm tra trạng thái
    const current = await Bill.findById(req.params.id).populate("contractId");
    if (!current) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn để cập nhật",
        success: false,
      });
    }

    // Nếu đã thanh toán, không cho phép chuyển về trạng thái khác (UNPAID/PARTIALLY_PAID/VOID)
    const incomingStatus = req.body?.status;
    if (current.status === "PAID" && incomingStatus && incomingStatus !== "PAID") {
      return res.status(400).json({
        message: "Hóa đơn đã thanh toán, không thể chuyển về trạng thái khác hoặc hủy",
        success: false,
      });
    }

    // Nếu đang PARTIALLY_PAID, không cho phép chuyển về UNPAID hoặc VOID (có thể chuyển lên PAID)
    if (current.status === "PARTIALLY_PAID" && incomingStatus && ["UNPAID", "VOID"].includes(incomingStatus)) {
      return res.status(400).json({
        message: "Hóa đơn đã thanh toán một phần, không thể chuyển về chưa thanh toán hoặc hủy",
        success: false,
      });
    }

    // Hàm tiện ích lấy số từ Decimal128 hoặc null -> số
    const toNumberSafe = (val) => {
      const n = convertDecimal128(val);
      return n === null ? 0 : n;
    };

    // Chuẩn bị object cập nhật dựa trên body (chỉ override những field client muốn)
    const updateFields = { ...req.body };

    // Nếu incoming status là PAID và hóa đơn hiện tại chưa ở PAID => chuyển tiền amountDue -> amountPaid
    if (incomingStatus === "PAID" && current.status !== "PAID") {
      const currentAmountDue = toNumberSafe(current.amountDue);
      const currentAmountPaid = toNumberSafe(current.amountPaid);

      if (currentAmountDue > 0) {
        const transferred = currentAmountDue;
        const finalAmountPaid = currentAmountPaid + transferred;

        // Ghi lại dưới dạng Decimal128
        updateFields.amountPaid = mongoose.Types.Decimal128.fromString(String(finalAmountPaid));
        updateFields.amountDue = mongoose.Types.Decimal128.fromString("0");

        // Tạo bản ghi payment tự động
        const autoPayment = {
          paidAt: new Date(),
          amount: mongoose.Types.Decimal128.fromString(String(transferred)),
          method: "OTHER",
          provider: "AUTO",
          transactionId: `auto-${Date.now()}`,
          note: "Auto transfer amountDue -> amountPaid when status set to PAID",
        };

        // Merge payments hiện tại + autoPayment
        updateFields.payments = [...(current.payments || []), autoPayment];
      } else {
        // Nếu amountDue = 0 trước đó, vẫn đảm bảo amountDue = 0 và amountPaid không thay đổi (hoặc set bằng giá trị hiện tại)
        updateFields.amountDue = mongoose.Types.Decimal128.fromString("0");
        updateFields.amountPaid = mongoose.Types.Decimal128.fromString(String(currentAmountPaid));
      }
    }

    // Cập nhật updatedAt (pre save không chạy cho findByIdAndUpdate)
    updateFields.updatedAt = new Date();

    // Thực hiện cập nhật an toàn
    const updated = await Bill.findByIdAndUpdate(req.params.id, updateFields, { new: true }).populate("contractId");

    // Format bill để chuyển đổi Decimal128 sang number
    const formattedBill = formatBill(updated);

    res.status(200).json({
      message: "Cập nhật hóa đơn thành công",
      success: true,
      data: formattedBill,
    });
  } catch (err) {
    console.error("updateBill error:", err);
    res.status(400).json({
      message: "Không thể cập nhật hóa đơn",
      success: false,
      error: err.message,
    });
  }
};

/**
 * confirmCashReceipt
 * ----------------
 * Xác nhận hóa đơn tiền mặt đã nhận
 * Input: billId
 * Output: bill đã thanh toán
 * Quyền hạn: admin
 * Lưu ý: cập nhật amountPaid, trạng thái bill, tự động hoàn thành checkin nếu cần
 */
export const confirmCashReceipt = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const bill = await Bill.findById(req.params.id).populate("contractId");
    if (!bill) return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn" });

    // Chỉ xử lý bill chưa thanh toán hoặc đang chờ xác nhận
    if (!["UNPAID", "PENDING_CASH_CONFIRM", "PARTIALLY_PAID"].includes(bill.status)) {
      return res.status(400).json({ success: false, message: "Bill đã thanh toán hoặc không hợp lệ" });
    }

    const due = convertDecimal128(bill.amountDue) || 0;
    const paid = convertDecimal128(bill.amountPaid) || 0;
    const transfer = Math.max(due - paid, 0);

    // Cập nhật trạng thái và tiền
    bill.status = "PAID";
    bill.amountPaid = mongoose.Types.Decimal128.fromString(String(paid + transfer));
    bill.amountDue = mongoose.Types.Decimal128.fromString("0");
    bill.payments = [
      ...(bill.payments || []),
      {
        paidAt: new Date(),
        amount: mongoose.Types.Decimal128.fromString(String(transfer)),
        method: "CASH",
        provider: "OFFLINE",
        transactionId: `cash-${Date.now()}`,
        note: "Xác nhận tiền mặt bởi ADMIN",
      },
    ];

    await bill.save();

    // 📝 Log cash payment confirmation
    await logService.logPayment({
      entity: 'BILL',
      entityId: bill._id,
      actorId: req.user._id,
      amount: transfer,
      provider: 'CASH',
      status: 'SUCCESS',
      billDetails: {
        billType: bill.billType,
        roomNumber: bill.roomId?.roomNumber,
        tenantName: bill.tenantId?.fullName,
        month: bill.month,
      },
    });

    // 🔔 Send payment success notification
    try {
      await notificationService.notifyPaymentSuccess(bill, 'CASH');
    } catch (notifError) {
      console.error('❌ Error sending payment notification:', notifError.message);
    }

    // Tự động complete checkin và cập nhật room status nếu là bill RECEIPT đã PAID
    if (bill.billType === "RECEIPT" && bill.status === "PAID") {
      const Checkin = (await import("../models/checkin.model.js")).default;
      const Room = (await import("../models/room.model.js")).default;
      const checkin = await Checkin.findOne({ receiptBillId: bill._id }).populate("roomId");
      if (checkin && checkin.status === "CREATED") {
        checkin.status = "COMPLETED";
        checkin.receiptPaidAt = new Date(); // Lưu thời điểm thanh toán phiếu thu
        await checkin.save();
        console.log(`✅ [CASH CONFIRM] Auto-completed checkin ${checkin._id} after cash payment confirmation, receiptPaidAt: ${checkin.receiptPaidAt}`);
        
        // Cập nhật room status = DEPOSITED, occupantCount = 0
        if (checkin.roomId) {
          const room = await Room.findById(checkin.roomId._id || checkin.roomId);
          if (room) {
            room.status = "DEPOSITED";
            room.occupantCount = 0; // Chưa vào ở
            await room.save();
            console.log(`✅ [CASH CONFIRM] Updated room ${room._id} status to DEPOSITED`);
          }
        }
        
        // Tự động tạo account và gửi email
        try {
          const { autoCreateAccountAndSendEmail } = await import("../services/user/autoCreateAccount.service.js");
          await autoCreateAccountAndSendEmail(checkin);
          console.log(`✅ Auto-created account and sent email for checkin ${checkin._id}`);
        } catch (emailErr) {
          console.error(`❌ Failed to create account/send email for checkin ${checkin._id}:`, emailErr);
          // Không throw error để không block payment flow
        }
      }
    }
    
    // Cập nhật room status = OCCUPIED và occupantCount khi thanh toán CONTRACT bill
    if (bill.billType === "CONTRACT" && bill.status === "PAID" && bill.contractId) {
      const Room = (await import("../models/room.model.js")).default;
      const Contract = (await import("../models/contract.model.js")).default;
      const contract = await Contract.findById(bill.contractId).populate("roomId");
      if (contract && contract.roomId) {
        const room = await Room.findById(contract.roomId._id || contract.roomId);
        if (room) {
          room.status = "OCCUPIED";
          const occupantCount = contract.coTenants?.length ? contract.coTenants.length + 1 : 1;
          room.occupantCount = occupantCount;
          await room.save();
          console.log(`✅ [CASH CONFIRM] Updated room ${room._id} status to OCCUPIED, occupantCount: ${occupantCount}`);
        }
      }
    }

    return res.status(200).json({ success: true, message: "Xác nhận tiền mặt thành công", data: formatBill(bill) });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Lỗi xác nhận tiền mặt", error: err.message });
  }
};



/**
 * cancelBill
 * ----------------
 * Hủy bill → chuyển trạng thái VOID
 * Input: billId
 * Output: bill đã hủy
 * Quyền hạn: admin
 * Lưu ý: kiểm tra trạng thái hiện tại, không hủy bill đã thanh toán đầy đủ
 */
export const cancelBill = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Bạn không có quyền hủy hóa đơn" });
    }

    const bill = await Bill.findById(req.params.id).populate("contractId");
    if (!bill) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn" });
    }

    if (bill.status === "VOID") {
      return res.status(200).json({ success: true, message: "Hóa đơn đã bị hủy trước đó", data: formatBill(bill) });
    }

    // Không cho hủy nếu đã thanh toán một phần hoặc toàn bộ
    if (bill.status === "PARTIALLY_PAID" || bill.status === "PAID") {
      return res.status(400).json({ success: false, message: "Không thể hủy hóa đơn đã thanh toán" });
    }

    bill.status = "VOID";
    bill.updatedAt = new Date();
    await bill.save();
    return res.status(200).json({ success: true, message: "Đã hủy hóa đơn", data: formatBill(bill) });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Lỗi khi hủy hóa đơn", error: err.message });
  }
};

// (ĐÃ BỎ) Delete bill: không dùng trong nghiệp vụ — route đã gỡ bỏ

/**
 * Lấy tất cả bills DRAFT (nháp) - Admin only
 * GET /api/bills/drafts
 */
export const getDraftBills = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const bills = await Bill.find({ status: "DRAFT", billType: "MONTHLY" })
      .populate({
        path: "contractId",
        populate: [
          { path: "roomId", select: "roomNumber pricePerMonth" },
          { path: "tenantId", select: "fullName email phone" }
        ]
      })
      .sort({ billingDate: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Bill.countDocuments({ status: "DRAFT", billType: "MONTHLY" });

    const formattedBills = bills.map(formatBill);

    res.status(200).json({
      message: "Lấy danh sách hóa đơn nháp thành công",
      success: true,
      data: formattedBills,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách hóa đơn nháp",
      success: false,
      error: err.message,
    });
  }
};

/**
 * publishDraftBill
 * ----------------
 * Phát hành bill DRAFT → UNPAID
 * Input: billId
 * Output: bill đã phát hành
 * Quyền hạn: admin
 * Lưu ý: chỉ publish bill ở trạng thái DRAFT
 */
export const publishDraftBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { electricityKwh, waterM3 = 0, occupantCount = 1, vehicleCount = 0 } = req.body;

    // Validate: số xe không được vượt quá số người
    if (vehicleCount > occupantCount) {
      return res.status(400).json({ 
        success: false, 
        message: `Số xe (${vehicleCount}) không được vượt quá số người ở (${occupantCount})` 
      });
    }

    const bill = await Bill.findById(id).populate("contractId");
    if (!bill) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn" });
    }

    if (bill.status !== "DRAFT") {
      return res.status(400).json({ success: false, message: "Chỉ có thể phát hành hóa đơn nháp" });
    }

    if (!bill.contractId) {
      return res.status(400).json({ success: false, message: "Hóa đơn không có hợp đồng liên kết" });
    }

    // Lấy thông tin contract và room
    const contract = await Contract.findById(bill.contractId._id).populate("roomId");
    if (!contract || !contract.roomId) {
      return res.status(400).json({ success: false, message: "Không tìm thấy thông tin phòng" });
    }

    // Tính toán lại với số điện mới
    const { calculateRoomMonthlyFees } = await import("../services/billing/monthlyBill.service.js");
    const feeCalculation = await calculateRoomMonthlyFees({
      roomId: contract.roomId._id,
      electricityKwh: Number(electricityKwh),
      waterM3: Number(waterM3),
      occupantCount: Number(occupantCount),
      vehicleCount: Number(vehicleCount),
    });

    // Cập nhật bill
    bill.status = "UNPAID";
    bill.lineItems = feeCalculation.lineItems;
    bill.amountDue = mongoose.Types.Decimal128.fromString(String(feeCalculation.totalAmount));
    bill.updatedAt = new Date();

    await bill.save();

    return res.status(200).json({
      success: true,
      message: "Phát hành hóa đơn thành công",
      data: formatBill(bill),
    });
  } catch (err) {
    console.error("publishDraftBill error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi phát hành hóa đơn",
      error: err.message,
    });
  }
};

/**
 * publishBatchDraftBills
 * ----------------
 * Phát hành nhiều bill cùng lúc
 * Input: mảng billIds
 * Output: mảng bill đã publish
 * Quyền hạn: admin
 */
export const publishBatchDraftBills = async (req, res) => {
  try {
    const { bills } = req.body; // Array of { billId, electricityKwh, occupantCount }

    if (!Array.isArray(bills) || bills.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách bills không hợp lệ" });
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const item of bills) {
      try {
        const { billId, electricityKwh, waterM3 = 0, occupantCount = 1, vehicleCount = 0 } = item;

        // Validate: số xe không được vượt quá số người
        if (vehicleCount > occupantCount) {
          results.failed.push({ 
            billId, 
            error: `Số xe (${vehicleCount}) không được vượt quá số người ở (${occupantCount})` 
          });
          continue;
        }

        const bill = await Bill.findById(billId).populate("contractId");
        if (!bill || bill.status !== "DRAFT") {
          results.failed.push({ billId, error: "Bill không hợp lệ hoặc không phải DRAFT" });
          continue;
        }

        const contract = await Contract.findById(bill.contractId._id).populate("roomId");
        if (!contract || !contract.roomId) {
          results.failed.push({ billId, error: "Không tìm thấy thông tin phòng" });
          continue;
        }

        // Tính toán lại
        const { calculateRoomMonthlyFees } = await import("../services/billing/monthlyBill.service.js");
        const feeCalculation = await calculateRoomMonthlyFees({
          roomId: contract.roomId._id,
          electricityKwh: Number(electricityKwh),
          waterM3: Number(waterM3),
          occupantCount: Number(occupantCount),
          vehicleCount: Number(vehicleCount),
        });

        // Cập nhật
        bill.status = "UNPAID";
        bill.lineItems = feeCalculation.lineItems;
        bill.amountDue = mongoose.Types.Decimal128.fromString(String(feeCalculation.totalAmount));
        bill.updatedAt = new Date();
        await bill.save();

        results.success.push({
          billId: bill._id,
          roomNumber: contract.roomId.roomNumber,
          totalAmount: feeCalculation.totalAmount,
        });
      } catch (error) {
        results.failed.push({ billId: item.billId, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Phát hành ${results.success.length} hóa đơn thành công`,
      data: results,
    });
  } catch (err) {
    console.error("publishBatchDraftBills error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi phát hành hóa đơn hàng loạt",
      error: err.message,
    });
  }
};



// Lấy bills theo finalContractId
export const getBillsByFinalContractId = async (req, res) => {
  try {
    const { finalContractId } = req.params;
    
    const bills = await Bill.find({ finalContractId })
      .populate("contractId")
      .sort({ createdAt: -1 });
    
    const formattedBills = bills.map(formatBill);
    
    return res.status(200).json({
      success: true,
      message: "Lấy bills theo FinalContract thành công",
      data: formattedBills,
    });
  } catch (err) {
    console.error("getBillsByFinalContractId error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy bills",
      error: err.message,
    });
  }
};

// Lấy danh sách hóa đơn chưa thanh toán của user
export const getMyPendingPayment = async (req, res) => {
  try {
    const userId = req.user._id;

    // Tìm tất cả FinalContracts của user
    const FinalContract = (await import("../models/finalContract.model.js")).default;
    const finalContracts = await FinalContract.find({ tenantId: userId }).select('_id');
    const finalContractIds = finalContracts.map(fc => fc._id);

    // Tìm tất cả Contracts của user
    const contracts = await Contract.find({ tenantId: userId }).select('_id');
    const contractIds = contracts.map(c => c._id);

    // Nếu không có contract và finalContract nào, trả về mảng rỗng
    if (contractIds.length === 0 && finalContractIds.length === 0) {
      return res.status(200).json({
        message: "Lấy danh sách hóa đơn chưa thanh toán thành công",
        success: true,
        data: [],
      });
    }

    // Tìm bills chưa thanh toán
    const filterConditions = [];
    if (contractIds.length > 0) {
      filterConditions.push({ contractId: { $in: contractIds } });
    }
    if (finalContractIds.length > 0) {
      filterConditions.push({ finalContractId: { $in: finalContractIds } });
    }

    const filter = {
      ...(filterConditions.length > 1 
        ? { $or: filterConditions }
        : filterConditions[0]),
      status: { $in: ["UNPAID", "PARTIALLY_PAID", "PENDING_CASH_CONFIRM"] }
    };

    const bills = await Bill.find(filter)
      .populate("contractId")
      .populate("finalContractId")
      .sort({ createdAt: -1 });

    const formattedBills = bills.map(formatBill);

    res.status(200).json({
      message: "Lấy danh sách hóa đơn chưa thanh toán thành công",
      success: true,
      data: formattedBills,
    });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách hóa đơn chưa thanh toán",
      success: false,
      error: err.message,
    });
  }
};

/**
 * requestCashPayment
 * ----------------
 * Tenant yêu cầu thanh toán tiền mặt
 * Input: billId
 * Output: trạng thái request thành công
 * Quyền hạn: tenant
 */
export const requestCashPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const userId = req.user._id;

    // Tìm bill
    const bill = await Bill.findById(id)
      .populate("tenantId")
      .populate({
        path: "contractId",
        populate: { path: "tenantId" }
      })
      .populate({
        path: "finalContractId",
        populate: { path: "tenantId" }
      });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    // Kiểm tra quyền: bill phải thuộc về user này
    // Logic tương tự getMyBills: kiểm tra từ nhiều nguồn
    const userIdStr = userId.toString();
    let hasPermission = false;
    
    // 1. Kiểm tra bill.tenantId (cho RECEIPT bills)
    if (bill.tenantId) {
      const billTenantId = typeof bill.tenantId === 'object' ? bill.tenantId._id?.toString() : bill.tenantId.toString();
      if (billTenantId === userIdStr) {
        hasPermission = true;
      }
    }
    
    // 2. Kiểm tra contractId.tenantId (bao gồm co-tenant)
    if (!hasPermission && bill.contractId) {
      const contract = await Contract.findById(bill.contractId._id || bill.contractId).lean();
      if (contract) {
        const contractTenantId = contract.tenantId?.toString();
        const isCoTenant = contract.coTenants?.some((ct) => ct.userId?.toString() === userIdStr);
        if (contractTenantId === userIdStr || isCoTenant) {
          hasPermission = true;
        }
      }
    }
    
    // 3. Kiểm tra finalContractId.tenantId
    if (!hasPermission && bill.finalContractId) {
      const FinalContract = (await import("../models/finalContract.model.js")).default;
      const finalContract = await FinalContract.findById(bill.finalContractId._id || bill.finalContractId).lean();
      if (finalContract && finalContract.tenantId?.toString() === userIdStr) {
        hasPermission = true;
      }
    }
    
    // Debug logging
    console.log("🔍 requestCashPayment - Permission check:", {
      billId: id,
      userId: userIdStr,
      billType: bill.billType,
      hasPermission,
      hasContractId: !!bill.contractId,
      hasFinalContractId: !!bill.finalContractId,
      hasTenantId: !!bill.tenantId,
    });
    
    if (!hasPermission) {
      console.log("❌ Permission denied for bill:", id, "userId:", userIdStr);
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thao tác với hóa đơn này",
      });
    }

    // Kiểm tra trạng thái bill
    if (bill.status === "PAID") {
      return res.status(400).json({
        success: false,
        message: "Hóa đơn này đã được thanh toán",
      });
    }

    if (bill.status === "PENDING_CASH_CONFIRM") {
      return res.status(400).json({
        success: false,
        message: "Hóa đơn này đang chờ admin xác nhận thanh toán tiền mặt",
      });
    }

    // Validate amount
    const amountNum = Number(amount);
    const amountDue = convertDecimal128(bill.amountDue);
    const amountPaid = convertDecimal128(bill.amountPaid);
    const balance = amountDue - amountPaid;

    if (amountNum <= 0 || amountNum > balance) {
      return res.status(400).json({
        success: false,
        message: "Số tiền thanh toán không hợp lệ",
      });
    }

    // Chuyển status sang PENDING_CASH_CONFIRM
    bill.status = "PENDING_CASH_CONFIRM";
    
    // Lưu thông tin request vào metadata
    if (!bill.metadata) bill.metadata = {};
    bill.metadata.cashPaymentRequest = {
      requestedAt: new Date(),
      requestedBy: userId,
      requestedAmount: amountNum,
    };

    await bill.save();

    return res.status(200).json({
      success: true,
      message: "Đã gửi yêu cầu thanh toán tiền mặt. Vui lòng chờ admin xác nhận.",
      data: formatBill(bill),
    });
  } catch (err) {
    console.error("requestCashPayment error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi gửi yêu cầu thanh toán tiền mặt",
      error: err.message,
    });
  }
};

/**
 * confirmCashPayment
 * ----------------
 * Admin xác nhận thanh toán tiền mặt theo request tenant
 * Input: billId
 * Output: bill đã thanh toán
 * Quyền hạn: admin
 */
export const confirmCashPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note } = req.body;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    // Tự động tính amount nếu không được cung cấp (thanh toán toàn bộ số dư)
    const amountDue = convertDecimal128(bill.amountDue) || 0;
    const amountPaid = convertDecimal128(bill.amountPaid) || 0;
    const balance = amountDue - amountPaid;
    
    const amountNum = amount ? Number(amount) : balance;
    
    if (amountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số tiền không hợp lệ hoặc hóa đơn đã thanh toán đủ",
      });
    }
    
    if (amountNum > balance) {
      return res.status(400).json({
        success: false,
        message: "Số tiền thanh toán vượt quá số dư",
      });
    }

    // Thêm payment record
    if (!bill.payments) bill.payments = [];
    bill.payments.push({
      paidAt: new Date(),
      amount: mongoose.Types.Decimal128.fromString(amountNum.toFixed(2)),
      method: "CASH",
      provider: "CASH",
      transactionId: `CASH_${Date.now()}`,
      note: note || "Thanh toán tiền mặt",
      confirmedBy: req.user._id,
    });

    // Cập nhật amountPaid
    const currentPaid = convertDecimal128(bill.amountPaid) || 0;
    const newPaid = currentPaid + amountNum;
    bill.amountPaid = mongoose.Types.Decimal128.fromString(newPaid.toFixed(2));

    // Cập nhật status (sử dụng lại biến amountDue đã khai báo ở trên)
    if (newPaid >= amountDue) {
      bill.status = "PAID";
    } else if (newPaid > 0) {
      bill.status = "PARTIALLY_PAID";
    }

    await bill.save();

    // KHÔNG tự động complete checkin cho tiền mặt - cần admin click "Hoàn thành" riêng
    console.log(`✅ [CONFIRM CASH PAYMENT] Bill ${bill._id} confirmed as PAID - Checkin requires manual completion`);

    return res.status(200).json({
      success: true,
      message: "Xác nhận thanh toán tiền mặt thành công",
      data: formatBill(bill),
    });
  } catch (err) {
    console.error("confirmCashPayment error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xác nhận thanh toán",
      error: err.message,
    });
  }
};

/**
 * calculateMonthlyFees
 * ----------------
 * Tính phí dịch vụ cuối tháng cho room
 * Input: roomId, tháng/năm
 * Output: giá trị phí
 * Quyền hạn: admin
 * Lưu ý: sử dụng cho generate bill hàng tháng
 */
export const calculateMonthlyFees = async (req, res) => {
  try {
    const { roomId, electricityKwh = 0, waterM3 = 0, occupantCount = 1, excludeRent = false } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "roomId is required",
      });
    }

    const { calculateRoomMonthlyFees } = await import("../services/billing/monthlyBill.service.js");
    const calculation = await calculateRoomMonthlyFees({
      roomId,
      electricityKwh: Number(electricityKwh),
      waterM3: Number(waterM3),
      occupantCount: Number(occupantCount),
      excludeRent: Boolean(excludeRent),
    });

    return res.status(200).json({
      success: true,
      message: "Tính toán phí dịch vụ thành công",
      data: calculation,
    });
  } catch (error) {
    console.error("calculateMonthlyFees error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tính toán phí dịch vụ",
      error: error.message,
    });
  }
};

/**
 * generatePaymentLink
 * ----------------
 * Tạo link thanh toán online cho bill RECEIPT
 * Input: billId
 * Output: URL thanh toán
 * Quyền hạn: tenant
 */
export const generatePaymentLink = async (req, res) => {
  try {
    const billId = req.params.id || req.params.billId; // Support both :id and :billId
    const { email: emailFromBody } = req.body || {}; // Allow email from request body
    
    if (!billId) {
      return res.status(400).json({
        success: false,
        message: "billId is required",
      });
    }

    const bill = await Bill.findById(billId).populate({
      path: "contractId",
      select: "tenantSnapshot pricingSnapshot roomId", // Include roomId để populate room
      populate: {
        path: "roomId",
        select: "roomNumber", // Populate room để lấy roomNumber
      },
    });
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }
    
    console.log("🔍 Bill found:", bill._id);
    console.log("🔍 Bill contractId:", bill.contractId?._id);
    console.log("🔍 Bill contractId type:", typeof bill.contractId);

    // Chỉ cho phép generate link cho bill RECEIPT chưa thanh toán
    if (bill.billType !== "RECEIPT") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể tạo link thanh toán cho phiếu thu (RECEIPT)",
      });
    }

    if (bill.status === "PAID") {
      return res.status(400).json({
        success: false,
        message: "Bill đã thanh toán rồi",
      });
    }

    // Lấy thông tin contract để lấy tenantSnapshot
    const contract = bill.contractId;
    if (!contract || !contract.tenantSnapshot) {
      console.error("❌ Contract không có tenantSnapshot:", {
        billId,
        contractId: contract?._id,
        hasContract: !!contract,
        hasTenantSnapshot: !!contract?.tenantSnapshot,
      });
      return res.status(400).json({
        success: false,
        message: "Contract không có thông tin người thuê",
      });
    }

    // Debug log để kiểm tra tenantSnapshot
    console.log("🔍 Contract tenantSnapshot:", JSON.stringify(contract.tenantSnapshot, null, 2));
    console.log("🔍 Contract tenantSnapshot.email:", contract.tenantSnapshot?.email);

    let tenantEmail = contract.tenantSnapshot?.email;
    
    // Nếu không có email trong tenantSnapshot, thử các nguồn khác
    if (!tenantEmail) {
      console.warn("⚠️ Contract không có email, thử lấy từ các nguồn khác...");
      
      // Ưu tiên 1: Email từ request body (admin nhập)
      if (emailFromBody) {
        contract.tenantSnapshot = contract.tenantSnapshot || {};
        contract.tenantSnapshot.email = emailFromBody;
        await contract.save();
        tenantEmail = emailFromBody;
        console.log("✅ Đã cập nhật email từ request body vào contract");
      }
      // Ưu tiên 2: Email từ checkin
      else {
        const Checkin = (await import("../models/checkin.model.js")).default;
        const checkin = await Checkin.findOne({ receiptBillId: billId });
        console.log("🔍 Checkin found:", checkin ? "Yes" : "No");
        if (checkin) {
          console.log("🔍 Checkin tenantSnapshot:", JSON.stringify(checkin.tenantSnapshot, null, 2));
          console.log("🔍 Checkin tenantSnapshot.email:", checkin.tenantSnapshot?.email);
        }
        if (checkin?.tenantSnapshot?.email) {
          contract.tenantSnapshot = contract.tenantSnapshot || {};
          contract.tenantSnapshot.email = checkin.tenantSnapshot.email;
          await contract.save();
          tenantEmail = checkin.tenantSnapshot.email;
          console.log("✅ Đã cập nhật email từ checkin vào contract:", tenantEmail);
        } else {
          console.warn("⚠️ Checkin cũng không có email");
        }
      }
    } else {
      console.log("✅ Email từ contract.tenantSnapshot:", tenantEmail);
    }
    
    if (!tenantEmail) {
      console.error("❌ Contract tenantSnapshot không có email:", {
        billId,
        contractId: contract._id,
        tenantSnapshot: contract.tenantSnapshot,
        emailFromBody,
      });
      return res.status(400).json({
        success: false,
        message: "Người thuê chưa có email. Vui lòng nhập email để gửi link thanh toán.",
        requiresEmail: true, // Flag để frontend biết cần hiển thị modal nhập email
      });
    }

    // Generate token (32 bytes hex string)
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    
    // Token expires in 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Save token to bill
    bill.paymentToken = token;
    bill.paymentTokenExpiresAt = expiresAt;
    await bill.save();

    // Build payment URL
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const paymentUrl = `${frontendUrl}/public/payment/${billId}/${token}`;

    // Send email with payment link
    try {
      const { sendPaymentLinkEmail } = await import("../services/email/notification.service.js");
      const amountNum = convertDecimal128(bill.amountDue) || 0;
      
      // Get roomNumber from various sources
      let roomNumber = "N/A";
      if (contract.pricingSnapshot?.roomNumber) {
        roomNumber = contract.pricingSnapshot.roomNumber;
      } else if (contract.roomId && typeof contract.roomId === 'object' && contract.roomId.roomNumber) {
        roomNumber = contract.roomId.roomNumber;
      } else if (typeof contract.roomId === 'string') {
        // If roomId is just an ID, try to fetch it
        const Room = (await import("../models/room.model.js")).default;
        const room = await Room.findById(contract.roomId).select("roomNumber");
        if (room) roomNumber = room.roomNumber;
      }
      
      await sendPaymentLinkEmail({
        to: tenantEmail,
        fullName: contract.tenantSnapshot?.fullName || "Khách hàng",
        paymentUrl,
        billId: bill._id.toString(),
        amount: amountNum,
        roomNumber,
        expiresAt,
      });
      console.log("✅ Email đã được gửi đến:", tenantEmail);
    } catch (emailError) {
      console.error("❌ Lỗi khi gửi email:", emailError);
      // Vẫn trả về success vì link đã được tạo, chỉ là email không gửi được
      // Có thể gửi lại email sau
    }

    return res.status(200).json({
      success: true,
      message: "Đã tạo link thanh toán và gửi email thành công",
      data: {
        paymentUrl,
        token,
        expiresAt,
        emailSent: true,
        recipientEmail: tenantEmail,
      },
    });
  } catch (error) {
    console.error("generatePaymentLink error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo link thanh toán",
      error: error.message,
    });
  }
};
