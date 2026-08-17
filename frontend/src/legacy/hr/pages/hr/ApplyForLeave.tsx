// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, CheckCircle, Plus, X } from 'lucide-react';

import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import Toast from '../../components/Toast';

interface LeaveType {
  id: string;
  name: string;
  description: string;
  max_days_per_year: number;
  requires_approval: boolean;
  is_paid: boolean;
  requires_balance_check: boolean;
  min_notice_days: number;
  allow_negative_balance: boolean;
  document_required: boolean;
  document_after_days: number | null;
  gender_restriction: 'any' | 'male' | 'female';
}

type LeaveUrgency = 'normal' | 'urgent' | 'emergency';

interface LeaveBalance {
  leave_type_id: string;
  leave_type_name: string;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

const ApplyForLeave: React.FC = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [employmentStartDate, setEmploymentStartDate] = useState<string | null>(null)
  const [employeeGender, setEmployeeGender] = useState('')

  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    urgency: 'normal' as LeaveUrgency
  })

  const [selectedBalance, setSelectedBalance] = useState<LeaveBalance | null>(null)

  const [showTypeModal, setShowTypeModal] = useState(false)
  const [newTypeData, setNewTypeData] = useState({ name: '', description: '', max_days_per_year: 21 })
  const [addingType, setAddingType] = useState(false)

  const currentYearStart = `${new Date().getFullYear()}-01-01`
  const minStartDate = employmentStartDate && employmentStartDate > currentYearStart
    ? employmentStartDate
    : currentYearStart

  useEffect(() => {
    fetchData()
  }, [])


  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('employment_start_date, gender')
        .eq('id', user.id)
        .single()
      setEmploymentStartDate(profile?.employment_start_date || null)
      setEmployeeGender((profile?.gender || '').toLowerCase())

      const { data: types } = await supabase.from('leave_types').select('*').eq('is_active', true)
      setLeaveTypes(types || [])

      const { data: balData } = await supabase
        .from('leave_balances')
        .select(`
          leave_type_id,
          total_days,
          used_days,
          remaining_days,
          leave_types(name)
        `)
        .eq('employee_id', user.id)
        .eq('year', new Date().getFullYear())

      const formattedBalances = (balData || []).map((b: any) => ({
        leave_type_id: b.leave_type_id,
        leave_type_name: b.leave_types.name,
        total_days: b.total_days,
        used_days: b.used_days,
        remaining_days: b.remaining_days
      }))
      setBalances(formattedBalances)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const parseDate = (value: string) => {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date
  }

  const daysInMonth = (year: number, monthIndex: number) => {
    return new Date(year, monthIndex + 1, 0).getDate()
  }

  const getCadence = (name: string) => {
    const normalized = name.toLowerCase()
    if (normalized.includes('monthly')) return 'monthly' as const
    if (normalized.includes('quarterly')) return 'quarterly' as const
    if (normalized.includes('yearly')) return 'yearly' as const
    return null
  }

  const isAlignedToEmploymentStart = (leaveStart: Date, employmentStart: Date, cadence: 'monthly' | 'quarterly' | 'yearly') => {
    const targetDay = employmentStart.getDate()
    const maxDayInMonth = daysInMonth(leaveStart.getFullYear(), leaveStart.getMonth())
    const normalizedStartDay = Math.min(targetDay, maxDayInMonth)

    if (leaveStart.getDate() !== normalizedStartDay) return false

    if (cadence === 'yearly') {
      return leaveStart.getMonth() === employmentStart.getMonth()
    }

    if (cadence === 'quarterly') {
      const monthDiff = (leaveStart.getMonth() - employmentStart.getMonth() + 12) % 12
      return monthDiff % 3 === 0
    }

    return true
  }

  const calculateDays = (start: string, end: string): number => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    let days = 0
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) days++
    }
    return days
  }

  const handleLeaveTypeChange = (leaveTypeId: string) => {
    setFormData({ ...formData, leave_type_id: leaveTypeId })
    const balance = balances.find(b => b.leave_type_id === leaveTypeId)
    setSelectedBalance(balance || null)
  }

  const selectedType = leaveTypes.find(type => type.id === formData.leave_type_id) || null
  const requestedDays = formData.start_date && formData.end_date ? calculateDays(formData.start_date, formData.end_date) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (!formData.leave_type_id) throw new Error('Please select a leave type')

      if (!employmentStartDate) {
        throw new Error('Employment start date not found. Please contact HR.')
      }

      const startDate = parseDate(formData.start_date)
      const endDate = parseDate(formData.end_date)
      const employmentDate = parseDate(employmentStartDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const daysUntilLeave = Math.floor((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      const selectedType = leaveTypes.find(type => type.id === formData.leave_type_id)
      if (!selectedType) throw new Error('Selected leave type was not found')

      if (selectedType.min_notice_days > 0 && daysUntilLeave < selectedType.min_notice_days) {
        throw new Error(`${selectedType.name} must be applied at least ${selectedType.min_notice_days} days in advance`)
      }

      if (startDate < employmentDate || endDate < employmentDate) {
        throw new Error('Leave dates cannot be before your employment start date')
      }

      if (selectedType.gender_restriction !== 'any' && employeeGender && selectedType.gender_restriction !== employeeGender) {
        throw new Error(`${selectedType.name} is only available to ${selectedType.gender_restriction} employees`)
      }

      const cadence = getCadence(selectedType?.name || '')
      if (cadence) {
        const aligned = isAlignedToEmploymentStart(startDate, employmentDate, cadence)
        if (!aligned) {
          throw new Error(`For ${selectedType?.name}, the leave start date must align with your employment start day`)
        }
      }

      const totalDays = calculateDays(formData.start_date, formData.end_date)

      if (selectedType.max_days_per_year > 0 && totalDays > selectedType.max_days_per_year) {
        throw new Error(`${selectedType.name} is limited to ${selectedType.max_days_per_year} day(s).`)
      }

      if (selectedType.requires_balance_check) {
        const balance = balances.find(b => b.leave_type_id === formData.leave_type_id)
        if (!balance) throw new Error(`Leave balance not found for ${selectedType.name}`)

        if (!selectedType.allow_negative_balance && totalDays > balance.remaining_days) {
          throw new Error(`Insufficient leave balance. You have ${balance.remaining_days} days remaining.`)
        }
      }

      const { error } = await supabase.from('leave_requests').insert({
        employee_id: user.id,
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        total_days: totalDays,
        reason: formData.reason,
        urgency: formData.urgency,
        status: 'pending'
      })

      if (error) throw error

      setToast({ message: 'Leave request submitted successfully!', type: 'success' })
      setSubmitted(true)
      setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '', urgency: 'normal' })
      setSelectedBalance(null)
      
      setTimeout(() => {
        setSubmitted(false)
        fetchData()
      }, 3000)
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to submit request', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddLeaveType = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingType(true)
    try {
      const { error } = await supabase.from('leave_types').insert({
        ...newTypeData,
        is_active: true,
        requires_approval: true,
        is_paid: true,
        requires_balance_check: true,
        min_notice_days: 7,
        allow_negative_balance: false,
        document_required: false,
        gender_restriction: 'any'
      })

      if (error) throw error

      setToast({ message: 'New leave type added successfully!', type: 'success' })
      setShowTypeModal(false)
      setNewTypeData({ name: '', description: '', max_days_per_year: 21 })
      fetchData()
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to add leave type', type: 'error' })
    } finally {
      setAddingType(false)
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <CustomLoader size={40} label="Loading leave data..." />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-[#020817] min-h-screen">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Apply for Leave</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Submit a new leave request</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Balances */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Leave Balance</h2>
            <div className="space-y-3">
              {balances.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No leave balances available</p>
              ) : (
                balances.map((balance) => (
                  <div
                    key={balance.leave_type_id}
                    onClick={() => handleLeaveTypeChange(balance.leave_type_id)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedBalance?.leave_type_id === balance.leave_type_id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700'
                        : 'bg-gray-50 dark:bg-[#0A1628] border border-gray-200 dark:border-[#1e293b] hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLeaveTypeChange(balance.leave_type_id); }}
                    title={`Select ${balance.leave_type_name} as leave type`}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{balance.leave_type_name}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{balance.remaining_days}</span>
                      <span className="text-xs text-gray-500">/ {balance.total_days} days</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Used: {balance.used_days} days</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Application Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-6">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Request Submitted!</h3>
                <p className="text-gray-600 dark:text-gray-300 text-center">
                  Your leave request has been submitted successfully. Your manager will review it shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Leave Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.leave_type_id}
                      onChange={(e) => handleLeaveTypeChange(e.target.value)}
                      title="Select leave type"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select a leave type</option>
                      {leaveTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowTypeModal(true)}
                      title="Add new leave type category"
                      className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {selectedType?.requires_balance_check && selectedBalance && (
                    <p className="text-xs text-gray-500 mt-1">
                      Available: {selectedBalance.remaining_days} days
                    </p>
                  )}
                  {selectedType && !selectedType.requires_balance_check && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      This leave type does not use your normal leave balance.
                    </p>
                  )}
                  {(() => {
                    const cadence = getCadence(selectedType?.name || '')
                    if (!cadence) return null
                    return (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {selectedType?.name} must start on your employment start day.
                      </p>
                    )
                  })()}
                  {selectedType && (
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
                      <p className="font-semibold">{selectedType.name} policy</p>
                      <p className="mt-1">Minimum notice: {selectedType.min_notice_days} day(s).</p>
                      <p className="mt-1">{selectedType.is_paid ? 'Paid leave.' : 'Unpaid leave.'}</p>
                      <p className="mt-1">
                        {selectedType.requires_balance_check ? 'Balance will be checked before submission.' : 'Balance will not be checked before submission.'}
                      </p>
                      {selectedType.gender_restriction !== 'any' && (
                        <p className="mt-1">Eligibility: {selectedType.gender_restriction} employees only.</p>
                      )}
                      {selectedType.document_required && (
                        <p className="mt-1">
                          Supporting document required
                          {selectedType.document_after_days ? ` after ${selectedType.document_after_days} day(s)` : ''}.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      min={minStartDate}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      title="Leave start date"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />

                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      min={formData.start_date || minStartDate}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      title="Leave end date"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />

                  </div>
                </div>

                {formData.start_date && formData.end_date && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                        Total working days: {calculateDays(formData.start_date, formData.end_date)}
                      </p>
                      {selectedType?.requires_balance_check && selectedBalance && requestedDays > selectedBalance.remaining_days && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Exceeds available balance
                        </p>
                      )}
                      {selectedType?.document_required && requestedDays >= (selectedType.document_after_days || 1) && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Supporting documentation will be required for this request.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Request Priority
                  </label>
                  <select
                    value={formData.urgency}
                    onChange={(e) => setFormData({ ...formData, urgency: e.target.value as LeaveUrgency })}
                    title="Select request priority"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Use urgent or emergency only when the request needs faster review because of a time-sensitive situation.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Please provide a reason for your leave request..."
                    title="Reason for leave"
                    required
                  />
                </div>

                <div className="bg-gray-50 dark:bg-[#0A1628] border border-gray-200 dark:border-[#1e293b] rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Your leave request will be submitted for approval. Your manager will review and approve or reject it within 2-3 business days.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !formData.leave_type_id || !formData.start_date || !formData.end_date || !formData.reason}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  title="Submit your leave request for approval"
                >
                  {submitting ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Quick Add Leave Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="text-blue-600" size={20} />
                Quick Add Leave Type
              </h3>
              <button 
                onClick={() => setShowTypeModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddLeaveType} className="p-6 space-y-4">
              <div>
                <label htmlFor="new-type-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  id="new-type-name"
                  type="text"
                  required
                  value={newTypeData.name}
                  onChange={(e) => setNewTypeData({...newTypeData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Study Leave"
                />
              </div>
              <div>
                <label htmlFor="new-type-days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Days / Year *</label>
                <input
                  id="new-type-days"
                  type="number"
                  required
                  min="1"
                  value={newTypeData.max_days_per_year}
                  onChange={(e) => setNewTypeData({...newTypeData, max_days_per_year: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="new-type-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  id="new-type-desc"
                  rows={3}
                  value={newTypeData.description}
                  onChange={(e) => setNewTypeData({...newTypeData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Optional description..."
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-[#1e293b] text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingType}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  title="Save the new leave type to the database"
                >
                  {addingType ? 'Adding...' : 'Add Leave Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default ApplyForLeave
