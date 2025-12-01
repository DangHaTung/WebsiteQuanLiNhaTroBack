/**
 * VÍ DỤ SỬ DỤNG LOG SERVICE
 * 
 * File này chứa các ví dụ về cách sử dụng logService trong controllers
 * Không cần import file này, chỉ tham khảo
 */

import logService from './log.service.js';

// ============================================
// VÍ DỤ 1: LOG KHI TẠO PHÒNG MỚI
// ============================================
export const createRoomExample = async (req, res) => {
  try {
    const room = await Room.create(req.body);
    
    // Ghi log
    await logService.logCreate({
      entity: 'ROOM',
      entityId: room._id,
      actorId: req.user._id,
      data: {
        roomNumber: room.roomNumber,
        type: room.type,
        pricePerMonth: room.pricePerMonth,
      },
    });
    
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    // Ghi log lỗi
    await logService.error({
      entity: 'ROOM',
      entityId: null,
      actorId: req.user._id,
      message: 'Lỗi khi tạo phòng',
      error,
    });
    
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// VÍ DỤ 2: LOG KHI CẬP NHẬT PHÒNG
// ============================================
export const updateRoomExample = async (req, res) => {
  try {
    const oldRoom = await Room.findById(req.params.id);
    const updatedRoom = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    // Ghi log với before/after
    await logService.logUpdate({
      entity: 'ROOM',
      entityId: updatedRoom._id,
      actorId: req.user._id,
      before: {
        status: oldRoom.status,
        pricePerMonth: oldRoom.pricePerMonth,
      },
      after: {
        status: updatedRoom.status,
        pricePerMonth: updatedRoom.pricePerMonth,
      },
    });
    
    res.json({ success: true, data: updatedRoom });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// VÍ DỤ 3: LOG KHI XÓA PHÒNG
// ============================================
export const deleteRoomExample = async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    
    // Ghi log xóa
    await logService.logDelete({
      entity: 'ROOM',
      entityId: room._id,
      actorId: req.user._id,
      data: {
        roomNumber: room.roomNumber,
        deletedAt: new Date(),
      },
    });
    
    res.json({ success: true, message: 'Đã xóa phòng' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// VÍ DỤ 4: LOG KHI THANH TOÁN HÓA ĐƠN
// ============================================
export const payBillExample = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    const payment = await processPayment(bill, req.body);
    
    // Ghi log thanh toán
    await logService.logPayment({
      entity: 'BILL',
      entityId: bill._id,
      actorId: req.user?._id,
      amount: payment.amount,
      provider: payment.provider,
      status: payment.status,
    });
    
    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// VÍ DỤ 5: LOG TÙY CHỈNH
// ============================================
export const customLogExample = async (req, res) => {
  try {
    // Log INFO
    await logService.info({
      entity: 'CONTRACT',
      entityId: contract._id,
      actorId: req.user._id,
      message: 'Ký hợp đồng thành công',
      diff: {
        signedAt: new Date(),
        signedBy: req.user.fullName,
      },
    });
    
    // Log WARNING
    await logService.warn({
      entity: 'BILL',
      entityId: bill._id,
      actorId: req.user._id,
      message: 'Hóa đơn sắp quá hạn',
      diff: {
        dueDate: bill.dueDate,
        daysRemaining: 3,
      },
    });
    
    // Log ERROR
    await logService.error({
      entity: 'PAYMENT',
      entityId: payment._id,
      actorId: req.user._id,
      message: 'Thanh toán thất bại',
      diff: {
        errorCode: 'PAYMENT_FAILED',
        provider: 'VNPAY',
      },
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// VÍ DỤ 6: LOG TRONG TRANSACTION
// ============================================
export const transactionLogExample = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const room = await Room.create([req.body], { session });
      const contract = await Contract.create([{ roomId: room[0]._id }], { session });
      
      // Log có thể gọi bên ngoài transaction (không cần session)
      // Vì log không quan trọng bằng business logic
      await logService.logCreate({
        entity: 'ROOM',
        entityId: room[0]._id,
        actorId: req.user._id,
        data: { roomNumber: room[0].roomNumber },
      });
      
      await logService.logCreate({
        entity: 'CONTRACT',
        entityId: contract[0]._id,
        actorId: req.user._id,
        data: { roomId: room[0]._id },
      });
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    session.endSession();
  }
};
