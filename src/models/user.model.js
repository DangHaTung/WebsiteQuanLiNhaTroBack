import mongoose from "mongoose";

const { Schema } = mongoose;

// Định nghĩa các vai trò có thể có
const USER_ROLES = ["ADMIN", "LANDLORD", "TENANT", "STAFF"];

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, // đảm bảo email không trùng
      index: true,  // tạo index tìm kiếm nhanh
      lowercase: true, // tự động chuyển thành chữ in thường
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    },
    phone: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "TENANT",
      index: true,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false }, // chỉ cần createdAt
    collection: "users", // tên collection trong MongoDB
  }
);

// Xuất model
const User = mongoose.model("User", userSchema);
export default User;