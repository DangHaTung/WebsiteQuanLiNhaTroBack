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
      resource_type: "image",
      format: undefined, // auto from original
      public_id: undefined, // auto
      transformation: [{ quality: "auto:good" }],
    };
  },
});

export const uploadSingleImage = multer({ storage: imageStorage }).single("image");
export const uploadMultipleImages = multer({ storage: imageStorage }).array("images", 10);


