// firebase-config.js - Firestore connection for shared recipe data.

export const firebaseConfig = {
  apiKey: "AIzaSyAZt1Ac6OMsgSDvueq1Fsr3JENtGFnNQic",
  authDomain: "recipeee-da9d3.firebaseapp.com",
  projectId: "recipeee-da9d3",
  storageBucket: "recipeee-da9d3.firebasestorage.app",
  messagingSenderId: "596577162592",
  appId: "1:596577162592:web:49dd604237f206de5e3a05",
  measurementId: "G-WGYEHMHXJ4"
};

export const FIREBASE_COLLECTION = "recipe_app_state";
export const FIREBASE_DOCUMENT_ID = "recipesss_v2";

export const isFirebaseConfigured =
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId;
