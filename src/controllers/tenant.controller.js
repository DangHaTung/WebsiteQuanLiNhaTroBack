import Tenant from "../models/tenant.model.js";

// Lấy danh sách tất cả tenants
export const getAllTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find().sort({ createdAt: -1 });
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Thêm tenant mới
export const createTenant = async (req, res) => {
  try {
    const { fullName, phone, email, identityNo, note } = req.body;
    const tenant = new Tenant({ fullName, phone, email, identityNo, note });
    await tenant.save();
    res.status(201).json({ message: "Thêm tenant thành công", tenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cập nhật tenant
export const updateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!tenant)
      return res.status(404).json({ message: "Không tìm thấy tenant" });
    res.json({ message: "Cập nhật thành công", tenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xóa tenant
export const deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndDelete(req.params.id);
    if (!tenant)
      return res.status(404).json({ message: "Không tìm thấy tenant" });
    res.json({ message: "Đã xóa tenant" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
