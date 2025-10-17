import Bill from "../models/bill.model.js";

// Lấy danh sách hóa đơn
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

    res.status(200).json({
      message: "Lấy danh sách hóa đơn thành công",
      success: true,
      data: bills,
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

    res.status(200).json({
      message: "Lấy hóa đơn thành công",
      success: true,
      data: bill,
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
    res.status(201).json({
      message: "Tạo hóa đơn thành công",
      success: true,
      data: bill,
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
    const bill = await Bill.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!bill)
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn để cập nhật",
        success: false,
      });

    res.status(200).json({
      message: "Cập nhật hóa đơn thành công",
      success: true,
      data: bill,
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
