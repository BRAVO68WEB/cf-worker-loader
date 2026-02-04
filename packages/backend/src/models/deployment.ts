import { Schema, model, type Model } from "mongoose";

const DeploymentSchema = new Schema(
  {
    target: { type: String, required: true },
    scriptId: { type: Schema.Types.ObjectId, ref: "Script" },
    formId: { type: Schema.Types.ObjectId, ref: "Form" },
    workerName: { type: String, required: true },
    workerRoute: String,
    workerUrl: String,
    status: {
      type: String,
      enum: ["queued", "building", "deploying", "active", "failed"],
      default: "queued",
    },
    deployedAt: Date,
    sourceSha: String,
    errorMessage: String,
  },
  { timestamps: true }
);

export default model("Deployment", DeploymentSchema) as Model<unknown>;
