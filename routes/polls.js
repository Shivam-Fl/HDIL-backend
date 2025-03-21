const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Poll = require('../models/Poll');
const auth = require('../middleware/auth');

// @route   GET api/polls
// @desc    Get all polls
// @access  Public
router.get('/admin',auth, async (req, res) => {
  try {
    const polls = await Poll.find().sort({ createdAt: -1 }).populate('createdBy', 'username');
    res.status(200).json(polls);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const currentDate = new Date(); // Get the current date and time
    const polls = await Poll.find({ 
        expiresAt: { $gte: currentDate }, // Only fetch non-expired polls
        votedBy: { $ne: req.user.id } // Exclude polls where the user has already voted
      })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username');

    res.status(200).json(polls);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});



// @route   POST api/polls
// @desc    Create a new poll
// @access  Private (Admin only)
router.post(
  '/',
  [
    auth,
    [
      check('question', 'Question is required').not().isEmpty(),
      check('options', 'At least two options are required').isArray({ min: 2 }),
      check('expiresAt', 'Expiration date is required').not().isEmpty()
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

      const { question, options, expiresAt } = req.body;

      const newPoll = new Poll({
        question,
        options: options.map(option => ({ text: option, votes: 0 })),
        expiresAt,
        createdBy: req.user.id
      });

      const poll = await newPoll.save();

      res.json(poll);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT api/polls/:id/vote
// @desc    Vote on a poll
// @access  Private
router.put('/vote/:id', auth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ msg: 'Poll not found' });
    }

    if (new Date(poll.expiresAt) < new Date()) {
      return res.status(400).json({ msg: 'This poll has expired' });
    }

    if (poll.votedBy.includes(req.user.id)) {
      return res.status(400).json({ msg: 'You have already voted on this poll' });
    }

    const { optionId } = req.body;

    if (optionId < 0 || optionId >= poll.options.length) {
      return res.status(400).json({ msg: 'Invalid option' });
    }

    poll.options[optionId].votes += 1;
    poll.votedBy.push(req.user.id);

    await poll.save();

    res.json(poll);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Poll not found' });
    }
    res.status(500).send('Server Error');
  }
});


// @route   DELETE api/polls/:id
// @desc    Delete a poll
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ msg: 'Poll not found' });
    }

    await poll.remove();

    res.json({ msg: 'Poll removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Poll not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;

