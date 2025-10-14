import {
  checkExpiredContracts,
  generateMonthlyBills,
  checkOverdueBills,
  checkRoomAvailability,
  updateRoomStatusOnContract,
  getSystemStats,
  runScheduledTasks
} from "../services/business.service.js";

// Kiểm tra hợp đồng hết hạn
export const checkExpiredContractsController = async (req, res) => {
  try {
    const result = await checkExpiredContracts();
    res.json({
      success: true,
      message: "Expired contracts checked successfully",
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking expired contracts",
      error: error.message
    });
  }
};

// Tạo hóa đơn hàng tháng
export const generateMonthlyBillsController = async (req, res) => {
  try {
    const result = await generateMonthlyBills();
    res.json({
      success: true,
      message: "Monthly bills generated successfully",
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error generating monthly bills",
      error: error.message
    });
  }
};

// Kiểm tra hóa đơn quá hạn
export const checkOverdueBillsController = async (req, res) => {
  try {
    const result = await checkOverdueBills();
    res.json({
      success: true,
      message: "Overdue bills checked successfully",
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking overdue bills",
      error: error.message
    });
  }
};

// Kiểm tra tính khả dụng của phòng
export const checkRoomAvailabilityController = async (req, res) => {
  try {
    const { roomId, startDate, endDate } = req.body;
    const result = await checkRoomAvailability(roomId, new Date(startDate), new Date(endDate));
    res.json({
      success: true,
      message: "Room availability checked successfully",
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Room availability check failed",
      error: error.message
    });
  }
};

// Lấy thống kê hệ thống
export const getSystemStatsController = async (req, res) => {
  try {
    const result = await getSystemStats();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error getting system statistics",
      error: error.message
    });
  }
};

// Chạy tất cả tác vụ định kỳ
export const runScheduledTasksController = async (req, res) => {
  try {
    const result = await runScheduledTasks();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error running scheduled tasks",
      error: error.message
    });
  }
};
