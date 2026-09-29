import { buildCompactCode } from '../../../components/common/CompactCode.jsx';

const STOCK_TEMPLATE_MODES = Object.freeze({
  IMPORT: 'IMPORT',
  DAILY_COUNT: 'DAILY_COUNT',
});

const NORMALIZED_HEADER_ALIASES = Object.freeze({
  ingredientId: ['mahethong', 'ingredientid', 'idnguyenlieu', 'ingredientuuid'],
  shortCode: ['mangan', 'shortcode', 'compactcode'],
  ingredientName: ['tennguyenlieu', 'ingredientname', 'ten'],
  unit: ['donvi', 'unit'],
  currentStock: ['tonhientai', 'currentstock', 'tonkhohientai'],
  importQuantity: ['soluongnhap', 'importquantity', 'soluong'],
  theoreticalStock: ['tonlythuyet', 'theoreticalstock', 'tonlythuyethientai'],
  actualStock: ['tonthucte', 'actualstock', 'soluongkiemke'],
  note: ['ghichu', 'note'],
});

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function getRowValueByAlias(row, fieldName) {
  const aliases = NORMALIZED_HEADER_ALIASES[fieldName] || [];
  const entries = Object.entries(row || {});

  for (const [key, value] of entries) {
    if (aliases.includes(normalizeHeader(key))) {
      return value;
    }
  }

  return '';
}

function toCellString(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

async function loadXlsxLibrary() {
  const xlsxModule = await import('xlsx');
  return xlsxModule.default || xlsxModule;
}

function createInstructionsSheet(XLSX, mode) {
  const instructions =
    mode === STOCK_TEMPLATE_MODES.IMPORT
      ? [
          ['HUONG DAN NHAP KHO HANG LOAT'],
          ['1. Khong sua cot "Ma he thong" vi he thong dung cot nay de nhan dien nguyen lieu.'],
          ['2. Chi can dien cot "So luong nhap" va neu can thi them "Ghi chu".'],
          ['3. Co the de trong cac dong khong muon nhap kho trong dot nay.'],
        ]
      : [
          ['HUONG DAN KIEM KE NGAY'],
          ['1. Khong sua cot "Ma he thong" vi he thong dung cot nay de nhan dien nguyen lieu.'],
          ['2. Cot "Ton thuc te" da duoc dien san theo ton ly thuyet hien tai. Chi can sua cac gia tri co chenh lech.'],
          ['3. Co the them "Ghi chu" cho tung dong neu can giai thich chenh lech.'],
        ];

  const worksheet = XLSX.utils.aoa_to_sheet(instructions);
  worksheet['!cols'] = [{ wch: 120 }];
  return worksheet;
}

function createImportRows(ingredients) {
  return ingredients.map((ingredient) => ({
    'Mã hệ thống': ingredient.id,
    'Mã ngắn': buildCompactCode(ingredient.id, 'NL'),
    'Tên nguyên liệu': ingredient.name,
    'Đơn vị': ingredient.unit,
    'Tồn hiện tại': ingredient.currentStock,
    'Số lượng nhập': '',
    'Ghi chú': '',
  }));
}

function createDailyCountRows(ingredients) {
  return ingredients.map((ingredient) => ({
    'Mã hệ thống': ingredient.id,
    'Mã ngắn': buildCompactCode(ingredient.id, 'NL'),
    'Tên nguyên liệu': ingredient.name,
    'Đơn vị': ingredient.unit,
    'Tồn lý thuyết': ingredient.currentStock,
    'Tồn thực tế': ingredient.currentStock,
    'Ghi chú': '',
  }));
}

function createDataSheet(XLSX, mode, ingredients) {
  const rows =
    mode === STOCK_TEMPLATE_MODES.IMPORT
      ? createImportRows(ingredients)
      : createDailyCountRows(ingredients);

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 40 },
    { wch: 16 },
    { wch: 28 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 36 },
  ];

  return worksheet;
}

function createWorkbook(XLSX, mode, ingredients) {
  const workbook = XLSX.utils.book_new();
  const dataSheetName = mode === STOCK_TEMPLATE_MODES.IMPORT ? 'NhapKho' : 'KiemKeNgay';

  XLSX.utils.book_append_sheet(workbook, createInstructionsSheet(XLSX, mode), 'HuongDan');
  XLSX.utils.book_append_sheet(workbook, createDataSheet(XLSX, mode, ingredients), dataSheetName);

  return workbook;
}

function resolveWorksheet(workbook, mode) {
  const preferredSheetName = mode === STOCK_TEMPLATE_MODES.IMPORT ? 'NhapKho' : 'KiemKeNgay';

  if (workbook.Sheets[preferredSheetName]) {
    return workbook.Sheets[preferredSheetName];
  }

  const fallbackSheetName = workbook.SheetNames.find((sheetName) => sheetName !== 'HuongDan');
  return fallbackSheetName ? workbook.Sheets[fallbackSheetName] : null;
}

function isRowCompletelyEmpty(row) {
  return Object.values(row || {}).every((value) => toCellString(value) === '');
}

function parseImportedRow(row, mode) {
  if (isRowCompletelyEmpty(row)) {
    return null;
  }

  const ingredientId = toCellString(getRowValueByAlias(row, 'ingredientId'));
  const note = toCellString(getRowValueByAlias(row, 'note'));

  if (!ingredientId) {
    return null;
  }

  if (mode === STOCK_TEMPLATE_MODES.IMPORT) {
    return {
      ingredientId,
      quantity: toCellString(getRowValueByAlias(row, 'importQuantity')),
      note,
    };
  }

  return {
    ingredientId,
    actualStock: toCellString(
      getRowValueByAlias(row, 'actualStock') || getRowValueByAlias(row, 'theoreticalStock'),
    ),
    note,
  };
}

export async function downloadStockTemplate(arg1, arg2, arg3) {
  let mode, ingredients, fileNameDate;
  if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
    mode = arg1.mode;
    ingredients = arg1.ingredients || [];
    fileNameDate = arg1.fileNameDate;
  } else if (Array.isArray(arg1)) {
    ingredients = arg1;
    mode = arg2;
    fileNameDate = arg3;
  } else {
    mode = arg1;
    ingredients = arg2 || [];
    fileNameDate = arg3;
  }

  const XLSX = await loadXlsxLibrary();
  const workbook = createWorkbook(XLSX, mode, ingredients);
  const safeDate = toCellString(fileNameDate) || new Date().toISOString().slice(0, 10);
  const fileName =
    mode === STOCK_TEMPLATE_MODES.IMPORT
      ? `mau-nhap-kho-${safeDate}.xlsx`
      : `mau-kiem-ke-ngay-${safeDate}.xlsx`;

  XLSX.writeFile(workbook, fileName, { compression: true });
}

export async function parseStockTemplateFile(file, mode) {
  const XLSX = await loadXlsxLibrary();
  const fileBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const worksheet = resolveWorksheet(workbook, mode);

  if (!worksheet) {
    throw new Error('File không chứa sheet dữ liệu hợp lệ.');
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });

  return rows
    .map((row) => parseImportedRow(row, mode))
    .filter(Boolean);
}

export { STOCK_TEMPLATE_MODES };

export default {
  downloadStockTemplate,
  parseStockTemplateFile,
  STOCK_TEMPLATE_MODES,
};
