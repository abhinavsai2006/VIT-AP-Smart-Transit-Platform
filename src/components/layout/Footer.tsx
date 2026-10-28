'use client';

import React from 'react';
import Link from 'next/link';
import { Bus, Phone, ShieldCheck, MapPin } from 'lucide-react';
import TransitBrandLogo from '@/components/brand/TransitBrandLogo';

export default function Footer() {
  return (
    <footer
      style={{
        backgroundColor: 'var(--color-surface-soft)',
        borderTop: '1px solid var(--color-hairline)',
        paddingTop: '64px',
        paddingBottom: '48px',
        marginTop: '64px',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '32px',
            marginBottom: '48px',
          }}
        >
          {/* Col 1: University Identity */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <TransitBrandLogo size={32} />
              <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.5px' }}>
                VIT-AP SMART TRANSIT
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.6, marginBottom: '16px' }}>
              Official University Bus Fleet Management & Passenger Operations Platform for VIT-AP University.
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--color-muted)' }}>
              <MapPin size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>Inavolu, Beside AP Secretariat, Amaravati, Andhra Pradesh 522237, India</span>
            </div>
          </div>

          {/* Col 2: Passenger Services */}
          <div>
            <h4
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'var(--color-ink)',
                marginBottom: '16px',
              }}
            >
              Passenger Services
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>
                <Link href="/routes" style={{ fontSize: '14px', color: 'var(--color-body)' }}>
                  Campus Routes & Timetable
                </Link>
              </li>
              <li>
                <Link href="/stops" style={{ fontSize: '14px', color: 'var(--color-body)' }}>
                  Bus Stop Directory
                </Link>
              </li>
              <li>
                <Link href="/tracking" style={{ fontSize: '14px', color: 'var(--color-body)' }}>
                  Live GPS Fleet Tracking
                </Link>
              </li>
              <li>
                <Link href="/tickets" style={{ fontSize: '14px', color: 'var(--color-body)' }}>
                  My QR Tickets & Passes
                </Link>
              </li>
              <li>
                <Link href="/events" style={{ fontSize: '14px', color: 'var(--color-body)' }}>
                  Special Event & Station Shuttles
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Operations & Fleet */}
          <div>
            <h4
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'var(--color-ink)',
                marginBottom: '16px',
              }}
            >
              Operations & Crew
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>
                <Link href="/driver" style={{ fontSize: '14px', color: 'var(--color-body)' }}>
                  Driver Dispatch & Location Broadcast
                </Link>
              </li>
              <li>
                <Link href="/conductor" style={{ fontSize: '14px', color: 'var(--color-body)' }}>
                  Conductor QR Scanner & Boarding
                </Link>
              </li>
              <li>
                <Link href="/admin/fleet" style={{ fontSize: '14px', color: 'var(--color-body)' }}>
                  Fleet Registry & AP Registration
                </Link>
              </li>
              <li>
                <Link href="/admin/maintenance" style={{ fontSize: '14px', color: 'var(--color-body)' }}>
                  Maintenance & Fuel Expenditure
                </Link>
              </li>
              <li>
                <Link href="/admin" style={{ fontSize: '14px', color: 'var(--color-body)' }}>
                  Transport Administration Console
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Safety & Support */}
          <div>
            <h4
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'var(--color-ink)',
                marginBottom: '16px',
              }}
            >
              Safety & Emergency
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={16} color="var(--color-primary)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-ink)' }}>
                  Transit Control: 0863-2399999
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} color="var(--color-success)" />
                <span style={{ fontSize: '13px', color: 'var(--color-body)' }}>
                  24/7 Campus Security Dispatched
                </span>
              </div>
              <Link href="/complaints" className="btn btn-secondary btn-sm" style={{ marginTop: '8px' }}>
                File a Complaint / Feedback
              </Link>
            </div>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--color-hairline-strong)', marginBottom: '24px' }} />

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            fontSize: '12px',
            color: 'var(--color-muted)',
          }}
        >
          <div>
            © 2026 VIT-AP University. All rights reserved. Designed for Andhra Pradesh Campus Transit Compliance.
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Andhra Pradesh RTO Standardized</span>
            <span>•</span>
            <span>Real-Time GPS Ingestion</span>
            <span>•</span>
            <span>Atomic QR Consumption</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
