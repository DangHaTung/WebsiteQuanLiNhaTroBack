import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import Contract from "../models/contract.model.js";
import Bill from "../models/bill.model.js";
import logService from "../services/log.service.js";

// Lấy danh sách người dùng (hỗ trợ phân trang, lọc role, tìm kiếm keyword)
export const getAllUsers = async (req, res) => {
  try {
    if (!req.user || req.user.role.toUpperCase() !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Bạn không có quyền truy cập danh sách người dùng" });
    }

    const { page = 1, limit = 10, role, keyword } = req.query;
    const numericLimit = Math.max(parseInt(limit, 10) || 10, 1);
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (numericPage - 1) * numericLimit;

    const query = {};
    if (role) query.role = role;
    if (keyword) {
      const regex = new RegExp(keyword.trim(), "i");
      query.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
    }

    // Phân quyền dữ liệu theo role
    let selectFields = "fullName email phone role createdAt isLocked";
    
   
    
    // Nếu không có authentication (public access), chỉ hiển thị thông tin cơ bản
    if (!req.user) {
      selectFields = "fullName role createdAt";

    }
    // Nếu là TENANT, hiển thị thông tin cơ bản + phone
    else if (req.user.role === 'TENANT' || req.user.role === 'tenant') {
      selectFields = "fullName phone role createdAt";

    }
    // Nếu là ADMIN, hiển thị đầy đủ thông tin bao gồm isLocked
    else if (req.user.role === 'ADMIN' || req.user.role === 'admin') {
      selectFields = "fullName email phone role createdAt isLocked";
    }
    else {
      console.log("Debug getAllUsers - Other role access, selectFields:", selectFields);
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .limit(numericLimit)
        .skip(skip)
        .select(selectFields),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "Lấy danh sách người dùng thành công",
      data: users,
      pagination: {
        currentPage: numericPage,
        totalPages: Math.ceil(total / numericLimit),
        totalRecords: total,
        limit: numericLimit,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách người dùng",
      error: error.message,
    });
  }
};

// Lấy thông tin người dùng theo ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Phân quyền dữ liệu theo role
    let selectFields = "fullName email phone role createdAt";
    

    
    // Nếu không có authentication (public access), chỉ hiển thị thông tin cơ bản
    if (!req.user) {
      selectFields = "fullName role createdAt";

    }
    // Nếu là TENANT, hiển thị thông tin cơ bản + phone
    else if (req.user.role === 'TENANT' || req.user.role === 'tenant') {
      selectFields = "fullName phone role createdAt";

    }
    else {
      console.log("Debug getUserById - Other role access, selectFields:", selectFields);
    }
    
    const user = await User.findById(id).select(selectFields);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }
    res.status(200).json({ success: true, message: "Lấy người dùng thành công", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy người dùng", error: error.message });
  }
};

// Tạo người dùng mới (dành cho ADMIN/STAFF tạo tài khoản)
export const createUser = async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email đã tồn tại" });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({ fullName, email, phone, passwordHash, role: role || "TENANT" });
    await newUser.save();

    // 📝 Log user creation
    await logService.logCreate({
      entity: 'USER',
      entityId: newUser._id,
      actorId: req.user?._id,
      data: {
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
      },
    });

    res.status(201).json({
      success: true,
      message: "Tạo người dùng thành công",
      data: {
        _id: newUser._id,
        id: newUser._id, // Backward compatibility
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi tạo người dùng", error: error.message });
  }
};

// Cập nhật người dùng
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, role, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Kiểm tra email trùng nếu có thay đổi
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ success: false, message: "Email đã tồn tại" });
      }
      user.email = email;
    }

    if (typeof fullName === "string") user.fullName = fullName;
    if (typeof phone === "string") user.phone = phone;
    if (typeof role === "string") user.role = role;

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: "Mật khẩu phải có ít nhất 6 ký tự" });
      }
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Cập nhật người dùng thành công",
      data: {
        _id: user._id,
        id: user._id, // Backward compatibility
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật người dùng", error: error.message });
  }
};

// Xóa người dùng
export const deleteUser = async (req, res) => {
  try {
    if (!req.user || req.user.role.toUpperCase() !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xóa người dùng" });
    }

    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }
    res.status(200).json({ success: true, message: "Xóa người dùng thành công" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi xóa người dùng", error: error.message });
  }
};

// Kích hoạt tài khoản Tenant sau khi bill_contract = PAID
export const activateTenantIfContractBillPaid = async (req, res) => {
  try {
    if (!req.user || req.user.role.toUpperCase() !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Bạn không có quyền kích hoạt tài khoản" });
    }
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    if ((user.role || "").toUpperCase() !== "TENANT") {
      return res.status(400).json({ success: false, message: "Chỉ kích hoạt được tài khoản TENANT" });
    }

    // Tìm các hợp đồng của tenant
    const contracts = await Contract.find({ tenantId: user._id }).select("_id");
    if (!contracts.length) {
      return res.status(400).json({ success: false, message: "Tenant chưa có hợp đồng" });
    }

    // Kiểm tra có bill_contract PAID hay không
    const contractIds = contracts.map((c) => c._id);
    const paidContractBill = await Bill.findOne({
      contractId: { $in: contractIds },
      billType: "CONTRACT",
      status: "PAID",
    });
    if (!paidContractBill) {
      return res.status(400).json({ success: false, message: "Chưa thanh toán bill hợp đồng (CONTRACT)" });
    }

    user.isActive = true;
    await user.save();
    return res.status(200).json({ success: true, message: "Đã kích hoạt tài khoản Tenant", data: { _id: user._id, id: user._id, isActive: user.isActive } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi khi kích hoạt tài khoản", error: error.message });
  }
};

// Khóa/Mở khóa tài khoản
export const toggleUserLock = async (req, res) => {
  try {
    if (!req.user || req.user.role.toUpperCase() !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Bạn không có quyền khóa/mở khóa tài khoản" });
    }

    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Không cho phép khóa tài khoản admin
    if (user.role.toUpperCase() === "ADMIN") {
      return res.status(400).json({ success: false, message: "Không thể khóa tài khoản quản trị viên" });
    }

    // Toggle lock status
    user.isLocked = !user.isLocked;
    await user.save();

    const action = user.isLocked ? "khóa" : "mở khóa";
    return res.status(200).json({
      success: true,
      message: `${action.charAt(0).toUpperCase() + action.slice(1)} tài khoản thành công`,
      data: {
        _id: user._id,
        id: user._id,
        isLocked: user.isLocked,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi khi khóa/mở khóa tài khoản", error: error.message });
  }
};


