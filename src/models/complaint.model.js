import mongoose from "mongoose";

const { Schema } = mongoose;

const complaintSchema = new Schema({
    tenantId: {
        type: Schema.Types.ObjectId,
        ref: "Tenant",
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ["PENDING", "IN_PROGRESS", "RESOLVED"],
        default: "PENDING",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    adminNote: {
        type: String,
        trim: true,
    },
}, { timestamps: { createdAt: true, updatedAt: false } });

const Complaint = mongoose.model("complaint", complaintSchema);
export default Complaint;