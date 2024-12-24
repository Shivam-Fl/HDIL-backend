const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Update = require('../models/Update');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// @route   GET api/updates
// @desc    Get all updates
// @access  Public
router.get('/', async (req, res) => {
  try {
    const updates = await Update.find().sort({ createdAt: -1 }).populate('createdBy', 'username');
    res.json(updates);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/updates
// @desc    Create a new update
// @access  Private (Admin only)
router.post(
  '/',
  [
    auth,
    upload.single('image'),
    [
      check('type', 'Type is required').not().isEmpty(),
      check('title', 'Title is required').not().isEmpty(),
      check('content', 'Content is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      if (req.user.role !== 'admin') {
        return res.status(401).json({ msg: 'Not authorized' });
      }

      const { type, title, content } = req.body;

      let imageUrl = null;
      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path);
        imageUrl = result.secure_url;
      }

      const newUpdate = new Update({
        type,
        title,
        content,
        imageUrl,
        createdBy: req.user.id
      });

      const update = await newUpdate.save();

      res.json(update);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT api/updates/:id
// @desc    Update an update
// @access  Private (Admin only)
router.put('/:id', [auth, [
  check('type', 'Type is required').not().isEmpty(),
  check('title', 'Title is required').not().isEmpty(),
  check('content', 'Content is required').not().isEmpty()
]], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    if (req.user.role !== 'admin') {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    let update = await Update.findById(req.params.id);

    if (!update) {
      return res.status(404).json({ msg: 'Update not found' });
    }

    update = await Update.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    res.json(update);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Update not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/updates/:id
// @desc    Delete an update
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const update = await Update.findById(req.params.id);

    if (!update) {
      return res.status(404).json({ msg: 'Update not found' });
    }

    await update.remove();

    res.json({ msg: 'Update removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Update not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;

