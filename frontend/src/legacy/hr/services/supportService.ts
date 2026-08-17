// @ts-nocheck
import { supportAgents, supportArticles, supportCustomers, supportEscalations, supportSla, supportTemplates, supportTickets } from '../mock/platform/support';
export type SupportAuditEvent = { id: string; action: string; actor: string; target: string; createdAt: string };
const auditEvents: SupportAuditEvent[] = [];
const record = (action: string, target: string) => {
  auditEvents.unshift({ id: `audit-${Date.now()}-${auditEvents.length}`, action, actor: 'Director Alice', target, createdAt: new Date().toISOString() });
};
export const SupportService = {
  getTickets: () => supportTickets,
  getAgents: () => supportAgents,
  getCustomers: () => supportCustomers,
  getEscalations: () => supportEscalations,
  getSla: () => supportSla,
  getArticles: () => supportArticles,
  getTemplates: () => supportTemplates,
  getAuditEvents: () => auditEvents,
  audit: record,
};
export const TicketService = { list: () => supportTickets };
export const ConversationService = { list: () => supportTickets.map((ticket) => ({ id: `conversation-${ticket.id}`, ticketId: ticket.id, customer: ticket.customer, agent: ticket.assignedAgent, messages: [] })) };
export const KnowledgeBaseService = { list: () => supportArticles };
export const SupportAnalyticsService = { summary: () => ({ open: 18, waitingCustomer: 7, waitingAgent: 11, escalated: 4, closedToday: 26, satisfaction: '94%' }) };
export const TemplateService = { list: () => supportTemplates };
