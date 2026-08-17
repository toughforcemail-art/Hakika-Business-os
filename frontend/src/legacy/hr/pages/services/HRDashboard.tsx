// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/legacy/hr/layouts/DashboardLayout';
import { Users, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/legacy/hr/utils/supabase';
import { useAccess } from '@/legacy/hr/hooks/useAccess';

export default function HRDashboard() {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_employees: 0,
    active_employees: 0,
    on_leave: 0,
    pending_approvals: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        if (!profile?.company_code) return;

        // Fetch basic HR stats
        const [empRes, leaveRes] = await Promise.all([
          supabase
            .from('employees')
            .select('id', { count: 'exact', head: true })
            .eq('company_code', profile.company_code)
            .eq('is_active', true),
          supabase
            .from('leave_requests')
            .select('id', { count: 'exact', head: true })
            .eq('company_code', profile.company_code)
            .eq('status', 'pending'),
        ]);

        setStats({
          total_employees: empRes.count || 0,
          active_employees: empRes.count || 0,
          on_leave: 0,
          pending_approvals: leaveRes.count || 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [profile?.company_code]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">HR Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage payroll, leave requests, and employee records</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Employees"
            value={stats.total_employees}
            icon={<Users className="text-blue-500" />}
            trend="+2.5%"
          />
          <KpiCard
            label="Active Now"
            value={stats.active_employees}
            icon={<TrendingUp className="text-green-500" />}
            trend="↑ from yesterday"
          />
          <KpiCard
            label="On Leave"
            value={stats.on_leave}
            icon={<Clock className="text-amber-500" />}
            trend="Today"
          />
          <KpiCard
            label="Pending Approvals"
            value={stats.pending_approvals}
            icon={<AlertCircle className="text-red-500" />}
            trend="Action needed"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <ActionCard
            title="Add Employee"
            description="Create new employee record"
            onClick={() => navigate('/hr/add-employee')}
          />
          <ActionCard
            title="Leave Requests"
            description="Review pending leave approvals"
            onClick={() => navigate('/hr/leave-approvals')}
          />
          <ActionCard
            title="Payroll"
            description="Manage payroll and deductions"
            onClick={() => navigate('/hr/payroll')}
          />
        </div>

        {/* Placeholder for additional content */}
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-600">More HR features coming soon...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}

function KpiCard({ label, value, icon, trend }: any) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{trend}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ title, description, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-gray-200 bg-white p-6 text-left transition-all hover:shadow-md"
    >
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
    </button>
  );
}
