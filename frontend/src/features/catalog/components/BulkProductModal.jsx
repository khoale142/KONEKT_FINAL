import React, { useState } from 'react';
import { Modal } from '../../../components/common/Modal.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { NumberInput } from '../../../components/forms/NumberInput.jsx';
import { RecipeMatrixModal } from './RecipeMatrixModal.jsx';
import { productApi } from '../../products/api/productApi.js';
import { X, Plus, Settings } from 'lucide-react';

export function BulkProductModal({ isOpen, onClose, onSuccess }) {
  const [rows, setRows] = useState([
    { id: crypto.randomUUID(), name: '', unit: '', price: '', imageUrl: '', status: 'ACTIVE', recipeItems: [] }
  ]);
  
  const [activeRecipeRow, setActiveRecipeRow] = useState(null); // id of the row being edited in matrix
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddRow = () => {
    setRows([...rows, { id: crypto.randomUUID(), name: '', unit: '', price: '', imageUrl: '', status: 'ACTIVE', recipeItems: [] }]);
  };

  const handleRemoveRow = (id) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const handleChange = (id, field, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
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
      // Validate
      const validRows = rows.filter(r => r.name.trim() !== '');
      if (validRows.length === 0) {
        alert('Vui lòng nhập ít nhất 1 sản phẩm hợp lệ');
        setIsSubmitting(false);
        return;
      }
      
      const refinedPayload = validRows.map(({ id, ...row }) => ({
        ...row,
        name: row.name.trim(),
        unit: row.unit.trim(),
        imageUrl: row.imageUrl.trim() || null,
        price: Number(row.price),
      }));
      if (refinedPayload.some((row) => !row.name || !row.unit || !Number.isFinite(row.price) || row.price <= 0)) {
        throw new Error('Mỗi dòng cần tên, đơn vị và giá bán lớn hơn 0.');
      }
      const response = await productApi.bulkCreateProducts(refinedPayload);
      onSuccess(response.data?.products || []);
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Tạo nhiều Sản phẩm" size="3xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', fontWeight: 600, color: 'var(--color-secondary)', fontSize: '14px', padding: '0 8px' }}>
            <div style={{ flex: 2 }}>Tên</div>
            <div style={{ flex: 1 }}>ĐVT</div>
            <div style={{ flex: 1 }}>Giá bán</div>
            <div style={{ width: '100px', textAlign: 'center' }}>Công thức</div>
            <div style={{ width: '100px', textAlign: 'center' }}>Trạng thái</div>
            <div style={{ width: '40px' }}></div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
            {rows.map((row) => (
              <div key={row.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--color-surface-container-low)', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-outline-variant)' }}>
                <div style={{ flex: 2 }}>
                  <TextInput 
                    value={row.name}
                    onChange={(e) => handleChange(row.id, 'name', e.target.value)}
                    placeholder="Tên sản phẩm"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextInput 
                    value={row.unit}
                    onChange={(e) => handleChange(row.id, 'unit', e.target.value)}
                    placeholder="ĐVT"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <NumberInput 
                    value={row.price}
                    onChange={(event) => handleChange(row.id, 'price', event.target.value)}
                    placeholder="Giá bán"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextInput
                    value={row.imageUrl}
                    onChange={(event) => handleChange(row.id, 'imageUrl', event.target.value)}
                    placeholder="Image URL"
                    disabled={isSubmitting}
                  />
                </div>
                <div style={{ width: '100px', display: 'flex', justifyContent: 'center' }}>
                  <Button 
                    variant={row.recipeItems.length > 0 ? "primary" : "secondary"}
                    onClick={() => setActiveRecipeRow(row.id)}
                    size="sm"
                  >
                    <Settings size={14} style={{ marginRight: '4px' }} />
                    Cấu hình
                  </Button>
                </div>
                <div style={{ width: '100px', display: 'flex', justifyContent: 'center' }}>
                  <input 
                    type="checkbox"
                    checked={row.status === 'ACTIVE'}
                    onChange={(e) => handleChange(row.id, 'status', e.target.checked ? 'ACTIVE' : 'INACTIVE')}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--color-primary)' }}
                  />
                </div>
                <div style={{ width: '40px', display: 'flex', justifyContent: 'center' }}>
                  <button onClick={() => handleRemoveRow(row.id)} style={{ color: 'var(--color-error)', opacity: 0.7, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div>
            <Button onClick={handleAddRow} variant="ghost" style={{ color: 'var(--color-primary)' }}>
              <Plus size={16} style={{ marginRight: '4px' }} />
              Thêm dòng
            </Button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button onClick={onClose} variant="secondary">Hủy bỏ</Button>
            <Button onClick={handleSubmit} variant="primary" isLoading={isSubmitting}>Lưu thay đổi</Button>
          </div>
        </div>
      </Modal>

      {activeRecipeRow && (
        <RecipeMatrixModal 
          isOpen={true}
          onClose={() => setActiveRecipeRow(null)}
          initialData={{ recipeItems: rows.find(r => r.id === activeRecipeRow)?.recipeItems || [] }}
          mode="RECIPE_ONLY"
          onApply={handleApplyRecipe}
        />
      )}
    </>
  );
}
