// src/models/room.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ROOM_TYPES = ["SINGLE", "DOUBLE", "DORM"];
const ROOM_STATUS = ["AVAILABLE", "OCCUPIED", "MAINTENANCE"];

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
        district: {
            type: String,
            required: false,
            trim: true,
        },
        status: {
            type: String,
            enum: ROOM_STATUS,
            default: "AVAILABLE",
            index: true,
        },
        currentContractSummary: currentContractSummarySchema,
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        collection: "rooms",
    }
);
export default mongoose.models.Room || mongoose.model("Room", roomSchema);
