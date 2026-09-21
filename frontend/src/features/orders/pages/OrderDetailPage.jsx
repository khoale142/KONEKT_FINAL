import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { orderApi } from '../api/orderApi.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { DataTable } from '../../../components/common/DataTable.jsx';
import { StatusBadge } from '../../../components/common/StatusBadge.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { formatVND } from '../../../utils/currency.js';
import { formatDateTime } from '../../../utils/date.js';
import { ROUTES } from '../../../constants/routes.js';
import { TextareaInput } from '../../../components/forms/TextareaInput.jsx';

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

export function OrderDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Refund States
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundAll, setRefundAll] = useState(true);
  const [refundQuantities, setRefundQuantities] = useState({});
  const [refundReason, setRefundReason] = useState('');
  const [returnToStock, setReturnToStock] = useState(true);
  const [refundOperationId, setRefundOperationId] = useState(null);
  const [refundError, setRefundError] = useState('');
  const [isRefundSubmitting, setIsRefundSubmitting] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadOrderDetail = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await orderApi.getOrder(id);

        if (!isCancelled) {
          setOrder(response.data.order || null);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setOrder(null);
          setError(loadError.message || 'Khong tai duoc thong tin don hang.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadOrderDetail();

    return () => {
      isCancelled = true;
    };
  }, [id]);

  const headers = [
    {
      key: 'productName',
      label: 'Ten mon nuoc',
      render: (row) => <strong style={{ color: 'var(--color-primary)' }}>{row.productName}</strong>,
    },
    {
      key: 'unitPrice',
      label: 'Don gia',
      render: (row) => formatVND(row.unitPrice),
    },
    {
      key: 'quantity',
      label: 'Số lượng',
      render: (row) => (
        <span>
          {row.quantity}
          {row.refundedQuantity > 0 && (
            <span style={{ color: 'var(--color-error)', marginLeft: '8px', fontSize: '12px', fontWeight: 'bold' }}>
              (Đã hoàn: {row.refundedQuantity})
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'subtotal',
      label: 'Thanh tien',
      render: (row) => formatVND(row.subtotal),
    },
  ];

  const goBack = () => {
    navigate(ROUTES.STORE_ORDERS);
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    setRefundError('');
    if (!refundReason.trim()) {
      setRefundError('Vui lòng nhập lý do hoàn tiền.');
      return;
    }

    const operationId = refundOperationId || crypto.randomUUID();
    setRefundOperationId(operationId);
    const payload = {
      refundAll,
      returnToStock,
      reason: refundReason.trim(),
      operationId,
    };

    if (!refundAll) {
      const items = Object.entries(refundQuantities)
        .map(([orderItemId, quantity]) => ({
          orderItemId,
          refundQuantity: Number(quantity),
        }))
        .filter((item) => item.refundQuantity > 0);

      if (items.length === 0) {
        setRefundError('Vui lòng chọn ít nhất một sản phẩm và nhập số lượng hoàn.');
        return;
      }
      payload.items = items;
    }

    setIsRefundSubmitting(true);
    try {
      const response = await orderApi.refundOrder(id, payload);
      setOrder(response.data.order);
      setIsRefundModalOpen(false);
      setRefundReason('');
      setRefundQuantities({});
      setRefundAll(true);
      setRefundOperationId(null);
    } catch (err) {
      setRefundError(err.message || 'Hoàn tiền thất bại.');
    } finally {
      setIsRefundSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title={order ? `Chi tiết đơn hàng #${order.orderCode}` : 'Thông tin chi tiết đơn hàng'}
        description="Xem lại sản phẩm, snapshot giá và thông tin thanh toán của đơn hàng."
        actions={
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <Button variant="secondary" onClick={goBack} icon={<ArrowLeft size={16} />}>
              Quay lại lịch sử
            </Button>
            {order && order.status !== 'REFUNDED' && (
              <Button variant="primary" onClick={() => setIsRefundModalOpen(true)}>
                Hoàn tiền
              </Button>
            )}
          </div>
        }
      />

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
          <p style={{ color: 'var(--color-secondary)', margin: 0 }}>Dang tai thong tin don hang...</p>
        </div>
      ) : order ? (
        <div className="responsive-split-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-primary)', margin: 0, marginBottom: '16px' }}>
                Danh sach mon da ban
              </h3>
              <DataTable headers={headers} data={order.items || []} loading={false} />
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3
              style={{
                fontSize: '15px',
                fontWeight: '700',
                color: 'var(--color-primary)',
                borderBottom: '1px solid var(--color-outline-variant)',
                paddingBottom: '12px',
                margin: 0,
              }}
            >
              Thong tin thanh toan
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary)' }}>Ma don hang</span>
                <strong style={{ color: 'var(--color-on-background)' }}>#{order.orderCode}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary)' }}>Thoi gian tao</span>
                <span style={{ color: 'var(--color-on-background)' }}>{formatDateTime(order.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary)' }}>Thoi gian thanh toan</span>
                <span style={{ color: 'var(--color-on-background)' }}>
                  {order.paidAt ? formatDateTime(order.paidAt) : '--'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary)' }}>Thu ngan thuc hien</span>
                <span style={{ color: 'var(--color-on-background)', textTransform: 'capitalize' }}>
                  {order.staffUsername || 'Staff'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary)' }}>Phuong thuc</span>
                <span style={{ color: 'var(--color-on-background)' }}>
                  {getPaymentMethodLabel(order.paymentMethod)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary)' }}>Khach dua</span>
                <span style={{ color: 'var(--color-on-background)' }}>
                  {order.amountReceived === null ? '--' : formatVND(order.amountReceived)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary)' }}>Tien thoi</span>
                <span style={{ color: 'var(--color-on-background)' }}>
                  {order.changeAmount === null ? '--' : formatVND(order.changeAmount)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-secondary)' }}>Trang thai don</span>
                <StatusBadge status={order.status} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-secondary)' }}>Trang thai KDS</span>
                <StatusBadge
                  status={getKdsStatusVariant(order.kdsStatus)}
                  customLabel={getKdsStatusLabel(order.kdsStatus)}
                />
              </div>
              {order.note ? (
                <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '12px' }}>
                  <div
                    style={{
                      color: 'var(--color-secondary)',
                      fontSize: '12px',
                      marginBottom: '6px',
                    }}
                  >
                    Ghi chu
                  </div>
                  <div style={{ color: 'var(--color-on-background)', lineHeight: 1.5 }}>
                    {order.note}
                  </div>
                </div>
              ) : null}
              {order.refundedAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-error)', fontWeight: 'bold' }}>
                  <span>Tiền đã hoàn trả</span>
                  <span>-{formatVND(order.refundedAmount)}</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--color-outline-variant)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)' }}>Tổng cộng (Net)</span>
                <strong style={{ fontSize: '18px', color: 'var(--color-tertiary-container)' }}>
                  {formatVND(order.totalAmount - order.refundedAmount)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isRefundModalOpen && order && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setIsRefundModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>
                Yêu cầu hoàn tiền đơn #{order.orderCode}
              </h3>
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                X
              </button>
            </div>
            <form onSubmit={handleRefundSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
                {refundError && <Alert type="error" message={refundError} onClose={() => setRefundError('')} />}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontWeight: '600', fontSize: '14px' }}>Hình thức hoàn tiền:</label>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="refundType"
                        checked={refundAll}
                        onChange={() => setRefundAll(true)}
                      />
                      Hoàn tiền toàn bộ đơn
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="refundType"
                        checked={!refundAll}
                        onChange={() => setRefundAll(false)}
                      />
                      Hoàn tiền theo món
                    </label>
                  </div>
                </div>

                {!refundAll && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--color-surface-container-low)', padding: '12px', borderRadius: '8px' }}>
                    <span style={{ fontWeight: '600', fontSize: '13px' }}>Danh sách sản phẩm được hoàn:</span>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-outline-variant)', textAlign: 'left' }}>
                          <th style={{ padding: '6px 0' }}>Tên món</th>
                          <th style={{ padding: '6px 0', textAlign: 'center' }}>Chưa hoàn / Mua</th>
                          <th style={{ padding: '6px 0', textAlign: 'right', width: '120px' }}>Số lượng hoàn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => {
                          const remaining = item.quantity - item.refundedQuantity;
                          if (remaining <= 0) return null;
                          return (
                            <tr key={item.id} style={{ borderBottom: '1px dashed var(--color-outline-variant)' }}>
                              <td style={{ padding: '8px 0' }}><strong>{item.productName}</strong></td>
                              <td style={{ padding: '8px 0', textAlign: 'center' }}>
                                {remaining} / {item.quantity}
                              </td>
                              <td style={{ padding: '8px 0', textAlign: 'right' }}>
                                <input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  value={refundQuantities[item.id] !== undefined ? refundQuantities[item.id] : ''}
                                  onChange={(e) => {
                                    const rawVal = e.target.value;
                                    if (rawVal === '') {
                                      setRefundQuantities(prev => ({
                                        ...prev,
                                        [item.id]: ''
                                      }));
                                      return;
                                    }
                                    const val = Math.min(remaining, Math.max(0, parseInt(rawVal) || 0));
                                    setRefundQuantities(prev => ({
                                      ...prev,
                                      [item.id]: val
                                    }));
                                  }}
                                  style={{
                                    width: '60px',
                                    textAlign: 'center',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--color-outline)'
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    id="returnToStock"
                    checked={returnToStock}
                    onChange={(e) => setReturnToStock(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="returnToStock" style={{ cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                    Hoàn trả nguyên vật liệu về kho (Tự động cộng lại theo công thức món)
                  </label>
                </div>

                <TextareaInput
                  label="Lý do hoàn tiền *"
                  name="refundReason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Ví dụ: Khách đổi ý, pha chế sai công thức, đồ uống bị lỗi..."
                  required
                  rows={2}
                  maxLength={255}
                />
              </div>
              <div className="modal-footer">
                <Button variant="secondary" type="button" onClick={() => setIsRefundModalOpen(false)}>
                  Hủy bỏ
                </Button>
                <Button variant="primary" type="submit" loading={isRefundSubmitting}>
                  Xác nhận hoàn tiền
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderDetailPage;
