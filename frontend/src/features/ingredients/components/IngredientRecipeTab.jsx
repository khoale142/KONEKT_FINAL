import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash } from 'lucide-react';
import { ingredientApi } from '../api/ingredientApi.js';
import { Button } from '../../../components/common/Button.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { NumberInput } from '../../../components/forms/NumberInput.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';

const EMPTY_RECIPE_ITEM = {
  ingredientId: '',
  quantity: '',
};

export function IngredientRecipeTab({ ingredientId }) {
  const [ingredients, setIngredients] = useState([]);
  const [recipeItems, setRecipeItems] = useState([EMPTY_RECIPE_ITEM]);
  const [yieldAmount, setYieldAmount] = useState('1');
  
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
        const [ingredientsResponse, recipeResponse] = await Promise.all([
          ingredientApi.getIngredients(),
          ingredientApi.getIngredientRecipe(ingredientId).catch(err => {
            if (err.response?.status === 404) return null;
            throw err;
          }),
        ]);

        if (isCancelled) return;

        setIngredients(ingredientsResponse.data.ingredients || []);
        
        const loadedRecipe = recipeResponse?.data?.recipe || null;
        if (loadedRecipe) {
          setYieldAmount(String(loadedRecipe.yieldAmount || 1));
          setRecipeItems(
            loadedRecipe.items.map((item) => ({
              ingredientId: String(item.ingredientId),
              quantity: String(item.quantity),
            }))
          );
        } else {
          setYieldAmount('1');
          setRecipeItems([EMPTY_RECIPE_ITEM]);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setSubmitError(loadError.message || 'Không tải được dữ liệu công thức.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadFormData();

    return () => {
      isCancelled = true;
    };
  }, [ingredientId]);

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
    if (recipeItems.length === 0) {
      setSubmitError('Công thức phải có ít nhất một dòng nguyên liệu.');
      return false;
    }

    const yieldNum = Number(yieldAmount);
    if (!Number.isFinite(yieldNum) || yieldNum <= 0) {
      setSubmitError('Số lượng thành phẩm (Yield Amount) phải lớn hơn 0.');
      return false;
    }

    const selectedIngredientIds = new Set();

    for (let index = 0; index < recipeItems.length; index += 1) {
      const item = recipeItems[index];

      if (!item.ingredientId) {
        setSubmitError(`Dòng thứ ${index + 1}: vui lòng chọn nguyên liệu.`);
        return false;
      }

      if (item.ingredientId === ingredientId) {
        setSubmitError(`Dòng thứ ${index + 1}: không thể dùng chính bán thành phẩm này làm nguyên liệu.`);
        return false;
      }

      if (selectedIngredientIds.has(item.ingredientId)) {
        setSubmitError(`Dòng thứ ${index + 1}: nguyên liệu bị trùng lặp.`);
        return false;
      }

      selectedIngredientIds.add(item.ingredientId);

      const quantity = Number(item.quantity);
      if (Number.isNaN(quantity) || quantity <= 0) {
        setSubmitError(`Dòng thứ ${index + 1}: số lượng phải lớn hơn 0.`);
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError('');

    const payload = {
      yieldAmount: Number(yieldAmount),
      items: recipeItems.map((item) => ({
        ingredientId: item.ingredientId,
        quantity: Number(item.quantity),
      })),
    };

    try {
      await ingredientApi.updateIngredientRecipe(ingredientId, payload);
      setToastMsg('Lưu công thức thành công.');
    } catch (saveError) {
      setSubmitError(saveError.message || 'Lưu công thức thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
        <p style={{ color: 'var(--color-secondary)', margin: 0 }}>Đang tải công thức...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {submitError && <Alert type="error" message={submitError} onClose={() => setSubmitError('')} />}

      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--color-primary)' }}>Thiết lập công thức</h3>
        <p style={{ marginBottom: '16px', color: 'var(--color-secondary)' }}>
          Quy đổi lượng nguyên liệu thô cần thiết để sản xuất ra một mẻ bán thành phẩm.
        </p>
        
        <div style={{ marginBottom: '24px', maxWidth: '300px' }}>
          <NumberInput
            label="Số lượng bán thành phẩm tạo ra (Yield)"
            value={yieldAmount}
            onChange={(e) => {
              setYieldAmount(e.target.value);
              setSubmitError('');
            }}
            placeholder="VD: 1, 100, 1000..."
            disabled={isSubmitting}
            required
          />
        </div>

        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 40px', 
            gap: '12px', 
            padding: '12px 16px', 
            backgroundColor: 'var(--bg-subtle)', 
            fontWeight: 500,
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div>Nguyên liệu thành phần</div>
            <div>Định lượng cần thiết</div>
            <div></div>
          </div>
          
          {recipeItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-secondary)' }}>
              Chưa có nguyên liệu nào trong công thức.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recipeItems.map((item, index) => {
                const selectedIngredient = ingredients.find(i => String(i.id) === item.ingredientId);
                const unitLabel = selectedIngredient ? selectedIngredient.unit : '';
                
                return (
                  <div key={index} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr 40px', 
                    gap: '12px', 
                    padding: '12px 16px',
                    borderBottom: index < recipeItems.length - 1 ? '1px solid var(--border-color)' : 'none',
                    alignItems: 'start'
                  }}>
                    <SelectInput
                      value={item.ingredientId}
                      onChange={(e) => handleRowChange(index, 'ingredientId', e.target.value)}
                      options={[
                        { value: '', label: 'Chọn nguyên liệu...' },
                        ...ingredients
                          .filter(i => String(i.id) !== ingredientId)
                          .map((i) => ({
                            value: String(i.id),
                            label: `${i.name} (${i.unit})`,
                          })),
                      ]}
                      disabled={isSubmitting}
                    />
                    
                    <div style={{ position: 'relative' }}>
                      <NumberInput
                        value={item.quantity}
                        onChange={(e) => handleRowChange(index, 'quantity', e.target.value)}
                        placeholder="Số lượng..."
                        disabled={isSubmitting}
                      />
                      {unitLabel && (
                        <div style={{ 
                          position: 'absolute', 
                          right: '12px', 
                          top: '10px', 
                          color: 'var(--color-secondary)',
                          fontSize: '14px',
                          pointerEvents: 'none'
                        }}>
                          {unitLabel}
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      variant="danger" 
                      onClick={() => handleRemoveRow(index)} 
                      disabled={isSubmitting}
                      style={{ padding: '8px' }}
                      title="Xóa dòng"
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <Button type="button" variant="secondary" onClick={handleAddRow} disabled={isSubmitting} icon={<Plus size={16} />}>
            Thêm dòng nguyên liệu
          </Button>
          
          <Button type="button" variant="primary" onClick={handleSave} loading={isSubmitting} icon={<Save size={16} />}>
            Lưu công thức
          </Button>
        </div>
      </div>
      
      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />
    </div>
  );
}
