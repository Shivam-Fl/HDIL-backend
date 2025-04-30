const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Industry = require('../models/Industry');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, new Date().toISOString().replace(/:/g, '-') + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5000000 } // 5MB limit
});

// File upload fields configuration
const uploadFields = [
  { name: 'industryImages', maxCount: 5 },
  { name: 'productImages[0]', maxCount: 3 },
  { name: 'productImages[1]', maxCount: 3 },
  { name: 'productImages[2]', maxCount: 3 },
  { name: 'productImages[3]', maxCount: 3 },
  { name: 'productImages[4]', maxCount: 3 },
  // Support up to 5 products with 3 images each
];

// @route   GET api/industries
// @desc    Get all industries with active owners
// @access  Public
router.get('/', async (req, res) => {
  try {
    const industries = await Industry.find()
      .populate('owner', 'username status')
      .lean();
    console.log('Industries:', industries);

    // Filter industries to include only those with active owners
    const activeIndustries = industries.filter(
      (industry) => industry.owner && industry.owner.status === 'active'
    );

    if (!activeIndustries.length) {
      return res.status(201).json({ msg: 'No industries found with active owners'});
    }

    res.json(activeIndustries);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/industries/:id
// @desc    Get industry by ID only if the owner is active
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const industry = await Industry.findById(req.params.id).populate('owner', 'username status');

    if (!industry) {
      return res.status(404).json({ msg: 'Industry not found' });
    }

    // Check if the owner is active
    if (industry.owner.status !== 'active') {
      return res.status(403).json({ msg: 'Owner is not active' });
    }

    res.json(industry);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Industry not found' });
    }
    res.status(500).send('Server Error');
  }
});


// @route   GET api/industries/owner/:ownerId
// @desc    Get industries by owner ID only if the owner is active
// @access  Public
router.get('/owner/:ownerId', async (req, res) => {
  try {
    const industries = await Industry.find({ owner: req.params.ownerId }).populate('owner', 'username status');

    if (!industries.length) {
      return res.status(404).json({ msg: 'No industries found for this owner' });
    }

    // Ensure the owner is active
    if (industries[0].owner.status !== 'active') {
      return res.status(403).json({ msg: 'Owner is not active' });
    }

    res.json(industries);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'No industries found for this owner' });
    }
    res.status(500).send('Server Error');
  }
});


// Helper function for uploading images to Cloudinary
const uploadImagesToCloudinary = async (files) => {
  if (!files || files.length === 0) return [];
  
  const uploadPromises = files.map(file =>
    cloudinary.uploader.upload(file.path, { folder: 'industries' })
  );
  
  try {
    const uploadResults = await Promise.all(uploadPromises);
    
    // Delete local files after uploading
    files.forEach(file => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
    
    return uploadResults.map(result => result.secure_url);
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    // Clean up local files even if upload fails
    files.forEach(file => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
    throw error;
  }
};

// @route   POST api/industries
// @desc    Create an industry
// @access  Private
router.post(
  '/',
  [
    auth,
    upload.fields(uploadFields),
    [
      check('name', 'Name is required').not().isEmpty(),
      check('description', 'Description is required').not().isEmpty(),
      check('gstInfo', 'GST information is required').not().isEmpty(),
      check('contactNumber', 'Contact number is required').not().isEmpty(),
      check('email', 'Please include a valid email').isEmail(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { 
        name, 
        description, 
        gstInfo, 
        contactNumber, 
        email, 
        address, 
        legalInformation,
        products, 
        materials 
      } = req.body;

      // Upload industry images to Cloudinary
      const industryImages = req.files['industryImages'] ? 
        await uploadImagesToCloudinary(req.files['industryImages']) : 
        [];

      // Parse products and vacancy data
      let parsedProducts = typeof products === 'string' ? JSON.parse(products) : products || [];
      let parsedMaterials = typeof materials === 'string' ? JSON.parse(materials) : materials || [];
      
      // Parse vacancy data
      let vacancy = {
        available: req.body['vacancy[available]'] === 'true',
        description: req.body['vacancy[description]'] || ''
      };

      // Process product images
      for (let i = 0; i < parsedProducts.length; i++) {
        const productImageFiles = req.files[`productImages[${i}]`];
        if (productImageFiles && productImageFiles.length > 0) {
          const productImages = await uploadImagesToCloudinary(productImageFiles);
          parsedProducts[i].images = productImages;
        }
      }

      const newIndustry = new Industry({
        name,
        description,
        gstInfo,
        contactNumber,
        email,
        address,
        legalInformation,
        vacancy,
        products: parsedProducts,
        materials: parsedMaterials,
        images: industryImages,
        owner: req.user.id
      });

      const industry = await newIndustry.save();

      res.json(industry);
    } catch (err) {
      console.error('Error creating industry:', err);
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT api/industries/:id
// @desc    Update an industry
// @access  Private
router.put(
  '/:id',
  [
    auth,
    upload.fields(uploadFields)
  ],
  async (req, res) => {
    try {
      let industry = await Industry.findById(req.params.id);

      if (!industry) {
        return res.status(404).json({ msg: 'Industry not found' });
      }

      // Make sure user owns industry or is an admin
      if (industry.owner.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(401).json({ msg: 'Not authorized' });
      }

      // Prepare updates object
      const updates = {
        name: req.body.name,
        description: req.body.description,
        gstInfo: req.body.gstInfo,
        contactNumber: req.body.contactNumber,
        email: req.body.email,
        address: req.body.address,
        legalInformation: req.body.legalInformation,
        vacancy: {
          available: req.body['vacancy[available]'] === 'true',
          description: req.body['vacancy[description]'] || ''
        }
      };

      // Parse materials
      if (req.body.materials) {
        updates.materials = typeof req.body.materials === 'string' ? 
          JSON.parse(req.body.materials) : 
          req.body.materials;
      }

      // Upload new industry images if provided
      if (req.files['industryImages'] && req.files['industryImages'].length > 0) {
        updates.images = await uploadImagesToCloudinary(req.files['industryImages']);
      }

      // Parse and process products with their images
      if (req.body.products) {
        let parsedProducts = typeof req.body.products === 'string' ? 
          JSON.parse(req.body.products) : 
          req.body.products;

        // Process product images
        for (let i = 0; i < parsedProducts.length; i++) {
          const productImageFiles = req.files[`productImages[${i}]`];
          if (productImageFiles && productImageFiles.length > 0) {
            const productImages = await uploadImagesToCloudinary(productImageFiles);
            parsedProducts[i].images = productImages;
          }
        }

        updates.products = parsedProducts;
      }

      // Update the industry
      industry = await Industry.findByIdAndUpdate(
        req.params.id, 
        { $set: updates }, 
        { new: true }
      );

      res.json(industry);
    } catch (err) {
      console.error('Error updating industry:', err);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'Industry not found' });
      }
      res.status(500).send('Server Error');
    }
  }
);

// @route   DELETE api/industries/:id
// @desc    Delete an industry
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const industry = await Industry.findById(req.params.id);

    if (!industry) {
      return res.status(404).json({ msg: 'Industry not found' });
    }

    // Make sure user owns industry or is an admin
    if (industry.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    await industry.remove();

    res.json({ msg: 'Industry removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Industry not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;