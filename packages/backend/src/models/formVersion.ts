import { Schema, model, type Model } from "mongoose";

const FieldSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  label: String,
  type: { type: String, required: true },
  placeholder: String,
  validation: Schema.Types.Mixed,
});

const PageSchema = new Schema({
  id: { type: String, required: true },
  title: String,
  fields: [FieldSchema],
});

const FormScriptRefSchema = new Schema({
  scriptId: { type: Schema.Types.ObjectId, ref: "Script", required: true },
  event: { type: String, required: true },
  order: { type: Number, default: 0 },
});

const FormVersionSchema = new Schema(
  {
    formId: { type: Schema.Types.ObjectId, ref: "Form", required: true },
    version: { type: Number, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    pages: [PageSchema],
    scripts: [FormScriptRefSchema],
  },
  { timestamps: true }
);

FormVersionSchema.index({ formId: 1, version: 1 }, { unique: true });

export default model("FormVersion", FormVersionSchema) as Model<unknown>;
