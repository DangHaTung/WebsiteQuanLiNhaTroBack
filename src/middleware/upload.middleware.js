import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "rooms",
      resource_type: "auto",
      format: undefined, // auto from original
      public_id: undefined, // auto
      transformation: [{ quality: "auto:good" }],
    };
  },
});

export const uploadSingleImage = multer({ storage: imageStorage }).single("image");
export const uploadMultipleImages = multer({ storage: imageStorage }).array("images", 10);

// Accept both `images` (multiple) and `image` (single) fields
export const uploadRoomImages = multer({ storage: imageStorage }).fields([
  { name: "images", maxCount: 10 },
  { name: "image", maxCount: 1 },
]);


// ===== Final Contract & CCCD Uploads =====
const allowedMimes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const fileFilter = (req, file, cb) => {
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error("Invalid file type. Only images and PDFs are allowed."));
  }
  cb(null, true);
};

const contractStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPdfMime = file.mimetype === "application/pdf";
    const isPdfName = /\.pdf$/i.test(file.originalname || "");
    const isPdf = isPdfMime || isPdfName;
    return {
      folder: "final_contracts",
      resource_type: isPdf ? "raw" : "image", // force raw for PDFs, image for images
      format: undefined,
      public_id: undefined,
    };
  },
});

export const uploadFinalContractFiles = multer({
  storage: contractStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter,
}).array("files", 10);


