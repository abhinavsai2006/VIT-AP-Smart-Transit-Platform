'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Complaint, ComplaintMessage } from '@/types/transit';
import { useAuth } from '@/lib/auth/auth-context';
import {
  AlertTriangle,
  MessageSquare,
  CheckCircle,
  Clock,
  Send,
  Filter,
  Search,
  User,
} from 'lucide-react';

export default function AdminComplaintsPage() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [replyMessage, setReplyMessage] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [statusChange, setStatusChange] = useState<Complaint['status']>('under_review');
  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/complaints');
      const data = await res.json();
      setComplaints(data.complaints || []);
      if (data.complaints && data.complaints.length > 0 && !selectedCaseId) {
        setSelectedCaseId(data.complaints[0].id);
      }
    } catch (err) {
      console.error('Failed to load admin complaints', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const selectedComplaint = complaints.find((c) => c.id === selectedCaseId) || complaints[0];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedComplaint) return;

    setSubmitting(true);

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_message',
          complaintId: selectedComplaint.id,
          senderId: user.id,
          senderName: `${user.fullName} (Support Desk)`,
          senderRole: 'support_operator',
          message: replyMessage.trim(),
        }),
      });

      if (res.ok) {
        setReplyMessage('');
        await fetchComplaints();
      } else {
        alert('Failed to send staff response');
      }
    } catch {
      alert('Network error while replying to passenger.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedComplaint) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          id: selectedComplaint.id,
          status: statusChange,
          resolutionNotes: resolutionNotes || undefined,
        }),
      });

      if (res.ok) {
        await fetchComplaints();
        alert(`Case ${selectedComplaint.caseNumber} updated to ${statusChange.toUpperCase()}.`);
      } else {
        alert('Failed to update status');
      }
    } catch {
      alert('Network error while updating case status.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = complaints.filter((c) =>
    statusFilter === 'all' ? true : c.status === statusFilter
  );

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container">
        {/* Breadcrumb */}
        <div style={{ marginBottom: '16px' }}>
          <Link href="/admin" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
            ← Back to Admin Console
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: 'var(--color-primary)',
              marginBottom: '6px',
            }}
          >
            Customer Care & Resolution
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 700, marginBottom: '8px' }}>
            Passenger Complaints Management
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '760px', margin: 0 }}>
            Investigate reported delays, unsafe driving flags, lost property, and hygiene concerns. Communicate responses and maintain an auditable resolution history.
          </p>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('all')}
          >
            All Cases ({complaints.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'submitted' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('submitted')}
          >
            Submitted ({complaints.filter((c) => c.status === 'submitted').length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'under_review' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('under_review')}
          >
            Under Review ({complaints.filter((c) => c.status === 'under_review').length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'resolved' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('resolved')}
          >
            Resolved ({complaints.filter((c) => c.status === 'resolved').length})
          </button>
        </div>

        {/* 2-Column: Cases List + Detail/Reply Workspace */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '32px',
            alignItems: 'start',
          }}
        >
          {/* List of cases */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filtered.map((c) => {
              const isSelected = selectedComplaint?.id === c.id;

              return (
                <div
                  key={c.id}
                  className="card"
                  onClick={() => {
                    setSelectedCaseId(c.id);
                    setStatusChange(c.status);
                  }}
                  style={{
                    cursor: 'pointer',
                    padding: '20px',
                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
                    backgroundColor: isSelected ? 'var(--color-surface-card)' : '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {c.caseNumber}
                    </span>
                    <span className="badge badge-info">{c.status}</span>
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 700, textTransform: 'capitalize', marginBottom: '4px' }}>
                    {c.category.replace('_', ' ')}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '8px' }}>
                    Reported by: <strong>{c.passengerName}</strong>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--color-body)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right Column: Case Management Workspace */}
          {selectedComplaint && (
            <div style={{ position: 'sticky', top: '80px' }}>
              <div className="card" style={{ padding: 0, backgroundColor: '#ffffff', border: '1px solid var(--color-hairline-strong)' }}>
                {/* Header */}
                <div style={{ padding: '20px', backgroundColor: 'var(--color-surface-dark)', color: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#93c5fd', fontWeight: 700 }}>
                      CASE FILE: {selectedComplaint.caseNumber}
                    </span>
                    <span className="badge badge-success">{selectedComplaint.status.toUpperCase()}</span>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, textTransform: 'capitalize' }}>
                    {selectedComplaint.category.replace('_', ' ')} Report
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--color-on-dark-soft)', marginTop: '4px' }}>
                    Complainant: {selectedComplaint.passengerName} (User: {selectedComplaint.userId})
                  </div>
                </div>

                {/* Initial Description */}
                <div style={{ padding: '20px', backgroundColor: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-hairline)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '4px' }}>
                    Passenger Statement:
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--color-ink)', margin: 0 }}>
                    {selectedComplaint.description}
                  </p>
                </div>

                {/* Status Update Control Bar */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-hairline)', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Change Status:</span>
                  <select
                    className="form-select"
                    value={statusChange}
                    onChange={(e) => setStatusChange(e.target.value as Complaint['status'])}
                    style={{ height: '36px', fontSize: '13px', width: 'auto' }}
                  >
                    <option value="submitted">Submitted</option>
                    <option value="under_review">Under Review</option>
                    <option value="action_required">Action Required</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected / Unsubstantiated</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleUpdateStatus}
                    disabled={submitting}
                    style={{ height: '36px' }}
                  >
                    Update Status
                  </button>
                </div>

                {/* Messages conversation */}
                <div style={{ padding: '20px', maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedComplaint.messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: m.senderRole === 'support_operator' ? 'var(--color-surface-card)' : 'rgba(28, 105, 212, 0.08)',
                        border: '1px solid var(--color-hairline)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                        <strong>{m.senderName} ({m.senderRole})</strong>
                        <span style={{ color: 'var(--color-muted)' }}>{new Date(m.sentAt).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--color-body)' }}>{m.message}</div>
                    </div>
                  ))}
                </div>

                {/* Reply Form */}
                <form
                  onSubmit={handleSendMessage}
                  style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--color-hairline)',
                    backgroundColor: 'var(--color-surface-soft)',
                    display: 'flex',
                    gap: '8px',
                  }}
                >
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type official staff response to passenger..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    style={{ height: '40px', fontSize: '13px' }}
                    required
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={submitting || !replyMessage.trim()}
                  >
                    <Send size={14} /> Send Reply
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
