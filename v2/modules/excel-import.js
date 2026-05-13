// excel-import.js — SheetJS workbook -> v2 import payload

function inferSpeciesFromText(fileName, sheetName) {
  const text = `${fileName || ""} ${sheetName || ""}`.toLowerCase();
  if (/(강아지|개|dog|puppy)/i.test(text)) return "dog";
  if (/(고양이|cat|kitty)/i.test(text)) return "cat";
  return null;
}

function splitSpeciesPrefix(name) {
  const clean = String(name || "").trim();
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

function buildImportedRow(name, weight, kind, isUnitRow) {
  const cleanName = String(name || "").trim();
  return {
    ingredientName: cleanName,
    kind,
    weight: Number(weight) || 0,
    unit: isUnitRow ? "kg" : "g",
    isUnit: kind === "ingredient" ? Boolean(isUnitRow) : false,
    unitLabel: isUnitRow && /통닭/.test(cleanName) ? "마리" : ""
  };
}

export function parseRecipeWorkbook(workbook, fileName) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  const inferredSpecies = inferSpeciesFromText(fileName, sheetName);
  const products = [];
  const header = rows[0] || [];

  for (let start = 0; start < header.length; start += 4) {
    const parsedName = splitSpeciesPrefix(header[start]);
    const productName = parsedName.name;
    if (!productName) continue;

    const species = parsedName.species || inferredSpecies;
    const composition = [];

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const itemName = row[start];
      const baseWeight = row[start + 1];
      if (!itemName || !isMeaningfulWeight(baseWeight)) continue;

      const kind = rowIndex >= 12 ? "supplement" : "ingredient";
      const isUnitRow = kind === "ingredient" && !composition.some(item => item.kind === "ingredient");
      composition.push(buildImportedRow(itemName, baseWeight, kind, isUnitRow));
    }

    if (composition.length) {
      const unitRow = composition.find(row => row.isUnit);
      products.push({
        name: productName,
        species,
        unitLabel: unitRow?.unitLabel || "",
        composition
      });
    }
  }

  return { products, species: inferredSpecies, sheetName };
}

export async function readRecipeExcelFile(file) {
  if (!window.XLSX) {
    throw new Error("엑셀 가져오기 라이브러리를 불러오지 못했습니다. 인터넷 연결 후 다시 시도해 주세요.");
  }
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array" });
  return parseRecipeWorkbook(workbook, file.name);
}
