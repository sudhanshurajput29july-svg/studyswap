const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud',
  api_key: process.env.CLOUDINARY_API_KEY || 'mock_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_secret'
});

// Configure Multer Storage
let storage;
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name') {
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      // Determine folder based on file type
      let folder = 'studyswap_resources';
      let allowedFormats = ['jpg', 'png', 'jpeg', 'pdf'];
      
      if (file.mimetype.startsWith('image/')) {
        folder = 'studyswap_avatars';
      }
      
      return {
        folder: folder,
        allowed_formats: allowedFormats,
        resource_type: 'auto'
      };
    }
  });
} else {
  console.warn('CLOUDINARY configuration not provided. Falling back to local disk storage for development...');
  // Standard disk storage fallback so local runs never fail
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // We will save to a public folder in the workspace for local testing
      cb(null, './');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
}

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
