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
    const bill = await Bill.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate("contractId");
    if (!bill)
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn để cập nhật",
        success: false,
      });

    // Format bill để chuyển đổi Decimal128 sang number
    const formattedBill = formatBill(bill);

    res.status(200).json({
      message: "Cập nhật hóa đơn thành công",
      success: true,
      data: formattedBill,
    });
  } catch (err) {
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
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill)
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn để xóa",
        success: false,
      });

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
