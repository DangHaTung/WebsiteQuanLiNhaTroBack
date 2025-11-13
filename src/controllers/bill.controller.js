import mongoose from "mongoose";
import Bill from "../models/bill.model.js";
import Contract from "../models/contract.model.js";

/**
 * Helper convert Decimal128 sang number
 */
const convertDecimal128 = (value) => {
    if (value === null || value === undefined) return null;
    return parseFloat(value.toString());
};

/**
 * Chuyển đổi bill object cho frontend
 */
const formatBill = (bill) => ({
    ...bill.toObject(),
    amountDue: convertDecimal128(bill.amountDue),
    amountPaid: convertDecimal128(bill.amountPaid),
    lineItems: bill.lineItems?.map(item => ({
        ...item,
        unitPrice: convertDecimal128(item.unitPrice),
        lineTotal: convertDecimal128(item.lineTotal),
    })) || [],
    payments: bill.payments?.map(payment => ({
        ...payment,
        amount: convertDecimal128(payment.amount),
    })) || [],
});

// Lấy danh sách hóa đơn của user hiện tại
export const getMyBills = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
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

    // Tìm bills từ cả Contract và FinalContract
    const filterConditions = [];
    if (contractIds.length > 0) {
      filterConditions.push({ contractId: { $in: contractIds } });
    }
    if (finalContractIds.length > 0) {
      filterConditions.push({ finalContractId: { $in: finalContractIds } });
    }

    const filter = filterConditions.length > 1 
      ? { $or: filterConditions }
      : filterConditions[0];

    const bills = await Bill.find(filter)
      .populate("contractId")
      .populate("finalContractId")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
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

// Lấy danh sách hóa đơn (admin)
export const getAllBills = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, billType } = req.query;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = {};
    if (status && status !== "ALL") {
      filter.status = status;
    }
    if (billType && billType !== "ALL") {
      filter.billType = billType;
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

// Lấy hóa đơn theo ID
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

// Tạo hóa đơn mới
export const createBill = async (req, res) => {
  try {
    const bill = new Bill(req.body);
    await bill.save();
    
    // Populate và format bill
    const populatedBill = await Bill.findById(bill._id).populate("contractId");
    const formattedBill = formatBill(populatedBill);
    
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

// Cập nhật hóa đơn
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

// Xác nhận tiền mặt cho phiếu thu (RECEIPT) ở trạng thái PENDING_CASH_CONFIRM
export const confirmCashReceipt = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const bill = await Bill.findById(req.params.id).populate("contractId");
    if (!bill) return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn" });

    if (bill.billType !== "RECEIPT") {
      return res.status(400).json({ success: false, message: "Chỉ xác nhận tiền mặt cho bill phiếu thu (RECEIPT)" });
    }
    if (bill.status !== "PENDING_CASH_CONFIRM") {
      return res.status(400).json({ success: false, message: "Bill không ở trạng thái chờ xác nhận tiền mặt" });
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

    return res.status(200).json({ success: true, message: "Xác nhận tiền mặt thành công", data: formatBill(bill) });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Lỗi xác nhận tiền mặt", error: err.message });
  }
};

// Xác nhận thanh toán tiền mặt cho bất kỳ bill nào (RECEIPT, CONTRACT, MONTHLY)
export const confirmCashPayment = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const bill = await Bill.findById(req.params.id).populate("contractId");
    if (!bill) return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn" });

    if (bill.status === "PAID") {
      return res.status(400).json({ success: false, message: "Hóa đơn đã được thanh toán" });
    }

    const due = convertDecimal128(bill.amountDue) || 0;
    const paid = convertDecimal128(bill.amountPaid) || 0;
    const transfer = Math.max(due - paid, 0);

    // Cập nhật trạng thái và tiền
    bill.status = "PAID";
    bill.amountPaid = mongoose.Types.Decimal128.fromString(String(paid + transfer));
    bill.payments = [
      ...(bill.payments || []),
      {
        paidAt: new Date(),
        amount: mongoose.Types.Decimal128.fromString(String(transfer)),
        method: "CASH",
        provider: "OFFLINE",
        transactionId: `cash-${Date.now()}`,
        note: "Xác nhận thanh toán tiền mặt bởi ADMIN",
      },
    ];

    await bill.save();

    return res.status(200).json({ success: true, message: "Xác nhận thanh toán thành công", data: formatBill(bill) });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Lỗi xác nhận thanh toán", error: err.message });
  }
};

// Hủy hóa đơn (cancel) — chuyển trạng thái sang VOID
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
      .populate("contractId")
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
 * Cập nhật số điện và phát hành bill (DRAFT → UNPAID)
 * PUT /api/bills/:id/publish
 */
export const publishDraftBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { electricityKwh, waterM3 = 0, occupantCount = 1 } = req.body;

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
 * Phát hành nhiều bills cùng lúc
 * POST /api/bills/publish-batch
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
        const { billId, electricityKwh, waterM3 = 0, occupantCount = 1 } = item;

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
