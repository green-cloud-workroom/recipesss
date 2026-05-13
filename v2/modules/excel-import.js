// excel-import.js - SheetJS workbook -> v2 import payload

const SUPPLEMENT_RE = /(난각|멸치|철|아연|구리|망간|비타민|차전|소금|미역|홍삼|켈프|요오드|마그네슘|킬레이트|토코페롤|크랜베리 가루|망고 가루|컬리플라워 가루|^Sa$|^Mii$|^Cha$|^H$)/i;
const SPECIES_RE = /(고양이|강아지|공용|cat|dog|puppy)/i;

function text(value) {
  return String(value ?? "").trim();
}

function inferSpeciesFromText(fileName, sheetName) {
  const value = `${fileName || ""} ${sheetName || ""}`.toLowerCase();
  if (/(강아지|dog|puppy)/i.test(value)) return "dog";
  if (/(고양이|cat|kitty)/i.test(value)) return "cat";
  return null;
}

function speciesFromText(value) {
  const clean = text(value).toLowerCase();
  if (/강아지|dog|puppy/.test(clean)) return "dog";
  if (/고양이|cat|kitty/.test(clean)) return "cat";
  return null;
}

function splitSpeciesPrefix(name) {
  const clean = text(name);
  const match = clean.match(/^\((고양이|강아지)\)\s*/);
  if (!match) return { species: null, name: clean };
  return {
    species: match[1] === "고양이" ? "cat" : "dog",
    name: clean.replace(/^\((고양이|강아지)\)\s*/, "").trim()
  };
}

function isMeaningfulWeight(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getCell(rows, row, col) {
  return rows[row]?.[col] ?? null;
}

function getInheritedSpecies(rows, col, fallback) {
  const speciesRow = rows[0] || [];
  for (let current = col; current >= 0; current -= 1) {
    const value = speciesRow[current];
    if (!value) continue;
    if (SPECIES_RE.test(text(value))) return speciesFromText(value);
  }
  return fallback || null;
}

function isRecipeTitle(value) {
  const clean = text(value);
  if (!clean) return false;
  if (SPECIES_RE.test(clean)) return false;
  if (/영양제/.test(clean)) return false;
  return true;
}

function findRecipeBlocks(rows) {
  const blocks = [];

  // Most workbooks here use either:
  // row 0: species / row 1: product names, or row 0: product name directly.
  [0, 1].forEach(productRow => {
    const row = rows[productRow] || [];
    for (let col = 0; col < row.length; col += 1) {
      const name = row[col];
      if (!isRecipeTitle(name)) continue;
      const firstItem = getCell(rows, productRow + 1, col);
      const firstWeight = getCell(rows, productRow + 1, col + 1);
      const targetWeight = row[col + 2];
      if (!text(firstItem) || !isMeaningfulWeight(firstWeight)) continue;
      blocks.push({ productRow, col, name, targetWeight });
    }
  });

  // If a sheet has product titles on row 0, row 1 is usually ingredient data,
  // not another product header. Keep the top-level blocks only.
  const hasTopLevel = blocks.some(block => block.productRow === 0);
  return blocks
    .filter(block => !hasTopLevel || block.productRow === 0)
    .filter((block, index, list) =>
      list.findIndex(other => other.productRow === block.productRow && other.col === block.col) === index
    );
}

function inferKind(name) {
  return SUPPLEMENT_RE.test(text(name)) ? "supplement" : "ingredient";
}

function buildImportedRow(name, weight, kind, isUnitRow) {
  const cleanName = text(name);
  return {
    ingredientName: cleanName,
    kind,
    weight: Number(weight) || 0,
    unit: isUnitRow ? "kg" : "g",
    isUnit: kind === "ingredient" ? Boolean(isUnitRow) : false,
    unitLabel: isUnitRow && /통닭|닭$/.test(cleanName) ? "마리" : ""
  };
}

function collectRowsFromBlock(rows, block) {
  const composition = [];
  const used = new Set();

  for (let rowIndex = block.productRow + 1; rowIndex < rows.length; rowIndex += 1) {
    const itemName = getCell(rows, rowIndex, block.col);
    const baseWeight = getCell(rows, rowIndex, block.col + 1);
    if (!text(itemName) || !isMeaningfulWeight(baseWeight)) continue;

    const kind = inferKind(itemName);
    const isUnitRow = kind === "ingredient" && !composition.some(item => item.kind === "ingredient" && item.isUnit);
    composition.push(buildImportedRow(itemName, baseWeight, kind, isUnitRow));
    used.add(rowIndex);
  }

  // Some small sheets put supplements in a separate two-column block immediately
  // to the right of the ingredient block, headed by "...영양제".
  const sideTitle = getCell(rows, block.productRow, block.col + 3);
  if (/영양제/.test(text(sideTitle))) {
    for (let rowIndex = block.productRow + 1; rowIndex < rows.length; rowIndex += 1) {
      const itemName = getCell(rows, rowIndex, block.col + 3);
      const baseWeight = getCell(rows, rowIndex, block.col + 4);
      if (!text(itemName) || !isMeaningfulWeight(baseWeight)) continue;
      if (used.has(rowIndex) && text(itemName) === text(getCell(rows, rowIndex, block.col))) continue;
      composition.push(buildImportedRow(itemName, baseWeight, "supplement", false));
    }
  }

  return composition;
}

function parseSheet(workbook, sheetName, fileName) {
  const sheet = workbook.Sheets[sheetName];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  const inferredSpecies = inferSpeciesFromText(fileName, sheetName);
  const products = [];

  findRecipeBlocks(rows).forEach(block => {
    const parsedName = splitSpeciesPrefix(block.name);
    const productName = parsedName.name;
    if (!productName) return;

    const composition = collectRowsFromBlock(rows, block);
    if (!composition.length) return;

    const unitRow = composition.find(row => row.isUnit);
    products.push({
      name: productName,
      species: parsedName.species || getInheritedSpecies(rows, block.col, inferredSpecies),
      unitLabel: unitRow?.unitLabel || "",
      composition
    });
  });

  return products;
}

export function parseRecipeWorkbook(workbook, fileName) {
  const products = workbook.SheetNames.flatMap(sheetName => parseSheet(workbook, sheetName, fileName));
  return {
    products,
    species: null,
    sheetName: workbook.SheetNames.join(", ")
  };
}

export async function readRecipeExcelFile(file) {
  if (!window.XLSX) {
    throw new Error("엑셀 가져오기 라이브러리를 불러오지 못했습니다. 인터넷 연결 후 다시 시도해 주세요.");
  }
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array" });
  return parseRecipeWorkbook(workbook, file.name);
}
