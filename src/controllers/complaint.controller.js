import Complaint from "../models/complaint.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";

// Tạo complaint mới
export const createComplaint = async (req, res) => {
  try {
    const { tenantId, title, description, adminNote } = req.body || {};
    console.log("[createComplaint] payload:", { tenantId, title, description, adminNote });

    const safeTitle = typeof title === "string" ? title.trim() : "";
    const safeDesc = typeof description === "string" ? description.trim() : "";

    if (!safeTitle || safeTitle.length < 3) {
      return res.status(400).json({ success: false, message: "Tiêu đề phải từ 3 ký tự trở lên" });
    }
    if (!safeDesc || safeDesc.length < 10) {
      return res.status(400).json({ success: false, message: "Mô tả phải từ 10 ký tự trở lên" });
    }

    const complaint = new Complaint({
      tenantId,
      createdBy: req.user?._id, // tài khoản client gửi khiếu nại
      title: safeTitle,
      description: safeDesc,
      adminNote,
    });

    await complaint.save();

    // Tạo notification cho tất cả admin
    try {
      const admins = await User.find({ role: "ADMIN" }).select("_id");
      if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
          recipientId: admin._id,
          recipientRole: "ADMIN",
          type: "COMPLAINT_NEW",
          title: "Complaint mới",
          message: `Có complaint mới từ tenant: ${safeTitle}`,
          relatedEntityId: complaint._id,
          relatedEntityType: "Complaint",
        }));
        await Notification.insertMany(notifications);
        console.log(`✅ Đã tạo ${notifications.length} notifications cho admin`);
      }
    } catch (notifError) {
      console.error("[createComplaint] notification error:", notifError);
      // Không fail toàn bộ request nếu notification lỗi
    }

    return res.status(201).json({
      success: true,
      message: "Tạo complaint thành công",
      data: complaint,
    });
  } catch (error) {
    console.error("[createComplaint] error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// Lấy tất cả complaints (admin)
export const getAllComplaints = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const complaints = await Complaint.find()
      .populate({ path: "tenantId", select: "fullName phone email" })
      .populate({ path: "createdBy", select: "fullName email phone" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Debug: Check if complaints have titles
    console.log("[getAllComplaints] Sample complaints:");
    complaints.slice(0, 3).forEach(c => {
      console.log(`  ID: ${c._id}, Title: "${c.title}"`);
    });

    const total = await Complaint.countDocuments();

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách complaint thành công",
      data: complaints.map(c => ({
        ...c,
        // Bảo đảm luôn có field tenantId (null nếu không có)
        tenantId: c.tenantId || null,
        createdBy: c.createdBy || null,
      })),
      pagination: {
        currentPage: page,
        limit,
        totalRecords: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[getAllComplaints] error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách complaint",
      error: error.message,
    });
  }
};

// Lấy complaint theo tenantId (Client)
export const getComplaintsByTenantId = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const complaints = await Complaint.find({ tenantId: req.params.tenantId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Complaint.countDocuments({ tenantId: req.params.tenantId });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách complaint thành công",
      data: complaints,
      pagination: {
        currentPage: page,
        limit,
        totalRecords: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[getComplaintsByTenantId] error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// Lấy complaint theo ID
export const getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate("tenantId", "fullName")
      .populate("createdBy", "fullName email phone");
    if (!complaint)
      return res.status(404).json({ success: false, message: "Complaint không tồn tại" });

    return res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// Cập nhật status complaint (Admin)
export const updateComplaintStatus = async (req, res) => {
  try {
    const complaintId = req.params.id;
    const newStatus = req.body.status;
    
    // Lấy complaint hiện tại để kiểm tra trạng thái cũ
    const currentComplaint = await Complaint.findById(complaintId);
    
    if (!currentComplaint)
      return res.status(404).json({ success: false, message: "Complaint không tồn tại" });
    
    const currentStatus = (currentComplaint.status || "").toUpperCase();
    const newStatusUpper = (newStatus || "").toUpperCase();
    
    // Kiểm tra: Nếu đã RESOLVED, không cho chuyển về trạng thái cũ
    if (currentStatus === "RESOLVED" && newStatusUpper !== "RESOLVED") {
      return res.status(400).json({ 
        success: false, 
        message: "Khiếu nại đã được xử lý, không thể chuyển về trạng thái trước đó" 
      });
    }
    // Kiểm tra: Nếu đang IN_PROGRESS, không cho quay về PENDING
    if (currentStatus === "IN_PROGRESS" && newStatusUpper === "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Khiếu nại đang xử lý, không thể chuyển về trạng thái Chờ xử lý",
      });
    }
    
    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      { status: newStatusUpper },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Cập nhật thành công",
      data: complaint,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// Xóa complaint
export const deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint)
      return res.status(404).json({ success: false, message: "Complaint không tồn tại" });

    // Kiểm tra quyền: Admin có thể xóa tất cả
    const user = req.user;
    const isAdmin = user.role === "ADMIN";
    
    // Nếu không phải admin, kiểm tra xem user có phải là owner của complaint không
    // Lưu ý: tenantId trong Complaint là ID của Tenant, không phải User
    // Vì vậy chúng ta cần phải kiểm tra khác, hoặc chỉ cho phép admin xóa
    // Hoặc có thể để client check quyền trước khi gọi API
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Chỉ admin mới có quyền xóa complaint" });
    }

    await Complaint.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Xóa thành công" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};
