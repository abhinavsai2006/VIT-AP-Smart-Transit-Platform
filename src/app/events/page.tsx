'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { EventRequest, Route } from '@/types/transit';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Calendar,
  Bus,
  MapPin,
  CheckCircle,
  Clock,
  ArrowRight,
  Shield,
  PlusCircle,
  Info,
} from 'lucide-react';

export default function EventsPage() {
  const { user } = useAuth();
  const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      try {
        const res = await fetch('/api/events');
        const data = await res.json();
        setEventRequests(data.eventRequests || []);
      } catch (err) {
        console.error('Failed to load event shuttles', err);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  const approvedEvents = eventRequests.filter((e) => e.status === 'approved');

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
              Institutional Logistics
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 700, marginBottom: '8px' }}>
              Special Events & Railway Shuttles
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '720px', margin: 0 }}>
              Dedicated university shuttle operations for national hackathons, academic conferences, guest delegations, and Kharagpur event connectivity.
            </p>
          </div>

          <Link href="/coordinator" className="btn btn-primary btn-sm">
            <PlusCircle size={16} /> Submit Event Transport Request ›
          </Link>
        </div>

        {/* Featured Route 201: Special Event & Railway Station Corridor */}
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-dark)',
            color: '#ffffff',
            padding: '32px',
            marginBottom: '40px',
            border: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  padding: '6px 12px',
                  fontWeight: 700,
                  fontSize: '14px',
                }}
              >
                SPECIAL SERVICE 201
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
                Kharagpur Link & Vijayawada Junction Express
              </h2>
            </div>
            <span className="badge badge-success">ACTIVE EVENT SHUTTLE</span>
          </div>

          <p style={{ color: 'var(--color-on-dark-soft)', fontSize: '14px', lineHeight: 1.6, maxWidth: '780px', marginBottom: '24px' }}>
            Configured dedicated university corridor connecting Vijayawada Central Railway Station with the VIT-AP Campus for arriving national conference delegations, placement interviewers, and sanctioned Kharagpur study exchange participants.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              backgroundColor: 'var(--color-surface-dark-elevated)',
              padding: '20px',
              marginBottom: '20px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-on-dark-soft)', letterSpacing: '1px' }}>
                Pickup Hub
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>
                Vijayawada Station West Bay
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-on-dark-soft)', letterSpacing: '1px' }}>
                Campus Destination
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>
                VIT-AP Central Roundabout
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-on-dark-soft)', letterSpacing: '1px' }}>
                Operating Speed
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>
                Non-stop Express (40 min)
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-on-dark-soft)', letterSpacing: '1px' }}>
                Tariff Policy
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>
                Complimentary / Free
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Link
              href="/booking"
              className="btn btn-primary btn-sm"
            >
              Reserve Seat on Station Shuttle ›
            </Link>
            <Link href="/tracking" className="btn btn-outline-dark btn-sm">
              Track Inbound Shuttles
            </Link>
          </div>
        </div>

        {/* Approved Department Event Shuttles */}
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
            Scheduled Department Events & Shuttle Approvals ({approvedEvents.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {approvedEvents.map((ev) => (
              <div
                key={ev.id}
                className="card"
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--color-hairline-strong)',
                  padding: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="badge badge-success">APPROVED BY TRANSPORT DESK</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                      Dept: <strong>{ev.department}</strong>
                    </span>
                  </div>

                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {ev.requestedBuses} University Buses Allocated
                  </span>
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
                  {ev.eventName}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--color-body)', marginBottom: '16px' }}>
                  {ev.purpose}
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '16px',
                    fontSize: '13px',
                    backgroundColor: 'var(--color-surface-soft)',
                    padding: '16px',
                    border: '1px solid var(--color-hairline)',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Dates:</span>{' '}
                    <strong>{ev.startDate} to {ev.endDate}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Route:</span>{' '}
                    <strong>{ev.pickupLocation} → {ev.dropLocation}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Delegates:</span>{' '}
                    <strong>~{ev.passengerCount} Participants</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Coordinator:</span>{' '}
                    <strong>{ev.coordinatorName}</strong>
                  </div>
                </div>

                {ev.notes && (
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '12px' }}>
                    <strong>Admin Note:</strong> {ev.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
