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

    // Tìm bills thông qua contracts của user
    const bills = await Bill.find()
      .populate({
        path: "contractId",
        match: { tenantId: userId }
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    // Lọc ra những bills có contractId hợp lệ
    const validBills = bills.filter(bill => bill.contractId);

    const total = await Bill.countDocuments({
      contractId: { $in: await Contract.find({ tenantId: userId }).select('_id') }
    });

    // Format bills để chuyển đổi Decimal128 sang number
    const formattedBills = validBills.map(formatBill);

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
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const bills = await Bill.find()
      .populate("contractId")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Bill.countDocuments();

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

// Xóa hóa đơn
export const deleteBill = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Bạn không có quyền xóa hóa đơn.",
        success: false,
      });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn để xóa",
        success: false,
      });
    }
    if (bill.status === "UNPAID" || bill.status === "PARTIALLY_PAID") {
      return res.status(400).json({
        message: "Hóa đơn chưa thanh toán hoặc thanh toán một phần, không thể xóa",
        success: false,
      });
    }

    await Bill.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Xóa hóa đơn thành công",
      success: true,
    });
  } catch (err) {
    res.status(400).json({
      message: "Không thể xóa hóa đơn",
      success: false,
      error: err.message,
    });
  }
};
