import { useEffect, useMemo, useState } from 'react';
import { Edit3, Folder, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { categoryApi } from '../api/categoryApi.js';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';

const SCOPE_OPTIONS = [
  { value: 'BOTH', label: 'Cả món và nguyên liệu' },
  { value: 'PRODUCT', label: 'Chỉ món' },
  { value: 'INGREDIENT', label: 'Chỉ nguyên liệu thô' },
  { value: 'PREPARATION', label: 'Chỉ bán thành phẩm' },
];

const GROUPS = [
  { key: 'PRODUCT', title: 'Món (Thành phẩm)', description: 'Chỉ áp dụng cho món/sản phẩm.' },
  { key: 'INGREDIENT', title: 'Nguyên liệu thô', description: 'Chỉ áp dụng cho nguyên liệu thô.' },
  { key: 'PREPARATION', title: 'Bán thành phẩm', description: 'Chỉ áp dụng cho bán thành phẩm.' },
  { key: 'BOTH', title: 'Dùng chung', description: 'Dùng được cho nhiều loại.' },
];

// Legacy shared categories are migrated into one category per item type.
SCOPE_OPTIONS.splice(0, 1);
GROUPS.pop();

export function CategoryManagerModal({ isOpen, onClose, onChanged }) {
  const [categories, setCategories] = useState([]);
  const [draft, setDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (draft?.scope === 'BOTH') {
      setDraft((current) => ({ ...current, scope: 'PRODUCT' }));
    }
  }, [draft?.scope]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await categoryApi.getCategories();
        if (!cancelled) setCategories(response.data?.categories || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Không thể tải danh mục.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isOpen, reloadNonce]);

  const groupedCategories = useMemo(() => GROUPS.map((group) => ({
    ...group,
    items: categories.filter((category) => category.scope === group.key),
  })), [categories]);

  if (!isOpen) return null;

  const saveCategory = async (event) => {
    event.preventDefault();
    const name = draft?.name?.trim();
    if (!name) {
      setError('Tên danh mục là bắt buộc.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      if (draft.id) await categoryApi.updateCategory(draft.id, { name, scope: draft.scope });
      else await categoryApi.createCategory({ name, scope: draft.scope });
      setDraft(null);
      setReloadNonce((value) => value + 1);
      onChanged?.();
    } catch (saveError) {
      setError(saveError.message || 'Không thể lưu danh mục.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCategory = async () => {
    if (!deleteTarget) return;
    try {
      await categoryApi.deleteCategory(deleteTarget.id);
      setReloadNonce((value) => value + 1);
      onChanged?.();
    } catch (deleteError) {
      setError(deleteError.message || 'Không thể xóa danh mục.');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ width: 'min(980px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>Danh mục</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--color-secondary)' }}>Quản lý danh mục riêng cho món và nguyên liệu của store này.</p>
          </div>
          <button type="button" onClick={onClose} title="Đóng" style={{ color: 'var(--color-secondary)', display: 'flex' }}><X size={22} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" onClick={() => setReloadNonce((value) => value + 1)} disabled={isLoading} icon={<RefreshCw size={15} />}>Tải lại</Button>
            <Button size="sm" onClick={() => { setDraft({ name: '', scope: 'BOTH' }); setError(''); }} icon={<Plus size={16} />}>Tạo danh mục</Button>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}

          {draft && <form onSubmit={saveCategory} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end', gap: '12px', padding: '16px' }}>
            <TextInput label="Tên danh mục" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} maxLength={80} disabled={isSaving} required />
            <SelectInput label="Áp dụng cho" value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value }))} options={SCOPE_OPTIONS} disabled={isSaving} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap', gridColumn: '1 / -1' }}>
              <Button type="button" variant="secondary" onClick={() => setDraft(null)} disabled={isSaving}>Hủy</Button>
              <Button type="submit" loading={isSaving}>{draft.id ? 'Lưu' : 'Tạo'}</Button>
            </div>
          </form>}

          {isLoading ? <div className="spinner" style={{ margin: '32px auto' }} /> : groupedCategories.map((group) => <section key={group.key}>
            <h3 style={{ margin: '0 0 4px', color: 'var(--color-primary)' }}>{group.title}</h3>
            <p style={{ margin: '0 0 10px', color: 'var(--color-secondary)', fontSize: '14px' }}>{group.description}</p>
            {group.items.length === 0 ? <p style={{ color: 'var(--color-secondary)', margin: 0 }}>Chưa có danh mục.</p> : <div style={{ display: 'grid', gap: '8px' }}>
              {group.items.map((category) => <div key={category.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
                <Folder size={18} color="var(--color-tertiary-container)" />
                <strong style={{ flex: 1 }}>{category.name}</strong>
                <span style={{ color: 'var(--color-secondary)', fontSize: '13px' }}>{category.productCount} món · {category.ingredientCount} nguyên liệu</span>
                <button type="button" onClick={() => { setDraft({ ...category }); setError(''); }} title="Sửa danh mục" style={{ color: 'var(--color-primary)', display: 'flex' }}><Edit3 size={17} /></button>
                <button type="button" onClick={() => setDeleteTarget(category)} title="Xóa danh mục" style={{ color: 'var(--color-error)', display: 'flex' }}><Trash2 size={17} /></button>
              </div>)}
            </div>}
          </section>)}
        </div>
      </div>
      <ConfirmDialog isOpen={Boolean(deleteTarget)} title="Xóa danh mục" message="Danh mục chỉ xóa được khi không còn món hoặc nguyên liệu nào sử dụng nó." onConfirm={deleteCategory} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

export default CategoryManagerModal;
