// src/models/room.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ROOM_TYPES = ["SINGLE", "DOUBLE", "DORM"];
const ROOM_STATUS = ["AVAILABLE", "DEPOSITED", "OCCUPIED", "MAINTENANCE"]; // DEPOSITED: đã được cọc
const CLEANING_STATUS = ["uncleaned", "cleaned"];

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

// Pre-save middleware to handle price increase when room is cleaned
roomSchema.pre("save", function (next) {
    if (this.isModified("cleaningStatus") && this.cleaningStatus === "cleaned") {
        // Increase price by 200,000 VND when room is cleaned
        const currentPrice = parseFloat(this.pricePerMonth.toString());
        this.pricePerMonth = currentPrice + 200000;
    }
    next();
});

// Instance method to get all utilities for this room
roomSchema.methods.getUtilities = async function() {
    const Util = mongoose.model("Util");
    return await Util.findByRoom(this._id);
};

// Instance method to get utilities by condition
roomSchema.methods.getUtilitiesByCondition = async function(condition) {
    const Util = mongoose.model("Util");
    return await Util.find({ room: this._id, condition, isActive: true });
};

// Instance method to add a utility to this room
roomSchema.methods.addUtility = async function(utilityData) {
    const Util = mongoose.model("Util");
    return await Util.create({
        ...utilityData,
        room: this._id,
    });
};

// Instance method to get broken utilities for this room
roomSchema.methods.getBrokenUtilities = async function() {
    const Util = mongoose.model("Util");
    return await Util.find({ room: this._id, condition: "broken", isActive: true });
};

// Static method to find rooms with specific utility
roomSchema.statics.findByUtility = async function(utilityName, condition = null) {
    const Util = mongoose.model("Util");
    const query = { name: utilityName, isActive: true };
    if (condition) {
        query.condition = condition;
    }
    const utilities = await Util.find(query).populate("room");
    return utilities.map(util => util.room).filter(room => room != null);
};

export default mongoose.models.Room || mongoose.model("Room", roomSchema);
