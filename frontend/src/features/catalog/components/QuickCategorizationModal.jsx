import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/common/Modal.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { ingredientApi } from '../../ingredients/api/ingredientApi.js';
import { productApi } from '../../products/api/productApi.js';
import { categoryApi } from '../../categories/api/categoryApi.js';

const TYPES = [
  { value: 'PRODUCT', label: 'Sản phẩm' },
  { value: 'INGREDIENT', label: 'Nguyên liệu thô' },
  { value: 'PREPARATION', label: 'Bán thành phẩm' },
];

const messageFor = (error) => error.response?.data?.message || error.message || 'Không thể cập nhật danh mục.';

export function QuickCategorizationModal({ isOpen, onClose, products, ingredients, categories, onSuccess, initialType = 'INGREDIENT', initialIds = [] }) {
  const [type, setType] = useState(initialType);
  const [selectedIds, setSelectedIds] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const uncategorizedOnly = true;
  const setUncategorizedOnly = () => {};
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allItems = useMemo(() => {
    if (type === 'PRODUCT') return products;
    return ingredients.filter((item) => Boolean(item.isPreparation) === (type === 'PREPARATION'));
  }, [type, products, ingredients]);
  const visibleItems = useMemo(
    () => allItems.filter((item) => !item.categoryId),
    [allItems],
  );
  const options = useMemo(() => [
    { value: '', label: 'Bỏ danh mục / Chưa phân loại' },
    ...categories.filter((category) => category.scope === type)
      .map((category) => ({ value: category.id, label: category.name })),
  ], [categories, type]);

  useEffect(() => {
    if (!isOpen) return;
    setType(initialType);
    setSelectedIds(initialIds);
    setCategoryId('');
    setNewCategoryName('');
    setError('');
  }, [isOpen, initialType, initialIds]);

  const switchType = (nextType) => {
    setType(nextType); setSelectedIds([]); setCategoryId(''); setError('');
  };
  const toggle = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAll = () => setSelectedIds((current) => current.length === visibleItems.length ? [] : visibleItems.map((item) => item.id));

  const createCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsSubmitting(true); setError('');
    try {
      const response = await categoryApi.createCategory({ name: newCategoryName.trim(), scope: type });
      setCategoryId(response.data?.category?.id || '');
      setNewCategoryName('');
      onSuccess?.();
    } catch (submitError) { setError(messageFor(submitError)); } finally { setIsSubmitting(false); }
  };

  const apply = async () => {
    if (!selectedIds.length) { setError('Chọn ít nhất một mục để xếp danh mục.'); return; }
    setIsSubmitting(true); setError('');
    try {
      if (type === 'PRODUCT') await productApi.assignProductsToCategory({ productIds: selectedIds, categoryId: categoryId || null });
      else await ingredientApi.assignIngredientsToCategory({ ingredientIds: selectedIds, categoryId: categoryId || null, isPreparation: type === 'PREPARATION' });
      onSuccess?.(); onClose();
    } catch (submitError) { setError(messageFor(submitError)); } finally { setIsSubmitting(false); }
  };

  return <Modal isOpen={isOpen} onClose={onClose} title="Phân loại nhanh" size="lg"><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <p style={{ margin: 0, color: 'var(--color-secondary)' }}>Danh mục không bắt buộc. Bạn có thể áp dụng ngay hoặc bỏ qua.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{TYPES.map((tab) => <Button key={tab.value} variant={type === tab.value ? 'primary' : 'secondary'} size="sm" onClick={() => switchType(tab.value)} disabled={isSubmitting}>{tab.label}</Button>)}</div>
    <SelectInput label="Danh mục áp dụng" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} options={options} disabled={isSubmitting} />
    <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}><div style={{ flex: 1 }}><TextInput label="Tạo nhanh danh mục" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Tên danh mục" disabled={isSubmitting} /></div><Button onClick={createCategory} variant="secondary" disabled={isSubmitting || !newCategoryName.trim()}>Tạo</Button></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={uncategorizedOnly} onChange={(event) => setUncategorizedOnly(event.target.checked)} disabled={isSubmitting} /> Chỉ chưa phân loại</label><label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}><input type="checkbox" checked={visibleItems.length > 0 && selectedIds.length === visibleItems.length} onChange={toggleAll} disabled={isSubmitting || !visibleItems.length} /> Chọn tất cả ({visibleItems.length})</label></div>
    <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-default)' }}>{visibleItems.length ? visibleItems.map((item) => <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--color-outline-variant)', cursor: isSubmitting ? 'default' : 'pointer' }}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)} disabled={isSubmitting} /><span style={{ flex: 1 }}><strong style={{ display: 'block', color: 'var(--color-primary)' }}>{item.name}</strong><span style={{ fontSize: 13, color: 'var(--color-secondary)' }}>{item.category?.name || 'Chưa phân loại'} · {item.unit}</span></span></label>) : <p style={{ margin: 0, padding: 18, color: 'var(--color-secondary)' }}>Không có mục phù hợp.</p>}</div>
    {error && <p role="alert" style={{ margin: 0, color: 'var(--color-error)' }}>{error}</p>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}><Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Bỏ qua</Button><Button onClick={apply} loading={isSubmitting}>Áp dụng cho {selectedIds.length} mục</Button></div>
  </div></Modal>;
}

export default QuickCategorizationModal;
