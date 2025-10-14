import Contract from "../models/contract.model.js";
import Bill from "../models/bill.model.js";
import Room from "../models/room.model.js";
import Tenant from "../models/tenant.model.js";

// Kiểm tra và cập nhật trạng thái hợp đồng hết hạn
export const checkExpiredContracts = async () => {
  try {
    const today = new Date();
    const expiredContracts = await Contract.find({
      endDate: { $lt: today },
      status: "ACTIVE"
    });

    for (const contract of expiredContracts) {
      // Cập nhật trạng thái hợp đồng
      contract.status = "EXPIRED";
      await contract.save();

      // Cập nhật trạng thái phòng về AVAILABLE
      await Room.findByIdAndUpdate(contract.roomId, {
        status: "AVAILABLE",
        currentContractSummary: null
      });

      console.log(`Contract ${contract._id} expired and room ${contract.roomId} is now available`);
    }

    return {
      success: true,
      message: `Updated ${expiredContracts.length} expired contracts`,
      count: expiredContracts.length
    };
  } catch (error) {
    console.error("Error checking expired contracts:", error);
    throw error;
  }
};

// Tự động tạo hóa đơn hàng tháng
export const generateMonthlyBills = async () => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Lấy tất cả hợp đồng đang hoạt động
    const activeContracts = await Contract.find({
      status: "ACTIVE",
      startDate: { $lte: today },
      endDate: { $gte: today }
    }).populate("roomId");

    const generatedBills = [];

    for (const contract of activeContracts) {
      // Kiểm tra xem đã có hóa đơn cho tháng này chưa
      const existingBill = await Bill.findOne({
        contractId: contract._id,
        month: currentMonth,
        year: currentYear
      });

      if (!existingBill) {
        // Tính toán ngày đến hạn (thường là ngày 5 của tháng sau)
        const dueDate = new Date(currentYear, currentMonth, 5); // Tháng sau, ngày 5

        const billData = {
          contractId: contract._id,
          month: currentMonth,
          year: currentYear,
          rentAmount: contract.monthlyRent,
          utilitiesAmount: 0, // Có thể tính toán dựa trên chỉ số điện nước
          otherFees: 0,
          totalAmount: contract.monthlyRent,
          dueDate: dueDate,
          status: "PENDING",
          notes: `Hóa đơn tháng ${currentMonth}/${currentYear}`
        };

        const bill = new Bill(billData);
        await bill.save();
        generatedBills.push(bill);

        console.log(`Generated bill for contract ${contract._id}, month ${currentMonth}/${currentYear}`);
      }
    }

    return {
      success: true,
      message: `Generated ${generatedBills.length} monthly bills`,
      count: generatedBills.length,
      bills: generatedBills
    };
  } catch (error) {
    console.error("Error generating monthly bills:", error);
    throw error;
  }
};

// Kiểm tra và cập nhật trạng thái hóa đơn quá hạn
export const checkOverdueBills = async () => {
  try {
    const today = new Date();
    
    const overdueBills = await Bill.find({
      dueDate: { $lt: today },
      status: "PENDING"
    });

    for (const bill of overdueBills) {
      bill.status = "OVERDUE";
      await bill.save();
    }

    return {
      success: true,
      message: `Updated ${overdueBills.length} overdue bills`,
      count: overdueBills.length
    };
  } catch (error) {
    console.error("Error checking overdue bills:", error);
    throw error;
  }
};

// Kiểm tra tính khả dụng của phòng khi tạo hợp đồng
export const checkRoomAvailability = async (roomId, startDate, endDate) => {
  try {
    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status !== "AVAILABLE") {
      throw new Error("Room is not available");
    }

    // Kiểm tra xem có hợp đồng nào trùng lịch không
    const conflictingContract = await Contract.findOne({
      roomId: roomId,
      status: "ACTIVE",
      $or: [
        {
          startDate: { $lte: endDate },
          endDate: { $gte: startDate }
        }
      ]
    });

    if (conflictingContract) {
      throw new Error("Room is already booked for this period");
    }

    return {
      success: true,
      message: "Room is available for the specified period"
    };
  } catch (error) {
    throw error;
  }
};

// Cập nhật trạng thái phòng khi tạo hợp đồng
export const updateRoomStatusOnContract = async (roomId, contractId, tenantInfo) => {
  try {
    const contract = await Contract.findById(contractId).populate("tenantId");
    if (!contract) {
      throw new Error("Contract not found");
    }

    await Room.findByIdAndUpdate(roomId, {
      status: "OCCUPIED",
      currentContractSummary: {
        contractId: contractId,
        tenantName: contract.tenantId.fullName,
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyRent: contract.monthlyRent
      }
    });

    return {
      success: true,
      message: "Room status updated successfully"
    };
  } catch (error) {
    throw error;
  }
};

// Thống kê tổng quan hệ thống
export const getSystemStats = async () => {
  try {
    const [
      totalRooms,
      availableRooms,
      occupiedRooms,
      totalTenants,
      activeContracts,
      expiredContracts,
      pendingBills,
      paidBills,
      overdueBills,
      totalRevenue
    ] = await Promise.all([
      Room.countDocuments(),
      Room.countDocuments({ status: "AVAILABLE" }),
      Room.countDocuments({ status: "OCCUPIED" }),
      Tenant.countDocuments(),
      Contract.countDocuments({ status: "ACTIVE" }),
      Contract.countDocuments({ status: "EXPIRED" }),
      Bill.countDocuments({ status: "PENDING" }),
      Bill.countDocuments({ status: "PAID" }),
      Bill.countDocuments({ status: "OVERDUE" }),
      Bill.aggregate([
        { $match: { status: "PAID" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ])
    ]);

    return {
      success: true,
      data: {
        rooms: {
          total: totalRooms,
          available: availableRooms,
          occupied: occupiedRooms,
          maintenance: totalRooms - availableRooms - occupiedRooms
        },
        tenants: {
          total: totalTenants
        },
        contracts: {
          active: activeContracts,
          expired: expiredContracts
        },
        bills: {
          pending: pendingBills,
          paid: paidBills,
          overdue: overdueBills
        },
        revenue: {
          total: totalRevenue[0]?.total || 0
        }
      }
    };
  } catch (error) {
    console.error("Error getting system stats:", error);
    throw error;
  }
};

// Chạy tất cả các tác vụ định kỳ
export const runScheduledTasks = async () => {
  try {
    console.log("Running scheduled tasks...");
    
    const [expiredResult, billsResult, overdueResult] = await Promise.all([
      checkExpiredContracts(),
      generateMonthlyBills(),
      checkOverdueBills()
    ]);

    return {
      success: true,
      message: "Scheduled tasks completed successfully",
      results: {
        expiredContracts: expiredResult,
        monthlyBills: billsResult,
        overdueBills: overdueResult
      }
    };
  } catch (error) {
    console.error("Error running scheduled tasks:", error);
    throw error;
  }
};
