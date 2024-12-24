const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Industry = require('../models/Industry');
const auth = require('../middleware/auth');

// @route   GET api/industries
// @desc    Get all industries
// @access  Public
router.get('/', async (req, res) => {
  try {
    const industries = await Industry.find().populate('owner', 'username');
    res.json(industries);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/industries/:id
// @desc    Get industry by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const industry = await Industry.findById(req.params.id).populate('owner', 'username');

    if (!industry) {
      return res.status(404).json({ msg: 'Industry not found' });
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

// @route   POST api/industries
// @desc    Create a industry
// @access  Private
router.post(
  '/',
  [
    auth,
    [
      check('name', 'Name is required').not().isEmpty(),
      check('description', 'Description is required').not().isEmpty(),
      check('gstInfo', 'GST information is required').not().isEmpty(),
      check('contactNumber', 'Contact number is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, description, products, materials, gstInfo, contactNumber, vacancy, images } = req.body;
      console.log(req.body);
      // Parse and process products
      const parsedProducts = typeof products === 'string' ? JSON.parse(products) : products;

      const newIndustry = new Industry({
        name,
        description,
        products: parsedProducts,
        materials: typeof materials === 'string' ? JSON.parse(materials) : materials,
        gstInfo,
        contactNumber,
        vacancy: typeof vacancy === 'string' ? JSON.parse(vacancy) : vacancy,
        owner: req.user.id,
        images: images || []
      });

      const industry = await newIndustry.save();

      res.json(industry);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   PUT api/industries/:id
// @desc    Update an industry, including products and their images
// @access  Private
router.put('/:id', [auth], async (req, res) => {
  try {
    let industry = await Industry.findById(req.params.id);

    if (!industry) {
      return res.status(404).json({ msg: 'Industry not found' });
    }

    // Make sure user owns industry or is an admin
    if (industry.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const { products, ...updates } = req.body;
    console.log(products);
    updates.products = typeof products === 'string' ? JSON.parse(products) : products;

    industry = await Industry.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );

    res.json(industry);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Industry not found' });
    }
    res.status(500).send('Server Error');
  }
});

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


// const express = require('express');
// const router = express.Router();
// const { check, validationResult } = require('express-validator');
// const Industry = require('../models/Industry');
// const auth = require('../middleware/auth');
// const multer = require('multer');
// const cloudinary = require('cloudinary').v2;

// // Configure Cloudinary
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

// // Configure multer for file uploads
// const upload = multer({ dest: 'uploads/' });

// // @route   GET api/industries
// // @desc    Get all industries
// // @access  Public
// router.get('/', async (req, res) => {
//   try {
//     const industries = await Industry.find().populate('owner', 'username');
//     res.json(industries);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server Error');
//   }
// });

// // @route   GET api/industries/:id
// // @desc    Get industry by ID
// // @access  Public
// router.get('/:id', async (req, res) => {
//   try {
//     const industry = await Industry.findById(req.params.id).populate('owner', 'username');

//     if (!industry) {
//       return res.status(404).json({ msg: 'Industry not found' });
//     }

//     res.json(industry);
//   } catch (err) {
//     console.error(err.message);
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Industry not found' });
//     }
//     res.status(500).send('Server Error');
//   }
// });

// // @route   POST api/industries
// // @desc    Create a industry
// // @access  Private
// router.post(
//   '/',
//   [
//     auth,
//     upload.array('images', 5),
//     [
//       check('name', 'Name is required').not().isEmpty(),
//       check('description', 'Description is required').not().isEmpty(),
//       check('gstInfo', 'GST information is required').not().isEmpty(),
//       check('contactNumber', 'Contact number is required').not().isEmpty()
//     ]
//   ],
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array() });
//     }

//     try {
//       const { name, description, products, materials, gstInfo, contactNumber, vacancy } = req.body;

//       // Upload industry-level images to Cloudinary
//       const imagePromises = req.files?.map(file => cloudinary.uploader.upload(file.path));
//       const imageResults = await Promise.all(imagePromises);
//       const images = imageResults?.map(result => result.secure_url);

//       // Parse and process products
//       const parsedProducts = typeof products === 'string' ? JSON.parse(products) : products;
//       const processedProducts = await Promise.all(
//         parsedProducts?.map(async product => {
//           const productImages = product?.images || [];
//           const imageUploadPromises = productImages?.map(imagePath =>
//             cloudinary.uploader.upload(imagePath)
//           );
//           const uploadedImages = await Promise.all(imageUploadPromises);
//           return {
//             ...product,
//             images: uploadedImages?.map(image => image.secure_url)
//           };
//         })
//       );

//       const newIndustry = new Industry({
//         name,
//         description,
//         products: processedProducts,
//         materials: typeof materials === 'string' ? JSON.parse(materials) : materials,
//         gstInfo,
//         contactNumber,
//         vacancy: typeof vacancy === 'string' ? JSON.parse(vacancy) : vacancy,
//         owner: req.user.id,
//         images
//       });

//       const industry = await newIndustry.save();

//       res.json(industry);
//     } catch (err) {
//       console.error(err.message);
//       res.status(500).send('Server Error');
//     }
//   }
// );

// // @route   PUT api/industries/:id
// // @desc    Update an industry, including products and their images
// // @access  Private
// router.put('/:id', [auth], async (req, res) => {
//   try {
//     let industry = await Industry.findById(req.params.id);

//     if (!industry) {
//       return res.status(404).json({ msg: 'Industry not found' });
//     }

//     // Make sure user owns industry or is an admin
//     if (industry.owner.toString() !== req.user.id && req.user.role !== 'admin') {
//       return res.status(401).json({ msg: 'Not authorized' });
//     }

//     const { products, ...updates } = req.body;

//     // Process products and their images
//     const parsedProducts = typeof products === 'string' ? JSON.parse(products) : products;
//     const updatedProducts = await Promise.all(
//       parsedProducts.map(async product => {
//         if (product.images && product.images.length > 0) {
//           const imageUploadPromises = product.images.map(imagePath =>
//             cloudinary.uploader.upload(imagePath)
//           );
//           const uploadedImages = await Promise.all(imageUploadPromises);
//           product.images = uploadedImages.map(image => image.secure_url);
//         }
//         return product;
//       })
//     );

//     updates.products = updatedProducts;

//     industry = await Industry.findByIdAndUpdate(
//       req.params.id,
//       { $set: updates },
//       { new: true }
//     );

//     res.json(industry);
//   } catch (err) {
//     console.error(err.message);
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Industry not found' });
//     }
//     res.status(500).send('Server Error');
//   }
// });

// // @route   DELETE api/industries/:id
// // @desc    Delete an industry
// // @access  Private
// router.delete('/:id', auth, async (req, res) => {
//   try {
//     const industry = await Industry.findById(req.params.id);

//     if (!industry) {
//       return res.status(404).json({ msg: 'Industry not found' });
//     }

//     // Make sure user owns industry or is an admin
//     if (industry.owner.toString() !== req.user.id && req.user.role !== 'admin') {
//       return res.status(401).json({ msg: 'Not authorized' });
//     }

//     await industry.remove();

//     res.json({ msg: 'Industry removed' });
//   } catch (err) {
//     console.error(err.message);
//     if (err.kind === 'ObjectId') {
//       return res.status(404).json({ msg: 'Industry not found' });
//     }
//     res.status(500).send('Server Error');
//   }
// });

// module.exports = router;
