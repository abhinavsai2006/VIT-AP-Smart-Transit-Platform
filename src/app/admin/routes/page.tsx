'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Route, Stop } from '@/types/transit';
import {
  Calendar,
  PlusCircle,
  MapPin,
  Clock,
  ArrowRight,
  Shield,
  Search,
} from 'lucide-react';

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  // New Route Modal
  const [showModal, setShowModal] = useState(false);
  const [routeNumber, setRouteNumber] = useState('');
  const [routeName, setRouteName] = useState('');
  const [description, setDescription] = useState('');
  const [originStopId, setOriginStopId] = useState('');
  const [destinationStopId, setDestinationStopId] = useState('');
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(35);
  const [distanceKm, setDistanceKm] = useState(20);
  const [fareAmount, setFareAmount] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rRes, sRes] = await Promise.all([
        fetch('/api/routes'),
        fetch('/api/stops'),
      ]);
      const rData = await rRes.json();
      const sData = await sRes.json();
      setRoutes(rData.routes || []);
      setStops(sData.stops || []);

      if (sData.stops && sData.stops.length >= 2) {
        if (!originStopId) setOriginStopId(sData.stops[0].id);
        if (!destinationStopId) setDestinationStopId(sData.stops[1].id);
      }
    } catch (err) {
      console.error('Failed to load routes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeNumber || !routeName) return;

    setSubmitting(true);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeNumber,
          routeName,
          description,
          originStopId,
          destinationStopId,
          estimatedDurationMinutes: Number(estimatedDurationMinutes),
          distanceKm: Number(distanceKm),
          fareAmount: Number(fareAmount),
          stops: [
            {
              id: `rs-new-1`,
              routeId: '',
              stopId: originStopId,
              stopSequence: 1,
              arrivalOffsetMinutes: 0,
              departureOffsetMinutes: 0,
            },
            {
              id: `rs-new-2`,
              routeId: '',
              stopId: destinationStopId,
              stopSequence: 2,
              arrivalOffsetMinutes: Number(estimatedDurationMinutes),
              departureOffsetMinutes: Number(estimatedDurationMinutes),
            },
          ],
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Route ${routeNumber} created and added to campus network.`);
        setShowModal(false);
        setRouteNumber('');
        setRouteName('');
        await fetchData();
      } else {
        alert(data.error || 'Failed to create route');
      }
    } catch {
      alert('Network error while creating route.');
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
              Corridor Network
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '8px' }}>
              Route & Corridor Governance
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '760px', margin: 0 }}>
              Define stop sequence ordering, directional validity rules, timetable duration offsets, and passenger fare parameters.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowModal(true)}
          >
            <PlusCircle size={16} /> Create New Route ›
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

        {/* Routes Table */}
        <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Route No.</th>
                  <th>Corridor Name</th>
                  <th>Origin → Destination</th>
                  <th>Stops</th>
                  <th>Est. Travel</th>
                  <th>Distance</th>
                  <th>Fare</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => {
                  const origin = stops.find((s) => s.id === r.originStopId);
                  const dest = stops.find((s) => s.id === r.destinationStopId);

                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                        Route {r.routeNumber}
                      </td>
                      <td style={{ fontWeight: 700 }}>{r.routeName}</td>
                      <td>
                        {origin?.name || r.originStopId} → {dest?.name || r.destinationStopId}
                      </td>
                      <td>
                        <strong>{r.stops.length}</strong> ordered stops
                      </td>
                      <td>~{r.estimatedDurationMinutes} mins</td>
                      <td>{r.distanceKm} km</td>
                      <td>{r.fareAmount === 0 ? 'FREE' : `₹${r.fareAmount}`}</td>
                      <td>
                        <span className="badge badge-success">{r.status.toUpperCase()}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: New Route */}
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
            <div className="card" style={{ maxWidth: '580px', width: '100%', padding: '28px', backgroundColor: '#ffffff' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>
                Create Campus Bus Route
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
                Configures directional sequence and travel time offsets.
              </p>

              <form onSubmit={handleCreateRoute}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Route Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 105"
                      value={routeNumber}
                      onChange={(e) => setRouteNumber(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Route Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Amaravati Secretariat ↔ Campus Shuttle"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Short summary of road corridors served..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Origin Bay</label>
                    <select
                      className="form-select"
                      value={originStopId}
                      onChange={(e) => setOriginStopId(e.target.value)}
                      required
                    >
                      {stops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Destination Bay</label>
                    <select
                      className="form-select"
                      value={destinationStopId}
                      onChange={(e) => setDestinationStopId(e.target.value)}
                      required
                    >
                      {stops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Est. Duration (m)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={estimatedDurationMinutes}
                      onChange={(e) => setEstimatedDurationMinutes(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Distance (km)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fare (₹)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={fareAmount}
                      onChange={(e) => setFareAmount(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
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
                    {submitting ? 'Creating...' : 'Publish Corridor Route ›'}
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
