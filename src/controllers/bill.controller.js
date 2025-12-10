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
  lineItems:
    bill.lineItems?.map((item) => {
      const plainItem = item.toObject ? item.toObject() : item;
      return {
        ...plainItem,
        unitPrice: convertDecimal128(plainItem.unitPrice),
        lineTotal: convertDecimal128(plainItem.lineTotal),
      };
    }) || [],
  payments:
    bill.payments?.map((payment) => ({
      ...payment,
      amount: convertDecimal128(payment.amount),
    })) || [],
});

/**
 * Helper: Lấy tất cả contractIds và finalContractIds của user
 * Bao gồm cả co-tenant
 */
const getUserContractIds = async (userId) => {
  const FinalContract = (await import("../models/finalContract.model.js"))
    .default;

  // Tìm tất cả FinalContracts của user
  const finalContracts = await FinalContract.find({ tenantId: userId }).select(
    "_id"
  );
  const finalContractIds = finalContracts.map((fc) => fc._id);

  // Tìm Contracts (bao gồm co-tenants)
  const contracts = await Contract.find({
    $or: [
      { tenantId: userId }, // User là người chính
      { "coTenants.userId": userId }, // User là người ở cùng
    ],
  }).select("_id");
  const contractIds = contracts.map((c) => c._id);

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

    // Lấy tất cả FinalContractIds (bao gồm cả đã hủy) để lấy bills đã thanh toán
    const FinalContract = (await import("../models/finalContract.model.js"))
      .default;
    const allFinalContracts = await FinalContract.find({
      _id: { $in: finalContractIds },
    }).select("_id status");
    const activeFinalContractIds = allFinalContracts
      .filter(fc => fc.status !== "CANCELED")
      .map((fc) => fc._id);
    const canceledFinalContractIds = allFinalContracts
      .filter(fc => fc.status === "CANCELED")
      .map((fc) => fc._id);

    // Tìm bills từ cả Contract và FinalContract, hoặc bills có tenantId = userId (RECEIPT bills)
    const filterConditions = [];
    if (contractIds.length > 0) {
      filterConditions.push({ contractId: { $in: contractIds } });
    }
    // Lấy bills từ FinalContract chưa hủy (tất cả bills)
    if (activeFinalContractIds.length > 0) {
      filterConditions.push({
        finalContractId: { $in: activeFinalContractIds },
      });
    }
    // Lấy bills đã thanh toán từ FinalContract đã hủy (chỉ bills PAID)
    if (canceledFinalContractIds.length > 0) {
      filterConditions.push({
        finalContractId: { $in: canceledFinalContractIds },
        status: "PAID", // Chỉ lấy bills đã thanh toán từ FinalContract đã hủy
      });
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

    let filter =
      filterConditions.length > 1
        ? { $or: filterConditions }
        : filterConditions[0];

    // Chỉ hiển thị bills đã publish (không phải DRAFT) và không bị hủy (không phải VOID)
    filter = { ...filter, status: { $nin: ["DRAFT", "VOID"] } };

    const bills = await Bill.find(filter)
      .populate("contractId")
      .populate({
        path: "finalContractId",
        select: "_id status",
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Filter thêm: loại bỏ bills chưa thanh toán của FinalContract đã bị hủy
    // Nhưng giữ lại bills đã thanh toán (PAID) ngay cả khi FinalContract đã hủy
    const filteredBills = bills.filter((bill) => {
      if (bill.finalContractId) {
        const finalContract = bill.finalContractId;
        const finalContractStatus =
          typeof finalContract === "object" && finalContract.status
            ? finalContract.status
            : null;
        // Nếu FinalContract đã bị hủy và bill chưa thanh toán, không hiển thị
        if (finalContractStatus === "CANCELED" && bill.status !== "PAID") {
          return false;
        }
      }
      return true;
    });

    // Format bills để chuyển đổi Decimal128 sang number (sử dụng filteredBills)
    const formattedBills = filteredBills.map(formatBill);
    
    // Tự động tính electricityReading cho các MONTHLY bills chưa có
    const Checkin = (await import("../models/checkin.model.js")).default;
    for (const formattedBill of formattedBills) {
      const hasValidElectricityReading = formattedBill.electricityReading && 
        (formattedBill.electricityReading.previous !== undefined || formattedBill.electricityReading.current !== undefined);
      
      if (formattedBill.billType === "MONTHLY" && !hasValidElectricityReading && formattedBill.contractId) {
        try {
          const contractId = typeof formattedBill.contractId === 'object' ? formattedBill.contractId._id : formattedBill.contractId;
          
          // Lấy số điện ban đầu từ checkin
          const checkin = await Checkin.findOne({ contractId }).select("initialElectricReading");
          const initialReading = checkin?.initialElectricReading || 0;
          
          // Lấy tổng số điện đã dùng từ các hóa đơn MONTHLY trước đó
          const previousBills = await Bill.find({
            contractId,
            billType: "MONTHLY",
            status: { $nin: ["DRAFT", "VOID"] },
            billingDate: { $lt: formattedBill.billingDate },
          }).sort({ billingDate: 1 });
          
          let totalPreviousKwh = 0;
          for (const prevBill of previousBills) {
            if (prevBill.electricityReading?.consumption) {
              totalPreviousKwh += prevBill.electricityReading.consumption;
            } else if (prevBill.lineItems) {
              for (const item of prevBill.lineItems) {
                if (item.item && item.item.includes("Tiền điện")) {
                  const match = item.item.match(/\((\d+(?:\.\d+)?)\s*kWh\)/i);
                  if (match && match[1]) {
                    totalPreviousKwh += Number(match[1]) || 0;
                  }
                }
              }
            }
          }
          
          // Parse số kWh tiêu thụ từ lineItems của bill hiện tại
          let currentConsumption = 0;
          if (formattedBill.lineItems) {
            for (const item of formattedBill.lineItems) {
              if (item.item && item.item.includes("Tiền điện")) {
                const match = item.item.match(/\((\d+(?:\.\d+)?)\s*kWh\)/i);
                if (match && match[1]) {
                  currentConsumption = Number(match[1]) || 0;
                  break;
                }
              }
            }
          }
          
          // Tính số điện cũ và mới
          const previousReading = initialReading + totalPreviousKwh;
          const currentReading = previousReading + currentConsumption;
          
          formattedBill.electricityReading = {
            previous: previousReading,
            current: currentReading,
            consumption: currentConsumption,
          };
        } catch (calcError) {
          console.error("Error calculating electricityReading:", calcError);
        }
      }
    }

    // Tính lại total: đếm tất cả bills sau khi filter (không giới hạn limit)
    // Lưu ý: pagination có thể không chính xác 100% vì filter sau khi query
    // Nhưng đây là cách tốt nhất để đảm bảo không hiển thị bills của FinalContract đã hủy
    const allBillsForCount = await Bill.find(filter).populate({
      path: "finalContractId",
      select: "_id status",
    });
    const filteredBillsForCount = allBillsForCount.filter((bill) => {
      if (bill.finalContractId) {
        const finalContract = bill.finalContractId;
        const finalContractStatus =
          typeof finalContract === "object" && finalContract.status
            ? finalContract.status
            : null;
        // Nếu FinalContract đã bị hủy và bill chưa thanh toán, không đếm
        if (finalContractStatus === "CANCELED" && bill.status !== "PAID") {
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
    const {
      page = 1,
      limit = 10,
      status,
      billType,
      contractId,
      finalContractId,
    } = req.query;
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
      .populate({
        path: "contractId",
        populate: [
          { path: "tenantId", select: "fullName email phone" },
          { path: "roomId", select: "roomNumber" },
        ],
      })
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
    const bill = await Bill.findById(req.params.id)
      .populate({
        path: "contractId",
        populate: [
          { path: "tenantId", select: "fullName email phone" },
          { path: "roomId", select: "name roomNumber" },
        ],
      })
      .populate("tenantId", "fullName email phone");
    if (!bill) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn",
        success: false,
      });
    }

    // Format bill để chuyển đổi Decimal128 sang number
    const formattedBill = formatBill(bill);
    
    // Nếu là MONTHLY bill và chưa có electricityReading đầy đủ, tự động tính từ checkin và bills trước
    const hasValidElectricityReading = bill.electricityReading && 
      (bill.electricityReading.previous !== undefined || bill.electricityReading.current !== undefined);
    
    if (bill.billType === "MONTHLY" && !hasValidElectricityReading && bill.contractId) {
      try {
        const Checkin = (await import("../models/checkin.model.js")).default;
        const contractId = typeof bill.contractId === 'object' ? bill.contractId._id : bill.contractId;
        
        // Lấy số điện ban đầu từ checkin
        const checkin = await Checkin.findOne({ contractId }).select("initialElectricReading");
        const initialReading = checkin?.initialElectricReading || 0;
        
        // Lấy tổng số điện đã dùng từ các hóa đơn MONTHLY trước đó (không phải DRAFT)
        const previousBills = await Bill.find({
          contractId,
          billType: "MONTHLY",
          status: { $nin: ["DRAFT", "VOID"] },
          billingDate: { $lt: bill.billingDate },
        }).sort({ billingDate: 1 });
        
        let totalPreviousKwh = 0;
        for (const prevBill of previousBills) {
          if (prevBill.electricityReading?.consumption) {
            totalPreviousKwh += prevBill.electricityReading.consumption;
          } else if (prevBill.lineItems) {
            // Parse từ lineItems nếu không có electricityReading
            for (const item of prevBill.lineItems) {
              if (item.item && item.item.includes("Tiền điện")) {
                const match = item.item.match(/\((\d+(?:\.\d+)?)\s*kWh\)/i);
                if (match && match[1]) {
                  totalPreviousKwh += Number(match[1]) || 0;
                }
              }
            }
          }
        }
        
        // Parse số kWh tiêu thụ từ lineItems của bill hiện tại
        let currentConsumption = 0;
        if (bill.lineItems) {
          for (const item of bill.lineItems) {
            if (item.item && item.item.includes("Tiền điện")) {
              const match = item.item.match(/\((\d+(?:\.\d+)?)\s*kWh\)/i);
              if (match && match[1]) {
                currentConsumption = Number(match[1]) || 0;
                break;
              }
            }
          }
        }
        
        // Tính số điện cũ và mới
        const previousReading = initialReading + totalPreviousKwh;
        const currentReading = previousReading + currentConsumption;
        
        // Thêm electricityReading vào formattedBill (không lưu vào DB)
        formattedBill.electricityReading = {
          previous: previousReading,
          current: currentReading,
          consumption: currentConsumption,
        };
        
        console.log(`📊 [getBillById] Calculated electricityReading for bill ${bill._id}:`, formattedBill.electricityReading);
      } catch (calcError) {
        console.error("Error calculating electricityReading:", calcError);
        // Không throw error, chỉ log
      }
    }

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

    // Tạo thông báo realtime cho tenant: Hóa đơn mới được phát hành
    try {
      const populatedBill = await Bill.findById(bill._id)
        .populate({
          path: 'contractId',
          populate: [
            { path: 'tenantId', select: 'fullName email' },
            { path: 'roomId', select: 'roomNumber' },
          ],
        });
      const notifyPayload = {
        ...populatedBill.toObject(),
        tenantId:
          populatedBill.tenantId ||
          (populatedBill.contractId?.tenantId?._id || populatedBill.contractId?.tenantId),
      };
      const notificationService = (await import('../services/notification/notification.service.js')).default;
      await notificationService.notifyBillCreated(notifyPayload);
    } catch (notifErr) {
      console.error('❌ Error sending BILL_CREATED notification:', notifErr.message);
    }

    // Populate và format bill
    const populatedBill = await Bill.findById(bill._id)
      .populate("contractId")
      .populate("tenantId", "fullName email")
      .populate("roomId", "roomNumber");
    const formattedBill = formatBill(populatedBill);

    // 📝 Log bill creation
    await logService.logCreate({
      entity: "BILL",
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
      console.error("❌ Error sending bill notification:", notifError.message);
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
    if (
      current.status === "PAID" &&
      incomingStatus &&
      incomingStatus !== "PAID"
    ) {
      return res.status(400).json({
        message:
          "Hóa đơn đã thanh toán, không thể chuyển về trạng thái khác hoặc hủy",
        success: false,
      });
    }

    // Nếu đang PARTIALLY_PAID, không cho phép chuyển về UNPAID hoặc VOID (có thể chuyển lên PAID)
    if (
      current.status === "PARTIALLY_PAID" &&
      incomingStatus &&
      ["UNPAID", "VOID"].includes(incomingStatus)
    ) {
      return res.status(400).json({
        message:
          "Hóa đơn đã thanh toán một phần, không thể chuyển về chưa thanh toán hoặc hủy",
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
        updateFields.amountPaid = mongoose.Types.Decimal128.fromString(
          String(finalAmountPaid)
        );
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
        updateFields.amountPaid = mongoose.Types.Decimal128.fromString(
          String(currentAmountPaid)
        );
      }
    }

    // Cập nhật updatedAt (pre save không chạy cho findByIdAndUpdate)
    updateFields.updatedAt = new Date();

    // Thực hiện cập nhật an toàn
    const updated = await Bill.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
    }).populate("contractId");

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
    if (!bill)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy hóa đơn" });

    // Chỉ xử lý bill chưa thanh toán hoặc đang chờ xác nhận
    if (
      !["UNPAID", "PENDING_CASH_CONFIRM", "PARTIALLY_PAID"].includes(
        bill.status
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Bill đã thanh toán hoặc không hợp lệ",
        });
    }

    const due = convertDecimal128(bill.amountDue) || 0;
    const paid = convertDecimal128(bill.amountPaid) || 0;
    const transfer = Math.max(due - paid, 0);

    // Cập nhật trạng thái và tiền
    bill.status = "PAID";
    bill.amountPaid = mongoose.Types.Decimal128.fromString(
      String(paid + transfer)
    );
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
      entity: "BILL",
      entityId: bill._id,
      actorId: req.user._id,
      amount: transfer,
      provider: "CASH",
      status: "SUCCESS",
      billDetails: {
        billType: bill.billType,
        roomNumber: bill.roomId?.roomNumber,
        tenantName: bill.tenantId?.fullName,
        month: bill.month,
      },
    });

    // 🔔 Send payment success notification
    try {
      await notificationService.notifyPaymentSuccess(bill, "CASH");
    } catch (notifError) {
      console.error(
        "❌ Error sending payment notification:",
        notifError.message
      );
    }

    // Tự động cập nhật checkin và room status nếu là bill RECEIPT đã PAID
    if (bill.billType === "RECEIPT" && bill.status === "PAID") {
      const Checkin = (await import("../models/checkin.model.js")).default;
      const Room = (await import("../models/room.model.js")).default;
      const checkin = await Checkin.findOne({
        receiptBillId: bill._id,
      }).populate("roomId");
      if (checkin) {
        // Cập nhật receiptPaidAt khi thanh toán bill RECEIPT
        // Nếu đã có receiptPaidAt (gia hạn): cộng thêm 3 ngày vào thời hạn hiện tại
        // Nếu chưa có (lần đầu): set = now (bắt đầu 3 ngày)
        const now = new Date();
        if (checkin.receiptPaidAt) {
          // Đã có receiptPaidAt cũ → gia hạn
          const oldExpirationDate = new Date(checkin.receiptPaidAt);
          oldExpirationDate.setDate(oldExpirationDate.getDate() + 3); // Thời hạn cũ (receiptPaidAt + 3 ngày)
          
          // Nếu thời hạn cũ đã hết, bắt đầu lại từ now
          // Nếu thời hạn cũ còn, cộng thêm 3 ngày vào thời hạn cũ
          const baseDate = oldExpirationDate > now ? oldExpirationDate : now;
          const newExpirationDate = new Date(baseDate);
          newExpirationDate.setDate(newExpirationDate.getDate() + 3); // Cộng thêm 3 ngày
          
          // Tính ngược lại receiptPaidAt mới (để expirationDate = receiptPaidAt + 3 ngày)
          checkin.receiptPaidAt = new Date(newExpirationDate);
          checkin.receiptPaidAt.setDate(checkin.receiptPaidAt.getDate() - 3);
        } else {
          // Lần đầu thanh toán → bắt đầu 3 ngày từ now
          checkin.receiptPaidAt = now;
        }
        
        // Chỉ set status = COMPLETED nếu đang là CREATED (tránh override status khác)
        if (checkin.status === "CREATED") {
          checkin.status = "COMPLETED";
        }
        
        await checkin.save();
        const expirationDate = new Date(checkin.receiptPaidAt);
        expirationDate.setDate(expirationDate.getDate() + 3);
        console.log(
          `✅ [CASH CONFIRM] Updated checkin ${checkin._id} after cash payment confirmation, receiptPaidAt: ${checkin.receiptPaidAt}, expirationDate: ${expirationDate}, status: ${checkin.status}`
        );

        // Cập nhật room status = DEPOSITED, occupantCount = 0
        if (checkin.roomId) {
          const room = await Room.findById(
            checkin.roomId._id || checkin.roomId
          );
          if (room) {
            room.status = "DEPOSITED";
            room.occupantCount = 0; // Chưa vào ở
            await room.save();
            console.log(
              `✅ [CASH CONFIRM] Updated room ${room._id} status to DEPOSITED`
            );
          }
        }

        // Tự động tạo account và gửi email
        try {
          const { autoCreateAccountAndSendEmail } = await import(
            "../services/user/autoCreateAccount.service.js"
          );
          await autoCreateAccountAndSendEmail(checkin);
          console.log(
            `✅ Auto-created account and sent email for checkin ${checkin._id}`
          );
        } catch (emailErr) {
          console.error(
            `❌ Failed to create account/send email for checkin ${checkin._id}:`,
            emailErr
          );
          // Không throw error để không block payment flow
        }
      }
    }

    // Cập nhật room status = OCCUPIED và occupantCount khi thanh toán CONTRACT bill
    if (
      bill.billType === "CONTRACT" &&
      bill.status === "PAID" &&
      bill.contractId
    ) {
      const Room = (await import("../models/room.model.js")).default;
      const Contract = (await import("../models/contract.model.js")).default;
      const contract = await Contract.findById(bill.contractId).populate(
        "roomId"
      );
      if (contract && contract.roomId) {
        const room = await Room.findById(
          contract.roomId._id || contract.roomId
        );
        if (room) {
          room.status = "OCCUPIED";
          const occupantCount = contract.coTenants?.length
            ? contract.coTenants.length + 1
            : 1;
          room.occupantCount = occupantCount;
          await room.save();
          console.log(
            `✅ [CASH CONFIRM] Updated room ${room._id} status to OCCUPIED, occupantCount: ${occupantCount}`
          );
        }
      }
    }

    return res
      .status(200)
      .json({
        success: true,
        message: "Xác nhận tiền mặt thành công",
        data: formatBill(bill),
      });
  } catch (err) {
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi xác nhận tiền mặt",
        error: err.message,
      });
  }
};

/**
 * rejectCashPayment
 * ----------------
 * Từ chối thanh toán tiền mặt (admin only)
 * Chuyển status từ PENDING_CASH_CONFIRM về UNPAID và lưu lý do từ chối
 */
export const rejectCashPayment = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { rejectionReason } = req.body;
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập lý do từ chối",
      });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy hóa đơn" });
    }

    // Chỉ từ chối bill đang chờ xác nhận
    if (bill.status !== "PENDING_CASH_CONFIRM") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể từ chối bill đang chờ xác nhận",
      });
    }

    // Cập nhật metadata với lý do từ chối
    if (!bill.metadata) bill.metadata = {};
    if (!bill.metadata.cashPaymentRequest) {
      bill.metadata.cashPaymentRequest = {};
    }
    bill.metadata.cashPaymentRequest.rejectionReason = rejectionReason.trim();
    bill.metadata.cashPaymentRequest.rejectedAt = new Date();
    bill.metadata.cashPaymentRequest.rejectedBy = req.user._id;

    // Chuyển status về UNPAID để khách có thể thanh toán lại
    bill.status = "UNPAID";

    await bill.save();

    // 🔔 Gửi thông báo cho khách hàng (nếu có service)
    try {
      const notificationService = (await import("../services/notification.service.js")).default;
      if (notificationService && typeof notificationService.notifyPaymentRejected === 'function') {
        await notificationService.notifyPaymentRejected(bill, rejectionReason.trim());
      }
    } catch (notifError) {
      console.error("❌ Error sending rejection notification:", notifError.message);
      // Không throw error để không block flow
    }

    return res.status(200).json({
      success: true,
      message: "Đã từ chối thanh toán",
      data: formatBill(bill),
    });
  } catch (err) {
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi từ chối thanh toán",
        error: err.message,
      });
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
      return res
        .status(403)
        .json({ success: false, message: "Bạn không có quyền hủy hóa đơn" });
    }

    const bill = await Bill.findById(req.params.id).populate("contractId");
    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy hóa đơn" });
    }

    if (bill.status === "VOID") {
      return res
        .status(200)
        .json({
          success: true,
          message: "Hóa đơn đã bị hủy trước đó",
          data: formatBill(bill),
        });
    }

    // Không cho hủy nếu đã thanh toán một phần hoặc toàn bộ
    if (bill.status === "PARTIALLY_PAID" || bill.status === "PAID") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Không thể hủy hóa đơn đã thanh toán",
        });
    }

    bill.status = "VOID";
    bill.updatedAt = new Date();
    await bill.save();
    return res
      .status(200)
      .json({
        success: true,
        message: "Đã hủy hóa đơn",
        data: formatBill(bill),
      });
  } catch (err) {
    return res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi hủy hóa đơn",
        error: err.message,
      });
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
          { path: "tenantId", select: "fullName email phone" },
        ],
      })
      .sort({ billingDate: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Bill.countDocuments({
      status: "DRAFT",
      billType: "MONTHLY",
    });

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
    const {
      electricityKwh,
      waterM3 = 0,
      occupantCount = 1,
      vehicleCount = 0, // Deprecated: dùng vehicles thay thế
      vehicles = [], // Danh sách xe chi tiết [{type, licensePlate}]
      previousReading, // Số điện cũ (kỳ trước)
      currentReading, // Số điện mới (kỳ này)
    } = req.body;

    // Tính tổng số xe từ vehicles array hoặc vehicleCount
    const totalVehicles = vehicles.length > 0 ? vehicles.length : vehicleCount;

    // Validate: số xe không được vượt quá số người
    if (totalVehicles > occupantCount) {
      return res.status(400).json({
        success: false,
        message: `Số xe (${totalVehicles}) không được vượt quá số người ở (${occupantCount})`,
      });
    }

    // Validate vehicles array
    if (vehicles.length > 0) {
      for (const vehicle of vehicles) {
        if (!['motorbike', 'electric_bike', 'bicycle'].includes(vehicle.type)) {
          return res.status(400).json({
            success: false,
            message: `Loại xe không hợp lệ: ${vehicle.type}. Chỉ chấp nhận: motorbike, electric_bike, bicycle`,
          });
        }
        // Xe máy và xe điện phải có biển số
        if (['motorbike', 'electric_bike'].includes(vehicle.type) && !vehicle.licensePlate) {
          return res.status(400).json({
            success: false,
            message: `Xe ${vehicle.type === 'motorbike' ? 'máy' : 'điện'} phải có biển số`,
          });
        }
      }
    }

    const bill = await Bill.findById(id).populate("contractId");
    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy hóa đơn" });
    }

    if (bill.status !== "DRAFT") {
      return res
        .status(400)
        .json({ success: false, message: "Chỉ có thể phát hành hóa đơn nháp" });
    }

    if (!bill.contractId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Hóa đơn không có hợp đồng liên kết",
        });
    }

    // Lấy thông tin contract và room
    const contract = await Contract.findById(bill.contractId._id).populate(
      "roomId"
    );
    if (!contract || !contract.roomId) {
      return res
        .status(400)
        .json({ success: false, message: "Không tìm thấy thông tin phòng" });
    }

    // Validation: Chặn phát hành nếu còn hóa đơn tháng trước chưa thanh toán
    // Tiêu chí: billType MONTHLY, status thuộc UNPAID | PARTIALLY_PAID | PENDING_CASH_CONFIRM,
    // cùng contractId, và billingDate trước billingDate của bill nháp hiện tại
    const previousUnpaid = await Bill.findOne({
      contractId: bill.contractId._id,
      billType: "MONTHLY",
      status: { $in: ["UNPAID", "PARTIALLY_PAID", "PENDING_CASH_CONFIRM"] },
      billingDate: { $lt: bill.billingDate },
    }).select("_id billingDate status amountDue");

    if (previousUnpaid) {
      const prevMonth = new Date(previousUnpaid.billingDate);
      const msg = `Không thể phát hành hóa đơn mới vì còn hóa đơn tháng ${prevMonth.getMonth() + 1}/${prevMonth.getFullYear()} chưa thanh toán (trạng thái: ${previousUnpaid.status}).`;
      return res.status(400).json({
        success: false,
        message: msg,
        data: { previousBillId: previousUnpaid._id },
      });
    }

    // Tính toán lại với số điện mới
    const { calculateRoomMonthlyFees } = await import(
      "../services/billing/monthlyBill.service.js"
    );
    const feeCalculation = await calculateRoomMonthlyFees({
      roomId: contract.roomId._id,
      electricityKwh: Number(electricityKwh),
      waterM3: Number(waterM3),
      occupantCount: Number(occupantCount),
      vehicleCount: vehicles.length > 0 ? 0 : Number(vehicleCount), // Nếu có vehicles thì không dùng vehicleCount
      vehicles: vehicles, // Truyền vehicles array
    });

    // Cập nhật bill
    bill.status = "UNPAID";
    bill.lineItems = feeCalculation.lineItems;
    bill.amountDue = mongoose.Types.Decimal128.fromString(
      String(feeCalculation.totalAmount)
    );
    bill.vehicles = vehicles; // Lưu thông tin xe vào bill
    
    // Lưu thông tin số điện chi tiết
    if (previousReading !== undefined && currentReading !== undefined) {
      bill.electricityReading = {
        previous: Number(previousReading),
        current: Number(currentReading),
        consumption: Number(electricityKwh),
      };
    }
    
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
    const { bills } = req.body; // Array of { billId, electricityKwh, occupantCount, vehicles }

    if (!Array.isArray(bills) || bills.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Danh sách bills không hợp lệ" });
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const item of bills) {
      try {
        const {
          billId,
          electricityKwh,
          waterM3 = 0,
          occupantCount = 1,
          vehicleCount = 0, // Deprecated
          vehicles = [], // Danh sách xe chi tiết
          previousReading, // Số điện cũ
          currentReading, // Số điện mới
        } = item;

        // Tính tổng số xe
        const totalVehicles = vehicles.length > 0 ? vehicles.length : vehicleCount;

        // Validate: số xe không được vượt quá số người
        if (totalVehicles > occupantCount) {
          results.failed.push({
            billId,
            error: `Số xe (${totalVehicles}) không được vượt quá số người ở (${occupantCount})`,
          });
          continue;
        }

        // Validate vehicles array
        if (vehicles.length > 0) {
          let vehicleError = null;
          for (const vehicle of vehicles) {
            if (!['motorbike', 'electric_bike', 'bicycle'].includes(vehicle.type)) {
              vehicleError = `Loại xe không hợp lệ: ${vehicle.type}`;
              break;
            }
            if (['motorbike', 'electric_bike'].includes(vehicle.type) && !vehicle.licensePlate) {
              vehicleError = `Xe ${vehicle.type === 'motorbike' ? 'máy' : 'điện'} phải có biển số`;
              break;
            }
          }
          if (vehicleError) {
            results.failed.push({ billId, error: vehicleError });
            continue;
          }
        }

        const bill = await Bill.findById(billId).populate("contractId");
        if (!bill || bill.status !== "DRAFT") {
          results.failed.push({
            billId,
            error: "Bill không hợp lệ hoặc không phải DRAFT",
          });
          continue;
        }

        // Validation: Chặn phát hành nếu còn hóa đơn tháng trước chưa thanh toán
        const previousUnpaid = await Bill.findOne({
          contractId: bill.contractId._id,
          billType: "MONTHLY",
          status: { $in: ["UNPAID", "PARTIALLY_PAID", "PENDING_CASH_CONFIRM"] },
          billingDate: { $lt: bill.billingDate },
        }).select("_id billingDate status amountDue");
        if (previousUnpaid) {
          const prevMonth = new Date(previousUnpaid.billingDate);
          results.failed.push({
            billId,
            error: `Còn hóa đơn tháng ${prevMonth.getMonth() + 1}/${prevMonth.getFullYear()} chưa thanh toán (trạng thái: ${previousUnpaid.status})`,
          });
          continue;
        }

        const contract = await Contract.findById(bill.contractId._id).populate(
          "roomId"
        );
        if (!contract || !contract.roomId) {
          results.failed.push({
            billId,
            error: "Không tìm thấy thông tin phòng",
          });
          continue;
        }

        // Tính toán lại
        const { calculateRoomMonthlyFees } = await import(
          "../services/billing/monthlyBill.service.js"
        );
        const feeCalculation = await calculateRoomMonthlyFees({
          roomId: contract.roomId._id,
          electricityKwh: Number(electricityKwh),
          waterM3: Number(waterM3),
          occupantCount: Number(occupantCount),
          vehicleCount: vehicles.length > 0 ? 0 : Number(vehicleCount),
          vehicles: vehicles,
        });

        // Cập nhật
        bill.status = "UNPAID";
        bill.lineItems = feeCalculation.lineItems;
        bill.amountDue = mongoose.Types.Decimal128.fromString(
          String(feeCalculation.totalAmount)
        );
        bill.vehicles = vehicles; // Lưu thông tin xe
        
        // Lưu thông tin số điện chi tiết
        if (previousReading !== undefined && currentReading !== undefined) {
          bill.electricityReading = {
            previous: Number(previousReading),
            current: Number(currentReading),
            consumption: Number(electricityKwh),
          };
        }
        
        bill.updatedAt = new Date();
        await bill.save();

        // Gửi thông báo realtime cho từng bill đã publish
        try {
          const populatedBill = await Bill.findById(bill._id)
            .populate({
              path: 'contractId',
              populate: [
                { path: 'tenantId', select: 'fullName email' },
                { path: 'roomId', select: 'roomNumber' },
              ],
            });
          const notifyPayload = {
            ...populatedBill.toObject(),
            tenantId:
              populatedBill.tenantId ||
              (populatedBill.contractId?.tenantId?._id || populatedBill.contractId?.tenantId),
          };
          const notificationService = (await import('../services/notification/notification.service.js')).default;
          await notificationService.notifyBillCreated(notifyPayload);
        } catch (notifErr) {
          console.error('❌ Error sending BILL_CREATED notification (batch):', notifErr.message);
        }

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
    const FinalContract = (await import("../models/finalContract.model.js"))
      .default;
    const finalContracts = await FinalContract.find({
      tenantId: userId,
    }).select("_id");
    const finalContractIds = finalContracts.map((fc) => fc._id);

    // Tìm tất cả Contracts của user
    const contracts = await Contract.find({ tenantId: userId }).select("_id");
    const contractIds = contracts.map((c) => c._id);

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
      status: { $in: ["UNPAID", "PARTIALLY_PAID", "PENDING_CASH_CONFIRM"] },
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
        populate: { path: "tenantId" },
      })
      .populate({
        path: "finalContractId",
        populate: { path: "tenantId" },
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
      const billTenantId =
        typeof bill.tenantId === "object"
          ? bill.tenantId._id?.toString()
          : bill.tenantId.toString();
      if (billTenantId === userIdStr) {
        hasPermission = true;
      }
    }

    // 2. Kiểm tra contractId.tenantId (CHỈ cho phép main tenant, KHÔNG cho co-tenant)
    if (!hasPermission && bill.contractId) {
      const contract = await Contract.findById(
        bill.contractId._id || bill.contractId
      ).lean();
      if (contract) {
        const contractTenantId = contract.tenantId?.toString();
        // Chỉ cho phép main tenant (contract.tenantId), KHÔNG cho co-tenant
        if (contractTenantId === userIdStr) {
          hasPermission = true;
        }
      }
    }

    // 3. Kiểm tra finalContractId.tenantId
    if (!hasPermission && bill.finalContractId) {
      const FinalContract = (await import("../models/finalContract.model.js"))
        .default;
      const finalContract = await FinalContract.findById(
        bill.finalContractId._id || bill.finalContractId
      ).lean();
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
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số tiền thanh toán không hợp lệ",
      });
    }

    // Tính balance: Với CONTRACT bill status = UNPAID hoặc PENDING_CASH_CONFIRM: amountPaid có thể là số tiền từ RECEIPT bill
    // Chỉ trừ amountPaid khi status = PARTIALLY_PAID (đã thanh toán một phần CONTRACT bill)
    const amountDue = convertDecimal128(bill.amountDue);
    const amountPaid = convertDecimal128(bill.amountPaid);
    let balance = 0;
    
    if (bill.billType === "CONTRACT" && (bill.status === "UNPAID" || bill.status === "PENDING_CASH_CONFIRM")) {
      // Với CONTRACT bill UNPAID/PENDING_CASH_CONFIRM: balance = amountDue (KHÔNG trừ amountPaid)
      balance = amountDue;
    } else {
      // Với các trường hợp khác: balance = amountDue - amountPaid
      balance = amountDue - amountPaid;
    }

    console.log("💰 requestCashPayment validation:", {
      billType: bill.billType,
      status: bill.status,
      amountNum,
      amountDue,
      amountPaid,
      balance,
    });

    if (amountNum > balance + 1) {
      return res.status(400).json({
        success: false,
        message: `Số tiền thanh toán (${amountNum.toLocaleString('vi-VN')} VNĐ) vượt quá số tiền còn lại (${balance.toLocaleString('vi-VN')} VNĐ)`,
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

    // Lưu ảnh bill chuyển khoản nếu có
    if (req.file) {
      bill.metadata.cashPaymentRequest.receiptImage = {
        url: req.file.path,
        secure_url: req.file.secure_url || req.file.path,
        public_id: req.file.filename,
        resource_type: req.file.resource_type || "image",
        format: req.file.format,
        bytes: req.file.size,
      };
      // Đảm bảo Mongoose lưu thay đổi cho trường Mixed
      try {
        bill.markModified && bill.markModified('metadata');
      } catch (e) {
        // no-op
      }
    }

    await bill.save();

    return res.status(200).json({
      success: true,
      message:
        "Đã gửi yêu cầu thanh toán tiền mặt. Vui lòng chờ admin xác nhận.",
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
    console.log(
      `✅ [CONFIRM CASH PAYMENT] Bill ${bill._id} confirmed as PAID - Checkin requires manual completion`
    );

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
    const {
      roomId,
      electricityKwh = 0,
      waterM3 = 0,
      occupantCount = 1,
      excludeRent = false,
    } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "roomId is required",
      });
    }

    const { calculateRoomMonthlyFees } = await import(
      "../services/billing/monthlyBill.service.js"
    );
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

    console.log("🔍 generatePaymentLink - billId:", billId);

    const bill = await Bill.findById(billId).populate([
      {
        path: "contractId",
        select: "tenantSnapshot pricingSnapshot roomId tenantId", // Include tenantId và roomId
        populate: [
          {
            path: "roomId",
            select: "roomNumber", // Populate room để lấy roomNumber
          },
          {
            path: "tenantId",
            select: "email fullName", // Populate tenant để lấy email
          },
        ],
      },
      {
        path: "finalContractId",
        select: "tenantId roomId", // Include tenantId và roomId từ FinalContract
        populate: [
          {
            path: "tenantId",
            select: "email fullName", // Populate tenant để lấy email
          },
          {
            path: "roomId",
            select: "roomNumber", // Populate room để lấy roomNumber
          },
        ],
      },
    ]);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    console.log("🔍 Bill found:", bill._id);
    console.log("🔍 Bill contractId:", bill.contractId?._id);
    console.log("🔍 Bill contractId type:", typeof bill.contractId);

    // Cho phép generate link cho bill RECEIPT và CONTRACT chưa thanh toán
    if (bill.billType !== "RECEIPT" && bill.billType !== "CONTRACT") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể tạo link thanh toán cho phiếu thu (RECEIPT) hoặc hóa đơn hợp đồng (CONTRACT)",
      });
    }

    if (bill.status === "PAID") {
      return res.status(400).json({
        success: false,
        message: "Bill đã thanh toán rồi",
      });
    }

    // Lấy thông tin contract
    const contract = bill.contractId;
    
    // Với RECEIPT bill: cần có contract và tenantSnapshot
    if (bill.billType === "RECEIPT" && (!contract || !contract.tenantSnapshot)) {
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
    
    // Với CONTRACT bill: cần có finalContractId hoặc contract
    if (bill.billType === "CONTRACT" && !bill.finalContractId && !contract) {
      return res.status(400).json({
        success: false,
        message: "Bill không có thông tin hợp đồng",
      });
    }

    // Lấy thông tin tenant email từ nhiều nguồn
    let tenantEmail = null;
    
    // Với CONTRACT bill: ưu tiên lấy từ finalContractId.tenantId
    if (bill.billType === "CONTRACT" && bill.finalContractId) {
      const finalContract = bill.finalContractId;
      if (finalContract.tenantId) {
        const tenant = typeof finalContract.tenantId === 'object' 
          ? finalContract.tenantId 
          : null;
        if (tenant?.email) {
          tenantEmail = tenant.email;
          console.log("✅ Email từ FinalContract.tenantId:", tenantEmail);
        }
      }
    }
    
    // Với RECEIPT bill hoặc nếu CONTRACT bill chưa có email: lấy từ contractId.tenantSnapshot hoặc contractId.tenantId
    if (!tenantEmail && contract) {
      // Ưu tiên lấy từ tenantId (nếu có)
      if (contract.tenantId) {
        const tenant = typeof contract.tenantId === 'object' 
          ? contract.tenantId 
          : null;
        if (tenant?.email) {
          tenantEmail = tenant.email;
          console.log("✅ Email từ Contract.tenantId:", tenantEmail);
        }
      }
      
      // Nếu không có, lấy từ tenantSnapshot
      if (!tenantEmail && contract.tenantSnapshot?.email) {
        tenantEmail = contract.tenantSnapshot.email;
        console.log("✅ Email từ Contract.tenantSnapshot:", tenantEmail);
      }
    }

    // Nếu vẫn chưa có email, thử các nguồn khác
    if (!tenantEmail) {
      console.warn("⚠️ Chưa có email, thử lấy từ các nguồn khác...");

      // Ưu tiên 1: Email từ request body (admin nhập)
      if (emailFromBody) {
        tenantEmail = emailFromBody;
        console.log("✅ Sử dụng email từ request body:", tenantEmail);
      }
      // Ưu tiên 2: Email từ checkin (chỉ cho RECEIPT bill)
      else if (bill.billType === "RECEIPT") {
        const Checkin = (await import("../models/checkin.model.js")).default;
        const checkin = await Checkin.findOne({ receiptBillId: billId });
        console.log("🔍 Checkin found:", checkin ? "Yes" : "No");
        if (checkin?.tenantSnapshot?.email) {
          tenantEmail = checkin.tenantSnapshot.email;
          console.log("✅ Email từ checkin:", tenantEmail);
        } else {
          console.warn("⚠️ Checkin cũng không có email");
        }
      }
    }

    if (!tenantEmail) {
      console.error("❌ Không tìm thấy email:", {
        billId,
        billType: bill.billType,
        contractId: contract?._id,
        finalContractId: bill.finalContractId?._id || bill.finalContractId,
        tenantSnapshot: contract?.tenantSnapshot,
        emailFromBody,
      });
      return res.status(400).json({
        success: false,
        message:
          "Người thuê chưa có email. Vui lòng nhập email để gửi link thanh toán.",
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
      const { sendPaymentLinkEmail } = await import(
        "../services/email/notification.service.js"
      );
      const amountNum = convertDecimal128(bill.amountDue) || 0;

      // Get roomNumber from various sources
      let roomNumber = "N/A";
      
      // Với CONTRACT bill: lấy từ finalContractId.roomId (đã được populate)
      if (bill.billType === "CONTRACT" && bill.finalContractId) {
        const finalContract = bill.finalContractId;
        if (finalContract.roomId) {
          const room = finalContract.roomId;
          roomNumber = typeof room === 'object' && room.roomNumber 
            ? room.roomNumber 
            : (typeof room === 'string' ? room : "N/A");
        }
      }
      // Với RECEIPT bill: lấy từ contract
      else if (contract) {
        if (contract.pricingSnapshot?.roomNumber) {
          roomNumber = contract.pricingSnapshot.roomNumber;
        } else if (
          contract.roomId &&
          typeof contract.roomId === "object" &&
          contract.roomId.roomNumber
        ) {
          roomNumber = contract.roomId.roomNumber;
        } else if (typeof contract.roomId === "string") {
          // If roomId is just an ID, try to fetch it
          const Room = (await import("../models/room.model.js")).default;
          const room = await Room.findById(contract.roomId).select("roomNumber");
          if (room) roomNumber = room.roomNumber;
        }
      }

      // Lấy fullName từ nhiều nguồn
      let fullName = "Khách hàng";
      if (bill.billType === "CONTRACT" && bill.finalContractId?.tenantId) {
        const tenant = typeof bill.finalContractId.tenantId === 'object' 
          ? bill.finalContractId.tenantId 
          : null;
        if (tenant?.fullName) {
          fullName = tenant.fullName;
        }
      } else if (contract?.tenantSnapshot?.fullName) {
        fullName = contract.tenantSnapshot.fullName;
      } else if (contract?.tenantId && typeof contract.tenantId === 'object' && contract.tenantId.fullName) {
        fullName = contract.tenantId.fullName;
      }

      await sendPaymentLinkEmail({
        to: tenantEmail,
        fullName,
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
