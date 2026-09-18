import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Edit, Plus, RotateCcw, Trash2, ChefHat, Coffee } from 'lucide-react';
import { productApi } from '../api/productApi.js';
import { recipeApi } from '../../recipes/api/recipeApi.js';
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
import { PRODUCT_TAG_SUGGESTIONS } from '../../../constants/productTags.js';
import { ROUTES } from '../../../constants/routes.js';
import { formatVND } from '../../../utils/currency.js';
import { RecipeFormPage } from '../../recipes/pages/RecipeFormPage.jsx';

const centeredCellContentStyle = {
  display: 'flex',
  justifyContent: 'center',
};

const numericValueStyle = {
  display: 'inline-block',
  fontWeight: '700',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

function mergeTagOptions(tags, selectedTag) {
  const mergedTags = Array.from(
    new Set([
      ...PRODUCT_TAG_SUGGESTIONS,
      ...(tags || []),
      ...(selectedTag && selectedTag !== 'ALL' ? [selectedTag] : []),
    ]),
  );
  return [
    { value: 'ALL', label: 'Tất cả tag' },
    ...mergedTags.map((tag) => ({ value: tag, label: tag })),
  ];
}

export function ProductListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'products';

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // Toast status
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const [error, setError] = useState('');

  // ------------------ PRODUCTS TAB STATES & LOGIC ------------------
  const [products, setProducts] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('ALL');
  const [productTagFilter, setProductTagFilter] = useState('ALL');
  const [productDeleteId, setProductDeleteId] = useState(null);
  const [productReloadNonce, setProductReloadNonce] = useState(0);

  const tagOptions = useMemo(
    () => mergeTagOptions(availableTags, productTagFilter),
    [availableTags, productTagFilter]
  );

  const loadProducts = async () => {
    setIsProductsLoading(true);
    setError('');
    try {
      const response = await productApi.getProducts({
        search: productSearch.trim(),
        status: productStatusFilter,
        tag: productTagFilter,
      });
      setProducts(response.data.products || []);
      setAvailableTags(response.data.tags || []);
    } catch (loadError) {
      setProducts([]);
      setAvailableTags([]);
      setError(loadError.message || 'Không tải được danh sách sản phẩm.');
    } finally {
      setIsProductsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'products') {
      const timer = setTimeout(() => {
        void loadProducts();
      }, 250);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productReloadNonce, productSearch, productStatusFilter, productTagFilter, activeTab]);

  const handleProductDelete = async () => {
    if (!productDeleteId) return;
    try {
      await productApi.deleteProduct(productDeleteId);
      setToastType('success');
      setToastMsg('Xóa sản phẩm thành công.');
      setProductReloadNonce((current) => current + 1);
    } catch (deleteError) {
      setToastType('error');
      setToastMsg(deleteError.message || 'Xóa sản phẩm thất bại.');
    } finally {
      setProductDeleteId(null);
    }
  };

  const productHeaders = [
    {
      key: 'id',
      label: 'Mã SP',
      style: { width: '124px', whiteSpace: 'nowrap' },
      render: (row) => <CompactCode value={row.id} prefix="SP" />,
    },
    {
      key: 'name',
      label: 'Tên sản phẩm',
      style: { minWidth: '260px' },
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
      key: 'price',
      label: 'Đơn giá',
      render: (row) => <span style={numericValueStyle}>{formatVND(row.price)}</span>,
      style: { width: '148px', textAlign: 'right', whiteSpace: 'nowrap' },
    },
    {
      key: 'hasRecipe',
      label: 'Công thức',
      render: (row) => (
        <div style={centeredCellContentStyle}>
          <StatusBadge
            status={row.hasRecipe ? 'SUCCESS' : 'ERROR'}
            customLabel={row.hasRecipe ? 'Đã thiết lập' : 'Chưa thiết lập'}
          />
        </div>
      ),
      style: { width: '164px', textAlign: 'center', whiteSpace: 'nowrap' },
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => (
        <div style={centeredCellContentStyle}>
          <StatusBadge status={row.status} />
        </div>
      ),
      style: { width: '132px', textAlign: 'center', whiteSpace: 'nowrap' },
    },
    {
      key: 'actions',
      label: 'Hành động',
      style: { width: '96px', textAlign: 'right', whiteSpace: 'nowrap' },
      render: (row) => (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => navigate(`/store/products/${row.id}/edit`)}
            title="Chỉnh sửa sản phẩm"
            style={{ color: 'var(--color-primary)', display: 'flex', padding: 0 }}
          >
            <Edit size={16} />
          </button>
          <button
            type="button"
            onClick={() => setProductDeleteId(row.id)}
            title="Xóa sản phẩm"
            style={{ color: 'var(--color-error)', display: 'flex', padding: 0 }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  // ------------------ RECIPES TAB STATES & LOGIC ------------------
  const [recipes, setRecipes] = useState([]);
  const [isRecipesLoading, setIsRecipesLoading] = useState(true);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeShowForm, setRecipeShowForm] = useState(false);
  const [recipeEditId, setRecipeEditId] = useState(null);
  const [recipeDeleteId, setRecipeDeleteId] = useState(null);

  const loadRecipes = async (silent = false) => {
    if (!silent) {
      setIsRecipesLoading(true);
    }
    setError('');
    try {
      const response = await recipeApi.getRecipes({
        search: recipeSearch.trim(),
      });
      setRecipes(response.data.recipes || []);
    } catch (loadError) {
      setRecipes([]);
      setError(loadError.message || 'Không tải được danh sách công thức.');
    } finally {
      if (!silent) {
        setIsRecipesLoading(false);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'recipes') {
      const timer = setTimeout(() => {
        void loadRecipes(false);
      }, 250);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeSearch, activeTab]);

  const handleRecipeDelete = async () => {
    if (!recipeDeleteId) return;
    try {
      await recipeApi.deleteRecipe(recipeDeleteId);
      setToastType('success');
      setToastMsg('Xóa công thức thành công.');
      setRecipes((current) => current.filter((r) => r.id !== recipeDeleteId));
      void loadRecipes(true);
    } catch (deleteError) {
      setToastType('error');
      setToastMsg(deleteError.message || 'Xóa công thức thất bại.');
    } finally {
      setRecipeDeleteId(null);
    }
  };

  const recipeHeaders = [
    {
      key: 'id',
      label: 'Mã CT',
      style: { width: '124px', whiteSpace: 'nowrap' },
      render: (row) => <CompactCode value={row.id} prefix="CT" />,
    },
    {
      key: 'productName',
      label: 'Sản phẩm áp dụng',
      render: (row) => <strong style={{ color: 'var(--color-primary)' }}>{row.productName}</strong>,
    },
    {
      key: 'productPrice',
      label: 'Đơn giá bán',
      style: { width: '140px' },
      render: (row) => formatVND(row.productPrice),
    },
    {
      key: 'productStatus',
      label: 'Trạng thái SP',
      style: { width: '150px' },
      render: (row) => (
        <div style={centeredCellContentStyle}>
          <StatusBadge status={row.productStatus} />
        </div>
      ),
    },
    {
      key: 'items',
      label: 'Nguyên liệu thành phần',
      render: (row) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {row.items.map((item) => (
            <span
              key={`${row.id}-${item.ingredientId}`}
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-surface-container-low)',
                color: 'var(--color-on-surface-variant)',
                border: '1px solid var(--color-outline-variant)',
              }}
            >
              {item.ingredientName}: {item.quantity} {item.unit}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Hành động',
      style: { width: '120px', textAlign: 'right' },
      render: (row) => (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              setRecipeEditId(row.id);
              setRecipeShowForm(true);
            }}
            title="Chỉnh sửa công thức"
            style={{ color: 'var(--color-primary)', display: 'flex', padding: 0 }}
          >
            <Edit size={16} />
          </button>
          <button
            type="button"
            onClick={() => setRecipeDeleteId(row.id)}
            title="Xóa công thức"
            style={{ color: 'var(--color-error)', display: 'flex', padding: 0 }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  // Render the Recipe Form inline if requested
  if (activeTab === 'recipes' && recipeShowForm) {
    return (
      <RecipeFormPage
        recipeId={recipeEditId}
        onSave={() => {
          setRecipeShowForm(false);
          setRecipeEditId(null);
          void loadRecipes(true);
        }}
        onCancel={() => {
          setRecipeShowForm(false);
          setRecipeEditId(null);
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title="Quản lý sản phẩm & Công thức"
        description="Quản lý danh sách đồ uống và cấu hình định mức nguyên liệu chế biến của từng sản phẩm."
        actions={
          activeTab === 'products' ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setProductReloadNonce((current) => current + 1)}
                disabled={isProductsLoading}
                icon={<RotateCcw size={16} />}
              >
                Tải lại
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate(ROUTES.STORE_PRODUCTS_NEW)}
                icon={<Plus size={16} />}
              >
                Thêm sản phẩm
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => void loadRecipes(false)}
                disabled={isRecipesLoading}
                icon={<RotateCcw size={16} />}
              >
                Tải lại
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setRecipeEditId(null);
                  setRecipeShowForm(true);
                }}
                icon={<Plus size={16} />}
              >
                Thêm công thức
              </Button>
            </>
          )
        }
      />

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Tab Navigation */}
      <div
        className="tab-container"
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: 'var(--spacing-md)',
          borderBottom: '1px solid var(--color-surface-container-high)',
          paddingBottom: '8px',
        }}
      >
        <button
          onClick={() => setActiveTab('products')}
          className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Coffee size={18} />
          Danh sách sản phẩm
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`btn ${activeTab === 'recipes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ChefHat size={18} />
          Định lượng công thức
        </button>
      </div>

      {/* ------------------ TAB CONTENT: PRODUCTS ------------------ */}
      {activeTab === 'products' && (
        <>
          <div className="card" style={{ padding: 'var(--spacing-sm)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <TextInput
                  placeholder="Tìm kiếm sản phẩm theo tên..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>

              <div style={{ width: '180px' }}>
                <SelectInput
                  value={productStatusFilter}
                  onChange={(e) => setProductStatusFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'Tất cả trạng thái' },
                    { value: 'ACTIVE', label: 'Hoạt động' },
                    { value: 'INACTIVE', label: 'Ngưng hoạt động' },
                  ]}
                />
              </div>

              <div style={{ width: '180px' }}>
                <SelectInput
                  value={productTagFilter}
                  onChange={(e) => setProductTagFilter(e.target.value)}
                  options={tagOptions}
                />
              </div>
            </div>
          </div>

          <DataTable
            headers={productHeaders}
            data={products}
            loading={isProductsLoading}
            emptyMessage="Không tìm thấy sản phẩm nào phù hợp."
            style={{ minWidth: '1040px' }}
          />

          <ConfirmDialog
            isOpen={productDeleteId !== null}
            title="Xóa sản phẩm"
            message="Bạn có chắc chắn muốn xóa sản phẩm này khỏi danh sách? Thao tác này sẽ ẩn sản phẩm khỏi hệ thống quản lý."
            onConfirm={handleProductDelete}
            onCancel={() => setProductDeleteId(null)}
          />
        </>
      )}

      {/* ------------------ TAB CONTENT: RECIPES ------------------ */}
      {activeTab === 'recipes' && (
        <>
          <div className="card" style={{ padding: 'var(--spacing-sm)' }}>
            <TextInput
              placeholder="Tìm kiếm công thức theo tên sản phẩm..."
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
            />
          </div>

          <DataTable
            headers={recipeHeaders}
            data={recipes}
            loading={isRecipesLoading}
            emptyMessage="Không tìm thấy công thức nào phù hợp."
          />

          <ConfirmDialog
            isOpen={recipeDeleteId !== null}
            title="Xóa công thức"
            message="Bạn có chắc chắn muốn xóa công thức này? Sản phẩm sẽ không sẵn sàng cho POS cho đến khi được thiết lập lại."
            onConfirm={handleRecipeDelete}
            onCancel={() => setRecipeDeleteId(null)}
          />
        </>
      )}

      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />
    </div>
  );
}

export default ProductListPage;
