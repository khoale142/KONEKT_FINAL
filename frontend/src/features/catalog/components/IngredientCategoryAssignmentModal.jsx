import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/common/Modal.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { ingredientApi } from '../../ingredients/api/ingredientApi.js';

export function IngredientCategoryAssignmentModal({ isOpen, onClose, ingredients, categories, onSuccess }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawIngredients = useMemo(
    () => ingredients.filter((ingredient) => !ingredient.isPreparation),
    [ingredients],
  );
  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Bỏ danh mục / Chưa phân loại' },
      ...categories
        .filter((category) => category.scope === 'INGREDIENT' || category.scope === 'BOTH')
        .map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories],
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds([]);
    setCategoryId('');
    setError('');
  }, [isOpen]);

  const toggleIngredient = (ingredientId) => {
    setSelectedIds((current) => (
      current.includes(ingredientId)
        ? current.filter((id) => id !== ingredientId)
        : [...current, ingredientId]
    ));
  };

  const toggleAll = () => {
    setSelectedIds((current) => (
      current.length === rawIngredients.length ? [] : rawIngredients.map((ingredient) => ingredient.id)
    ));
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) {
      setError('Chọn ít nhất một nguyên liệu để xếp danh mục.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await ingredientApi.assignIngredientsToCategory({ ingredientIds: selectedIds, categoryId: categoryId || null });
      onSuccess();
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'Không thể cập nhật danh mục.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Xếp danh mục nguyên liệu" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ margin: 0, color: 'var(--color-secondary)' }}>
          Chọn nhiều nguyên liệu rồi gán cùng một danh mục. Có thể để trống để bỏ phân loại.
        </p>
        <SelectInput label="Danh mục áp dụng" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} options={categoryOptions} disabled={isSubmitting} />

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          <input type="checkbox" checked={rawIngredients.length > 0 && selectedIds.length === rawIngredients.length} onChange={toggleAll} disabled={isSubmitting || rawIngredients.length === 0} />
          Chọn tất cả ({rawIngredients.length})
        </label>

        <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-default)' }}>
          {rawIngredients.length === 0 ? (
            <p style={{ margin: 0, padding: '18px', color: 'var(--color-secondary)' }}>Chưa có nguyên liệu thô để phân loại.</p>
          ) : rawIngredients.map((ingredient) => (
            <label key={ingredient.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid var(--color-outline-variant)', cursor: isSubmitting ? 'default' : 'pointer' }}>
              <input type="checkbox" checked={selectedIds.includes(ingredient.id)} onChange={() => toggleIngredient(ingredient.id)} disabled={isSubmitting} />
              <span style={{ flex: 1 }}>
                <strong style={{ display: 'block', color: 'var(--color-primary)' }}>{ingredient.name}</strong>
                <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>{ingredient.category?.name || 'Chưa phân loại'} · {ingredient.unit}</span>
              </span>
            </label>
          ))}
        </div>

        {error && <p role="alert" style={{ margin: 0, color: 'var(--color-error)' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
          <Button onClick={handleSubmit} loading={isSubmitting}>Áp dụng cho {selectedIds.length} nguyên liệu</Button>
        </div>
      </div>
    </Modal>
  );
}

export default IngredientCategoryAssignmentModal;
