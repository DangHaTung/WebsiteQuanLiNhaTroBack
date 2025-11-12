// Controller xử lý tạo hóa đơn hàng tháng
import mongoose from "mongoose";
import {
  createMonthlyBillForRoom,
  createMonthlyBillsForAllRooms,
  calculateRoomMonthlyFees,
} from "../services/billing/monthlyBill.service.js";
import Contract from "../models/contract.model.js";
import Bill from "../models/bill.model.js";
import Room from "../models/room.model.js";
import User from "../models/user.model.js";
import { sendBillNotificationToTenant } from "../services/email/notification.service.js";

const toNum = (d) => (d === null || d === undefined ? 0 : parseFloat(d.toString()));

/**
 * Tính toán preview các khoản phí cho một phòng (không tạo bill)
 * GET /api/monthly-bills/preview/:contractId
 * Note: waterM3 không được sử dụng, tiền nước là flat rate cố định
 */
export const previewMonthlyBill = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { electricityKwh = 0, waterM3 = 0, occupantCount = 1 } = req.query; // waterM3 giữ lại để tương thích

    if (!mongoose.isValidObjectId(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Contract ID không hợp lệ",
      });
    }

    // Lấy thông tin hợp đồng
    const contract = await Contract.findById(contractId).populate("roomId");
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    if (contract.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Hợp đồng không ở trạng thái ACTIVE",
      });
    }

    // Tính toán các khoản phí
    const calculation = await calculateRoomMonthlyFees({
      roomId: contract.roomId._id,
      electricityKwh: Number(electricityKwh),
      waterM3: Number(waterM3),
      occupantCount: Number(occupantCount),
    });

    res.status(200).json({
      success: true,
      message: "Tính toán hóa đơn thành công",
      data: {
        contractId,
        roomNumber: contract.roomId.roomNumber,
        lineItems: calculation.lineItems.map((item) => ({
          item: item.item,
          quantity: item.quantity,
          unitPrice: toNum(item.unitPrice),
          lineTotal: toNum(item.lineTotal),
        })),
        totalAmount: calculation.totalAmount,
        breakdown: calculation.breakdown,
      },
    });
  } catch (error) {
    console.error("previewMonthlyBill error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tính toán hóa đơn",
      error: error.message,
    });
  }
};

/**
 * Tạo hóa đơn hàng tháng cho một phòng cụ thể
 * POST /api/monthly-bills/create-single
 * Note: waterM3 không được sử dụng, tiền nước là flat rate cố định 100,000 VNĐ/tháng
 */
export const createSingleMonthlyBill = async (req, res) => {
  try {
    const {
      contractId,
      electricityKwh = 0,
      waterM3 = 0, // Không sử dụng, giữ lại để tương thích API
      occupantCount = 1,
      billingDate,
      note,
    } = req.body;

    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: "contractId là bắt buộc",
      });
    }

    if (!mongoose.isValidObjectId(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Contract ID không hợp lệ",
      });
    }

    // Tạo hóa đơn
    const result = await createMonthlyBillForRoom({
      contractId,
      electricityKwh: Number(electricityKwh),
      waterM3: Number(waterM3),
      occupantCount: Number(occupantCount),
      billingDate: billingDate ? new Date(billingDate) : new Date(),
      note,
    });

    res.status(201).json({
      success: true,
      message: "Tạo hóa đơn hàng tháng thành công",
      data: {
        billId: result.bill._id,
        contractId: result.bill.contractId,
        roomNumber: result.room.roomNumber,
        tenantName: result.tenant?.fullName || "N/A",
        billingDate: result.bill.billingDate,
        totalAmount: toNum(result.bill.amountDue),
        status: result.bill.status,
        lineItems: result.bill.lineItems.map((item) => ({
          item: item.item,
          quantity: item.quantity,
          unitPrice: toNum(item.unitPrice),
          lineTotal: toNum(item.lineTotal),
        })),
        breakdown: result.breakdown,
      },
    });
  } catch (error) {
    console.error("createSingleMonthlyBill error:", error);
    
    // Xử lý lỗi cụ thể
    if (error.message.includes("Đã tồn tại hóa đơn")) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo hóa đơn",
      error: error.message,
    });
  }
};

/**
 * Tạo hóa đơn hàng tháng cho tất cả các phòng đang có hợp đồng ACTIVE
 * POST /api/monthly-bills/create-batch
 */
export const createBatchMonthlyBills = async (req, res) => {
  try {
    const { billingDate, roomUsageData = {} } = req.body;

    // Validate roomUsageData format
    // Expected: { "roomId1": { electricityKwh: 100, waterM3: 5, occupantCount: 2 }, ... }
    if (typeof roomUsageData !== "object") {
      return res.status(400).json({
        success: false,
        message: "roomUsageData phải là object",
      });
    }

    // Tạo hóa đơn cho tất cả phòng
    const results = await createMonthlyBillsForAllRooms({
      billingDate: billingDate ? new Date(billingDate) : new Date(),
      roomUsageData,
    });

    res.status(200).json({
      success: true,
      message: `Đã tạo ${results.summary.created} hóa đơn thành công`,
      data: {
        summary: results.summary,
        success: results.success,
        failed: results.failed,
      },
    });
  } catch (error) {
    console.error("createBatchMonthlyBills error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo hóa đơn hàng loạt",
      error: error.message,
    });
  }
};

/**
 * Tạo hóa đơn hàng tháng tự động (không cần dữ liệu tiêu thụ)
 * Sử dụng giá trị mặc định: electricityKwh=0, waterM3=0, occupantCount=1
 * POST /api/monthly-bills/auto-generate
 */
export const autoGenerateMonthlyBills = async (req, res) => {
  try {
    const { billingDate } = req.body;

    // Tạo hóa đơn với giá trị mặc định
    const results = await createMonthlyBillsForAllRooms({
      billingDate: billingDate ? new Date(billingDate) : new Date(),
      roomUsageData: {}, // Không có dữ liệu tiêu thụ, sẽ dùng giá trị mặc định
    });

    res.status(200).json({
      success: true,
      message: `Tự động tạo ${results.summary.created} hóa đơn thành công`,
      data: {
        summary: results.summary,
        success: results.success,
        failed: results.failed,
      },
    });
  } catch (error) {
    console.error("autoGenerateMonthlyBills error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tự động tạo hóa đơn",
      error: error.message,
    });
  }
};

/**
 * Gửi email thông báo hóa đơn cho tenant (thủ công)
 * POST /api/monthly-bills/send-notification/:billId
 */
export const sendBillNotification = async (req, res) => {
  try {
    const { billId } = req.params;
    
    // Validate billId
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({
        success: false,
        message: "Bill ID không hợp lệ",
      });
    }
    
    // Lấy thông tin bill
    const bill = await Bill.findById(billId).populate('contractId');
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }
    
    // Kiểm tra bill type
    if (bill.billType !== 'MONTHLY') {
      return res.status(400).json({
        success: false,
        message: "Chỉ gửi thông báo cho hóa đơn hàng tháng",
      });
    }
    
    // Lấy thông tin contract
    const contract = bill.contractId;
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng liên kết",
      });
    }
    
    // Lấy thông tin tenant
    const tenant = await User.findById(contract.tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin người thuê",
      });
    }
    
    if (!tenant.email) {
      return res.status(400).json({
        success: false,
        message: "Người thuê chưa có email",
      });
    }
    
    // Lấy thông tin phòng
    const room = await Room.findById(contract.roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin phòng",
      });
    }
    
    // Gửi email
    const emailResult = await sendBillNotificationToTenant({
      tenant,
      bill: {
        ...bill.toObject(),
        amountDue: toNum(bill.amountDue),
        billingDate: bill.billingDate,
        status: bill.status,
      },
      room,
    });
    
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Không thể gửi email",
        error: emailResult.error || emailResult.message,
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Đã gửi email thông báo thành công",
      data: {
        billId: bill._id,
        tenantEmail: tenant.email,
        tenantName: tenant.fullName,
        roomNumber: room.roomNumber,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error sending bill notification:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi gửi thông báo",
      error: error.message,
    });
  }
};

export default {
  previewMonthlyBill,
  createSingleMonthlyBill,
  createBatchMonthlyBills,
  autoGenerateMonthlyBills,
  sendBillNotification,
};

/**
 * Trigger cron job thủ công (dùng cho testing hoặc chạy ngay)
 * POST /api/monthly-bills/trigger-job
 */
export const triggerMonthlyBillingJob = async (req, res) => {
  try {
    console.log('🔧 Admin trigger job tạo hóa đơn thủ công...');
    
    const { billingDate } = req.body;
    
    const results = await createMonthlyBillsForAllRooms({
      billingDate: billingDate ? new Date(billingDate) : new Date(),
      roomUsageData: {},
    });
    
    res.status(200).json({
      success: true,
      message: `Job hoàn tất: Đã tạo ${results.summary.created} hóa đơn`,
      data: {
        summary: results.summary,
        success: results.success,
        failed: results.failed,
        triggeredBy: req.user.email,
        triggeredAt: new Date(),
      },
    });
  } catch (error) {
    console.error("triggerMonthlyBillingJob error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi chạy job",
      error: error.message,
    });
  }
};
