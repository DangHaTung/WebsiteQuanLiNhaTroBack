import mongoose from "mongoose";

const billSchema = new mongoose.Schema({
  bill_code: String,
  tenant_name: String,
  total_amount: Number,
  due_date: Date,
  status: {
    type: String,
    enum: ["unpaid", "partial", "paid"],
    default: "unpaid",
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Bill", billSchema);
