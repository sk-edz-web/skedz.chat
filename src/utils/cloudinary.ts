/**
 * Uploads a file or base64 data to Cloudinary using an unsigned upload preset.
 * Offers dynamic client-side local configuration via local storage with environment variable fallbacks.
 */
export async function uploadToCloudinary(fileOrBlob: File | Blob | string): Promise<string> {
  // Retrieve settings (preference: dynamic in-app overrides -> environment variables)
  const cloudName = localStorage.getItem('cloudinary_cloud_name') || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
  const uploadPreset = localStorage.getItem('cloudinary_upload_preset') || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

  // If Cloudinary setup is not yet configured, throw an error with guidance
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary config is missing. Setup Cloud Name and Upload Preset in Profile Settings to unlock uploading.');
  }

  const formData = new FormData();

  // If the file is already a base64 string, we append it directly
  if (typeof fileOrBlob === 'string') {
    formData.append('file', fileOrBlob);
  } else {
    formData.append('file', fileOrBlob);
  }

  formData.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to upload image to Cloudinary.');
  }

  const result = await response.json();
  return result.secure_url;
}

/**
 * Checks if Cloudinary is configured.
 */
export function isCloudinaryConfigured(): boolean {
  const cloudName = localStorage.getItem('cloudinary_cloud_name') || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = localStorage.getItem('cloudinary_upload_preset') || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  return !!(cloudName && uploadPreset);
}
