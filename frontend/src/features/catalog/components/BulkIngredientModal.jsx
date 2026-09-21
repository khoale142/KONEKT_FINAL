import { useState } from 'react';
import { Modal } from '../../../components/common/Modal.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { NumberInput } from '../../../components/forms/NumberInput.jsx';
import { RecipeMatrixModal } from './RecipeMatrixModal.jsx';
import { ingredientApi } from '../../ingredients/api/ingredientApi.js';
import { UNITS } from '../../../constants/units.js';
import { X, Plus, Settings } from 'lucide-react';

function createEmptyRow() {
  return {
    id: crypto.randomUUID(),
    name: '',
    unit: '',
    lowStockThreshold: '0',
    yieldAmount: '',
    recipeItems: [],
  };
}

export function BulkIngredientModal({ isOpen, onClose, onSuccess, mode = 'INGREDIENT' }) {
  const [rows, setRows] = useState(() => [createEmptyRow()]);
  const [activeRecipeRow, setActiveRecipeRow] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPreparation = mode === 'PREPARATION';

  const handleAddRow = () => {
    setRows((current) => [...current, createEmptyRow()]);
  };

  const handleRemoveRow = (id) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const handleChange = (id, field, value) => {
    setRows((current) => current.map((row) => (
      row.id === id ? { ...row, [field]: value } : row
    )));
  };

  const handleApplyRecipe = (matrixData) => {
    if (activeRecipeRow) {
      handleChange(activeRecipeRow, 'recipeItems', matrixData.recipeItems);
    }
    setActiveRecipeRow(null);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const validRows = rows.filter((row) => typeof row.name === 'string' && row.name.trim() !== '' && row.unit.trim() !== '');
      if (validRows.length === 0) {
        alert('Vui lòng nhập đầy đủ tên và đơn vị tính.');
        return;
      }

      for (const [index, row] of validRows.entries()) {
        if (isPreparation && (!Number.isFinite(Number(row.yieldAmount)) || Number(row.yieldAmount) <= 0)) {
          throw new Error(`Dòng ${index + 1} cần sản lượng lớn hơn 0.`);
        }
        if (isPreparation && !row.recipeItems.some((item) => Number(item.quantity) > 0)) {
          throw new Error(`Dòng ${index + 1} cần ít nhất một thành phần có số lượng lớn hơn 0.`);
        }
      }

      const refinedPayload = validRows.map((row) => ({
        name: row.name.trim(),
        unit: row.unit.trim(),
        ...(!isPreparation ? { lowStockThreshold: row.lowStockThreshold || '0' } : {}),
        ...(isPreparation
          ? {
              yieldAmount: Number(row.yieldAmount),
              recipeItems: Array.isArray(row.recipeItems) ? row.recipeItems : [],
            }
          : {}),
      }));

      const response = isPreparation
        ? await ingredientApi.bulkCreatePreparations({ items: refinedPayload })
        : await ingredientApi.bulkCreateIngredients(refinedPayload);
      onSuccess(isPreparation ? response.data?.preparations || [] : response.data?.ingredients || []);
      onClose();
    } catch (error) {
      alert(error.message || 'Có lỗi xảy ra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isPreparation ? 'Tạo nhiều bán thành phẩm' : 'Tạo nhiều nguyên liệu'} size="3xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '14px' }}>
            Nhập nguyên liệu trước. Danh mục sẽ được gán sau trong màn chỉnh sửa.
          </p>
          <div style={{ display: 'flex', gap: '16px', fontWeight: 600, color: 'var(--color-secondary)', fontSize: '14px', padding: '0 8px' }}>
            <div style={{ flex: 2 }}>Tên</div>
            <div style={{ flex: 1 }}>Đơn vị</div>
            {!isPreparation && <div style={{ flex: 1 }}>Ngưỡng cảnh báo tồn kho</div>}
            {isPreparation && <div style={{ width: '100px', textAlign: 'center' }}>Công thức</div>}
            <div style={{ width: '40px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
            {rows.map((row) => (
              <div key={row.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--color-surface-container-low)', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-outline-variant)' }}>
                <div style={{ flex: 2 }}>
                  <TextInput value={row.name} onChange={(event) => handleChange(row.id, 'name', event.target.value)} placeholder="Tên nguyên liệu" disabled={isSubmitting} />
                </div>
                <div style={{ flex: 1 }}>
                  <TextInput
                    value={row.unit}
                    onChange={(event) => handleChange(row.id, 'unit', event.target.value)}
                    options={[
                      { value: UNITS.GRAM, label: 'Gram (g)' },
                      { value: UNITS.ML, label: 'Mililit (ml)' },
                      { value: UNITS.PIECE, label: 'Cái / Chai / Hộp' },
                    ]}
                    disabled={isSubmitting}
                  />
                </div>
                {!isPreparation && (
                  <div style={{ flex: 1 }}>
                    <NumberInput
                      value={row.lowStockThreshold}
                      onChange={(event) => handleChange(row.id, 'lowStockThreshold', event.target.value)}
                      placeholder="0"
                      disabled={isSubmitting}
                    />
                  </div>
                )}
                {isPreparation && (
                  <div style={{ flex: 1 }}>
                    <NumberInput
                      value={row.yieldAmount}
                      onChange={(event) => handleChange(row.id, 'yieldAmount', event.target.value)}
                      placeholder="Yield"
                      disabled={isSubmitting}
                    />
                  </div>
                )}
                {isPreparation && (
                  <div style={{ width: '100px', display: 'flex', justifyContent: 'center' }}>
                    <Button variant={row.recipeItems?.length ? 'primary' : 'secondary'} onClick={() => setActiveRecipeRow(row.id)} size="sm" disabled={isSubmitting}>
                      <Settings size={14} style={{ marginRight: '4px' }} />
                      Cấu hình
                    </Button>
                  </div>
                )}
                <div style={{ width: '40px', display: 'flex', justifyContent: 'center' }}>
                  <button type="button" onClick={() => handleRemoveRow(row.id)} disabled={isSubmitting} aria-label="Xóa dòng" style={{ color: 'var(--color-error)', opacity: 0.7, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <Button onClick={handleAddRow} variant="ghost" disabled={isSubmitting} style={{ color: 'var(--color-primary)' }}>
              <Plus size={16} style={{ marginRight: '4px' }} />
              Thêm dòng
            </Button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button onClick={onClose} variant="secondary" disabled={isSubmitting}>Hủy bỏ</Button>
            <Button onClick={handleSubmit} variant="primary" loading={isSubmitting}>Lưu nguyên liệu</Button>
          </div>
        </div>
      </Modal>

      {activeRecipeRow && (
        <RecipeMatrixModal
          isOpen
          onClose={() => setActiveRecipeRow(null)}
          mode="PREPARATION"
          initialData={{
            recipeItems: rows.find((row) => row.id === activeRecipeRow)?.recipeItems || [],
          }}
          onApply={handleApplyRecipe}
        />
      )}
    </>
  );
}
