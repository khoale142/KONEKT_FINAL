import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { productApi } from '../api/productApi.js';
import { ingredientApi } from '../../ingredients/api/ingredientApi.js';
import { categoryApi } from '../../categories/api/categoryApi.js';
import { CategorySelectField } from '../../categories/components/CategorySelectField.jsx';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { NumberInput } from '../../../components/forms/NumberInput.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { PRODUCT_STATUS } from '../../../constants/productStatus.js';
import { ROUTES } from '../../../constants/routes.js';
import { validateDisplayName, validatePositiveNumber } from '../../../utils/validators.js';

const DEFAULT_FORM = {
  name: '',
  categoryId: '',
  imageUrl: '',
  unit: '',
  price: '',
  status: PRODUCT_STATUS.ACTIVE,
};

const EMPTY_RECIPE_ITEM = { ingredientId: '', quantity: '' };

export function ProductFormPage({ productId = null, onClose, onSaved }) {
  const navigate = useNavigate();
  const { id: routeProductId } = useParams();
  const id = productId || routeProductId;
  const isEditMode = Boolean(id);
  const isEmbedded = Boolean(onClose);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [recipeItems, setRecipeItems] = useState([]);
  const [variants, setVariants] = useState([]);
  const [isGroup, setIsGroup] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizePrice, setNewSizePrice] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
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
        const [ingredientsResponse, categoriesResponse, productResponse] = await Promise.all([
          ingredientApi.getIngredients(),
          categoryApi.getCategories('PRODUCT'),
          isEditMode ? productApi.getProduct(id) : Promise.resolve(null),
        ]);

        if (isCancelled) return;

        setIngredients(ingredientsResponse.data?.ingredients || []);
        setCategories(categoriesResponse.data?.categories || []);
        const product = productResponse?.data?.product;
        if (product) {
          setIsGroup(Boolean(product.isGroup));
          setVariants(Array.isArray(product.variants) ? product.variants : []);
          setForm({
            name: product.name || '',
            categoryId: product.categoryId || '',
            imageUrl: product.imageUrl || '',
            unit: product.unit || '',
            price: product.price === undefined || product.price === null ? '' : String(product.price),
            status: product.status || PRODUCT_STATUS.ACTIVE,
          });
          setNewSizePrice(String(product.price ?? ''));
          setRecipeItems(
            (product.recipe?.items || []).map((item) => ({
              ingredientId: String(item.ingredientId),
              quantity: String(item.quantity),
            })),
          );
        }
      } catch (loadError) {
        if (!isCancelled) {
          setSubmitError(loadError.message || 'Không thể tải dữ liệu sản phẩm.');
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    void loadFormData();
    return () => { isCancelled = true; };
  }, [id, isEditMode]);

  const handleProductChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: '' }));
    setSubmitError('');
  };

  const handleRecipeRowChange = (index, field, value) => {
    setRecipeItems((current) => current.map((item, rowIndex) => (
      rowIndex === index ? { ...item, [field]: value } : item
    )));
    setSubmitError('');
  };

  const validateRecipeItems = () => {
    if (recipeItems.length === 0) return [];

    const usedIngredientIds = new Set();
    const normalizedItems = [];
    for (let index = 0; index < recipeItems.length; index += 1) {
      const item = recipeItems[index];
      const ingredientId = String(item.ingredientId || '').trim();
      const quantity = Number(item.quantity);

      if (!ingredientId) {
        setSubmitError(`Dòng định lượng ${index + 1}: hãy chọn nguyên liệu.`);
        return null;
      }
      if (!Number.isFinite(quantity) || quantity < 0) {
        setSubmitError(`Dòng định lượng ${index + 1}: số lượng không được âm.`);
        return null;
      }
      if (usedIngredientIds.has(ingredientId)) {
        setSubmitError('Một nguyên liệu chỉ được xuất hiện một lần trong định lượng.');
        return null;
      }

      usedIngredientIds.add(ingredientId);
      normalizedItems.push({ ingredientId, quantity });
    }

    return normalizedItems;
  };

  const validateForm = () => {
    const nextErrors = {
      name: validateDisplayName(form.name, 'Tên sản phẩm', 63),
      price: validatePositiveNumber(form.price, 'Đơn giá'),
    };
    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (!validateForm()) return;

    const normalizedRecipeItems = validateRecipeItems();
    if (!normalizedRecipeItems) return;

    setIsSubmitting(true);
    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId || null,
      imageUrl: form.imageUrl.trim() || null,
      unit: form.unit.trim(),
      price: Number(form.price),
      status: form.status,
      recipeItems: normalizedRecipeItems,
    };

    try {
      if (isEditMode) {
        await productApi.updateProduct(id, payload);
      } else {
        await productApi.createProduct(payload);
      }
      const successMessage = isEditMode ? 'Đã lưu sản phẩm và định lượng.' : 'Đã tạo sản phẩm và định lượng.';
      if (isEmbedded) {
        onSaved?.();
        onClose();
      } else {
        setToastMsg(successMessage);
        setTimeout(() => navigate(ROUTES.STORE_PRODUCTS), 700);
      }
    } catch (saveError) {
      setSubmitError(saveError.message || 'Lưu sản phẩm thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshProduct = async () => {
    const response = await productApi.getProduct(id);
    const product = response.data?.product;
    setIsGroup(Boolean(product?.isGroup));
    setVariants(Array.isArray(product?.variants) ? product.variants : []);
    return product;
  };

  const handleAddSize = async () => {
    const sizeName = newSizeName.trim();
    if (!sizeName) {
      setSubmitError('Tên size là bắt buộc.');
      return;
    }
    try {
      setIsSubmitting(true);
      await productApi.addSize(id, { sizeName, price: Number(newSizePrice || form.price) });
      setNewSizeName('');
      await refreshProduct();
    } catch (error) {
      setSubmitError(error.message || 'Không thể thêm size.');
    } finally { setIsSubmitting(false); }
  };

  const handleSaveVariant = async (variant) => {
    try {
      setIsSubmitting(true);
      await productApi.updateSize(id, variant.id, {
        sizeName: variant.sizeName,
        price: Number(variant.price),
        recipeItems: (variant.recipe?.items || []).map((item) => ({ ingredientId: item.ingredientId, quantity: Number(item.quantity) || 0 })),
      });
      await refreshProduct();
    } catch (error) {
      setSubmitError(error.message || 'Không thể lưu size.');
    } finally { setIsSubmitting(false); }
  };

  const handleReorder = async (fromIndex, direction) => {
    const next = [...variants];
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= next.length) return;
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    try {
      setIsSubmitting(true);
      await productApi.reorderSizes(id, next.map((variant) => variant.id));
      await refreshProduct();
    } catch (error) { setSubmitError(error.message || 'Không thể đổi thứ tự size.'); }
    finally { setIsSubmitting(false); }
  };

  const handleArchiveSize = async (variantId) => {
    try {
      setIsSubmitting(true);
      await productApi.deleteSize(id, variantId);
      await refreshProduct();
    } catch (error) { setSubmitError(error.message || 'Không thể xoá size.'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {!isEmbedded && <PageHeader
        title={isEditMode ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm mới'}
        description="Cập nhật thông tin bán hàng và định lượng nguyên liệu trong cùng một lần lưu."
        actions={<Button variant="secondary" onClick={() => navigate(ROUTES.STORE_PRODUCTS)} icon={<ArrowLeft size={16} />}>Quay lại danh sách</Button>}
      />}

      {submitError && <Alert type="error" message={submitError} onClose={() => setSubmitError('')} />}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Thông tin sản phẩm</h3>
          {isLoading ? <div className="spinner" /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <TextInput label="Tên sản phẩm" name="name" value={form.name} onChange={handleProductChange} error={errors.name} maxLength={63} required disabled={isSubmitting} />
            <CategorySelectField value={form.categoryId} onChange={handleProductChange} categories={categories} onCategoryCreated={(category) => setCategories((current) => [...current, category].sort((left, right) => left.name.localeCompare(right.name, 'vi')))} scope="PRODUCT" disabled={isSubmitting} />
            <TextInput label="URL ảnh món (không bắt buộc)" name="imageUrl" value={form.imageUrl} onChange={handleProductChange} maxLength={500} placeholder="https://..." disabled={isSubmitting} />
            <TextInput label="Đơn vị tính" name="unit" value={form.unit} onChange={handleProductChange} placeholder="Ví dụ: ly, phần" required disabled={isSubmitting} />
            <NumberInput label="Đơn giá (VND)" name="price" value={form.price} onChange={handleProductChange} error={errors.price} allowDecimals={false} required disabled={isSubmitting} />
            <SelectInput label="Trạng thái" name="status" value={form.status} onChange={handleProductChange} disabled={isSubmitting} options={[
              { value: PRODUCT_STATUS.ACTIVE, label: 'Hoạt động' },
              { value: PRODUCT_STATUS.INACTIVE, label: 'Ngưng hoạt động' },
            ]} />
          </div>}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div><h3 style={{ margin: 0 }}>Định lượng nguyên liệu</h3><p style={{ marginBottom: 0, color: 'var(--color-secondary)' }}>Định lượng là không bắt buộc. Số lượng 0 là hợp lệ.</p></div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setRecipeItems((current) => [...current, { ...EMPTY_RECIPE_ITEM }])} disabled={isLoading || isSubmitting} icon={<Plus size={14} />}>Thêm nguyên liệu</Button>
          </div>

          {isLoading ? <div className="spinner" /> : recipeItems.length === 0 ? <p style={{ color: 'var(--color-secondary)' }}>Chưa có định lượng. Thêm nguyên liệu trước khi bật trạng thái Hoạt động.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recipeItems.map((item, index) => {
                const selectedIngredient = ingredients.find((ingredient) => String(ingredient.id) === String(item.ingredientId));
                return <div key={`${index}-${item.ingredientId}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(120px, 1fr) 80px 40px', gap: '12px', alignItems: 'center', padding: '12px', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-default)' }}>
                  <SelectInput value={item.ingredientId} onChange={(event) => handleRecipeRowChange(index, 'ingredientId', event.target.value)} options={ingredients.map((ingredient) => ({ value: ingredient.id, label: `${ingredient.name} (${ingredient.unit})` }))} placeholder="-- Chọn nguyên liệu --" disabled={isSubmitting} />
                  <NumberInput value={item.quantity} onChange={(event) => handleRecipeRowChange(index, 'quantity', event.target.value)} placeholder="Số lượng" disabled={isSubmitting} />
                  <span style={{ textAlign: 'center', color: 'var(--color-secondary)', fontWeight: 600 }}>{selectedIngredient?.unit || '--'}</span>
                  <button type="button" onClick={() => setRecipeItems((current) => current.filter((_, rowIndex) => rowIndex !== index))} disabled={isSubmitting} title="Xóa dòng" style={{ color: 'var(--color-error)', display: 'flex', justifyContent: 'center' }}><Trash2 size={16} /></button>
                </div>;
              })}
            </div>
          )}
        </div>

        {isEditMode && <div className="card" style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
            <TextInput label={isGroup ? 'Thêm size' : 'Tên size đầu tiên'} value={newSizeName} onChange={(event) => setNewSizeName(event.target.value)} placeholder="S, M, L, 500ml" disabled={isSubmitting} />
            <NumberInput label="Giá size" value={newSizePrice} onChange={(event) => setNewSizePrice(event.target.value)} disabled={isSubmitting} />
            <Button type="button" onClick={handleAddSize} disabled={isSubmitting} icon={<Plus size={14} />}>Thêm size</Button>
          </div>
          {isGroup && <div style={{ minWidth: '720px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${variants.length}, minmax(150px, 1fr))`, gap: '10px', alignItems: 'end' }}>
              <strong>Recipe matrix</strong>
              {variants.map((variant, index) => <div key={variant.id} style={{ display: 'grid', gap: '8px' }}>
                <TextInput value={variant.sizeName} onChange={(event) => setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, sizeName: event.target.value } : item))} />
                <NumberInput value={variant.price} onChange={(event) => setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, price: event.target.value } : item))} />
                <div style={{ display: 'flex', gap: '4px' }}><Button type="button" size="sm" variant="secondary" onClick={() => handleReorder(index, -1)} disabled={index === 0 || isSubmitting}>←</Button><Button type="button" size="sm" variant="secondary" onClick={() => handleReorder(index, 1)} disabled={index === variants.length - 1 || isSubmitting}>→</Button><Button type="button" size="sm" onClick={() => handleSaveVariant(variant)} disabled={isSubmitting}>Lưu</Button><Button type="button" size="sm" variant="secondary" onClick={() => handleArchiveSize(variant.id)} disabled={isSubmitting}>Xóa</Button></div>
              </div>)}
              {(ingredients || []).map((ingredient) => <><span key={`${ingredient.id}-name`}>{ingredient.name} ({ingredient.unit})</span>{variants.map((variant) => { const value = variant.recipe?.items?.find((item) => String(item.ingredientId) === String(ingredient.id))?.quantity ?? 0; return <NumberInput key={`${variant.id}-${ingredient.id}`} value={value} onChange={(event) => setVariants((current) => current.map((item) => item.id !== variant.id ? item : { ...item, recipe: { ...(item.recipe || {}), items: [...(item.recipe?.items || []).filter((recipeItem) => String(recipeItem.ingredientId) !== String(ingredient.id)), { ingredientId: ingredient.id, quantity: event.target.value }] } }))} />; })}</>)}
            </div>
          </div>}
        </div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button type="button" variant="secondary" onClick={() => isEmbedded ? onClose() : navigate(ROUTES.STORE_PRODUCTS)} disabled={isSubmitting}>Hủy</Button>
          <Button type="submit" loading={isSubmitting} disabled={isLoading} icon={<Save size={16} />}>{isEditMode ? 'Lưu sản phẩm' : 'Tạo sản phẩm'}</Button>
        </div>
      </form>

      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />
    </div>
  );
}

export default ProductFormPage;
