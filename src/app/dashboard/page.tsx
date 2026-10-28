'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { Booking, Complaint, Notification } from '@/types/transit';
import {
  User,
  Ticket,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  QrCode,
  Bell,
  MessageSquare,
  Shield,
  Compass,
  Radio,
  Settings,
  LogOut,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [bookRes, compRes] = await Promise.all([
          fetch(`/api/bookings?userId=${user.id}`),
          fetch(`/api/complaints?userId=${user.id}`),
        ]);
        const bookData = await bookRes.json();
        const compData = await compRes.json();

        setBookings(bookData.bookings || []);
        setComplaints(compData.complaints || []);
      } catch (err) {
        console.error('Failed to load passenger dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [user.id]);

  const activeBookings = bookings.filter((b) => b.status === 'confirmed');
  const pastBookings = bookings.filter((b) => b.status === 'used' || b.status === 'cancelled');

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container">
        {/* Profile Header Band */}
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 800,
                }}
              >
                {user.fullName.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#93c5fd', fontWeight: 700 }}>
                  Authorized Passenger Profile
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: 800, marginTop: '2px' }}>
                  {user.fullName}
                </h1>
                <div style={{ fontSize: '13px', color: 'var(--color-on-dark-soft)', marginTop: '4px' }}>
                  {user.email} • ID: <strong>{user.regNumber || user.employeeId || 'ID-100'}</strong> • {user.department || 'VIT-AP Campus'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Link href="/tickets" className="btn btn-primary btn-sm">
                <QrCode size={16} /> QR Ticket Wallet
              </Link>
              <Link href="/" className="btn btn-outline-dark btn-sm">
                Search New Bus
              </Link>
            </div>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Active Upcoming Journeys
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary)', margin: '8px 0' }}>
              {activeBookings.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-body)' }}>
              Reserved seats with ready QR boarding passes.
            </div>
          </div>

          <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Lifetime Journeys Completed
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-ink)', margin: '8px 0' }}>
              {pastBookings.filter((b) => b.status === 'used').length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-body)' }}>
              Total university bus trips validated.
            </div>
          </div>

          <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Support Grievances Logged
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-ink)', margin: '8px 0' }}>
              {complaints.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-body)' }}>
              {complaints.filter((c) => c.status === 'resolved').length} resolved by helpdesk.
            </div>
          </div>
        </div>

        {/* 2-Column: Active Bookings + Complaints / Quick Actions */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '32px',
            alignItems: 'start',
          }}
        >
          {/* Active Bookings Column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Upcoming Bus Reservations</h2>
              <Link href="/tickets" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                View All Passes ›
              </Link>
            </div>

            {activeBookings.length === 0 ? (
              <div className="card" style={{ padding: '32px', textAlign: 'center', backgroundColor: '#ffffff' }}>
                <Ticket size={32} color="var(--color-muted)" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '15px', fontWeight: 700 }}>No Upcoming Bookings</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
                  You have not reserved any scheduled trips for upcoming dates.
                </p>
                <Link href="/" className="btn btn-secondary btn-sm">
                  Search & Book Bus
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {activeBookings.map((b) => (
                  <div
                    key={b.id}
                    className="card"
                    style={{
                      padding: '20px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--color-hairline-strong)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary)' }}>
                        {b.bookingReference}
                      </span>
                      <span className="badge badge-success">READY TO BOARD</span>
                    </div>

                    <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
                      Route {b.trip?.route?.routeNumber}: {b.trip?.route?.routeName}
                    </h4>

                    <div style={{ fontSize: '13px', color: 'var(--color-body)', marginBottom: '12px' }}>
                      {b.originStop?.name} → {b.destinationStop?.name}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: 'var(--color-muted)',
                        borderTop: '1px solid var(--color-hairline)',
                        paddingTop: '10px',
                      }}
                    >
                      <span>
                        Departure: <strong>{b.trip?.departureTime} IST</strong>
                      </span>
                      <Link href="/tickets" className="btn btn-secondary btn-sm" style={{ height: '30px', padding: '0 10px', fontSize: '11px' }}>
                        <QrCode size={12} /> Show QR Code
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Complaints & Support History */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Recent Grievance Cases</h2>
              <Link href="/complaints" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                Helpdesk Console ›
              </Link>
            </div>

            {complaints.length === 0 ? (
              <div className="card" style={{ padding: '32px', textAlign: 'center', backgroundColor: '#ffffff' }}>
                <CheckCircle size={32} color="var(--color-success)" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '15px', fontWeight: 700 }}>Clean Service Record</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: 0 }}>
                  You have not logged any transport complaints.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {complaints.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    className="card"
                    style={{
                      padding: '16px 20px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--color-hairline)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {c.caseNumber}
                      </span>
                      <span className="badge badge-info">{c.status}</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, textTransform: 'capitalize', marginBottom: '4px' }}>
                      {c.category.replace('_', ' ')}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
