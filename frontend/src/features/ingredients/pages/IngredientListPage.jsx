import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, Edit, Plus, RotateCcw, Trash2, PackagePlus } from 'lucide-react';
import { ingredientApi } from '../api/ingredientApi.js';
import { stockApi } from '../../stock/api/stockApi.js';
import { validatePositiveNumber } from '../../../utils/validators.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { CompactCode } from '../../../components/common/CompactCode.jsx';
import { DataTable } from '../../../components/common/DataTable.jsx';
import { StatusBadge } from '../../../components/common/StatusBadge.jsx';
import { TagBadge } from '../../../components/common/TagBadge.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { INGREDIENT_TAG_SUGGESTIONS } from '../../../constants/ingredientTags.js';
import { ROUTES } from '../../../constants/routes.js';

const centeredCellContentStyle = {
  display: 'flex',
  justifyContent: 'center',
};

const numericCellContentStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: '6px',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

function mergeTagOptions(tags, selectedTag) {
  const mergedTags = Array.from(
    new Set([
      ...INGREDIENT_TAG_SUGGESTIONS,
      ...(tags || []),
      ...(selectedTag && selectedTag !== 'ALL' ? [selectedTag] : []),
    ]),
  );
  return [
    { value: 'ALL', label: 'Tất cả tag' },
    ...mergedTags.map((tag) => ({ value: tag, label: tag })),
  ];
}

export function IngredientListPage() {
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [deleteId, setDeleteId] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');

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

  const tagOptions = useMemo(() => mergeTagOptions(availableTags, tagFilter), [availableTags, tagFilter]);

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
            note: 'Nhập nhanh từ danh sách nguyên liệu',
          },
        ],
      });
      setToastType('success');
      setToastMsg(`Nhập kho thành công cho nguyên liệu ${quickImportData.ingredientName}.`);
      setQuickImportData({ isOpen: false, ingredientId: '', ingredientName: '', unit: '' });
      setReloadNonce((current) => current + 1);
    } catch (err) {
      setQuickImportError(err.message || 'Lỗi hệ thống khi thực hiện nhập kho nhanh.');
    } finally {
      setIsSubmittingImport(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const timer = setTimeout(() => {
      const loadIngredients = async () => {
        setIsLoading(true);
        setError('');

        try {
          const response = await ingredientApi.getIngredients({
            search: searchQuery.trim(),
            lowStock: filterMode === 'LOW',
            tag: tagFilter,
          });

          if (!isCancelled) {
            setIngredients(response.data.ingredients || []);
            setAvailableTags(response.data.tags || []);
          }
        } catch (loadError) {
          if (!isCancelled) {
            setIngredients([]);
            setAvailableTags([]);
            setError(loadError.message || 'Không tải được danh sách nguyên liệu.');
          }
        } finally {
          if (!isCancelled) {
            setIsLoading(false);
          }
        }
      };

      void loadIngredients();
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [reloadNonce, searchQuery, filterMode, tagFilter]);

  const handleDelete = async () => {
    if (!deleteId) {
      return;
    }

    try {
      await ingredientApi.deleteIngredient(deleteId);
      setToastType('success');
      setToastMsg('Xóa nguyên liệu thành công.');
      setReloadNonce((current) => current + 1);
    } catch (deleteError) {
      setToastType('error');
      setToastMsg(deleteError.message || 'Xóa nguyên liệu thất bại.');
    } finally {
      setDeleteId(null);
    }
  };

  const headers = [
    {
      key: 'id',
      label: 'Mã NL',
      style: { width: '124px', whiteSpace: 'nowrap' },
      render: (row) => <CompactCode value={row.id} prefix="NL" />,
    },
    {
      key: 'name',
      label: 'Tên nguyên liệu',
      style: { minWidth: '220px' },
      render: (row) => (
        <strong style={{ color: 'var(--color-primary)', lineHeight: 1.4 }}>{row.name}</strong>
      ),
    },
    {
      key: 'tag',
      label: 'Tag',
      style: { width: '140px', textAlign: 'center', whiteSpace: 'nowrap' },
      render: (row) => (
        <div style={centeredCellContentStyle}>
          <TagBadge label={row.tag} />
        </div>
      ),
    },
    {
      key: 'unit',
      label: 'Đơn vị',
      style: { width: '96px', textAlign: 'center', whiteSpace: 'nowrap' },
      render: (row) => <span style={{ fontWeight: '600' }}>{row.unit}</span>,
    },
    {
      key: 'currentStock',
      label: 'Tồn hiện tại',
      style: { width: '160px', textAlign: 'right', whiteSpace: 'nowrap' },
      render: (row) => (
        <div
          style={{
            ...numericCellContentStyle,
            color: row.isLowStock ? 'var(--color-error)' : 'var(--color-on-background)',
            fontWeight: row.isLowStock ? '700' : '500',
          }}
        >
          <span>
            {row.currentStock} {row.unit}
          </span>
          {row.isLowStock && <AlertOctagon size={14} title="Dưới ngưỡng tồn tối thiểu" />}
        </div>
      ),
    },
    {
      key: 'lowStockThreshold',
      label: 'Ngưỡng cảnh báo',
      style: { width: '160px', textAlign: 'right', whiteSpace: 'nowrap' },
      render: (row) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {row.lowStockThreshold} {row.unit}
        </span>
      ),
    },
    {
      key: 'isLowStock',
      label: 'Cảnh báo',
      style: { width: '150px', textAlign: 'center', whiteSpace: 'nowrap' },
      render: (row) => (
        <div style={centeredCellContentStyle}>
          <StatusBadge
            status={row.isLowStock ? 'WARNING' : 'SUCCESS'}
            customLabel={row.isLowStock ? 'Sắp hết hàng' : 'An toàn'}
          />
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Hành động',
      style: { width: '130px', textAlign: 'right', whiteSpace: 'nowrap' },
      render: (row) => (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              setQuickImportQty('');
              setQuickImportNote('Nhập nhanh từ danh sách nguyên liệu');
              setQuickImportError('');
              setQuickImportData({
                isOpen: true,
                ingredientId: row.id,
                ingredientName: row.name,
                unit: row.unit,
              });
            }}
            title="Nhập kho nhanh"
            style={{ color: row.isLowStock ? 'var(--color-error)' : 'var(--color-tertiary-container)', display: 'flex', padding: 0 }}
          >
            <PackagePlus size={16} />
          </button>
          <button
            type="button"
            onClick={() => navigate(`/store/ingredients/${row.id}/edit`)}
            title="Chỉnh sửa"
            style={{ color: 'var(--color-primary)', display: 'flex', padding: 0 }}
          >
            <Edit size={16} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteId(row.id)}
            title="Xóa"
            style={{ color: 'var(--color-error)', display: 'flex', padding: 0 }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title="Quản lý nguyên liệu"
        description="Quản lý danh mục nguyên liệu pha chế và lọc nhanh theo tag như Bột cà phê, Syrup, Topping."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setReloadNonce((current) => current + 1)}
              disabled={isLoading}
              icon={<RotateCcw size={16} />}
            >
              Tải lại
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate(ROUTES.STORE_INGREDIENTS_NEW)}
              icon={<Plus size={16} />}
            >
              Thêm nguyên liệu
            </Button>
          </>
        }
      />

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <div className="card" style={{ padding: 'var(--spacing-sm)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <TextInput
              placeholder="Tìm kiếm nguyên liệu theo tên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ width: '220px' }}>
            <SelectInput
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              options={[
                { value: 'ALL', label: 'Tất cả nguyên liệu' },
                { value: 'LOW', label: 'Chỉ nguyên liệu sắp hết' },
              ]}
            />
          </div>

          <div style={{ width: '180px' }}>
            <SelectInput value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} options={tagOptions} />
          </div>
        </div>
      </div>

      <DataTable
        headers={headers}
        data={ingredients}
        loading={isLoading}
        emptyMessage="Không tìm thấy nguyên liệu nào phù hợp."
        style={{ minWidth: '1120px' }}
      />

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Xóa nguyên liệu"
        message="Bạn có chắc chắn muốn xóa nguyên liệu này? Nếu nguyên liệu đã được dùng trong công thức hoặc giao dịch kho, hệ thống sẽ từ chối thao tác."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />

      {quickImportData.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>Nhập kho nhanh</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-secondary)' }}>
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setQuickImportData({ isOpen: false, ingredientId: '', ingredientName: '', unit: '' })}
                  disabled={isSubmittingImport}
                >
                  Hủy
                </Button>
                <Button type="submit" variant="primary" loading={isSubmittingImport}>
                  Xác nhận nhập
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default IngredientListPage;
