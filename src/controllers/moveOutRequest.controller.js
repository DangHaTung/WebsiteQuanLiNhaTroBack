import MoveOutRequest from "../models/moveOutRequest.model.js";
import Contract from "../models/contract.model.js";
import FinalContract from "../models/finalContract.model.js";

const convertDecimal128 = (value) => {
  if (value === null || value === undefined) return null;
  return parseFloat(value.toString());
};

// Client: Tạo yêu cầu chuyển đi
export const createMoveOutRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { contractId, moveOutDate, reason } = req.body;

    if (!contractId || !moveOutDate || !reason) {
      return res.status(400).json({
        success: false,
        message: "contractId, moveOutDate, and reason are required",
      });
    }

    // Tìm FinalContract của user
    const finalContract = await FinalContract.findById(contractId)
      .populate("roomId")
      .populate("originContractId")
      .populate("linkedContractId");

    if (!finalContract) {
      return res.status(404).json({
        success: false,
        message: "FinalContract not found",
      });
    }

    // Kiểm tra quyền truy cập
    if (finalContract.tenantId?.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only create move-out request for your own contract",
      });
    }

    // Kiểm tra FinalContract phải là SIGNED
    if (finalContract.status !== "SIGNED") {
      return res.status(400).json({
        success: false,
        message: "Only signed contracts can request move-out",
      });
    }

    // Lấy Contract thực tế (từ originContractId hoặc linkedContractId)
    const actualContractId = finalContract.originContractId?._id || finalContract.linkedContractId?._id || finalContract.originContractId || finalContract.linkedContractId;
    
    if (!actualContractId) {
      return res.status(400).json({
        success: false,
        message: "Cannot find associated Contract",
      });
    }

    const contract = await Contract.findById(actualContractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found",
      });
    }

    // Kiểm tra đã có yêu cầu PENDING chưa
    const existingRequest = await MoveOutRequest.findOne({
      contractId: contract._id,
      status: "PENDING",
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending move-out request for this contract",
      });
    }

    // Tạo yêu cầu mới
    const moveOutRequest = await MoveOutRequest.create({
      contractId: contract._id,
      tenantId: userId,
      roomId: finalContract.roomId._id,
      moveOutDate: new Date(moveOutDate),
      reason: reason.trim(),
      status: "PENDING",
    });

    const populated = await MoveOutRequest.findById(moveOutRequest._id)
      .populate("contractId", "deposit depositRefund depositRefunded")
      .populate("roomId", "roomNumber")
      .populate("tenantId", "fullName email phone");

    return res.status(201).json({
      success: true,
      message: "Move-out request created successfully",
      data: populated,
    });
  } catch (error) {
    console.error("createMoveOutRequest error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Client: Lấy danh sách yêu cầu của tôi
export const getMyMoveOutRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    const requests = await MoveOutRequest.find({ tenantId: userId })
      .populate("roomId", "roomNumber")
      .populate({
        path: "contractId",
        select: "startDate endDate deposit depositRefund depositRefunded",
      })
      .populate("processedBy", "fullName")
      .sort({ createdAt: -1 });

    // Format depositRefund to convert Decimal128 to number
    const formattedRequests = requests.map((req) => {
      const obj = req.toObject();
      if (obj.contractId && obj.contractId.depositRefund) {
        const refund = obj.contractId.depositRefund;
        obj.contractId.depositRefund = {
          amount: refund.amount ? parseFloat(refund.amount.toString()) : 0,
          refundedAt: refund.refundedAt,
          method: refund.method,
          transactionId: refund.transactionId,
          note: refund.note,
          damageAmount: refund.damageAmount ? parseFloat(refund.damageAmount.toString()) : 0,
          damageNote: refund.damageNote,
          finalMonthServiceFee: refund.finalMonthServiceFee ? parseFloat(refund.finalMonthServiceFee.toString()) : 0,
        };
      }
      if (obj.contractId && obj.contractId.deposit) {
        obj.contractId.deposit = parseFloat(obj.contractId.deposit.toString());
      }
      return obj;
    });

    return res.status(200).json({
      success: true,
      message: "Get my move-out requests successfully",
      data: formattedRequests,
    });
  } catch (error) {
    console.error("getMyMoveOutRequests error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Admin: Lấy tất cả yêu cầu
export const getAllMoveOutRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const requests = await MoveOutRequest.find(filter)
      .populate("roomId", "roomNumber")
      .populate({
        path: "contractId",
        select: "deposit depositRefund depositRefunded status",
        populate: {
          path: "tenantId",
          select: "fullName email phone",
        },
      })
      .populate("tenantId", "fullName email phone")
      .populate("processedBy", "fullName")
      .sort({ createdAt: -1 });

    // Format depositRefund và deposit
    const formattedRequests = requests.map((req) => {
      const obj = req.toObject();
      if (obj.contractId) {
        if (obj.contractId.deposit) {
          obj.contractId.deposit = parseFloat(obj.contractId.deposit.toString());
        }
        if (obj.contractId.depositRefund) {
          const refund = obj.contractId.depositRefund;
          obj.contractId.depositRefund = {
            amount: refund.amount ? parseFloat(refund.amount.toString()) : 0,
            refundedAt: refund.refundedAt,
            method: refund.method,
            transactionId: refund.transactionId,
            note: refund.note,
            damageAmount: refund.damageAmount ? parseFloat(refund.damageAmount.toString()) : 0,
            damageNote: refund.damageNote,
            finalMonthServiceFee: refund.finalMonthServiceFee ? parseFloat(refund.finalMonthServiceFee.toString()) : 0,
          };
        }
      }
      return obj;
    });

    return res.status(200).json({
      success: true,
      message: "Get all move-out requests successfully",
      data: formattedRequests,
    });
  } catch (error) {
    console.error("getAllMoveOutRequests error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Admin: Cập nhật trạng thái yêu cầu (APPROVED/REJECTED)
export const updateMoveOutRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;
    const adminId = req.user._id;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be APPROVED or REJECTED",
      });
    }

    const request = await MoveOutRequest.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Move-out request not found",
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only PENDING requests can be updated",
      });
    }

    request.status = status;
    request.processedBy = adminId;
    request.processedAt = new Date();
    if (adminNote) request.adminNote = adminNote.trim();

    await request.save();

    const populated = await MoveOutRequest.findById(request._id)
      .populate("roomId", "roomNumber")
      .populate({
        path: "contractId",
        select: "startDate endDate deposit depositRefund depositRefunded",
      })
      .populate("tenantId", "fullName email phone")
      .populate("processedBy", "fullName");

    // Format Decimal128 values
    const formatted = populated.toObject();
    if (formatted.contractId) {
      if (formatted.contractId.deposit) {
        formatted.contractId.deposit = convertDecimal128(formatted.contractId.deposit);
      }
      if (formatted.contractId.depositRefund) {
        const refund = formatted.contractId.depositRefund;
        formatted.contractId.depositRefund = {
          amount: refund.amount ? convertDecimal128(refund.amount) : 0,
          refundedAt: refund.refundedAt,
          method: refund.method,
          transactionId: refund.transactionId,
          note: refund.note,
          damageAmount: refund.damageAmount ? convertDecimal128(refund.damageAmount) : 0,
          damageNote: refund.damageNote,
          finalMonthServiceFee: refund.finalMonthServiceFee ? convertDecimal128(refund.finalMonthServiceFee) : 0,
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: `Move-out request ${status.toLowerCase()} successfully`,
      data: formatted,
    });
  } catch (error) {
    console.error("updateMoveOutRequestStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Admin: Hoàn tất yêu cầu (đã hoàn cọc)
export const completeMoveOutRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await MoveOutRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Move-out request not found",
      });
    }

    if (request.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Only APPROVED requests can be completed",
      });
    }

    if (request.refundProcessed) {
      return res.status(400).json({
        success: false,
        message: "Refund already processed",
      });
    }

    request.status = "COMPLETED";
    request.refundProcessed = true;
    await request.save();

    const populated = await MoveOutRequest.findById(request._id)
      .populate("roomId", "roomNumber")
      .populate({
        path: "contractId",
        select: "startDate endDate deposit depositRefund depositRefunded",
      })
      .populate("tenantId", "fullName email phone")
      .populate("processedBy", "fullName");

    // Format Decimal128 values
    const formatted = populated.toObject();
    if (formatted.contractId) {
      if (formatted.contractId.deposit) {
        formatted.contractId.deposit = convertDecimal128(formatted.contractId.deposit);
      }
      if (formatted.contractId.depositRefund) {
        const refund = formatted.contractId.depositRefund;
        formatted.contractId.depositRefund = {
          amount: refund.amount ? convertDecimal128(refund.amount) : 0,
          refundedAt: refund.refundedAt,
          method: refund.method,
          transactionId: refund.transactionId,
          note: refund.note,
          damageAmount: refund.damageAmount ? convertDecimal128(refund.damageAmount) : 0,
          damageNote: refund.damageNote,
          finalMonthServiceFee: refund.finalMonthServiceFee ? convertDecimal128(refund.finalMonthServiceFee) : 0,
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: "Move-out request completed successfully",
      data: formatted,
    });
  } catch (error) {
    console.error("completeMoveOutRequest error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export default {
  createMoveOutRequest,
  getMyMoveOutRequests,
  getAllMoveOutRequests,
  updateMoveOutRequestStatus,
  completeMoveOutRequest,
};

