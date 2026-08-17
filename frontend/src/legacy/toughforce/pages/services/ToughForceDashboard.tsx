// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/legacy/toughforce/layouts/DashboardLayout';
import { Shield, Users, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '@/legacy/toughforce/utils/supabase';
import { useAccess } from '@/legacy/toughforce/hooks/useAccess';

export default function ToughForceDashboard() {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_guards: 0,
    on_duty: 0,
    scheduled_shifts: 0,
    incidents: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        if (!profile?.company_code) return;

        // Fetch security stats
        const [guardRes, shiftRes, incidentRes] = await Promise.all([
          supabase
            .from('guards')
            .select('id', { count: 'exact', head: true })
            .eq('company_code', profile.company_code)
            .eq('is_active', true),
          supabase
            .from('guard_rosters')
            .select('id', { count: 'exact', head: true })
            .eq('company_code', profile.company_code),
          supabase
            .from('incident_reports')
            .select('id', { count: 'exact', head: true })
            .eq('company_code', profile.company_code)
            .eq('status', 'open'),
        ]);

        setStats({
          total_guards: guardRes.count || 0,
          on_duty: 0,
          scheduled_shifts: shiftRes.count || 0,
          incidents: incidentRes.count || 0,
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
          <h1 className="text-3xl font-bold text-gray-900">Security Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage guards, shifts, and incident reporting</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Guards"
            value={stats.total_guards}
            icon={<Shield className="text-red-500" />}
            trend="Active personnel"
          />
          <KpiCard
            label="On Duty"
            value={stats.on_duty}
            icon={<Users className="text-green-500" />}
            trend="Currently deployed"
          />
          <KpiCard
            label="Scheduled Shifts"
            value={stats.scheduled_shifts}
            icon={<Calendar className="text-blue-500" />}
            trend="This month"
          />
          <KpiCard
            label="Open Incidents"
            value={stats.incidents}
            icon={<AlertCircle className="text-red-500" />}
            trend="Requiring attention"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <ActionCard
            title="Add Guard"
            description="Register new security personnel"
            onClick={() => navigate('/security/guards/add')}
          />
          <ActionCard
            title="Create Shift"
            description="Schedule guard duties"
            onClick={() => navigate('/security/rosters')}
          />
          <ActionCard
            title="Report Incident"
            description="Log security incident"
            onClick={() => navigate('/security/incidents/report')}
          />
        </div>

        {/* Placeholder for additional content */}
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-600">More security features coming soon...</p>
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
