import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, RotateCcw, ShoppingCart, Trash, X } from 'lucide-react';
import { posApi } from '../api/posApi.js';
import { posSessionApi } from '../api/posSessionApi.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { TextareaInput } from '../../../components/forms/TextareaInput.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { DEFAULT_PRODUCT_TAG, PRODUCT_TAG_SUGGESTIONS } from '../../../constants/productTags.js';
import { formatVND, parseVND } from '../../../utils/currency.js';
import { formatDateTime } from '../../../utils/date.js';

const ALL_TAGS_VALUE = 'ALL';
const PAYMENT_METHOD = 'CASH';
const PAYMENT_METHOD_LABEL = 'Tiền mặt';
function getQuickCashSuggestions(totalAmount) {
  if (!totalAmount || totalAmount <= 0) return [];
  
  const suggestions = new Set();
  
  // 1. Suggest exact amount
  suggestions.add(totalAmount);
  
  // 2. Suggest round up to next 10k (only if total < 50k)
  if (totalAmount < 50000) {
    suggestions.add(Math.ceil(totalAmount / 10000) * 10000);
  }
  
  // 3. Suggest round up to next 50k (only if total < 200k)
  if (totalAmount < 200000) {
    suggestions.add(Math.ceil(totalAmount / 50000) * 50000);
  }
  
  // 4. Suggest round up to next 100k
  suggestions.add(Math.ceil(totalAmount / 100000) * 100000);
  
  // 5. Suggest standard larger VND bills
  const standardBills = [20000, 50000, 100000, 200000, 500000];
  standardBills.forEach(bill => {
    if (bill > totalAmount) {
      suggestions.add(bill);
    }
  });
  
  // Return sorted suggestions array
  return Array.from(suggestions)
    .sort((a, b) => a - b)
    .slice(0, 4); // Limit to max 4 options
}

function normalizeProductTag(tag) {
  const normalizedTag = String(tag ?? '').trim();
  return normalizedTag || DEFAULT_PRODUCT_TAG;
}

function buildProductTagOptions(products) {
  const discoveredTags = Array.from(
    new Set(products.map((product) => normalizeProductTag(product.tag))),
  );
  const orderedTags = [
    ...PRODUCT_TAG_SUGGESTIONS.filter((tag) => discoveredTags.includes(tag)),
    ...discoveredTags
      .filter((tag) => !PRODUCT_TAG_SUGGESTIONS.includes(tag))
      .sort((left, right) => left.localeCompare(right, 'vi')),
  ];

  return [ALL_TAGS_VALUE, ...orderedTags];
}

function getOrderItemName(item) {
  return item.productName || item.name || 'Sản phẩm';
}

function getOrderItemUnitPrice(item) {
  return Number(item.unitPrice ?? item.price ?? 0);
}

function getOrderItemSubtotal(item) {
  if (item.subtotal !== undefined && item.subtotal !== null) {
    return Number(item.subtotal);
  }

  return getOrderItemUnitPrice(item) * Number(item.quantity || 0);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function OrderItemsTable({ items, compact = false }) {
  return (
    <div className="table-container">
      <table className="data-table" style={{ minWidth: compact ? '100%' : '640px' }}>
        <thead>
          <tr>
            <th style={{ minWidth: '220px' }}>Món</th>
            <th style={{ width: '120px', textAlign: 'right' }}>Đơn giá</th>
            <th style={{ width: '96px', textAlign: 'center' }}>SL</th>
            <th style={{ width: '140px', textAlign: 'right' }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id || `${getOrderItemName(item)}-${index}`}>
              <td>
                <strong style={{ color: 'var(--color-primary)' }}>{getOrderItemName(item)}</strong>
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {formatVND(getOrderItemUnitPrice(item))}
              </td>
              <td style={{ textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {formatVND(getOrderItemSubtotal(item))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CheckoutConfirmModal({
  isOpen,
  items,
  totalAmount,
  amountReceived,
  setAmountReceived,
  amountReceivedInputValue,
  onAmountReceivedChange,
  changeAmount,
  note,
  setNote,
  loading,
  onCancel,
  onConfirm,
  paymentMethod,
  setPaymentMethod,
  qrMemo,
  vietqrConfig,
  canConfirm,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onCancel} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        style={{ maxWidth: '860px', width: '100%', display: 'flex', flexDirection: 'column' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>
            Thực hiện thanh toán đơn hàng
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{ color: 'var(--color-secondary)', display: 'flex', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Đóng thanh toán"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxHeight: '75vh', overflowY: 'auto', padding: '20px' }}>
          
          {/* COLUMN 1: ORDER ITEMS TABLE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)', margin: 0, borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
              Danh sách món nước ({items.length})
            </h4>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <OrderItemsTable items={items} compact={true} />
            </div>
            
            <div style={{ marginTop: 'auto', padding: '14px', borderRadius: 'var(--radius-default)', backgroundColor: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-secondary)', marginBottom: '6px' }}>
                <span>Tạm tính:</span>
                <span>{formatVND(totalAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '700', color: 'var(--color-primary)' }}>
                <span>Tổng thanh toán:</span>
                <span style={{ color: 'var(--color-tertiary-container)' }}>{formatVND(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* COLUMN 2: PAYMENT METHOD AND DETAILS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)', margin: 0, borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
              Chọn phương thức thanh toán
            </h4>

            {/* Payment Method Selector */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 'var(--radius-default)',
                  border: '2px solid ' + (paymentMethod === 'CASH' ? 'var(--color-primary)' : 'var(--color-outline)'),
                  backgroundColor: paymentMethod === 'CASH' ? 'var(--color-primary-container)' : 'transparent',
                  color: paymentMethod === 'CASH' ? 'var(--color-primary)' : 'var(--color-secondary)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Tiền mặt
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('QR')}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 'var(--radius-default)',
                  border: '2px solid ' + (paymentMethod === 'QR' ? 'var(--color-primary)' : 'var(--color-outline)'),
                  backgroundColor: paymentMethod === 'QR' ? 'var(--color-primary-container)' : 'transparent',
                  color: paymentMethod === 'QR' ? 'var(--color-primary)' : 'var(--color-secondary)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                VietQR
              </button>
            </div>

            {/* Render details based on Payment Method */}
            {paymentMethod === 'CASH' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* 2x2 Cash suggestions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '4px' }}>
                  {getQuickCashSuggestions(totalAmount).map((quickAmount) => {
                    const isExact = quickAmount === totalAmount;
                    return (
                      <Button
                        key={quickAmount}
                        size="sm"
                        variant={amountReceived === quickAmount ? 'primary' : 'secondary'}
                        onClick={() => {
                          setAmountReceived(quickAmount);
                        }}
                        disabled={loading || totalAmount <= 0}
                        style={{ width: '100%', whiteSpace: 'nowrap' }}
                      >
                        {isExact ? `Đúng ${formatVND(quickAmount)}` : formatVND(quickAmount)}
                      </Button>
                    );
                  })}
                </div>

                <TextInput
                  label="Tiền mặt khách đưa *"
                  name="amountReceived"
                  value={amountReceivedInputValue}
                  onChange={onAmountReceivedChange}
                  placeholder="Nhập số tiền khách đưa"
                  disabled={loading}
                  required
                  inputMode="numeric"
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-default)',
                    backgroundColor: 'var(--color-surface-container-low)',
                    border: '1px solid var(--color-outline-variant)'
                  }}
                >
                  <span style={{ color: 'var(--color-secondary)', fontSize: '13px' }}>
                    Tiền thối lại
                  </span>
                  <strong
                    style={{
                      color:
                        changeAmount !== null && changeAmount < 0
                          ? 'var(--color-error)'
                          : 'var(--color-tertiary-container)',
                    }}
                  >
                    {changeAmount === null
                      ? '--'
                      : changeAmount < 0
                        ? `Thiếu ${formatVND(Math.abs(changeAmount))}`
                        : formatVND(changeAmount)}
                  </strong>
                </div>

              </div>
            ) : (
              // VIETQR DETAILS
              (() => {
                const bankId = vietqrConfig?.bankId || 'mbbank';
                const accountNo = vietqrConfig?.accountNo || '000000000000';
                const accountName = vietqrConfig?.accountName || 'STALLBOX DEMO';
                const template = vietqrConfig?.template || 'compact2';
                const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${totalAmount}&addInfo=${qrMemo}&accountName=${encodeURIComponent(accountName)}`;
                return (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: 'var(--color-surface-container-low)',
                    borderRadius: 'var(--radius-default)',
                    border: '1px dashed var(--color-primary)',
                  }}>
                    <div style={{
                      backgroundColor: '#ffffff',
                      padding: '6px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      <img src={qrUrl} alt="VietQR Code" style={{ width: '150px', height: '150px', objectFit: 'contain' }} />
                    </div>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--color-outline)', paddingBottom: '3px' }}>
                        <span style={{ color: 'var(--color-secondary)' }}>Nội dung chuyển khoản:</span>
                        <strong
                          style={{ color: 'var(--color-primary)', cursor: 'pointer' }}
                          onClick={() => {
                            navigator.clipboard.writeText(qrMemo);
                            alert('Đã sao chép nội dung !');
                          }}
                        >
                          {qrMemo} 📋
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--color-outline)', paddingBottom: '3px' }}>
                        <span style={{ color: 'var(--color-secondary)' }}>Ngân hàng:</span>
                        <strong style={{ color: 'var(--color-primary)' }}>{bankId.toUpperCase()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '3px' }}>
                        <span style={{ color: 'var(--color-secondary)' }}>Chủ tài khoản:</span>
                        <strong style={{ color: 'var(--color-primary)' }}>{accountName}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            <TextareaInput
              label="Ghi chú đơn hàng"
              name="orderNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập ghi chú món nước (ví dụ: ít đường, mang đi...)"
              disabled={loading}
              rows={2}
              maxLength={255}
            />

          </div>

        </div>

        <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--color-outline-variant)' }}>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Hủy bỏ
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={loading} disabled={!canConfirm}>
            {paymentMethod === 'QR' ? 'Xác nhận đã nhận ' : 'Xác nhận thanh toán'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CheckoutSuccessModal({ isOpen, order, onPrint, onCreateNewOrder }) {
  if (!isOpen || !order) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '760px' }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>
            Thanh toán thành công
          </h3>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
            }}
          >
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ color: 'var(--color-secondary)', fontSize: '12px', marginBottom: '6px' }}>
                Mã đơn hàng
              </div>
              <strong style={{ color: 'var(--color-primary)' }}>#{order.orderCode}</strong>
            </div>

            <div className="card" style={{ padding: '14px' }}>
              <div style={{ color: 'var(--color-secondary)', fontSize: '12px', marginBottom: '6px' }}>
                Thời gian thanh toán
              </div>
              <strong>{formatDateTime(order.paidAt || order.createdAt)}</strong>
            </div>

            <div className="card" style={{ padding: '14px' }}>
              <div style={{ color: 'var(--color-secondary)', fontSize: '12px', marginBottom: '6px' }}>
                Phương thức thanh toán
              </div>
              <strong>{order.paymentMethod === 'CASH' ? 'Tiền mặt' : order.paymentMethod === 'QR' ? ' (VietQR)' : order.paymentMethod}</strong>
            </div>
          </div>

          <OrderItemsTable items={order.items || []} />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
            }}
          >
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ color: 'var(--color-secondary)', fontSize: '12px', marginBottom: '6px' }}>
                Tổng thanh toán
              </div>
              <strong style={{ color: 'var(--color-tertiary-container)' }}>
                {formatVND(order.totalAmount)}
              </strong>
            </div>

            <div className="card" style={{ padding: '14px' }}>
              <div style={{ color: 'var(--color-secondary)', fontSize: '12px', marginBottom: '6px' }}>
                Khách đưa
              </div>
              <strong>{formatVND(order.amountReceived)}</strong>
            </div>

            <div className="card" style={{ padding: '14px' }}>
              <div style={{ color: 'var(--color-secondary)', fontSize: '12px', marginBottom: '6px' }}>
                Tiền thối lại
              </div>
              <strong>{formatVND(order.changeAmount)}</strong>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={onPrint}>
            In bill
          </Button>
          <Button variant="primary" onClick={onCreateNewOrder}>
            Tạo đơn mới
          </Button>
        </div>
      </div>
    </div>
  );
}

export function POSPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState(ALL_TAGS_VALUE);
  const [amountReceived, setAmountReceived] = useState(null);
  const [orderNote, setOrderNote] = useState('');
  const [completedOrder, setCompletedOrder] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [pageError, setPageError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [qrMemo, setQrMemo] = useState('');
  const [vietqrConfig, setVietqrConfig] = useState(null);

  const [activeSession, setActiveSession] = useState(null);
  const [activeSessionError, setActiveSessionError] = useState('');

  useEffect(() => {
    const fetchVietQRConfig = async () => {
      try {
        const response = await posApi.getVietQRConfig();
        setVietqrConfig(response.data || null);
      } catch (err) {
        console.error('Failed to load VietQR config:', err);
      }
    };
    void fetchVietQRConfig();
  }, []);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const checkSession = async () => {
      setIsSessionLoading(true);
      try {
        const response = await posSessionApi.getActiveSession();
        if (!isCancelled) {
          const session = response.data.session;
          setActiveSession(session || null);
          if (!session) {
            navigate('/store/session', { state: { message: 'Vui lòng mở ca làm việc trước khi thực hiện bán hàng.' } });
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setPageError(err.message || 'Không thể xác thực ca làm việc.');
        }
      } finally {
        if (!isCancelled) {
          setIsSessionLoading(false);
        }
      }
    };

    void checkSession();

    return () => {
      isCancelled = true;
    };
  }, [reloadNonce, navigate]);

  useEffect(() => {
    let isCancelled = false;

    const loadProducts = async () => {
      setIsLoading(true);
      setPageError('');

      try {
        const response = await posApi.getAvailableProducts();
        const nextProducts = (response.data.products || []).map((product) => ({
          ...product,
          tag: normalizeProductTag(product.tag),
        }));

        if (!isCancelled) {
          setProducts(nextProducts);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setProducts([]);
          setPageError(loadError.message || 'Không tải được danh sách sản phẩm POS.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadProducts();

    return () => {
      isCancelled = true;
    };
  }, [reloadNonce]);

  const tagOptions = useMemo(() => buildProductTagOptions(products), [products]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!tagOptions.includes(activeTag)) {
      setActiveTag(ALL_TAGS_VALUE);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeTag, tagOptions]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (cart.length === 0) {
      setAmountReceived(null);
      setOrderNote('');
      setCheckoutError('');
      setIsConfirmModalOpen(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [cart.length]);

  const cartTotal = cart.reduce(
    (sum, item) => sum + getOrderItemUnitPrice(item) * Number(item.quantity || 0),
    0,
  );
  const effectiveAmountReceived = paymentMethod === 'QR' ? cartTotal : amountReceived;
  const paymentDifference =
    effectiveAmountReceived === null ? null : Number(effectiveAmountReceived) - Number(cartTotal || 0);
  const isPaymentEnough = paymentMethod === 'QR'
    ? true
    : (effectiveAmountReceived !== null && Number.isFinite(effectiveAmountReceived) && paymentDifference >= 0);
  const paymentValidationMessage =
    paymentMethod === 'CASH' && cart.length > 0 && effectiveAmountReceived !== null && paymentDifference < 0
      ? `Khách đưa chưa đủ. Còn thiếu ${formatVND(Math.abs(paymentDifference))}.`
      : '';
  const canOpenConfirmModal = cart.length > 0 && isPaymentEnough && !isSubmitting;
  const amountReceivedInputValue =
    amountReceived === null ? '' : String(formatVND(amountReceived));

  const filteredProducts = products.filter((product) => {
    const matchesSearch = String(product.name || '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesTag =
      activeTag === ALL_TAGS_VALUE || normalizeProductTag(product.tag) === activeTag;

    return matchesSearch && matchesTag;
  });

  const handleAddToCart = (product) => {
    setCheckoutError('');

    setCart((previous) => {
      const existing = previous.find((item) => item.id === product.id);

      if (existing) {
        return previous.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [...previous, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId, change) => {
    setCheckoutError('');

    setCart((previous) =>
      previous
        .map((item) => {
          if (item.id !== productId) {
            return item;
          }

          const nextQuantity = item.quantity + change;
          return nextQuantity > 0 ? { ...item, quantity: nextQuantity } : null;
        })
        .filter(Boolean),
    );
  };

  const handleRemoveFromCart = (productId) => {
    setCheckoutError('');
    setCart((previous) => previous.filter((item) => item.id !== productId));
  };

  const handleSetAmountReceived = (value) => {
    setCheckoutError('');
    setAmountReceived(value === null ? null : Number(value));
  };

  const handleAmountReceivedChange = (event) => {
    const rawValue = event.target.value;
    const digitsOnly = String(rawValue || '').replace(/[^\d]/g, '');

    if (!digitsOnly) {
      handleSetAmountReceived(null);
      return;
    }

    handleSetAmountReceived(parseVND(digitsOnly));
  };

  const handleOpenConfirmModal = () => {
    if (cart.length === 0) {
      setCheckoutError('Giỏ hàng trống. Vui lòng thêm sản phẩm.');
      return;
    }

    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(100 + Math.random() * 900);
    const memo = `STB${yy}${mm}${dd}${hh}${min}${ss}${random}`;
    setQrMemo(memo);

    setCheckoutError('');
    setIsConfirmModalOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (!canOpenConfirmModal || isSubmitting) {
      return;
    }

    setCheckoutError('');
    setIsSubmitting(true);

    try {
      const finalNote = paymentMethod === 'QR'
        ? `[VietQR: ${qrMemo}]${orderNote.trim() ? ' ' + orderNote.trim() : ''}`
        : orderNote.trim();

      const payload = {
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
        note: finalNote,
        paymentMethod: paymentMethod,
        amountReceived: effectiveAmountReceived,
      };

      const response = await posApi.createOrder(payload);
      const order = response.data.order;

      setCompletedOrder(order || null);
      setIsConfirmModalOpen(false);
      setReloadNonce((current) => current + 1);
    } catch (error) {
      setIsConfirmModalOpen(false);
      setCheckoutError(error.message || 'Thanh toán thất bại.');
      setToastType('error');
      setToastMsg(error.message || 'Giao dịch thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ca làm việc được quản lý tại trang riêng /staff/session

  const handleCreateNewOrder = () => {
    setCompletedOrder(null);
    setCart([]);
    setAmountReceived(null);
    setOrderNote('');
    setCheckoutError('');
  };

  const handlePrintBill = () => {
    if (!completedOrder || typeof window === 'undefined') {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=480,height=720');

    if (!printWindow) {
      setToastType('error');
      setToastMsg('Trình duyệt đang chặn cửa sổ in bill.');
      return;
    }

    const orderItemsMarkup = (completedOrder.items || [])
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(getOrderItemName(item))}</td>
            <td style="text-align:center;">${Number(item.quantity || 0)}</td>
            <td style="text-align:right;">${escapeHtml(formatVND(getOrderItemUnitPrice(item)))}</td>
            <td style="text-align:right;">${escapeHtml(formatVND(getOrderItemSubtotal(item)))}</td>
          </tr>
        `,
      )
      .join('');

    const printDocument = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Hoa don ${escapeHtml(completedOrder.orderCode)}</title>
          <style>
            :root {
              --print-bg: #fffdf8;
              --print-text: #263426;
              --print-muted: #6f786b;
              --print-border: #d8cdbe;
              --print-accent: #3d503c;
            }
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              background: var(--print-bg);
              color: var(--print-text);
            }
            h1, h2, p {
              margin: 0 0 12px;
            }
            h1 {
              color: var(--print-accent);
            }
            .meta {
              margin-bottom: 18px;
              font-size: 14px;
              color: var(--print-muted);
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 18px 0;
            }
            th, td {
              border-bottom: 1px solid var(--print-border);
              padding: 8px 0;
              font-size: 14px;
            }
            th {
              color: var(--print-muted);
            }
            .totals {
              margin-top: 16px;
              font-size: 14px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .strong {
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          <h1>Mini Coffee POS</h1>
          <div class="meta">
            <p><strong>Ma don:</strong> #${escapeHtml(completedOrder.orderCode)}</p>
            <p><strong>Thanh toan luc:</strong> ${escapeHtml(formatDateTime(completedOrder.paidAt || completedOrder.createdAt))}</p>
            <p><strong>Phuong thuc:</strong> ${escapeHtml(completedOrder.paymentMethod === 'CASH' ? 'Tiền mặt' : completedOrder.paymentMethod === 'QR' ? 'Chuyển khoản (VietQR)' : completedOrder.paymentMethod)}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align:left;">Mon</th>
                <th style="text-align:center;">SL</th>
                <th style="text-align:right;">Don gia</th>
                <th style="text-align:right;">Thanh tien</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsMarkup}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span>Tong thanh toan</span>
              <span class="strong">${escapeHtml(formatVND(completedOrder.totalAmount))}</span>
            </div>
            <div class="totals-row">
              <span>Khach dua</span>
              <span>${escapeHtml(formatVND(completedOrder.amountReceived))}</span>
            </div>
            <div class="totals-row">
              <span>Tien thoi lai</span>
              <span>${escapeHtml(formatVND(completedOrder.changeAmount))}</span>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printDocument);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="pos-page-wrapper">
      <div className="pos-page-top">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>Quầy bán hàng POS</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReloadNonce((current) => current + 1)}
              disabled={isLoading || isSubmitting}
              icon={<RotateCcw size={14} />}
            >
              Tải lại
            </Button>
            {activeSession && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/store/session')}
                disabled={isLoading || isSubmitting}
              >
                Quản lý ca làm
              </Button>
            )}
          </div>
        </div>

        {pageError && <Alert type="error" message={pageError} onClose={() => setPageError('')} />}
        {checkoutError && (
          <Alert type="error" message={checkoutError} onClose={() => setCheckoutError('')} />
        )}

        {activeSession?.shouldWarnClose && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            border: '1px solid #ef4444',
            padding: '10px 16px',
            borderRadius: '8px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            marginBottom: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            fontSize: '13px',
          }}>
            ⚠️ Cảnh báo: Ca bán hàng của bạn đã mở liên tục hơn 12 tiếng (realtime UTC+7). Vui lòng kiểm kê két tiền mặt và thực hiện Kết ca bàn giao!
          </div>
        )}
      </div>

      <div className="pos-split-layout">
        <div className="pos-products-column">
          <TextInput
            placeholder="Tìm món nước theo tên..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {tagOptions.map((tag) => {
              const isActive = tag === activeTag;
              const label = tag === ALL_TAGS_VALUE ? 'Tất cả món' : tag;

              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(tag)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '999px',
                    border: '1px solid var(--color-primary)',
                    backgroundColor: isActive
                      ? 'var(--color-sidebar-background)'
                      : 'var(--color-primary-container)',
                    color: 'var(--color-on-primary)',
                    fontSize: '13px',
                    fontWeight: '600',
                    boxShadow: isActive ? 'var(--shadow-low)' : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
              <p style={{ color: 'var(--color-secondary)', margin: 0 }}>
                Đang tải danh sách sản phẩm...
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <p style={{ color: 'var(--color-secondary)', margin: 0 }}>
                Không tìm thấy sản phẩm POS phù hợp.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
              }}
            >
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="card interactive-card"
                  onClick={() => handleAddToCart(product)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '16px',
                    gap: '12px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div>
                    <h4
                      style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: 'var(--color-primary)',
                        margin: 0,
                      }}
                    >
                      {product.name}
                    </h4>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-secondary)',
                        marginTop: '4px',
                        marginBottom: '0',
                      }}
                    >
                      {product.tag}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontWeight: '700',
                        color: 'var(--color-tertiary-container)',
                        fontSize: '15px',
                      }}
                    >
                      {formatVND(product.price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card pos-checkout-column">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderBottom: '1px solid var(--color-outline-variant)',
              paddingBottom: '12px',
            }}
          >
            <ShoppingCart size={20} style={{ color: 'var(--color-primary)' }} />
            <h3
              style={{
                fontSize: '16px',
                fontWeight: '700',
                color: 'var(--color-primary)',
                margin: 0,
              }}
            >
              Đơn hàng thanh toán
            </h3>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flex: 1,
              overflowY: 'auto',
              paddingRight: '4px',
              justifyContent: cart.length === 0 ? 'center' : 'flex-start',
            }}
          >
            {cart.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 0',
                  color: 'var(--color-secondary)',
                }}
              >
                Giỏ hàng đang trống
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    borderBottom: '1px dashed var(--color-outline-variant)',
                    paddingBottom: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: '700',
                          color: 'var(--color-on-surface)',
                          lineHeight: 1.4,
                        }}
                      >
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--color-secondary)',
                          marginTop: '4px',
                        }}
                      >
                        Đơn giá: {formatVND(item.price)}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: '700',
                        color: 'var(--color-tertiary-container)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatVND(getOrderItemSubtotal(item))}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, -1)}
                        disabled={isSubmitting}
                        style={{ color: 'var(--color-primary)', padding: '2px' }}
                        title="Giảm số lượng"
                      >
                        <Minus size={14} />
                      </button>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: '700',
                          width: '28px',
                          textAlign: 'center',
                        }}
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, 1)}
                        disabled={isSubmitting}
                        style={{ color: 'var(--color-primary)', padding: '2px' }}
                        title="Tăng số lượng"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(item.id)}
                      disabled={isSubmitting}
                      style={{ color: 'var(--color-error)', display: 'flex', padding: '2px' }}
                      title="Xóa khỏi giỏ"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              borderTop: '1px solid var(--color-outline-variant)',
              paddingTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--color-secondary)',
              }}
            >
              <span>Tạm tính</span>
              <span>{formatVND(cartTotal)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '16px',
                fontWeight: '700',
                color: 'var(--color-primary)',
              }}
            >
              <span>Tổng thanh toán</span>
              <span style={{ color: 'var(--color-tertiary-container)' }}>
                {formatVND(cartTotal)}
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleOpenConfirmModal}
            disabled={cart.length === 0 || isSubmitting}
            style={{ width: '100%', padding: '12px', marginTop: '12px' }}
          >
            Tiến hành thanh toán
          </Button>
        </div>
      </div>

      <CheckoutConfirmModal
        isOpen={isConfirmModalOpen}
        items={cart}
        totalAmount={cartTotal}
        amountReceived={amountReceived}
        setAmountReceived={setAmountReceived}
        amountReceivedInputValue={amountReceivedInputValue}
        onAmountReceivedChange={handleAmountReceivedChange}
        changeAmount={paymentDifference}
        note={orderNote}
        setNote={setOrderNote}
        loading={isSubmitting}
        onCancel={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmCheckout}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        qrMemo={qrMemo}
        vietqrConfig={vietqrConfig}
        canConfirm={canOpenConfirmModal}
      />

      <CheckoutSuccessModal
        isOpen={Boolean(completedOrder)}
        order={completedOrder}
        onPrint={handlePrintBill}
        onCreateNewOrder={handleCreateNewOrder}
      />


      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />
    </div>
  );
}

export default POSPage;
