import { useEffect, useState, useCallback, useMemo } from 'react';
import { RotateCcw, QrCode, List, Clock, Copy, Check, ExternalLink } from 'lucide-react';
import { attendanceApi } from '../api/attendanceApi.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { DataTable } from '../../../components/common/DataTable.jsx';
import { StatusBadge } from '../../../components/common/StatusBadge.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { formatVND } from '../../../utils/currency.js';
import { toLocalDateString } from '../../../utils/date.js';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { WORKSPACE_TYPES } from '../../../constants/roles.js';

export function AttendancePage() {
  const { workspace } = useAuth();
  const isManager = workspace?.role === 'MANAGER' || workspace?.type === WORKSPACE_TYPES.TENANT;

  const [activeTab, setActiveTab] = useState('qr'); // 'qr' or 'logs'
  const [qrToken, setQrToken] = useState('');
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrImgSrc, setQrImgSrc] = useState('');
  const [startDate, setStartDate] = useState(() => toLocalDateString(new Date()));
  const [endDate, setEndDate] = useState(() => toLocalDateString(new Date()));
  const [searchQuery, setSearchQuery] = useState('');

  const checkInURL = useMemo(() => {
    return qrToken ? `${window.location.origin}/store/hr?token=${qrToken}` : '';
  }, [qrToken]);

  const primaryQrURL = useMemo(() => {
    return checkInURL ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(checkInURL)}` : '';
  }, [checkInURL]);

  const fallbackQrURL = useMemo(() => {
    return checkInURL ? `https://quickchart.io/qr?text=${encodeURIComponent(checkInURL)}&size=280` : '';
  }, [checkInURL]);

  const fetchQRToken = useCallback(async () => {
    try {
      setError('');
      setIsLoading(true);
      const response = await attendanceApi.getQRToken();
      const token = response.data?.token || '';
      setQrToken(token);
    } catch (err) {
      setError(err.message || 'Không lấy được mã QR chấm công.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (primaryQrURL) {
      setQrImgSrc(primaryQrURL);
    }
  }, [primaryQrURL]);

  const fetchLogs = useCallback(async () => {
    if (!isManager) return;
    try {
      setIsLoading(true);
      setError('');
      const response = await attendanceApi.getLogs({ startDate, endDate });
      setLogs(response.data || []);
    } catch (err) {
      setError(err.message || 'Không tải được danh sách chấm công.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, isManager]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (activeTab === 'qr') {
      fetchQRToken();
    } else {
      fetchLogs();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeTab, fetchQRToken, fetchLogs]);

  const handleRefresh = () => {
    if (activeTab === 'qr') {
      fetchQRToken();
    } else {
      fetchLogs();
    }
  };

  const filteredLogs = logs.filter(log => 
    log.staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.staff_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.shift_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const headers = [
    {
      key: 'staff_name',
      label: 'Nhân viên',
      render: (row) => (
        <div>
          <div style={{ fontWeight: '600' }}>{row.staff_name}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-secondary)' }}>@{row.staff_username}</div>
        </div>
      ),
    },
    {
      key: 'shift_name',
      label: 'Ca làm việc',
      render: (row) => (
        <div>
          <span style={{ fontWeight: '600' }}>{row.shift_name}</span>
          <div style={{ fontSize: '11px', color: 'var(--color-secondary)' }}>
            Lịch: {row.planned_start.slice(0, 5)} - {row.planned_end.slice(0, 5)}
          </div>
        </div>
      ),
    },
    {
      key: 'shift_date',
      label: 'Ngày làm',
      render: (row) => {
        const [y, m, d] = row.shift_date.split('-');
        return `${d}/${m}/${y}`;
      },
    },
    {
      key: 'check_in_at',
      label: 'Check-In',
      render: (row) => row.check_in_at ? (
        <div>
          <div style={{ fontWeight: '600', color: 'var(--color-primary)' }}>
            {new Date(row.check_in_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {row.lateness_minutes > 0 ? (
            <span style={{ fontSize: '10px', color: 'var(--color-error)', fontWeight: '600' }}>
              Trễ {row.lateness_minutes} phút
            </span>
          ) : (
            <span style={{ fontSize: '10px', color: 'var(--color-tertiary-container)', fontWeight: '600' }}>
              Đúng giờ
            </span>
          )}
        </div>
      ) : (
        <span style={{ color: 'var(--color-secondary)', fontSize: '13px' }}>Chưa ghi nhận</span>
      ),
    },
    {
      key: 'check_out_at',
      label: 'Check-Out',
      render: (row) => row.check_out_at ? (
        <div>
          <div style={{ fontWeight: '600', color: 'var(--color-primary)' }}>
            {new Date(row.check_out_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--color-secondary)' }}>
            Làm thực tế: {row.actual_hours}h
          </span>
        </div>
      ) : (
        <span style={{ color: 'var(--color-secondary)', fontSize: '13px' }}>Chưa ghi nhận</span>
      ),
    },
    {
      key: 'total_salary',
      label: 'Lương ca',
      style: { textAlign: 'right' },
      render: (row) => (
        <span style={{ fontWeight: '700', color: 'var(--color-tertiary-container)' }}>
          {formatVND(row.total_salary)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => {
        let type = 'info';
        let label = row.status;
        if (row.status === 'COMPLETED') {
          type = 'success';
          label = 'Hoàn thành';
        } else if (row.status === 'ASSIGNED') {
          if (row.check_in_at) {
            type = 'warning';
            label = 'Đang làm việc';
          } else {
            type = 'info';
            label = 'Chưa vào ca';
          }
        } else if (row.status === 'ABSENT') {
          type = 'error';
          label = 'Vắng mặt';
        }
        return <StatusBadge status={type.toUpperCase()} customLabel={label} />;
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title="Quản lý chấm công"
        description="Theo dõi lịch sử vào ca, ra ca và giờ làm thực tế của nhân viên bằng mã QR."
        actions={
          <Button variant="secondary" onClick={handleRefresh} disabled={isLoading} icon={<RotateCcw size={16} />}>
            Tải lại
          </Button>
        }
      />

      {error && <Alert type="warning" message={error} onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-outline-variant)', gap: '16px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('qr')}
          style={{
            padding: '12px 16px',
            fontWeight: '600',
            fontSize: '14px',
            color: activeTab === 'qr' ? 'var(--color-primary)' : 'var(--color-secondary)',
            borderBottom: activeTab === 'qr' ? '2px solid var(--color-primary)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <QrCode size={16} />
          Mã QR Chấm công hôm nay
        </button>

        {isManager && (
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            style={{
              padding: '12px 16px',
              fontWeight: '600',
              fontSize: '14px',
              color: activeTab === 'logs' ? 'var(--color-primary)' : 'var(--color-secondary)',
              borderBottom: activeTab === 'logs' ? '2px solid var(--color-primary)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <List size={16} />
            Lịch sử Chấm công
          </button>
        )}
      </div>

      {/* Tab Contents */}
      {activeTab === 'qr' ? (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>QR CODE ĐIỂM DANH</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-secondary)', margin: 0 }}>
                Quét mã này trên điện thoại khi vào ca làm để điểm danh. Mã được làm mới tự động hàng ngày.
              </p>
            </div>
            
            <div style={{
              padding: '16px',
              borderRadius: 'var(--radius-default)',
              backgroundColor: 'white',
              border: '1px solid var(--color-outline-variant)',
              boxShadow: 'var(--shadow-low)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '280px',
              minHeight: '280px'
            }}>
              {qrToken && qrImgSrc ? (
                <img
                  src={qrImgSrc}
                  alt="Attendance QR Code"
                  onError={() => {
                    if (qrImgSrc !== fallbackQrURL && fallbackQrURL) {
                      setQrImgSrc(fallbackQrURL);
                    }
                  }}
                  style={{ display: 'block', width: '280px', height: '280px', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ width: '280px', height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--color-secondary)' }}>
                  <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '2px' }}></div>
                  <span style={{ fontSize: '13px' }}>Đang tạo mã QR...</span>
                </div>
              )}
            </div>

            {qrToken && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '320px', backgroundColor: 'var(--color-surface-container)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--color-secondary)' }}>Mã Token</span>
                  <code style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-primary)' }}>{qrToken.slice(0, 12)}...{qrToken.slice(-6)}</code>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(qrToken);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
                >
                  {copied ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
                  <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-secondary)', backgroundColor: 'var(--color-surface-container-low)', padding: '8px 14px', borderRadius: 'var(--radius-sm)' }}>
              <Clock size={14} style={{ color: 'var(--color-primary)' }} />
              <span>Cập nhật ngày: {new Date().toLocaleDateString('vi-VN')}</span>
            </div>
            
            {checkInURL && (
              <a
                href={checkInURL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-primary)', fontWeight: '600', textDecoration: 'none' }}
              >
                <span>Mở liên kết điểm danh trực tiếp</span>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters */}
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '16px 16px 0 16px' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <TextInput
                label="Tìm kiếm nhân viên, ca làm..."
                placeholder="Nhập tên nhân viên, ca làm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div style={{ width: '160px' }}>
              <div className="form-group">
                <label className="form-label">
                  Từ ngày
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ width: '160px' }}>
              <div className="form-group">
                <label className="form-label">
                  Đến ngày
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          <DataTable
            headers={headers}
            data={filteredLogs}
            loading={isLoading}
            emptyMessage="Không tìm thấy lịch sử chấm công nào trong khoảng thời gian này."
          />
        </div>
      )}
    </div>
  );
}
export default AttendancePage;
