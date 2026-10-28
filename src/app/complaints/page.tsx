'use client';

import React, { useState, useEffect } from 'react';
import { Complaint, ComplaintMessage } from '@/types/transit';
import { useAuth } from '@/lib/auth/auth-context';
import {
  MessageSquare,
  AlertCircle,
  Clock,
  CheckCircle,
  Send,
  PlusCircle,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export default function ComplaintsPage() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // New Complaint Form
  const [showNewForm, setShowNewForm] = useState(false);
  const [category, setCategory] = useState<Complaint['category']>('cleanliness');
  const [description, setDescription] = useState('');
  const [tripId, setTripId] = useState('');
  const [busId, setBusId] = useState('');
  const [priority, setPriority] = useState<Complaint['priority']>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Message reply
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/complaints?userId=${user.id}`);
      const data = await res.json();
      setComplaints(data.complaints || []);
      if (data.complaints && data.complaints.length > 0 && !selectedCaseId) {
        setSelectedCaseId(data.complaints[0].id);
      }
    } catch (err) {
      console.error('Failed to load complaints', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [user.id]);

  const selectedComplaint = complaints.find((c) => c.id === selectedCaseId) || complaints[0];

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    setFormSuccess(null);

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          passengerName: user.fullName,
          category,
          tripId: tripId || undefined,
          busId: busId || undefined,
          description,
          priority,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFormSuccess(`Case logged successfully with reference ${data.complaint.caseNumber}.`);
        setDescription('');
        setShowNewForm(false);
        await fetchComplaints();
        setSelectedCaseId(data.complaint.id);
      } else {
        alert(data.error || 'Failed to file complaint');
      }
    } catch {
      alert('Network error while lodging complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedComplaint) return;

    setSendingReply(true);

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_message',
          complaintId: selectedComplaint.id,
          senderId: user.id,
          senderName: user.fullName,
          senderRole: user.role,
          message: replyText.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setReplyText('');
        await fetchComplaints();
      } else {
        alert(data.error || 'Failed to send message');
      }
    } catch {
      alert('Network error while sending reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusBadge = (status: Complaint['status']) => {
    switch (status) {
      case 'submitted':
        return <span className="badge badge-info">Submitted</span>;
      case 'under_review':
        return <span className="badge badge-warning">Under Review</span>;
      case 'action_required':
        return <span className="badge badge-error">Action Required</span>;
      case 'resolved':
        return <span className="badge badge-success">Resolved</span>;
      case 'rejected':
        return <span className="badge badge-neutral">Closed / Rejected</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container">
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div>
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
              Passenger Support & Helpdesk
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '8px' }}>
              Complaints & Service Feedback
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '720px', margin: 0 }}>
              Report service delays, cleanliness issues, driving conduct, or lost property. Track resolution progress and communicate directly with the transport support desk.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowNewForm(!showNewForm)}
          >
            <PlusCircle size={16} /> {showNewForm ? 'Close Form' : 'Lodge New Complaint'}
          </button>
        </div>

        {formSuccess && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              padding: '12px 16px',
              fontSize: '13px',
              marginBottom: '24px',
            }}
          >
            {formSuccess}
          </div>
        )}

        {/* Modal/Accordion: New Complaint Form */}
        {showNewForm && (
          <div className="card" style={{ padding: '32px', marginBottom: '32px', backgroundColor: '#ffffff', border: '2px solid var(--color-primary)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              Submit Transport Complaint / Incident Report
            </h2>

            <form onSubmit={handleCreateComplaint}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                  marginBottom: '16px',
                }}
              >
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Complaint['category'])}
                  >
                    <option value="delay">Bus Delay / Schedule Deviation</option>
                    <option value="missed_pickup">Missed Stop / Pickup</option>
                    <option value="unsafe_driving">Unsafe Driving / Speeding</option>
                    <option value="conduct">Staff Conduct Concern</option>
                    <option value="cleanliness">Vehicle Cleanliness</option>
                    <option value="lost_property">Lost Property / Item on Bus</option>
                    <option value="other">Other Transport Issue</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Complaint['priority'])}
                  >
                    <option value="low">Low Priority (Feedback)</option>
                    <option value="medium">Medium Priority (Operational)</option>
                    <option value="high">High Priority (Safety Concern)</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Bus Identifier (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. BUS-01 or AP39TL1001"
                    value={busId}
                    onChange={(e) => setBusId(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Description</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Provide precise details including stop location, approximate time, and nature of the concern..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowNewForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting Case...' : 'Submit to Support Desk ›'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2-Column: Complaint Cases List + Message Thread */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '32px',
            alignItems: 'start',
          }}
        >
          {/* Left Column: Complaint Cases */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Your Reported Cases ({complaints.length})
            </h3>

            {complaints.length === 0 ? (
              <div className="card" style={{ padding: '32px', textAlign: 'center', backgroundColor: '#ffffff' }}>
                <CheckCircle size={36} color="var(--color-success)" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 700 }}>No Complaints on Record</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: 0 }}>
                  You have not submitted any complaints or maintenance grievances.
                </p>
              </div>
            ) : (
              complaints.map((c) => {
                const isSelected = selectedComplaint?.id === c.id;

                return (
                  <div
                    key={c.id}
                    className="card"
                    onClick={() => setSelectedCaseId(c.id)}
                    style={{
                      cursor: 'pointer',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
                      backgroundColor: isSelected ? 'var(--color-surface-card)' : '#ffffff',
                      padding: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {c.caseNumber}
                      </span>
                      {getStatusBadge(c.status)}
                    </div>

                    <h4 style={{ fontSize: '15px', fontWeight: 700, textTransform: 'capitalize', marginBottom: '4px' }}>
                      Category: {c.category.replace('_', ' ')}
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--color-body)', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {c.description}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--color-muted)',
                        borderTop: '1px solid var(--color-hairline)',
                        paddingTop: '8px',
                      }}
                    >
                      <span>Priority: <strong style={{ textTransform: 'uppercase' }}>{c.priority}</strong></span>
                      <span>{new Date(c.submittedAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Active Conversation & Case Thread */}
          {selectedComplaint && (
            <div style={{ position: 'sticky', top: '80px' }}>
              <div
                className="card"
                style={{
                  padding: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--color-hairline-strong)',
                }}
              >
                {/* Case Header */}
                <div
                  style={{
                    padding: '20px',
                    backgroundColor: 'var(--color-surface-dark)',
                    color: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#93c5fd', fontWeight: 700 }}>
                      CASE: {selectedComplaint.caseNumber}
                    </span>
                    {getStatusBadge(selectedComplaint.status)}
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, textTransform: 'capitalize' }}>
                    {selectedComplaint.category.replace('_', ' ')} Report
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--color-on-dark-soft)', marginTop: '4px' }}>
                    Logged on {new Date(selectedComplaint.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                  </div>
                </div>

                {/* Initial Description */}
                <div style={{ padding: '20px', borderBottom: '1px solid var(--color-hairline)', backgroundColor: 'var(--color-surface-soft)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '4px' }}>
                    Initial Grievance Submitted:
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--color-ink)', margin: 0 }}>
                    {selectedComplaint.description}
                  </p>
                </div>

                {/* Message Log */}
                <div
                  style={{
                    padding: '20px',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                    Resolution Dialogue & Staff Responses
                  </div>

                  {selectedComplaint.messages.map((m) => {
                    const isStaff = m.senderRole === 'support_operator' || m.senderRole === 'transport_admin';

                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isStaff ? 'flex-start' : 'flex-end',
                          maxWidth: '85%',
                          backgroundColor: isStaff ? 'var(--color-surface-card)' : 'rgba(28, 105, 212, 0.08)',
                          border: isStaff ? '1px solid var(--color-hairline-strong)' : '1px solid rgba(28, 105, 212, 0.25)',
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: isStaff ? 'var(--color-primary)' : 'var(--color-ink)' }}>
                            {m.senderName} ({m.senderRole})
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--color-muted)' }}>
                            {new Date(m.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.5 }}>
                          {m.message}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Form */}
                <form
                  onSubmit={handleSendReply}
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
                    placeholder="Type a message or response to support team..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    style={{ height: '40px', fontSize: '13px' }}
                    required
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={sendingReply || !replyText.trim()}
                  >
                    <Send size={14} /> Send
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
