const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { FeedbackQuestion, FeedbackResponse } = require('../models/feedback');
const auth = require('../middleware/auth');

// ==========================================
// FEEDBACK QUESTION ROUTES (ADMIN SIDE)
// ==========================================

// @route   GET api/feedback/questions/admin
// @desc    Get all feedback questions (admin view)
// @access  Private (Admin only)
router.get('/questions/admin', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const questions = await FeedbackQuestion.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username');
    
    res.status(200).json(questions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/feedback/questions
// @desc    Get all active feedback questions (user view)
// @access  Public
router.get('/questions', async (req, res) => {
  try {
    const currentDate = new Date();
    const questions = await FeedbackQuestion.find({ 
      isActive: true,
      $or: [
        { expiresAt: { $gt: currentDate } },
        { expiresAt: null }
      ]
    }).sort({ createdAt: -1 });
    
    res.status(200).json(questions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/feedback/questions/:id
// @desc    Get feedback question by ID
// @access  Public
router.get('/questions/:id', async (req, res) => {
  try {
    const question = await FeedbackQuestion.findById(req.params.id);

    if (!question) {
      return res.status(404).json({ msg: 'Feedback question not found' });
    }

    res.json(question);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Feedback question not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   POST api/feedback/questions
// @desc    Create a new feedback question
// @access  Private (Admin only)
router.post(
  '/questions',
  [
    auth,
    [
      check('title', 'Title is required').not().isEmpty(),
      check('description', 'Description is required').not().isEmpty(),
      check('category', 'Category must be valid').isIn([
        'general', 'technical', 'feature', 'service', 'other'
      ])
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(401).json({ msg: 'Not authorized' });
      }

      const { title, description, category, expiresAt } = req.body;

      const newQuestion = new FeedbackQuestion({
        title,
        description,
        category,
        createdBy: req.user.id,
        expiresAt: expiresAt || null
      });

      const question = await newQuestion.save();

      res.json(question);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT api/feedback/questions/:id
// @desc    Update a feedback question
// @access  Private (Admin only)
router.put(
  '/questions/:id',
  [
    auth,
    [
      check('title', 'Title is required').not().isEmpty(),
      check('description', 'Description is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(401).json({ msg: 'Not authorized' });
      }

      const question = await FeedbackQuestion.findById(req.params.id);

      if (!question) {
        return res.status(404).json({ msg: 'Feedback question not found' });
      }

      const { title, description, category, isActive, expiresAt } = req.body;

      // Update fields
      question.title = title;
      question.description = description;
      if (category) question.category = category;
      if (isActive !== undefined) question.isActive = isActive;
      if (expiresAt) question.expiresAt = expiresAt;

      await question.save();

      res.json(question);
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'Feedback question not found' });
      }
      res.status(500).send('Server Error');
    }
  }
);

// @route   DELETE api/feedback/questions/:id
// @desc    Delete a feedback question
// @access  Private (Admin only)
router.delete('/questions/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const question = await FeedbackQuestion.findById(req.params.id);

    if (!question) {
      return res.status(404).json({ msg: 'Feedback question not found' });
    }

    // Get all responses for this question
    const responses = await FeedbackResponse.find({ feedbackId: req.params.id });
    
    // If there are responses, don't delete but set isActive to false
    if (responses.length > 0) {
      question.isActive = false;
      await question.save();
      return res.json({ msg: 'Feedback question deactivated (has responses)' });
    }

    // If no responses, delete the question
    await question.remove();

    res.json({ msg: 'Feedback question removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Feedback question not found' });
    }
    res.status(500).send('Server Error');
  }
});

// ==========================================
// FEEDBACK RESPONSE ROUTES (USER & ADMIN SIDE)
// ==========================================

// @route   GET api/feedback/responses/admin
// @desc    Get all feedback responses (admin view)
// @access  Private (Admin only)
router.get('/responses/admin', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const responses = await FeedbackResponse.find()
      .sort({ createdAt: -1 })
      .populate('feedbackId', 'title category')
      .populate('createdBy', 'username email');
    
    res.status(200).json(responses);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/feedback/responses/question/:questionId
// @desc    Get all responses for a specific question (admin view)
// @access  Private (Admin only)
router.get('/responses/question/:questionId', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const responses = await FeedbackResponse.find({ feedbackId: req.params.questionId })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username email');
    
    res.status(200).json(responses);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/feedback/responses/me
// @desc    Get all feedback responses by current user
// @access  Private
router.get('/responses/me', auth, async (req, res) => {
  try {
    const responses = await FeedbackResponse.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .populate('feedbackId', 'title description category');
    
    res.status(200).json(responses);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/feedback/responses
// @desc    Submit a feedback response
// @access  Private
router.post(
  '/responses',
  [
    auth,
    [
      check('feedbackId', 'Feedback question ID is required').not().isEmpty(),
      check('response', 'Response is required').not().isEmpty(),
      
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { feedbackId, response, rating } = req.body;

      // Check if the feedback question exists and is active
      const question = await FeedbackQuestion.findById(feedbackId);
      if (!question) {
        return res.status(404).json({ msg: 'Feedback question not found' });
      }
      
      if (!question.isActive) {
        return res.status(400).json({ msg: 'This feedback question is no longer active' });
      }
      
      if (question.expiresAt && new Date(question.expiresAt) < new Date()) {
        return res.status(400).json({ msg: 'This feedback question has expired' });
      }

      // Check if user has already responded to this question
      const existingResponse = await FeedbackResponse.findOne({
        feedbackId,
        createdBy: req.user.id
      });

      if (existingResponse) {
        return res.status(400).json({ msg: 'You have already submitted feedback for this question' });
      }

      const newResponse = new FeedbackResponse({
        feedbackId,
        response,
        rating: rating || null,
        createdBy: req.user.id
      });

      const savedResponse = await newResponse.save();

      res.json(savedResponse);
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'Feedback question not found' });
      }
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT api/feedback/responses/:id/comment
// @desc    Add admin comment to a response
// @access  Private (Admin only)
router.put(
  '/responses/:id/comment',
  [
    auth,
    [
      check('adminComment', 'Comment is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(401).json({ msg: 'Not authorized' });
      }

      const response = await FeedbackResponse.findById(req.params.id);

      if (!response) {
        return res.status(404).json({ msg: 'Feedback response not found' });
      }

      response.adminComment = req.body.adminComment;
      response.status = 'addressed';
      response.updatedAt = Date.now();

      await response.save();

      res.json(response);
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'Feedback response not found' });
      }
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT api/feedback/responses/:id/status
// @desc    Update response status
// @access  Private (Admin only)
router.put(
  '/responses/:id/status',
  [
    auth,
    [
      check('status', 'Status must be valid').isIn(['pending', 'viewed', 'addressed'])
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(401).json({ msg: 'Not authorized' });
      }

      const response = await FeedbackResponse.findById(req.params.id);

      if (!response) {
        return res.status(404).json({ msg: 'Feedback response not found' });
      }

      response.status = req.body.status;
      response.updatedAt = Date.now();

      await response.save();

      res.json(response);
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'Feedback response not found' });
      }
      res.status(500).send('Server Error');
    }
  }
);

// @route   DELETE api/feedback/responses/:id
// @desc    Delete a response
// @access  Private (Admin or owner only)
router.delete('/responses/:id', auth, async (req, res) => {
  try {
    const response = await FeedbackResponse.findById(req.params.id);

    if (!response) {
      return res.status(404).json({ msg: 'Feedback response not found' });
    }

    // Check if user is admin or the creator of the response
    if (req.user.role !== 'admin' && response.createdBy.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    await response.remove();

    res.json({ msg: 'Feedback response removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Feedback response not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;