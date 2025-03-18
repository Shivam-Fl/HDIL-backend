const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for feedback questions created by admin
const FeedbackQuestionSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'technical', 'feature', 'service', 'other'],
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  }
});

// Schema for user responses to feedback questions
const FeedbackResponseSchema = new Schema({
  feedbackId: {
    type: Schema.Types.ObjectId,
    ref: 'feedbackQuestion',
    required: true
  },
  response: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  status: {
    type: String,
    enum: ['pending', 'viewed', 'addressed'],
    default: 'pending'
  },
  adminComment: {
    type: String
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const FeedbackQuestion = mongoose.model('feedbackQuestion', FeedbackQuestionSchema);
const FeedbackResponse = mongoose.model('feedbackResponse', FeedbackResponseSchema);

module.exports = {
  FeedbackQuestion,
  FeedbackResponse
};