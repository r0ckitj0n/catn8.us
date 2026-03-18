import React from 'react';

import { ACCUMUL8_SAVE_BUTTON_EMOJI } from '../../accumul8/accumul8Ui';

type NotificationRule = {
  id: number;
  rule_name: string;
  target_scope: 'group' | 'custom';
  days_before_due: number;
  is_active: number;
};

type NotificationFormState = {
  rule_name: string;
  target_scope: 'group' | 'custom';
  days_before_due: number;
  custom_user_ids: string;
  email_subject_template: string;
  email_body_template: string;
};

type NotificationPayload = {
  rule_name: string;
  target_scope: 'group' | 'custom';
  days_before_due: number;
  custom_user_ids: number[];
  email_subject_template: string;
  email_body_template: string;
};

interface Accumul8NotificationsTabProps {
  beginEditNotificationRule: (id: number) => void;
  busy: boolean;
  createNotificationRule: (payload: NotificationPayload) => Promise<unknown>;
  deleteNotificationRule: (id: number) => Promise<unknown>;
  editingNotificationRuleId: number | null;
  notificationForm: NotificationFormState;
  notificationRules: NotificationRule[];
  parseCustomUserIds: (value: string) => number[];
  resetNotificationForm: () => void;
  sendNotification: (payload: { rule_id: number }) => Promise<unknown>;
  setNotificationForm: React.Dispatch<React.SetStateAction<NotificationFormState>>;
  toggleNotificationRule: (id: number) => Promise<unknown>;
  updateNotificationRule: (id: number, payload: NotificationPayload) => Promise<unknown>;
}

export function Accumul8NotificationsTab({
  beginEditNotificationRule,
  busy,
  createNotificationRule,
  deleteNotificationRule,
  editingNotificationRuleId,
  notificationForm,
  notificationRules,
  parseCustomUserIds,
  resetNotificationForm,
  sendNotification,
  setNotificationForm,
  toggleNotificationRule,
  updateNotificationRule,
}: Accumul8NotificationsTabProps) {
  return (
    <div className="accumul8-panel accumul8-panel--viewport-fill">
      <div className="accumul8-panel-toolbar">
        <div>
          <h3 className="mb-1">Notification Rules</h3>
          <p className="small text-muted mb-0">Build due-date alerts with the same ledger styling as the rest of Accumul8.</p>
        </div>
      </div>
      <form
        className="row g-2 accumul8-notification-form"
        onSubmit={(e) => {
          e.preventDefault();
          const payload = {
            ...notificationForm,
            days_before_due: Number(notificationForm.days_before_due),
            custom_user_ids: parseCustomUserIds(notificationForm.custom_user_ids),
          };
          if (editingNotificationRuleId) {
            void updateNotificationRule(editingNotificationRuleId, payload).then(() => resetNotificationForm());
            return;
          }
          void createNotificationRule(payload).then(() => resetNotificationForm());
        }}
      >
        <div className="col-md-3"><input className="form-control" placeholder="Rule Name" value={notificationForm.rule_name} onChange={(e) => setNotificationForm((v) => ({ ...v, rule_name: e.target.value }))} required /></div>
        <div className="col-md-2"><select className="form-select" value={notificationForm.target_scope} onChange={(e) => setNotificationForm((v) => ({ ...v, target_scope: e.target.value as 'group' | 'custom' }))}><option value="group">Linked access groups + admins</option><option value="custom">Custom user IDs</option></select></div>
        <div className="col-md-1"><input className="form-control" type="number" min={0} max={90} value={notificationForm.days_before_due} onChange={(e) => setNotificationForm((v) => ({ ...v, days_before_due: Number(e.target.value) }))} /></div>
        <div className="col-md-2"><input className="form-control" placeholder="User IDs (1,2,3)" value={notificationForm.custom_user_ids} onChange={(e) => setNotificationForm((v) => ({ ...v, custom_user_ids: e.target.value }))} /></div>
        <div className="col-md-4"><input className="form-control" placeholder="Email Subject" value={notificationForm.email_subject_template} onChange={(e) => setNotificationForm((v) => ({ ...v, email_subject_template: e.target.value }))} required /></div>
        <div className="col-md-10"><textarea className="form-control" rows={2} placeholder="Email Body" value={notificationForm.email_body_template} onChange={(e) => setNotificationForm((v) => ({ ...v, email_body_template: e.target.value }))} required /></div>
        <div className="col-md-2">
          <div className="accumul8-notification-actions">
            <button
              className="btn btn-success flex-fill"
              type="submit"
              disabled={busy}
              aria-label={editingNotificationRuleId ? 'Save notification rule' : 'Create notification rule'}
              title={editingNotificationRuleId ? 'Save notification rule' : 'Create notification rule'}
            >
              <span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span>
            </button>
          </div>
        </div>
        {editingNotificationRuleId ? <div className="col-md-2"><div className="accumul8-notification-actions"><button className="btn btn-outline-secondary flex-fill" type="button" onClick={resetNotificationForm} disabled={busy}>Cancel</button></div></div> : null}
      </form>
      <div className="mt-3 d-flex flex-column gap-2 accumul8-scroll-area accumul8-scroll-area--cards">
        {notificationRules.map((r) => (
          <div key={r.id} className="catn8-card d-flex justify-content-between align-items-center gap-2 accumul8-list-item accumul8-notification-card">
            <div>
              <div className="fw-bold">{r.rule_name}</div>
              <div className="text-muted small">{r.target_scope === 'group' ? 'Group recipients' : 'Custom recipients'} | {r.days_before_due} day lead</div>
            </div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void sendNotification({ rule_id: r.id })} disabled={busy}>Send Now</button>
              <button type="button" className={`btn btn-sm ${r.is_active ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => void toggleNotificationRule(r.id)}>{r.is_active ? 'Active' : 'Paused'}</button>
              <div className="accumul8-row-actions">
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => beginEditNotificationRule(r.id)} disabled={busy} aria-label={`Edit ${r.rule_name}`}><i className="bi bi-pencil"></i></button>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { if (window.confirm('Delete this notification rule?')) { void deleteNotificationRule(r.id); } }} disabled={busy} aria-label={`Delete ${r.rule_name}`}><i className="bi bi-trash"></i></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
