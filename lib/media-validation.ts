/**
 * Media validation utilities and thumbnail generation
 */

import { getPlatformConfig, type PlatformConfig } from './media-config';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface MediaAttachment {
  id: string;
  file: File;
  thumbnail: string;
  type: 'image' | 'video';
  size: number;
  name: string;
}

/**
 * Validate file type against platform specifications
 */
export function validateFileType(file: File, platform: string): ValidationResult {
  const config = getPlatformConfig(platform);
  const mimeType = file.type;
  
  // Check if it's an image
  if (mimeType.startsWith('image/')) {
    if (!config.specs.images.formats.includes(mimeType)) {
      return {
        isValid: false,
        error: `Image format not supported. Allowed: ${config.specs.images.formats.join(', ')}`
      };
    }
  }
  // Check if it's a video
  else if (mimeType.startsWith('video/')) {
    if (!config.specs.videos.formats.includes(mimeType)) {
      return {
        isValid: false,
        error: `Video format not supported. Allowed: ${config.specs.videos.formats.join(', ')}`
      };
    }
  }
  // Not a supported media type
  else {
    return {
      isValid: false,
      error: 'File type not supported. Please upload an image or video.'
    };
  }
  
  return { isValid: true };
}

/**
 * Validate file size against platform specifications
 */
export function validateFileSize(file: File, platform: string): ValidationResult {
  const config = getPlatformConfig(platform);
  const mimeType = file.type;
  
  if (mimeType.startsWith('image/')) {
    if (file.size > config.specs.images.maxSize) {
      return {
        isValid: false,
        error: `Image too large. Maximum size: ${formatFileSize(config.specs.images.maxSize)}`
      };
    }
  } else if (mimeType.startsWith('video/')) {
    if (file.size > config.specs.videos.maxSize) {
      return {
        isValid: false,
        error: `Video too large. Maximum size: ${formatFileSize(config.specs.videos.maxSize)}`
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Validate media count against platform specifications
 */
export function validateMediaCount(
  currentAttachments: MediaAttachment[],
  newFile: File,
  platform: string
): ValidationResult {
  const config = getPlatformConfig(platform);
  const mimeType = newFile.type;
  
  // Count existing media by type
  const existingImages = currentAttachments.filter(att => att.type === 'image').length;
  const existingVideos = currentAttachments.filter(att => att.type === 'video').length;
  
  // Check if adding this file would exceed limits
  if (mimeType.startsWith('image/')) {
    if (existingImages >= config.specs.images.maxCount) {
      return {
        isValid: false,
        error: `Maximum ${config.specs.images.maxCount} images allowed`
      };
    }
  } else if (mimeType.startsWith('video/')) {
    if (existingVideos >= config.specs.videos.maxCount) {
      return {
        isValid: false,
        error: `Maximum ${config.specs.videos.maxCount} videos allowed`
      };
    }
  }
  
  // Check total attachment limit
  if (currentAttachments.length >= config.maxTotalAttachments) {
    return {
      isValid: false,
      error: `Maximum ${config.maxTotalAttachments} attachments allowed`
    };
  }
  
  // Check mixed media rules
  if (!config.allowMixedMedia) {
    const hasImages = existingImages > 0 || mimeType.startsWith('image/');
    const hasVideos = existingVideos > 0 || mimeType.startsWith('video/');
    
    if (hasImages && hasVideos) {
      return {
        isValid: false,
        error: 'Cannot mix images and videos in the same post'
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Comprehensive validation for a new file
 */
export function validateMediaFile(
  file: File,
  currentAttachments: MediaAttachment[],
  platform: string
): ValidationResult {
  // Validate file type
  const typeResult = validateFileType(file, platform);
  if (!typeResult.isValid) return typeResult;
  
  // Validate file size
  const sizeResult = validateFileSize(file, platform);
  if (!sizeResult.isValid) return sizeResult;
  
  // Validate media count
  const countResult = validateMediaCount(currentAttachments, file, platform);
  if (!countResult.isValid) return countResult;
  
  return { isValid: true };
}

/**
 * Generate thumbnail for image files using Canvas API
 */
export function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }
    
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not create canvas context'));
      return;
    }
    
    img.onload = () => {
      // Calculate thumbnail dimensions (max 200x200, preserve aspect ratio)
      const maxSize = 200;
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw image to canvas
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      // Clean up object URL
      URL.revokeObjectURL(objectUrl);
      
      resolve(dataUrl);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image'));
    };
    
    // Create object URL for the image
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });
}

/**
 * Create media attachment object
 */
export async function createMediaAttachment(file: File): Promise<MediaAttachment> {
  const thumbnail = await generateThumbnail(file);
  
  return {
    id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    file,
    thumbnail,
    type: file.type.startsWith('image/') ? 'image' : 'video',
    size: file.size,
    name: file.name
  };
}

/**
 * Format file size for display (duplicated from media-config for independence)
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
