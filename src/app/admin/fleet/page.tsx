'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bus, VehicleDocument } from '@/types/transit';
import { validateApRegistration, formatApRegistration, KNOWN_AP_RTO_CODES } from '@/lib/ap-registration';
import {
  Bus as BusIcon,
  PlusCircle,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  Search,
  Filter,
  FileText,
} from 'lucide-react';

export default function AdminFleetPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New Bus Registration Form Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [busCode, setBusCode] = useState('');
  const [rawRegistration, setRawRegistration] = useState('');
  const [vehicleType, setVehicleType] = useState('Air-Conditioned Express');
  const [model, setModel] = useState('');
  const [manufacturer, setManufacturer] = useState('Tata Motors');
  const [seatingCapacity, setSeatingCapacity] = useState(48);
  const [standingCapacity, setStandingCapacity] = useState(15);
  const [hasWheelchairAccess, setHasWheelchairAccess] = useState(false);
  const [fuelType, setFuelType] = useState<Bus['fuelType']>('diesel');
  const [assignedDepot, setAssignedDepot] = useState('Amaravati Central Depot');
  const [adminOverride, setAdminOverride] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live registration check preview
  const regValidationPreview = rawRegistration
    ? validateApRegistration(rawRegistration, false, adminOverride)
    : null;

  const fetchFleet = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fleet');
      const data = await res.json();
      setBuses(data.buses || []);
    } catch (err) {
      console.error('Failed to load fleet', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  const handleRegisterBus = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!busCode || !rawRegistration) {
      setFormError('Bus Code and Registration Number are required.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busCode,
          rawRegistration,
          vehicleType,
          model: model || `${manufacturer} Commercial`,
          manufacturer,
          seatingCapacity: Number(seatingCapacity),
          standingCapacity: Number(standingCapacity),
          hasWheelchairAccess,
          fuelType,
          assignedDepot,
          adminOverride,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFormSuccess(data.message || 'Vehicle registered successfully.');
        setShowAddModal(false);
        setBusCode('');
        setRawRegistration('');
        await fetchFleet();
      } else {
        setFormError(data.error || 'Failed to register vehicle.');
      }
    } catch {
      setFormError('Network communication failed. Please check connection and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBuses = buses.filter((b) => {
    const matchesSearch =
      b.busCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.rawRegistration.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.model.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container">
        {/* Breadcrumb / Top Link */}
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
              MoRTH & AP State Compliance
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '8px' }}>
              Fleet Registry & Andhra Pradesh Registration
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '760px', margin: 0 }}>
              Authorized management of university buses. Enforces standard Andhra Pradesh registration formats (such as AP39TL1001, AP 39 AB 1234), duplicate registration protection, and document expirations.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
          >
            <PlusCircle size={16} /> Register New Bus ›
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

        {/* Search & Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div style={{ position: 'relative', width: '360px', maxWidth: '100%' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-muted)',
              }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Search by Bus ID or AP Registration..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px', height: '42px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)' }}>
              Status:
            </span>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: '42px', fontSize: '13px', width: 'auto' }}
            >
              <option value="all">All Vehicles</option>
              <option value="active">Active Service</option>
              <option value="maintenance">In Maintenance</option>
              <option value="out_of_service">Out of Service</option>
            </select>
          </div>
        </div>

        {/* Fleet Table */}
        <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bus ID</th>
                  <th>Official AP Registration</th>
                  <th>RTO District</th>
                  <th>Type & Model</th>
                  <th>Capacity</th>
                  <th>Fuel</th>
                  <th>Depot</th>
                  <th>Status</th>
                  <th>Documents / FC</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuses.map((bus) => {
                  const rtoCode = bus.registrationNumber.slice(2, 4);
                  const rtoName = KNOWN_AP_RTO_CODES[rtoCode] || `AP-${rtoCode}`;
                  const expiringDoc = bus.documents.find((d) => d.status === 'expiring_soon' || d.status === 'expired');

                  return (
                    <tr key={bus.id}>
                      <td style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                        {bus.busCode}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          {formatApRegistration(bus.registrationNumber)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                          Raw: {bus.rawRegistration}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--color-body)' }}>{rtoName}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{bus.vehicleType}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                          {bus.manufacturer} • {bus.model}
                        </div>
                      </td>
                      <td>
                        <div><strong>{bus.seatingCapacity}</strong> seats</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>+{bus.standingCapacity} standees</div>
                      </td>
                      <td style={{ textTransform: 'uppercase', fontSize: '12px' }}>
                        {bus.fuelType}
                      </td>
                      <td style={{ fontSize: '12px' }}>{bus.assignedDepot}</td>
                      <td>
                        {bus.status === 'active' ? (
                          <span className="badge badge-success">ACTIVE</span>
                        ) : bus.status === 'maintenance' ? (
                          <span className="badge badge-warning">MAINTENANCE</span>
                        ) : (
                          <span className="badge badge-error">{bus.status}</span>
                        )}
                      </td>
                      <td>
                        {expiringDoc ? (
                          <span className="badge badge-warning" title={`${expiringDoc.documentType}: expires ${expiringDoc.expiryDate}`}>
                            ⚠️ {expiringDoc.documentType.toUpperCase()} EXPIRING
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            ✓ ALL VALID
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Register New Bus */}
        {showAddModal && (
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
            <div
              className="card"
              style={{
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '32px',
                backgroundColor: '#ffffff',
              }}
            >
              <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>
                Register Bus in University Fleet
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '20px' }}>
                Enforces Andhra Pradesh vehicle registration format, duplicate rejection, and internal fleet ID mapping.
              </p>

              {formError && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '12px',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  {formError}
                </div>
              )}

              <form onSubmit={handleRegisterBus}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Internal Bus Code</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. BUS-05"
                      value={busCode}
                      onChange={(e) => setBusCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">AP Registration Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. AP39TL1005 or AP 39 AB 1234"
                      value={rawRegistration}
                      onChange={(e) => setRawRegistration(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Real-time Validation Preview Box */}
                {regValidationPreview && (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: regValidationPreview.isValid ? '#ecfdf5' : '#fffbeb',
                      border: `1px solid ${regValidationPreview.isValid ? '#a7f3d0' : '#fde68a'}`,
                      color: regValidationPreview.isValid ? '#065f46' : '#92400e',
                      fontSize: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    {regValidationPreview.isValid ? (
                      <div>
                        ✓ <strong>Valid AP Registration:</strong> Normalized to{' '}
                        <code>{regValidationPreview.normalized}</code> ({regValidationPreview.rtoLocation})
                      </div>
                    ) : (
                      <div>⚠️ {regValidationPreview.errorMessage}</div>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Vehicle Type</label>
                    <select
                      className="form-select"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                    >
                      <option value="Air-Conditioned Express">Air-Conditioned Express</option>
                      <option value="Standard Campus Bus">Standard Campus Bus</option>
                      <option value="Zero-Emission Electric Shuttle">Zero-Emission Electric Shuttle</option>
                      <option value="Mini Shuttle">Mini Shuttle</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Manufacturer</label>
                    <select
                      className="form-select"
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                    >
                      <option value="Tata Motors">Tata Motors</option>
                      <option value="Ashok Leyland">Ashok Leyland</option>
                      <option value="Eicher Motors">Eicher Motors</option>
                      <option value="BharatBenz">BharatBenz</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Seating Capacity</label>
                    <input
                      type="number"
                      className="form-control"
                      min={10}
                      max={70}
                      value={seatingCapacity}
                      onChange={(e) => setSeatingCapacity(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fuel / Energy Type</label>
                    <select
                      className="form-select"
                      value={fuelType}
                      onChange={(e) => setFuelType(e.target.value as Bus['fuelType'])}
                    >
                      <option value="diesel">Diesel</option>
                      <option value="cng">CNG</option>
                      <option value="electric">Electric (EV)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Depot</label>
                  <input
                    type="text"
                    className="form-control"
                    value={assignedDepot}
                    onChange={(e) => setAssignedDepot(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="adminOverride"
                    checked={adminOverride}
                    onChange={(e) => setAdminOverride(e.target.checked)}
                  />
                  <label htmlFor="adminOverride" style={{ fontSize: '13px', color: 'var(--color-body)' }}>
                    Administrator Override (Approve non-standard or legacy vehicle registration exception)
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={submitting}
                  >
                    {submitting ? 'Verifying & Registering...' : 'Register Vehicle ›'}
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
