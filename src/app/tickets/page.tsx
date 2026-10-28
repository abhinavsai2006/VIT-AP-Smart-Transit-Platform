'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Booking } from '@/types/transit';
import { useAuth } from '@/lib/auth/auth-context';
import {
  QrCode,
  Ticket as TicketIcon,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Copy,
  Printer,
  Ban,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function TicketsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/bookings?userId=${user.id}`);
      const data = await res.json();
      setBookings(data.bookings || []);
      if (data.bookings && data.bookings.length > 0 && !selectedBookingId) {
        setSelectedBookingId(data.bookings[0].id);
      }
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [user.id]);

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId) || bookings[0];

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking and invalidate its QR boarding ticket?')) {
      return;
    }

    setCancelling(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionMessage('Booking cancelled and seat returned to fleet availability.');
        await fetchBookings();
      } else {
        alert(data.error || 'Failed to cancel booking.');
      }
    } catch {
      alert('Network error while cancelling ticket.');
    } finally {
      setCancelling(false);
    }
  };

  const copyToken = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container">
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
            Passenger Boarding Credentials
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 700, marginBottom: '8px' }}>
            QR Ticket Wallet & Passes
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '720px', margin: 0 }}>
            Authoritative signed digital boarding passes for <strong>{user.fullName}</strong>. Present the QR code on your phone screen to the conductor upon vehicle boarding.
          </p>
        </div>

        {actionMessage && (
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
            {actionMessage}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '64px' }}>Loading ticket wallet...</div>
        ) : bookings.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '64px 24px', backgroundColor: '#ffffff' }}>
            <TicketIcon size={48} color="var(--color-muted)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>No Active Tickets Found</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-body)', maxWidth: '440px', margin: '0 auto 24px' }}>
              You do not have any upcoming bus reservations. Search routes and reserve seats on scheduled campus shuttles.
            </p>
            <Link href="/" className="btn btn-primary">
              Search Available Buses ›
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '32px',
              alignItems: 'start',
            }}
          >
            {/* Left: Bookings List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Your Issued Tickets ({bookings.length})
              </h3>

              {bookings.map((b) => {
                const isSelected = selectedBooking?.id === b.id;
                const isUsed = b.status === 'used';
                const isCancelled = b.status === 'cancelled';

                return (
                  <div
                    key={b.id}
                    className="card"
                    onClick={() => setSelectedBookingId(b.id)}
                    style={{
                      cursor: 'pointer',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
                      backgroundColor: isSelected ? 'var(--color-surface-card)' : '#ffffff',
                      padding: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {b.bookingReference}
                      </span>
                      {isCancelled ? (
                        <span className="badge badge-error">CANCELLED</span>
                      ) : isUsed ? (
                        <span className="badge badge-neutral">BOARDED / USED</span>
                      ) : (
                        <span className="badge badge-success">VALID FOR BOARDING</span>
                      )}
                    </div>

                    <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
                      Route {b.trip?.route?.routeNumber}: {b.trip?.route?.routeName}
                    </h4>

                    <div style={{ fontSize: '13px', color: 'var(--color-body)', marginBottom: '10px' }}>
                      {b.originStop?.name || 'Origin'} → {b.destinationStop?.name || 'Destination'}
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
                      <div>
                        <strong>Dep:</strong> {b.trip?.departureTime} IST
                      </div>
                      <div>
                        <strong>Bus:</strong> {b.trip?.bus?.busCode || 'BUS'} ({b.trip?.bus?.registrationNumber || 'AP Reg'})
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Digital QR Boarding Pass (High visual fidelity) */}
            {selectedBooking && (
              <div style={{ position: 'sticky', top: '80px' }}>
                <div
                  className="card"
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--color-hairline)',
                    padding: 0,
                  }}
                >
                  {/* Pass Top Banner */}
                  <div
                    style={{
                      backgroundColor: 'var(--color-surface-dark)',
                      color: '#ffffff',
                      padding: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#93c5fd' }}>
                        Boarding Credential
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 700 }}>
                        VIT-AP UNIVERSITY TRANSIT
                      </div>
                    </div>
                    {selectedBooking.status === 'cancelled' ? (
                      <span className="badge badge-error">CANCELLED</span>
                    ) : selectedBooking.status === 'used' ? (
                      <span className="badge badge-neutral">BOARDED</span>
                    ) : (
                      <span className="badge badge-success">ACTIVE PASS</span>
                    )}
                  </div>

                  {/* QR Code Container */}
                  <div
                    style={{
                      padding: '32px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      backgroundColor: 'var(--color-surface-soft)',
                      borderBottom: '1px dashed var(--color-hairline-strong)',
                    }}
                  >
                    {selectedBooking.ticket?.qrCodeDataUrl ? (
                      <div
                        style={{
                          backgroundColor: '#ffffff',
                          padding: '16px',
                          border: '1px solid var(--color-hairline)',
                          marginBottom: '16px',
                        }}
                      >
                        {/* High-res QR image */}
                        <img
                          src={selectedBooking.ticket.qrCodeDataUrl}
                          alt="QR Ticket Code"
                          width={220}
                          height={220}
                          style={{ display: 'block' }}
                        />
                      </div>
                    ) : (
                      <div style={{ padding: '40px', color: 'var(--color-muted)' }}>
                        QR generation pending...
                      </div>
                    )}

                    <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', color: 'var(--color-ink)' }}>
                      TICKET NUMBER: {selectedBooking.ticket?.ticketNumber}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>
                      Ref: {selectedBooking.bookingReference} • Signed HMAC-SHA256 Token
                    </div>
                  </div>

                  {/* Trip Details Plate */}
                  <div style={{ padding: '24px' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                        marginBottom: '20px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Passenger Name
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>
                          {selectedBooking.passengerName}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Passenger Category
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 700, textTransform: 'capitalize' }}>
                          {selectedBooking.passengerType}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Origin Bay
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>
                          {selectedBooking.originStop?.name || 'Origin Stop'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Destination Bay
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>
                          {selectedBooking.destinationStop?.name || 'Destination Stop'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Scheduled Departure
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>
                          {selectedBooking.trip?.departureTime} IST
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Assigned Bus
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>
                          {selectedBooking.trip?.bus?.busCode} ({selectedBooking.trip?.bus?.registrationNumber})
                        </div>
                      </div>
                    </div>

                    {/* Copy Token Button for Test/Verification */}
                    {selectedBooking.ticket?.token && (
                      <div
                        style={{
                          backgroundColor: 'var(--color-surface-soft)',
                          padding: '10px 14px',
                          border: '1px solid var(--color-hairline)',
                          marginBottom: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
                          {selectedBooking.ticket.token}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToken(selectedBooking.ticket!.token)}
                          className="btn btn-secondary btn-sm"
                          style={{ height: '28px', padding: '0 8px', fontSize: '11px' }}
                        >
                          <Copy size={12} /> {copySuccess ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="btn btn-secondary btn-sm"
                      >
                        <Printer size={14} /> Print Pass
                      </button>

                      {selectedBooking.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() => handleCancel(selectedBooking.id)}
                          className="btn btn-secondary btn-sm"
                          disabled={cancelling}
                          style={{ color: 'var(--color-error)' }}
                        >
                          <Ban size={14} /> {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
