import 'dotenv/config';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import FinalContract from '../src/models/finalContract.model.js';

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/rental_management';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const log = (...args) => console.log('[RESET]', ...args);

async function resetCloudinaryFolder(prefix) {
  // Delete resources in both image and raw types, then delete folder
  try {
    log(`Deleting Cloudinary resources by prefix: ${prefix} (image)`);
    await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: 'image' });
  } catch (e) {
    log(`Skip image delete for ${prefix}:`, e?.message || e);
  }
  try {
    log(`Deleting Cloudinary resources by prefix: ${prefix} (raw)`);
    await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: 'raw' });
  } catch (e) {
    log(`Skip raw delete for ${prefix}:`, e?.message || e);
  }
  try {
    log(`Deleting Cloudinary folder: ${prefix}`);
    await cloudinary.api.delete_folder(prefix.replace(/\/$/, ''));
  } catch (e) {
    log(`Skip delete_folder for ${prefix}:`, e?.message || e);
  }
}

async function main() {
  log('Connecting MongoDB...', mongoUri);
  await mongoose.connect(mongoUri);
  log('Connected');

  // Purge FinalContract documents
  log('Deleting FinalContract documents...');
  const delRes = await FinalContract.deleteMany({});
  log(`FinalContract deleted: ${delRes.deletedCount}`);

  // Reset Cloudinary assets
  await resetCloudinaryFolder('final_contracts/');
  await resetCloudinaryFolder('cccd_files/');

  await mongoose.disconnect();
  log('Done.');
}

main().catch((err) => {
  console.error('[RESET] Error:', err);
  process.exit(1);
});