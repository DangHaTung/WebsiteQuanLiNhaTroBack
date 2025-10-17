import Tenant from "../models/tenant.model.js";

// Lấy danh sách tất cả tenants
export const getAllTenants = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const tenants = await Tenant.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Tenant.countDocuments();

    res.status(200).json({
      message: "Lấy danh sách tenants thành công",
      success: true,
      data: tenants,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Lỗi khi lấy danh sách tenants",
      success: false,
      error: err.message 
    });
  }
};

// Lấy tenant theo ID
export const getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({
        message: "Không tìm thấy tenant",
        success: false,
      });
    }

    res.status(200).json({
      message: "Lấy tenant thành công",
      success: true,
      data: tenant,
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Lỗi khi lấy tenant",
      success: false,
      error: err.message 
    });
  }
};

// Thêm tenant mới
export const createTenant = async (req, res) => {
  try {
    const { fullName, phone, email, identityNo, note } = req.body;
    const tenant = new Tenant({ fullName, phone, email, identityNo, note });
    await tenant.save();
    res.status(201).json({ 
      message: "Thêm tenant thành công", 
      success: true,
      data: tenant 
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Lỗi khi tạo tenant",
      success: false,
      error: err.message 
    });
  }
};

// Cập nhật tenant
export const updateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!tenant)
      return res.status(404).json({ 
        message: "Không tìm thấy tenant",
        success: false 
      });
    res.status(200).json({ 
      message: "Cập nhật thành công", 
      success: true,
      data: tenant 
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Lỗi khi cập nhật tenant",
      success: false,
      error: err.message 
    });
  }
};

// Xóa tenant
export const deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndDelete(req.params.id);
    if (!tenant)
      return res.status(404).json({ 
        message: "Không tìm thấy tenant",
        success: false 
      });
    res.status(200).json({ 
      message: "Đã xóa tenant",
      success: true 
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Lỗi khi xóa tenant",
      success: false,
      error: err.message 
    });
  }
};
