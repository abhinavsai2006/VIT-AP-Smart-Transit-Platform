'use client';

import React, { useState, useEffect } from 'react';
import { EventRequest } from '@/types/transit';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Calendar,
  Users,
  MapPin,
  Clock,
  CheckCircle,
  PlusCircle,
  FileText,
  Bus,
  AlertCircle,
} from 'lucide-react';

export default function CoordinatorPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [department, setDepartment] = useState(user.department || 'School of Computer Science & Engineering');
  const [eventName, setEventName] = useState('');
  const [pickupLocation, setPickupLocation] = useState('Vijayawada Central Railway Station');
  const [dropLocation, setDropLocation] = useState('VIT-AP Central Campus');
  const [startDate, setStartDate] = useState('2026-10-28');
  const [endDate, setEndDate] = useState('2026-10-30');
  const [passengerCount, setPassengerCount] = useState(120);
  const [requestedBuses, setRequestedBuses] = useState(3);
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/events');
      const data = await res.json();
      setRequests(data.eventRequests || []);
    } catch (err) {
      console.error('Failed to load event requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) return;

    setSubmitting(true);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department,
          eventName,
          coordinatorName: user.fullName,
          coordinatorEmail: user.email,
          coordinatorPhone: user.phone || '+91 98480 12345',
          pickupLocation,
          dropLocation,
          startDate,
          endDate,
          passengerCount: Number(passengerCount),
          requestedBuses: Number(requestedBuses),
          purpose,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Transportation request for "${eventName}" submitted to Transport Incharge for review.`);
        setShowForm(false);
        setEventName('');
        setPurpose('');
        await fetchRequests();
      } else {
        alert(data.error || 'Failed to submit transport request');
      }
    } catch {
      alert('Network error while lodging event request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: EventRequest['status']) => {
    switch (status) {
      case 'approved':
        return <span className="badge badge-success">Approved & Allocated</span>;
      case 'under_review':
        return <span className="badge badge-warning">Under Review</span>;
      case 'rejected':
        return <span className="badge badge-error">Rejected / Revisions Needed</span>;
      case 'completed':
        return <span className="badge badge-neutral">Completed</span>;
      default:
        return <span className="badge badge-info">Pending Approval</span>;
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
              Academic & Conference Transport
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 700, marginBottom: '8px' }}>
              Department Event Transportation Portal
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '720px', margin: 0 }}>
              Official portal for University Event Coordinators and HODs to requisition dedicated campus buses for hackathons, academic conferences, guest speaker pickups, and placement drives.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowForm(!showForm)}
          >
            <PlusCircle size={16} /> {showForm ? 'Cancel' : 'New Transport Requisition'}
          </button>
        </div>

        {successMsg && (
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
            {successMsg}
          </div>
        )}

        {/* Requisition Form */}
        {showForm && (
          <div className="card" style={{ padding: '32px', marginBottom: '32px', backgroundColor: '#ffffff', border: '2px solid var(--color-primary)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              Submit Department Transportation Requisition
            </h2>

            <form onSubmit={handleSubmitRequest}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                  marginBottom: '16px',
                }}
              >
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Department / School</label>
                  <input
                    type="text"
                    className="form-control"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Event / Conference Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. VITOPIA Hackathon 2026"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Expected Delegates</label>
                  <input
                    type="number"
                    className="form-control"
                    min={10}
                    max={1000}
                    value={passengerCount}
                    onChange={(e) => setPassengerCount(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Buses Requested</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    max={10}
                    value={requestedBuses}
                    onChange={(e) => setRequestedBuses(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                  marginBottom: '16px',
                }}
              >
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Pickup Hub</label>
                  <input
                    type="text"
                    className="form-control"
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Drop Destination</label>
                  <input
                    type="text"
                    className="form-control"
                    value={dropLocation}
                    onChange={(e) => setDropLocation(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Purpose & Justification</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Outline the official event agenda, student or guest delegate transport requirements..."
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting to Transport Team...' : 'Submit Requisition ›'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Requests Table */}
        <div className="card" style={{ padding: '28px', backgroundColor: '#ffffff' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
            Submitted Requisitions & Fleet Allocations ({requests.length})
          </h2>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Department</th>
                  <th>Dates</th>
                  <th>Corridor</th>
                  <th>Passengers</th>
                  <th>Buses</th>
                  <th>Approval Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{r.eventName}</td>
                    <td>{r.department}</td>
                    <td>{r.startDate} to {r.endDate}</td>
                    <td>{r.pickupLocation} → {r.dropLocation}</td>
                    <td>~{r.passengerCount} delegates</td>
                    <td style={{ fontWeight: 700 }}>{r.requestedBuses} requested</td>
                    <td>{getStatusBadge(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
