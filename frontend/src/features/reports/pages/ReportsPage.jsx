import { useEffect, useState } from 'react';
import { AlertTriangle, Coffee, RotateCcw, TrendingUp, Trash } from 'lucide-react';
import { reportApi } from '../api/reportApi.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { DataTable } from '../../../components/common/DataTable.jsx';
import { StatusBadge } from '../../../components/common/StatusBadge.jsx';
import { Card } from '../../../components/common/Card.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { formatVND } from '../../../utils/currency.js';
import { formatDate, formatDateTime } from '../../../utils/date.js';

export function ReportsPage() {
  const [revenueData, setRevenueData] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [discards, setDiscards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReportsData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [revenueResponse, bestSellingResponse, lowStockResponse, discardsResponse] = await Promise.all([
        reportApi.getRevenueReport(),
        reportApi.getBestSellingProducts(),
        reportApi.getLowStockIngredients(),
        reportApi.getDiscardsReport(),
      ]);

      setRevenueData(revenueResponse.data?.items || (Array.isArray(revenueResponse.data) ? revenueResponse.data : []));
      setBestSellers(bestSellingResponse.data?.items || (Array.isArray(bestSellingResponse.data) ? bestSellingResponse.data : []));
      setLowStock(lowStockResponse.data?.items || (Array.isArray(lowStockResponse.data) ? lowStockResponse.data : []));
      setDiscards(discardsResponse.data?.items || (Array.isArray(discardsResponse.data) ? discardsResponse.data : []));
    } catch (loadError) {
      setRevenueData([]);
      setBestSellers([]);
      setLowStock([]);
      setDiscards([]);
      setError(loadError.message || 'Không tải được dữ liệu báo cáo.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    void loadReportsData();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const totalRevenueSum = revenueData.reduce(
    (sum, item) => sum + Number(item.totalRevenue || 0),
    0,
  );
  const totalOrdersSum = revenueData.reduce(
    (sum, item) => sum + Number(item.totalOrders || 0),
    0,
  );
  const totalRefundedSum = revenueData.reduce(
    (sum, item) => sum + Number(item.totalRefunded || 0),
    0,
  );

  const revenueHeaders = [
    {
      key: 'orderDate',
      label: 'Ngày giao dịch',
      render: (row) => formatDate(row.orderDate),
    },
    { key: 'totalOrders', label: 'Số lượng đơn' },
    {
      key: 'totalRefunded',
      label: 'Tiền đã hoàn',
      render: (row) => <span style={{ color: 'var(--color-error)' }}>{formatVND(row.totalRefunded || 0)}</span>,
    },
    {
      key: 'totalRevenue',
      label: 'Doanh thu thực (Net)',
      render: (row) => <strong>{formatVND(row.totalRevenue)}</strong>,
    },
  ];

  const sellerHeaders = [
    {
      key: 'productName',
      label: 'Tên sản phẩm',
      render: (row) => (
        <strong style={{ color: 'var(--color-primary)' }}>{row.productName}</strong>
      ),
    },
    {
      key: 'quantitySold',
      label: 'Số lượng bán ra',
      render: (row) => `${row.quantitySold} ly`,
    },
    {
      key: 'totalRevenue',
      label: 'Doanh thu thu về',
      render: (row) => formatVND(row.totalRevenue || 0),
    },
  ];

  const stockHeaders = [
    {
      key: 'name',
      label: 'Tên nguyên liệu',
      render: (row) => <strong style={{ color: 'var(--color-error)' }}>{row.name}</strong>,
    },
    {
      key: 'currentStock',
      label: 'Hiện có',
      render: (row) => `${row.currentStock} ${row.unit}`,
    },
    {
      key: 'lowStockThreshold',
      label: 'Ngưỡng cảnh báo',
      render: (row) => `${row.lowStockThreshold} ${row.unit}`,
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: () => <StatusBadge status="WARNING" customLabel="Sắp hết hàng" />,
    },
  ];

  const discardHeaders = [
    {
      key: 'createdAt',
      label: 'Thời gian',
      style: { width: '180px', whiteSpace: 'nowrap' },
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: 'ingredientName',
      label: 'Nguyên liệu hao phí',
      style: { minWidth: '180px' },
      render: (row) => <strong style={{ color: 'var(--color-primary)' }}>{row.ingredientName}</strong>,
    },
    {
      key: 'quantity',
      label: 'Lượng hủy',
      style: { width: '120px', textAlign: 'right', whiteSpace: 'nowrap' },
      render: (row) => (
        <strong style={{ color: 'var(--color-error)' }}>
          -{row.quantity} {row.unit}
        </strong>
      ),
    },
    {
      key: 'creatorName',
      label: 'Người thực hiện',
      style: { width: '150px' },
    },
    {
      key: 'note',
      label: 'Chi tiết hủy hàng',
      render: (row) => (row.note || '').replace('[HỦY HÀNG] ', ''),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title="Báo cáo & Thống kê"
        description="Theo dõi doanh thu bán hàng thực tế và cảnh báo tồn kho nguyên vật liệu."
        actions={
          <Button
            variant="secondary"
            onClick={() => void loadReportsData()}
            disabled={isLoading}
            icon={<RotateCcw size={16} />}
          >
            Tải lại
          </Button>
        }
      />

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--spacing-md)',
        }}
      >
        <Card
          title="Doanh thu thực tế (Net)"
          value={formatVND(totalRevenueSum)}
          subtext={`Lũy kế trên ${totalOrdersSum} đơn (Đã trừ ${formatVND(totalRefundedSum)} hoàn trả)`}
          icon={<TrendingUp size={24} />}
          loading={isLoading}
        />
        <Card
          title="Món nước bán chạy hàng đầu"
          value={bestSellers[0]?.productName || 'Chưa có'}
          subtext={
            bestSellers[0]
              ? `Đã bán được ${bestSellers[0].quantitySold} ly`
              : 'Chưa có dữ liệu'
          }
          icon={<Coffee size={24} />}
          loading={isLoading}
        />
        <Card
          title="Cảnh báo nguyên liệu"
          value={`${lowStock.length} loại`}
          subtext="Nguyên liệu đang dưới mức tồn an toàn"
          icon={<AlertTriangle size={24} />}
          loading={isLoading}
          style={{
            borderLeft:
              lowStock.length > 0
                ? '4px solid var(--color-error)'
                : '1px solid var(--color-outline-variant)',
          }}
        />
        <Card
          title="Hao hụt & Hủy hàng"
          value={`${discards.length} lượt`}
          subtext="Số lần ghi nhận hủy nguyên liệu/thành phẩm"
          icon={<Trash size={24} />}
          loading={isLoading}
          style={{
            borderLeft:
              discards.length > 0
                ? '4px solid var(--color-warning)'
                : '1px solid var(--color-outline-variant)',
          }}
        />
      </div>

      <div className="responsive-grid-2col" style={{ marginTop: '8px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: '700',
              color: 'var(--color-primary)',
              margin: 0,
            }}
          >
            Doanh thu theo ngày
          </h3>
          <DataTable
            headers={revenueHeaders}
            data={revenueData}
            loading={isLoading}
            emptyMessage="Chưa có dữ liệu doanh thu hàng ngày."
          />
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: '700',
              color: 'var(--color-primary)',
              margin: 0,
            }}
          >
            Sản phẩm bán chạy nhất
          </h3>
          <DataTable
            headers={sellerHeaders}
            data={bestSellers}
            loading={isLoading}
            emptyMessage="Chưa có dữ liệu sản phẩm bán chạy."
          />
        </div>
      </div>

      <div
        className="card"
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} style={{ color: 'var(--color-error)' }} />
          <h3
            style={{
              fontSize: '15px',
              fontWeight: '700',
              color: 'var(--color-primary)',
              margin: 0,
            }}
          >
            Nguyên vật liệu dưới ngưỡng an toàn (Cần nhập kho gấp)
          </h3>
        </div>
        <DataTable
          headers={stockHeaders}
          data={lowStock}
          loading={isLoading}
          emptyMessage="Tuyệt vời! Tất cả nguyên liệu đều ở mức tồn kho an toàn."
        />
      </div>
      <div
        className="card"
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trash size={18} style={{ color: 'var(--color-error)' }} />
          <h3
            style={{
              fontSize: '15px',
              fontWeight: '700',
              color: 'var(--color-primary)',
              margin: 0,
            }}
          >
            Nhật ký hủy hàng & Thất thoát gần nhất
          </h3>
        </div>
        <DataTable
          headers={discardHeaders}
          data={discards}
          loading={isLoading}
          emptyMessage="Chưa ghi nhận bất kỳ giao dịch hủy hàng hay thất thoát nào."
        />
      </div>
    </div>
  );
}

export default ReportsPage;
