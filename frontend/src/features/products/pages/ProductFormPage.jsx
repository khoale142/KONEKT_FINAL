import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, ChefHat } from 'lucide-react';
import { productApi } from '../api/productApi.js';
import { recipeApi } from '../../recipes/api/recipeApi.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { NumberInput } from '../../../components/forms/NumberInput.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { PRODUCT_STATUS } from '../../../constants/productStatus.js';
import { ROUTES } from '../../../constants/routes.js';
import { DEFAULT_PRODUCT_TAG, PRODUCT_TAG_SUGGESTIONS } from '../../../constants/productTags.js';
import { validateDisplayName, validatePositiveNumber } from '../../../utils/validators.js';

const DEFAULT_FORM = {
  name: '',
  tag: DEFAULT_PRODUCT_TAG,
  price: '',
  status: PRODUCT_STATUS.ACTIVE,
};

function getTagSuggestions(currentTag) {
  return Array.from(new Set([...(PRODUCT_TAG_SUGGESTIONS || []), currentTag || DEFAULT_PRODUCT_TAG]));
}

export function ProductFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [hasRecipe, setHasRecipe] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [associatedRecipeId, setAssociatedRecipeId] = useState(null);

  const tagSuggestions = useMemo(() => getTagSuggestions(form.tag), [form.tag]);

  useEffect(() => {
    if (!isEditMode) {
      return;
    }

    const loadProduct = async () => {
      setIsLoading(true);
      setSubmitError('');

      try {
        const response = await productApi.getProduct(id);
        const product = response.data.product;

        setForm({
          name: product.name || '',
          tag: product.tag || DEFAULT_PRODUCT_TAG,
          price: product.price !== undefined && product.price !== null ? String(product.price) : '',
          status: product.status || PRODUCT_STATUS.ACTIVE,
        });
        setHasRecipe(Boolean(product.hasRecipe));

        // Fetch associated recipe
        try {
          const recipeRes = await recipeApi.getRecipeByProductId(id);
          if (recipeRes.data?.recipe) {
            setAssociatedRecipeId(recipeRes.data.recipe.id);
          }
        } catch {
          setAssociatedRecipeId(null);
        }
      } catch (loadError) {
        setSubmitError(loadError.message || 'Không tải được thông tin sản phẩm.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadProduct();
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
      name: validateDisplayName(form.name, 'Tên sản phẩm', 63),
      tag: validateDisplayName(form.tag, 'Tag sản phẩm', 40),
      price: validatePositiveNumber(form.price, 'Đơn giá'),
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
      price: Number(form.price),
      status: form.status,
    };

    try {
      if (isEditMode) {
        await productApi.updateProduct(id, payload);
        setToastMsg('Cập nhật sản phẩm thành công.');
      } else {
        await productApi.createProduct(payload);
        setToastMsg('Tạo sản phẩm thành công.');
      }

      setTimeout(() => {
        navigate(ROUTES.STORE_PRODUCTS);
      }, 900);
    } catch (saveError) {
      setSubmitError(saveError.message || 'Lưu thông tin sản phẩm thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title={isEditMode ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm mới'}
        description={
          isEditMode
            ? 'Cập nhật tên, tag, đơn giá và trạng thái kinh doanh của sản phẩm.'
            : 'Tạo mới sản phẩm đồ uống để chuẩn bị cho quản lý công thức, POS và bộ lọc theo tag.'
        }
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            {isEditMode && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (associatedRecipeId) {
                    navigate(`/store/recipes/${associatedRecipeId}/edit`);
                  } else {
                    navigate(`/store/recipes/new?productId=${id}`);
                  }
                }}
                icon={<ChefHat size={16} />}
              >
                {associatedRecipeId ? 'Sửa công thức nhanh' : 'Thiết lập công thức nhanh'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(ROUTES.STORE_PRODUCTS)} icon={<ArrowLeft size={16} />}>
              Quay lại danh sách
            </Button>
          </div>
        }
      />

      {submitError && <Alert type="error" message={submitError} onClose={() => setSubmitError('')} />}

      <div className="responsive-split-layout">
        <div className="card">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
              <p style={{ color: 'var(--color-secondary)', margin: 0 }}>Đang tải thông tin sản phẩm...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <TextInput
                label="Tên sản phẩm"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={errors.name}
                placeholder="Ví dụ: Cà phê sữa đá"
                maxLength={63}
                required
                disabled={isSubmitting}
              />

              <TextInput
                label="Tag / nhóm sản phẩm"
                name="tag"
                value={form.tag}
                onChange={handleChange}
                error={errors.tag}
                placeholder="Ví dụ: Cà phê"
                maxLength={40}
                list="product-tag-suggestions"
                required
                disabled={isSubmitting}
              />
              <datalist id="product-tag-suggestions">
                {tagSuggestions.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>

              <NumberInput
                label="Đơn giá (VND)"
                name="price"
                value={form.price}
                onChange={handleChange}
                error={errors.price}
                placeholder="Ví dụ: 30000"
                allowDecimals={false}
                required
                disabled={isSubmitting}
              />

              <SelectInput
                label="Trạng thái kinh doanh"
                name="status"
                value={form.status}
                onChange={handleChange}
                options={[
                  { value: PRODUCT_STATUS.ACTIVE, label: 'Hoạt động' },
                  { value: PRODUCT_STATUS.INACTIVE, label: 'Ngưng hoạt động' },
                ]}
                disabled={isSubmitting}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.STORE_PRODUCTS)} disabled={isSubmitting}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary" loading={isSubmitting} icon={<Save size={16} />}>
                  {isEditMode ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Ghi chú</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
            <div>
              <strong>Tag:</strong> Dùng để gom nhóm và lọc nhanh theo loại như <code>Cà phê</code>, <code>Espresso</code>, <code>Freeze</code>.
            </div>
            <div>
              <strong>Trạng thái hiển thị (POS):</strong> Chỉ những sản phẩm ở trạng thái <code>ACTIVE</code> (Hoạt động) mới hiển thị trên thực đơn bán hàng.
            </div>
            <div>
              <strong>Công thức pha chế:</strong> Định lượng nguyên liệu được thiết lập và quản lý riêng ở phần Quản lý Công thức (Recipe).
            </div>
            {isEditMode && (
              <div>
                <strong>Trạng thái công thức:</strong> {hasRecipe ? ' Đã thiết lập' : ' Chưa thiết lập'}
              </div>
            )}
          </div>
        </div>
      </div>

      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />
    </div>
  );
}

export default ProductFormPage;
