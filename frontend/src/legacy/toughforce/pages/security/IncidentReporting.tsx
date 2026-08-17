// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  MapPin,
  Plus,
  Printer,
  Search,
  Shield,
} from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { AnimatePresence, motion } from 'framer-motion';
import CustomLoader from '../../components/CustomLoader';
import CustomToast from '../../components/CustomToast';

type IncidentStatus = 'pending' | 'investigating' | 'under_investigation' | 'resolved' | 'closed';

const IncidentReporting: React.FC = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | IncidentStatus>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await fetchIncidents();
    setLoading(false);
  };

  const fetchIncidents = async () => {
    try {
      const { data } = await supabase
        .from('security_incidents')
        .select('*, security_sites(name), profiles(full_name)')
        .order('reported_at', { ascending: false });
      if (data) setIncidents(data);
    } catch (error) {
      console.error('Fetch error:', error);
      setToast({ message: 'Unable to load incident feed.', type: 'error' });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-amber-500 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
      case 'closed':
        return 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300';
      case 'investigating':
      case 'under_investigation':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
      default:
        return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle2 className="text-emerald-500" size={16} />;
      case 'investigating':
      case 'under_investigation':
        return <Clock className="text-amber-500 animate-pulse" size={16} />;
      case 'pending':
        return <Clock className="text-blue-500" size={16} />;
      case 'closed':
        return <CheckCircle2 className="text-gray-500" size={16} />;
      default:
        return <AlertCircle className="text-rose-500" size={16} />;
    }
  };

  const filteredIncidents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return incidents.filter((incident) => {
      const matchesStatus = statusFilter === 'all' ? true : incident.status === statusFilter;
      const matchesSeverity = severityFilter === 'all' ? true : incident.severity === severityFilter;
      const matchesSearch = normalizedSearch
        ? [incident.type, incident.description, incident.security_sites?.name, incident.profiles?.full_name]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedSearch))
        : true;

      return matchesStatus && matchesSeverity && matchesSearch;
    });
  }, [incidents, searchTerm, severityFilter, statusFilter]);

  const triageSummary = useMemo(() => {
    const activeStatuses = ['pending', 'investigating', 'under_investigation'];
    const open = incidents.filter((incident) => activeStatuses.includes(incident.status));
    const critical = open.filter((incident) => incident.severity === 'critical').length;
    const investigating = incidents.filter((incident) => ['investigating', 'under_investigation'].includes(incident.status)).length;
    const resolvedToday = incidents.filter((incident) => {
      if (incident.status !== 'resolved' && incident.status !== 'closed') {
        return false;
      }

      const reported = new Date(incident.reported_at);
      const today = new Date();
      return reported.toDateString() === today.toDateString();
    }).length;

    return {
      open: open.length,
      critical,
      investigating,
      resolvedToday,
      immediate: open
        .filter((incident) => incident.severity === 'critical' || incident.status === 'pending')
        .slice(0, 3),
    };
  }, [incidents]);

  const updateIncidentStatus = async (incidentId: string, status: IncidentStatus) => {
    setUpdatingId(incidentId);
    try {
      const { error } = await supabase.from('security_incidents').update({ status }).eq('id', incidentId);
      if (error) throw error;

      setIncidents((current) => current.map((incident) => (incident.id === incidentId ? { ...incident, status } : incident)));
      setToast({ message: `Incident moved to ${status.replace(/_/g, ' ')}.`, type: 'success' });
    } catch (error: any) {
      console.error('Status update error:', error);
      setToast({ message: error.message || 'Failed to update incident status.', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <CustomLoader label="Loading incident triage..." />;
  }

  return (
    <div className="min-h-full w-full space-y-8 bg-white p-6 text-gray-900 dark:bg-dark-bg dark:text-white lg:p-10">
      <CustomToast
        isVisible={!!toast}
        message={toast?.message || ''}
        type={toast?.type as any}
        onClose={() => setToast(null)}
      />

      <div className="flex flex-col items-start justify-between gap-6 border-b border-gray-200 pb-8 dark:border-dark-border md:flex-row md:items-center">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Shield className="text-brand-purple" /> Digital Occurrence Book (OB)
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Triage urgent incidents quickly, move investigations forward, and keep site supervisors aligned.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => printWorkspacePage()} className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10">
            <Printer size={16} /> Print
          </button>
          <button
            onClick={() => navigate('/app/security/incidents/new')}
            className="flex items-center gap-2 rounded-xl bg-brand-purple px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-purple/20 transition hover:bg-opacity-90"
          >
            <Plus size={16} /> Log Incident
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Open Incidents', value: triageSummary.open, tone: 'text-brand-purple bg-brand-purple/10' },
          { label: 'Critical Now', value: triageSummary.critical, tone: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10' },
          { label: 'Investigating', value: triageSummary.investigating, tone: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
          { label: 'Resolved Today', value: triageSummary.resolvedToday, tone: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <div className={`mb-3 inline-flex rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.18em] ${card.tone}`}>
              {card.label}
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search incident, site, officer..."
                  title="Search incidents"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="text-gray-400" size={16} />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as 'all' | IncidentStatus)}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="investigating">Investigating</option>
                    <option value="under_investigation">Under investigation</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <select
                  value={severityFilter}
                  onChange={(event) => setSeverityFilter(event.target.value as 'all' | 'critical' | 'high' | 'medium' | 'low')}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                >
                  <option value="all">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence>
              {filteredIncidents.map((incident) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  key={incident.id}
                  className="glass-card rounded-2xl border border-gray-200 p-6 transition-all hover:border-brand-purple/40 dark:border-white/10"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${getSeverityColor(incident.severity)} shadow-lg`}>
                        {incident.severity === 'critical' ? <AlertTriangle size={24} /> : <Info size={24} />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold">{incident.type}</h3>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${getSeverityColor(incident.severity)}`}>
                            {incident.severity}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${getStatusClasses(incident.status)}`}>
                            {incident.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-400">{incident.description}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4 dark:border-white/5">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <MapPin size={14} className="text-brand-purple" /> {incident.security_sites?.name || 'Unknown site'}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <Shield size={14} className="text-brand-purple" /> Reported by {incident.profiles?.full_name || 'Unknown officer'}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <Clock size={14} className="text-brand-purple" /> {new Date(incident.reported_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-[240px] flex-col gap-4 xl:items-end">
                      <div className="flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
                        {getStatusIcon(incident.status)}
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                          {incident.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        {incident.status === 'pending' && (
                          <button
                            type="button"
                            disabled={updatingId === incident.id}
                            onClick={() => void updateIncidentStatus(incident.id, 'investigating')}
                            className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-amber-600 disabled:opacity-60"
                          >
                            Take Up
                          </button>
                        )}
                        {(incident.status === 'investigating' || incident.status === 'under_investigation') && (
                          <button
                            type="button"
                            disabled={updatingId === incident.id}
                            onClick={() => void updateIncidentStatus(incident.id, 'resolved')}
                            className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-600 disabled:opacity-60"
                          >
                            Mark Resolved
                          </button>
                        )}
                        {incident.status === 'resolved' && (
                          <button
                            type="button"
                            disabled={updatingId === incident.id}
                            onClick={() => void updateIncidentStatus(incident.id, 'closed')}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-100"
                          >
                            Close Case
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {!loading && filteredIncidents.length === 0 && (
              <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-20 text-center dark:border-white/5 dark:bg-white/2">
                <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-400">No incidents match this triage view</h3>
                <p className="mt-2 text-xs text-gray-500">Try resetting your filters or log a new incident.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm dark:border-rose-400/20 dark:bg-rose-500/10">
            <div className="mb-4 flex items-center gap-3">
              <AlertTriangle className="text-rose-500" size={18} />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-600 dark:text-rose-200">Immediate Triage</p>
                <h2 className="text-lg font-black text-rose-700 dark:text-white">Needs supervisor attention</h2>
              </div>
            </div>
            <div className="space-y-3">
              {triageSummary.immediate.map((incident) => (
                <div key={incident.id} className="rounded-2xl border border-rose-200 bg-white/70 p-4 dark:border-rose-400/15 dark:bg-white/[0.04]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{incident.type}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{incident.security_sites?.name || 'Unknown site'}</p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${getSeverityColor(incident.severity)}`}>
                      {incident.severity}
                    </span>
                  </div>
                </div>
              ))}
              {triageSummary.immediate.length === 0 && (
                <p className="text-sm text-rose-700/80 dark:text-rose-100/80">No incident is waiting in the immediate-action queue.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Triage Playbook</h3>
            <div className="mt-4 space-y-3">
              {[
                'Move fresh incidents from pending into investigating as soon as an officer is assigned.',
                'Keep critical incidents visible until the team marks them resolved or closes the case.',
                'Use the filters to isolate one site or severity level before shift handover.',
              ].map((note) => (
                <div key={note} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                  {note}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentReporting;
