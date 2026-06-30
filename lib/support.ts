import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase-config";

export interface SupportContactConfig {
  phoneNumber: string;
  displayNumber: string;
  smsNumber?: string;
}

export const DEFAULT_SUPPORT_NUMBER = "+16787378687";

/**
 * Fetches the support contact number dynamically from Firestore (app_config/support_contact).
 * Fallbacks to the default number if not found or if the request fails.
 */
export const getSupportContactNumber = async (): Promise<string> => {
  try {
    const docRef = doc(db, "app_config", "support_contact");
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      return data.phoneNumber || DEFAULT_SUPPORT_NUMBER;
    }
  } catch (error) {
    console.error("Error fetching support contact number from Firestore:", error);
  }
  return DEFAULT_SUPPORT_NUMBER;
};
