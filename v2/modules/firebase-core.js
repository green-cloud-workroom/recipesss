// firebase-core.js - shared Firebase app instance.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js?v=20260513-scroll-auth-rules-1";

let app = null;

export function getFirebaseApp() {
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}
