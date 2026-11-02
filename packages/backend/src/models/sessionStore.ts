import { Schema, model, type Model } from "mongoose";

const SessionStoreSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    formId: { type: Schema.Types.ObjectId, ref: "Form", required: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: "session_stores",
    minimize: false,
    timestamps: { createdAt: false, updatedAt: true },
  }
);

SessionStoreSchema.index({ formId: 1, updatedAt: -1 });

export default model("SessionStore", SessionStoreSchema) as Model<unknown>;
