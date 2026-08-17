// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  FileText,
  Mail,
  Plus,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomToast, { ToastType, sanitizeError } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { supabase } from '../../utils/supabase';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { activityLogger } from '../../utils/activityLogger';

type RecommendationPriority = 'low' | 'medium' | 'high' | 'critical';
type RecommendationStatus = 'new' | 'under_review' | 'actioned' | 'closed';

interface SecurityRecommendation {
  id: string;
  organization_id: string | null;
  document_title: string;
  submitted_by: string;
  record_type: string;
  module: string;
  priority: RecommendationPriority;
  purpose: string | null;
  source_channel: string | null;
  source_reference: string | null;
  summary: string | null;
  raw_content: string;
  security_assessment: string | null;
  recommended_action: string | null;
  status: RecommendationStatus;
  tags: string[] | null;
  created_at: string;
}

interface RecommendationFormState {
  documentTitle: string;
  submittedBy: string;
  recordType: string;
  module: string;
  priority: RecommendationPriority;
  purpose: string;
  sourceChannel: string;
  sourceReference: string;
  summary: string;
  rawContent: string;
  securityAssessment: string;
  recommendedAction: string;
  status: RecommendationStatus;
  tags: string;
}

const panelCls =
  'rounded-[30px] border border-gray-200 bg-white/95 shadow-[0_30px_90px_-55px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const inputCls =
  'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]';
const labelCls =
  'mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300';
const subtleButtonCls =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]';
const primaryButtonCls =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:opacity-60';

const createForm = (): RecommendationFormState => ({
  documentTitle: '',
  submittedBy: '',
  recordType: 'recommendation',
  module: 'security',
  priority: 'medium',
  purpose: '',
  sourceChannel: 'email',
  sourceReference: '',
  summary: '',
  rawContent: '',
  securityAssessment: '',
  recommendedAction: '',
  status: 'new',
  tags: '',
});

const priorityClasses: Record<RecommendationPriority, string> = {
  low: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  critical: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

const statusClasses: Record<RecommendationStatus, string> = {
  new: 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200',
  under_review: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  actioned: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  closed: 'bg-slate-300 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200',
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const SecurityRecommendations: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();

  const [records, setRecords] = useState<SecurityRecommendation[]>([]);
  const [form, setForm] = useState<RecommendationFormState>(createForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [scopeNotice, setScopeNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchRecords = async () => {
    setLoading(true);

    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);
      setScopeNotice(scope.notice);

      let query = supabase
        .from('security_recommendations')
        .select(
          'id, organization_id, document_title, submitted_by, record_type, module, priority, purpose, source_channel, source_reference, summary, raw_content, security_assessment, recommended_action, status, tags, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(20);

      if (scope.organizationId) {
        query = query.eq('organization_id', scope.organizationId);
      } else if (profile?.id) {
        query = query.eq('reported_by', profile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRecords((data || []) as SecurityRecommendation[]);
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const updateForm = <K extends keyof RecommendationFormState>(key: K, value: RecommendationFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('No authenticated user found.');

      const tagList = form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const payload = {
        organization_id: organizationId,
        reported_by: user.id,
        document_title: form.documentTitle.trim(),
        submitted_by: form.submittedBy.trim(),
        record_type: form.recordType.trim().toLowerCase(),
        module: form.module.trim().toLowerCase(),
        priority: form.priority,
        purpose: form.purpose.trim() || null,
        source_channel: form.sourceChannel.trim().toLowerCase() || null,
        source_reference: form.sourceReference.trim() || null,
        summary: form.summary.trim() || null,
        raw_content: form.rawContent.trim(),
        security_assessment: form.securityAssessment.trim() || null,
        recommended_action: form.recommendedAction.trim() || null,
        status: form.status,
        tags: tagList,
      };

      const { error } = await supabase.from('security_recommendations').insert([payload]);
      if (error) throw error;

      activityLogger.log({
        actionType: 'create',
        actionCategory: 'security',
        resourceType: 'security_recommendation',
        resourceId: form.documentTitle.trim(),
        description: `Captured ${form.priority} ${form.recordType} record: ${form.documentTitle.trim()}`,
        metadata: payload,
      });

      setToast({ message: 'Security record captured successfully.', type: 'success' });
      setForm(createForm());
      await fetchRecords();
    } catch (error) {
      activityLogger.logError(sanitizeError(error), 'SecurityRecommendations:handleSubmit');
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full w-full bg-[radial-gradient(circle_at_top,_rgba(255,106,0,0.14),_transparent_42%),linear-gradient(180deg,_#f8fafc_0%,_#eef4f8_100%)] px-6 py-6 text-slate-900 dark:bg-dark-bg dark:text-white lg:px-10">
      <CustomToast
        isVisible={!!toast}
        message={toast?.message || ''}
        type={toast?.type}
        onClose={() => setToast(null)}
      />

      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className={`${panelCls} overflow-hidden`}>
          <div className="grid gap-8 px-6 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
                <Shield size={14} />
                Security Records
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/app/security/incidents')}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100"
                    title="Back to security incidents"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                      Recommendations Registry
                    </h1>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                      Record suspicious documents, email-driven recommendations, alerts, and analyst
                      follow-up so the security team can track them as structured evidence.
                    </p>
                  </div>
                </div>
              </div>
              {scopeNotice && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
                  {scopeNotice}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-[26px] border border-gray-200 bg-white/90 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Total Records</p>
                <p className="mt-3 text-3xl font-black text-slate-950 dark:text-white">{records.length}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Latest security evidence saved in this workspace.</p>
              </div>
              <div className="rounded-[26px] border border-rose-200 bg-rose-50/80 p-5 dark:border-rose-500/20 dark:bg-rose-500/10">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-rose-500">Critical Priority</p>
                <p className="mt-3 text-3xl font-black text-rose-700 dark:text-rose-300">
                  {records.filter((record) => record.priority === 'critical').length}
                </p>
                <p className="mt-2 text-sm text-rose-600 dark:text-rose-200">High-risk submissions waiting for deeper review.</p>
              </div>
              <div className="rounded-[26px] border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-500">Actioned</p>
                <p className="mt-3 text-3xl font-black text-emerald-700 dark:text-emerald-300">
                  {records.filter((record) => record.status === 'actioned' || record.status === 'closed').length}
                </p>
                <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-200">Records already handled or formally closed.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-8">
          <section className={`${panelCls} p-6 lg:p-8`}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Capture Record</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                  Add a new security recommendation
                </h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
                <Sparkles size={14} />
                Paste the full source content
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="document-title">
                    Document Title
                  </label>
                  <input
                    id="document-title"
                    className={inputCls}
                    placeholder="Motor Vehicle Trip Ticket"
                    value={form.documentTitle}
                    onChange={(event) => updateForm('documentTitle', event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="submitted-by">
                    Submitted By
                  </label>
                  <input
                    id="submitted-by"
                    className={inputCls}
                    placeholder="director@hakikarealestate.co.ke"
                    value={form.submittedBy}
                    onChange={(event) => updateForm('submittedBy', event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className={labelCls} htmlFor="record-type">
                    Type
                  </label>
                  <select
                    id="record-type"
                    className={inputCls}
                    value={form.recordType}
                    onChange={(event) => updateForm('recordType', event.target.value)}
                  >
                    <option value="recommendation">Recommendation</option>
                    <option value="alert">Alert</option>
                    <option value="advisory">Advisory</option>
                    <option value="incident">Incident</option>
                    <option value="evidence">Evidence</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="module-name">
                    Module
                  </label>
                  <input
                    id="module-name"
                    className={inputCls}
                    placeholder="security"
                    value={form.module}
                    onChange={(event) => updateForm('module', event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="priority">
                    Priority
                  </label>
                  <select
                    id="priority"
                    className={inputCls}
                    value={form.priority}
                    onChange={(event) => updateForm('priority', event.target.value as RecommendationPriority)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="status">
                    Status
                  </label>
                  <select
                    id="status"
                    className={inputCls}
                    value={form.status}
                    onChange={(event) => updateForm('status', event.target.value as RecommendationStatus)}
                  >
                    <option value="new">New</option>
                    <option value="under_review">Under Review</option>
                    <option value="actioned">Actioned</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="source-channel">
                    Source Channel
                  </label>
                  <select
                    id="source-channel"
                    className={inputCls}
                    value={form.sourceChannel}
                    onChange={(event) => updateForm('sourceChannel', event.target.value)}
                  >
                    <option value="email">Email</option>
                    <option value="manual">Manual Entry</option>
                    <option value="attachment">Attachment</option>
                    <option value="sms">SMS</option>
                    <option value="phone">Phone Call</option>
                    <option value="web">Web Intake</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="source-reference">
                    Source Reference
                  </label>
                  <input
                    id="source-reference"
                    className={inputCls}
                    placeholder="Message ID, case number, or phone number"
                    value={form.sourceReference}
                    onChange={(event) => updateForm('sourceReference', event.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls} htmlFor="purpose">
                  Purpose
                </label>
                <textarea
                  id="purpose"
                  className={inputCls}
                  rows={3}
                  placeholder="Describe the stated purpose of the document or communication."
                  value={form.purpose}
                  onChange={(event) => updateForm('purpose', event.target.value)}
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="summary">
                  Key Details / Summary
                </label>
                <textarea
                  id="summary"
                  className={inputCls}
                  rows={4}
                  placeholder="Capture the key instructions, observed red flags, or notable metadata."
                  value={form.summary}
                  onChange={(event) => updateForm('summary', event.target.value)}
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="raw-content">
                  Full Source Content
                </label>
                <textarea
                  id="raw-content"
                  className={inputCls}
                  rows={12}
                  placeholder="Paste the full document, email body, or extracted text here."
                  value={form.rawContent}
                  onChange={(event) => updateForm('rawContent', event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="assessment">
                    Security Assessment
                  </label>
                  <textarea
                    id="assessment"
                    className={inputCls}
                    rows={5}
                    placeholder="Explain why it is suspicious, benign, or needs escalation."
                    value={form.securityAssessment}
                    onChange={(event) => updateForm('securityAssessment', event.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="recommended-action">
                    Recommended Action
                  </label>
                  <textarea
                    id="recommended-action"
                    className={inputCls}
                    rows={5}
                    placeholder="Quarantine, review headers, notify users, isolate device, etc."
                    value={form.recommendedAction}
                    onChange={(event) => updateForm('recommendedAction', event.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls} htmlFor="tags">
                  Tags
                </label>
                <input
                  id="tags"
                  className={inputCls}
                  placeholder="phishing, transport, external-sender, critical"
                  value={form.tags}
                  onChange={(event) => updateForm('tags', event.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-5 dark:border-white/10">
                <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-300">
                  Each record keeps the source text and the analyst view together so security can track
                  suspicious submissions without losing the original wording.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setForm(createForm())}
                    className={subtleButtonCls}
                    disabled={saving}
                  >
                    Reset
                  </button>
                  <button type="submit" className={primaryButtonCls} disabled={saving}>
                    <Plus size={16} />
                    {saving ? 'Saving Record...' : 'Save Security Record'}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <section className={`${panelCls} p-6 lg:p-8`}>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Recent Records</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                  Security record history
                </h2>
              </div>
              <button type="button" onClick={fetchRecords} className={subtleButtonCls}>
                Refresh
              </button>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="rounded-[26px] border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
                  Loading security records...
                </div>
              ) : records.length === 0 ? (
                <div className="rounded-[26px] border border-dashed border-gray-200 px-5 py-10 text-center dark:border-white/10">
                  <ClipboardCheck className="mx-auto mb-4 text-slate-300 dark:text-slate-500" size={36} />
                  <p className="text-base font-semibold text-slate-700 dark:text-slate-100">No records captured yet</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                    The first suspicious document or recommendation saved here will appear in this feed.
                  </p>
                </div>
              ) : (
                records.map((record) => (
                  <article
                    key={record.id}
                    className="rounded-[28px] border border-gray-200 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
                            <FileText size={18} />
                          </span>
                          <div>
                            <h3 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
                              {record.document_title}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-300">
                              Saved {formatTimestamp(record.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${priorityClasses[record.priority]}`}
                          >
                            {record.priority}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${statusClasses[record.status]}`}
                          >
                            {record.status.replace('_', ' ')}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:bg-white/10 dark:text-slate-200">
                            {record.record_type}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:bg-white/10 dark:text-slate-200">
                            {record.module}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-[#082131] dark:text-slate-200">
                        <div className="flex items-center gap-2">
                          <Mail size={15} className="text-orange-500" />
                          <span className="font-semibold">{record.submitted_by}</span>
                        </div>
                        {record.source_channel && (
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                            {record.source_channel}
                          </p>
                        )}
                      </div>
                    </div>

                    {(record.purpose || record.summary) && (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 px-4 py-4 dark:bg-white/[0.04]">
                          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Purpose</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-200">
                            {record.purpose || 'No purpose recorded.'}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-4 dark:bg-white/[0.04]">
                          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Summary</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-200">
                            {record.summary || 'No summary captured.'}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-[#071c29]">
                      <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                        <AlertTriangle size={14} />
                        Source Content
                      </div>
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-200">
                        {record.raw_content}
                      </pre>
                    </div>

                    {(record.security_assessment || record.recommended_action || (record.tags || []).length > 0) && (
                      <div className="mt-4 grid gap-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-2xl bg-slate-50 px-4 py-4 dark:bg-white/[0.04]">
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Assessment</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-200">
                              {record.security_assessment || 'No assessment captured yet.'}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-4 dark:bg-white/[0.04]">
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Recommended Action</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-200">
                              {record.recommended_action || 'No action guidance recorded yet.'}
                            </p>
                          </div>
                        </div>

                        {(record.tags || []).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {(record.tags || []).map((tag) => (
                              <span
                                key={`${record.id}-${tag}`}
                                className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SecurityRecommendations;
