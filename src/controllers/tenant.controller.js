import Tenant from "../models/tenant.model.js";

// Lấy danh sách tất cả tenants
export const getAllTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      message: "Lấy danh sách tenants thành công",
      data: tenants,
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: "Lỗi khi lấy danh sách tenants",
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
        success: false,
        message: "Không tìm thấy tenant"
      });
    }
    res.json({
      success: true,
      message: "Lấy tenant thành công",
      data: tenant,
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: "Lỗi khi lấy tenant",
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
      success: true,
      message: "Thêm tenant thành công", 
      data: tenant 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: "Lỗi khi tạo tenant",
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
        success: false,
        message: "Không tìm thấy tenant" 
      });
    res.json({ 
      success: true,
      message: "Cập nhật thành công", 
      data: tenant 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: "Lỗi khi cập nhật tenant",
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
        success: false,
        message: "Không tìm thấy tenant" 
      });
    res.json({ 
      success: true,
      message: "Đã xóa tenant" 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: "Lỗi khi xóa tenant",
      error: err.message 
    });
  }
};
