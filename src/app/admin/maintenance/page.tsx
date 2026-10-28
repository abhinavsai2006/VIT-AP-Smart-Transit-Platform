'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MaintenanceRecord, FuelRecord, Bus } from '@/types/transit';
import {
  Wrench,
  Fuel,
  PlusCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  FileText,
} from 'lucide-react';

export default function AdminMaintenancePage() {
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [fuel, setFuel] = useState<FuelRecord[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [activeTab, setActiveTab] = useState<'maintenance' | 'fuel'>('maintenance');
  const [loading, setLoading] = useState(true);

  // New Maintenance Form Modal
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintBusId, setMaintBusId] = useState('');
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceRecord['maintenanceType']>('preventive');
  const [description, setDescription] = useState('');
  const [partsCost, setPartsCost] = useState(5000);
  const [labourCost, setLabourCost] = useState(1500);
  const [vendorName, setVendorName] = useState('Amaravati Commercial Care');
  const [serviceDate, setServiceDate] = useState('2026-10-28');
  const [odometerAtService, setOdometerAtService] = useState(45000);
  const [maintSubmitting, setMaintSubmitting] = useState(false);

  // New Fuel Form Modal
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [fuelBusId, setFuelBusId] = useState('');
  const [fuelType, setFuelType] = useState<FuelRecord['fuelType']>('diesel');
  const [quantityLiters, setQuantityLiters] = useState(80);
  const [costPerLiter, setCostPerLiter] = useState(98.5);
  const [odometerReading, setOdometerReading] = useState(45200);
  const [fuelStation, setFuelStation] = useState('IOCL Institutional Pump');
  const [fuelSubmitting, setFuelSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mRes, fRes, bRes] = await Promise.all([
        fetch('/api/maintenance'),
        fetch('/api/fuel'),
        fetch('/api/fleet'),
      ]);
      const mData = await mRes.json();
      const fData = await fRes.json();
      const bData = await bRes.json();

      setMaintenance(mData.records || []);
      setFuel(fData.fuel || []);
      setBuses(bData.buses || []);

      if (bData.buses && bData.buses.length > 0) {
        if (!maintBusId) setMaintBusId(bData.buses[0].id);
        if (!fuelBusId) setFuelBusId(bData.buses[0].id);
      }
    } catch (err) {
      console.error('Failed to load maintenance records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setMaintSubmitting(true);

    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: maintBusId,
          maintenanceType,
          description,
          partsCost: Number(partsCost),
          labourCost: Number(labourCost),
          vendorName,
          serviceDate,
          odometerAtService: Number(odometerAtService),
          status: 'in_progress',
          reportedBy: 'Transport Fleet Incharge',
        }),
      });

      if (res.ok) {
        setShowMaintModal(false);
        setDescription('');
        await fetchData();
      } else {
        alert('Failed to log maintenance work order');
      }
    } catch {
      alert('Network error while saving maintenance record.');
    } finally {
      setMaintSubmitting(false);
    }
  };

  const handleCreateFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    setFuelSubmitting(true);

    try {
      const res = await fetch('/api/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: fuelBusId,
          fuelType,
          quantityLiters: Number(quantityLiters),
          costPerLiter: Number(costPerLiter),
          odometerReading: Number(odometerReading),
          fuelStation,
          date: new Date().toISOString().split('T')[0],
          recordedBy: 'Depot Fuel Attendant',
        }),
      });

      if (res.ok) {
        setShowFuelModal(false);
        await fetchData();
      } else {
        alert('Failed to log fuel record');
      }
    } catch {
      alert('Network error while logging fuel.');
    } finally {
      setFuelSubmitting(false);
    }
  };

  // Aggregations
  const totalMaintCost = maintenance.reduce((sum, m) => sum + (m.totalCost || 0), 0);
  const totalFuelCost = fuel.reduce((sum, f) => sum + (f.totalCost || 0), 0);
  const totalFuelLiters = fuel.reduce((sum, f) => sum + (f.quantityLiters || 0), 0);

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
              Operational Expenses & Workshop
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '8px' }}>
              Maintenance, Fuel & Fleet Expenditure
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '760px', margin: 0 }}>
              Audit preventive service schedules, breakdown repair costs, commercial vendor work orders, and institutional fuel consumption.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowFuelModal(true)}
            >
              <Fuel size={16} /> Log Fuel Purchase
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowMaintModal(true)}
            >
              <PlusCircle size={16} /> New Work Order ›
            </button>
          </div>
        </div>

        {/* 3 Expense Stat Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
              Maintenance Expenditure
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-ink)', margin: '6px 0' }}>
              ₹{totalMaintCost.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              {maintenance.length} work orders logged
            </div>
          </div>

          <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
              Fuel Expenditure
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-ink)', margin: '6px 0' }}>
              ₹{totalFuelCost.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              {totalFuelLiters.toFixed(1)} Liters dispensed
            </div>
          </div>

          <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
              Vehicles in Maintenance
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-warning)', margin: '6px 0' }}>
              {buses.filter((b) => b.status === 'maintenance').length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              Unassigned until safety clearance
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'maintenance' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('maintenance')}
          >
            Maintenance Work Orders ({maintenance.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'fuel' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('fuel')}
          >
            Fuel Logs ({fuel.length})
          </button>
        </div>

        {/* Tab 1: Maintenance Table */}
        {activeTab === 'maintenance' ? (
          <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bus</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Vendor</th>
                    <th>Odometer</th>
                    <th>Date</th>
                    <th>Parts Cost</th>
                    <th>Labour Cost</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenance.map((m) => {
                    const bus = buses.find((b) => b.id === m.busId);
                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                          {bus?.busCode || m.busId}
                        </td>
                        <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                          {m.maintenanceType}
                        </td>
                        <td style={{ fontSize: '13px', maxWidth: '240px' }}>
                          {m.description}
                        </td>
                        <td style={{ fontSize: '12px' }}>{m.vendorName}</td>
                        <td style={{ fontSize: '12px' }}>{m.odometerAtService.toLocaleString()} km</td>
                        <td style={{ fontSize: '12px' }}>{m.serviceDate}</td>
                        <td>₹{m.partsCost.toLocaleString()}</td>
                        <td>₹{m.labourCost.toLocaleString()}</td>
                        <td style={{ fontWeight: 800 }}>₹{m.totalCost.toLocaleString()}</td>
                        <td>
                          {m.status === 'completed' ? (
                            <span className="badge badge-success">COMPLETED</span>
                          ) : (
                            <span className="badge badge-warning">IN PROGRESS</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Tab 2: Fuel Table */
          <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bus</th>
                    <th>Fuel Type</th>
                    <th>Quantity</th>
                    <th>Rate / Liter</th>
                    <th>Total Expense</th>
                    <th>Odometer</th>
                    <th>Station</th>
                    <th>Logged By</th>
                  </tr>
                </thead>
                <tbody>
                  {fuel.map((f) => {
                    const bus = buses.find((b) => b.id === f.busId);
                    return (
                      <tr key={f.id}>
                        <td style={{ fontSize: '12px' }}>{f.date}</td>
                        <td style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                          {bus?.busCode || f.busId}
                        </td>
                        <td style={{ textTransform: 'uppercase', fontSize: '12px' }}>{f.fuelType}</td>
                        <td style={{ fontWeight: 700 }}>{f.quantityLiters} L</td>
                        <td>₹{f.costPerLiter}</td>
                        <td style={{ fontWeight: 800 }}>₹{f.totalCost.toLocaleString()}</td>
                        <td style={{ fontSize: '12px' }}>{f.odometerReading.toLocaleString()} km</td>
                        <td style={{ fontSize: '12px' }}>{f.fuelStation}</td>
                        <td style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{f.recordedBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Add Maintenance */}
        {showMaintModal && (
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
                Log Maintenance Work Order
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
                Automatically sets vehicle status to &quot;maintenance&quot; to prevent unsafe trip allocation.
              </p>

              <form onSubmit={handleCreateMaintenance}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Vehicle</label>
                    <select
                      className="form-select"
                      value={maintBusId}
                      onChange={(e) => setMaintBusId(e.target.value)}
                      required
                    >
                      {buses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.busCode} ({b.registrationNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Maintenance Category</label>
                    <select
                      className="form-select"
                      value={maintenanceType}
                      onChange={(e) => setMaintenanceType(e.target.value as MaintenanceRecord['maintenanceType'])}
                    >
                      <option value="preventive">Scheduled Preventive Service</option>
                      <option value="breakdown">Breakdown / Emergency Repair</option>
                      <option value="inspection">Safety & Brake Inspection</option>
                      <option value="oil_change">Engine Oil & Filter Service</option>
                      <option value="tire_replacement">Tire Replacement & Alignment</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Work Description</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Brake pad renewal and hydraulic pressure flush"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Parts Cost (₹)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={partsCost}
                      onChange={(e) => setPartsCost(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Labour Cost (₹)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={labourCost}
                      onChange={(e) => setLabourCost(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Odometer</label>
                    <input
                      type="number"
                      className="form-control"
                      value={odometerAtService}
                      onChange={(e) => setOdometerAtService(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Service Vendor</label>
                  <input
                    type="text"
                    className="form-control"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowMaintModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={maintSubmitting}
                  >
                    {maintSubmitting ? 'Saving...' : 'Save Work Order ›'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Fuel */}
        {showFuelModal && (
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
              <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>
                Log Fuel Purchase
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
                Records liters, cost per liter, and odometer reading for fuel efficiency audits.
              </p>

              <form onSubmit={handleCreateFuel}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Vehicle</label>
                    <select
                      className="form-select"
                      value={fuelBusId}
                      onChange={(e) => setFuelBusId(e.target.value)}
                      required
                    >
                      {buses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.busCode} ({b.registrationNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fuel Type</label>
                    <select
                      className="form-select"
                      value={fuelType}
                      onChange={(e) => setFuelType(e.target.value as FuelRecord['fuelType'])}
                    >
                      <option value="diesel">Diesel</option>
                      <option value="cng">CNG</option>
                      <option value="electric">Electric (EV Units)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Liters / Units</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      value={quantityLiters}
                      onChange={(e) => setQuantityLiters(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rate / Unit (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={costPerLiter}
                      onChange={(e) => setCostPerLiter(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Odometer</label>
                    <input
                      type="number"
                      className="form-control"
                      value={odometerReading}
                      onChange={(e) => setOdometerReading(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Dispenser / Station</label>
                  <input
                    type="text"
                    className="form-control"
                    value={fuelStation}
                    onChange={(e) => setFuelStation(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowFuelModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={fuelSubmitting}
                  >
                    {fuelSubmitting ? 'Saving...' : 'Record Fuel Log ›'}
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
