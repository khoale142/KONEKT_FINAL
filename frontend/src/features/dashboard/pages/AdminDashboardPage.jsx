import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ShoppingBag, AlertTriangle, Coffee, RotateCcw, PlusCircle, PackagePlus, FileText, Users, Calendar, ArrowRight } from 'lucide-react';
import { getDashboardSummary } from '../api/dashboardApi.js';
import { Card } from '../../../components/common/Card.jsx';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { formatVND } from '../../../utils/currency.js';
import { formatDateTime } from '../../../utils/date.js';
import { ROUTES } from '../../../constants/routes.js';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchSummary = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await getDashboardSummary();
      setSummary(response.data);
    } catch (err) {
      setError(err.message || 'Không thể tải thông tin tổng quan từ hệ thống.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchSummary();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const handleQuickAction = (path) => {
    navigate(path);
  };

  const maxRevenue = summary?.weeklyRevenue && summary.weeklyRevenue.length > 0 
    ? Math.max(...summary.weeklyRevenue.map(d => Number(d.total_revenue))) 
    : 0;

  const last7DaysData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      
      const match = summary?.weeklyRevenue?.find(item => {
        const orderDateStr = item.order_date ? new Date(item.order_date).toISOString().slice(0, 10) : '';
        return orderDateStr === dateStr;
      });
      
      const revenue = match ? Number(match.total_revenue) : 0;
      
      const dayNamesShort = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const dayNamesFull = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayOfWeekShort = dayNamesShort[d.getDay()];
      const dayOfWeekFull = dayNamesFull[d.getDay()];
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const shortDate = `${dd}/${mm}`;
      
      data.push({
        dateStr,
        shortDate,
        dayOfWeekShort,
        dayOfWeekFull,
        revenue
      });
    }
    return data;
  }, [summary?.weeklyRevenue]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title="Bảng điều khiển"
        description="Tổng quan hoạt động kinh doanh và tồn kho của quán cà phê hôm nay."
        actions={
          <Button variant="secondary" onClick={fetchSummary} disabled={isLoading} icon={<RotateCcw size={16} />}>
            Tải lại
          </Button>
        }
      />

      {error && (
        <Alert
          type="warning"
          message={
            <span>
              {error} (Lưu ý: Vui lòng kiểm tra lại kết nối mạng hoặc liên hệ bộ phận hỗ trợ kỹ thuật để được trợ giúp).
            </span>
          }
        />
      )}

      {/* Summary Grid */}
      <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
        <Card
          className="card-hoverable"
          title="Doanh thu hôm nay"
          value={formatVND(summary?.today?.revenue || 0)}
          subtext={`${summary?.today?.orders || 0} đơn hàng thành công`}
          icon={<DollarSign size={24} />}
          loading={isLoading}
          onClick={() => handleQuickAction(ROUTES.STORE_REPORTS)}
        />
        <Card
          className="card-hoverable"
          title="Đơn hàng hôm nay"
          value={summary?.today?.orders || 0}
          subtext="Đơn hàng thành công trong ngày"
          icon={<ShoppingBag size={24} />}
          loading={isLoading}
          onClick={() => handleQuickAction(ROUTES.STORE_REPORTS)}
        />
        <Card
          className={`card-hoverable ${summary?.counts?.lowStockIngredients > 0 ? 'pulse-alert card-border-danger' : ''}`}
          title="Nguyên liệu sắp hết"
          value={summary?.counts?.lowStockIngredients || 0}
          subtext="Nguyên liệu dưới hạn định mức"
          icon={<AlertTriangle size={24} />}
          loading={isLoading}
          onClick={() => handleQuickAction(ROUTES.STORE_STOCK)}
        />
        <Card
          className={`card-hoverable ${summary?.counts?.pendingRequests > 0 ? 'pulse-alert card-border-warning' : ''}`}
          title="Yêu cầu chờ duyệt"
          value={summary?.counts?.pendingRequests || 0}
          subtext="Đơn xin nghỉ & đổi ca"
          icon={<Users size={24} />}
          loading={isLoading}
          onClick={() => handleQuickAction(ROUTES.STORE_MANAGER_HR)}
        />
        <Card
          className="card-hoverable"
          title="Tổng sản phẩm"
          value={summary?.counts?.products || 0}
          subtext="Sản phẩm đang kinh doanh"
          icon={<Coffee size={24} />}
          loading={isLoading}
          onClick={() => handleQuickAction(ROUTES.STORE_PRODUCTS)}
        />
      </div>

      {/* Alert Section */}
      {!isLoading && (summary?.counts?.lowStockIngredients > 0 || summary?.counts?.pendingRequests > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {summary?.counts?.pendingRequests > 0 && (
            <div 
              onClick={() => handleQuickAction(ROUTES.STORE_MANAGER_HR)}
              className="pulse-alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--radius-default)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid #f59e0b',
                color: '#d97706',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>
                  Có {summary.counts.pendingRequests} yêu cầu nhân sự (xin nghỉ / đổi ca) đang chờ duyệt.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '600' }}>
                Duyệt ngay <ArrowRight size={14} />
              </div>
            </div>
          )}

          {summary?.counts?.lowStockIngredients > 0 && summary?.lowStockList && (
            <div 
              onClick={() => handleQuickAction(ROUTES.STORE_STOCK)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '16px',
                borderRadius: 'var(--radius-default)',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid var(--color-error)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyItem: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-error)' }}>
                  <AlertTriangle size={18} />
                  <span style={{ fontSize: '14px', fontWeight: '700' }}>Cảnh báo: Hết/sắp hết nguyên liệu trong kho</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '600', color: 'var(--color-primary)' }}>
                  Đến trang điều chỉnh kho <ArrowRight size={14} />
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                {summary.lowStockList.map((item, idx) => (
                  <span 
                    key={idx} 
                    style={{ 
                      fontSize: '12px', 
                      padding: '4px 8px', 
                      borderRadius: 'var(--radius-sm)', 
                      backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                      color: 'var(--color-error)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      fontWeight: '600'
                    }}
                  >
                    {item.name}: {item.current_stock} / {item.low_stock_threshold} {item.unit}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Charts & Orders Grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-lg)', marginTop: '8px' }}>
        {/* Left: Weekly Revenue Chart */}
        <div className="card" style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>
              Doanh thu 7 ngày gần nhất
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--color-secondary)', fontWeight: '600' }}>
              {last7DaysData[0] ? `${last7DaysData[0].shortDate} - ${last7DaysData[6]?.shortDate}` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '180px', justifyContent: 'flex-end', paddingBottom: '8px', borderBottom: '1px dashed var(--color-outline-variant)' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: '140px' }}>
              {last7DaysData.map((day, idx) => {
                const pct = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                const isMax = day.revenue > 0 && day.revenue === maxRevenue;
                const nonZeroRevenues = last7DaysData.map(d => d.revenue).filter(r => r > 0);
                const minNonZero = nonZeroRevenues.length > 0 ? Math.min(...nonZeroRevenues) : 0;
                const isMin = day.revenue > 0 && day.revenue === minNonZero;
                
                let barColor = 'var(--color-primary)';
                if (isMax) barColor = 'var(--color-status-success-text)';
                else if (isMin) barColor = 'var(--color-error)';
                else if (day.revenue === 0) barColor = 'var(--color-surface-container-high)';
                
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                    <div 
                      title={`${day.dayOfWeekFull} (${day.shortDate}): ${formatVND(day.revenue)}`}
                      style={{
                        width: '100%',
                        maxWidth: '28px',
                        height: `${Math.max(4, pct)}%`,
                        backgroundColor: barColor,
                        borderRadius: 'var(--radius-xs) var(--radius-xs) 0 0',
                        transition: 'height 0.5s ease, opacity 0.2s',
                        cursor: 'pointer',
                        opacity: day.revenue === 0 ? 0.3 : 1,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-on-surface)', fontWeight: '700' }}>
                        {day.dayOfWeekShort}
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--color-secondary)' }}>
                        {day.shortDate}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breakdown Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-secondary)', margin: '4px 0' }}>
              Bảng chi tiết doanh thu
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '8px', padding: '6px 12px', borderBottom: '1px solid var(--color-outline-variant)', fontWeight: '700', fontSize: '11px', color: 'var(--color-secondary)' }}>
              <span>Thứ / Ngày</span>
              <span style={{ textAlign: 'right' }}>Doanh thu</span>
              <span style={{ textAlign: 'right' }}>Đánh giá</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
              {last7DaysData.map((day, idx) => {
                const isMax = day.revenue > 0 && day.revenue === maxRevenue;
                const nonZeroRevenues = last7DaysData.map(d => d.revenue).filter(r => r > 0);
                const minNonZero = nonZeroRevenues.length > 0 ? Math.min(...nonZeroRevenues) : 0;
                const isMin = day.revenue > 0 && day.revenue === minNonZero;

                const getBadgeElement = () => {
                  if (day.revenue === 0) {
                    return <span style={{ fontSize: '9px', color: 'var(--color-secondary)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--color-surface-container-high)', fontWeight: '600' }}>Không bán hàng</span>;
                  }
                  if (isMax) {
                    return <span style={{ fontSize: '9px', color: 'var(--color-status-success-text)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', backgroundColor: 'rgba(235, 250, 240, 0.8)', fontWeight: '700' }}>Doanh thu cao nhất</span>;
                  }
                  if (isMin) {
                    return <span style={{ fontSize: '9px', color: 'var(--color-error)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', backgroundColor: 'rgba(255, 240, 240, 0.8)', fontWeight: '700' }}>Doanh thu thấp nhất</span>;
                  }
                  return <span style={{ fontSize: '9px', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--color-surface-container-low)', fontWeight: '600' }}>Ổn định</span>;
                };

                return (
                  <div 
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1.2fr',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-surface-container-low)',
                      alignItems: 'center',
                      fontSize: '12px'
                    }}
                  >
                    <span style={{ fontWeight: '600', color: 'var(--color-on-surface)' }}>
                      {day.dayOfWeekFull} <span style={{ fontWeight: 'normal', color: 'var(--color-secondary)', fontSize: '10px' }}>({day.shortDate})</span>
                    </span>
                    <span style={{ textAlign: 'right', fontWeight: '700', color: day.revenue > 0 ? 'var(--color-on-surface)' : 'var(--color-secondary)' }}>
                      {formatVND(day.revenue)}
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      {getBadgeElement()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Recent Orders Panel */}
        <div className="card" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-primary)', margin: 0, marginBottom: '16px' }}>
            Đơn hàng gần đây
          </h3>
          {isLoading ? (
            <p style={{ color: 'var(--color-secondary)', fontSize: '14px', margin: 0 }}>Đang tải...</p>
          ) : summary?.recentOrders && summary.recentOrders.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {summary.recentOrders.map((order) => (
                <div 
                  key={order.id} 
                  onClick={() => handleQuickAction(ROUTES.STORE_REPORTS)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-surface-container-low)',
                    border: '1px solid var(--color-outline-variant)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)'}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-primary)' }}>
                      #{order.order_code}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-secondary)', marginTop: '2px' }}>
                      {formatDateTime(order.created_at)}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-tertiary-container)' }}>
                    {formatVND(order.total_amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--color-secondary)', fontSize: '14px', margin: 0 }}>Chưa có đơn hàng nào hôm nay.</p>
          )}
        </div>
      </div>

      {/* Quick Actions Card */}
      <div className="card">
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-primary)', margin: 0, marginBottom: '16px' }}>
          Thao tác nhanh
        </h3>
        <div className="dashboard-quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <button
            type="button"
            onClick={() => handleQuickAction(ROUTES.STORE_PRODUCTS_NEW)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              borderRadius: 'var(--radius-default)',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface-container-low)',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            <PlusCircle size={22} style={{ color: 'var(--color-primary)' }} />
            <div>
              <div style={{ fontWeight: '600', color: 'var(--color-on-surface)', fontSize: '14px' }}>Thêm sản phẩm</div>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary)', marginTop: '2px' }}>Mở nhanh form tạo sản phẩm mới</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickAction(ROUTES.STORE_STOCK)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              borderRadius: 'var(--radius-default)',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface-container-low)',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            <PackagePlus size={22} style={{ color: 'var(--color-primary)' }} />
            <div>
              <div style={{ fontWeight: '600', color: 'var(--color-on-surface)', fontSize: '14px' }}>Nhập / Điều chỉnh kho</div>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary)', marginTop: '2px' }}>Cập nhật số lượng nguyên liệu</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickAction(ROUTES.STORE_RECIPES)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              borderRadius: 'var(--radius-default)',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface-container-low)',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            <Coffee size={22} style={{ color: 'var(--color-primary)' }} />
            <div>
              <div style={{ fontWeight: '600', color: 'var(--color-on-surface)', fontSize: '14px' }}>Thiết lập công thức</div>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary)', marginTop: '2px' }}>Định lượng thành phần ly pha chế</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickAction(ROUTES.STORE_HR_CALENDAR)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              borderRadius: 'var(--radius-default)',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface-container-low)',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            <Calendar size={22} style={{ color: 'var(--color-primary)' }} />
            <div>
              <div style={{ fontWeight: '600', color: 'var(--color-on-surface)', fontSize: '14px' }}>Xếp lịch nhân sự</div>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary)', marginTop: '2px' }}>Phân công ca và lịch làm việc</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickAction(ROUTES.STORE_REPORTS)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              borderRadius: 'var(--radius-default)',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'var(--color-surface-container-low)',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            <FileText size={22} style={{ color: 'var(--color-primary)' }} />
            <div>
              <div style={{ fontWeight: '600', color: 'var(--color-on-surface)', fontSize: '14px' }}>Xem báo cáo</div>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary)', marginTop: '2px' }}>Phân tích kết quả kinh doanh</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
export default AdminDashboardPage;
