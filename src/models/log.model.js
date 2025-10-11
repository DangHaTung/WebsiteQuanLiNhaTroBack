import mongoose from 'mongoose';

const { Schema } = mongoose;

// Enum cho level log
const LOG_LEVELS = ['INFO', 'WARN', 'ERROR'];

// Enum cho loại đối tượng được log
const CONTEXT_ENTITIES = ['ROOM', 'CONTRACT', 'BILL', 'USER'];

const LogSchema = new Schema(
  {
    level: {
      type: String,
      enum: LOG_LEVELS,
      required: true,
      default: 'INFO',
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    context: {
      entity: {
        type: String,
        enum: CONTEXT_ENTITIES,
        required: true,
      },
      entityId: {
        type: Schema.Types.ObjectId,
        required: true,
        refPath: 'context.entityRef', // Có thể dùng ref động nếu cần populate
      },
      actorId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      diff: {
        type: Schema.Types.Mixed, // Lưu thay đổi hoặc payload bất kỳ
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: '180d' }, // TTL index: tự động xóa sau 180 ngày
    },
  },
  {
    collection: 'logs',
    versionKey: false,
  }
);

export default mongoose.model('Log', LogSchema);