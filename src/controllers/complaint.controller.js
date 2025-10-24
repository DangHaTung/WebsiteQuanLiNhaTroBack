 import Complaint from "../models/complaint.model.js";
 
 
 export const createComplaint = async (req, res) => {
   try {
      const { tenantId, title, description, adminNote } = req.body || {};
      // debug log tối thiểu để kiểm tra payload thực tế
      console.log("[createComplaint] payload:", { tenantId, title, description, adminNote });

      const safeTitle = typeof title === 'string' ? title.trim() : '';
      const safeDesc = typeof description === 'string' ? description.trim() : '';
      if (!safeTitle || safeTitle.length < 3) {
          return res.status(400).json({ success: false, message: 'Tiêu đề không hợp lệ (tối thiểu 3 ký tự)' });
      }
      if (!safeDesc || safeDesc.length < 10) {
          return res.status(400).json({ success: false, message: 'Mô tả không hợp lệ (tối thiểu 10 ký tự)' });
      }

      const complaint = new Complaint({ tenantId, title: safeTitle, description: safeDesc, adminNote });
       await complaint.save();
       res.status(201).json({
           message: "Tạo complaint thành công",
           success: true,
           data: complaint,
       });
   } catch (error) {
       res.status(500).json({ message: "Lỗi khi tạo complaint", success: false, error: error.message });
   }
 }
 // Lấy danh sách complaint
 export const getAllComplaints = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        const complaints = await Complaint.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
        const total = await Complaint.countDocuments();
        res.status(200).json({
            message: "Lấy danh sách complaint thành công",
            success: true,
            data: complaints,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi lấy danh sách complaint", success: false, error: error.message });
    }
 }
 // Lấy complaint theo ID
 export const getComplaintById = async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: "Complaint không tồn tại", success: false });
        }
        res.status(200).json({ message: "Lấy complaint thành công", success: true, data: complaint });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi lấy complaint", success: false, error: error.message });
    }
 }
 // Cập nhật complaint status
 export const updateComplaintStatus = async (req, res) => {
    try {
        const complaint = await Complaint.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
        if (!complaint) {
            return res.status(404).json({ message: "Complaint không tồn tại", success: false });
        }
        res.status(200).json({
            message: "Cập nhật complaint thành công",
            success: true,
            data: complaint,
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi cập nhật complaint", success: false, error: error.message });
    }
 }
 // Xóa complaint
 export const deleteComplaint = async (req, res) => {
    try {
        const complaint = await Complaint.findByIdAndDelete(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: "Complaint không tồn tại", success: false });
        }
        res.status(200).json({ message: "Xóa complaint thành công", success: true });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi xóa complaint", success: false, error: error.message });
    }
 }
// Lấy complaint theo tenantId
export const getComplaintsByTenantId = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        
        const complaints = await Complaint.find({ tenantId: req.params.tenantId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);
            
        const total = await Complaint.countDocuments({ tenantId: req.params.tenantId });
        
        res.status(200).json({ 
            message: "Lấy danh sách complaint thành công", 
            success: true, 
            data: complaints,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi lấy danh sách complaint", success: false, error: error.message });
    }
}