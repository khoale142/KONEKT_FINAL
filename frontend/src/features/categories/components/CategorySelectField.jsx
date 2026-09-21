import { useState } from 'react';
import { Plus } from 'lucide-react';
import { categoryApi } from '../api/categoryApi.js';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';

export function CategorySelectField({ value, onChange, categories, onCategoryCreated, scope, disabled = false }) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options = [
    { value: '', label: 'Chưa phân loại' },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ];

  const createCategory = async (event) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError('Tên danh mục là bắt buộc.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const response = await categoryApi.createCategory({ name: normalizedName, scope });
      const category = response.data.category;
      onCategoryCreated(category);
      onChange({ target: { name: 'categoryId', value: category.id } });
      setName('');
      setIsCreating(false);
    } catch (createError) {
      setError(createError.message || 'Không thể tạo danh mục.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <SelectInput
        label="Danh mục"
        name="categoryId"
        value={value || ''}
        onChange={onChange}
        options={options}
        disabled={disabled || isSubmitting}
      />
      {!isCreating ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => setIsCreating(true)} disabled={disabled} icon={<Plus size={14} />}>
          Tạo danh mục mới
        </Button>
      ) : (
        <form onSubmit={createCategory} className="card" style={{ marginTop: '10px', padding: '12px', display: 'grid', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <TextInput label="Tên danh mục mới" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} disabled={isSubmitting} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
            <Button type="button" variant="secondary" size="sm" onClick={() => { setIsCreating(false); setError(''); }} disabled={isSubmitting}>Hủy</Button>
            <Button type="submit" size="sm" loading={isSubmitting}>Tạo</Button>
          </div>
          {error && <div style={{ width: '100%' }}><Alert type="error" message={error} onClose={() => setError('')} /></div>}
        </form>
      )}
    </div>
  );
}

export default CategorySelectField;
