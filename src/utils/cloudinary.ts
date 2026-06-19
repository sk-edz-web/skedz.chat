/**
 * Compress an image file to a lightweight data URL for optimal database storage
 */
export function compressImage(file: File | Blob, maxWidth = 600, maxHeight = 600, quality = 0.65): Promise<string> {
  return new Promise((resolve) => {
    if (!(file instanceof Blob)) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions matching max aspect ratios
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        } else {
          resolve(event.target?.result as string || "");
        }
      };
      img.onerror = () => {
        resolve(event.target?.result as string || "");
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      resolve("");
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Read file as raw base64 data URL
 */
export function readFileAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string || "");
    };
    reader.onerror = () => {
      resolve("");
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a file or base64 data to Cloudinary using an unsigned upload preset.
 * Offers dynamic client-side local configuration via local storage with environment variable fallbacks.
 * If Cloudinary is not configured, automatically compresses the image to a lightweight Base64 string for direct local persistence.
 */
export async function uploadToCloudinary(fileOrBlob: File | Blob | string): Promise<string> {
  // Retrieve settings (preference: dynamic in-app overrides -> environment variables)
  const cloudName = localStorage.getItem('cloudinary_cloud_name') || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
  const uploadPreset = localStorage.getItem('cloudinary_upload_preset') || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

  const isVideo = fileOrBlob instanceof File && fileOrBlob.type.startsWith('video/');

  // If Cloudinary setup is not yet configured, fallback to high-performance inline base64 compression
  if (!cloudName || !uploadPreset) {
    if (typeof fileOrBlob === 'string') {
      return fileOrBlob;
    }
    if (isVideo) {
      return await readFileAsDataURL(fileOrBlob);
    }
    const compressedBase64 = await compressImage(fileOrBlob);
    return compressedBase64;
  }

  const formData = new FormData();

  // If the file is already a base64 string, we append it directly
  if (typeof fileOrBlob === 'string') {
    formData.append('file', fileOrBlob);
  } else {
    formData.append('file', fileOrBlob);
  }

  formData.append('upload_preset', uploadPreset);

  const resourceType = isVideo ? 'video' : 'image';

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to upload file to Cloudinary.');
    }

    const result = await response.json();
    return result.secure_url;
  } catch (err: any) {
    // If real Cloudinary upload fails, print console warning and fallback to compressed base64 representation
    console.warn("Cloudinary upload failed, falling back to base64: ", err);
    if (typeof fileOrBlob === 'string') {
      return fileOrBlob;
    }
    if (isVideo) {
      return await readFileAsDataURL(fileOrBlob);
    }
    const compressedBase64 = await compressImage(fileOrBlob);
    return compressedBase64;
  }
}

/**
 * Checks if upload is configured. We always return true since we now support both real Cloudinary and our local compressed Base64 fallback!
 */
export function isCloudinaryConfigured(): boolean {
  return true;
}
