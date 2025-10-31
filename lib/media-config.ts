/**
 * Platform-agnostic media configuration for social media platforms
 * This allows easy extension to support LinkedIn, Instagram, etc. in the future
 */

export interface MediaSpecs {
  images: {
    maxSize: number; // in bytes
    maxCount: number;
    formats: string[];
  };
  videos: {
    maxSize: number; // in bytes
    maxCount: number;
    formats: string[];
  };
}

export interface PlatformConfig {
  name: string;
  specs: MediaSpecs;
  // Additional platform-specific rules
  allowMixedMedia: boolean; // Can images and videos be combined?
  maxTotalAttachments: number;
}

// X/Twitter specifications
const TWITTER_SPECS: MediaSpecs = {
  images: {
    maxSize: 5 * 1024 * 1024, // 5MB
    maxCount: 4,
    formats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  },
  videos: {
    maxSize: 512 * 1024 * 1024, // 512MB
    maxCount: 1,
    formats: ['video/mp4', 'video/quicktime'] // MP4, MOV
  }
};

// LinkedIn specifications (for future use)
const LINKEDIN_SPECS: MediaSpecs = {
  images: {
    maxSize: 5 * 1024 * 1024, // 5MB
    maxCount: 9,
    formats: ['image/jpeg', 'image/png', 'image/gif']
  },
  videos: {
    maxSize: 200 * 1024 * 1024, // 200MB
    maxCount: 1,
    formats: ['video/mp4', 'video/quicktime']
  }
};

// Instagram specifications (for future use)
const INSTAGRAM_SPECS: MediaSpecs = {
  images: {
    maxSize: 8 * 1024 * 1024, // 8MB
    maxCount: 10,
    formats: ['image/jpeg', 'image/png']
  },
  videos: {
    maxSize: 100 * 1024 * 1024, // 100MB
    maxCount: 1,
    formats: ['video/mp4', 'video/quicktime']
  }
};

export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  twitter: {
    name: 'X (Twitter)',
    specs: TWITTER_SPECS,
    allowMixedMedia: false, // Twitter doesn't allow mixing images and videos
    maxTotalAttachments: 4
  },
  linkedin: {
    name: 'LinkedIn',
    specs: LINKEDIN_SPECS,
    allowMixedMedia: true,
    maxTotalAttachments: 9
  },
  instagram: {
    name: 'Instagram',
    specs: INSTAGRAM_SPECS,
    allowMixedMedia: true,
    maxTotalAttachments: 10
  }
};

/**
 * Get platform configuration by platform key
 */
export function getPlatformConfig(platform: string): PlatformConfig {
  const config = PLATFORM_CONFIGS[platform];
  if (!config) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  return config;
}

/**
 * Get supported platforms list
 */
export function getSupportedPlatforms(): string[] {
  return Object.keys(PLATFORM_CONFIGS);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get human-readable file type from MIME type
 */
export function getFileTypeLabel(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Video';
  return 'File';
}
