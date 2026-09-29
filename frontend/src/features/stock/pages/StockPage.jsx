import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  Download,
  Eraser,
  History,
  PackagePlus,
  RefreshCw,
  Upload,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  PackageOpen,
  RotateCcw,
  Trash,
  Factory,
} from 'lucide-react';
import { stockApi } from '../api/stockApi.js';
import { ingredientApi } from '../../ingredients/api/ingredientApi.js';
import { productApi } from '../../products/api/productApi.js';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { WORKSPACE_TYPES } from '../../../constants/roles.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { TextareaInput } from '../../../components/forms/TextareaInput.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { CompactCode, buildCompactCode } from '../../../components/common/CompactCode.jsx';
import { DataTable } from '../../../components/common/DataTable.jsx';
import { StatusBadge } from '../../../components/common/StatusBadge.jsx';
import { validateNonNegativeNumber, validatePositiveNumber, handleNumberKeyDownBlock } from '../../../utils/validators.js';
import {
  downloadStockTemplate,
  parseStockTemplateFile,
  STOCK_TEMPLATE_MODES,
} from '../utils/stockSpreadsheet.js';
import { formatDateTime } from '../../../utils/date.js';
import { STOCK_TRANSACTION_TYPES } from '../../../constants/stockTransactionTypes.js';
import { ProducePreparationTab } from '../components/ProducePreparationTab.jsx';
import '../styles/stockPage.css';

const STOCK_MODES = Object.freeze({
  IMPORT: 'IMPORT',
  DAILY_COUNT: 'DAILY_COUNT',
});

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function createImportDraft(ingredients) {
  return Object.fromEntries(
    ingredients.map((ingredient) => [
      ingredient.id,
      {
        quantity: '',
        note: '',
      },
    ]),
  );
}

function createCountDraft(ingredients) {
  return Object.fromEntries(
    ingredients.map((ingredient) => [
      ingredient.id,
      {
        actualStock: '',
        note: '',
      },
    ]),
  );
}

function normalizeNumericInput(value) {
  return String(value ?? '').replace(',', '.');
}

function formatDisplayNumber(value) {
  const numericValue = Number(value || 0);

  if (Number.isNaN(numericValue)) {
    return '0';
  }

  return numericValue % 1 === 0 ? String(numericValue) : numericValue.toFixed(2);
}

function buildInputStyle(hasError) {
  return hasError
    ? {
        borderColor: 'var(--color-error)',
        boxShadow: '0 0 0 1px var(--color-error)',
      }
    : undefined;
}

function getTransactionBadge(row) {
  if (row.note && row.note.startsWith('[HỦY HÀNG] Hủy nguyên liệu')) {
    return {
      status: 'WARNING',
      label: 'Hủy nguyên liệu',
    };
  }

  if (row.note && row.note.startsWith('[HỦY HÀNG] Hủy thành phẩm')) {
    return {
      status: 'ERROR',
      label: 'Hủy thành phẩm',
    };
  }

  if (row.type === STOCK_TRANSACTION_TYPES.ORDER_DEDUCT) {
    return {
      status: 'ERROR',
      label: 'Khấu trừ đơn',
    };
  }

  if (row.context === 'DAILY_COUNT') {
    return {
      status: 'WARNING',
      label: 'Kiểm kê ngày',
    };
  }

  if (row.type === STOCK_TRANSACTION_TYPES.IMPORT) {
    return {
      status: 'SUCCESS',
      label: 'Nhập kho',
    };
  }

  return {
    status: 'WARNING',
    label: 'Điều chỉnh',
  };
}

function formatStockDelta(value) {
  const numericValue = Number(value || 0);
  return `${numericValue > 0 ? '+' : ''}${numericValue}`;
}

export function StockPage() {
  const { user, workspace } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'adjust';

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const [submitError, setSubmitError] = useState('');

  // Confirm Dialog states
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // ------------------ TAB 4: DISCARD (HỦY HÀNG & THẤT THOÁT) ------------------
  const [discardMode, setDiscardMode] = useState('INGREDIENT'); // 'INGREDIENT' or 'PRODUCT'
  const [discardIngId, setDiscardIngId] = useState('');
  const [discardProductId, setDiscardProductId] = useState('');
  const [discardQty, setDiscardQty] = useState('');
  const [discardNote, setDiscardNote] = useState('');
  const [products, setProducts] = useState([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [discardError, setDiscardError] = useState('');

  const fetchProducts = async () => {
    try {
      setIsProductsLoading(true);
      const response = await productApi.getProducts();
      setProducts(response.data.products || []);
    } catch (err) {
      setProducts([]);
      console.error('Failed to load products for discard:', err);
    } finally {
      setIsProductsLoading(false);
    }
  };

  const handleDiscardSubmit = async (e) => {
    e.preventDefault();
    setDiscardError('');

    const qty = Number(discardQty);
    const qtyError = validatePositiveNumber(qty, 'Số lượng hủy');
    if (qtyError) {
      setDiscardError(qtyError);
      return;
    }

    if (discardMode === 'INGREDIENT' && !discardIngId) {
      setDiscardError('Vui lòng chọn nguyên liệu muốn hủy.');
      return;
    }

    if (discardMode === 'PRODUCT') {
      if (!discardProductId) {
        setDiscardError('Vui lòng chọn sản phẩm đồ uống muốn hủy.');
        return;
      }
      const prod = products.find((p) => String(p.id) === String(discardProductId));
      if (prod && !prod.hasRecipe) {
        setDiscardError(`Sản phẩm "${prod.name}" chưa được thiết lập công thức định lượng nên không thể tính hao phí nguyên liệu.`);
        return;
      }
    }

    const targetName =
      discardMode === 'INGREDIENT'
        ? ingredients.find((i) => String(i.id) === String(discardIngId))?.name
        : products.find((p) => String(p.id) === String(discardProductId))?.name;

    setConfirmDialog({
      isOpen: true,
      title: 'Xác nhận hủy hàng',
      message: `Bạn chắc chắn muốn ghi nhận hủy ${qty} ${
        discardMode === 'INGREDIENT' ? 'đơn vị' : 'ly/cốc'
      } "${targetName}" với lý do: "${discardNote || 'Không có lý do'}"?`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setIsSubmitting(true);
        try {
          const payload = {
            quantity: qty,
            note: discardNote.trim(),
          };
          if (discardMode === 'INGREDIENT') {
            payload.ingredientId = discardIngId;
          } else {
            payload.productId = discardProductId;
          }

          await stockApi.discardStock(payload);

          setToastType('success');
          setToastMsg('Ghi nhận phiếu hủy hàng và trừ kho thành công.');
          setDiscardQty('');
          setDiscardNote('');
          setDiscardIngId('');
          setDiscardProductId('');
          await loadIngredients();
          if (discardMode === 'PRODUCT') {
            await fetchProducts();
          }
        } catch (apiError) {
          setDiscardError(apiError.message || 'Lỗi hệ thống khi thực hiện hủy hàng.');
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  };

  // Quick Import States
  const [quickImportData, setQuickImportData] = useState({
    isOpen: false,
    ingredientId: '',
    ingredientName: '',
    unit: '',
  });
  const [quickImportQty, setQuickImportQty] = useState('');
  const [quickImportNote, setQuickImportNote] = useState('');
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [quickImportError, setQuickImportError] = useState('');

  const handleQuickImportSubmit = async (e) => {
    e.preventDefault();
    setQuickImportError('');

    const qty = Number(quickImportQty);
    const qtyError = validatePositiveNumber(qty, 'Số lượng nhập');
    if (qtyError) {
      setQuickImportError(qtyError);
      return;
    }

    setIsSubmittingImport(true);
    try {
      await stockApi.importStockBatch({
        note: quickImportNote.trim() || 'Nhập kho nhanh',
        items: [
          {
            ingredientId: quickImportData.ingredientId,
            quantity: qty,
            note: 'Nhập nhanh từ cảnh báo dự báo',
          },
        ],
      });
      setToastType('success');
      setToastMsg(`Nhập kho thành công cho nguyên liệu ${quickImportData.ingredientName}.`);
      setQuickImportData({ isOpen: false, ingredientId: '', ingredientName: '', unit: '' });
      await loadIngredients();
      if (activeTab === 'forecast') {
        await fetchForecast();
      }
    } catch (err) {
      setQuickImportError(err.message || 'Lỗi hệ thống khi thực hiện nhập kho nhanh.');
    } finally {
      setIsSubmittingImport(false);
    }
  };

  // ------------------ TAB 1: STOCK ADJUST (KIỂM KÊ & ĐIỀU CHỈNH) ------------------
  const importFileInputRef = useRef(null);
  const countFileInputRef = useRef(null);

  const [ingredients, setIngredients] = useState([]);
  const [activeMode, setActiveMode] = useState(STOCK_MODES.IMPORT);
  const [searchQuery, setSearchQuery] = useState('');
  const [importRows, setImportRows] = useState({});
  const [countRows, setCountRows] = useState({});
  const [importErrors, setImportErrors] = useState({});
  const [countErrors, setCountErrors] = useState({});
  const [importBatchNote, setImportBatchNote] = useState('');
  const [countBatchNote, setCountBatchNote] = useState('');
  const [countDate, setCountDate] = useState(getTodayDateString());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingFile, setIsImportingFile] = useState(false);

  const applyFreshIngredientData = (nextIngredients) => {
    const sortedIngredients = [...nextIngredients].sort((left, right) =>
      left.name.localeCompare(right.name, 'vi'),
    );

    setIngredients(sortedIngredients);
    setImportRows(createImportDraft(sortedIngredients));
    setCountRows(createCountDraft(sortedIngredients));
    setImportErrors({});
    setCountErrors({});
  };

  const loadIngredients = async () => {
    setIsLoading(true);
    setSubmitError('');

    try {
      const response = await ingredientApi.getIngredients();
      applyFreshIngredientData(response.data.ingredients || []);
    } catch (loadError) {
      setIngredients([]);
      setImportRows({});
      setCountRows({});
      setSubmitError(loadError.message || 'Không tải được danh sách nguyên liệu.');
    } finally {
      setIsLoading(false);
    }
  };

  const visibleIngredients = ingredients.filter((ingredient) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return true;
    }

    return [
      ingredient.name,
      ingredient.unit,
      ingredient.id,
      buildCompactCode(ingredient.id, 'NL'),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });

  const readyImportRows = ingredients.filter((ingredient) => {
    const quantity = Number(importRows[ingredient.id]?.quantity || 0);
    return Number.isFinite(quantity) && quantity > 0;
  });

  const totalImportQuantity = readyImportRows.reduce(
    (sum, ingredient) => sum + Number(importRows[ingredient.id]?.quantity || 0),
    0,
  );

  const countPreviewRows = ingredients.map((ingredient) => {
    const actualStock = Number(countRows[ingredient.id]?.actualStock ?? ingredient.currentStock ?? 0);
    const differenceQuantity = actualStock - Number(ingredient.currentStock || 0);

    return {
      ingredientId: ingredient.id,
      differenceQuantity,
    };
  });

  const changedCountRows = countPreviewRows.filter((row) => row.differenceQuantity !== 0);
  const totalCountDifference = countPreviewRows.reduce(
    (sum, row) => sum + row.differenceQuantity,
    0,
  );

  const handleImportRowChange = (ingredientId, fieldName, value) => {
    setImportRows((current) => ({
      ...current,
      [ingredientId]: {
        ...current[ingredientId],
        [fieldName]: fieldName === 'quantity' ? normalizeNumericInput(value) : value,
      },
    }));

    if (importErrors[ingredientId]) {
      setImportErrors((current) => ({ ...current, [ingredientId]: '' }));
    }
  };

  const handleCountRowChange = (ingredientId, fieldName, value) => {
    setCountRows((current) => ({
      ...current,
      [ingredientId]: {
        ...current[ingredientId],
        [fieldName]: fieldName === 'actualStock' ? normalizeNumericInput(value) : value,
      },
    }));

    if (countErrors[ingredientId]) {
      setCountErrors((current) => ({ ...current, [ingredientId]: '' }));
    }
  };

  const clearImportInputs = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa soạn thảo',
      message: 'Bạn có chắc muốn xóa tất cả số lượng nhập đang soạn thảo?',
      onConfirm: () => {
        setImportRows(createImportDraft(ingredients));
        setImportErrors({});
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const resetCountInputs = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Đặt lại số lượng',
      message: 'Đặt lại tất cả số lượng tồn thực tế bằng số lượng tồn lý thuyết hiện tại?',
      onConfirm: () => {
        setCountRows(createCountDraft(ingredients));
        setCountErrors({});
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleImportSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    if (readyImportRows.length === 0) {
      setSubmitError('Bạn chưa nhập số lượng nhập cho bất kỳ nguyên liệu nào.');
      return;
    }

    const nextErrors = {};
    readyImportRows.forEach((ingredient) => {
      const quantityStr = importRows[ingredient.id]?.quantity;
      const quantityNum = Number(quantityStr);
      const validationError = validatePositiveNumber(quantityNum);

      if (validationError) {
        nextErrors[ingredient.id] = validationError;
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      setImportErrors(nextErrors);
      setSubmitError('Vui lòng kiểm tra lại số liệu nhập kho. Số lượng phải là số dương hợp lệ.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Xác nhận nhập kho',
      message: `Xác nhận ghi nhận nhập ${readyImportRows.length} nguyên liệu với tổng số lượng là ${formatDisplayNumber(totalImportQuantity)}?`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setIsSubmitting(true);
        try {
          const payload = {
            note: importBatchNote.trim() || undefined,
            items: readyImportRows.map((ingredient) => {
              const row = importRows[ingredient.id];
              return {
                ingredientId: ingredient.id,
                quantity: Number(row.quantity),
                note: row.note.trim() || undefined,
              };
            }),
          };

          await stockApi.importStockBatch(payload);

          setToastType('success');
          setToastMsg('Ghi nhận lô nhập hàng thành công.');
          setImportBatchNote('');
          await loadIngredients();
          if (activeTab === 'forecast') void fetchForecast();
        } catch (apiError) {
          setSubmitError(apiError.message || 'Lỗi hệ thống khi gửi lô nhập hàng.');
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  };

  const handleDailyCountSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    if (!countDate) {
      setSubmitError('Vui lòng chọn ngày kiểm kê kho.');
      return;
    }

    const nextErrors = {};
    ingredients.forEach((ingredient) => {
      const draft = countRows[ingredient.id];
      const validationError = validateNonNegativeNumber(draft?.actualStock, 'Tồn thực tế');

      if (validationError) {
        nextErrors[ingredient.id] = validationError;
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      setCountErrors(nextErrors);
      setSubmitError('Vui lòng kiểm tra lại số liệu thực tế. Số lượng không được âm.');
      return;
    }

    const doSubmit = async () => {
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      setIsSubmitting(true);
      try {
        const payload = {
          countDate,
          note: countBatchNote.trim() || undefined,
          items: ingredients.map((ingredient) => {
            const row = countRows[ingredient.id];
            return {
              ingredientId: ingredient.id,
              actualStock: Number(row.actualStock),
              note: row.note.trim() || undefined,
            };
          }),
        };

        await stockApi.countDailyStock(payload);

        setToastType('success');
        setToastMsg('Lưu kết quả kiểm kê kho thành công.');
        setCountBatchNote('');
        await loadIngredients();
        if (activeTab === 'forecast') void fetchForecast();
      } catch (apiError) {
        setSubmitError(apiError.message || 'Lỗi hệ thống khi gửi phiếu kiểm kê.');
      } finally {
        setIsSubmitting(false);
      }
    };

    if (workspace?.type === WORKSPACE_TYPES.STORE) {
      setConfirmDialog({
        isOpen: true,
        title: 'Xác nhận kiểm kê',
        message: `Ghi nhận báo cáo kiểm kê ngày ${countDate}?`,
        onConfirm: doSubmit,
      });
    } else if (changedCountRows.length === 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'Xác nhận kiểm kê',
        message: 'Tất cả số lượng thực tế khớp hoàn hảo với lý thuyết. Không có chênh lệch nào được ghi nhận. Bạn vẫn muốn lưu chứ?',
        onConfirm: doSubmit,
      });
    } else {
      const differenceDetails = changedCountRows
        .map((row) => {
          const ing = ingredients.find((i) => i.id === row.ingredientId);
          return `  - ${ing?.name}: chênh lệch ${formatStockDelta(row.differenceQuantity)} ${ing?.unit}`;
        })
        .slice(0, 5)
        .join('\n');

      const differenceSummaryText =
        changedCountRows.length > 5
          ? `${differenceDetails}\n  ... và ${changedCountRows.length - 5} nguyên liệu khác.`
          : differenceDetails;

      setConfirmDialog({
        isOpen: true,
        title: 'Xác nhận kiểm kê',
        message: `Ghi nhận báo cáo kiểm kê ngày ${countDate}?\n\nDanh sách chênh lệch phát hiện:\n${differenceSummaryText}\n\nTổng chênh lệch là ${formatStockDelta(totalCountDifference)} sản phẩm.`,
        onConfirm: doSubmit,
      });
    }
  };

  const handleTemplateDownload = async (mode) => {
    try {
      const templateMode =
        mode === STOCK_MODES.IMPORT ? STOCK_TEMPLATE_MODES.IMPORT : STOCK_TEMPLATE_MODES.DAILY_COUNT;
      await downloadStockTemplate({ mode: templateMode, ingredients });
      setToastType('success');
      setToastMsg('Tải file mẫu Excel thành công. Hãy mở file chỉnh sửa và nạp lại.');
    } catch (err) {
      setSubmitError(err.message || 'Không tạo được file mẫu tải về.');
    }
  };

  const handleTemplateUpload = async (mode, file) => {
    if (!file) {
      return;
    }

    setSubmitError('');
    setIsImportingFile(true);

    try {
      const templateMode =
        mode === STOCK_MODES.IMPORT ? STOCK_TEMPLATE_MODES.IMPORT : STOCK_TEMPLATE_MODES.DAILY_COUNT;

      const parsedItems = await parseStockTemplateFile(file, templateMode);

      if (mode === STOCK_MODES.IMPORT) {
        const nextImportRows = { ...importRows };
        const nextImportErrors = { ...importErrors };

        parsedItems.forEach((item) => {
          if (nextImportRows[item.ingredientId]) {
            nextImportRows[item.ingredientId] = {
              quantity: String(item.quantity ?? ''),
              note: item.note ?? '',
            };
            nextImportErrors[item.ingredientId] = '';
          }
        });

        setImportRows(nextImportRows);
        setImportErrors(nextImportErrors);
        setToastType('success');
        setToastMsg(`Đã điền ${parsedItems.length} dòng số liệu nhập hàng từ Excel.`);
      } else {
        const nextCountRows = { ...countRows };
        const nextCountErrors = { ...countErrors };

        parsedItems.forEach((item) => {
          if (nextCountRows[item.ingredientId]) {
            nextCountRows[item.ingredientId] = {
              actualStock: String(item.actualStock ?? ''),
              note: item.note ?? '',
            };
            nextCountErrors[item.ingredientId] = '';
          }
        });

        setCountRows(nextCountRows);
        setCountErrors(nextCountErrors);
        setToastType('success');
        setToastMsg(`Đã điền ${parsedItems.length} dòng số liệu kiểm kê thực tế từ Excel.`);
      }
    } catch (err) {
      setSubmitError(`Lỗi đọc file: ${err.message || 'Vui lòng kiểm tra lại cấu trúc file nạp.'}`);
    } finally {
      setIsImportingFile(false);
    }
  };

  // ------------------ TAB 2: SMART FORECAST (DỰ BÁO TỒN KHO) ------------------
  const [forecasts, setForecasts] = useState([]);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState('');
  const [forecastSearch, setForecastSearch] = useState('');

  const fetchForecast = async () => {
    try {
      setIsForecastLoading(true);
      setForecastError('');
      const response = await stockApi.getForecast();
      setForecasts(response.data || []);
    } catch (err) {
      setForecastError(err.message || 'Không thể tải báo cáo dự báo tồn kho.');
    } finally {
      setIsForecastLoading(false);
    }
  };

  const filteredForecasts = forecasts.filter((f) =>
    f.name.toLowerCase().includes(forecastSearch.toLowerCase())
  );

  const criticalItems = forecasts.filter(
    (f) => f.days_remaining !== null && f.days_remaining <= 5
  );
  const reorderList = forecasts.filter((f) => f.suggested_reorder > 0);

  const handleCopyReorders = () => {
    if (reorderList.length === 0) return;
    const text = reorderList
      .map((item) => `- ${item.name}: đề xuất nhập ${item.suggested_reorder} ${item.unit}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setToastType('success');
    setToastMsg('Đã sao chép danh sách đề xuất nhập hàng vào clipboard!');
  };

  const forecastHeaders = [
    {
      key: 'name',
      label: 'Nguyên liệu',
      render: (row) => <strong style={{ color: 'var(--color-primary)' }}>{row.name}</strong>,
    },
    {
      key: 'current_stock',
      label: 'Tồn kho hiện tại',
      render: (row) => (
        <span style={{ fontWeight: '600' }}>
          {row.current_stock} {row.unit}
        </span>
      ),
    },
    {
      key: 'low_stock_threshold',
      label: 'Ngưỡng định mức',
      render: (row) => (
        <span style={{ color: 'var(--color-secondary)' }}>
          {row.low_stock_threshold} {row.unit}
        </span>
      ),
    },
    {
      key: 'average_daily_usage',
      label: 'Tiêu thụ/ngày (30 ngày)',
      render: (row) => (
        <span style={{ fontWeight: '500' }}>
          {row.average_daily_usage} {row.unit}
        </span>
      ),
    },
    {
      key: 'days_remaining',
      label: 'Thời gian còn lại',
      render: (row) => {
        if (row.days_remaining === null) {
          return <StatusBadge status="ACTIVE" customLabel="Chưa có dữ liệu" />;
        }
        if (row.days_remaining <= 3) {
          return <StatusBadge status="ERROR" customLabel={`~${row.days_remaining} ngày (Nguy cấp)`} />;
        }
        if (row.days_remaining <= 5) {
          return <StatusBadge status="WARNING" customLabel={`~${row.days_remaining} ngày (Cảnh báo)`} />;
        }
        return <StatusBadge status="SUCCESS" customLabel={`~${row.days_remaining} ngày (An toàn)`} />;
      },
    },
    {
      key: 'suggested_reorder',
      label: 'Đề xuất nhập thêm',
      style: { textAlign: 'right' },
      render: (row) =>
        row.suggested_reorder > 0 ? (
          <span
            style={{
              color: 'var(--color-error)',
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertTriangle size={14} />
            +{row.suggested_reorder} {row.unit}
          </span>
        ) : (
          <span style={{ color: 'var(--color-status-success-text)', fontWeight: '600' }}>Đủ dùng</span>
        ),
    },
    {
      key: 'actions',
      label: 'Nhập nhanh',
      style: { width: '120px', textAlign: 'right', whiteSpace: 'nowrap' },
      render: (row) => (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              setQuickImportQty(String(row.suggested_reorder > 0 ? row.suggested_reorder : ''));
              setQuickImportNote('Nhập nhanh từ dự báo tồn kho');
              setQuickImportError('');
              setQuickImportData({
                isOpen: true,
                ingredientId: row.ingredient_id,
                ingredientName: row.name,
                unit: row.unit,
              });
            }}
            title="Nhập kho nhanh"
            style={{ color: row.suggested_reorder > 0 ? 'var(--color-error)' : 'var(--color-secondary)', display: 'flex', padding: 0 }}
          >
            <PackagePlus size={16} />
          </button>
        </div>
      ),
    },
  ];

  // ------------------ TAB 3: TRANSACTIONS (LỊCH SỬ NHẬP XUẤT) ------------------
  const [transactions, setTransactions] = useState([]);
  const [isTxLoading, setIsTxLoading] = useState(true);
  const [txError, setTxError] = useState('');

  const fetchTransactions = async () => {
    try {
      setIsTxLoading(true);
      setTxError('');
      const response = await stockApi.getTransactions();
      setTransactions(response.data.transactions || []);
    } catch (err) {
      setTransactions([]);
      setTxError(err.message || 'Không tải được lịch sử giao dịch kho.');
    } finally {
      setIsTxLoading(false);
    }
  };

  const txHeaders = [
    {
      key: 'ingredientCode',
      label: 'Mã NL',
      style: { width: '120px', whiteSpace: 'nowrap' },
      render: (row) => <CompactCode value={row.ingredientId} prefix="NL" />,
    },
    {
      key: 'ingredientName',
      label: 'Nguyên liệu',
      style: { minWidth: '220px' },
      render: (row) => <strong style={{ color: 'var(--color-primary)' }}>{row.ingredientName}</strong>,
    },
    {
      key: 'context',
      label: 'Nguồn',
      style: { width: '150px', textAlign: 'center', whiteSpace: 'nowrap' },
      render: (row) => {
        const badge = getTransactionBadge(row);
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <StatusBadge status={badge.status} customLabel={badge.label} />
          </div>
        );
      },
    },
    {
      key: 'quantity',
      label: 'Chênh lệch',
      style: { width: '130px', textAlign: 'right', whiteSpace: 'nowrap' },
      render: (row) => {
        const delta = Number(row.quantity || 0);
        return (
          <span
            style={{
              fontWeight: '700',
              color: delta > 0 ? 'var(--color-status-success-text)' : 'var(--color-error)',
            }}
          >
            {formatStockDelta(row.quantity)}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Thời gian',
      style: { width: '180px', whiteSpace: 'nowrap' },
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'note',
      label: 'Ghi chú',
      render: (row) => row.note || '-',
    },
  ];

  // ------------------ MAIN SWITCH LOAD LOGIC ------------------
  useEffect(() => {
    if (workspace?.type === WORKSPACE_TYPES.STORE) {
      if (activeTab === 'forecast' || activeTab === 'transactions') {
        setActiveTab('adjust');
        return;
      }
    }

    /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
    if (activeTab === 'forecast') {
      void fetchForecast();
    } else if (activeTab === 'transactions') {
      void fetchTransactions();
    } else if (activeTab === 'adjust') {
      void loadIngredients();
    } else if (activeTab === 'discard') {
      void loadIngredients();
      void fetchProducts();
    }
    /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  }, [activeTab]);

  return (
    <div className="stitch-container">
      {/* Stitch Header */}
      <section className="stitch-header-row">
        <div>
          <h1 className="stitch-title">Quản lý kho & Dự báo</h1>
          <p className="stitch-description">
            Theo dõi tồn kho thực tế, thống kê biến động và tự động đề xuất số lượng nhập theo chu kỳ tiêu thụ.
          </p>
        </div>
        <div className="stitch-header-actions">
          {activeTab === 'adjust' ? (
            <button
              className="stitch-icon-btn"
              onClick={loadIngredients}
              disabled={isLoading}
              title="Làm mới danh sách"
              type="button"
            >
              <RefreshCw size={15} />
            </button>
          ) : activeTab === 'forecast' ? (
            <button
              className="stitch-icon-btn"
              onClick={fetchForecast}
              disabled={isForecastLoading}
              title="Tải lại dự báo"
              type="button"
            >
              <RotateCcw size={15} />
            </button>
          ) : activeTab === 'transactions' ? (
            <button
              className="stitch-icon-btn"
              onClick={fetchTransactions}
              disabled={isTxLoading}
              title="Tải lại lịch sử"
              type="button"
            >
              <RotateCcw size={15} />
            </button>
          ) : null}
        </div>
      </section>

      {submitError && <Alert type="error" message={submitError} onClose={() => setSubmitError('')} />}
      {forecastError && <Alert type="error" message={forecastError} onClose={() => setForecastError('')} />}
      {txError && <Alert type="error" message={txError} onClose={() => setTxError('')} />}

      {/* Stitch Modern Underline Tab Navigation */}
      <section className="stitch-tabs-nav">
        <button
          type="button"
          onClick={() => setActiveTab('adjust')}
          className={`stitch-tab-item ${activeTab === 'adjust' ? 'active' : ''}`}
        >
          <PackageOpen size={16} />
          <span>Nhập kho & kiểm kê</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('forecast')}
          className={`stitch-tab-item ${activeTab === 'forecast' ? 'active' : ''}`}
        >
          <TrendingUp size={16} />
          <span>Dự báo & Đề xuất nhập</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`stitch-tab-item ${activeTab === 'transactions' ? 'active' : ''}`}
        >
          <History size={16} />
          <span>Lịch sử nhập xuất</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('discard')}
          className={`stitch-tab-item ${activeTab === 'discard' ? 'active' : ''}`}
        >
          <Trash size={16} />
          <span>Hủy hàng & Thất thoát</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('produce')}
          className={`stitch-tab-item ${activeTab === 'produce' ? 'active' : ''}`}
        >
          <Factory size={16} />
          <span>Sản xuất nội bộ</span>
        </button>
      </section>

      {/* Hidden file inputs for Excel template upload */}
      <input
        type="file"
        ref={importFileInputRef}
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleTemplateUpload(STOCK_MODES.IMPORT, file);
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={countFileInputRef}
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleTemplateUpload(STOCK_MODES.DAILY_COUNT, file);
          e.target.value = '';
        }}
      />

      {/* ------------------ TAB 1: STOCK ADJUST (KIỂM KÊ & ĐIỀU CHỈNH) ------------------ */}
      {activeTab === 'adjust' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card: Batch Operations & Note Section */}
          <section className="stitch-card">
            <div className="stitch-card-header">
              <div className="stitch-card-title-group">
                <div className="stitch-dot" />
                <h2 className="stitch-card-title">
                  {activeMode === STOCK_MODES.IMPORT
                    ? 'Thông tin phiếu nhập kho hiện hành'
                    : 'Thông tin phiếu kiểm kê tồn thực tế'}
                </h2>
              </div>
              <div className="stitch-header-toolbar">
                {/* Segmented Pill Switch */}
                <div className="stitch-segmented-pill">
                  <button
                    type="button"
                    className={`stitch-pill-btn ${activeMode === STOCK_MODES.IMPORT ? 'active' : ''}`}
                    onClick={() => setActiveMode(STOCK_MODES.IMPORT)}
                  >
                    Nhập kho hàng loạt
                  </button>
                  <button
                    type="button"
                    className={`stitch-pill-btn ${activeMode === STOCK_MODES.DAILY_COUNT ? 'active' : ''}`}
                    onClick={() => setActiveMode(STOCK_MODES.DAILY_COUNT)}
                  >
                    Kiểm kê tồn thực tế
                  </button>
                </div>

                <div className="stitch-divider-vertical" />

                <button
                  type="button"
                  className="stitch-tool-btn"
                  onClick={() => handleTemplateDownload(activeMode)}
                  disabled={isLoading}
                  title="Tải file mẫu Excel"
                >
                  <Download size={13} style={{ color: 'var(--palette-olive-500, #597d62)' }} />
                  <span>Tải file mẫu Excel</span>
                </button>

                <button
                  type="button"
                  className="stitch-tool-btn"
                  onClick={() =>
                    activeMode === STOCK_MODES.IMPORT
                      ? importFileInputRef.current?.click()
                      : countFileInputRef.current?.click()
                  }
                  disabled={isLoading || isImportingFile}
                  title="Nạp file Excel"
                >
                  <Upload size={13} style={{ color: 'var(--palette-olive-500, #597d62)' }} />
                  <span>Nạp file Excel</span>
                </button>
              </div>
            </div>

            <div className="stitch-form-grid">
              <div>
                <label
                  htmlFor="batch-notes"
                  style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--palette-text-900, #263426)', marginBottom: '6px' }}
                >
                  {activeMode === STOCK_MODES.IMPORT
                    ? 'Ghi chú chung cho đợt nhập'
                    : 'Ghi chú chung cho phiên kiểm kê'}
                </label>
                <textarea
                  id="batch-notes"
                  className="stitch-textarea"
                  rows={2}
                  placeholder={
                    activeMode === STOCK_MODES.IMPORT
                      ? 'Ví dụ: Nhập hàng đầu ngày từ NCC số 25, nguyên liệu pha chế cho cuối tuần...'
                      : 'Ví dụ: Kiểm kê chốt ca tối, đối chiếu tồn kho cuối tuần...'
                  }
                  value={activeMode === STOCK_MODES.IMPORT ? importBatchNote : countBatchNote}
                  onChange={(e) =>
                    activeMode === STOCK_MODES.IMPORT
                      ? setImportBatchNote(e.target.value)
                      : setCountBatchNote(e.target.value)
                  }
                  disabled={isLoading || isSubmitting}
                />
              </div>

              <div className="stitch-helper-box">
                <div className="stitch-helper-header">
                  <PackageOpen size={14} style={{ color: 'var(--palette-olive-500, #597d62)' }} />
                  <span>Hướng dẫn nhập nhanh</span>
                </div>
                <p style={{ margin: 0, lineHeight: 1.45 }}>
                  {activeMode === STOCK_MODES.IMPORT
                    ? 'Bạn có thể chỉnh sửa trực tiếp các ô "Số lượng nhập" ở bảng bên dưới, hoặc nạp file Excel để tự động khớp toàn bộ danh mục nguyên liệu.'
                    : 'Nhập số lượng đếm thực tế vào cột "Tồn thực tế". Hệ thống sẽ tự động đối chiếu với tồn lý thuyết và ghi nhận chênh lệch.'}
                </p>
              </div>
            </div>
          </section>

          {/* Card: Materials Inventory Table */}
          <section className="stitch-table-card">
            {/* Toolbar: Search + Count Date + Clear inputs button */}
            <div className="stitch-table-toolbar">
              <div className="stitch-search-wrap">
                <span className="stitch-search-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '15px', height: '15px' }}>
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="stitch-search-input"
                  placeholder="Tìm kiếm nguyên liệu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {activeMode === STOCK_MODES.DAILY_COUNT && (
                <div style={{ width: '170px' }}>
                  <TextInput
                    type="date"
                    label=""
                    name="countDate"
                    value={countDate}
                    onChange={(e) => setCountDate(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Clear inputs button moved to the right of search bar */}
              {activeMode === STOCK_MODES.IMPORT ? (
                <button
                  type="button"
                  className="stitch-tool-btn-danger"
                  onClick={clearImportInputs}
                  disabled={isLoading || isSubmitting}
                  style={{ whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--palette-error-200, #e7c9c3)', backgroundColor: 'var(--palette-error-100, #f8ece9)' }}
                  title="Xóa toàn bộ số lượng nhập đang soạn thảo"
                >
                  <Eraser size={14} />
                  <span>Xóa các ô đã nhập</span>
                </button>
              ) : (
                workspace?.type !== WORKSPACE_TYPES.STORE && (
                  <button
                    type="button"
                    className="stitch-tool-btn-danger"
                    onClick={resetCountInputs}
                    disabled={isLoading || isSubmitting}
                    style={{ whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--palette-beige-300, #d1c1a9)', backgroundColor: 'var(--palette-cream-200, #ede3d2)', color: 'var(--palette-text-900, #263426)' }}
                    title="Đặt lại toàn bộ số lượng tồn thực tế bằng tồn lý thuyết"
                  >
                    <RotateCcw size={14} />
                    <span>Đặt lại theo tồn lý thuyết</span>
                  </button>
                )
              )}
            </div>


            {/* Table View */}
            {activeMode === STOCK_MODES.IMPORT ? (
              <form onSubmit={handleImportSubmit}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="stitch-table">
                    <thead>
                      <tr>
                        <th style={{ width: '110px' }}>Mã nguyên liệu</th>
                        <th>Tên nguyên liệu</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>ĐVT</th>
                        <th style={{ width: '130px', textAlign: 'right' }}>Tồn hiện tại</th>
                        <th style={{ width: '150px', textAlign: 'center' }}>Số lượng nhập</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '36px' }}>
                            <div className="spinner" style={{ margin: '0 auto 10px' }} />
                            <span style={{ color: 'var(--palette-text-600, #6f786b)', fontSize: '13px' }}>
                              Đang tải danh sách nguyên liệu...
                            </span>
                          </td>
                        </tr>
                      ) : visibleIngredients.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--palette-text-600, #6f786b)' }}>
                            Không tìm thấy nguyên liệu nào phù hợp.
                          </td>
                        </tr>
                      ) : (
                        visibleIngredients.map((ingredient) => {
                          const row = importRows[ingredient.id] || { quantity: '', note: '' };
                          const rowError = importErrors[ingredient.id];
                          const currentStockNum = Number(ingredient.currentStock || 0);
                          const minThreshold = Number(ingredient.minQuantity || 0);
                          const isLowStock = minThreshold > 0 && currentStockNum < minThreshold;

                          return (
                            <tr key={ingredient.id}>
                              <td className="stitch-cell-code">
                                <CompactCode value={ingredient.id} prefix="NL" />
                              </td>
                              <td>
                                <div className="stitch-cell-title">{ingredient.name}</div>
                              </td>
                              <td style={{ textAlign: 'center', color: 'var(--palette-text-600, #6f786b)', fontWeight: 500 }}>
                                {ingredient.unit}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: isLowStock ? 'var(--palette-error-800, #8b5250)' : 'var(--palette-text-900, #263426)' }}>
                                {formatDisplayNumber(ingredient.currentStock)}
                                {minThreshold > 0 && (
                                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--palette-text-600, #6f786b)', fontWeight: 400 }}>
                                    Min: {minThreshold}
                                  </span>
                                )}
                              </td>
                              <td>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="stitch-input-qty"
                                  value={row.quantity}
                                  onChange={(e) => handleImportRowChange(ingredient.id, 'quantity', e.target.value)}
                                  onKeyDown={handleNumberKeyDownBlock}
                                  placeholder="0"
                                  disabled={isSubmitting}
                                  style={buildInputStyle(Boolean(rowError))}
                                />
                                {rowError && (
                                  <div style={{ color: 'var(--palette-error-700, #9a5d5a)', fontSize: '11px', marginTop: '4px' }}>
                                    {rowError}
                                  </div>
                                )}
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="stitch-input-note"
                                  value={row.note}
                                  onChange={(e) => handleImportRowChange(ingredient.id, 'note', e.target.value)}
                                  placeholder="Ghi chú theo dòng..."
                                  disabled={isSubmitting}
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                <div className="stitch-table-footer">
                  <div>
                    <span>
                      Đã chọn nhập: <strong>{readyImportRows.length}</strong> nguyên liệu (Tổng: {formatDisplayNumber(totalImportQuantity)})
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="stitch-btn-secondary"
                      onClick={clearImportInputs}
                      disabled={isLoading || isSubmitting}
                    >
                      Xóa nháp
                    </button>
                    <button
                      type="submit"
                      className="stitch-btn-primary"
                      disabled={isLoading || isImportingFile || isSubmitting}
                    >
                      <PackagePlus size={14} />
                      <span>Xác nhận nhập kho</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleDailyCountSubmit}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="stitch-table">
                    <thead>
                      <tr>
                        <th style={{ width: '110px' }}>Mã nguyên liệu</th>
                        <th>Tên nguyên liệu</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>ĐVT</th>
                        <th style={{ width: '130px', textAlign: 'right' }}>Tồn lý thuyết</th>
                        <th style={{ width: '150px', textAlign: 'center' }}>Tồn thực tế</th>
                        <th style={{ width: '130px', textAlign: 'right' }}>Chênh lệch</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '36px' }}>
                            <div className="spinner" style={{ margin: '0 auto 10px' }} />
                            <span style={{ color: 'var(--palette-text-600, #6f786b)', fontSize: '13px' }}>
                              Đang tải danh sách nguyên liệu...
                            </span>
                          </td>
                        </tr>
                      ) : visibleIngredients.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--palette-text-600, #6f786b)' }}>
                            Không tìm thấy nguyên liệu nào phù hợp.
                          </td>
                        </tr>
                      ) : (
                        visibleIngredients.map((ingredient) => {
                          const row = countRows[ingredient.id] || { actualStock: '', note: '' };
                          const rowError = countErrors[ingredient.id];
                          const actualStock = row.actualStock !== '' ? Number(row.actualStock) : Number(ingredient.currentStock || 0);
                          const differenceQuantity = actualStock - Number(ingredient.currentStock || 0);

                          return (
                            <tr key={ingredient.id}>
                              <td className="stitch-cell-code">
                                <CompactCode value={ingredient.id} prefix="NL" />
                              </td>
                              <td>
                                <div className="stitch-cell-title">{ingredient.name}</div>
                              </td>
                              <td style={{ textAlign: 'center', color: 'var(--palette-text-600, #6f786b)', fontWeight: 500 }}>
                                {ingredient.unit}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--palette-text-900, #263426)' }}>
                                {formatDisplayNumber(ingredient.currentStock)}
                              </td>
                              <td>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="stitch-input-qty"
                                  value={row.actualStock}
                                  onChange={(e) => handleCountRowChange(ingredient.id, 'actualStock', e.target.value)}
                                  onKeyDown={handleNumberKeyDownBlock}
                                  disabled={isSubmitting}
                                  style={buildInputStyle(Boolean(rowError))}
                                />
                                {rowError && (
                                  <div style={{ color: 'var(--palette-error-700, #9a5d5a)', fontSize: '11px', marginTop: '4px' }}>
                                    {rowError}
                                  </div>
                                )}
                              </td>
                              <td
                                style={{
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color:
                                    differenceQuantity > 0
                                      ? 'var(--palette-success-700, #587055)'
                                      : differenceQuantity < 0
                                      ? 'var(--palette-error-800, #8b5250)'
                                      : 'var(--palette-text-600, #6f786b)',
                                }}
                              >
                                {differenceQuantity > 0 ? '+' : ''}
                                {formatDisplayNumber(differenceQuantity)} {ingredient.unit}
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="stitch-input-note"
                                  value={row.note}
                                  onChange={(e) => handleCountRowChange(ingredient.id, 'note', e.target.value)}
                                  placeholder="Ghi chú theo dòng..."
                                  disabled={isSubmitting}
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                <div className="stitch-table-footer">
                  <div>
                    <span>
                      Chênh lệch: <strong>{changedCountRows.length}</strong> nguyên liệu (Tổng: {formatStockDelta(totalCountDifference)})
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {workspace?.type !== WORKSPACE_TYPES.STORE && (
                      <button
                        type="button"
                        className="stitch-btn-secondary"
                        onClick={resetCountInputs}
                        disabled={isLoading || isSubmitting}
                      >
                        Đặt lại lý thuyết
                      </button>
                    )}
                    <button
                      type="submit"
                      className="stitch-btn-primary"
                      disabled={isLoading || isImportingFile || isSubmitting}
                    >
                      <ClipboardCheck size={14} />
                      <span>Ghi nhận kiểm kê ngày</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {/* ------------------ TAB 2: SMART FORECAST (DỰ BÁO TỒN KHO) ------------------ */}
      {activeTab === 'forecast' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
          {/* Main Forecast table (left) */}
          <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="stitch-card" style={{ padding: '12px 16px' }}>
              <div className="stitch-search-wrap">
                <span className="stitch-search-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '15px', height: '15px' }}>
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="stitch-search-input"
                  placeholder="Tìm kiếm nguyên liệu dự báo..."
                  value={forecastSearch}
                  onChange={(e) => setForecastSearch(e.target.value)}
                />
              </div>
            </div>

            <DataTable
              headers={forecastHeaders}
              data={filteredForecasts}
              loading={isForecastLoading}
              emptyMessage="Không tìm thấy nguyên liệu nào trong báo cáo dự báo."
            />
          </div>

          {/* Warnings & Suggestions panel (right) */}
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Safety Level Card */}
            <div
              className="stitch-card"
              style={{
                borderLeft: criticalItems.length > 0
                  ? '4px solid var(--palette-error-700, #9a5d5a)'
                  : '4px solid var(--palette-success-700, #587055)',
              }}
            >
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--palette-text-900, #263426)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {criticalItems.length > 0 ? (
                  <AlertTriangle size={17} style={{ color: 'var(--palette-error-700, #9a5d5a)' }} />
                ) : (
                  <CheckCircle2 size={17} style={{ color: 'var(--palette-success-700, #587055)' }} />
                )}
                Mức độ an toàn tồn kho
              </h3>
              {criticalItems.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--palette-text-900, #263426)' }}>
                    Phát hiện <strong>{criticalItems.length} nguyên liệu</strong> sắp hết hàng trong vòng 5 ngày tới:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {criticalItems.map((item) => (
                      <button
                        key={item.ingredient_id}
                        type="button"
                        onClick={() => {
                          setQuickImportQty(String(item.suggested_reorder > 0 ? item.suggested_reorder : ''));
                          setQuickImportNote('Nhập nhanh từ cảnh báo nguy cấp');
                          setQuickImportError('');
                          setQuickImportData({
                            isOpen: true,
                            ingredientId: item.ingredient_id,
                            ingredientName: item.name,
                            unit: item.unit,
                          });
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--palette-error-100, #f8ece9)',
                          color: 'var(--palette-error-700, #9a5d5a)',
                          border: '1px solid var(--palette-error-200, #e7c9c3)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <PackagePlus size={12} />
                        {item.name}: còn ~{item.days_remaining} ngày (Nhập nhanh)
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--palette-text-600, #6f786b)' }}>
                  Tất cả nguyên liệu hiện đang ở mức an toàn ổn định trên 5 ngày sử dụng.
                </p>
              )}
            </div>

            {/* Reorder Recommendation sheet */}
            <div className="stitch-card">
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--palette-text-900, #263426)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={17} style={{ color: 'var(--palette-olive-700, #3c5642)' }} />
                Phiếu đề xuất mua hàng
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--palette-text-600, #6f786b)', margin: '0' }}>
                Danh sách đề xuất số lượng nhập thêm nhằm đảm bảo hoạt động pha chế ổn định trong 14 ngày tới.
              </p>

              {reorderList.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      border: '1px dashed var(--palette-beige-300, #d1c1a9)',
                      borderRadius: '8px',
                      padding: '10px',
                      backgroundColor: 'var(--palette-cream-200, #ede3d2)',
                    }}
                  >
                    {reorderList.map((item) => (
                      <div key={item.ingredient_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <span style={{ color: 'var(--palette-text-900, #263426)' }}>{item.name}</span>
                        <strong style={{ color: 'var(--palette-error-700, #9a5d5a)' }}>
                          +{item.suggested_reorder} {item.unit}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="stitch-btn-primary" onClick={handleCopyReorders}>
                    <Download size={13} />
                    <span>Sao chép đề xuất</span>
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--palette-text-600, #6f786b)' }}>
                  <CheckCircle2 size={28} style={{ color: 'var(--palette-success-700, #587055)', margin: '0 auto 6px', display: 'block' }} />
                  <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Tồn kho đã được đảm bảo đầy đủ!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------ TAB 3: TRANSACTIONS (LỊCH SỬ NHẬP XUẤT) ------------------ */}
      {activeTab === 'transactions' && (
        <DataTable
          headers={txHeaders}
          data={transactions}
          loading={isTxLoading}
          emptyMessage="Không tìm thấy lịch sử giao dịch kho nào."
        />
      )}

      {/* ------------------ TAB 4: DISCARD (HỦY HÀNG & THẤT THOÁT) ------------------ */}
      {activeTab === 'discard' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
          <div className="stitch-card" style={{ flex: '1 1 450px' }}>
            <h3 style={{ margin: 0, color: 'var(--palette-text-900, #263426)', fontSize: '15px', fontWeight: 700 }}>
              Tạo phiếu hủy hàng
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--palette-text-600, #6f786b)' }}>
              Hao hụt nguyên vật liệu/nguyên liệu hết hạn hoặc sản phẩm lỗi/pha nhầm của cửa hàng.
            </p>

            {discardError && <Alert type="error" message={discardError} onClose={() => setDiscardError('')} />}

            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="stitch-segmented-pill">
                <button
                  type="button"
                  className={`stitch-pill-btn ${discardMode === 'INGREDIENT' ? 'active' : ''}`}
                  onClick={() => {
                    setDiscardMode('INGREDIENT');
                    setDiscardError('');
                  }}
                >
                  Hủy nguyên liệu hao hụt
                </button>
                <button
                  type="button"
                  className={`stitch-pill-btn ${discardMode === 'PRODUCT' ? 'active' : ''}`}
                  onClick={() => {
                    setDiscardMode('PRODUCT');
                    setDiscardError('');
                  }}
                >
                  Hủy thành phẩm lỗi
                </button>
              </div>
            </div>

            <form onSubmit={handleDiscardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {discardMode === 'INGREDIENT' ? (
                <SelectInput
                  label="Chọn nguyên liệu"
                  value={discardIngId}
                  onChange={(e) => setDiscardIngId(e.target.value)}
                  options={[
                    { value: '', label: '-- Chọn nguyên liệu --' },
                    ...ingredients.map((ing) => ({
                      value: ing.id,
                      label: `${ing.name} (Tồn hiện tại: ${ing.currentStock} ${ing.unit})`,
                    })),
                  ]}
                  required
                />
              ) : (
                <SelectInput
                  label="Chọn sản phẩm đồ uống"
                  value={discardProductId}
                  onChange={(e) => setDiscardProductId(e.target.value)}
                  options={[
                    { value: '', label: '-- Chọn sản phẩm --' },
                    ...products.map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.hasRecipe ? 'Đã thiết lập công thức' : 'Chưa có công thức'})`,
                    })),
                  ]}
                  required
                />
              )}

              <TextInput
                label={discardMode === 'INGREDIENT' ? 'Số lượng nguyên liệu hủy' : 'Số lượng sản phẩm hủy (ly/cốc)'}
                type="number"
                value={discardQty}
                onChange={(e) => setDiscardQty(e.target.value)}
                placeholder="Ví dụ: 2"
                required
              />

              <TextInput
                label="Lý do hủy / Ghi chú"
                value={discardNote}
                onChange={(e) => setDiscardNote(e.target.value)}
                placeholder="Ví dụ: Nguyên liệu mốc, pha nhầm đường..."
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="submit"
                  className="stitch-btn-primary"
                  disabled={isSubmitting || isProductsLoading}
                >
                  <Trash size={14} />
                  <span>Xác nhận hủy hàng</span>
                </button>
              </div>
            </form>
          </div>

          <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              className="stitch-card"
              style={{
                borderLeft: '4px solid var(--palette-warning-700, #8a6a3e)',
                backgroundColor: 'var(--palette-warning-100, #f7eedf)',
              }}
            >
              <h4 style={{ margin: 0, color: 'var(--palette-warning-700, #8a6a3e)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}>
                <AlertTriangle size={17} />
                Lưu ý quan trọng
              </h4>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '12.5px', color: 'var(--palette-text-900, #263426)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>
                  <strong>Hủy nguyên liệu:</strong> Khấu trừ trực tiếp số lượng nguyên liệu lẻ theo đơn vị tính tương ứng.
                </li>
                <li>
                  <strong>Hủy thành phẩm:</strong> Hệ thống bắt buộc sản phẩm đã được cấu hình <strong>Định lượng công thức</strong>. Khi thực hiện, toàn bộ nguyên liệu tương ứng sẽ tự động bị trừ khỏi kho.
                </li>
                <li>
                  Nếu kho hiện tại của một hoặc nhiều nguyên liệu không đủ để phục vụ số lượng sản phẩm hủy, hệ thống sẽ từ chối thao tác và hiển thị lỗi cảnh báo.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ------------------ TAB 5: PRODUCE (SẢN XUẤT NỘI BỘ) ------------------ */}
      {activeTab === 'produce' && <ProducePreparationTab />}

      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {quickImportData.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="stitch-card" style={{ width: '420px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
            <h3 style={{ margin: 0, color: 'var(--palette-olive-700, #3c5642)', fontSize: '16px', fontWeight: 700 }}>
              Nhập kho nhanh
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--palette-text-600, #6f786b)' }}>
              Nguyên liệu: <strong>{quickImportData.ingredientName}</strong>
            </p>
            {quickImportError && <Alert type="error" message={quickImportError} onClose={() => setQuickImportError('')} />}
            <form onSubmit={handleQuickImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <TextInput
                label={`Số lượng nhập (${quickImportData.unit})`}
                type="number"
                value={quickImportQty}
                onChange={(e) => setQuickImportQty(e.target.value)}
                placeholder="Ví dụ: 100"
                required
                disabled={isSubmittingImport}
              />
              <TextInput
                label="Ghi chú"
                value={quickImportNote}
                onChange={(e) => setQuickImportNote(e.target.value)}
                placeholder="Ví dụ: Nhập gấp phục vụ ca chiều..."
                disabled={isSubmittingImport}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="stitch-btn-secondary"
                  onClick={() => setQuickImportData({ isOpen: false, ingredientId: '', ingredientName: '', unit: '' })}
                  disabled={isSubmittingImport}
                >
                  Hủy
                </button>
                <button type="submit" className="stitch-btn-primary" disabled={isSubmittingImport}>
                  Xác nhận nhập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockPage;

