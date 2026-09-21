import React, { useState, useEffect } from 'react';
import { Factory, Save, PackagePlus } from 'lucide-react';
import { ingredientApi } from '../../ingredients/api/ingredientApi.js';
import { stockApi } from '../api/stockApi.js';
import { Button } from '../../../components/common/Button.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { NumberInput } from '../../../components/forms/NumberInput.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';

export function ProducePreparationTab() {
  const [preparations, setPreparations] = useState([]);
  const [selectedPrepId, setSelectedPrepId] = useState('');
  const [produceQty, setProduceQty] = useState('');
  const [note, setNote] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    let isCancelled = false;
    const loadPreps = async () => {
      setIsLoading(true);
      try {
        const res = await ingredientApi.getIngredients();
        if (isCancelled) return;
        
        // Filter only ingredients that are preparations
        const prepList = (res.data.ingredients || []).filter(ing => Boolean(ing.isPreparation));
        setPreparations(prepList);
      } catch (err) {
        if (!isCancelled) setError('Không tải được danh sách bán thành phẩm.');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };
    loadPreps();
    return () => { isCancelled = true; };
  }, []);

  const handleProduceSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedPrepId) {
      setError('Vui lòng chọn bán thành phẩm cần sản xuất.');
      return;
    }

    const qty = Number(produceQty);
    if (Number.isNaN(qty) || qty <= 0) {
      setError('Số lượng sản xuất phải lớn hơn 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await stockApi.producePreparation({
        ingredientId: selectedPrepId,
        quantity: qty,
        note: note || `Sản xuất nội bộ bán thành phẩm`,
      });

      setToastMsg('Sản xuất bán thành phẩm thành công. Đã tự động cập nhật tồn kho.');
      setProduceQty('');
      setNote('');
      setSelectedPrepId('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Sản xuất bán thành phẩm thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPrep = preparations.find(p => String(p.id) === selectedPrepId);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-lg)', alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: '1 1 450px', padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>Sản xuất bán thành phẩm</h3>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-secondary)' }}>
          Ghi nhận mẻ sản xuất nội bộ. Hệ thống sẽ tự động tăng số lượng bán thành phẩm và trừ lượng nguyên liệu thô cấu thành.
        </p>

        {error && <Alert type="error" message={error} onClose={() => setError('')} />}

        <form onSubmit={handleProduceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--color-secondary)' }}>
              Đang tải dữ liệu...
            </div>
          ) : (
            <SelectInput
              label="Chọn bán thành phẩm"
              value={selectedPrepId}
              onChange={(e) => setSelectedPrepId(e.target.value)}
              options={[
                { value: '', label: '-- Chọn bán thành phẩm --' },
                ...preparations.map((p) => ({
                  value: String(p.id),
                  label: `${p.name} (Tồn hiện tại: ${p.currentStock} ${p.unit})`,
                })),
              ]}
              required
              disabled={isSubmitting}
            />
          )}

          <div style={{ position: 'relative' }}>
            <NumberInput
              label="Số lượng sản xuất"
              value={produceQty}
              onChange={(e) => setProduceQty(e.target.value)}
              placeholder="Ví dụ: 10, 50, 100..."
              required
              disabled={isSubmitting}
            />
            {selectedPrep && (
              <div style={{ 
                position: 'absolute', 
                right: '12px', 
                top: '36px', 
                color: 'var(--color-secondary)',
                fontSize: '14px',
                pointerEvents: 'none'
              }}>
                {selectedPrep.unit}
              </div>
            )}
          </div>

          <TextInput
            label="Ghi chú / Mã mẻ sản xuất"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: Nấu mẻ buổi sáng ca 1..."
            disabled={isSubmitting}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button type="submit" variant="primary" loading={isSubmitting} icon={<Factory size={16} />}>
              Sản xuất & Khấu trừ kho
            </Button>
          </div>
        </form>
      </div>

      <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <h4 style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PackagePlus size={18} />
            Cách thức hoạt động
          </h4>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: 'var(--color-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>
              <strong>Tăng tồn kho:</strong> Số lượng bán thành phẩm sẽ được cộng thêm đúng bằng lượng sản xuất.
            </li>
            <li>
              <strong>Trừ nguyên liệu thô:</strong> Hệ thống sẽ tự động tính toán (dựa trên Công thức của bán thành phẩm) lượng nguyên liệu thô cần dùng và trừ kho ngay lập tức.
            </li>
            <li>
              Nếu không đủ nguyên liệu thô trong kho để sản xuất theo công thức, hệ thống sẽ <strong>chặn thao tác</strong> và báo lỗi thiếu nguyên liệu để đảm bảo tính toàn vẹn tồn kho.
            </li>
          </ul>
        </div>
      </div>
      
      <Toast message={toastMsg} type="success" onClose={() => setToastMsg('')} />
    </div>
  );
}
