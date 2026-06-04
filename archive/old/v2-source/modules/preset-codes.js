// preset-codes.js — 발주 프리셋 코드(예: B0, C3) 부여/충돌 해소
//
// 책임:
//   - 새 preset에 들어갈 prefix/suffix 결정
//   - 기존 state의 prefix 충돌(서로 다른 product가 같은 글자 사용) 자동 해소
//
// 원칙: 사람이 익숙한 코드는 최대한 유지. 변경은 충돌 해소에 필요한 만큼만.

const CODE_RE = /^([A-Z])(\d+)$/;

function parseCode(code) {
  const m = CODE_RE.exec(String(code || ""));
  if (!m) return null;
  return { prefix: m[1], suffix: parseInt(m[2], 10) };
}

// 해당 product가 "원래 쓰던" prefix 추정 — 가장 많이 쓰인 글자, 동률은 첫 등장.
function preferredPrefixOfProduct(state, productId) {
  const counts = new Map();
  let firstSeen = "";
  Object.values(state.presets || {}).forEach(p => {
    if (p.productId !== productId) return;
    const parsed = parseCode(p.code);
    if (!parsed) return;
    counts.set(parsed.prefix, (counts.get(parsed.prefix) || 0) + 1);
    if (!firstSeen) firstSeen = parsed.prefix;
  });
  if (!counts.size) return "";
  let best = firstSeen;
  let bestCount = counts.get(best) || 0;
  counts.forEach((c, prefix) => {
    if (c > bestCount) { best = prefix; bestCount = c; }
  });
  return best;
}

// 새 preset에 부여할 prefix.
// 우선순위: 이 product가 이미 쓰던 prefix → productOrder 기반 글자 → 사용 가능한 첫 글자.
export function pickPresetPrefix(state, productId) {
  const own = preferredPrefixOfProduct(state, productId);
  if (own) return own;

  const taken = new Set();
  Object.values(state.presets || {}).forEach(p => {
    if (p.productId === productId) return;
    const parsed = parseCode(p.code);
    if (parsed) taken.add(parsed.prefix);
  });

  const order = Array.isArray(state.productOrder) ? state.productOrder : [];
  const idx = order.indexOf(productId);
  if (idx >= 0 && idx < 26) {
    const letter = String.fromCharCode(65 + idx);
    if (!taken.has(letter)) return letter;
  }
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!taken.has(letter)) return letter;
  }
  return "P";
}

// 해당 product의 prefix 안에서 사용 가능한 가장 작은 suffix.
export function pickPresetSuffix(state, productId, prefix) {
  const used = new Set();
  Object.values(state.presets || {}).forEach(p => {
    if (p.productId !== productId) return;
    const parsed = parseCode(p.code);
    if (parsed && parsed.prefix === prefix) used.add(parsed.suffix);
  });
  let n = 0;
  while (used.has(n)) n++;
  return n;
}

// 새 preset 1건의 자동 코드.
export function generatePresetCode(state, productId) {
  const prefix = pickPresetPrefix(state, productId);
  const suffix = pickPresetSuffix(state, productId, prefix);
  return `${prefix}${suffix}`;
}

// 기존 presets에서 prefix 충돌(같은 글자를 서로 다른 product가 사용)을 해소.
// 변경된 presets 객체를 반환. 변경 없으면 null.
//
// 규칙:
//   - product 하나당 prefix 하나로 통일.
//   - 후보 prefix: 그 product의 기존 코드 중 가장 흔한 글자. (없으면 productOrder 기반)
//   - productOrder가 앞선 product가 prefix를 선점. 뒤쪽 product가 양보.
//   - suffix는 가능한 그대로 유지. 같은 product 안에서 suffix 충돌 나면 빈 번호로 재할당.
export function computeNormalizedPresets(state) {
  if (!state || !state.presets) return null;
  const presets = state.presets;
  const presetIds = Object.keys(presets);
  if (!presetIds.length) return null;

  const order = Array.isArray(state.productOrder) ? state.productOrder : [];
  const productIdsWithPresets = new Set(
    presetIds.map(id => presets[id].productId).filter(Boolean)
  );

  // productOrder 순 + 나머지(orphan)
  const orderedProductIds = [
    ...order.filter(pid => productIdsWithPresets.has(pid)),
    ...[...productIdsWithPresets].filter(pid => !order.includes(pid))
  ];

  const assigned = new Map(); // productId → prefix
  const taken = new Set();

  orderedProductIds.forEach(pid => {
    const desired = preferredPrefixOfProduct(state, pid);
    if (desired && !taken.has(desired)) {
      assigned.set(pid, desired);
      taken.add(desired);
      return;
    }
    const idx = order.indexOf(pid);
    if (idx >= 0 && idx < 26) {
      const letter = String.fromCharCode(65 + idx);
      if (!taken.has(letter)) {
        assigned.set(pid, letter);
        taken.add(letter);
        return;
      }
    }
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!taken.has(letter)) {
        assigned.set(pid, letter);
        taken.add(letter);
        return;
      }
    }
    assigned.set(pid, "P");
    taken.add("P");
  });

  const next = {};
  let changed = false;

  orderedProductIds.forEach(pid => {
    const prefix = assigned.get(pid);
    // targetWeight 오름차순으로 처리해 suffix 재할당이 결정적이게.
    const productPresets = presetIds
      .map(id => presets[id])
      .filter(p => p.productId === pid)
      .sort((a, b) => (a.targetWeight || 0) - (b.targetWeight || 0));

    const usedSuffix = new Set();
    productPresets.forEach(p => {
      const parsed = parseCode(p.code);
      let suffix = parsed ? parsed.suffix : -1;
      if (suffix < 0 || usedSuffix.has(suffix)) {
        let n = 0;
        while (usedSuffix.has(n)) n++;
        suffix = n;
      }
      usedSuffix.add(suffix);
      const newCode = `${prefix}${suffix}`;
      if (p.code !== newCode) {
        changed = true;
        next[p.id] = { ...p, code: newCode };
      } else {
        next[p.id] = p;
      }
    });
  });

  // 위 루프에서 안 다뤄진 preset(예외 케이스) 보존
  presetIds.forEach(id => {
    if (!next[id]) next[id] = presets[id];
  });

  return changed ? next : null;
}
