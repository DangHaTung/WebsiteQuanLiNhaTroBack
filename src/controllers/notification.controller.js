import Notification from "../models/notification.model.js";

// Lấy tất cả notifications cho một user
export const getNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const recipientId = req.user.id;
    const isRead = req.query.isRead === "true";

    const query = { recipientId };
    if (req.query.isRead !== undefined) {
      query.isRead = isRead === true;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("relatedEntityId");

    const total = await Notification.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách notification thành công",
      data: notifications,
      pagination: {
        currentPage: page,
        limit,
        totalRecords: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[getNotifications] error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách notification",
      error: error.message,
    });
  }
};

// Đếm số notifications chưa đọc
export const getUnreadCount = async (req, res) => {
  try {
    const recipientId = req.user.id;
    const count = await Notification.countDocuments({
      recipientId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error("[getUnreadCount] error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi đếm notifications chưa đọc",
      error: error.message,
    });
  }
};

// Đánh dấu notification là đã đọc
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification không tồn tại",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu đọc",
      data: notification,
    });
  } catch (error) {
    console.error("[markAsRead] error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi đánh dấu đọc",
      error: error.message,
    });
  }
};

// Đánh dấu tất cả notifications là đã đọc
export const markAllAsRead = async (req, res) => {
  try {
    const recipientId = req.user.id;
    
    await Notification.updateMany(
      { recipientId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu tất cả notification là đã đọc",
    });
  } catch (error) {
    console.error("[markAllAsRead] error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi đánh dấu tất cả notification",
      error: error.message,
    });
  }
};

// Xóa notification
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification không tồn tại",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Xóa notification thành công",
    });
  } catch (error) {
    console.error("[deleteNotification] error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xóa notification",
      error: error.message,
    });
  }
};



