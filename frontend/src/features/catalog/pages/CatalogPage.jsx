import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Coffee, Edit3, FolderTree, ImageOff, Package, Plus, RefreshCw, Trash2, X, Factory, List, Grid, Eye, EyeOff, BookOpen, FlaskConical, Box, ShoppingBag } from 'lucide-react';
import { productApi } from '../../products/api/productApi.js';
import { ingredientApi } from '../../ingredients/api/ingredientApi.js';
import { categoryApi } from '../../categories/api/categoryApi.js';
import { ProductFormPage } from '../../products/pages/ProductFormPage.jsx';
import { IngredientFormPage } from '../../ingredients/pages/IngredientFormPage.jsx';
import { PreparationFormPage } from '../../ingredients/pages/PreparationFormPage.jsx';
import { BulkProductModal } from '../components/BulkProductModal.jsx';
import { BulkIngredientModal } from '../components/BulkIngredientModal.jsx';
import { QuickCategorizationModal } from '../components/QuickCategorizationModal.jsx';
import { CategoryManagerModal } from '../../categories/components/CategoryManagerModal.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { formatVND } from '../../../utils/currency.js';
import { ROUTES } from '../../../constants/routes.js';
import './CatalogPage.css';

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PRODUCT', label: 'Sản phẩm' },
  { value: 'PREPARATION', label: 'Bán thành phẩm' },
  { value: 'INGREDIENT', label: 'Nguyên liệu' }
];

function matchesSearch(value, search) {
  return String(value || '').toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'));
}

function StatusPill({ children, tone = 'success' }) {
  const color = tone === 'danger' ? 'var(--color-error)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-success)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 9px', color, border: `1px solid ${color}`, borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: 'var(--color-surface-container-low)' }}>
      <span style={{ width: '6px', height: '6px', background: color, borderRadius: '50%' }} />
      {children}
    </span>
  );
}

function EditorDrawer({ editor, onClose, onSaved }) {
  if (!editor) return null;
  if (!editor.id && editor.type === 'INGREDIENT') {
    return <BulkIngredientModal isOpen mode="INGREDIENT" onClose={onClose} onSuccess={onSaved} />;
  }
  if (!editor.id && editor.type === 'PREPARATION') {
    return <BulkIngredientModal isOpen mode="PREPARATION" onClose={onClose} onSuccess={onSaved} />;
  }
  const isProduct = editor.type === 'PRODUCT';
  const isPreparation = editor.type === 'PREPARATION';

  const title = editor.id
    ? `Chỉnh sửa ${isProduct ? 'sản phẩm' : isPreparation ? 'bán thành phẩm' : 'nguyên liệu'}`
    : `Tạo ${isProduct ? 'sản phẩm mới' : isPreparation ? 'bán thành phẩm mới' : 'nguyên liệu mới'}`;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ justifyContent: 'flex-end', zIndex: 1000 }}>
      <aside onClick={(event) => event.stopPropagation()} style={{ width: isProduct || isPreparation ? 'min(780px, 100vw)' : 'min(620px, 100vw)', height: '100%', overflow: 'auto', background: 'var(--color-background)', padding: '24px', boxShadow: 'var(--shadow-high)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>{title}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--color-secondary)' }}>{isProduct || isPreparation ? 'Thông tin và định lượng được lưu cùng lúc.' : 'Thiết lập thông tin và danh mục.'}</p>
          </div>
          <button type="button" onClick={onClose} title="Đóng" style={{ background: 'transparent', border: 'none', color: 'var(--color-secondary)', display: 'flex', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>
        {isProduct
          ? <ProductFormPage productId={editor.id} onClose={onClose} onSaved={onSaved} />
          : isPreparation
            ? <PreparationFormPage ingredientId={editor.id} onClose={onClose} onSaved={onSaved} />
            : <IngredientFormPage ingredientId={editor.id} onClose={onClose} onSaved={onSaved} />}
      </aside>
    </div>
  );
}

export function CatalogPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('ALL');
  const [categoryId, setCategoryId] = useState('ALL');
  const [viewMode, setViewMode] = useState('list');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkProductOpen, setBulkProductOpen] = useState(false);
  const [bulkIngredientOpen, setBulkIngredientOpen] = useState(false);
  const [bulkPreparationOpen, setBulkPreparationOpen] = useState(false);
  const [quickCategorization, setQuickCategorization] = useState(null);
  const setCategoryAssignmentOpen = (open) => {
    setQuickCategorization(open ? { type: 'INGREDIENT', ids: [] } : null);
  };
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [showSummaryCards, setShowSummaryCards] = useState(true);

  useEffect(() => {
    const create = searchParams.get('create');
    const productId = searchParams.get('editProduct');
    const ingredientId = searchParams.get('editIngredient');
    const preparationId = searchParams.get('editPreparation');

    if (create === 'product') setBulkProductOpen(true);
    else if (create === 'ingredient') setBulkIngredientOpen(true);
    else if (create === 'preparation') setBulkPreparationOpen(true);
    else if (productId) setEditor({ type: 'PRODUCT', id: productId });
    else if (ingredientId) setEditor({ type: 'INGREDIENT', id: ingredientId });
    else if (preparationId) setEditor({ type: 'PREPARATION', id: preparationId });
    else return;
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [productsResponse, ingredientsResponse, categoriesResponse] = await Promise.all([
          productApi.getProducts(),
          ingredientApi.getIngredients(),
          categoryApi.getCategories()
        ]);
        if (cancelled) return;
        setProducts(productsResponse.data?.products || []);
        setIngredients(ingredientsResponse.data?.ingredients || []);
        setCategories(categoriesResponse.data?.categories || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Không thể tải danh mục vận hành.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadCatalog();
    return () => { cancelled = true; };
  }, [reloadNonce]);

  const categoryOptions = useMemo(() => [
    { value: 'ALL', label: 'Tất cả danh mục' },
    { value: 'uncategorized', label: 'Chưa phân loại' },
    ...categories.map((category) => ({ value: category.id, label: category.name }))
  ], [categories]);

  const visibleProducts = useMemo(() => products.filter((product) =>
    matchesSearch(product.name, search) &&
    (categoryId === 'ALL' ? true : categoryId === 'uncategorized' ? !product.categoryId : product.categoryId === categoryId)
  ), [products, search, categoryId]);

  const visibleRawIngredients = useMemo(() => ingredients.filter((ingredient) =>
    !ingredient.isPreparation &&
    matchesSearch(ingredient.name, search) &&
    (categoryId === 'ALL' ? true : categoryId === 'uncategorized' ? !ingredient.categoryId : ingredient.categoryId === categoryId)
  ), [ingredients, search, categoryId]);

  const visiblePreparations = useMemo(() => ingredients.filter((ingredient) =>
    ingredient.isPreparation &&
    matchesSearch(ingredient.name, search) &&
    (categoryId === 'ALL' ? true : categoryId === 'uncategorized' ? !ingredient.categoryId : ingredient.categoryId === categoryId)
  ), [ingredients, search, categoryId]);

  const deleteItem = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'PRODUCT') await productApi.deleteProduct(deleteTarget.item.id);
      else await ingredientApi.deleteIngredient(deleteTarget.item.id);
      setToast({ message: `Đã xóa ${deleteTarget.type === 'PRODUCT' ? 'sản phẩm' : deleteTarget.type === 'PREPARATION' ? 'bán thành phẩm' : 'nguyên liệu'}.`, type: 'success' });
      setReloadNonce((value) => value + 1);
    } catch (deleteError) {
      setToast({ message: deleteError.message || 'Không thể xóa dữ liệu.', type: 'error' });
    } finally { setDeleteTarget(null); }
  };

  const handleSaved = () => {
    setReloadNonce((value) => value + 1);
    setToast({ message: 'Đã lưu thay đổi.', type: 'success' });
  };

  const handleBulkCreated = (itemType) => (createdItems) => {
    handleSaved();
    setQuickCategorization({ type: itemType, ids: createdItems.map((item) => item.id) });
  };

  const showProducts = type === 'ALL' || type === 'PRODUCT';
  const showIngredients = type === 'ALL' || type === 'INGREDIENT';
  const showPreparations = type === 'ALL' || type === 'PREPARATION';

  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.status === 'ACTIVE').length;
  const inactiveProducts = totalProducts - activeProducts;

  const rawIngredients = ingredients.filter(i => !i.isPreparation);
  const totalRawIngredients = rawIngredients.length;
  const lowStockRawIngredients = rawIngredients.filter(i => i.isLowStock).length;

  const preps = ingredients.filter(i => i.isPreparation);
  const totalPreps = preps.length;
  const lowPreps = preps.filter(p => p.isLowStock).length;
  const readyPreps = totalPreps - lowPreps;

  // Assuming Combo is not actively differentiated yet, using placeholders matching image for Combos
  const totalCombos = 4;
  const activeCombos = 4;

  return (
    <div className="catalog-page">
      <header className="catalog-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Sản phẩm & nguyên liệu</h1>
          <p>Quản lý sản phẩm, định lượng, nguyên liệu và danh mục của store trên một màn hình.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowSummaryCards(!showSummaryCards)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--color-surface-container-low)',
            border: '1px solid var(--color-outline-variant)',
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            color: 'var(--color-secondary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
          }}
        >
          {showSummaryCards ? <><EyeOff size={16} /> Ẩn thống kê</> : <><Eye size={16} /> Hiện thống kê</>}
        </button>
      </header>

      {/* Summary Cards */}
      {showSummaryCards && (
        <section className="catalog-summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>

          <div className="summary-card" style={{ background: 'var(--color-surface-container-lowest)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-outline-variant)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--color-secondary)', fontWeight: '600' }}>Món thành phẩm</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-on-surface)' }}>{totalProducts}</span>
                  <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>món</span>
                </div>
              </div>
              <div style={{ padding: '10px', background: 'var(--color-primary-container)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                <BookOpen size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ padding: '4px 8px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-primary)', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{activeProducts} đang bán</span>
              <span style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{inactiveProducts} tạm ngưng</span>
            </div>
          </div>

          <div className="summary-card" style={{ background: 'var(--color-surface-container-lowest)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-outline-variant)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--color-secondary)', fontWeight: '600' }}>Bán thành phẩm</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-on-surface)' }}>{totalPreps}</span>
                  <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>công thức cốt/sốt</span>
                </div>
              </div>
              <div style={{ padding: '10px', background: 'var(--color-warning-container)', color: 'var(--color-warning)', borderRadius: 'var(--radius-md)' }}>
                <FlaskConical size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ padding: '4px 8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{readyPreps} còn sẵn</span>
              <span style={{ padding: '4px 8px', background: 'var(--color-warning-container)', color: 'var(--color-warning)', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{lowPreps} cần nấu thêm</span>
            </div>
          </div>

          <div className="summary-card" style={{ background: 'var(--color-surface-container-lowest)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-outline-variant)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--color-secondary)', fontWeight: '600' }}>Nguyên liệu thô</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-on-surface)' }}>{totalRawIngredients}</span>
                  <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>mặt hàng</span>
                </div>
              </div>
              <div style={{ padding: '10px', background: 'var(--color-success-container)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)' }}>
                <Box size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ padding: '4px 8px', background: 'var(--color-warning-container)', color: 'var(--color-warning)', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{lowStockRawIngredients} sắp chạm đáy</span>
              <span style={{ padding: '4px 8px', background: 'var(--color-surface-container-low)', color: 'var(--color-secondary)', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>Đủ dùng 4 ngày</span>
            </div>
          </div>

          <div className="summary-card" style={{ background: 'var(--color-surface-container-lowest)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-outline-variant)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--color-secondary)', fontWeight: '600' }}>Combo & Set ưu đãi</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-on-surface)' }}>{totalCombos}</span>
                  <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>gói combo</span>
                </div>
              </div>
              <div style={{ padding: '10px', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', borderRadius: 'var(--radius-md)' }}>
                <ShoppingBag size={20} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ padding: '4px 8px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-primary)', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{activeCombos} đang bán</span>
              <span style={{ padding: '4px 8px', background: 'var(--color-surface-container-low)', color: 'var(--color-secondary)', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>Tiết kiệm đến 20%</span>
            </div>
          </div>

        </section>
      )}

      {/* Filters & Actions */}
      <section className="catalog-toolbar" style={{ width: '100%', alignItems: 'flex-start', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {/* Row 1: Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', alignItems: 'flex-end', gap: '100px' }}>
          {/* Search */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 6 / span 6' }}>
            <label htmlFor="catalog-search" style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary)' }}>
              TÌM KIẾM
            </label>
            <input
              id="catalog-search"
              type="text"
              placeholder="Tìm sản phẩm hoặc nguyên liệu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ height: '42px', width: '100%', borderRadius: '9999px', border: '1px solid var(--color-outline-variant)', padding: '0 16px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}
            />
          </div>

          {/* Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 3 / span 3' }}>
            <label htmlFor="catalog-type" style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary)' }}>
              LOẠI
            </label>
            <div style={{ position: 'relative' }}>
              <select
                id="catalog-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ height: '42px', width: '100%', appearance: 'none', borderRadius: '9999px', border: '1px solid var(--color-outline-variant)', padding: '0 36px 0 16px', fontSize: '14px', background: 'white', color: 'var(--color-on-surface)', boxSizing: 'border-box' }}
              >
                {TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div style={{ pointerEvents: 'none', position: 'absolute', inset: '0 0 0 auto', display: 'flex', alignItems: 'center', paddingRight: '14px', color: 'var(--color-secondary)' }}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 3 / span 3' }}>
            <label htmlFor="catalog-category" style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary)' }}>
              DANH MỤC
            </label>
            <div style={{ position: 'relative' }}>
              <select
                id="catalog-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{ height: '42px', width: '100%', appearance: 'none', borderRadius: '9999px', border: '1px solid var(--color-outline-variant)', padding: '0 36px 0 16px', fontSize: '14px', background: 'white', color: 'var(--color-on-surface)', boxSizing: 'border-box' }}
              >
                {categoryOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div style={{ pointerEvents: 'none', position: 'absolute', inset: '0 0 0 auto', display: 'flex', alignItems: 'center', paddingRight: '14px', color: 'var(--color-secondary)' }}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: View + Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start', width: '100%', gap: '480px', borderTop: '1px solid var(--color-outline-variant)', paddingTop: '16px' }}>
          {/* View switcher */}
          <div style={{ display: 'inline-flex', height: '38px', borderRadius: '9999px', border: '1px solid var(--color-outline-variant)', padding: '3px', background: 'white' }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '9999px', padding: '0 14px', fontSize: '12px', fontWeight: viewMode === 'list' ? '600' : '500', background: viewMode === 'list' ? 'var(--color-surface-container-highest)' : 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'list' ? 'var(--color-on-surface)' : 'var(--color-secondary)' }}
            >
              <List size={14} />
              <span>Danh sách</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '9999px', padding: '0 14px', fontSize: '12px', fontWeight: viewMode === 'card' ? '600' : '500', background: viewMode === 'card' ? 'var(--color-surface-container-highest)' : 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'card' ? 'var(--color-on-surface)' : 'var(--color-secondary)' }}
            >
              <Grid size={14} />
              <span>Thẻ</span>
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setReloadNonce(n => n + 1)} disabled={isLoading}
              style={{ display: 'inline-flex', height: '38px', alignItems: 'center', gap: '6px', borderRadius: '9999px', border: '1px solid var(--color-outline-variant)', padding: '0 14px', fontSize: '12px', fontWeight: '500', background: 'white', cursor: 'pointer', color: 'var(--color-on-surface)' }}
            >
              <RefreshCw size={14} />
              <span>Tải lại</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoriesOpen(true)}
              style={{ display: 'inline-flex', height: '38px', alignItems: 'center', gap: '6px', borderRadius: '9999px', border: '1px solid var(--color-outline-variant)', padding: '0 14px', fontSize: '12px', fontWeight: '500', background: 'white', cursor: 'pointer', color: 'var(--color-on-surface)' }}
            >
              <FolderTree size={14} />
              <span>Danh mục</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryAssignmentOpen(true)}
              style={{ display: 'inline-flex', height: '38px', alignItems: 'center', gap: '6px', borderRadius: '9999px', border: '1px solid var(--color-outline-variant)', padding: '0 14px', fontSize: '12px', fontWeight: '500', background: 'white', cursor: 'pointer', color: 'var(--color-on-surface)' }}
            >
              <span>Phân loại nhanh</span>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setCreateMenuOpen(!createMenuOpen)}
                style={{ display: 'inline-flex', height: '38px', alignItems: 'center', gap: '4px', borderRadius: '9999px', border: 'none', padding: '0 16px', fontSize: '12px', fontWeight: '600', background: 'var(--color-primary)', color: 'var(--color-on-primary)', cursor: 'pointer' }}
              >
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>+</span>
                <span>Tạo mới</span>
              </button>
              {createMenuOpen && (
                <div className="create-menu-dropdown">
                  <button type="button" onClick={() => { setBulkProductOpen(true); setCreateMenuOpen(false); }}>
                    <Coffee size={16} /> Sản phẩm
                  </button>
                  <button type="button" onClick={() => { setEditor({ type: 'INGREDIENT', id: null }); setCreateMenuOpen(false); }}>
                    <Package size={16} /> Nguyên liệu
                  </button>
                  <button type="button" onClick={() => { setEditor({ type: 'PREPARATION', id: null }); setCreateMenuOpen(false); }}>
                    <Factory size={16} /> Bán thành phẩm
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {isLoading && <div className="spinner" />}

      {!isLoading && (
        <>
          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div className="catalog-list-view">

              {showProducts && (
                <section className="catalog-section">
                  <header className="section-header">
                    <div>
                      <div className="section-title">
                        <h2>Sản phẩm</h2>
                        <span>{visibleProducts.length} món</span>
                      </div>
                      <p>Các món được bán trực tiếp trên POS.</p>
                    </div>
                  </header>

                  {visibleProducts.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-secondary)', background: 'var(--color-surface-container-lowest)', borderRadius: 'var(--radius-lg)' }}>Không có sản phẩm.</div>
                  ) : (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: '60px' }}>Ảnh</th>
                            <th>Tên sản phẩm</th>
                            <th>Danh mục</th>
                            <th>ĐVT</th>
                            <th>Giá bán</th>
                            <th>Trạng thái</th>
                            <th>Công thức</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleProducts.map(product => (
                            <tr key={product.id} onClick={() => setEditor({ type: 'PRODUCT', id: product.id })} style={{ cursor: 'pointer' }}>
                              <td>
                                <div className="product-image-container">
                                  {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <ImageOff size={20} />}
                                </div>
                              </td>
                              <td><strong>{product.name}</strong></td>
                              <td>{product.category?.name || 'Chưa phân loại'}</td>
                              <td>{product.unit || 'Ly'}</td>
                              <td>{formatVND(product.price)}</td>
                              <td>
                                <StatusPill tone={product.status === 'ACTIVE' ? 'success' : 'danger'}>
                                  {product.status === 'ACTIVE' ? 'Đang bán' : 'Ngưng bán'}
                                </StatusPill>
                              </td>
                              <td>
                                <span style={{ color: product.hasRecipe ? 'var(--color-success)' : 'var(--color-error)' }}>
                                  {product.hasRecipe ? 'Đã định lượng' : 'Chưa định lượng'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {showIngredients && (
                <section className="catalog-section">
                  <header className="section-header">
                    <div>
                      <div className="section-title">
                        <h2>Nguyên liệu</h2>
                        <span>{visibleRawIngredients.length} mặt hàng</span>
                      </div>
                      <p>Nguyên liệu đầu vào dùng để pha chế và chế biến.</p>
                    </div>
                  </header>

                  {visibleRawIngredients.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-secondary)', background: 'var(--color-surface-container-lowest)', borderRadius: 'var(--radius-lg)' }}>Không có nguyên liệu thô.</div>
                  ) : (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Tên nguyên liệu</th>
                            <th>Danh mục</th>
                            <th>ĐVT</th>
                            <th>Mức tồn an toàn</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRawIngredients.map(ingredient => (
                            <tr key={ingredient.id} onClick={() => setEditor({ type: 'INGREDIENT', id: ingredient.id })} style={{ cursor: 'pointer' }}>
                              <td><strong>{ingredient.name}</strong></td>
                              <td>{ingredient.category?.name || 'Chưa phân loại'}</td>
                              <td>{ingredient.unit}</td>
                              <td>
                                {ingredient.low_stock_threshold || ingredient.lowStockThreshold || 0} {ingredient.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {showPreparations && (
                <section className="catalog-section">
                  <header className="section-header">
                    <div>
                      <div className="section-title">
                        <h2>Bán thành phẩm</h2>
                        <span>{visiblePreparations.length} mục</span>
                      </div>
                      <p>Nguyên liệu đã sơ chế hoặc pha sẵn để dùng trong công thức.</p>
                    </div>
                  </header>

                  {visiblePreparations.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-secondary)', background: 'var(--color-surface-container-lowest)', borderRadius: 'var(--radius-lg)' }}>Không có bán thành phẩm.</div>
                  ) : (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Tên bán thành phẩm</th>
                            <th>Danh mục</th>
                            <th>ĐVT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visiblePreparations.map(ingredient => (
                            <tr key={ingredient.id} onClick={() => setEditor({ type: 'PREPARATION', id: ingredient.id })} style={{ cursor: 'pointer' }}>
                              <td><strong>{ingredient.name}</strong></td>
                              <td>{ingredient.category?.name || 'Chưa phân loại'}</td>
                              <td>{ingredient.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {/* CARD VIEW */}
          {viewMode === 'card' && (
            <div className="catalog-card-view">

              {showProducts && (
                <section className="catalog-section">
                  <header className="section-header">
                    <div>
                      <div className="section-title">
                        <h2>Sản phẩm</h2>
                        <span>{visibleProducts.length} món</span>
                      </div>
                      <p>Các món được bán trực tiếp trên POS.</p>
                    </div>
                  </header>

                  {visibleProducts.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-secondary)' }}>Không có sản phẩm.</div>
                  ) : (
                    <div className="catalog-card-grid">
                      {visibleProducts.map(product => (
                        <article key={product.id} className="catalog-card product-card" onClick={() => setEditor({ type: 'PRODUCT', id: product.id })} style={{ cursor: 'pointer' }}>
                          <div className="catalog-card-header">
                            <div className="product-image-container">
                              {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <ImageOff size={20} />}
                            </div>
                            <div>
                              <h3>{product.name}</h3>
                              <span>{product.category?.name || 'Chưa phân loại'}</span>
                            </div>
                          </div>

                          <dl className="catalog-card-details">
                            <div>
                              <dt>ĐVT</dt>
                              <dd>{product.unit || 'Ly'}</dd>
                            </div>
                            <div>
                              <dt>Giá bán</dt>
                              <dd>{formatVND(product.price)}</dd>
                            </div>
                            <div>
                              <dt>Trạng thái</dt>
                              <dd>
                                <StatusPill tone={product.status === 'ACTIVE' ? 'success' : 'danger'}>
                                  {product.status === 'ACTIVE' ? 'Đang bán' : 'Ngưng bán'}
                                </StatusPill>
                              </dd>
                            </div>
                            <div>
                              <dt>Công thức</dt>
                              <dd style={{ color: product.hasRecipe ? 'var(--color-success)' : 'var(--color-error)' }}>
                                {product.hasRecipe ? 'Đã định lượng' : 'Chưa định lượng'}
                              </dd>
                            </div>
                          </dl>


                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {showIngredients && (
                <section className="catalog-section">
                  <header className="section-header">
                    <div>
                      <div className="section-title">
                        <h2>Nguyên liệu</h2>
                        <span>{visibleRawIngredients.length} mặt hàng</span>
                      </div>
                      <p>Nguyên liệu đầu vào dùng để pha chế và chế biến.</p>
                    </div>
                  </header>

                  {visibleRawIngredients.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-secondary)' }}>Không có nguyên liệu thô.</div>
                  ) : (
                    <div className="catalog-card-grid">
                      {visibleRawIngredients.map(ingredient => (
                        <article key={ingredient.id} className="catalog-card" onClick={() => setEditor({ type: 'INGREDIENT', id: ingredient.id })} style={{ cursor: 'pointer' }}>
                          <div className="catalog-card-header">
                            <div>
                              <h3>{ingredient.name}</h3>
                              <span>{ingredient.category?.name || 'Chưa phân loại'}</span>
                            </div>
                          </div>

                          <dl className="catalog-card-details">
                            <div>
                              <dt>ĐVT</dt>
                              <dd>{ingredient.unit}</dd>
                            </div>
                            <div>
                              <dt>Mức tồn an toàn</dt>
                              <dd>
                                {ingredient.low_stock_threshold || ingredient.lowStockThreshold || 0} {ingredient.unit}
                              </dd>
                            </div>
                          </dl>


                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {showPreparations && (
                <section className="catalog-section">
                  <header className="section-header">
                    <div>
                      <div className="section-title">
                        <h2>Bán thành phẩm</h2>
                        <span>{visiblePreparations.length} mục</span>
                      </div>
                      <p>Nguyên liệu đã sơ chế hoặc pha sẵn để dùng trong công thức.</p>
                    </div>
                  </header>

                  {visiblePreparations.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-secondary)' }}>Không có bán thành phẩm.</div>
                  ) : (
                    <div className="catalog-card-grid">
                      {visiblePreparations.map(ingredient => (
                        <article key={ingredient.id} className="catalog-card" onClick={() => setEditor({ type: 'PREPARATION', id: ingredient.id })} style={{ cursor: 'pointer' }}>
                          <div className="catalog-card-header">
                            <div>
                              <h3>{ingredient.name}</h3>
                              <span>{ingredient.category?.name || 'Chưa phân loại'}</span>
                            </div>
                          </div>

                          <dl className="catalog-card-details">
                            <div>
                              <dt>ĐVT</dt>
                              <dd>{ingredient.unit}</dd>
                            </div>
                          </dl>


                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </>
      )}

      <CategoryManagerModal isOpen={categoriesOpen} onClose={() => setCategoriesOpen(false)} onChanged={() => setReloadNonce((value) => value + 1)} />
      {bulkProductOpen && <BulkProductModal isOpen={true} onClose={() => setBulkProductOpen(false)} onSuccess={handleBulkCreated('PRODUCT')} />}
      {bulkIngredientOpen && <BulkIngredientModal isOpen={true} mode="INGREDIENT" onClose={() => setBulkIngredientOpen(false)} onSuccess={handleBulkCreated('INGREDIENT')} />}
      {bulkPreparationOpen && <BulkIngredientModal isOpen={true} mode="PREPARATION" onClose={() => setBulkPreparationOpen(false)} onSuccess={handleBulkCreated('PREPARATION')} />}
      {quickCategorization && <QuickCategorizationModal isOpen products={products} ingredients={ingredients} categories={categories} initialType={quickCategorization.type} initialIds={quickCategorization.ids} onClose={() => setQuickCategorization(null)} onSuccess={handleSaved} />}
      <EditorDrawer editor={editor} onClose={() => setEditor(null)} onSaved={handleSaved} />
      <ConfirmDialog isOpen={Boolean(deleteTarget)} title={`Xóa ${deleteTarget?.type === 'PRODUCT' ? 'sản phẩm' : deleteTarget?.type === 'PREPARATION' ? 'bán thành phẩm' : 'nguyên liệu'}`} message="Dữ liệu sẽ bị ẩn khỏi danh sách. Dữ liệu đã có giao dịch kho hoặc được dùng trong công thức sẽ không thể xóa." onConfirm={deleteItem} onCancel={() => setDeleteTarget(null)} />
      <Toast message={toast.message} type={toast.type} onClose={() => setToast((current) => ({ ...current, message: '' }))} />
    </div>
  );
}

export default CatalogPage;
