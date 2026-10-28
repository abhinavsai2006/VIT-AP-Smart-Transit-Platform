'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ServiceDisruption, Route } from '@/types/transit';
import {
  Radio,
  AlertTriangle,
  PlusCircle,
  Calendar,
  CheckCircle,
  Info,
  Clock,
} from 'lucide-react';

export default function AdminDisruptionsPage() {
  const [disruptions, setDisruptions] = useState<ServiceDisruption[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  // New Disruption Form
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<ServiceDisruption['severity']>('warning');
  const [affectedRoutes, setAffectedRoutes] = useState('101, 102');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dRes, rRes] = await Promise.all([
        fetch('/api/disruptions'),
        fetch('/api/routes'),
      ]);
      const dData = await dRes.json();
      const rData = await rRes.json();
      setDisruptions(dData.disruptions || []);
      setRoutes(rData.routes || []);
    } catch (err) {
      console.error('Failed to load disruptions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDisruption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setSubmitting(true);
    setSuccessMsg(null);

    try {
      const routesArray = affectedRoutes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/disruptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          severity,
          affectedRoutes: routesArray,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 86400000 * 3).toISOString(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Service alert "${title}" broadcast across passenger dashboard and search banners.`);
        setShowModal(false);
        setTitle('');
        setMessage('');
        await fetchData();
      } else {
        alert(data.error || 'Failed to publish alert');
      }
    } catch {
      alert('Network error while broadcasting disruption.');
    } finally {
      setSubmitting(false);
    }
  };

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
              Emergency & Public Advisory
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '8px' }}>
              Service Disruptions & Public Broadcast
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '760px', margin: 0 }}>
              Broadcast roadworks, bridge diversions, flood warnings, or route deviations. Automatically updates passenger journey searches, availability calendars, and driver alerts.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowModal(true)}
          >
            <PlusCircle size={16} /> Broadcast Disruption Alert ›
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

        {/* Alerts List */}
        <div className="card" style={{ padding: '28px', backgroundColor: '#ffffff' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
            Active & Archived Broadcasts ({disruptions.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {disruptions.map((d) => (
              <div
                key={d.id}
                style={{
                  padding: '20px',
                  backgroundColor: d.severity === 'critical' ? '#fef2f2' : d.severity === 'warning' ? '#fffbeb' : 'var(--color-surface-soft)',
                  border: `1px solid ${d.severity === 'critical' ? '#fecaca' : d.severity === 'warning' ? '#fde68a' : 'var(--color-hairline-strong)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} color={d.severity === 'critical' ? '#dc2626' : '#d97706'} />
                    <span style={{ fontSize: '16px', fontWeight: 800 }}>{d.title}</span>
                  </div>
                  <span className={d.status === 'active' ? 'badge badge-warning' : 'badge badge-neutral'}>
                    {d.status.toUpperCase()}
                  </span>
                </div>

                <p style={{ fontSize: '14px', color: 'var(--color-body)', margin: '8px 0 14px' }}>
                  {d.message}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--color-muted)' }}>
                  <span>
                    <strong>Affected Corridors:</strong> {d.affectedRoutes.map((r) => `R-${r}`).join(', ') || 'Campus-wide'}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>Valid:</strong> {new Date(d.startTime).toLocaleDateString()} to {new Date(d.endTime).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal: New Disruption */}
        {showModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(26, 33, 41, 0.85)',
              zIndex: 4000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div className="card" style={{ maxWidth: '540px', width: '100%', padding: '28px', backgroundColor: '#ffffff' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>
                Broadcast Campus Disruption Advisory
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '20px' }}>
                Disruptions immediately display on passenger search results, home banners, and driver terminals.
              </p>

              <form onSubmit={handleCreateDisruption}>
                <div className="form-group">
                  <label className="form-label">Alert Headline</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Mangalagiri Flyover Construction Work"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Severity Level</label>
                  <select
                    className="form-select"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as ServiceDisruption['severity'])}
                  >
                    <option value="info">Informational Advisory (No major delay)</option>
                    <option value="warning">Service Warning (5-15 min expected delay)</option>
                    <option value="critical">Critical Disruption / Route Suspended</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Affected Routes (Comma Separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 101, 102, 103"
                    value={affectedRoutes}
                    onChange={(e) => setAffectedRoutes(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Detailed Advisory Message</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="Describe specific diversions, alternate stops, or schedule delays..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={submitting}
                  >
                    {submitting ? 'Broadcasting...' : 'Broadcast Alert ›'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
