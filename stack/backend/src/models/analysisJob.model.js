import mongoose from 'mongoose';

const { Schema } = mongoose;

const fileSchema = new Schema({
  originalName: { type: String, required: true },
  sanitizedName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  sha256: { type: String, required: true },
  extension: { type: String, required: true },
  width: { type: Number, default: null },
  height: { type: Number, default: null },
  steganography: {
    score: { type: Number, required: true, default: 0 },
    suspicious: { type: Boolean, required: true, default: false },
    reasons: { type: [String], default: [] }
  },
  tempPath: { type: String, required: true }
}, { _id: false });

const analysisJobSchema = new Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['QUEUED', 'VALIDATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REGENERATING_PDF', 'PDF_READY'],
    required: true,
    default: 'QUEUED'
  },
  region: { type: String, required: true, default: 'Karnataka' },
  userMode: { type: String, enum: ['farmer', 'consumer'], default: 'farmer' },
  requestType: {
    type: String,
    enum: ['predict', 'batch'],
    required: true
  },
  fileCount: { type: Number, required: true, default: 0 },
  totalBytes: { type: Number, required: true, default: 0 },
  queueWeight: { type: Number, required: true, default: 1 },
  queuePriority: { type: Number, required: true, default: 1 },
  files: { type: [fileSchema], default: [] },
  warnings: { type: [String], default: [] },
  metadata: {
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null }
  },
  mlResponse: { type: Schema.Types.Mixed, default: null },
  chartSegments: { type: Schema.Types.Mixed, default: null },
  pdf: {
    path: { type: String, default: null },
    generatedAt: { type: Date, default: null },
    regeneratedAt: { type: Date, default: null }
  },
  error: {
    message: { type: String, default: null },
    stack: { type: String, default: null }
  },
  events: [{
    status: { type: String, required: true },
    message: { type: String, default: '' },
    at: { type: Date, default: Date.now }
  }],
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, {
  timestamps: true,
  versionKey: false
});

analysisJobSchema.index({ status: 1, createdAt: 1 });

analysisJobSchema.methods.addEvent = function addEvent(status, message = '') {
  this.events.push({ status, message, at: new Date() });
};

export const AnalysisJob = mongoose.model('AnalysisJob', analysisJobSchema);
