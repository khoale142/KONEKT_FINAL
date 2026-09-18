import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash, Coffee } from 'lucide-react';
import { recipeApi } from '../api/recipeApi.js';
import { productApi } from '../../products/api/productApi.js';
import { ingredientApi } from '../../ingredients/api/ingredientApi.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { NumberInput } from '../../../components/forms/NumberInput.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { formatVND } from '../../../utils/currency.js';

const EMPTY_RECIPE_ITEM = {
  ingredientId: '',
  quantity: '',
};

export function RecipeFormPage({ recipeId, onSave, onCancel }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryProductId = searchParams.get('productId');
  const { id: paramId } = useParams();
  const id = recipeId !== undefined ? recipeId : paramId;
  const isEditMode = Boolean(id);

  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [productId, setProductId] = useState('');
  const [recipeItems, setRecipeItems] = useState([EMPTY_RECIPE_ITEM]);
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
        const requests = [productApi.getProducts(), ingredientApi.getIngredients()];

        if (isEditMode) {
          requests.push(recipeApi.getRecipe(id));
        }

        const [productsResponse, ingredientsResponse, recipeResponse] = await Promise.all(requests);

        if (isCancelled) {
          return;
        }

        const loadedProducts = productsResponse.data.products || [];
        const loadedIngredients = ingredientsResponse.data.ingredients || [];
        const loadedRecipe = recipeResponse?.data?.recipe || null;
        const currentProductId = loadedRecipe ? String(loadedRecipe.productId) : '';
        const targetProductId = currentProductId || queryProductId || '';

        setIngredients(loadedIngredients);
        setProducts(
          loadedProducts.filter(
            (product) =>
              !product.hasRecipe ||
              (targetProductId && String(product.id) === targetProductId),
          ),
        );

        if (loadedRecipe) {
          setProductId(currentProductId);
          setRecipeItems(
            loadedRecipe.items.map((item) => ({
              ingredientId: String(item.ingredientId),
              quantity: String(item.quantity),
            })),
          );
        } else {
          setProductId(queryProductId || '');
          setRecipeItems([EMPTY_RECIPE_ITEM]);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setSubmitError(loadError.message || 'Khong tai duoc du lieu cong thuc.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadFormData();

    return () => {
      isCancelled = true;
    };
  }, [id, isEditMode, queryProductId]);

  const handleClose = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(ROUTES.STORE_RECIPES);
    }
  };

  const handleAddRow = () => {
    setRecipeItems((previous) => [...previous, { ...EMPTY_RECIPE_ITEM }]);
    setSubmitError('');
  };

  const handleRemoveRow = (index) => {
    setRecipeItems((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
    setSubmitError('');
  };

  const handleRowChange = (index, field, value) => {
    setRecipeItems((previous) =>
      previous.map((item, rowIndex) =>
        rowIndex === index ? { ...item, [field]: value } : item,
      ),
    );
    setSubmitError('');
  };

  const validateForm = () => {
    if (!productId) {
      setSubmitError('Vui long chon san pham ap dung cong thuc.');
      return false;
    }

    if (recipeItems.length === 0) {
      setSubmitError('Cong thuc phai co it nhat mot dong nguyen lieu.');
      return false;
    }

    const selectedIngredientIds = new Set();

    for (let index = 0; index < recipeItems.length; index += 1) {
      const item = recipeItems[index];

      if (!item.ingredientId) {
        setSubmitError(`Dong thu ${index + 1}: vui long chon nguyen lieu.`);
        return false;
      }

      const quantity = Number(item.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        setSubmitError(`Dong thu ${index + 1}: so luong phai lon hon 0.`);
        return false;
      }

      if (selectedIngredientIds.has(item.ingredientId)) {
        setSubmitError('Mot nguyen lieu khong duoc lap lai trong cung mot cong thuc.');
        return false;
      }

      selectedIngredientIds.add(item.ingredientId);
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    const payload = {
      productId,
      items: recipeItems.map((item) => ({
        ingredientId: item.ingredientId,
        quantity: Number(item.quantity),
      })),
    };

    try {
      if (isEditMode) {
        await recipeApi.updateRecipe(id, payload);
        setToastMsg('Cap nhat cong thuc thanh cong.');
      } else {
        await recipeApi.createRecipe(payload);
        setToastMsg('Tao cong thuc thanh cong.');
      }

      if (onSave) {
        setTimeout(() => {
          onSave();
        }, 900);
      } else {
        setTimeout(() => {
          navigate(ROUTES.STORE_RECIPES);
        }, 900);
      }
    } catch (saveError) {
      setSubmitError(saveError.message || 'Luu cong thuc that bai.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title={isEditMode ? 'Chinh sua cong thuc' : 'Tao cong thuc moi'}
        description="Dinh luong nguyen lieu can cho mot don vi san pham."
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            {productId && (
              <Button
                variant="secondary"
                onClick={() => navigate(`/store/products/${productId}/edit`)}
                icon={<Coffee size={16} />}
              >
                Sửa sản phẩm nhanh
              </Button>
            )}
            <Button variant="secondary" onClick={handleClose} icon={<ArrowLeft size={16} />}>
              Quay lai danh sach
            </Button>
          </div>
        }
      />

      {submitError && <Alert type="error" message={submitError} onClose={() => setSubmitError('')} />}

      {!isLoading && !isEditMode && products.length === 0 && (
        <Alert
          type="info"
          message="Tat ca san pham hien da co cong thuc hoac chua co san pham nao de thiet lap."
        />
      )}

      <div className="responsive-split-layout">
        <div className="card">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
              <p style={{ color: 'var(--color-secondary)', margin: 0 }}>Dang tai du lieu cong thuc...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SelectInput
                label="San pham ap dung"
                name="productId"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                options={products.map((product) => ({
                  value: product.id,
                  label: `${product.name} - ${product.status} - ${formatVND(product.price)}`,
                }))}
                placeholder="-- Chon san pham --"
                required
                disabled={isEditMode || isSubmitting}
              />

              <div
                style={{
                  borderTop: '1px solid var(--color-outline-variant)',
                  paddingTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: 'var(--color-primary)' }}>Thanh phan nguyen lieu</h4>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddRow}
                    disabled={isSubmitting}
                    icon={<Plus size={14} />}
                  >
                    Them dong
                  </Button>
                </div>

                {recipeItems.map((item, index) => {
                  const selectedIngredient = ingredients.find(
                    (ingredient) => String(ingredient.id) === String(item.ingredientId),
                  );

                  return (
                    <div
                      key={`${index}-${item.ingredientId}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) 90px 40px',
                        gap: '12px',
                        alignItems: 'center',
                        padding: '12px',
                        backgroundColor: 'var(--color-surface-container-low)',
                        borderRadius: 'var(--radius-default)',
                        border: '1px solid var(--color-outline-variant)',
                      }}
                    >
                      <SelectInput
                        value={item.ingredientId}
                        onChange={(event) => handleRowChange(index, 'ingredientId', event.target.value)}
                        options={ingredients.map((ingredient) => ({
                          value: ingredient.id,
                          label: `${ingredient.name} (${ingredient.unit})`,
                        }))}
                        placeholder="-- Chon nguyen lieu --"
                        disabled={isSubmitting}
                      />

                      <NumberInput
                        value={item.quantity}
                        onChange={(event) => handleRowChange(index, 'quantity', event.target.value)}
                        placeholder="So luong"
                        disabled={isSubmitting}
                      />

                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--color-secondary)',
                          fontWeight: '600',
                          textAlign: 'center',
                        }}
                      >
                        {selectedIngredient?.unit || '--'}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        disabled={isSubmitting || recipeItems.length === 1}
                        style={{ color: 'var(--color-error)', display: 'flex', justifyContent: 'center' }}
                        title="Xoa dong"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
                  Huy bo
                </Button>
                <Button type="submit" variant="primary" loading={isSubmitting} icon={<Save size={16} />}>
                  {isEditMode ? 'Luu thay doi' : 'Tao cong thuc'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Ghi chu</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
            <div>
              <strong>1 san pham:</strong> Chi co toi da mot cong thuc dang hoat dong.
            </div>
            <div>
              <strong>Don vi:</strong> Duoc lay tu master data cua nguyen lieu, khong nhap tay trong cong thuc.
            </div>
            <div>
              <strong>Ton kho:</strong> Nguyen lieu ton thap van co the dua vao cong thuc; viec chan ban se do POS va order service xu ly sau.
            </div>
          </div>
        </div>
      </div>

      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />
    </div>
  );
}

export default RecipeFormPage;
