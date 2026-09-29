import { useEffect, useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { TextareaInput } from '../../../components/forms/TextareaInput.jsx';
import { Card } from '../../../components/common/Card.jsx';
import { StatusBadge } from '../../../components/common/StatusBadge.jsx';
import { formatVND } from '../../../utils/currency.js';
import { toLocalDateString } from '../../../utils/date.js';
import { hrApi } from '../api/hrApi.js';
import { attendanceApi } from '../api/attendanceApi.js';
import { Calendar, FileText, DollarSign, Plus, Trash2, Send, UserCheck, Clock, Check } from 'lucide-react';

export function StaffHRPage() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [isLoading, setIsLoading] = useState(false);

  // Shifts & Availability states
  const [assignedShifts, setAssignedShifts] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [availModal, setAvailModal] = useState({
    show: false,
    date: null,
    existingAvails: [],
    isFlexible: false,
    selectedShiftId: '',
    customStart: '08:00',
    customEnd: '16:00',
    note: ''
  });

  // Weekly timetable navigation states
  const [currentMonday, setCurrentMonday] = useState(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const distance = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today.setDate(today.getDate() + distance));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  const getWeekDays = (mondayDate) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayDate);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const handlePrevWeek = () => {
    const newMonday = new Date(currentMonday);
    newMonday.setDate(newMonday.getDate() - 7);
    setCurrentMonday(newMonday);
  };

  const handleNextWeek = () => {
    const newMonday = new Date(currentMonday);
    newMonday.setDate(newMonday.getDate() + 7);
    setCurrentMonday(newMonday);
  };

  // Requests states
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [newRequest, setNewRequest] = useState({ type: 'LEAVE', reason: '', target_date: '', target_shift_id: '', swap_with_staff_id: '' });

  // Salary states
  const [salaryDates, setSalaryDates] = useState(() => {
    const today = new Date();
    const startOfMonth = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
    const endOfMonth = toLocalDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    return { start_date: startOfMonth, end_date: endOfMonth };
  });
  const [salarySummary, setSalarySummary] = useState(null);

  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [attendanceToken, setAttendanceToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceSuccess, setAttendanceSuccess] = useState('');

  // Check URL token on mount
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setAttendanceToken(token);
      setActiveTab('attendance');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
  };

  const loadCalendarData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const mondayStr = toLocalDateString(currentMonday);
      const sunday = new Date(currentMonday);
      sunday.setDate(sunday.getDate() + 6);
      const sundayStr = toLocalDateString(sunday);

      const [shiftsRes, availRes, masterShiftsRes] = await Promise.all([
        hrApi.getMyAssignedShifts({ start_date: mondayStr, end_date: sundayStr }),
        hrApi.getMyAvailability({ start_date: mondayStr, end_date: sundayStr }),
        hrApi.getShifts(),
      ]);

      setAssignedShifts(shiftsRes.data?.shifts || []);
      setAvailabilities(availRes.data?.availabilities || []);
      setShifts(masterShiftsRes.data?.shifts || []);
    } catch (err) {
      setError(err.message || 'Không tải được lịch làm việc.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRequestsData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [reqsRes, staffRes, shiftsRes] = await Promise.all([
        hrApi.getMyRequests(),
        hrApi.getStaffList(),
        hrApi.getShifts(),
      ]);
      setRequests(reqsRes.data?.requests || []);
      setUsers(staffRes.data?.staff || []);
      setShifts(shiftsRes.data?.shifts || []);
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu yêu cầu.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSalaryData = async () => {
    if (!salaryDates.start_date || !salaryDates.end_date) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await hrApi.getMySalary(salaryDates);
      setSalarySummary(res.data?.summary || null);
    } catch (err) {
      setError(err.message || 'Không tải được phiếu lương.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAttendanceStatus = async () => {
    try {
      setAttendanceLoading(true);
      const res = await attendanceApi.getTodayStatus();
      setAttendanceStatus(res.data || null);
    } catch (err) {
      setAttendanceError(err.message || 'Không tải được trạng thái chấm công.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!attendanceToken) {
      setAttendanceError('Vui lòng nhập hoặc quét mã token chấm công.');
      return;
    }
    try {
      setAttendanceLoading(true);
      setAttendanceError('');
      setAttendanceSuccess('');
      const res = await attendanceApi.checkIn(attendanceToken);
      setAttendanceSuccess(res.message || 'Check-in thành công!');
      setAttendanceToken('');
      await loadAttendanceStatus();
    } catch (err) {
      setAttendanceError(err.message || 'Check-in thất bại.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn Check-out và kết thúc ca làm việc hôm nay?')) return;
    try {
      setAttendanceLoading(true);
      setAttendanceError('');
      setAttendanceSuccess('');
      const res = await attendanceApi.checkOut();
      setAttendanceSuccess(res.message || 'Check-out thành công!');
      await loadAttendanceStatus();
    } catch (err) {
      setAttendanceError(err.message || 'Check-out thất bại.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Fetch when tab switches or currentMonday week changes
  useEffect(() => {
    /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
    if (activeTab === 'calendar') {
      loadCalendarData();
    } else if (activeTab === 'requests') {
      loadRequestsData();
    } else if (activeTab === 'salary') {
      loadSalaryData();
    } else if (activeTab === 'attendance') {
      loadAttendanceStatus();
    }
    /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  }, [activeTab, currentMonday]);

  // Handle Availability Registration
  const handleAvailCellClick = (day) => {
    const dayStr = toLocalDateString(day);
    const dayAvails = availabilities.filter((a) => toLocalDateString(a.available_date) === dayStr);
    setAvailModal({
      show: true,
      date: day,
      existingAvails: dayAvails,
      isFlexible: false,
      selectedShiftId: shifts[0]?.id || '',
      customStart: '08:00',
      customEnd: '16:00',
      note: ''
    });
  };

  const handleAvailShiftSelectChange = (shiftId) => {
    const selectedShift = shifts.find(s => s.id === shiftId);
    setAvailModal(prev => ({
      ...prev,
      selectedShiftId: shiftId,
      customStart: selectedShift ? formatTime(selectedShift.start_time) : '08:00',
      customEnd: selectedShift ? formatTime(selectedShift.end_time) : '16:00',
    }));
  };

  const handleAvailModalSubmit = async () => {
    const { date, isFlexible, selectedShiftId, customStart, customEnd, note } = availModal;
    
    let finalStart = customStart;
    let finalEnd = customEnd;

    if (!isFlexible) {
      const selectedShift = shifts.find(s => s.id === selectedShiftId);
      if (!selectedShift) {
        showToast('Vui lòng chọn một ca làm việc mẫu.', 'error');
        return;
      }
      finalStart = formatTime(selectedShift.start_time);
      finalEnd = formatTime(selectedShift.end_time);
    }

    if (finalStart >= finalEnd) {
      showToast('Giờ bắt đầu phải trước giờ kết thúc.', 'error');
      return;
    }

    try {
      await hrApi.createAvailability({
        available_date: toLocalDateString(date),
        start_time: finalStart,
        end_time: finalEnd,
        note: note || null,
      });
      showToast('Đăng ký lịch rảnh thành công.');
      loadCalendarData();
      setAvailModal(prev => ({ ...prev, show: false }));
    } catch (err) {
      showToast(err.message || 'Đăng ký thất bại.', 'error');
    }
  };

  const handleAvailModalDelete = async (availId) => {
    if (!window.confirm('Bạn có chắc muốn xóa lịch báo rảnh này?')) return;
    try {
      await hrApi.deleteMyAvailability(availId);
      showToast('Đã xóa đăng ký lịch rảnh.');
      setAvailModal(prev => ({
        ...prev,
        existingAvails: prev.existingAvails.filter(a => a.id !== availId)
      }));
      loadCalendarData();
    } catch (err) {
      showToast(err.message || 'Xóa thất bại.', 'error');
    }
  };

  // Handle Request Submission
  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!newRequest.target_date) {
      showToast('Vui lòng chọn ngày áp dụng yêu cầu.', 'error');
      return;
    }
    if (!newRequest.reason || newRequest.reason.trim() === '') {
      showToast('Vui lòng nhập lý do.', 'error');
      return;
    }
    if (newRequest.type === 'SWAP') {
      if (!newRequest.target_shift_id) {
        showToast('Vui lòng chọn ca làm cần đổi.', 'error');
        return;
      }
      if (!newRequest.swap_with_staff_id) {
        showToast('Vui lòng chọn nhân viên nhận đổi ca.', 'error');
        return;
      }
    }

    try {
      await hrApi.createRequest(newRequest);
      showToast('Gửi yêu cầu thành công, đang chờ Admin duyệt.');
      setNewRequest({ type: 'LEAVE', reason: '', target_date: '', target_shift_id: '', swap_with_staff_id: '' });
      loadRequestsData();
    } catch (err) {
      showToast(err.message || 'Gửi yêu cầu thất bại.', 'error');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Nhân sự & Lịch làm việc"
        description="Đăng ký lịch rảnh, xem ca làm việc, gửi yêu cầu xin nghỉ/đổi ca và theo dõi thu nhập."
      />

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Custom Tab Navigation */}
      <div className="tab-container" style={{ display: 'flex', gap: '8px', marginBottom: 'var(--spacing-lg)', borderBottom: '1px solid var(--color-surface-container-high)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`btn ${activeTab === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Calendar size={18} />
          Lịch làm việc của tôi
        </button>
        <button
          onClick={() => setActiveTab('availability')}
          className={`btn ${activeTab === 'availability' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} />
          Đăng ký lịch rảnh
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <FileText size={18} />
          Đơn xin nghỉ & Đổi ca
        </button>
        <button
          onClick={() => setActiveTab('salary')}
          className={`btn ${activeTab === 'salary' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <DollarSign size={18} />
          Bảng lương của tôi
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`btn ${activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <UserCheck size={18} />
          Điểm danh ca làm
        </button>
      </div>

      {/* --- TAB CONTENT: CALENDAR --- */}
      {activeTab === 'calendar' && (
        <div className="card">
          {/* Week navigation bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={handlePrevWeek} style={{ padding: '6px 12px', fontSize: '13px' }}>Tuần trước</button>
            <h4 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '14px', textAlign: 'center' }}>
              {formatDate(currentMonday)} - {formatDate(new Date(new Date(currentMonday).setDate(currentMonday.getDate() + 6)))}
            </h4>
            <button type="button" className="btn btn-secondary" onClick={handleNextWeek} style={{ padding: '6px 12px', fontSize: '13px' }}>Tuần sau</button>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>Đang tải lịch làm...</div>
          ) : (
            <div className="table-container">
              <table className="data-table" style={{ minWidth: '950px', borderCollapse: 'collapse', border: '1px solid var(--color-surface-container-high)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
                    <th style={{ width: '180px', padding: '12px 10px', color: '#fff', border: '1px solid var(--color-surface-container-high)', textAlign: 'left' }}>Ca làm việc</th>
                    {getWeekDays(currentMonday).map((day) => {
                      const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][day.getDay()];
                      const dateLabel = `${day.getDate()}/${day.getMonth() + 1}`;
                      const isToday = toLocalDateString(new Date()) === toLocalDateString(day);
                      return (
                        <th key={day.toString()} style={{ textAlign: 'center', padding: '12px 10px', color: '#fff', border: '1px solid var(--color-surface-container-high)', backgroundColor: isToday ? 'var(--color-primary-container)' : 'var(--color-primary)' }}>
                          <div style={{ fontWeight: 'bold' }}>{dayName}</div>
                          <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.9 }}>{dateLabel}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {shifts.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-secondary)' }}>
                        Chưa cấu hình ca làm việc mẫu nào trên hệ thống.
                      </td>
                    </tr>
                  ) : (
                    shifts.map((shift) => (
                      <tr key={shift.id}>
                        <td style={{ fontWeight: 'bold', border: '1px solid var(--color-surface-container-high)', padding: '12px 10px', verticalAlign: 'middle' }}>
                          <span style={{ color: 'var(--color-primary)' }}>{shift.name}</span>
                          <div style={{ fontSize: '11px', color: 'var(--color-secondary)', fontWeight: 'normal', marginTop: '4px' }}>
                            {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                          </div>
                        </td>
                        {getWeekDays(currentMonday).map((day) => {
                          const dayStr = toLocalDateString(day);
                          const assignment = assignedShifts.find(
                            (s) => s.shift_id === shift.id && toLocalDateString(s.shift_date) === dayStr
                          );

                          if (!assignment) {
                            return (
                              <td key={dayStr} style={{ textAlign: 'center', color: 'var(--color-secondary)', border: '1px solid var(--color-surface-container-high)', verticalAlign: 'middle' }}>
                                -
                              </td>
                            );
                          }

                          let statusColor = 'var(--color-primary)';
                          let statusText = '(assigned)';
                          let cellBg = 'rgba(235, 245, 255, 0.5)';
                          if (assignment.status === 'COMPLETED') {
                            statusColor = 'var(--color-status-success-text)';
                            statusText = '(attended)';
                            cellBg = 'rgba(235, 250, 240, 0.8)';
                          } else if (assignment.status === 'ABSENT') {
                            statusColor = 'var(--color-status-error-text)';
                            statusText = '(absent)';
                            cellBg = 'rgba(255, 240, 240, 0.8)';
                          }

                          return (
                            <td
                              key={dayStr}
                              onClick={() => setSelectedDayDetail({ date: day, shifts: [assignment] })}
                              style={{
                                textAlign: 'center',
                                cursor: 'pointer',
                                backgroundColor: cellBg,
                                border: '1px solid var(--color-surface-container-high)',
                                verticalAlign: 'middle',
                                transition: 'background-color 0.2s',
                                padding: '8px',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = cellBg;
                              }}
                            >
                              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                {assignment.shift_name}
                              </div>
                              <div style={{ fontSize: '10px', color: statusColor, fontWeight: '700', marginTop: '4px' }}>
                                {statusText}
                              </div>
                              <div style={{ fontSize: '9px', color: 'var(--color-secondary)', marginTop: '4px' }}>
                                ({formatTime(assignment.custom_start_time || assignment.start_time)}-{formatTime(assignment.custom_end_time || assignment.end_time)})
                                {assignment.custom_start_time && <span style={{ color: 'var(--color-tertiary-container)', fontWeight: 'bold', marginLeft: '2px' }}>*</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT: AVAILABILITY (BÁO RẢNH) --- */}
      {activeTab === 'availability' && (
        <div className="card">
          {/* Week navigation bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={handlePrevWeek} style={{ padding: '6px 12px', fontSize: '13px' }}>Tuần trước</button>
            <h4 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '14px', textAlign: 'center' }}>
              {formatDate(currentMonday)} - {formatDate(new Date(new Date(currentMonday).setDate(currentMonday.getDate() + 6)))}
            </h4>
            <button type="button" className="btn btn-secondary" onClick={handleNextWeek} style={{ padding: '6px 12px', fontSize: '13px' }}>Tuần sau</button>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>Đang tải lịch rảnh...</div>
          ) : (
            <div className="table-container">
              <table className="data-table" style={{ minWidth: '950px', borderCollapse: 'collapse', border: '1px solid var(--color-surface-container-high)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
                    <th style={{ width: '180px', padding: '12px 10px', color: '#fff', border: '1px solid var(--color-surface-container-high)', textAlign: 'left' }}>Mục</th>
                    {getWeekDays(currentMonday).map((day) => {
                      const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][day.getDay()];
                      const dateLabel = `${day.getDate()}/${day.getMonth() + 1}`;
                      const isToday = toLocalDateString(new Date()) === toLocalDateString(day);
                      return (
                        <th key={day.toString()} style={{ textAlign: 'center', padding: '12px 10px', color: '#fff', border: '1px solid var(--color-surface-container-high)', backgroundColor: isToday ? 'var(--color-primary-container)' : 'var(--color-primary)' }}>
                          <div style={{ fontWeight: 'bold' }}>{dayName}</div>
                          <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.9 }}>{dateLabel}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'bold', border: '1px solid var(--color-surface-container-high)', padding: '12px 10px', verticalAlign: 'middle' }}>
                      <div style={{ color: 'var(--color-primary)' }}>Lịch rảnh của tôi</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-secondary)', fontWeight: 'normal', marginTop: '4px' }}>
                        Click vào ô để báo rảnh
                      </div>
                    </td>
                    {getWeekDays(currentMonday).map((day) => {
                      const dayStr = toLocalDateString(day);
                      const dayAvails = availabilities.filter((a) => toLocalDateString(a.available_date) === dayStr);

                      return (
                        <td
                          key={dayStr}
                          onClick={() => handleAvailCellClick(day)}
                          style={{
                            textAlign: 'center',
                            cursor: 'pointer',
                            border: '1px solid var(--color-surface-container-high)',
                            verticalAlign: 'middle',
                            transition: 'background-color 0.2s',
                            padding: '8px',
                            minHeight: '80px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {dayAvails.length === 0 ? (
                              <span style={{ color: 'var(--color-secondary)', fontSize: '11px' }}>-</span>
                            ) : (
                              dayAvails.map((a) => (
                                <div
                                  key={a.id}
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: 'var(--radius-xs)',
                                    border: '1px dashed var(--color-primary)',
                                    backgroundColor: 'rgba(255, 248, 220, 0.5)',
                                    fontSize: '11px',
                                    color: 'var(--color-primary)',
                                  }}
                                >
                                  <div style={{ fontWeight: 'bold' }}>Báo rảnh</div>
                                  <div style={{ fontSize: '10px', color: 'var(--color-secondary)', marginTop: '2px' }}>
                                    {formatTime(a.start_time)} - {formatTime(a.end_time)}
                                  </div>
                                  {a.note && <div style={{ fontSize: '9px', fontStyle: 'italic', marginTop: '2px' }}>{a.note}</div>}
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT: REQUESTS --- */}
      {activeTab === 'requests' && (
        <div className="responsive-split-layout">
          {/* Left Side: Requests List */}
          <div className="card">
            <h3 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Yêu cầu đã gửi</h3>
            {requests.length === 0 ? (
              <p style={{ color: 'var(--color-secondary)', textAlign: 'center', padding: '24px' }}>Bạn chưa gửi yêu cầu nghỉ hoặc đổi ca nào.</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ngày gửi</th>
                      <th>Loại</th>
                      <th>Ngày áp dụng</th>
                      <th>Lý do & Chi tiết</th>
                      <th>Trạng thái</th>
                      <th>Ghi chú Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req.id}>
                        <td>{formatDate(req.created_at)}</td>
                        <td>
                          <span className={`badge ${req.type === 'LEAVE' ? 'badge-error' : 'badge-warning'}`}>
                            {req.type === 'LEAVE' ? 'Xin nghỉ' : 'Đổi ca'}
                          </span>
                        </td>
                        <td><strong>{formatDate(req.target_date)}</strong></td>
                        <td>
                          <div style={{ maxWidth: '200px', fontSize: '13px' }}>
                            <strong>{req.reason}</strong>
                            {req.type === 'SWAP' && (
                              <div style={{ fontSize: '11px', color: 'var(--color-secondary)', marginTop: '4px' }}>
                                Đổi ca: {req.target_shift_name} với <strong>{req.swap_with_staff_name}</strong>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${req.status === 'APPROVED' ? 'badge-success' : req.status === 'REJECTED' ? 'badge-error' : 'badge-neutral'}`}>
                            {req.status === 'APPROVED' ? 'Đã duyệt' : req.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>{req.admin_note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Side: Create Request Form */}
          <div className="card">
            <h3 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Gửi yêu cầu mới</h3>
            <form onSubmit={handleRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Loại yêu cầu</label>
                <select
                  className="form-control"
                  value={newRequest.type}
                  onChange={(e) => setNewRequest({ ...newRequest, type: e.target.value, target_shift_id: '', swap_with_staff_id: '' })}
                >
                  <option value="LEAVE">Xin nghỉ phép</option>
                  <option value="SWAP">Xin đổi ca làm việc</option>
                </select>
              </div>

              <TextInput
                type="date"
                label="Ngày xin áp dụng"
                name="target_date"
                value={newRequest.target_date}
                onChange={(e) => setNewRequest({ ...newRequest, target_date: e.target.value })}
                required
              />

              {newRequest.type === 'SWAP' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Chọn ca làm việc muốn đổi</label>
                    <select
                      className="form-control"
                      value={newRequest.target_shift_id}
                      onChange={(e) => setNewRequest({ ...newRequest, target_shift_id: e.target.value })}
                      required
                    >
                      <option value="">-- Chọn ca làm việc --</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({formatTime(s.start_time)} - {formatTime(s.end_time)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nhân viên nhận ca đổi</label>
                    <select
                      className="form-control"
                      value={newRequest.swap_with_staff_id}
                      onChange={(e) => setNewRequest({ ...newRequest, swap_with_staff_id: e.target.value })}
                      required
                    >
                      <option value="">-- Chọn nhân viên --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.fullName} (@{u.username})</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <TextareaInput
                label="Lý do xin phép"
                name="reason"
                value={newRequest.reason}
                onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                placeholder="Nhập lý do chi tiết..."
                required
              />

              <Button type="submit" variant="primary" icon={<Send size={16} />} disabled={isLoading}>
                Gửi yêu cầu duyệt
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: SALARY --- */}
      {activeTab === 'salary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
            <div>
              <TextInput
                type="date"
                label="Từ ngày"
                name="start_date"
                value={salaryDates.start_date}
                onChange={(e) => setSalaryDates({ ...salaryDates, start_date: e.target.value })}
              />
            </div>
            <div>
              <TextInput
                type="date"
                label="Đến ngày"
                name="end_date"
                value={salaryDates.end_date}
                onChange={(e) => setSalaryDates({ ...salaryDates, end_date: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <Button onClick={loadSalaryData} variant="primary" disabled={isLoading}>
                Tra cứu phiếu lương
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Đang truy vấn dữ liệu...</div>
          ) : salarySummary ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--spacing-lg)' }}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: 'var(--color-secondary)' }}>Số ca hoàn thành</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-tertiary-container)', marginTop: '8px' }}>
                      {salarySummary.completed_shifts}
                    </div>
                  </div>
                  <Calendar size={40} style={{ color: 'var(--color-tertiary-container)', opacity: 0.8 }} />
                </div>
              </Card>

              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: 'var(--color-secondary)' }}>Số ca vắng mặt</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-error)', marginTop: '8px' }}>
                      {salarySummary.absent_shifts}
                    </div>
                  </div>
                  <Calendar size={40} style={{ color: 'var(--color-error)', opacity: 0.8 }} />
                </div>
              </Card>

              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: 'var(--color-secondary)' }}>Tổng tiền lương ước tính</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-primary)', marginTop: '8px' }}>
                      {formatVND(Number(salarySummary.total_earned))}
                    </div>
                  </div>
                  <DollarSign size={40} style={{ color: 'var(--color-primary)', opacity: 0.8 }} />
                </div>
              </Card>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--color-secondary)', padding: '24px' }}>
              Vui lòng chọn khoảng thời gian và nhấn nút Tra cứu để xem phiếu lương.
            </div>
          )}
        </div>
      )}

      {/* Selected Day Detail Modal */}
      {selectedDayDetail && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '450px', backgroundColor: '#fff', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-surface-container-high)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '16px' }}>Chi tiết ngày {formatDate(selectedDayDetail.date)}</h3>
              <button
                onClick={() => setSelectedDayDetail(null)}
                style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--color-secondary)' }}
              >
                &times;
              </button>
            </div>

            {selectedDayDetail.shifts.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--color-secondary)', padding: '16px', fontSize: '14px' }}>Không có ca làm việc nào được xếp trong ngày này.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedDayDetail.shifts.map(s => {
                  const startTime = s.custom_start_time || s.start_time;
                  const endTime = s.custom_end_time || s.end_time;
                  const start = new Date(`1970-01-01T${startTime}`);
                  const end = new Date(`1970-01-01T${endTime}`);
                  let diffHours = (end - start) / (1000 * 60 * 60);
                  if (diffHours < 0) diffHours += 24;

                  return (
                    <div key={s.id} style={{ padding: '12px', border: '1px solid var(--color-surface-container-high)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface-container-lowest)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ color: 'var(--color-primary)', fontSize: '14px' }}>
                          {s.shift_name} {s.custom_start_time && <span style={{ color: 'var(--color-tertiary-container)', fontWeight: 'bold' }}>(Linh động)</span>}
                        </strong>
                        <StatusBadge status={s.status} />
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>Thời gian: <strong>{formatTime(startTime)} - {formatTime(endTime)}</strong> ({diffHours} giờ)</div>
                        <div>Đơn giá: <strong>{formatVND(Number(s.hourly_rate_snapshot))} / giờ</strong></div>
                        <div style={{ borderTop: '1px dashed var(--color-surface-container-high)', paddingTop: '6px', marginTop: '4px', fontSize: '13px', color: 'var(--color-primary)' }}>
                          Lương ca làm ước tính: <strong>{formatVND(Number(s.total_salary))}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <Button onClick={() => setSelectedDayDetail(null)} variant="secondary">Đóng</Button>
            </div>
          </div>
        </div>
      )}

      {availModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '500px', backgroundColor: '#fff', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-surface-container-high)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '16px' }}>
                Đăng ký lịch rảnh ngày: {formatDate(availModal.date)}
              </h3>
              <button
                onClick={() => setAvailModal({ ...availModal, show: false })}
                style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--color-secondary)' }}
              >
                &times;
              </button>
            </div>

            {/* List existing availabilities on this day */}
            {availModal.existingAvails && availModal.existingAvails.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Khung giờ rảnh đã báo:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {availModal.existingAvails.map(a => (
                    <div key={a.id} style={{ padding: '10px', border: '1px solid var(--color-surface-container-high)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface-container-lowest)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '12px' }}>
                        <strong>{formatTime(a.start_time)} - {formatTime(a.end_time)}</strong>
                        {a.note && <span style={{ color: 'var(--color-secondary)', marginLeft: '6px' }}>({a.note})</span>}
                      </div>
                      <button
                        onClick={() => handleAvailModalDelete(a.id)}
                        style={{ color: 'var(--color-error)', border: 'none', background: 'none', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form to register new availability */}
            <div style={{ borderTop: '1px solid var(--color-surface-container-high)', paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13px' }}>Đăng ký khung giờ rảnh mới:</h4>
              
              {/* Type selection tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setAvailModal(prev => ({ ...prev, isFlexible: false, selectedShiftId: prev.selectedShiftId || (shifts[0]?.id || '') }))}
                  className={`btn ${!availModal.isFlexible ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '12px', textAlign: 'center', justifyContent: 'center' }}
                >
                  Rảnh theo ca làm mẫu
                </button>
                <button
                  type="button"
                  onClick={() => setAvailModal(prev => ({ ...prev, isFlexible: true }))}
                  className={`btn ${availModal.isFlexible ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '12px', textAlign: 'center', justifyContent: 'center' }}
                >
                  Rảnh khung giờ linh động
                </button>
              </div>

              {/* Fixed shift option */}
              {!availModal.isFlexible && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Chọn ca làm mẫu</label>
                  <select
                    className="form-control"
                    value={availModal.selectedShiftId}
                    onChange={(e) => handleAvailShiftSelectChange(e.target.value)}
                  >
                    <option value="">-- Chọn ca làm mẫu --</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatTime(s.start_time)} - {formatTime(s.end_time)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Flexible shift option */}
              {availModal.isFlexible && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px' }}>Từ giờ</label>
                    <input
                      type="time"
                      className="form-control"
                      value={availModal.customStart}
                      onChange={(e) => setAvailModal(prev => ({ ...prev, customStart: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px' }}>Đến giờ</label>
                    <input
                      type="time"
                      className="form-control"
                      value={availModal.customEnd}
                      onChange={(e) => setAvailModal(prev => ({ ...prev, customEnd: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Ghi chú tùy chọn</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="bận học ca chiều, có thể tăng ca..."
                  value={availModal.note}
                  onChange={(e) => setAvailModal(prev => ({ ...prev, note: e.target.value }))}
                />
              </div>

              <Button onClick={handleAvailModalSubmit} variant="primary" icon={<Plus size={16} />} style={{ width: '100%' }}>
                Đăng ký ca rảnh
              </Button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button onClick={() => setAvailModal({ ...availModal, show: false })} variant="secondary">Đóng</Button>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: ATTENDANCE (ĐIỂM DANH) --- */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {attendanceError && <Alert type="error" message={attendanceError} onClose={() => setAttendanceError('')} />}
          {attendanceSuccess && <Alert type="success" message={attendanceSuccess} onClose={() => setAttendanceSuccess('')} />}

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-primary)', margin: 0 }}>
              Chấm công ca làm hôm nay ({new Date().toLocaleDateString('vi-VN')})
            </h3>

            {attendanceLoading ? (
              <p style={{ color: 'var(--color-secondary)' }}>Đang tải trạng thái...</p>
            ) : attendanceStatus ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-default)',
                  backgroundColor: 'var(--color-surface-container-low)',
                  border: '1px solid var(--color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-primary)' }}>
                      Ca: {attendanceStatus.shift_name}
                    </span>
                    <StatusBadge 
                      status={
                        attendanceStatus.status === 'COMPLETED' ? 'SUCCESS' : 
                        attendanceStatus.check_in_at ? 'WARNING' : 'ACTIVE'
                      } 
                      customLabel={
                        attendanceStatus.status === 'COMPLETED' ? 'Đã hoàn thành' : 
                        attendanceStatus.check_in_at ? 'Đang làm việc' : 'Chưa vào ca'
                      } 
                    />
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                    Thời gian kế hoạch: <strong>{attendanceStatus.planned_start.slice(0, 5)} - {attendanceStatus.planned_end.slice(0, 5)}</strong>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px dashed var(--color-outline-variant)', paddingTop: '12px', marginTop: '4px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-secondary)', display: 'block' }}>GIỜ CHECK-IN</span>
                      <strong style={{ fontSize: '14px', color: 'var(--color-on-surface)' }}>
                        {attendanceStatus.check_in_at ? (
                          new Date(attendanceStatus.check_in_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                        ) : '--:--'}
                      </strong>
                      {attendanceStatus.lateness_minutes > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--color-error)', display: 'block', marginTop: '2px', fontWeight: '600' }}>
                          Trễ {attendanceStatus.lateness_minutes} phút
                        </span>
                      )}
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-secondary)', display: 'block' }}>GIỜ CHECK-OUT</span>
                      <strong style={{ fontSize: '14px', color: 'var(--color-on-surface)' }}>
                        {attendanceStatus.check_out_at ? (
                          new Date(attendanceStatus.check_out_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                        ) : '--:--'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  {!attendanceStatus.check_in_at && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: '600' }}>Nhập mã QR Token hoặc quét mã</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Nhập mã token hiển thị trên QR code..."
                          value={attendanceToken}
                          onChange={(e) => setAttendanceToken(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleCheckIn} variant="primary" style={{ height: '44px' }} icon={<Check size={16} />}>
                        Xác nhận Check-in vào ca
                      </Button>
                    </div>
                  )}

                  {attendanceStatus.check_in_at && !attendanceStatus.check_out_at && (
                    <Button onClick={handleCheckOut} variant="danger" style={{ flex: 1, height: '44px' }} icon={<Clock size={16} />}>
                      Check-out kết thúc ca làm
                    </Button>
                  )}

                  {attendanceStatus.check_out_at && (
                    <div style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(235, 250, 240, 0.8)', border: '1px solid var(--color-status-success-text)', color: 'var(--color-status-success-text)', textAlign: 'center', fontWeight: '600', fontSize: '14px' }}>
                      Bạn đã hoàn thành chấm công ca làm việc hôm nay. Cảm ơn!
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-secondary)' }}>
                <Clock size={36} style={{ color: 'var(--color-outline)', marginBottom: '12px' }} />
                <p style={{ fontSize: '14px' }}>Hôm nay bạn không có lịch làm việc nào được phân công.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {toast.show && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
    </div>
  );
}

export default StaffHRPage;
