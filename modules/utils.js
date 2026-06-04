// utils.js — 공통 헬퍼 (DOM 무관)

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmt(num) {
  const value = Math.round((Number(num) || 0) * 100) / 100;
  return value % 1 === 0
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// 항상 소수점 2자리 (영양제 중량 등 작은 값 표시용)
export function fmt2(num) {
  return (Number(num) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function fmtInt(num) {
  return Math.round(Number(num) || 0).toLocaleString();
}

// DOM에서 weight 입력값을 g 기준으로 정규화
export function parseWeightInput(rawValue, unit) {
  const v = parseFloat(rawValue) || 0;
  return unit === "kg" ? v * 1000 : v;
}

// g 기준 weight를 표시용 (kg이면 /1000)
export function displayWeight(weightInG, unit) {
  if (!weightInG) return "";
  return unit === "kg" ? weightInG / 1000 : weightInG;
}
