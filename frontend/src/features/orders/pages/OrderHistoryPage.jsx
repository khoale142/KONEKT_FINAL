import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, RotateCcw } from 'lucide-react';
import { orderApi } from '../api/orderApi.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { DataTable } from '../../../components/common/DataTable.jsx';
import { StatusBadge } from '../../../components/common/StatusBadge.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { formatVND } from '../../../utils/currency.js';
import { formatDateTime } from '../../../utils/date.js';

function getPaymentMethodLabel(paymentMethod) {
  if (paymentMethod === 'CASH') {
    return 'Tiền mặt';
  }
  if (paymentMethod === 'QR') {
    return 'Chuyển khoản (VietQR)';
  }

  return paymentMethod || '--';
}

function getKdsStatusLabel(kdsStatus) {
  return kdsStatus === 'COMPLETED' ? 'Da hoan thanh' : 'Don moi';
}

function getKdsStatusVariant(kdsStatus) {
  return kdsStatus === 'COMPLETED' ? 'SUCCESS' : 'WARNING';
}

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    const loadOrders = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await orderApi.getOrders();

        if (!isCancelled) {
          setOrders(response.data.orders || []);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setOrders([]);
          setError(loadError.message || 'Khong tai duoc lich su don hang.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadOrders();

    return () => {
      isCancelled = true;
    };
  }, [reloadNonce]);

  const headers = [
    {
      key: 'orderCode',
      label: 'Ma don hang',
      render: (row) => <strong style={{ color: 'var(--color-primary)' }}>#{row.orderCode}</strong>,
    },
    {
      key: 'staffUsername',
      label: 'Nhan vien ban hang',
      render: (row) => row.staffUsername || 'Staff',
    },
    {
      key: 'totalAmount',
      label: 'Tong thanh toan',
      render: (row) => formatVND(row.totalAmount),
    },
    {
      key: 'paymentMethod',
      label: 'Thanh toan',
      render: (row) => getPaymentMethodLabel(row.paymentMethod),
    },
    {
      key: 'amountReceived',
      label: 'Khach dua',
      render: (row) => (row.amountReceived === null ? '--' : formatVND(row.amountReceived)),
    },
    {
      key: 'changeAmount',
      label: 'Tien thoi',
      render: (row) => (row.changeAmount === null ? '--' : formatVND(row.changeAmount)),
    },
    {
      key: 'kdsStatus',
      label: 'KDS',
      render: (row) => (
        <StatusBadge
          status={getKdsStatusVariant(row.kdsStatus)}
          customLabel={getKdsStatusLabel(row.kdsStatus)}
        />
      ),
    },
    {
      key: 'createdAt',
      label: 'Ngay ban',
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'actions',
      label: 'Chi tiet',
      style: { width: '80px', textAlign: 'right' },
      render: (row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => navigate(`/store/orders/${row.id}`)}
            title="Xem chi tiet don hang"
            style={{ color: 'var(--color-primary)', display: 'flex', padding: 0 }}
          >
            <Eye size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title="Lich su don hang"
        description="Tra cuu cac don hang thanh cong cua nhan vien hien tai."
        actions={
          <Button
            variant="secondary"
            onClick={() => setReloadNonce((current) => current + 1)}
            disabled={isLoading}
            icon={<RotateCcw size={16} />}
          >
            Tai lai
          </Button>
        }
      />

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <DataTable
        headers={headers}
        data={orders}
        loading={isLoading}
        emptyMessage="Chua co don hang thanh cong nao."
        style={{ minWidth: '1120px' }}
      />
    </div>
  );
}

export default OrderHistoryPage;
