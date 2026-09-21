import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/common/Modal.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { NumberInput } from '../../../components/forms/NumberInput.jsx';
import { ingredientApi } from '../../ingredients/api/ingredientApi.js';
import { Trash2, Search, Check, Plus, X } from 'lucide-react';

export function RecipeMatrixModal({ isOpen, onClose, onApply, initialData, mode = 'PRODUCT' }) {
  const [sizes, setSizes] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [search, setSearch] = useState('');
  const isPreparation = mode === 'PREPARATION';
  const isRecipeOnly = mode === 'RECIPE_ONLY';
  const isSingleRecipe = isPreparation || isRecipeOnly;

  useEffect(() => {
    if (isOpen) {
      if (isSingleRecipe) {
        setSizes([{
          id: 'preparation-recipe',
          recipeItems: Array.isArray(initialData?.recipeItems) ? JSON.parse(JSON.stringify(initialData.recipeItems)) : [],
        }]);
      } else if (Array.isArray(initialData) && initialData.length > 0) {
        setSizes(JSON.parse(JSON.stringify(initialData)));
      } else {
        setSizes([{ id: Date.now().toString(), sizeName: mode === 'PRODUCT' ? 'Mặc định' : '', price: 0, yieldAmount: 1, recipeItems: [] }]);
      }
      loadIngredients();
    }
  }, [isOpen, initialData, mode, isSingleRecipe]);

  const loadIngredients = async () => {
    try {
      const response = await ingredientApi.getIngredients();
      setAvailableIngredients(response.data.ingredients || []);
    } catch (err) {
      console.error('Failed to load ingredients', err);
    }
  };

  const filteredIngredients = useMemo(() => {
    return availableIngredients.filter((i) =>
      i.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [availableIngredients, search]);

  const allSelectedIngredientIds = useMemo(() => {
    const ids = new Set();
    sizes.forEach(s => s.recipeItems.forEach(ri => ids.add(ri.ingredientId)));
    return Array.from(ids);
  }, [sizes]);

  const selectedIngredientsDetails = useMemo(() => {
    return allSelectedIngredientIds.map(id => {
      const ing = availableIngredients.find(i => i.id === id);
      return {
        id,
        name: ing ? ing.name : 'Unknown',
        unit: ing ? ing.unit : '',
      };
    });
  }, [allSelectedIngredientIds, availableIngredients]);

  const handleAddSize = () => {
    const newSize = {
      id: Date.now().toString(),
      sizeName: '',
      price: 0,
      yieldAmount: 1,
      recipeItems: allSelectedIngredientIds.map(id => ({ ingredientId: id, quantity: 0 }))
    };
    setSizes([...sizes, newSize]);
  };

  const handleRemoveSize = (idToRemove) => {
    if (sizes.length <= 1) return;
    setSizes(sizes.filter(s => s.id !== idToRemove));
  };

  const handleToggleIngredient = (ingredientId) => {
    const isSelected = allSelectedIngredientIds.includes(ingredientId);
    
    if (isSelected) {
      // Remove from all sizes
      setSizes(sizes.map(size => ({
        ...size,
        recipeItems: size.recipeItems.filter(ri => ri.ingredientId !== ingredientId)
      })));
    } else {
      // Add to all sizes with 0 quantity
      setSizes(sizes.map(size => ({
        ...size,
        recipeItems: [...size.recipeItems, { ingredientId, quantity: 0 }]
      })));
    }
  };

  const handleChangeQuantity = (sizeId, ingredientId, quantity) => {
    setSizes(sizes.map(size => {
      if (size.id !== sizeId) return size;
      return {
        ...size,
        recipeItems: size.recipeItems.map(ri => 
          ri.ingredientId === ingredientId ? { ...ri, quantity: Number(quantity) } : ri
        )
      };
    }));
  };

  const handleChangeSizeField = (sizeId, field, value) => {
    setSizes(sizes.map(size => size.id === sizeId ? { ...size, [field]: value } : size));
  };

  const handleApply = () => {
    // Clean up empty sizes or quantities
    const cleaned = sizes.map(size => ({
      ...size,
      recipeItems: size.recipeItems.map((ri) => ({ ...ri, quantity: Number(ri.quantity) || 0 }))
    }));
    if (isSingleRecipe) {
      onApply({
        recipeItems: cleaned[0]?.recipeItems || [],
      });
      return;
    }
    onApply(cleaned);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Công thức thành phần" size="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '70vh' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', height: 'calc(100% - 60px)' }}>
          {/* Left side: Matrix */}
          <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--color-outline-variant)', borderRadius: '12px', overflow: 'hidden', background: 'var(--color-surface-container-low)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface-container-high)' }}>
              <h3 style={{ fontWeight: 600, color: 'var(--color-primary)', margin: 0, fontSize: '15px' }}>Thành phần đã chọn</h3>
              {mode === 'PRODUCT' && (
                <Button onClick={handleAddSize} variant="secondary" size="sm">
                  <Plus size={14} style={{ marginRight: '4px' }} />
                  Thêm size
                </Button>
              )}
            </div>
            
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
              {allSelectedIngredientIds.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-secondary)' }}>
                  Chưa có thành phần nào
                </div>
              ) : (
                <div style={{ minWidth: 'max-content' }}>
                  {/* Header Row */}
                  {!isSingleRecipe && <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'flex-end' }}>
                    <div style={{ width: '192px', flexShrink: 0 }}></div>
                    {sizes.map((size) => (
                      <div key={size.id} style={{ width: '128px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: isPreparation ? 'none' : 'flex', alignItems: 'center', gap: '8px' }}>
                          <TextInput 
                            value={size.sizeName}
                            onChange={(e) => handleChangeSizeField(size.id, 'sizeName', e.target.value)}
                            placeholder="Tên Size"
                          />
                          {sizes.length > 1 && (
                            <button onClick={() => handleRemoveSize(size.id)} style={{ color: 'var(--color-error)', opacity: 0.7, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <X size={16} />
                            </button>
                          )}
                        </div>
                        {mode === 'PRODUCT' ? (
                          <NumberInput 
                            value={size.price}
                            onChange={(event) => handleChangeSizeField(size.id, 'price', event.target.value)}
                            placeholder="Giá bán"
                          />
                        ) : (
                          <NumberInput 
                            value={size.yieldAmount}
                            onChange={(event) => handleChangeSizeField(size.id, 'yieldAmount', event.target.value)}
                            placeholder="SL thu được"
                          />
                        )}
                      </div>
                    ))}
                  </div>}

                  {/* Ingredient Rows */}
                  {selectedIngredientsDetails.map(ing => (
                    <div key={ing.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--color-outline-variant)' }}>
                      <div style={{ width: '192px', flexShrink: 0, fontWeight: 500, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ing.name}>{ing.name}</span>
                        <button onClick={() => handleToggleIngredient(ing.id)} style={{ color: 'var(--color-error)', opacity: 0.5, padding: '4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {sizes.map(size => {
                        const item = size.recipeItems.find(ri => ri.ingredientId === ing.id);
                        return (
                          <div key={size.id} style={{ width: '128px', flexShrink: 0, position: 'relative' }}>
                            <NumberInput
                              value={item?.quantity || 0}
                              onChange={(event) => handleChangeQuantity(size.id, ing.id, event.target.value)}
                              placeholder="0"
                            />
                            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--color-secondary)', pointerEvents: 'none' }}>
                              {ing.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right side: Ingredients Picker */}
          <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--color-outline-variant)', borderRadius: '12px', overflow: 'hidden', background: 'var(--color-surface-container-low)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)' }}>
              <h3 style={{ fontWeight: 600, color: 'var(--color-primary)', margin: '0 0 12px 0', fontSize: '15px' }}>Thêm thành phần</h3>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-secondary)' }}>
                  <Search size={16} />
                </div>
                <TextInput 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm nguyên liệu..."
                  style={{ paddingLeft: '32px' }}
                />
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {filteredIngredients.map(ing => {
                const isSelected = allSelectedIngredientIds.includes(ing.id);
                return (
                  <div 
                    key={ing.id} 
                    onClick={() => handleToggleIngredient(ing.id)}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s', marginBottom: '4px',
                      background: isSelected ? 'var(--color-primary-container)' : 'transparent',
                      border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, color: isSelected ? 'var(--color-primary)' : 'var(--color-primary)' }}>
                        {ing.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                        {ing.category?.name || 'Nguyên liệu'} • {ing.unit}
                      </div>
                    </div>
                    <div style={{ 
                      width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: isSelected ? '2px solid var(--color-primary)' : '2px solid var(--color-outline)',
                      background: isSelected ? 'var(--color-primary)' : 'transparent'
                    }}>
                      {isSelected && <Check size={14} color="var(--color-on-primary)" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button onClick={onClose} variant="secondary">
            Hủy bỏ
          </Button>
          <Button onClick={handleApply} variant="primary">
            Áp dụng
          </Button>
        </div>
      </div>
    </Modal>
  );
}
