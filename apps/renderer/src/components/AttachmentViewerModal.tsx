import React, { useState, useEffect } from 'react';

interface AttachmentViewerModalProps {
  attachmentPath: string | null;
  title?: string;
  onClose: () => void;
}

export const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({
  attachmentPath,
  title = 'Attachment Document / Photo',
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  useEffect(() => {
    if (!attachmentPath) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setZoom(1);
    setRotation(0);

    window.bakery.attachments
      .read(attachmentPath)
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setImageDataUrl(`data:${res.data.mimeType};base64,${res.data.base64Data}`);
        } else {
          setError(res.error.message || 'Attachment file not found on disk.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Error loading attachment file.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [attachmentPath]);

  if (!attachmentPath) return null;

  const handleDownload = () => {
    if (!imageDataUrl) return;
    const a = document.createElement('a');
    a.href = imageDataUrl;
    a.download = attachmentPath.split('/').pop() || 'attachment.webp';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '900px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>👁️</span>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
              {title}
            </h3>
            <span
              style={{
                fontSize: '11px',
                color: '#64748b',
                backgroundColor: '#e2e8f0',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontFamily: 'monospace',
              }}
            >
              {attachmentPath}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {imageDataUrl && (
              <>
                <button
                  type="button"
                  title="Zoom In"
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  🔍+
                </button>
                <button
                  type="button"
                  title="Zoom Out"
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  🔍-
                </button>
                <button
                  type="button"
                  title="Rotate 90°"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  🔄
                </button>
                <button
                  type="button"
                  title="Download File"
                  onClick={handleDownload}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #2563eb',
                    background: '#2563eb',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  📥 Download
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#64748b',
                fontSize: '16px',
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#0f172a',
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            maxHeight: '75vh',
            padding: '24px',
            userSelect: 'none',
          }}
        >
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#94a3b8' }}>
              <span style={{ fontSize: '28px' }}>⏳</span>
              <span style={{ fontSize: '13px' }}>Loading attachment photo...</span>
            </div>
          )}

          {error && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#f87171' }}>
              <span style={{ fontSize: '32px' }}>⚠️</span>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>Unable to display photo</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{error}</div>
            </div>
          )}

          {imageDataUrl && !loading && (
            <div
              style={{
                transition: 'transform 0.15s ease-out',
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                display: 'inline-block',
              }}
            >
              <img
                src={imageDataUrl}
                alt="Attachment Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: '4px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                }}
              />
            </div>
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e5e7eb',
            fontSize: '11px',
            color: '#64748b',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Zoom: {Math.round(zoom * 100)}% · Rotation: {rotation}°</span>
          <span>Lightweight WebP Document Format (~80-120 KB)</span>
        </div>
      </div>
    </div>
  );
};
