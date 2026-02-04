import { Schema, model, type Model } from "mongoose";

const ScriptSchema = new Schema(
  {
    name: { type: String, required: true },
    source: { type: String, required: true },
    version: { type: Number, default: 1 },
    lastDeployedAt: Date,
    deployMetadata: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export default model("Script", ScriptSchema) as Model<unknown>;
