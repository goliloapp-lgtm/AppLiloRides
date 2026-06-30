import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '../firebase-config';

/**
 * Uploads a local image file to Firebase Storage.
 * 
 * @param {string} localUri - The local file URI from expo-image-picker.
 * @returns {Promise<string>} - The public download URL.
 */
export const uploadProfileImage = async (localUri: string): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No user is logged in");
  }

  try {
    const storage = getStorage();

    // Convert localUri to Blob using XMLHttpRequest for React Native compatibility
    const blob: Blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        reject(new TypeError("Network request failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", localUri, true);
      xhr.send(null);
    });

    // Create a unique file name based on the user's UID and timestamp
    const fileName = `profile-images/${currentUser.uid}/${Date.now()}.jpg`;
    const storageRef = ref(storage, fileName);

    // Upload the blob
    console.log('[uploadProfileImage] Starting uploadBytes...');
    await uploadBytes(storageRef, blob);
    console.log('[uploadProfileImage] uploadBytes completed successfully.');

    // Get the public URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('[uploadProfileImage] Download URL retrieved:', downloadURL);

    return downloadURL;
  } catch (error) {
    console.error('[uploadProfileImage] Error uploading profile image to Firebase Storage:', error);
    throw error;
  }
};
