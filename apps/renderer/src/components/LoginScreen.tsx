import React, { useState, useEffect } from 'react';
import type { User, UserSession } from '@bakery/contracts';
import { MezaanLogo } from './MezaanLogo.js';

interface LoginScreenProps {
  storeName?: string;
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ storeName: _storeName, onLoginSuccess }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsername, setSelectedUsername] = useState<string>('admin');
  const [pin, setPin] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [mode, setMode] = useState<'pin' | 'password'>('pin');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Load available active users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await window.bakery.users.list(1);
        if (res.success && res.data.length > 0) {
          const active = res.data.filter((u) => u.isActive);
          setUsers(active);
          if (active.length > 0) {
            setSelectedUsername(active[0]!.username);
          }
        }
      } catch (e) {
        console.error('Failed to load users for login screen:', e);
      }
    };
    loadUsers();
  }, []);

  const executeLogin = async (uname: string, pinCode?: string, passWord?: string) => {
    setErrorMsg(null);
    if (!uname.trim()) {
      setErrorMsg('Please enter or select a username');
      return;
    }
    if (mode === 'pin' && !pinCode) {
      setErrorMsg('Please enter your 4-digit PIN');
      return;
    }
    if (mode === 'password' && !passWord) {
      setErrorMsg('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const res = await window.bakery.auth.login({
        username: uname.trim().toLowerCase(),
        pin: mode === 'pin' ? pinCode : undefined,
        password: mode === 'password' ? passWord : undefined,
      });

      if (res.success) {
        onLoginSuccess(res.data);
      } else {
        setErrorMsg(res.error.message || 'Login failed: incorrect PIN or password');
        setPin('');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeypadPress = (val: string) => {
    setErrorMsg(null);
    if (val === 'clear') {
      setPin('');
    } else if (val === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
    } else if (pin.length < 8) {
      const nextPin = pin + val;
      setPin(nextPin);
      if (nextPin.length === 4) {
        // Immediate auto-login on 4th digit
        executeLogin(selectedUsername, nextPin, undefined);
      }
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeLogin(selectedUsername, pin, password);
  };

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'pin') return;

      if (/^[0-9]$/.test(e.key)) {
        if (pin.length < 8) {
          setErrorMsg(null);
          const nextPin = pin + e.key;
          setPin(nextPin);
          if (nextPin.length === 4) {
            // Immediate auto-login on 4th digit via physical keyboard
            executeLogin(selectedUsername, nextPin, undefined);
          }
        }
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (pin.length >= 4) {
          executeLogin(selectedUsername, pin, undefined);
        }
      } else if (e.key === 'Escape') {
        setPin('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, mode, selectedUsername]);

  const selectedUser = users.find((u) => u.username === selectedUsername);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, #2e1306 0%, #1a0b04 55%, #0d0502 100%)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* 2-Column Balanced Container — ZERO vertical scrolling */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.05fr 1fr',
          width: '100%',
          maxWidth: '920px',
          height: 'min(580px, 92vh)',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(217, 119, 6, 0.3)',
          overflow: 'hidden',
        }}
      >
        {/* LEFT COLUMN: Clean Brand Showcase with Standalone Logo & Clean Spacing */}
        <div
          style={{
            background: 'linear-gradient(165deg, #241107 0%, #341608 50%, #1a0b04 100%)',
            color: '#ffffff',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRight: '2px solid #5a2e12',
            position: 'relative',
          }}
        >
          {/* Top: Logo Emblem & Title */}
          <div style={{ textAlign: 'center' }}>
            {/* Standalone Circular Logo from Photo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <MezaanLogo size={105} theme="dark" />
            </div>

            {/* Urdu Title */}
            <h1
              style={{
                fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                fontSize: '28px',
                fontWeight: 700,
                color: '#fbbf24',
                margin: 0,
                lineHeight: 1.8,
                padding: '4px 0',
                textShadow: '0 2px 4px rgba(0,0,0,0.6)',
              }}
            >
              میزان سویٹس اینڈ بیکرز
            </h1>

            {/* English Title */}
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '1.8px',
                color: '#fed7aa',
                textTransform: 'uppercase',
                marginTop: '2px',
              }}
            >
              MEZAAN SWEETS & BAKERS
            </div>

            {/* Taglines with proper breathing room */}
            <div
              style={{
                fontFamily: "'Noto Nastaliq Urdu', serif",
                fontSize: '14px',
                color: '#fef08a',
                marginTop: '10px',
              }}
            >
              تازہ اور معیاری مٹھائیوں کا مرکز
            </div>

            <div
              style={{
                fontFamily: "'Noto Nastaliq Urdu', serif",
                fontSize: '12px',
                color: '#fdba74',
                fontStyle: 'italic',
                marginTop: '4px',
              }}
            >
              "ذائقہ ہمارا، پہچان آپ کی"
            </div>
          </div>

          {/* Center Divider */}
          <div
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(217, 119, 6, 0.4), transparent)',
              margin: '10px 0',
            }}
          />

          {/* Bottom Location & Contact Summary */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              borderRadius: '12px',
              border: '1px solid rgba(217, 119, 6, 0.35)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {/* Address */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>📍</span>
              <strong style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: '13px', color: '#fde68a' }}>
                چک نمبر 24 ج ب لاہوریاں
              </strong>
            </div>

            {/* Event Order Notice */}
            <div
              style={{
                fontSize: '11px',
                color: '#fed7aa',
                textAlign: 'center',
                lineHeight: 1.4,
                fontFamily: "'Noto Nastaliq Urdu', serif",
              }}
            >
              شادی بیاہ، سالگرہ اور دیگر تقریبات کیلئے مال آرڈر پر بھی تیار کیا جاتا ہے
            </div>

            {/* Direct Proprietor Phone Numbers */}
            <div
              style={{
                borderTop: '1px solid rgba(217, 119, 6, 0.25)',
                paddingTop: '8px',
                marginTop: '4px',
                display: 'flex',
                justifyContent: 'space-around',
                fontSize: '10.5px',
                color: '#f8fafc',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <span style={{ color: '#fed7aa', display: 'block', fontSize: '9.5px', fontFamily: "'Noto Nastaliq Urdu', serif" }}>چوہدری تبسم</span>
                <strong>0343-7763677</strong>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ color: '#fed7aa', display: 'block', fontSize: '9.5px', fontFamily: "'Noto Nastaliq Urdu', serif" }}>چوہدری عبدالرؤف</span>
                <strong>0309-8809054</strong>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ color: '#fed7aa', display: 'block', fontSize: '9.5px', fontFamily: "'Noto Nastaliq Urdu', serif" }}>چوہدری محسن</span>
                <strong>0301-6008625</strong>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Clean, Compact Touch PIN Terminal (Zero-Scroll) */}
        <div
          style={{
            padding: '24px 26px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: '#ffffff',
            boxSizing: 'border-box',
          }}
        >
          <div>
            {/* Header / Active Operator Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>
                OPERATOR SIGN IN
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: selectedUser?.role === 'admin' ? '#fef3c7' : '#e0e7ff',
                  color: selectedUser?.role === 'admin' ? '#92400e' : '#3730a3',
                }}
              >
                {selectedUser ? `${selectedUser.displayName} (${selectedUser.role})` : 'Terminal Login'}
              </span>
            </div>

            {/* Operator Selector Buttons & Custom Username Input */}
            <div style={{ marginBottom: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                  maxHeight: '75px',
                  overflowY: 'auto',
                  padding: '2px 0',
                  marginBottom: '8px',
                }}
              >
                {users.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedUsername('admin')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '2px solid #d97706',
                      background: '#fffbeb',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#92400e',
                      cursor: 'pointer',
                    }}
                  >
                    👑 Store Admin
                  </button>
                ) : (
                  users.map((u) => {
                    const isSelected = u.username.toLowerCase() === selectedUsername.toLowerCase();
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedUsername(u.username);
                          setPin('');
                          setErrorMsg(null);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: isSelected ? '2px solid #d97706' : '1px solid #e2e8f0',
                          background: isSelected ? '#fffbeb' : '#f8fafc',
                          color: isSelected ? '#92400e' : '#334155',
                          fontSize: '11px',
                          fontWeight: isSelected ? 700 : 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.12s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>{u.role === 'admin' ? '👑' : u.role === 'baker' ? '👨‍🍳' : '👤'}</span>
                        <span>{u.displayName || u.username}</span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Direct Username Entry */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  padding: '4px 10px',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Username:</span>
                <input
                  type="text"
                  value={selectedUsername}
                  onChange={(e) => {
                    setSelectedUsername(e.target.value);
                    setPin('');
                    setErrorMsg(null);
                  }}
                  placeholder="Type username (e.g. admin, cashier1, manager1)"
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Error Message if any */}
            {errorMsg && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#b91c1c',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  textAlign: 'center',
                }}
              >
                ⚠️ {errorMsg}
              </div>
            )}

            {/* MODE: PIN LOGIN */}
            {mode === 'pin' ? (
              <div>
                {/* Masked PIN Display Box */}
                <div
                  style={{
                    background: '#241107',
                    color: '#fbbf24',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    textAlign: 'center',
                    marginBottom: '10px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    border: '1px solid #5a2e12',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                  }}
                >
                  {pin.length === 0 ? (
                    <span style={{ color: '#a16207', fontSize: '12px', fontWeight: 600 }}>
                      Enter 4-Digit Security PIN
                    </span>
                  ) : (
                    Array.from({ length: pin.length }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#fbbf24',
                          boxShadow: '0 0 6px rgba(251, 191, 36, 0.8)',
                          display: 'inline-block',
                        }}
                      />
                    ))
                  )}
                </div>

                {/* Compact Numeric Keypad */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '6px',
                    marginBottom: '10px',
                  }}
                >
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => {
                    const isSpecial = key === 'clear' || key === 'backspace';
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeypadPress(key)}
                        style={{
                          height: '38px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          background: isSpecial ? '#f1f5f9' : '#ffffff',
                          color: isSpecial ? '#64748b' : '#0f172a',
                          fontSize: isSpecial ? '11px' : '17px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.1s ease',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                      >
                        {key === 'clear' ? 'CLR' : key === 'backspace' ? '⌫' : key}
                      </button>
                    );
                  })}
                </div>

                {/* Submit Action Button */}
                <button
                  type="button"
                  onClick={() => handleLogin()}
                  disabled={loading || pin.length < 4}
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '8px',
                    border: 'none',
                    background: loading || pin.length < 4
                      ? '#cbd5e1'
                      : 'linear-gradient(135deg, #d97706, #b45309)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: loading || pin.length < 4 ? 'not-allowed' : 'pointer',
                    boxShadow: loading || pin.length < 4 ? 'none' : '0 2px 6px rgba(180, 83, 9, 0.35)',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {loading ? 'Authenticating...' : 'Unlock Terminal →'}
                </button>
              </div>
            ) : (
              /* MODE: PASSWORD LOGIN */
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    autoFocus
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      padding: '0 12px',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !password}
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '8px',
                    border: 'none',
                    background: loading || !password
                      ? '#cbd5e1'
                      : 'linear-gradient(135deg, #d97706, #b45309)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: loading || !password ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Signing in...' : 'Sign In with Password →'}
                </button>
              </form>
            )}
          </div>

          {/* Footer Footnote: Switch Mode & Hint */}
          <div style={{ textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'pin' ? 'password' : 'pin');
                setPin('');
                setPassword('');
                setErrorMsg(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#b45309',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {mode === 'pin' ? '🔑 Sign in with Password instead' : '🔢 Use 4-Digit Quick PIN instead'}
            </button>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
              Default Admin PIN: <strong>1234</strong> · Cashier PIN: <strong>1111</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
