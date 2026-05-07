/**
 * Build public URL path for a multer `req.file` saved under uploads/<folder>/.
 */
function publicUploadPathFromFile(req, folder) {
  if (!req.file) {
    return undefined;
  }
  return `/uploads/${folder}/${req.file.filename}`;
}

module.exports = { publicUploadPathFromFile };
