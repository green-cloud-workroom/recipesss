// auth-gate.js - email/password login gate.

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { isFirebaseConfigured } from "./firebase-config.js?v=20260513-hidden-supplements-1";
import { getFirebaseApp } from "./firebase-core.js?v=20260513-hidden-supplements-1";

let auth = null;

export function getFirebaseAuth() {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

export function requireAuth() {
  if (!isFirebaseConfigured) return Promise.resolve(null);
  const authInstance = getFirebaseAuth();

  return new Promise(resolve => {
    let settled = false;
    const unsubscribe = onAuthStateChanged(authInstance, user => {
      if (user && !settled) {
        settled = true;
        hideLoginGate();
        unsubscribe();
        resolve(user);
        return;
      }

      if (!user) {
        showLoginGate(authInstance, userAfterLogin => {
          if (settled) return;
          settled = true;
          hideLoginGate();
          unsubscribe();
          resolve(userAfterLogin);
        });
      }
    });
  });
}

export function initAuthControls() {
  if (!isFirebaseConfigured) return;
  const header = document.querySelector(".header-btns");
  if (!header || document.getElementById("logoutBtn")) return;

  const button = document.createElement("button");
  button.id = "logoutBtn";
  button.className = "download-btn";
  button.type = "button";
  button.textContent = "로그아웃";
  button.addEventListener("click", async () => {
    await signOut(getFirebaseAuth());
    location.reload();
  });
  header.appendChild(button);
}

function showLoginGate(authInstance, onSuccess) {
  if (document.getElementById("loginGate")) return;

  const style = document.createElement("style");
  style.id = "loginGateStyle";
  style.textContent = `
    .login-gate {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: grid;
      place-items: center;
      background: rgba(239, 236, 230, 0.96);
      padding: 20px;
    }
    .login-panel {
      width: min(380px, 100%);
      background: var(--bg);
      border: 0.5px solid var(--border);
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 18px 60px rgba(0,0,0,0.12);
    }
    .login-panel h1 {
      font-size: 18px;
      margin-bottom: 6px;
    }
    .login-panel p {
      color: var(--text2);
      font-size: 13px;
      margin-bottom: 18px;
    }
    .login-panel label {
      display: block;
      font-size: 12px;
      color: var(--text2);
      margin: 12px 0 6px;
    }
    .login-panel input {
      width: 100%;
      border: 0.5px solid var(--border2);
      border-radius: 8px;
      background: var(--bg2);
      color: var(--text);
      padding: 11px 12px;
    }
    .login-panel button {
      width: 100%;
      margin-top: 16px;
      justify-content: center;
    }
    .login-error {
      min-height: 18px;
      margin-top: 10px;
      color: #c03c2f;
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);

  const gate = document.createElement("div");
  gate.id = "loginGate";
  gate.className = "login-gate";
  gate.innerHTML = `
    <form class="login-panel" id="loginForm">
      <h1>로그인</h1>
      <p>등록된 Firebase 계정으로 접속해 주세요.</p>
      <label for="loginEmail">이메일</label>
      <input id="loginEmail" type="email" autocomplete="email" required>
      <label for="loginPassword">비밀번호</label>
      <input id="loginPassword" type="password" autocomplete="current-password" required>
      <button class="btn btn-primary" type="submit">로그인</button>
      <div class="login-error" id="loginError"></div>
    </form>
  `;
  document.body.appendChild(gate);

  const form = document.getElementById("loginForm");
  const email = document.getElementById("loginEmail");
  const password = document.getElementById("loginPassword");
  const error = document.getElementById("loginError");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.textContent = "";
    try {
      const credential = await signInWithEmailAndPassword(
        authInstance,
        email.value.trim(),
        password.value
      );
      onSuccess(credential.user);
    } catch (err) {
      console.warn("[auth] sign in failed", err);
      error.textContent = "이메일 또는 비밀번호를 확인해 주세요.";
    }
  });

  setTimeout(() => email.focus(), 50);
}

function hideLoginGate() {
  document.getElementById("loginGate")?.remove();
  document.getElementById("loginGateStyle")?.remove();
}
