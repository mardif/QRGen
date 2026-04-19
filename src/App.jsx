import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import QRCodeStyling from 'qr-code-styling';
import './App.css';

// ── Constants ──────────────────────────────────────────────────────────────
const QR_SIZE = 256;
const CIRCLE_MIN_MARGIN_PCT = 0.18;
const LOGO_PCT_MIN = 10;
const LOGO_PCT_MAX = 35;
const LOGO_PCT_MAX_SAFE = 18; // max when logo overlaps a finder pattern corner

const FINDER_POSITIONS = new Set(['top-left', 'top-right', 'bottom-left']);

const DOT_TYPES          = ['square', 'dots', 'rounded', 'extra-rounded', 'classy', 'classy-rounded'];
const CORNER_SQ_TYPES    = ['square', 'extra-rounded', 'dot', 'dots', 'rounded', 'classy'];
const CORNER_DOT_TYPES   = ['square', 'dot', 'dots', 'rounded'];
const OUTPUT_SIZES       = [256, 512, 1024, 2048];
const DATA_TYPES = [
  { key: 'url',   label: 'URL'   },
  { key: 'text',  label: 'Text'  },
  { key: 'wifi',  label: 'WiFi'  },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'vcard', label: 'vCard' },
];

const POSITIONS = [
  { key: 'top-left',      align: 'start',  justify: 'start'  },
  { key: 'top-center',    align: 'start',  justify: 'center' },
  { key: 'top-right',     align: 'start',  justify: 'end'    },
  { key: 'middle-left',   align: 'center', justify: 'start'  },
  { key: 'center',        align: 'center', justify: 'center' },
  { key: 'middle-right',  align: 'center', justify: 'end'    },
  { key: 'bottom-left',   align: 'end',    justify: 'start'  },
  { key: 'bottom-center', align: 'end',    justify: 'center' },
  { key: 'bottom-right',  align: 'end',    justify: 'end'    },
];

const EMPTY_PATTERN = [1,1,1,0,1, 1,0,1,0,1, 1,1,1,0,0, 0,0,0,1,0, 1,0,1,1,1];

// ── Helpers ────────────────────────────────────────────────────────────────
function getLogoCoords(pos, logoSize, margin = 0) {
  const contentSize = QR_SIZE - 2 * margin;
  const p = {
    'top-left':      [margin,                                   margin],
    'top-center':    [margin + (contentSize - logoSize) / 2,    margin],
    'top-right':     [margin + contentSize - logoSize,           margin],
    'middle-left':   [margin,                                   margin + (contentSize - logoSize) / 2],
    'center':        [margin + (contentSize - logoSize) / 2,    margin + (contentSize - logoSize) / 2],
    'middle-right':  [margin + contentSize - logoSize,           margin + (contentSize - logoSize) / 2],
    'bottom-left':   [margin,                                   margin + contentSize - logoSize],
    'bottom-center': [margin + (contentSize - logoSize) / 2,    margin + contentSize - logoSize],
    'bottom-right':  [margin + contentSize - logoSize,           margin + contentSize - logoSize],
  };
  return p[pos] ?? p['center'];
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function SectionHead({ label }) {
  return (
    <div className="section-head">
      <span className="section-label">{label}</span>
      <div className="section-rule" />
    </div>
  );
}

function SubLabel({ label }) {
  return (
    <div className="sub-head">
      <span className="sub-label">{label}</span>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export default function App() {
  // Data
  const [dataType, setDataType]         = useState('url');
  const [urlInput, setUrlInput]         = useState('');
  const [wifiSsid, setWifiSsid]         = useState('');
  const [wifiPass, setWifiPass]         = useState('');
  const [wifiEnc, setWifiEnc]           = useState('WPA');
  const [vcardName, setVcardName]       = useState('');
  const [vcardOrg, setVcardOrg]         = useState('');
  const [vcardPhone, setVcardPhone]     = useState('');
  const [vcardEmail, setVcardEmail]     = useState('');

  // Logo
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [logoFileUrl, setLogoFileUrl]   = useState('');
  const [logoFileName, setLogoFileName] = useState('');
  const [logoSource, setLogoSource]     = useState('');
  const [logoSizePct, setLogoSizePct]   = useState(15);
  const [logoPos, setLogoPos]           = useState('center');
  const [logoLoadError, setLogoLoadError] = useState('');

  // Style
  const [dotType, setDotType]                   = useState('square');
  const [cornerSquareType, setCornerSquareType] = useState('square');
  const [cornerDotType, setCornerDotType]       = useState('square');
  const [qrShape, setQrShape]                   = useState('square');
  const [margin, setMargin]                     = useState(0);

  // Colors
  const [dotColor, setDotColor]     = useState('#000000');
  const [bgColor, setBgColor]       = useState('#ffffff');
  const [useGradient, setUseGradient] = useState(false);
  const [gradColor1, setGradColor1] = useState('#000000');
  const [gradColor2, setGradColor2] = useState('#555555');
  const [gradRotation, setGradRotation] = useState(0);

  // Export
  const [outputSize, setOutputSize]   = useState(1024);
  const [copyState, setCopyState]     = useState('idle'); // idle | success | error
  const [downloading, setDownloading] = useState(false);

  // Refs
  const qrDivRef      = useRef(null);
  const logoCanvasRef = useRef(null);
  const qrInstanceRef = useRef(null);

  // ── Derived ──
  const activeLogoUrl = logoSource === 'url' ? logoUrlInput : logoFileUrl;
  const hasLogo       = Boolean(activeLogoUrl);
  const isFinderPos   = FINDER_POSITIONS.has(logoPos);
  const effectiveSizePct = isFinderPos ? Math.min(logoSizePct, LOGO_PCT_MAX_SAFE) : logoSizePct;
  const logoSizePx    = Math.round(QR_SIZE * effectiveSizePct / 100);

  const urlWarning = useMemo(() => {
    if (dataType !== 'url' || !urlInput) return '';
    try { new URL(urlInput); return ''; }
    catch { return 'Not a valid URL — QR will still be generated'; }
  }, [dataType, urlInput]);

  const qrData = useMemo(() => {
    switch (dataType) {
      case 'url':
      case 'text':   return urlInput;
      case 'email':  return urlInput ? `mailto:${urlInput}` : '';
      case 'phone':  return urlInput ? `tel:${urlInput}` : '';
      case 'wifi':   return wifiSsid
        ? `WIFI:T:${wifiEnc};S:${wifiSsid};P:${wifiPass};;`
        : '';
      case 'vcard': {
        if (!vcardName) return '';
        const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcardName}`, `N:${vcardName};;;;`];
        if (vcardOrg)   lines.push(`ORG:${vcardOrg}`);
        if (vcardPhone) lines.push(`TEL:${vcardPhone}`);
        if (vcardEmail) lines.push(`EMAIL:${vcardEmail}`);
        lines.push('END:VCARD');
        return lines.join('\r\n');
      }
      default: return urlInput;
    }
  }, [dataType, urlInput, wifiSsid, wifiPass, wifiEnc, vcardName, vcardOrg, vcardPhone, vcardEmail]);

  const buildConfig = useCallback((size = QR_SIZE) => {
    // Circle clips canvas corners which removes finder patterns — force enough margin
    // so QR content fits inside the inscribed circle: margin >= size * (1 - 1/√2) / 2 ≈ 14.6%
    // 18% gives ~8px clearance at 256px, absorbing anti-alias + library floor-rounding variance
    const circleMinMargin = Math.round(size * CIRCLE_MIN_MARGIN_PCT);
    const effectiveMargin = qrShape === 'circle' ? Math.max(margin, circleMinMargin) : margin;
    const dotsOptions = useGradient
      ? { type: dotType, gradient: { type: 'linear', rotation: gradRotation * Math.PI / 180, colorStops: [{ offset: 0, color: gradColor1 }, { offset: 1, color: gradColor2 }] } }
      : { type: dotType, color: dotColor };
    return {
      width: size,
      height: size,
      data: qrData || ' ',
      shape: qrShape,
      margin: effectiveMargin,
      dotsOptions,
      cornersSquareOptions: { type: cornerSquareType, color: dotColor },
      cornersDotOptions:    { type: cornerDotType,    color: dotColor },
      backgroundOptions:    { color: bgColor },
      qrOptions: { errorCorrectionLevel: (hasLogo || qrShape === 'circle') ? 'H' : 'M' },
    };
  }, [qrData, qrShape, margin, dotType, dotColor, cornerSquareType, cornerDotType, bgColor,
      hasLogo, useGradient, gradColor1, gradColor2, gradRotation]);

  // ── QR instance: create once ──
  useEffect(() => {
    if (!qrDivRef.current) return;
    const instance = new QRCodeStyling({ type: 'canvas', width: QR_SIZE, height: QR_SIZE, data: ' ' });
    qrInstanceRef.current = instance;
    instance.append(qrDivRef.current);
  }, []);

  // ── QR instance: update on every option change ──
  useEffect(() => {
    qrInstanceRef.current?.update({ type: 'canvas', ...buildConfig(QR_SIZE) });
  }, [buildConfig]);

  // ── Logo overlay ──
  useEffect(() => {
    const canvas = logoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, QR_SIZE, QR_SIZE);
    setLogoLoadError('');
    if (!activeLogoUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLogoLoadError('');
      const logoMargin = qrShape === 'circle' ? Math.max(margin, Math.round(QR_SIZE * CIRCLE_MIN_MARGIN_PCT)) : margin;
      const [x, y] = getLogoCoords(logoPos, logoSizePx, logoMargin);
      ctx.clearRect(0, 0, QR_SIZE, QR_SIZE);
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, logoSizePx, logoSizePx);
      ctx.drawImage(img, x, y, logoSizePx, logoSizePx);
    };
    img.onerror = () => setLogoLoadError('Could not load image — check the URL or try a different file');
    img.src = activeLogoUrl;
  }, [activeLogoUrl, logoPos, logoSizePct, margin, bgColor, qrShape]);

  // ── Blob URL cleanup ──
  useEffect(() => {
    return () => { if (logoFileUrl?.startsWith('blob:')) URL.revokeObjectURL(logoFileUrl); };
  }, [logoFileUrl]);

  // ── Handlers ──
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFileUrl(URL.createObjectURL(file));
    setLogoFileName(file.name);
    setLogoSource('file');
    setLogoUrlInput('');
    setLogoLoadError('');
  };

  const clearLogo = () => {
    if (logoFileUrl?.startsWith('blob:')) URL.revokeObjectURL(logoFileUrl);
    setLogoFileUrl('');
    setLogoFileName('');
    setLogoUrlInput('');
    setLogoSource('');
    setLogoLoadError('');
  };

  const handleDownload = async (format) => {
    if (!qrData || downloading) return;
    setDownloading(true);
    try {
      if (format === 'svg') {
        const svgInstance = new QRCodeStyling({ type: 'svg', ...buildConfig(QR_SIZE) });
        svgInstance.download({ name: 'qrcode', extension: 'svg' });
        return;
      }

      const scale = outputSize / QR_SIZE;
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden';
      document.body.appendChild(container);
      const hiResInstance = new QRCodeStyling({ type: 'canvas', ...buildConfig(outputSize) });
      hiResInstance.append(container);
      await new Promise(r => setTimeout(r, 250));

      const qrCanvas = container.querySelector('canvas');
      if (!qrCanvas) { document.body.removeChild(container); return; }

      const out = document.createElement('canvas');
      out.width = outputSize;
      out.height = outputSize;
      const ctx = out.getContext('2d');
      if (format === 'jpeg') { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, outputSize, outputSize); }
      ctx.drawImage(qrCanvas, 0, 0);
      document.body.removeChild(container);

      if (hasLogo && activeLogoUrl) {
        try {
          const logo = await loadImage(activeLogoUrl);
          const scaledLogoSize = logoSizePx * scale;
          const effMarginPreview = qrShape === 'circle' ? Math.max(margin, Math.round(QR_SIZE * CIRCLE_MIN_MARGIN_PCT)) : margin;
          const [x, y] = getLogoCoords(logoPos, scaledLogoSize, effMarginPreview * scale);
          ctx.fillStyle = bgColor;
          ctx.fillRect(x, y, scaledLogoSize, scaledLogoSize);
          ctx.drawImage(logo, x, y, scaledLogoSize, scaledLogoSize);
        } catch { /* logo failed silently */ }
      }

      const a = document.createElement('a');
      a.href = out.toDataURL(format === 'jpeg' ? 'image/jpeg' : `image/${format}`, 0.95);
      a.download = `qrcode.${format === 'jpeg' ? 'jpg' : format}`;
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = () => {
    const qrCanvas = qrDivRef.current?.querySelector('canvas');
    if (!qrCanvas) return;
    const out = document.createElement('canvas');
    out.width = QR_SIZE; out.height = QR_SIZE;
    const ctx = out.getContext('2d');
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, QR_SIZE, QR_SIZE);
    ctx.drawImage(qrCanvas, 0, 0);
    if (hasLogo && logoCanvasRef.current) ctx.drawImage(logoCanvasRef.current, 0, 0);
    out.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopyState('success');
      } catch {
        setCopyState('error');
      } finally {
        setTimeout(() => setCopyState('idle'), 2000);
      }
    });
  };

  // ── Input placeholders by type ──
  const inputPlaceholder = {
    url:   'https://example.com',
    text:  'Enter any text',
    email: 'user@example.com',
    phone: '+1 555 0123',
  }[dataType] ?? '';

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">QR<span>.</span>gen</h1>
        <span className="app-tag">code generator</span>
      </header>

      <div className="layout">
        {/* ════ Controls ════ */}
        <div className="controls-col">

          {/* Data */}
          <div className="section">
            <SectionHead label="Data" />
            <div className="chip-group" style={{ marginBottom: '0.75rem' }}>
              {DATA_TYPES.map(({ key, label }) => (
                <button key={key} className={`chip${dataType === key ? ' active' : ''}`}
                  onClick={() => setDataType(key)}>{label}</button>
              ))}
            </div>

            {dataType === 'wifi' ? (
              <div className="multi-input">
                <input className="text-input" placeholder="Network name (SSID)" value={wifiSsid}
                  onChange={e => setWifiSsid(e.target.value)} />
                <input className="text-input" type="password" placeholder="Password" value={wifiPass}
                  onChange={e => setWifiPass(e.target.value)} />
                <div className="chip-group">
                  {['WPA', 'WEP', 'nopass'].map(enc => (
                    <button key={enc} className={`chip${wifiEnc === enc ? ' active' : ''}`}
                      onClick={() => setWifiEnc(enc)}>{enc}</button>
                  ))}
                </div>
              </div>
            ) : dataType === 'vcard' ? (
              <div className="multi-input">
                <input className="text-input" placeholder="Full name *" value={vcardName}
                  onChange={e => setVcardName(e.target.value)} />
                <input className="text-input" placeholder="Organization" value={vcardOrg}
                  onChange={e => setVcardOrg(e.target.value)} />
                <input className="text-input" placeholder="Phone" value={vcardPhone}
                  onChange={e => setVcardPhone(e.target.value)} />
                <input className="text-input" placeholder="Email" value={vcardEmail}
                  onChange={e => setVcardEmail(e.target.value)} />
              </div>
            ) : (
              <>
                <input className={`text-input${urlWarning ? ' input-warn' : ''}`}
                  type="text" placeholder={inputPlaceholder} value={urlInput}
                  onChange={e => setUrlInput(e.target.value.trim())} />
                {urlWarning && <p className="input-warning">{urlWarning}</p>}
              </>
            )}
          </div>

          {/* Logo */}
          <div className="section">
            <SectionHead label="Logo (optional)" />
            <div className="file-row">
              <label className="file-trigger">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 1z"/>
                </svg>
                upload file
                <input className="file-input" type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFileChange} />
              </label>
              {hasLogo && (
                <button className="clear-btn" onClick={clearLogo} title="Remove logo">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                  </svg>
                  remove
                </button>
              )}
            </div>
            {logoFileName && <p className="file-name">{logoFileName}</p>}
            <input className="text-input" type="text" placeholder="or paste image URL"
              value={logoUrlInput}
              onChange={e => { setLogoUrlInput(e.target.value.trim()); setLogoSource('url'); setLogoFileUrl(''); setLogoFileName(''); }} />
            {logoLoadError && <p className="input-warning">{logoLoadError}</p>}

            {hasLogo && (
              <div className="logo-card">
                <span className="logo-card-label">position</span>
                <div>
                  <div className="pos-grid">
                    {POSITIONS.map(({ key, align, justify }) => {
                      const isFinder = FINDER_POSITIONS.has(key);
                      return (
                        <button key={key}
                          className={`pos-btn${logoPos === key ? ' active' : ''}${isFinder ? ' finder-risk' : ''}`}
                          onClick={() => setLogoPos(key)}
                          title={isFinder ? `${key} — finder pattern corner (size capped at ${LOGO_PCT_MAX_SAFE}%)` : key}>
                          <div className="pos-inner" style={{ alignItems: align, justifyContent: justify }}>
                            <div className="pos-dot" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {isFinderPos && (
                    <p className="finder-warning">
                      Finder pattern corner — size capped at {LOGO_PCT_MAX_SAFE}% to keep QR scannable
                    </p>
                  )}
                </div>

                <span className="logo-card-label">size</span>
                <div className="slider-wrap">
                  <input type="range" className="styled-slider"
                    min={LOGO_PCT_MIN} max={LOGO_PCT_MAX} value={logoSizePct}
                    onChange={e => setLogoSizePct(Number(e.target.value))} />
                  <span className="slider-meta">
                    <strong>{effectiveSizePct}%</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Style */}
          <div className="section">
            <SectionHead label="Style" />

            <SubLabel label="dots" />
            <div className="chip-group" style={{ marginBottom: '0.9rem' }}>
              {DOT_TYPES.map(t => (
                <button key={t} className={`chip${dotType === t ? ' active' : ''}`} onClick={() => setDotType(t)}>{t}</button>
              ))}
            </div>

            <SubLabel label="outer corners" />
            <div className="chip-group" style={{ marginBottom: '0.9rem' }}>
              {CORNER_SQ_TYPES.map(t => (
                <button key={t} className={`chip${cornerSquareType === t ? ' active' : ''}`} onClick={() => setCornerSquareType(t)}>{t}</button>
              ))}
            </div>

            <SubLabel label="inner corners" />
            <div className="chip-group" style={{ marginBottom: '0.9rem' }}>
              {CORNER_DOT_TYPES.map(t => (
                <button key={t} className={`chip${cornerDotType === t ? ' active' : ''}`} onClick={() => setCornerDotType(t)}>{t}</button>
              ))}
            </div>

            <SubLabel label="shape" />
            <div className="chip-group" style={{ marginBottom: qrShape === 'circle' ? '0.4rem' : '0.9rem' }}>
              {['square', 'circle'].map(s => (
                <button key={s} className={`chip${qrShape === s ? ' active' : ''}`} onClick={() => setQrShape(s)}>{s}</button>
              ))}
            </div>
            {qrShape === 'circle' && (
              <p className="finder-warning" style={{ marginBottom: '0.9rem' }}>
                Margin auto-increased to keep finder patterns inside circle
              </p>
            )}

            <SubLabel label="quiet zone" />
            <div className="slider-wrap">
              <input type="range" className="styled-slider" min={0} max={20} value={margin}
                onChange={e => setMargin(Number(e.target.value))} />
              <span className="slider-meta"><strong>{margin}px</strong></span>
            </div>
          </div>

          {/* Colors */}
          <div className="section">
            <SectionHead label="Colors" />

            <div className="color-row">
              <label className="color-field">
                <span className="color-label">Foreground</span>
                <input type="color" value={dotColor}
                  onChange={e => { setDotColor(e.target.value); if (useGradient) { setGradColor1(e.target.value); } }} />
              </label>
              <label className="color-field">
                <span className="color-label">Background</span>
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} />
              </label>
            </div>

            <div className="gradient-toggle">
              <button className={`chip${useGradient ? ' active' : ''}`}
                onClick={() => setUseGradient(v => !v)}>
                gradient
              </button>
            </div>

            {useGradient && (
              <div className="gradient-controls">
                <div className="color-row">
                  <label className="color-field">
                    <span className="color-label">Start</span>
                    <input type="color" value={gradColor1} onChange={e => setGradColor1(e.target.value)} />
                  </label>
                  <label className="color-field">
                    <span className="color-label">End</span>
                    <input type="color" value={gradColor2} onChange={e => setGradColor2(e.target.value)} />
                  </label>
                </div>
                <SubLabel label="angle" />
                <div className="slider-wrap">
                  <input type="range" className="styled-slider" min={0} max={360} value={gradRotation}
                    onChange={e => setGradRotation(Number(e.target.value))} />
                  <span className="slider-meta"><strong>{gradRotation}°</strong></span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ════ Preview ════ */}
        <div className="preview-col">
          <div className="qr-frame">
            <div className="qr-inner" style={{ display: qrData ? 'inline-flex' : 'none' }}>
              <div ref={qrDivRef} />
              <canvas ref={logoCanvasRef} className="logo-overlay" width={QR_SIZE} height={QR_SIZE} />
            </div>
            {!qrData && (
              <div className="qr-empty">
                <div className="qr-empty-grid">
                  {EMPTY_PATTERN.map((on, i) => (
                    <div key={i} className="qr-cell" style={{ opacity: on ? 1 : 0 }} />
                  ))}
                </div>
                <span className="qr-empty-text">enter data to generate</span>
              </div>
            )}
          </div>

          {/* Output size */}
          <div className="size-row">
            <span className="size-label">Export at</span>
            {OUTPUT_SIZES.map(s => (
              <button key={s} className={`size-btn${outputSize === s ? ' active' : ''}`}
                onClick={() => setOutputSize(s)}>
                {s >= 1024 ? `${s / 1024}k` : s}
              </button>
            ))}
          </div>

          {/* Download */}
          <div className="dl-group">
            {['png', 'jpeg', 'webp', 'svg'].map(fmt => (
              <button key={fmt} className={`dl-btn${downloading ? ' loading' : ''}`}
                onClick={() => handleDownload(fmt)} disabled={!qrData || downloading}>
                {fmt === 'jpeg' ? 'jpg' : fmt}
              </button>
            ))}
          </div>

          {/* Copy */}
          <button className={`copy-btn${copyState === 'success' ? ' success' : copyState === 'error' ? ' error' : ''}`}
            onClick={handleCopy} disabled={!qrData}>
            {copyState === 'success' ? 'copied!' : copyState === 'error' ? 'clipboard unavailable' : 'copy to clipboard'}
          </button>
        </div>
      </div>

      <footer className="app-footer">
        <span>Mariano Di Felice</span>
        <span className="footer-sep">·</span>
        <a href="mailto:mariano.difelice@gmail.com">mariano.difelice@gmail.com</a>
        <span className="footer-sep">·</span>
        <a href="https://linkedin.com/in/mariano-di-felice" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      </footer>
    </div>
  );
}
