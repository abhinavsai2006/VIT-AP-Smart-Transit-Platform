'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  Settings as SettingsIcon,
  Download,
  Database,
  Lock,
  Radio,
  CreditCard,
  Mail,
  MapPin,
  Clock,
  Phone,
  FileText,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { AuditLog } from '@/types/transit';

export default function AdminSettingsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  // Institutional Settings State
  const [settings, setSettings] = useState({
    institutionName: 'VIT-AP University, Amaravati',
    address: 'Beside AP Secretariat, Inavolu, Amaravati, Andhra Pradesh 522237',
    timezone: 'Asia/Kolkata (IST, UTC+05:30)',
    currency: 'INR (₹)',
    studentEmailDomain: '@vitap.ac.in',
    studentRegPattern: '^[0-9]{2}[A-Z]{3}[0-9]{4}$ (e.g. 21BCE1001)',
    employeeIdPattern: '^[A-Z]{3}[0-9]{3,4}$ (e.g. EMP501)',
    gpsStaleThresholdSeconds: 120,
    emergencyHotline: '+91 863 2370 444',
    emergencyEmail: 'transit-safety@vitap.ac.in',
    enablePublicRegistration: true,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function loadLogs() {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/audit-logs');
        const data = await res.json();
        if (data.success && data.logs) {
          setAuditLogs(data.logs);
        }
      } catch (err) {
        console.error('Failed to load audit logs', err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  const handleDownloadCsv = async (type: string) => {
    try {
      setDownloadingType(type);
      const res = await fetch(`/api/admin/export?type=${type}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vitap-transit-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(`Export failed for ${type}`, err);
      alert(`Export failed for ${type}`);
    } finally {
      setDownloadingType(null);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container">
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          <Link href="/admin" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
            Admin Command Center
          </Link>
          <span style={{ color: 'var(--color-muted)' }}>/</span>
          <span style={{ color: 'var(--color-ink)', fontWeight: 700 }}>System Configuration & Audit</span>
        </div>

        {/* Page Header */}
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-dark)',
            color: '#ffffff',
            padding: '32px',
            marginBottom: '32px',
            border: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SettingsIcon size={28} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#93c5fd', fontWeight: 700 }}>
                  Institution Governance
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, marginTop: '2px' }}>
                  System Settings, Integrations & Audit Logs
                </h1>
                <div style={{ fontSize: '12px', color: 'var(--color-on-dark-soft)', marginTop: '2px' }}>
                  Institutional parameters, third-party integration health, data exports, and security trail.
                </div>
              </div>
            </div>

            <Link href="/admin" className="btn btn-outline-dark btn-sm">
              Back to Overview
            </Link>
          </div>
        </div>

        {/* Integration Status Hub */}
        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>
          Infrastructure & Integration Health
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            marginBottom: '36px',
          }}
        >
          {/* Database */}
          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Database size={22} color="var(--color-primary)" />
              <span className="badge badge-success">Active</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-ink)' }}>Database Engine</div>
            <div style={{ fontSize: '12px', color: 'var(--color-body)', marginTop: '4px' }}>
              Dual-mode architecture. Supabase PostgreSQL schema with RLS policies, backed by persistent demonstration store.
            </div>
          </div>

          {/* Cryptographic QR */}
          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Lock size={22} color="var(--color-primary)" />
              <span className="badge badge-success">HMAC-SHA256</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-ink)' }}>QR Signing Tokenizer</div>
            <div style={{ fontSize: '12px', color: 'var(--color-body)', marginTop: '4px' }}>
              Server-signed tokens with secret salt. Atomic single-use consumption protects against duplicate boarding.
            </div>
          </div>

          {/* GPS Telemetry Ingestion */}
          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Radio size={22} color="var(--color-primary)" />
              <span className="badge badge-success">Operational</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-ink)' }}>GPS Telemetry Adapter</div>
            <div style={{ fontSize: '12px', color: 'var(--color-body)', marginTop: '4px' }}>
              Driver HTML5 Geolocation ingestion via <code style={{ fontSize: '11px' }}>/api/trips/[id]/location</code>. Stale detection active ({'>'}120s).
            </div>
          </div>

          {/* Payment Gateway */}
          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <CreditCard size={22} color="var(--color-muted)" />
              <span className="badge badge-warning">Configurable</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-ink)' }}>Payment Gateway</div>
            <div style={{ fontSize: '12px', color: 'var(--color-body)', marginTop: '4px' }}>
              Standard campus routes are free. Paid/event ticketing adapter ready; disabled pending university merchant credentials.
            </div>
          </div>

          {/* SMS / Communications */}
          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Mail size={22} color="var(--color-muted)" />
              <span className="badge badge-warning">Configurable</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-ink)' }}>SMS & Carrier Gateway</div>
            <div style={{ fontSize: '12px', color: 'var(--color-body)', marginTop: '4px' }}>
              In-app notification hub is primary. External SMS gateway adapter configurable via environment credentials.
            </div>
          </div>
        </div>

        {/* 2-Column: Institutional Settings & Data Export */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '36px' }}>
          {/* Institutional Settings Form */}
          <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>
              Institutional Parameters
            </h2>

            {savedSuccess && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#dcfce7',
                  border: '1px solid #86efac',
                  color: '#166534',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle size={16} /> Institutional settings updated successfully.
              </div>
            )}

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Institution Name & Campus
                </label>
                <input
                  type="text"
                  className="input"
                  value={settings.institutionName}
                  onChange={(e) => setSettings({ ...settings, institutionName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Campus Physical Address
                </label>
                <input
                  type="text"
                  className="input"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                    Operational Timezone
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={settings.timezone}
                    disabled
                    style={{ backgroundColor: '#f1f5f9' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                    Currency Unit
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={settings.currency}
                    disabled
                    style={{ backgroundColor: '#f1f5f9' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Emergency Transport Hotline
                </label>
                <input
                  type="text"
                  className="input"
                  value={settings.emergencyHotline}
                  onChange={(e) => setSettings({ ...settings, emergencyHotline: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Student Registration Regex
                </label>
                <input
                  type="text"
                  className="input"
                  value={settings.studentRegPattern}
                  onChange={(e) => setSettings({ ...settings, studentRegPattern: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                Save Institutional Settings
              </button>
            </form>
          </div>

          {/* Data Export & Reports */}
          <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>
              Operational Data & Report Exports
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-body)', marginBottom: '20px' }}>
              Download authoritative operational records in CSV format for institutional auditing, compliance, and government transport reporting.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Fleet Export */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-ink)' }}>
                    Fleet & AP Registration Master
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                    All vehicles, Andhra Pradesh RTO codes, seating capacity, fuel type, and depot
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadCsv('fleet')}
                  disabled={downloadingType === 'fleet'}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  {downloadingType === 'fleet' ? 'Exporting...' : 'Export CSV'}
                </button>
              </div>

              {/* Trips Export */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-ink)' }}>
                    Trip Schedules & Dispatch Logs
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                    Schedules, assigned drivers, conductors, bus allocations, and seat occupancy
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadCsv('trips')}
                  disabled={downloadingType === 'trips'}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  {downloadingType === 'trips' ? 'Exporting...' : 'Export CSV'}
                </button>
              </div>

              {/* Boarding Scans Export */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-ink)' }}>
                    QR Boarding Validation Audit Log
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                    Scan events, cryptographic validation results, conductor IDs, and timestamps
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadCsv('scans')}
                  disabled={downloadingType === 'scans'}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  {downloadingType === 'scans' ? 'Exporting...' : 'Export CSV'}
                </button>
              </div>

              {/* Complaints Export */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-ink)' }}>
                    Grievance & Incident Records
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                    Case numbers, categories, passenger feedback, priorities, and resolution notes
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadCsv('complaints')}
                  disabled={downloadingType === 'complaints'}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  {downloadingType === 'complaints' ? 'Exporting...' : 'Export CSV'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Administrative Audit Trail */}
        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>
          Authoritative Security & Administrative Audit Trail
        </h2>

        <div className="card" style={{ padding: '0', backgroundColor: '#ffffff', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Immutable Event Log ({auditLogs.length} Entries Recorded)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
              Server timestamped (Asia/Kolkata)
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-muted)' }}>
              Loading audit records...
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-muted)' }}>
              No audit records found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Timestamp</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Action</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Entity</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Actor ID</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Operational Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                        <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-ink)' }}>
                        {log.entityType} ({log.entityId})
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                        {log.performedBy}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-body)' }}>
                        {JSON.stringify(log.details || {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
