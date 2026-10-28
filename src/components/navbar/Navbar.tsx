'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Bus,
  MapPin,
  Compass,
  Ticket,
  Calendar,
  AlertCircle,
  Shield,
  UserCheck,
  QrCode,
  Wrench,
  Menu,
  X,
  Radio,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, availableUsers, switchUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  const isLinkActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'student': return { label: 'Student', cls: 'badge-info' };
      case 'faculty': return { label: 'Faculty', cls: 'badge-info' };
      case 'transport_admin': return { label: 'Admin', cls: 'badge-success' };
      case 'driver': return { label: 'Driver', cls: 'badge-warning' };
      case 'conductor': return { label: 'Conductor', cls: 'badge-warning' };
      case 'department_coordinator': return { label: 'Coordinator', cls: 'badge-neutral' };
      case 'support_operator': return { label: 'Helpdesk', cls: 'badge-neutral' };
      default: return { label: role, cls: 'badge-neutral' };
    }
  };

  const roleInfo = getRoleBadge(user.role);

  return (
    <>
      <header
        style={{
          height: '64px',
          backgroundColor: 'var(--color-canvas)',
          borderBottom: '1px solid var(--color-hairline)',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo & University Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-ink)' }}>
              <div
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bus size={20} strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1.1 }}>
                  VIT-AP SMART TRANSIT
                </div>
                <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                  Andhra Pradesh Campus Fleet
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav
            style={{
              display: 'none',
              alignItems: 'center',
              gap: '24px',
            }}
            className="desktop-nav"
          >
            <Link
              href="/routes"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: isLinkActive('/routes') ? 'var(--color-primary)' : 'var(--color-ink)',
                borderBottom: isLinkActive('/routes') ? '2px solid var(--color-primary)' : '2px solid transparent',
                padding: '20px 0',
              }}
            >
              Routes
            </Link>

            <Link
              href="/stops"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: isLinkActive('/stops') ? 'var(--color-primary)' : 'var(--color-ink)',
                borderBottom: isLinkActive('/stops') ? '2px solid var(--color-primary)' : '2px solid transparent',
                padding: '20px 0',
              }}
            >
              Stops
            </Link>

            <Link
              href="/tracking"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: isLinkActive('/tracking') ? 'var(--color-primary)' : 'var(--color-ink)',
                borderBottom: isLinkActive('/tracking') ? '2px solid var(--color-primary)' : '2px solid transparent',
                padding: '20px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Radio size={14} className="live-pulse" style={{ width: 8, height: 8 }} />
              Live Tracking
            </Link>

            <Link
              href="/tickets"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: isLinkActive('/tickets') ? 'var(--color-primary)' : 'var(--color-ink)',
                borderBottom: isLinkActive('/tickets') ? '2px solid var(--color-primary)' : '2px solid transparent',
                padding: '20px 0',
              }}
            >
              Tickets
            </Link>

            <Link
              href="/pass"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: isLinkActive('/pass') ? 'var(--color-primary)' : 'var(--color-ink)',
                borderBottom: isLinkActive('/pass') ? '2px solid var(--color-primary)' : '2px solid transparent',
                padding: '20px 0',
              }}
            >
              Bus Pass
            </Link>

            <Link
              href="/events"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: isLinkActive('/events') ? 'var(--color-primary)' : 'var(--color-ink)',
                borderBottom: isLinkActive('/events') ? '2px solid var(--color-primary)' : '2px solid transparent',
                padding: '20px 0',
              }}
            >
              Shuttles
            </Link>

            {/* Portal link dynamically displayed according to role */}
            {user.role === 'transport_admin' || user.role === 'super_admin' ? (
              <Link
                href="/admin"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: isLinkActive('/admin') ? 'var(--color-primary)' : 'var(--color-ink)',
                  borderBottom: isLinkActive('/admin') ? '2px solid var(--color-primary)' : '2px solid transparent',
                  padding: '20px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Shield size={14} />
                Admin Console
              </Link>
            ) : user.role === 'driver' ? (
              <Link
                href="/driver"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: isLinkActive('/driver') ? 'var(--color-primary)' : 'var(--color-ink)',
                  borderBottom: isLinkActive('/driver') ? '2px solid var(--color-primary)' : '2px solid transparent',
                  padding: '20px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Compass size={14} />
                Driver Cockpit
              </Link>
            ) : user.role === 'conductor' ? (
              <Link
                href="/conductor"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: isLinkActive('/conductor') ? 'var(--color-primary)' : 'var(--color-ink)',
                  borderBottom: isLinkActive('/conductor') ? '2px solid var(--color-primary)' : '2px solid transparent',
                  padding: '20px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <QrCode size={14} />
                Conductor Scanner
              </Link>
            ) : user.role === 'department_coordinator' ? (
              <Link
                href="/coordinator"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: isLinkActive('/coordinator') ? 'var(--color-primary)' : 'var(--color-ink)',
                  borderBottom: isLinkActive('/coordinator') ? '2px solid var(--color-primary)' : '2px solid transparent',
                  padding: '20px 0',
                }}
              >
                Event Logistics
              </Link>
            ) : null}
          </nav>

          {/* Right Action: Role Selector & User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Quick Role Switcher Button */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-hairline-strong)',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                title="Switch active user profile to test various portals"
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Active Role
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-ink)' }}>
                    {roleInfo.label}
                  </span>
                </div>
                <UserCheck size={16} color="var(--color-primary)" />
              </button>

              {roleSwitcherOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    width: '300px',
                    backgroundColor: 'var(--color-canvas)',
                    border: '1px solid var(--color-hairline-strong)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 2000,
                    padding: '8px 0',
                  }}
                >
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-hairline)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                    Switch Demo Account
                  </div>
                  {availableUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        switchUser(u.id);
                        setRoleSwitcherOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: 'none',
                        background: u.id === user.id ? 'var(--color-surface-soft)' : 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderLeft: u.id === user.id ? '3px solid var(--color-primary)' : '3px solid transparent',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-ink)' }}>
                          {u.fullName}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                          {u.email}
                        </div>
                      </div>
                      <span className={`badge ${getRoleBadge(u.role).cls}`} style={{ fontSize: '9px' }}>
                        {getRoleBadge(u.role).label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Account Dashboard Link */}
            <Link
              href="/dashboard"
              className="btn btn-secondary btn-sm"
              style={{ display: 'none' }}
              id="desktop-account-btn"
            >
              My Account
            </Link>

            {/* Mobile Menu Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="mobile-hamburger"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: '64px',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--color-canvas)',
            zIndex: 999,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            borderTop: '1px solid var(--color-hairline)',
            overflowY: 'auto',
          }}
        >
          <div style={{ borderBottom: '1px solid var(--color-hairline)', paddingBottom: '12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-muted)', fontWeight: 700 }}>
              Logged in as
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-ink)' }}>
              {user.fullName} ({roleInfo.label})
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-body)' }}>{user.email}</div>
          </div>

          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', fontWeight: 700, padding: '8px 0', color: 'var(--color-ink)' }}
          >
            Home / Journey Search
          </Link>
          <Link
            href="/routes"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', fontWeight: 700, padding: '8px 0', color: 'var(--color-ink)' }}
          >
            Route Directory
          </Link>
          <Link
            href="/stops"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', fontWeight: 700, padding: '8px 0', color: 'var(--color-ink)' }}
          >
            Bus Stop Directory
          </Link>
          <Link
            href="/tracking"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', fontWeight: 700, padding: '8px 0', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Radio size={16} /> Live GPS Tracking
          </Link>
          <Link
            href="/tickets"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', fontWeight: 700, padding: '8px 0', color: 'var(--color-ink)' }}
          >
            My QR Tickets & Passes
          </Link>
          <Link
            href="/pass"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', fontWeight: 700, padding: '8px 0', color: 'var(--color-primary)' }}
          >
            Official Student Bus Pass
          </Link>
          <Link
            href="/events"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', fontWeight: 700, padding: '8px 0', color: 'var(--color-ink)' }}
          >
            Event & Station Shuttles
          </Link>
          <Link
            href="/complaints"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', fontWeight: 700, padding: '8px 0', color: 'var(--color-ink)' }}
          >
            Support & Complaints
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: '15px', fontWeight: 700, padding: '8px 0', color: 'var(--color-ink)' }}
          >
            Passenger Dashboard
          </Link>

          <hr style={{ borderColor: 'var(--color-hairline)' }} />

          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-muted)', fontWeight: 700 }}>
            Operational Portals
          </div>
          <Link
            href="/driver"
            onClick={() => setMobileMenuOpen(false)}
            className="btn btn-secondary btn-sm"
            style={{ justifyContent: 'flex-start' }}
          >
            <Compass size={16} /> Driver Cockpit
          </Link>
          <Link
            href="/conductor"
            onClick={() => setMobileMenuOpen(false)}
            className="btn btn-secondary btn-sm"
            style={{ justifyContent: 'flex-start' }}
          >
            <QrCode size={16} /> Conductor QR Scanner
          </Link>
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="btn btn-primary btn-sm"
            style={{ justifyContent: 'flex-start' }}
          >
            <Shield size={16} /> Transport Admin Console
          </Link>
        </div>
      )}

      <style jsx global>{`
        @media (min-width: 1024px) {
          .desktop-nav {
            display: flex !important;
          }
          #desktop-account-btn {
            display: inline-flex !important;
          }
          .mobile-hamburger {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
