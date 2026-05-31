import sharp from "sharp";

export const maxCompressedImageBytes = 200 * 1024;

export async function compressImageForStorage(input: Buffer): Promise<Buffer> {
  let maxDimension = 1600;
  let quality = 82;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const output = await sharp(input, { animated: false })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (output.length <= maxCompressedImageBytes) {
      return output;
    }

    if (quality > 42) {
      quality -= 10;
    } else {
      maxDimension = Math.max(360, Math.floor(maxDimension * 0.82));
      quality = 72;
    }
  }

  return sharp(input, { animated: false })
    .rotate()
    .resize({ width: 360, height: 360, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 36, mozjpeg: true })
    .toBuffer();
}
