import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Boxes, Save } from 'lucide-react';
import { ingredientApi } from '../api/ingredientApi.js';
import { categoryApi } from '../../categories/api/categoryApi.js';
import { CategorySelectField } from '../../categories/components/CategorySelectField.jsx';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { NumberInput } from '../../../components/forms/NumberInput.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { validateDisplayName, validateNonNegativeNumber } from '../../../utils/validators.js';

const DEFAULT_FORM = {
  name: '',
  categoryId: '',
  unit: '',
  lowStockThreshold: '',
};

export function IngredientFormPage({ ingredientId = null, onClose, onSaved }) {
  const navigate = useNavigate();
  const { id: routeIngredientId } = useParams();
  const id = ingredientId || routeIngredientId;
  const isEditMode = Boolean(id);
  const isEmbedded = Boolean(onClose);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [currentStock, setCurrentStock] = useState(0);
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadFormData = async () => {
      setIsLoading(true);
      setSubmitError('');

      try {
        const [categoriesResponse, ingredientResponse] = await Promise.all([
          categoryApi.getCategories('INGREDIENT'),
          isEditMode ? ingredientApi.getIngredient(id) : Promise.resolve(null),
        ]);
        
        if (cancelled) return;
        setCategories(categoriesResponse.data?.categories || []);
        
        const ingredient = ingredientResponse?.data?.ingredient;
        if (!ingredient) return;

        setForm({
          name: ingredient.name || '',
          categoryId: ingredient.categoryId || '',
          unit: ingredient.unit || '',
          lowStockThreshold:
            ingredient.lowStockThreshold !== undefined && ingredient.lowStockThreshold !== null
              ? String(ingredient.lowStockThreshold)
              : '',
        });
        setCurrentStock(Number(ingredient.currentStock || 0));
      } catch (loadError) {
        if (!cancelled) setSubmitError(loadError.message || 'Không tải được thông tin nguyên liệu.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadFormData();
    return () => { cancelled = true; };
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setSubmitError('');
  };

  const validateForm = () => {
    const nextErrors = {
      name: validateDisplayName(form.name, 'Tên nguyên liệu', 120),
      lowStockThreshold: validateNonNegativeNumber(form.lowStockThreshold, 'Ngưỡng cảnh báo'),
    };

    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError('');

    const payload = {
      name: form.name.trim(),
      unit: form.unit,
      lowStockThreshold: Number(form.lowStockThreshold),
      isPreparation: false, // Ensure it's false for raw ingredients
    };

    payload.categoryId = form.categoryId || null;

    try {
      if (isEditMode) {
        await ingredientApi.updateIngredient(id, payload);
      } else {
        await ingredientApi.createIngredient(payload);
      }

      if (isEmbedded) {
        onSaved?.();
        onClose();
      } else {
        setToastMsg(isEditMode ? 'Cập nhật nguyên liệu thành công.' : 'Tạo nguyên liệu thành công.');
        setTimeout(() => navigate(ROUTES.STORE_CATALOG), 700);
      }
    } catch (saveError) {
      setSubmitError(saveError.message || 'Lưu thông tin nguyên liệu thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {!isEmbedded && <PageHeader
        title={isEditMode ? 'Chỉnh sửa nguyên liệu thô' : 'Tạo nguyên liệu thô mới'}
        description="Quản lý thông tin cơ bản và tồn kho của nguyên liệu chưa qua chế biến."
        actions={
          <Button variant="secondary" onClick={() => navigate(ROUTES.STORE_CATALOG)} icon={<ArrowLeft size={16} />}>
            Quay lại
          </Button>
        }
      />}

      {submitError && <Alert type="error" message={submitError} onClose={() => setSubmitError('')} />}

      <div className="responsive-split-layout">
        <div className="card">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
              <p style={{ color: 'var(--color-secondary)', margin: 0 }}>Đang tải thông tin nguyên liệu...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <TextInput
                label="Tên nguyên liệu thô"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={errors.name}
                placeholder="Ví dụ: Hạt cà phê Robusta, Trà đen..."
                maxLength={120}
                required
                disabled={isSubmitting}
              />

              {isEditMode && (
                <CategorySelectField
                  value={form.categoryId}
                  onChange={handleChange}
                  categories={categories}
                  onCategoryCreated={(category) => setCategories((current) => [...current, category].sort((left, right) => left.name.localeCompare(right.name, 'vi')))}
                  scope="INGREDIENT"
                  disabled={isSubmitting}
                />
              )}

              <TextInput
                label="Đơn vị tính (Tồn kho)"
                name="unit"
                value={form.unit}
                onChange={handleChange}
                placeholder="Ví dụ: g, ml, chai"
                required
                disabled={isSubmitting}
              />

              <NumberInput
                label="Ngưỡng cảnh báo tồn kho"
                name="lowStockThreshold"
                value={form.lowStockThreshold}
                onChange={handleChange}
                error={errors.lowStockThreshold}
                placeholder="Ví dụ: 500"
                required
                disabled={isSubmitting}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <Button type="button" variant="secondary" onClick={() => isEmbedded ? onClose() : navigate(ROUTES.STORE_CATALOG)} disabled={isSubmitting}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary" loading={isSubmitting} icon={<Save size={16} />}>
                  {isEditMode ? 'Lưu thay đổi' : 'Tạo nguyên liệu'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Ghi chú</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
            <div>
              <strong>Danh mục:</strong> Dùng để gom nhóm và lọc nhanh. Nguyên liệu thô và Bán thành phẩm sử dụng các danh mục khác nhau.
            </div>
            {isEditMode ? (
              <>
                <div>
                  <strong>Tồn kho hiện tại:</strong> {currentStock} {form.unit}
                </div>
                <div>
                  <strong>Lưu ý:</strong> Số lượng tồn kho không thể điều chỉnh ở đây.
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Button variant="secondary" onClick={() => navigate(ROUTES.STORE_STOCK)} icon={<Boxes size={16} />}>
                    Mở màn giao dịch kho
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <strong>Tồn kho ban đầu:</strong> Sau khi tạo, hãy dùng màn giao dịch kho để nhập số lượng thực tế.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />
    </div>
  );
}

export default IngredientFormPage;
