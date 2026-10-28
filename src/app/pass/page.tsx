'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { BusPass, Route } from '@/types/transit';
import TransitBrandLogo from '@/components/brand/TransitBrandLogo';
import {
  Printer,
  Download,
  Shield,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  Compass,
  Phone,
  ArrowRight,
  User,
  QrCode,
  Lock,
} from 'lucide-react';

export default function BusPassPage() {
  const { user } = useAuth();
  const [pass, setPass] = useState<BusPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    async function loadPass() {
      try {
        setLoading(true);
        setError(null);

        // Fetch pass for authenticated user
        const res = await fetch(`/api/pass?userId=${user.id}`);
        const data = await res.json();

        if (data.success && data.pass) {
          // Security Check: Verify ownership
          if (user.role === 'student' && data.pass.userId !== user.id) {
            setError('Access Denied: You are not authorized to view or print another student’s official bus pass.');
            setPass(null);
          } else {
            setPass(data.pass);
          }
        } else {
          setPass(null);
        }
      } catch (err: unknown) {
        console.error('Failed to load bus pass', err);
        setError('Unable to load pass from transit database.');
      } finally {
        setLoading(false);
      }
    }

    if (user?.id) {
      loadPass();
    }
  }, [user.id, user.role]);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 200);
  };

  return (
    <div style={{ padding: '40px 0', minHeight: '85vh', backgroundColor: '#f8fafc' }}>
      <div className="container print-container" style={{ maxWidth: '880px' }}>
        {/* Navigation & Action Controls (Hidden when printing) */}
        <div className="no-print" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <Link href="/dashboard" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                Passenger Dashboard
              </Link>
              <span style={{ color: 'var(--color-muted)' }}>/</span>
              <span style={{ color: 'var(--color-ink)', fontWeight: 700 }}>Student Bus Pass</span>
            </div>

            {pass && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Printer size={16} />
                  {isPrinting ? 'Preparing Print...' : 'Print Official Bus Pass'}
                </button>
                <Link
                  href={`/routes?search=${encodeURIComponent(pass.routeNumber)}`}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Compass size={16} />
                  View Route on Map
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="card no-print" style={{ padding: '60px', textAlign: 'center', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '14px', color: 'var(--color-muted)', fontWeight: 600 }}>
              Retrieving student pass and verifying transport authorization...
            </div>
          </div>
        )}

        {/* Security / Error State */}
        {error && !loading && (
          <div
            className="card no-print"
            style={{
              padding: '32px',
              backgroundColor: '#fef2f2',
              border: '2px solid #ef4444',
              color: '#991b1b',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <AlertTriangle size={24} color="#dc2626" />
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Security Violation / Access Restriction</h2>
            </div>
            <p style={{ fontSize: '14px', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Empty State: No Pass Assigned */}
        {!pass && !loading && !error && (
          <div className="card no-print" style={{ padding: '48px', textAlign: 'center', backgroundColor: '#ffffff' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <TransitBrandLogo size={56} variant="outline" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-ink)', marginBottom: '8px' }}>
              No Active Bus Pass Found
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--color-body)', maxWidth: '480px', margin: '0 auto 24px auto' }}>
              You do not currently hold an authorized bus pass for the 2026-2027 academic session. Bus passes are assigned by the Transport Office based on semester registration.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <Link href="/routes" className="btn btn-primary btn-sm">
                Browse Official 44 Routes
              </Link>
              <Link href="/complaints" className="btn btn-outline btn-sm">
                Contact Transport Helpdesk
              </Link>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* OFFICIAL INSTITUTIONAL STUDENT BUS PASS (PRINTABLE & DISPLAYABLE) */}
        {/* ==================================================================== */}
        {pass && !loading && (
          <div
            className="printable-bus-pass"
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #1a2129',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Top Security Header Band */}
            <div
              style={{
                backgroundColor: '#1a2129',
                color: '#ffffff',
                padding: '20px 28px',
                borderBottom: '4px solid #1c69d4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: '#1c69d4',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #ffffff',
                  }}
                >
                  VIT
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#93c5fd', textTransform: 'uppercase' }}>
                    Vellore Institute of Technology — Andhra Pradesh
                  </div>
                  <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '2px 0 0 0' }}>
                    VIT-AP UNIVERSITY
                  </h1>
                  <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                    Beside AP Secretariat, Inavolu, Amaravati 522237 • Campus Transportation Office
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#166534',
                    color: '#ffffff',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  VALID COMMUTER PASS
                </span>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginTop: '4px', fontFamily: 'monospace' }}>
                  {pass.passNumber}
                </div>
              </div>
            </div>

            {/* Sub-Header: Academic Session & Route Summary Banner */}
            <div
              style={{
                backgroundColor: '#f1f5f9',
                padding: '10px 28px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                fontWeight: 700,
                color: '#334155',
              }}
            >
              <div>SESSION: {pass.academicYear} • {pass.semester.toUpperCase()}</div>
              <div>VALIDITY: {pass.validFrom} TO {pass.validUntil}</div>
            </div>

            {/* Main Pass Body Grid */}
            <div style={{ padding: '28px', display: 'grid', gridTemplateColumns: '140px 1fr 180px', gap: '24px', alignItems: 'start' }}>
              {/* Column 1: Student Photo & ID badge */}
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '130px',
                    height: '150px',
                    backgroundColor: '#e2e8f0',
                    border: '2px solid #cbd5e1',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                  }}
                >
                  {pass.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pass.photoUrl}
                      alt={pass.studentName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <User size={64} color="#94a3b8" />
                  )}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    marginTop: '8px',
                    color: '#0f172a',
                  }}
                >
                  {pass.regNumber}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>
                  Student ID
                </div>
              </div>

              {/* Column 2: Student & Route Specifications */}
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                    Authorized Passenger
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                    {pass.studentName}
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                    {pass.program}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {pass.department}
                  </div>
                </div>

                {/* Assigned Corridor Highlight Box */}
                <div
                  style={{
                    border: '2px solid #1c69d4',
                    backgroundColor: '#eff6ff',
                    padding: '14px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          backgroundColor: '#1c69d4',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '13px',
                          padding: '3px 8px',
                          letterSpacing: '0.5px',
                        }}
                      >
                        ROUTE {pass.routeNumber}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a8a' }}>
                        {pass.routeName}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                    <div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                        Official Boarding Point
                      </div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                        {pass.pickupStopName}
                      </div>
                      <div style={{ color: '#16a34a', fontWeight: 700 }}>
                        Pickup: {pass.pickupTime}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                        Terminal Destination
                      </div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                        {pass.dropStopName}
                      </div>
                      <div style={{ color: '#1e3a8a', fontWeight: 700 }}>
                        Arrival: {pass.dropTime}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                  <strong>Important:</strong> Pass must be produced upon boarding to the conductor. Valid only on designated corridor route #{pass.routeNumber}. Non-transferable.
                </div>
              </div>

              {/* Column 3: Cryptographic QR & Verification Seal */}
              <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                  HMAC VERIFICATION
                </div>
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    padding: '8px',
                    display: 'inline-block',
                    marginBottom: '8px',
                  }}
                >
                  {pass.qrCodeDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pass.qrCodeDataUrl}
                      alt="Pass Verification QR"
                      style={{ width: '130px', height: '130px', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                      <QrCode size={48} color="#94a3b8" />
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#64748b', wordBreak: 'break-all' }}>
                  TOKEN: SIGNED-SHA256
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                    Authorized Signatory
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {pass.issuedBy}
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>
                    Chief Transport Officer, VIT-AP
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Institutional Strip */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                padding: '12px 28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              <div>
                Emergency Helpline: <strong>{pass.emergencyContact}</strong> | Email: <strong>transit@vitap.ac.in</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={14} color="#1c69d4" />
                <span>Authoritative Campus Transit Document</span>
              </div>
            </div>
          </div>
        )}

        {/* Print instructions for user (Hidden in print) */}
        {pass && !loading && (
          <div
            className="no-print"
            style={{
              marginTop: '24px',
              padding: '16px 20px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: 'var(--color-body)',
            }}
          >
            <div>
              <strong>Print Note:</strong> Click &ldquo;Print Official Bus Pass&rdquo; to print via browser dialog or save as PDF. Navigation bars and action buttons will be automatically stripped out by the print stylesheet.
            </div>
            <button onClick={handlePrint} className="btn btn-outline btn-sm">
              <Printer size={14} style={{ marginRight: '6px' }} />
              Print Pass
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
