// src/models/util.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const UTILITY_CONDITIONS = ["new", "used", "broken"];
const UTILITY_TYPES = [
    "refrigerator",
    "air_conditioner", 
    "washing_machine",
    "television",
    "microwave",
    "water_heater",
    "fan",
    "bed",
    "wardrobe",
    "desk",
    "chair",
    "sofa",
    "wifi_router",
    "other"
];

const utilSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            enum: UTILITY_TYPES,
        },
        condition: {
            type: String,
            enum: UTILITY_CONDITIONS,
            required: true,
            default: "used",
        },
        description: {
            type: String,
            trim: true,
            default: "",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        room: {
            type: Schema.Types.ObjectId,
            ref: "Room",
            required: false,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: true },
        collection: "utils",
    }
);

// Compound index to ensure unique combination of name, condition, and room
utilSchema.index({ name: 1, condition: 1 }, { unique: true });

// Instance method to update condition
utilSchema.methods.updateCondition = function(newCondition) {
    this.condition = newCondition;
    return this.save();
};

// Static method to get utilities by room
utilSchema.statics.findByRoom = function(roomId) {
    return this.find({ room: roomId, isActive: true }).populate("room");
};

// Static method to get utilities by condition
utilSchema.statics.findByCondition = function(condition) {
    return this.find({ condition, isActive: true }).populate("room");
};

// Static method to get broken utilities
utilSchema.statics.findBrokenUtilities = function() {
    return this.find({ condition: "broken", isActive: true }).populate("room");
};

export default mongoose.models.Util || mongoose.model("Util", utilSchema);