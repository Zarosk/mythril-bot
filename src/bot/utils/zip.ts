/**
 * Zip Utility
 * Compresses directories into zip archives
 */

import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from '../../utils/logger';

export interface ZipResult {
  success: boolean;
  zipPath?: string;
  sizeBytes?: number;
  error?: string;
}

/**
 * Create a zip archive of a directory
 * @param sourcePath Directory to compress
 * @param zipName Name for the zip file (without extension)
 * @returns Promise with zip result
 */
export async function createZip(
  sourcePath: string,
  zipName: string
): Promise<ZipResult> {
  // Validate source exists
  if (!fs.existsSync(sourcePath)) {
    return {
      success: false,
      error: `Source path does not exist: ${sourcePath}`,
    };
  }

  const stats = fs.statSync(sourcePath);
  if (!stats.isDirectory()) {
    return {
      success: false,
      error: `Source path is not a directory: ${sourcePath}`,
    };
  }

  // Create zip in temp directory
  const tempDir = path.join(os.tmpdir(), 'mythril-zips');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const sanitizedName = zipName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const timestamp = Date.now();
  const zipPath = path.join(tempDir, `${sanitizedName}_${timestamp}.zip`);

  return new Promise((resolve) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    output.on('close', () => {
      const sizeBytes = archive.pointer();
      logger.info('Zip created successfully', {
        zipPath,
        sizeBytes,
        sourcePath,
      });
      resolve({
        success: true,
        zipPath,
        sizeBytes,
      });
    });

    archive.on('error', (err) => {
      logger.error('Failed to create zip', { error: err.message, sourcePath });
      resolve({
        success: false,
        error: `Archive error: ${err.message}`,
      });
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        logger.warn('Zip warning: file not found', { error: err.message });
      } else {
        throw err;
      }
    });

    archive.pipe(output);

    // Add the entire directory with its contents
    archive.directory(sourcePath, false);

    archive.finalize();
  });
}

/**
 * Delete a zip file
 * @param zipPath Path to the zip file
 */
export function deleteZip(zipPath: string): boolean {
  try {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
      logger.debug('Deleted zip file', { zipPath });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Failed to delete zip', {
      zipPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Clean up old zip files (older than specified hours)
 * @param maxAgeHours Maximum age in hours (default: 24)
 */
export function cleanupOldZips(maxAgeHours: number = 24): number {
  const tempDir = path.join(os.tmpdir(), 'mythril-zips');

  if (!fs.existsSync(tempDir)) {
    return 0;
  }

  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const now = Date.now();
  let deletedCount = 0;

  try {
    const files = fs.readdirSync(tempDir);

    for (const file of files) {
      if (!file.endsWith('.zip')) continue;

      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAgeMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
        logger.debug('Cleaned up old zip', { filePath, ageHours: age / (60 * 60 * 1000) });
      }
    }

    if (deletedCount > 0) {
      logger.info('Cleaned up old zip files', { deletedCount, maxAgeHours });
    }
  } catch (error) {
    logger.error('Error during zip cleanup', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return deletedCount;
}

/**
 * Get the size of a file in bytes
 * @param filePath Path to the file
 */
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Format bytes to human-readable string
 * @param bytes Size in bytes
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
