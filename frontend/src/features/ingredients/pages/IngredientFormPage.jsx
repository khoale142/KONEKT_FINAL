import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Boxes, Save } from 'lucide-react';
import { ingredientApi } from '../api/ingredientApi.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { NumberInput } from '../../../components/forms/NumberInput.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { DEFAULT_INGREDIENT_TAG, INGREDIENT_TAG_SUGGESTIONS } from '../../../constants/ingredientTags.js';
import { UNITS } from '../../../constants/units.js';
import { validateDisplayName, validateNonNegativeNumber } from '../../../utils/validators.js';

const DEFAULT_FORM = {
  name: '',
  tag: DEFAULT_INGREDIENT_TAG,
  unit: UNITS.GRAM,
  lowStockThreshold: '',
};

function getTagSuggestions(currentTag) {
  return Array.from(new Set([...(INGREDIENT_TAG_SUGGESTIONS || []), currentTag || DEFAULT_INGREDIENT_TAG]));
}

export function IngredientFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [currentStock, setCurrentStock] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tagSuggestions = useMemo(() => getTagSuggestions(form.tag), [form.tag]);

  useEffect(() => {
    if (!isEditMode) {
      return;
    }

    const loadIngredient = async () => {
      setIsLoading(true);
      setSubmitError('');

      try {
        const response = await ingredientApi.getIngredient(id);
        const ingredient = response.data.ingredient;

        setForm({
          name: ingredient.name || '',
          tag: ingredient.tag || DEFAULT_INGREDIENT_TAG,
          unit: ingredient.unit || UNITS.GRAM,
          lowStockThreshold:
            ingredient.lowStockThreshold !== undefined && ingredient.lowStockThreshold !== null
              ? String(ingredient.lowStockThreshold)
              : '',
        });
        setCurrentStock(Number(ingredient.currentStock || 0));
      } catch (loadError) {
        setSubmitError(loadError.message || 'Không tải được thông tin nguyên liệu.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadIngredient();
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
      tag: validateDisplayName(form.tag, 'Tag nguyên liệu', 40),
      lowStockThreshold: validateNonNegativeNumber(form.lowStockThreshold, 'Ngưỡng cảnh báo'),
    };

    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    const payload = {
      name: form.name.trim(),
      tag: form.tag.trim(),
      unit: form.unit,
      lowStockThreshold: Number(form.lowStockThreshold),
    };

    try {
      if (isEditMode) {
        await ingredientApi.updateIngredient(id, payload);
        setToastMsg('Cập nhật nguyên liệu thành công.');
      } else {
        await ingredientApi.createIngredient(payload);
        setToastMsg('Tạo nguyên liệu thành công.');
      }

      setTimeout(() => {
        navigate(ROUTES.STORE_INGREDIENTS);
      }, 900);
    } catch (saveError) {
      setSubmitError(saveError.message || 'Lưu thông tin nguyên liệu thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title={isEditMode ? 'Chỉnh sửa nguyên liệu' : 'Tạo nguyên liệu mới'}
        description={
          isEditMode
            ? 'Cập nhật tên, tag, đơn vị và ngưỡng cảnh báo tồn kho của nguyên liệu.'
            : 'Tạo mới nguyên liệu để chuẩn bị cho công thức, kho và bộ lọc theo tag.'
        }
        actions={
          <Button variant="secondary" onClick={() => navigate(ROUTES.STORE_INGREDIENTS)} icon={<ArrowLeft size={16} />}>
            Quay lại danh sách
          </Button>
        }
      />

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
                label="Tên nguyên liệu"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={errors.name}
                placeholder="Ví dụ: Hạt cà phê Robusta"
                maxLength={120}
                required
                disabled={isSubmitting}
              />

              <TextInput
                label="Tag / nhóm nguyên liệu"
                name="tag"
                value={form.tag}
                onChange={handleChange}
                error={errors.tag}
                placeholder="Ví dụ: Syrup"
                maxLength={40}
                list="ingredient-tag-suggestions"
                required
                disabled={isSubmitting}
              />
              <datalist id="ingredient-tag-suggestions">
                {tagSuggestions.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>

              <SelectInput
                label="Đơn vị tính"
                name="unit"
                value={form.unit}
                onChange={handleChange}
                options={[
                  { value: UNITS.GRAM, label: 'Gram (g)' },
                  { value: UNITS.ML, label: 'Mililit (ml)' },
                  { value: UNITS.PIECE, label: 'Cái / Chai / Hộp' },
                ]}
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
                <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.STORE_INGREDIENTS)} disabled={isSubmitting}>
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
              <strong>Tag:</strong> Dùng để gom nhóm và lọc nhanh theo loại như <code>Bột cà phê</code>, <code>Syrup</code>, <code>Ly / bao bì</code>.
            </div>
            {isEditMode ? (
              <>
                <div>
                  <strong>Tồn kho hiện tại:</strong> {currentStock} {form.unit}
                </div>
                <div>
                  <strong>Lưu ý:</strong> Số lượng tồn kho không chỉnh trực tiếp tại đây.
                </div>
                <div>
                  <strong>Khuyến nghị:</strong> Dùng màn giao dịch kho để nhập thêm hoặc điều chỉnh hao hụt.
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
                  <strong>Tồn kho ban đầu:</strong> Sau khi tạo nguyên liệu, hãy dùng màn giao dịch kho để nhập số lượng thực tế.
                </div>
                <div>
                  <strong>Ngưỡng cảnh báo:</strong> Khi tồn kho nhỏ hơn hoặc bằng ngưỡng này, hệ thống sẽ đánh dấu sắp hết hàng.
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
