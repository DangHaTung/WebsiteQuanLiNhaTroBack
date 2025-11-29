// src/models/room.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ROOM_TYPES = ["SINGLE", "DOUBLE", "DORM"];
const ROOM_STATUS = ["AVAILABLE", "DEPOSITED", "OCCUPIED", "MAINTENANCE"]; // DEPOSITED: đã được cọc
const CLEANING_STATUS = ["uncleaned", "cleaned"];

// Schema tóm tắt hợp đồng hiện tại (không có _id)
// Dùng để tránh populate nặng, chỉ lưu thông tin cần thiết
const currentContractSummarySchema = new Schema(
    {
        contractId: { type: Schema.Types.ObjectId, ref: "Contract" },
        tenantName: { type: String },
        startDate: { type: Date },
        endDate: { type: Date },
        monthlyRent: { type: mongoose.Schema.Types.Decimal128 },
    },
    { _id: false }
);

// Schema chính của Room
const roomSchema = new Schema(
    {
        roomNumber: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            index: true,
        },
        type: {
            type: String,
            enum: ROOM_TYPES,
            required: true,
            default: "SINGLE",
        },
        pricePerMonth: {
            type: mongoose.Schema.Types.Decimal128,
            required: true,
        },
        areaM2: {
            type: Number,
            required: false,
        },
        floor: {
            type: Number,
            required: false,
        },
        status: {
            type: String,
            enum: ROOM_STATUS,
            default: "AVAILABLE",
            index: true,
        },
        occupantCount: {
            type: Number,
            default: 0,
        },
        images: [
            {
                url: { type: String, required: true },
                publicId: { type: String, required: false },
            },
        ],
        coverImageUrl: {
            type: String,
            required: false,
        },
        currentContractSummary: currentContractSummarySchema,
        cleaningStatus: {
            type: String,
            enum: CLEANING_STATUS,
            default: "uncleaned",
            index: true,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        collection: "rooms",
    }
);

// PRE-SAVE MIDDLEWARE
// Tự động tăng giá thêm 200.000 VND khi phòng chuyển trạng thái "cleaned"
roomSchema.pre("save", function (next) {
    if (this.isModified("cleaningStatus") && this.cleaningStatus === "cleaned") {
        // Lấy giá hiện tại
        const currentPrice = parseFloat(this.pricePerMonth.toString());
        // Tăng thêm 200k
        this.pricePerMonth = currentPrice + 200000;
    }
    next();
});

// Lấy toàn bộ tiện ích của phòng
roomSchema.methods.getUtilities = async function() {
    const Util = mongoose.model("Util");
    return await Util.findByRoom(this._id);
};

// Lấy tiện ích theo tình trạng (ví dụ: "broken", "working")
roomSchema.methods.getUtilitiesByCondition = async function(condition) {
    const Util = mongoose.model("Util");
    return await Util.find({ room: this._id, condition, isActive: true });
};

// Thêm tiện ích mới vào phòng
roomSchema.methods.addUtility = async function(utilityData) {
    const Util = mongoose.model("Util");
    return await Util.create({
        ...utilityData,
        room: this._id,
    });
};

// Lấy danh sách tiện ích bị hỏng của phòng
roomSchema.methods.getBrokenUtilities = async function() {
    const Util = mongoose.model("Util");
    return await Util.find({ room: this._id, condition: "broken", isActive: true });
};

// Tìm phòng theo tiện ích (vd: phòng có máy lạnh bị hỏng)
roomSchema.statics.findByUtility = async function(utilityName, condition = null) {
    const Util = mongoose.model("Util");
    const query = { name: utilityName, isActive: true };
    if (condition) {
        query.condition = condition;
    }
    // Lấy tiện ích và populate lấy phòng tương ứng
    const utilities = await Util.find(query).populate("room");
    // Trả về danh sách phòng, loại bỏ null
    return utilities.map(util => util.room).filter(room => room != null);
};

export default mongoose.models.Room || mongoose.model("Room", roomSchema);
