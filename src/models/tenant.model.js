import mongoose from "mongoose";
const tenantSchema = new mongoose.Schema(
    {
        fullName: {type: String, require:true},
        phone:{type:String},
        email:{type:String},
        identityNo: { type: String },
        note:{type:String},
    },
    {timestamps:{createdAt:true,updatedAt:false}}
);
export default mongoose.model("Tenant",tenantSchema);