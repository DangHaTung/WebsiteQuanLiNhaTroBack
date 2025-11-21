// Service tự động tạo hóa đơn hàng tháng cho các phòng
import mongoose from "mongoose";
import Contract from "../../models/contract.model.js";
import Bill from "../../models/bill.model.js";
import Room from "../../models/room.model.js";
import RoomFee from "../../models/roomFee.model.js";
import UtilityFee from "../../models/utilityFee.model.js";
import { calculateElectricityCost, DEFAULT_ELECTRICITY_TIERS } from "../utility/electricity.service.js";

const toDec = (n) => mongoose.Types.Decimal128.fromString(Number(n).toFixed(2));
const toNum = (d) => (d === null || d === undefined ? 0 : parseFloat(d.toString()));

/**
 * Tính toán các khoản phí cho một phòng
 * @param {Object} params - Tham số tính toán
 * @param {string} params.roomId - ID phòng
 * @param {number} params.electricityKwh - Số điện tiêu thụ (kWh)
 * @param {number} params.waterM3 - Số nước tiêu thụ (m3) - KHÔNG SỬ DỤNG, tiền nước tính theo số người
 * @param {number} params.occupantCount - Số người ở
 * @returns {Promise<{lineItems: Array, totalAmount: number, breakdown: Object}>}
 */
export async function calculateRoomMonthlyFees({
  roomId,
  electricityKwh = 0,
  waterM3 = 0, // Tham số này không được sử dụng, giữ lại để tương thích API
  occupantCount = 1,
  vehicleCount = 0, // Số lượng xe (cho phí đỗ xe)
  excludeRent = false, // Tham số mới: bỏ tiền thuê phòng
}) {
  // Lấy thông tin phòng
  const room = await Room.findById(roomId);
  if (!room) {
    throw new Error(`Không tìm thấy phòng với ID: ${roomId}`);
  }

  // Lấy cấu hình phí của phòng
  const roomFee = await RoomFee.findOne({ roomId, isActive: true });
  if (!roomFee) {
    throw new Error(`Phòng ${room.roomNumber} chưa được cấu hình phí dịch vụ`);
  }

  const lineItems = [];
  const breakdown = {};
  let totalAmount = 0;

  // 1. Tiền thuê phòng (từ contract) - chỉ tính nếu không excludeRent
  if (!excludeRent) {
  const monthlyRent = toNum(room.pricePerMonth);
  if (monthlyRent > 0) {
    lineItems.push({
      item: `Tiền thuê phòng ${room.roomNumber}`,
      quantity: 1,
      unitPrice: toDec(monthlyRent),
      lineTotal: toDec(monthlyRent),
    });
    breakdown.rent = monthlyRent;
    totalAmount += monthlyRent;
    }
  }

  // 2. Tiền điện (theo bậc thang)
  if (roomFee.appliedTypes.includes("electricity") && electricityKwh > 0) {
    const activeElec = await UtilityFee.findOne({ type: "electricity", isActive: true });
    const tiers = activeElec?.electricityTiers?.length ? activeElec.electricityTiers : DEFAULT_ELECTRICITY_TIERS;
    const vatPercent = typeof activeElec?.vatPercent === "number" ? activeElec.vatPercent : 8;
    
    // Debug logging
    console.log(`[calculateRoomMonthlyFees] Electricity calculation: kwh=${electricityKwh}, tiers count=${tiers?.length || 0}, vatPercent=${vatPercent}`);
    if (tiers && tiers.length > 0) {
      console.log(`[calculateRoomMonthlyFees] Tiers from DB:`, JSON.stringify(tiers, null, 2));
    } else {
      console.log(`[calculateRoomMonthlyFees] Using DEFAULT_ELECTRICITY_TIERS`);
    }
    
    const elecResult = calculateElectricityCost(electricityKwh, tiers, vatPercent);
    
    console.log(`[calculateRoomMonthlyFees] Electricity result: subtotal=${elecResult.subtotal}, vat=${elecResult.vat}, total=${elecResult.total}`);
    if (elecResult.items && elecResult.items.length > 0) {
      console.log(`[calculateRoomMonthlyFees] Electricity items:`, JSON.stringify(elecResult.items, null, 2));
    }
    
    lineItems.push({
      item: `Tiền điện (${electricityKwh} kWh)`,
      quantity: electricityKwh,
      unitPrice: toDec(elecResult.subtotal / electricityKwh), // Giá trung bình
      lineTotal: toDec(elecResult.total),
    });
    
    breakdown.electricity = {
      kwh: electricityKwh,
      subtotal: elecResult.subtotal,
      vat: elecResult.vat,
      total: elecResult.total,
      tiers: elecResult.items,
    };
    totalAmount += elecResult.total;
  }

  // 3. Tiền nước (tính theo số người)
  if (roomFee.appliedTypes.includes("water") && occupantCount > 0) {
    const activeWater = await UtilityFee.findOne({ type: "water", isActive: true });
    const waterRate = activeWater?.baseRate || 0;
    
    if (waterRate > 0) {
      const waterAmount = waterRate * occupantCount;
      
      lineItems.push({
        item: `Tiền nước (${occupantCount} người)`,
        quantity: occupantCount,
        unitPrice: toDec(waterRate),
        lineTotal: toDec(waterAmount),
      });
      
      breakdown.water = {
        occupantCount,
        rate: waterRate,
        total: waterAmount,
        note: "Tính theo số người",
      };
      totalAmount += waterAmount;
    }
  }

  // 4. Tiền internet (flat rate)
  if (roomFee.appliedTypes.includes("internet")) {
    const activeInternet = await UtilityFee.findOne({ type: "internet", isActive: true });
    const internetRate = activeInternet?.baseRate || 0;
    
    if (internetRate > 0) {
      lineItems.push({
        item: "Tiền internet",
        quantity: 1,
        unitPrice: toDec(internetRate),
        lineTotal: toDec(internetRate),
      });
      
      breakdown.internet = {
        rate: internetRate,
        total: internetRate,
      };
      totalAmount += internetRate;
    }
  }

  // 5. Phí dọn dẹp (theo số người)
  if (roomFee.appliedTypes.includes("cleaning") && occupantCount > 0) {
    const activeCleaning = await UtilityFee.findOne({ type: "cleaning", isActive: true });
    const cleaningRate = activeCleaning?.baseRate || 0;
    
    if (cleaningRate > 0) {
      const cleaningAmount = cleaningRate * occupantCount;
      
      lineItems.push({
        item: `Phí dọn dẹp (${occupantCount} người)`,
        quantity: occupantCount,
        unitPrice: toDec(cleaningRate),
        lineTotal: toDec(cleaningAmount),
      });
      
      breakdown.cleaning = {
        occupantCount,
        rate: cleaningRate,
        total: cleaningAmount,
      };
      totalAmount += cleaningAmount;
    }
  }

  // 6. Phí đỗ xe (theo số xe, không phải số người)
  if (roomFee.appliedTypes.includes("parking") && vehicleCount > 0) {
    const activeParking = await UtilityFee.findOne({ type: "parking", isActive: true });
    const parkingRate = activeParking?.baseRate || 0;
    
    if (parkingRate > 0) {
      const parkingAmount = parkingRate * vehicleCount;
      
      lineItems.push({
        item: `Phí đỗ xe (${vehicleCount} xe)`,
        quantity: vehicleCount,
        unitPrice: toDec(parkingRate),
        lineTotal: toDec(parkingAmount),
      });
      
      breakdown.parking = {
        vehicleCount: vehicleCount,
        rate: parkingRate,
        total: parkingAmount,
      };
      totalAmount += parkingAmount;
    }
  }

  return {
    lineItems,
    totalAmount,
    breakdown,
  };
}

/**
 * Tạo hóa đơn hàng tháng cho một phòng cụ thể
 * @param {Object} params - Tham số tạo hóa đơn
 * @param {string} params.contractId - ID hợp đồng
 * @param {number} params.electricityKwh - Số điện tiêu thụ
 * @param {number} params.waterM3 - Số nước tiêu thụ
 * @param {number} params.occupantCount - Số người ở
 * @param {Date} params.billingDate - Ngày lập hóa đơn
 * @param {string} params.note - Ghi chú
 * @returns {Promise<Object>} - Bill đã tạo
 */
export async function createMonthlyBillForRoom({
  contractId,
  electricityKwh = 0,
  waterM3 = 0,
  occupantCount = 1,
  billingDate = new Date(),
  note = "",
}) {
  // Lấy thông tin hợp đồng
  const contract = await Contract.findById(contractId)
    .populate("roomId")
    .populate("tenantId", "fullName email phone");
  
  if (!contract) {
    throw new Error(`Không tìm thấy hợp đồng với ID: ${contractId}`);
  }

  if (contract.status !== "ACTIVE") {
    throw new Error(`Hợp đồng ${contractId} không ở trạng thái ACTIVE`);
  }

  const room = contract.roomId;
  if (!room) {
    throw new Error(`Không tìm thấy thông tin phòng cho hợp đồng ${contractId}`);
  }

  // Kiểm tra xem đã có hóa đơn cho tháng này chưa
  const billingMonth = new Date(billingDate);
    const startOfMonth = new Date(billingMonth.getFullYear(), billingMonth.getMonth(), 1);
    const endOfMonth = new Date(billingMonth.getFullYear(), billingMonth.getMonth() + 1, 0, 23, 59, 59);

  // Nếu đang tạo DRAFT bill (electricityKwh = 0), xóa draft cũ trước (cho phép tạo lại)
  if (electricityKwh === 0) {
    const existingDraftBill = await Bill.findOne({
      contractId,
      status: "DRAFT",
      billType: "MONTHLY",
      billingDate: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    });

    if (existingDraftBill) {
      console.log(`[createMonthlyBillForRoom] Xóa draft bill cũ: ${existingDraftBill._id} cho phòng ${room.roomNumber}`);
      await Bill.deleteOne({ _id: existingDraftBill._id });
    }
  }

  // [TEST MODE] Comment out để cho phép tạo lại bill nhiều lần
  // Kiểm tra xem đã có hóa đơn đã phát hành (UNPAID/PAID) cho tháng này chưa
  // Không cho phép tạo lại nếu đã có bill đã phát hành
  // const existingPublishedBill = await Bill.findOne({
  //   contractId,
  //   status: { $in: ["UNPAID", "PARTIALLY_PAID", "PAID"] },
  //   billType: "MONTHLY",
  //   billingDate: {
  //     $gte: startOfMonth,
  //     $lte: endOfMonth,
  //   },
  // });

  // if (existingPublishedBill) {
  //   throw new Error(
  //     `Đã tồn tại hóa đơn đã phát hành tháng ${billingMonth.getMonth() + 1}/${billingMonth.getFullYear()} cho phòng ${room.roomNumber}`
  //     );
  // }

  // Tính toán các khoản phí
  const feeCalculation = await calculateRoomMonthlyFees({
    roomId: room._id,
    electricityKwh,
    waterM3,
    occupantCount,
  });

  // Tạo hóa đơn mới
  // Nếu electricityKwh = 0, tạo bill DRAFT (nháp), ngược lại tạo UNPAID
  const billStatus = electricityKwh === 0 ? "DRAFT" : "UNPAID";
  
  const bill = new Bill({
    contractId,
    billingDate: new Date(billingDate),
    billType: "MONTHLY",
    status: billStatus,
    lineItems: feeCalculation.lineItems,
    amountDue: toDec(feeCalculation.totalAmount),
    amountPaid: toDec(0),
    payments: [],
    note: note || `Hóa đơn tháng ${billingMonth.getMonth() + 1}/${billingMonth.getFullYear()} - Phòng ${room.roomNumber}`,
  });

  await bill.save();

  return {
    bill,
    breakdown: feeCalculation.breakdown,
    room: {
      id: room._id,
      roomNumber: room.roomNumber,
    },
    tenant: contract.tenantId ? {
      id: contract.tenantId._id,
      fullName: contract.tenantId.fullName,
      email: contract.tenantId.email,
      phone: contract.tenantId.phone,
    } : null,
  };
}

/**
 * Tạo hóa đơn hàng tháng cho tất cả các phòng đang có hợp đồng ACTIVE
 * @param {Object} params - Tham số
 * @param {Date} params.billingDate - Ngày lập hóa đơn
 * @param {Object} params.roomUsageData - Dữ liệu tiêu thụ theo phòng { roomId: { electricityKwh, waterM3, occupantCount } }
 * @returns {Promise<{success: Array, failed: Array, summary: Object}>}
 */
export async function createMonthlyBillsForAllRooms({
  billingDate = new Date(),
  roomUsageData = {},
}) {
  const FinalContract = (await import("../../models/finalContract.model.js")).default;
  const results = {
    success: [],
    failed: [],
    summary: {
      total: 0,
      created: 0,
      skipped: 0,
      errors: 0,
    },
  };

  // Lấy tất cả hợp đồng ACTIVE
  const activeContracts = await Contract.find({ status: "ACTIVE" })
    .populate("roomId")
    .populate("tenantId", "fullName email phone");

  results.summary.total = activeContracts.length;

  for (const contract of activeContracts) {
    try {
      const room = contract.roomId;
      if (!room) {
        results.failed.push({
          contractId: contract._id,
          error: "Không tìm thấy thông tin phòng",
        });
        results.summary.errors++;
        continue;
      }

      // ✅ VALIDATION: Chỉ tạo bill MONTHLY nếu:
      // 1. Có FinalContract SIGNED
      // 2. Bill CONTRACT đã PAID
      
      // Kiểm tra FinalContract
      const finalContract = await FinalContract.findOne({ 
        originContractId: contract._id,
        status: "SIGNED"
      });
      
      if (!finalContract) {
        results.failed.push({
          contractId: contract._id,
          roomNumber: room.roomNumber,
          error: "Chưa có hợp đồng chính thức (FinalContract) hoặc chưa ký",
        });
        results.summary.skipped++;
        continue;
      }

      // Kiểm tra Bill CONTRACT đã thanh toán chưa
      const contractBill = await Bill.findOne({
        contractId: contract._id,
        billType: "CONTRACT",
      });
      
      if (!contractBill || contractBill.status !== "PAID") {
        results.failed.push({
          contractId: contract._id,
          roomNumber: room.roomNumber,
          error: "Bill CONTRACT (tháng đầu) chưa thanh toán",
        });
        results.summary.skipped++;
        continue;
      }

      // Lấy dữ liệu tiêu thụ cho phòng này (nếu có)
      const usage = roomUsageData[room._id.toString()] || {};
      const electricityKwh = usage.electricityKwh || 0;
      const waterM3 = usage.waterM3 || 0;
      const occupantCount = usage.occupantCount || 1;

      // Tạo hóa đơn
      const result = await createMonthlyBillForRoom({
        contractId: contract._id,
        electricityKwh,
        waterM3,
        occupantCount,
        billingDate,
      });

      results.success.push({
        billId: result.bill._id,
        contractId: contract._id,
        roomNumber: result.room.roomNumber,
        tenantName: result.tenant?.fullName || "N/A",
        totalAmount: toNum(result.bill.amountDue),
        breakdown: result.breakdown,
      });
      results.summary.created++;
    } catch (error) {
      // Nếu lỗi là "đã tồn tại hóa đơn", đánh dấu là skipped
      if (error.message.includes("Đã tồn tại hóa đơn")) {
        results.failed.push({
          contractId: contract._id,
          roomNumber: contract.roomId?.roomNumber || "N/A",
          error: error.message,
          type: "SKIPPED",
        });
        results.summary.skipped++;
      } else {
        results.failed.push({
          contractId: contract._id,
          roomNumber: contract.roomId?.roomNumber || "N/A",
          error: error.message,
          type: "ERROR",
        });
        results.summary.errors++;
      }
    }
  }

  return results;
}

export default {
  calculateRoomMonthlyFees,
  createMonthlyBillForRoom,
  createMonthlyBillsForAllRooms,
};
