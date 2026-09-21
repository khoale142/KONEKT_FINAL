import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { ingredientApi } from '../api/ingredientApi.js';
import { categoryApi } from '../../categories/api/categoryApi.js';
import { CategorySelectField } from '../../categories/components/CategorySelectField.jsx';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { NumberInput } from '../../../components/forms/NumberInput.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { validateDisplayName, validateNonNegativeNumber, validatePositiveNumber } from '../../../utils/validators.js';

const DEFAULT_FORM = {
  name: '',
  categoryId: '',
  unit: '',
  yieldAmount: '',
};

const EMPTY_RECIPE_ITEM = { ingredientId: '', quantity: '' };

export function PreparationFormPage({ ingredientId = null, onClose, onSaved }) {
  const navigate = useNavigate();
  const { id: routeIngredientId } = useParams();
  const id = ingredientId || routeIngredientId;
  const isEditMode = Boolean(id);
  const isEmbedded = Boolean(onClose);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [recipeItems, setRecipeItems] = useState([EMPTY_RECIPE_ITEM]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const loadFormData = async () => {
      setIsLoading(true);
      setSubmitError('');

      try {
        const [categoriesResponse, ingredientsResponse, ingredientResponse] = await Promise.all([
          categoryApi.getCategories('PREPARATION'),
          ingredientApi.getIngredients(),
          isEditMode ? ingredientApi.getIngredient(id) : Promise.resolve(null),
        ]);
        
        if (isCancelled) return;

        setCategories(categoriesResponse.data?.categories || []);
        
        const allIngs = ingredientsResponse.data?.ingredients || [];
        setIngredients(allIngs);

        const ingredient = ingredientResponse?.data?.ingredient;
        
        if (isEditMode && ingredient) {
          const recipeRes = await ingredientApi.getIngredientRecipe(id);
          const recipe = recipeRes.data?.recipe;

          setForm({
            name: ingredient.name || '',
            categoryId: ingredient.categoryId || '',
            unit: ingredient.unit || '',
            yieldAmount: recipe?.yieldAmount ? String(recipe.yieldAmount) : '',
          });
          
          if (recipe?.items && recipe.items.length > 0) {
            setRecipeItems(recipe.items.map(item => ({
              ingredientId: String(item.ingredientId),
              quantity: String(item.quantity)
            })));
          }
        }
      } catch (loadError) {
        if (!isCancelled) setSubmitError(loadError.message || 'Không tải được thông tin bán thành phẩm.');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    void loadFormData();
    return () => { isCancelled = true; };
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    setSubmitError('');
  };

  const handleRecipeRowChange = (index, field, value) => {
    setRecipeItems((current) => current.map((item, rowIndex) => (
      rowIndex === index ? { ...item, [field]: value } : item
    )));
    setSubmitError('');
  };

  const validateRecipeItems = () => {
    if (recipeItems.length === 0) {
      setSubmitError('Bán thành phẩm phải có ít nhất một nguyên liệu cấu thành.');
      return null;
    }

    const usedIngredientIds = new Set();
    const normalizedItems = [];
    
    for (let index = 0; index < recipeItems.length; index += 1) {
      const item = recipeItems[index];
      const ingId = String(item.ingredientId || '').trim();
      const quantity = Number(item.quantity);

      if (!ingId) {
        setSubmitError(`Dòng định lượng ${index + 1}: hãy chọn nguyên liệu.`);
        return null;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setSubmitError(`Dòng định lượng ${index + 1}: số lượng phải lớn hơn 0.`);
        return null;
      }
      if (usedIngredientIds.has(ingId)) {
        setSubmitError('Một nguyên liệu chỉ được xuất hiện một lần trong định lượng.');
        return null;
      }
      
      // Check circular dependency if editing
      if (isEditMode && ingId === String(id)) {
        setSubmitError('Bán thành phẩm không thể dùng chính nó làm nguyên liệu.');
        return null;
      }

      usedIngredientIds.add(ingId);
      normalizedItems.push({ ingredientId: ingId, quantity });
    }

    return normalizedItems;
  };

  const validateForm = () => {
    const nextErrors = {
      name: validateDisplayName(form.name, 'Tên bán thành phẩm', 120),
      yieldAmount: validatePositiveNumber(form.yieldAmount, 'Số lượng tạo ra (Yield)'),
    };

    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;
    const normalizedRecipeItems = validateRecipeItems();
    if (!normalizedRecipeItems) return;

    setIsSubmitting(true);
    setSubmitError('');

    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId || null,
      unit: form.unit,
      recipeItems: normalizedRecipeItems,
      yieldAmount: Number(form.yieldAmount),
    };

    try {
      if (isEditMode) {
        await ingredientApi.updatePreparation(id, payload);
      } else {
        await ingredientApi.createPreparation(payload);
      }

      if (isEmbedded) {
        onSaved?.();
        onClose();
      } else {
        setToastMsg(isEditMode ? 'Cập nhật bán thành phẩm thành công.' : 'Tạo bán thành phẩm thành công.');
        setTimeout(() => navigate(ROUTES.STORE_CATALOG), 700);
      }
    } catch (saveError) {
      setSubmitError(saveError.message || 'Lưu thông tin thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ingredientOptions = useMemo(() => [
    { value: '', label: '-- Chọn nguyên liệu --' },
    ...ingredients
      .filter((i) => !isEditMode || String(i.id) !== String(id)) // Prevent circular
      .map((i) => ({ value: String(i.id), label: `${i.name} (Tồn: ${i.currentStock} ${i.unit})` })),
  ], [ingredients, isEditMode, id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {!isEmbedded && <PageHeader
        title={isEditMode ? 'Chỉnh sửa bán thành phẩm' : 'Tạo bán thành phẩm mới'}
        description="Thông tin chung và công thức định lượng được lưu cùng lúc."
        actions={<Button variant="secondary" onClick={() => navigate(ROUTES.STORE_CATALOG)} icon={<ArrowLeft size={16} />}>Quay lại</Button>}
      />}

      {submitError && <Alert type="error" message={submitError} onClose={() => setSubmitError('')} />}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
          <p style={{ color: 'var(--color-secondary)' }}>Đang tải...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div className="responsive-split-layout">
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>1. Thông tin bán thành phẩm</h3>
              
              <TextInput
                label="Tên bán thành phẩm"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={errors.name}
                placeholder="Ví dụ: Cốt trà đen, Trân châu đen luộc..."
                maxLength={120}
                required
                disabled={isSubmitting}
              />

              <CategorySelectField 
                value={form.categoryId} 
                onChange={handleChange} 
                categories={categories} 
                onCategoryCreated={(category) => setCategories((current) => [...current, category].sort((left, right) => left.name.localeCompare(right.name, 'vi')))} 
                scope="PREPARATION" 
                disabled={isSubmitting} 
              />

              <TextInput label="Đơn vị tính" name="unit" value={form.unit} onChange={handleChange} placeholder="Ví dụ: g, ml, mẻ" required disabled={isSubmitting} />
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>2. Công thức (Recipe)</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-secondary)' }}>
                    Định mức nguyên liệu thô để sản xuất ra mẻ bán thành phẩm này.
                  </p>
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--color-surface-container-low)', borderRadius: 'var(--radius-default)', border: '1px solid var(--color-outline-variant)' }}>
                <NumberInput
                  label={`Số lượng BTP sinh ra sau mỗi mẻ (${form.unit})`}
                  name="yieldAmount"
                  value={form.yieldAmount}
                  onChange={handleChange}
                  error={errors.yieldAmount}
                  placeholder="Ví dụ: 1000"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                {recipeItems.map((item, index) => {
                  const selectedIng = ingredients.find((i) => String(i.id) === item.ingredientId);
                  const selectedUnit = selectedIng?.unit || '';

                  return (
                    <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', background: 'var(--color-surface-container-lowest)', padding: '12px', borderRadius: 'var(--radius-default)', border: '1px solid var(--color-outline-variant)' }}>
                      <div style={{ flex: 2 }}>
                        <SelectInput
                          label="Nguyên liệu cấu thành"
                          value={item.ingredientId}
                          onChange={(e) => handleRecipeRowChange(index, 'ingredientId', e.target.value)}
                          options={ingredientOptions}
                          disabled={isSubmitting}
                          required
                        />
                      </div>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <NumberInput
                          label="Số lượng dùng"
                          value={item.quantity}
                          onChange={(e) => handleRecipeRowChange(index, 'quantity', e.target.value)}
                          placeholder="SL"
                          disabled={isSubmitting}
                          required
                        />
                        {selectedUnit && (
                          <div style={{ position: 'absolute', right: '12px', top: '36px', color: 'var(--color-secondary)', fontSize: '13px', pointerEvents: 'none' }}>
                            {selectedUnit}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setRecipeItems((current) => current.filter((_, i) => i !== index))}
                        disabled={recipeItems.length <= 1 || isSubmitting}
                        style={{ color: recipeItems.length <= 1 ? 'var(--color-secondary)' : 'var(--color-error)', padding: '0 10px', height: '42px', marginBottom: '2px' }}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <Button type="button" variant="secondary" onClick={() => setRecipeItems((current) => [...current, EMPTY_RECIPE_ITEM])} icon={<Plus size={16} />} disabled={isSubmitting} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                Thêm nguyên liệu
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--color-outline-variant)', paddingTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => isEmbedded ? onClose() : navigate(ROUTES.STORE_CATALOG)} disabled={isSubmitting}>
              Hủy bỏ
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting} icon={<Save size={16} />}>
              {isEditMode ? 'Lưu thay đổi' : 'Hoàn tất & Tạo'}
            </Button>
          </div>
        </form>
      )}

      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />
    </div>
  );
}

export default PreparationFormPage;
