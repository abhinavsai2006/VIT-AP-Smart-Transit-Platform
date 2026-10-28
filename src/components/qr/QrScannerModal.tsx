'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle,
  AlertOctagon,
  Clock,
  XCircle,
  AlertTriangle,
  QrCode,
  X,
  Volume2,
} from 'lucide-react';
import { BoardingScan } from '@/types/transit';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  staffId: string;
  onScanComplete?: (scan: BoardingScan) => void;
}

export default function QrScannerModal({
  isOpen,
  onClose,
  tripId,
  staffId,
  onScanComplete,
}: QrScannerModalProps) {
  const [manualToken, setManualToken] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [scanResult, setScanResult] = useState<BoardingScan | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const handleValidation = useCallback(async (tokenToVerify: string) => {
    if (!tokenToVerify || validating) return;
    setValidating(true);

    try {
      const res = await fetch('/api/tickets/validate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenToVerify.trim(),
          tripId,
          scannedByStaffId: staffId,
          deviceFingerprint: navigator.userAgent,
        }),
      });

      const data = await res.json();
      if (res.ok && data.scan) {
        setScanResult(data.scan);
        if (onScanComplete) {
          onScanComplete(data.scan);
        }
      } else {
        setScanResult({
          id: `scan-${Date.now()}`,
          ticketId: 'UNKNOWN',
          tripId,
          scannedByStaffId: staffId,
          scannedAt: new Date().toISOString(),
          scanResult: 'invalid',
          notes: data.error || 'Server validation error',
        });
      }
    } catch {
      setScanResult({
        id: `scan-${Date.now()}`,
        ticketId: 'UNKNOWN',
        tripId,
        scannedByStaffId: staffId,
        scannedAt: new Date().toISOString(),
        scanResult: 'invalid',
        notes: 'Verification service unreachable.',
      });
    } finally {
      setValidating(false);
    }
  }, [onScanComplete, staffId, tripId, validating]);

  const tick = useCallback(() => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            // Found a QR code! Validate it
            stopCamera();
            handleValidation(code.data);
            return;
          }
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  }, [handleValidation, stopCamera]);

  const startCamera = async () => {
    setCameraError(null);
    setScanResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsCameraActive(true);
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Camera access denied or unavailable.';
      setCameraError(
        `${errorMsg} Please use manual token validation below or ensure camera permissions are allowed.`
      );
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScanResult(null);
      setManualToken('');
    }
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  const getResultBadge = (result: BoardingScan['scanResult']) => {
    switch (result) {
      case 'valid':
        return {
          title: 'VALID TICKET — BOARDING PERMITTED',
          icon: <CheckCircle size={32} color="#059669" />,
          bgColor: '#ecfdf5',
          borderColor: '#10b981',
          textColor: '#065f46',
        };
      case 'already_used':
        return {
          title: 'ALREADY CONSUMED (DUPLICATE SCAN)',
          icon: <AlertOctagon size={32} color="#dc2626" />,
          bgColor: '#fef2f2',
          borderColor: '#ef4444',
          textColor: '#991b1b',
        };
      case 'wrong_trip':
        return {
          title: 'WRONG TRIP OR ROUTE',
          icon: <AlertTriangle size={32} color="#d97706" />,
          bgColor: '#fffbeb',
          borderColor: '#f59e0b',
          textColor: '#92400e',
        };
      case 'expired':
        return {
          title: 'TICKET EXPIRED',
          icon: <Clock size={32} color="#4b5563" />,
          bgColor: '#f3f4f6',
          borderColor: '#9ca3af',
          textColor: '#1f2937',
        };
      case 'cancelled':
        return {
          title: 'TICKET CANCELLED',
          icon: <XCircle size={32} color="#dc2626" />,
          bgColor: '#fef2f2',
          borderColor: '#ef4444',
          textColor: '#991b1b',
        };
      default:
        return {
          title: 'INVALID TICKET / TAMPERED TOKEN',
          icon: <AlertOctagon size={32} color="#dc2626" />,
          bgColor: '#fef2f2',
          borderColor: '#ef4444',
          textColor: '#991b1b',
        };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(26, 33, 41, 0.85)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: 'var(--color-canvas)',
          padding: 0,
          border: '1px solid var(--color-hairline-strong)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--color-surface-dark)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={20} color="#1c69d4" />
            <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.5px' }}>
              CONDUCTOR QR SCANNER & BOARDING
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px' }}>
          {/* Trip Header info */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--color-surface-soft)',
              border: '1px solid var(--color-hairline)',
              marginBottom: '16px',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <strong>Active Trip ID:</strong> {tripId}
            </div>
            <div>
              <strong>Validator Staff:</strong> {staffId}
            </div>
          </div>

          {/* Scan Result Feedback Banner */}
          {scanResult && (
            <div
              style={{
                padding: '16px',
                border: `2px solid ${getResultBadge(scanResult.scanResult).borderColor}`,
                backgroundColor: getResultBadge(scanResult.scanResult).bgColor,
                color: getResultBadge(scanResult.scanResult).textColor,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div>{getResultBadge(scanResult.scanResult).icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' }}>
                  {getResultBadge(scanResult.scanResult).title}
                </div>
                {scanResult.passengerName && (
                  <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '4px' }}>
                    Passenger: {scanResult.passengerName} (Ticket: {scanResult.ticketNumber})
                  </div>
                )}
                <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9 }}>
                  {scanResult.notes}
                </div>
                <div style={{ fontSize: '11px', marginTop: '6px', color: 'var(--color-muted)' }}>
                  Scanned at: {new Date(scanResult.scannedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                </div>
              </div>
            </div>
          )}

          {/* Camera Viewfinder */}
          <div style={{ marginBottom: '16px' }}>
            {isCameraActive ? (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '240px',
                  backgroundColor: '#000000',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Reticle Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    width: '180px',
                    height: '180px',
                    border: '2px solid #1c69d4',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    fontSize: '11px',
                    color: '#ffffff',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    padding: '2px 8px',
                  }}
                >
                  Point camera at passenger QR code
                </div>
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '160px',
                  backgroundColor: 'var(--color-surface-soft)',
                  border: '1px dashed var(--color-hairline-strong)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '16px',
                }}
              >
                <Camera size={32} color="var(--color-muted)" />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={startCamera}
                >
                  Activate Live Camera Scanner
                </button>
              </div>
            )}

            {cameraError && (
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'var(--color-error)',
                  backgroundColor: '#fef2f2',
                  padding: '8px 12px',
                  border: '1px solid #fecaca',
                }}
              >
                {cameraError}
              </div>
            )}
          </div>

          {/* Manual Token Verification (For test environments or camera fallback) */}
          <div
            style={{
              padding: '14px',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Manual Ticket Reference / Signed Token
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Paste token or enter VIT-BK-88401"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                style={{ height: '40px', fontSize: '13px' }}
              />
              <button
                type="button"
                className="btn btn-dark btn-sm"
                disabled={!manualToken.trim() || validating}
                onClick={() => handleValidation(manualToken)}
              >
                {validating ? 'Checking...' : 'Verify'}
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '6px' }}>
              Atomic server-side verification: Prevents duplicate boarding and enforces trip match.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--color-surface-soft)',
            borderTop: '1px solid var(--color-hairline)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Volume2 size={14} />
            <span>Audio & Visual Feedback Active</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
