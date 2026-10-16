import React, { useState, useEffect, useCallback } from 'react';
import type { User, UserRole, Role } from '@rz-crm/contracts';

interface UsersTabProps {
  storeId?: number;
  currentUserId?: number;
  currentUserRole?: string;
  onRoleOrUserUpdated?: () => void;
}

const AVAILABLE_FORMS = [
  { key: 'pos', name: 'POS Sales Terminal', icon: '🛒', desc: 'Counter sales, cart, register drawer, shifts' },
  { key: 'purchasing', name: 'Purchasing & GRN', icon: '🚚', desc: 'Suppliers, purchase orders, goods receipts, khata' },
  { key: 'custom-orders', name: 'Special Client Bookings', icon: '📋', desc: 'Advance bookings, customer deposits, custom fabrication' },
  { key: 'inventory', name: 'Stock & Inventory', icon: '📦', desc: 'Live stock balances, stock ledger, adjustments' },
  { key: 'products', name: 'Product Catalog', icon: '🏷️', desc: 'Sanitary ware, pipes, fittings, dual prices, barcodes' },
  { key: 'production', name: 'Assembly & Packaging BOM', icon: '⚙️', desc: 'Bill of Materials (BOM), assembly kits, wastage tracking' },
  { key: 'reports', name: 'Sales & Shift Reports', icon: '📊', desc: 'Sales invoices, shift X/Z reconciliation, P&L reports' },
  { key: 'expenses', name: 'Expenses & Payroll', icon: '💸', desc: 'Utility bills, repairs, staff advances & monthly salary payroll' },
  { key: 'scanner', name: 'Barcode Scanner Hardware', icon: '🔍', desc: 'Barcode scanner test & hardware probe' },
] as const;


export const UsersTab: React.FC<UsersTabProps> = ({
  storeId = 1,
  currentUserId,
  currentUserRole = 'admin',
  onRoleOrUserUpdated,
}) => {
  const isAdmin = currentUserRole === 'admin';

  // Sub-tab Navigation
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'roles'>('users');

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('cashier');
  const [pin, setPin] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [userMsg, setUserMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submittingUser, setSubmittingUser] = useState<boolean>(false);

  // Roles State
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState<boolean>(true);
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleDisplayName, setNewRoleDisplayName] = useState<string>('');
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>(['pos']);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [roleMsg, setRoleMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submittingRole, setSubmittingRole] = useState<boolean>(false);

  // Reset Credentials Modal State
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newResetPin, setNewResetPin] = useState<string>('');
  const [newResetPassword, setNewResetPassword] = useState<string>('');
  const [resetSubmitting, setResetSubmitting] = useState<boolean>(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Edit User Modal State
  const [editModalUser, setEditModalUser] = useState<User | null>(null);
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('cashier');
  const [editPin, setEditPin] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editMsg, setEditMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Soft Delete Modal State
  const [softDeleteModalUser, setSoftDeleteModalUser] = useState<User | null>(null);
  const [softDeleteSubmitting, setSoftDeleteSubmitting] = useState<boolean>(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.bakery.users.list(storeId);
      if (res.success && res.data) {
        setUsers(res.data);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const res = await window.bakery.roles.list();
      if (res.success && res.data) {
        setRoles(res.data);
      }
    } catch (e) {
      console.error('Failed to load roles:', e);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [loadUsers, loadRoles]);

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);

    if (!username.trim() || !displayName.trim()) {
      setUserMsg({ type: 'err', text: 'Username and display name are required' });
      return;
    }
    if (pin && !/^\d{4,8}$/.test(pin)) {
      setUserMsg({ type: 'err', text: 'PIN must be 4 to 8 digits' });
      return;
    }

    setSubmittingUser(true);
    try {
      const res = await window.bakery.users.create({
        storeId,
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        role: selectedRole,
        pin: pin || undefined,
        password: password || undefined,
      });

      if (res.success) {
        setUserMsg({ type: 'ok', text: `User '${username}' created successfully with role '${selectedRole}'!` });
        setUsername('');
        setDisplayName('');
        setPin('');
        setPassword('');
        loadUsers();
      } else {
        setUserMsg({ type: 'err', text: res.error?.message || 'Failed to create user' });
      }
    } catch (err: unknown) {
      setUserMsg({ type: 'err', text: err instanceof Error ? err.message : 'Error creating user' });
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleRoleChange = async (user: User, newRole: UserRole) => {
    if (user.id === currentUserId && newRole !== 'admin') {
      alert('You cannot remove your own admin privileges while logged in.');
      return;
    }
    try {
      const res = await window.bakery.users.update({
        id: user.id,
        role: newRole,
      });
      if (res.success) {
        loadUsers();
      } else {
        alert(res.error?.message || 'Failed to update user role');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating user role');
    }
  };

  // --- RESET CREDENTIALS HANDLERS ---

  const handleOpenResetModal = (user: User) => {
    setResetModalUser(user);
    setNewResetPin('');
    setNewResetPassword('');
    setResetMsg(null);
  };

  const handleCloseResetModal = () => {
    setResetModalUser(null);
    setNewResetPin('');
    setNewResetPassword('');
    setResetMsg(null);
  };

  const handleResetCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setResetMsg(null);

    const pinVal = newResetPin.trim();
    const passVal = newResetPassword.trim();

    if (!pinVal && !passVal) {
      setResetMsg({ type: 'err', text: 'Please enter a new PIN, a new Password, or both' });
      return;
    }

    if (pinVal && !/^\d{4,8}$/.test(pinVal)) {
      setResetMsg({ type: 'err', text: 'PIN must be 4 to 8 digits' });
      return;
    }

    if (passVal && passVal.length < 4) {
      setResetMsg({ type: 'err', text: 'Password must be at least 4 characters' });
      return;
    }

    setResetSubmitting(true);
    try {
      const res = await window.bakery.users.update({
        id: resetModalUser.id,
        pin: pinVal || undefined,
        password: passVal || undefined,
      });

      if (res.success) {
        setResetMsg({ type: 'ok', text: `Credentials for '${resetModalUser.displayName}' updated successfully!` });
        setTimeout(() => {
          handleCloseResetModal();
        }, 1200);
      } else {
        setResetMsg({ type: 'err', text: res.error?.message || 'Failed to update credentials' });
      }
    } catch (err: unknown) {
      setResetMsg({ type: 'err', text: err instanceof Error ? err.message : 'Error updating credentials' });
    } finally {
      setResetSubmitting(false);
    }
  };

  // --- EDIT USER HANDLERS ---

  const handleOpenEditModal = (user: User) => {
    setEditModalUser(user);
    setEditDisplayName(user.displayName);
    setEditRole(user.role);
    setEditPin('');
    setEditPassword('');
    setEditMsg(null);
  };

  const handleCloseEditModal = () => {
    setEditModalUser(null);
    setEditDisplayName('');
    setEditPin('');
    setEditPassword('');
    setEditMsg(null);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalUser) return;
    setEditMsg(null);

    if (!editDisplayName.trim()) {
      setEditMsg({ type: 'err', text: 'Display name is required' });
      return;
    }

    if (editModalUser.id === currentUserId && editRole !== 'admin') {
      setEditMsg({ type: 'err', text: 'You cannot remove your own admin privileges while logged in.' });
      return;
    }

    if (editPin && !/^\d{4,8}$/.test(editPin)) {
      setEditMsg({ type: 'err', text: 'PIN must be 4 to 8 digits' });
      return;
    }

    if (editPassword && editPassword.length < 4) {
      setEditMsg({ type: 'err', text: 'Password must be at least 4 characters' });
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await window.bakery.users.update({
        id: editModalUser.id,
        displayName: editDisplayName.trim(),
        role: editRole,
        pin: editPin.trim() || undefined,
        password: editPassword.trim() || undefined,
      });

      if (res.success) {
        setEditMsg({ type: 'ok', text: `User '${editDisplayName.trim()}' updated successfully!` });
        setTimeout(() => {
          handleCloseEditModal();
          loadUsers();
          onRoleOrUserUpdated?.();
        }, 1000);
      } else {
        setEditMsg({ type: 'err', text: res.error?.message || 'Failed to update user' });
      }
    } catch (err: unknown) {
      setEditMsg({ type: 'err', text: err instanceof Error ? err.message : 'Error updating user' });
    } finally {
      setEditSubmitting(false);
    }
  };

  // --- SOFT DELETE / RESTORE HANDLERS ---

  const handlePromptSoftDelete = (user: User) => {
    if (user.id === currentUserId) {
      alert('You cannot soft-delete your own active account.');
      return;
    }
    setSoftDeleteModalUser(user);
  };

  const handleConfirmSoftDelete = async () => {
    if (!softDeleteModalUser) return;
    setSoftDeleteSubmitting(true);
    try {
      const res = await window.bakery.users.update({
        id: softDeleteModalUser.id,
        isActive: false,
      });
      if (res.success) {
        setSoftDeleteModalUser(null);
        loadUsers();
      } else {
        alert(res.error?.message || 'Failed to soft-delete user');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error soft-deleting user');
    } finally {
      setSoftDeleteSubmitting(false);
    }
  };

  const handleRestoreUser = async (user: User) => {
    try {
      const res = await window.bakery.users.update({
        id: user.id,
        isActive: true,
      });
      if (res.success) {
        loadUsers();
      } else {
        alert(res.error?.message || 'Failed to restore user');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error restoring user');
    }
  };

  // --- ROLE MANAGEMENT HANDLERS ---

  const handleTogglePermission = (formKey: string) => {
    setNewRolePermissions((prev) =>
      prev.includes(formKey) ? prev.filter((k) => k !== formKey) : [...prev, formKey]
    );
  };

  const handleSelectAllPermissions = () => {
    setNewRolePermissions(AVAILABLE_FORMS.map((f) => f.key));
  };

  const handleClearAllPermissions = () => {
    setNewRolePermissions([]);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleMsg(null);

    if (!newRoleDisplayName.trim()) {
      setRoleMsg({ type: 'err', text: 'Role display name is required' });
      return;
    }

    if (newRolePermissions.length === 0) {
      setRoleMsg({ type: 'err', text: 'Please assign at least one form to this role' });
      return;
    }

    setSubmittingRole(true);
    try {
      if (editingRoleId !== null) {
        // Update existing role
        const res = await window.bakery.roles.update({
          id: editingRoleId,
          displayName: newRoleDisplayName.trim(),
          permissions: newRolePermissions,
        });
        if (res.success) {
          setRoleMsg({ type: 'ok', text: `Role '${res.data.displayName}' updated successfully!` });
          setEditingRoleId(null);
          setNewRoleName('');
          setNewRoleDisplayName('');
          setNewRolePermissions(['pos']);
          loadRoles();
          loadUsers();
          onRoleOrUserUpdated?.();
        } else {
          setRoleMsg({ type: 'err', text: res.error?.message || 'Failed to update role' });
        }
      } else {
        // Create new role
        const code = (newRoleName.trim() || newRoleDisplayName.trim())
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');

        if (!code) {
          setRoleMsg({ type: 'err', text: 'Invalid role name or code' });
          setSubmittingRole(false);
          return;
        }

        const res = await window.bakery.roles.create({
          name: code,
          displayName: newRoleDisplayName.trim(),
          permissions: newRolePermissions,
        });

        if (res.success) {
          setRoleMsg({ type: 'ok', text: `Custom Role '${res.data.displayName}' created successfully!` });
          setNewRoleName('');
          setNewRoleDisplayName('');
          setNewRolePermissions(['pos']);
          loadRoles();
          onRoleOrUserUpdated?.();
        } else {
          setRoleMsg({ type: 'err', text: res.error?.message || 'Failed to create role' });
        }
      }
    } catch (err: unknown) {
      setRoleMsg({ type: 'err', text: err instanceof Error ? err.message : 'Error saving role' });
    } finally {
      setSubmittingRole(false);
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    setNewRoleName(role.name);
    setNewRoleDisplayName(role.displayName);
    setNewRolePermissions(role.permissions.includes('*') ? AVAILABLE_FORMS.map((f) => f.key) : role.permissions);
    setRoleMsg(null);
  };

  const handleCancelEditRole = () => {
    setEditingRoleId(null);
    setNewRoleName('');
    setNewRoleDisplayName('');
    setNewRolePermissions(['pos']);
    setRoleMsg(null);
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.isSystem) {
      alert('System default roles cannot be deleted.');
      return;
    }
    const confirm = window.confirm(`Are you sure you want to delete custom role '${role.displayName}'?`);
    if (!confirm) return;

    try {
      const res = await window.bakery.roles.delete({ id: role.id });
      if (res.success) {
        setRoleMsg({ type: 'ok', text: `Role '${role.displayName}' deleted.` });
        loadRoles();
        onRoleOrUserUpdated?.();
      } else {
        alert(res.error?.message || 'Failed to delete role');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting role');
    }
  };

  const getRoleBadgeStyle = (r: string) => {
    switch (r) {
      case 'admin':
        return { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' };
      case 'manager':
        return { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' };
      case 'purchaser':
        return { bg: '#ccfbf1', color: '#0f766e', border: '#5eead4' };
      case 'baker':
        return { bg: '#ffedd5', color: '#c2410c', border: '#fdba74' };
      case 'cashier':
        return { bg: '#ecfdf5', color: '#047857', border: '#6ee7b7' };
      default:
        return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' }; // custom roles
    }
  };

  // Find currently selected role's permissions for the preview in user creation
  const selectedRoleObj = roles.find((r) => r.name === selectedRole);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sub-tab Navigation Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#ffffff',
          padding: '10px 16px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`tab-btn ${activeSubTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('users')}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>👥</span>
            <span>Staff Accounts & Assignments</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: activeSubTab === 'users' ? '#3b82f6' : '#e2e8f0',
                color: activeSubTab === 'users' ? '#ffffff' : '#475569',
              }}
            >
              {users.length}
            </span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className={`tab-btn ${activeSubTab === 'roles' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('roles')}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid #f59e0b',
                background: activeSubTab === 'roles' ? '#f59e0b' : '#fffbeb',
                color: activeSubTab === 'roles' ? '#ffffff' : '#b45309',
              }}
            >
              <span>🛡️</span>
              <span>Create Role & Assign Forms (Admin Only)</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: activeSubTab === 'roles' ? '#b45309' : '#fde68a',
                  color: activeSubTab === 'roles' ? '#ffffff' : '#78350f',
                }}
              >
                {roles.length}
              </span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              loadUsers();
              loadRoles();
            }}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>🔄</span>
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: STAFF USERS & ASSIGNMENTS                                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '16px' }}>
          {/* Left Form: Create User */}
          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title">Add New Staff / User</span>
            </div>
            <div className="panel-body">
              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Username * (Login handle)</label>
                  <input
                    type="text"
                    placeholder="e.g. kashif, asif"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Full Display Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Kashif Sales Lead"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Assigned Role & Forms *</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="form-input"
                    style={{ fontWeight: 600 }}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.displayName} {r.isSystem ? '(System)' : '(Custom Role)'}
                      </option>
                    ))}
                  </select>

                  {/* Live Form Access Preview */}
                  {selectedRoleObj && (
                    <div
                      style={{
                        marginTop: '6px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: '11px',
                        color: '#475569',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                        Allowed Forms for this Role:
                      </div>
                      {selectedRoleObj.permissions.includes('*') ? (
                        <span style={{ color: '#059669', fontWeight: 700 }}>
                          ⭐ All Forms & System Settings (Full Access)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {selectedRoleObj.permissions.map((p) => {
                            const f = AVAILABLE_FORMS.find((form) => form.key === p);
                            return (
                              <span
                                key={p}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: '#e0e7ff',
                                  color: '#3730a3',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                }}
                              >
                                {f ? `${f.icon} ${f.name}` : p}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="form-label">4-Digit Quick PIN (Terminal Login)</label>
                  <input
                    type="password"
                    placeholder="e.g. 1122"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="form-input"
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Used on cashier touchscreen / PIN pad
                  </span>
                </div>

                <div>
                  <label className="form-label">Account Password (Optional)</label>
                  <input
                    type="password"
                    placeholder="Optional backup password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                  />
                </div>

                {userMsg && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: userMsg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
                      color: userMsg.type === 'ok' ? '#047857' : '#b91c1c',
                      border: `1px solid ${userMsg.type === 'ok' ? '#a7f3d0' : '#fca5a5'}`,
                    }}
                  >
                    {userMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingUser}
                  style={{ marginTop: '8px', padding: '10px', fontWeight: 700 }}
                >
                  {submittingUser ? 'Creating User...' : '+ Create Staff Account'}
                </button>
              </form>
            </div>
          </div>

          {/* Right List: Staff Directory */}
          <div className="panel-card">
            <div
              className="panel-header"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="panel-title">Staff Directory &amp; Module Permissions</span>
                <span className="panel-badge ok">{users.length} registered</span>
              </div>
            </div>

            <div className="panel-body" style={{ padding: 0, maxHeight: '620px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  Loading staff users...
                </div>
              ) : users.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>No users found.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Name / Handle</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>Assigned Role</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Authorized Forms</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>Status</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const bStyle = getRoleBadgeStyle(u.role);
                      const isSelf = u.id === currentUserId;

                      return (
                        <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.6 }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{u.displayName}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>@{u.username}</div>
                          </td>

                          {/* Interactive Role Switcher Dropdown */}
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <select
                              value={u.role}
                              disabled={!u.isActive || (isSelf && u.role === 'admin')}
                              onChange={(e) => handleRoleChange(u, e.target.value)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: bStyle.bg,
                                color: bStyle.color,
                                border: `1px solid ${bStyle.border}`,
                                cursor: u.isActive ? 'pointer' : 'not-allowed',
                                outline: 'none',
                              }}
                              title={isSelf ? 'Your own admin account' : 'Change role'}
                            >
                              {roles.map((r) => (
                                <option key={r.id} value={r.name}>
                                  {r.displayName}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Authorized Forms Tags */}
                          <td style={{ padding: '10px 12px' }}>
                            {u.role === 'admin' ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: '#ecfdf5',
                                  color: '#047857',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  border: '1px solid #a7f3d0',
                                }}
                              >
                                ⭐ All Forms & Tabs (Unrestricted Admin)
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {(u.permissions || []).map((perm) => {
                                  const f = AVAILABLE_FORMS.find((form) => form.key === perm);
                                  return (
                                    <span
                                      key={perm}
                                      style={{
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: '#f1f5f9',
                                        color: '#334155',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        border: '1px solid #cbd5e1',
                                      }}
                                    >
                                      {f ? `${f.icon} ${f.name}` : perm}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <span
                              style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: u.isActive ? '#ecfdf5' : '#fef2f2',
                                color: u.isActive ? '#047857' : '#b91c1c',
                                border: `1px solid ${u.isActive ? '#a7f3d0' : '#fca5a5'}`,
                              }}
                            >
                              <span>{u.isActive ? '🟢' : '🔴'}</span>
                              <span>{u.isActive ? 'Active' : 'Soft-Deleted'}</span>
                            </span>
                          </td>

                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleOpenEditModal(u)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Edit user name, role or update credentials"
                              >
                                <span>✏️</span>
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleOpenResetModal(u)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Reset PIN or Password"
                              >
                                <span>🔑</span>
                                <span>PIN</span>
                              </button>
                              {u.isActive ? (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => handlePromptSoftDelete(u)}
                                  disabled={isSelf}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    color: isSelf ? '#94a3b8' : '#b91c1c',
                                    borderColor: isSelf ? '#e2e8f0' : '#fca5a5',
                                    background: isSelf ? '#f1f5f9' : '#fff5f5',
                                    cursor: isSelf ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                  title={isSelf ? 'Cannot soft-delete your own logged-in account' : 'Soft-delete user (preserves past transactions & ledger)'}
                                >
                                  <span>🗑️</span>
                                  <span>Soft Delete</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => handleRestoreUser(u)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    color: '#047857',
                                    borderColor: '#86efac',
                                    background: '#f0fdf4',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                  title="Restore and reactivate staff account"
                                >
                                  <span>♻️</span>
                                  <span>Restore</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: CREATE ROLE & ASSIGN FORMS (ADMIN ONLY)                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'roles' && isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '16px' }}>
          {/* Left Form: Create / Edit Role */}
          <div className="panel-card">
            <div
              className="panel-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: editingRoleId ? '#fffbeb' : undefined,
              }}
            >
              <span className="panel-title" style={{ color: editingRoleId ? '#b45309' : undefined }}>
                {editingRoleId ? '✏️ Edit Role Form Permissions' : '+ Create New Custom Role'}
              </span>
              {editingRoleId && (
                <button
                  type="button"
                  onClick={handleCancelEditRole}
                  className="btn-secondary"
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="panel-body">
              <form onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Role Display Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Sales & Purchasing Officer"
                    value={newRoleDisplayName}
                    onChange={(e) => {
                      setNewRoleDisplayName(e.target.value);
                      if (!editingRoleId) {
                        setNewRoleName(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
                      }
                    }}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Role Code / Identifier *</label>
                  <input
                    type="text"
                    placeholder="e.g. sales_purchaser"
                    value={newRoleName}
                    disabled={editingRoleId !== null}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="form-input"
                    style={{ background: editingRoleId ? '#f1f5f9' : undefined }}
                    required
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Unique code used in database records
                  </span>
                </div>

                {/* Form Checkboxes */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                    }}
                  >
                    <label className="form-label" style={{ margin: 0 }}>
                      Assign Forms / Tabs to this Role *
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleSelectAllPermissions}
                        className="btn-secondary"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllPermissions}
                        className="btn-secondary"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      padding: '8px',
                      background: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    {AVAILABLE_FORMS.map((form) => {
                      const isChecked = newRolePermissions.includes(form.key);
                      return (
                        <label
                          key={form.key}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: isChecked ? '#eff6ff' : '#ffffff',
                            border: `1px solid ${isChecked ? '#93c5fd' : '#e2e8f0'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePermission(form.key)}
                            style={{ marginTop: '2px' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b' }}>
                              <span>{form.icon} </span>
                              <span>{form.name}</span>
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>{form.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {roleMsg && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: roleMsg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
                      color: roleMsg.type === 'ok' ? '#047857' : '#b91c1c',
                      border: `1px solid ${roleMsg.type === 'ok' ? '#a7f3d0' : '#fca5a5'}`,
                    }}
                  >
                    {roleMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingRole}
                  style={{
                    marginTop: '8px',
                    padding: '10px',
                    fontWeight: 700,
                    background: editingRoleId ? '#d97706' : '#2563eb',
                  }}
                >
                  {submittingRole
                    ? 'Saving Role...'
                    : editingRoleId
                    ? '💾 Update Role Permissions'
                    : '+ Save Custom Role'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Table: All Roles and Permissions */}
          <div className="panel-card">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="panel-title">System & Custom Roles Directory</span>
                <span className="panel-badge ok">{roles.length} roles</span>
              </div>
            </div>

            <div className="panel-body" style={{ padding: 0, maxHeight: '620px', overflowY: 'auto' }}>
              {rolesLoading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading roles...</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Role / Code</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Assigned Forms</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((r) => {
                      const isSystem = r.isSystem;
                      const isFullAdmin = r.name === 'admin';

                      return (
                        <tr key={r.id}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.displayName}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                              {r.name}
                            </div>
                          </td>

                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: isSystem ? '#f1f5f9' : '#fef3c7',
                                color: isSystem ? '#475569' : '#92400e',
                                border: `1px solid ${isSystem ? '#cbd5e1' : '#fde68a'}`,
                              }}
                            >
                              {isSystem ? 'System' : 'Custom'}
                            </span>
                          </td>

                          <td style={{ padding: '10px 12px' }}>
                            {isFullAdmin ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  background: '#ecfdf5',
                                  color: '#047857',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  border: '1px solid #a7f3d0',
                                }}
                              >
                                ⭐ All Forms & System Settings (Full Access)
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {r.permissions.map((perm) => {
                                  const f = AVAILABLE_FORMS.find((form) => form.key === perm);
                                  return (
                                    <span
                                      key={perm}
                                      style={{
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: '#eff6ff',
                                        color: '#1e40af',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        border: '1px solid #bfdbfe',
                                      }}
                                    >
                                      {f ? `${f.icon} ${f.name}` : perm}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            {isFullAdmin ? (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Protected</span>
                            ) : (
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => handleEditRole(r)}
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                  title="Edit forms assigned to this role"
                                >
                                  ✏️ Edit Forms
                                </button>
                                {!isSystem && (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => handleDeleteRole(r)}
                                    style={{ padding: '3px 8px', fontSize: '11px', color: '#b91c1c' }}
                                    title="Delete custom role"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL: ADMIN RESET USER PASSWORD / PIN                                    */}
      {/* ========================================================================= */}
      {resetModalUser && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🔑</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Reset Staff Credentials</h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    User: <strong>{resetModalUser.displayName}</strong> (@{resetModalUser.username})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseResetModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: '#f8fafc',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  lineHeight: 1.4,
                }}
              >
                Enter a new 4 to 8-digit Quick PIN for POS terminal login, or a new account password. You can set either or both.
              </div>

              <div>
                <label className="form-label">New Quick PIN (4 to 8 digits)</label>
                <input
                  type="password"
                  placeholder="e.g. 2233 (leave blank to keep current PIN)"
                  maxLength={8}
                  value={newResetPin}
                  onChange={(e) => setNewResetPin(e.target.value)}
                  className="form-input"
                  autoFocus
                />
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Used on cashier POS touchscreens / PIN pad
                </span>
              </div>

              <div>
                <label className="form-label">New Account Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="form-input"
                />
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Minimum 4 characters
                </span>
              </div>

              {resetMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: resetMsg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
                    color: resetMsg.type === 'ok' ? '#047857' : '#b91c1c',
                    border: `1px solid ${resetMsg.type === 'ok' ? '#a7f3d0' : '#fca5a5'}`,
                  }}
                >
                  {resetMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleCloseResetModal}
                  className="btn-secondary"
                  disabled={resetSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={resetSubmitting}
                  style={{ fontWeight: 700 }}
                >
                  {resetSubmitting ? 'Saving...' : '💾 Save New Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT STAFF USER DETAILS & CREDENTIALS                              */}
      {/* ========================================================================= */}
      {editModalUser && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>✏️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Edit Staff Account</h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Username: <strong>@{editModalUser.username}</strong> (Fixed Unique Identifier)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Display / Full Name *</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="form-input"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label">Assigned Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="form-input"
                  disabled={editModalUser.id === currentUserId && editModalUser.role === 'admin'}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.displayName} {r.isSystem ? '(System)' : '(Custom)'}
                    </option>
                  ))}
                </select>
                {editModalUser.id === currentUserId && editModalUser.role === 'admin' && (
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Cannot change your own active admin role while logged in
                  </span>
                )}
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  🔑 Optional: Change Credentials
                </span>

                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>
                    New Quick PIN (4 to 8 digits)
                  </label>
                  <input
                    type="password"
                    placeholder="Leave blank to keep existing PIN"
                    maxLength={8}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>
                    New Account Password
                  </label>
                  <input
                    type="password"
                    placeholder="Leave blank to keep existing password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {editMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: editMsg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
                    color: editMsg.type === 'ok' ? '#047857' : '#b91c1c',
                    border: `1px solid ${editMsg.type === 'ok' ? '#a7f3d0' : '#fca5a5'}`,
                  }}
                >
                  {editMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="btn-secondary"
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={editSubmitting}
                  style={{ fontWeight: 700 }}
                >
                  {editSubmitting ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM SOFT DELETE USER (FINANCIAL LEDGER PRESERVATION)           */}
      {/* ========================================================================= */}
      {softDeleteModalUser && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '460px' }}>
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>🗑️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#b91c1c' }}>Soft Delete Staff Account</h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    User: <strong>{softDeleteModalUser.displayName}</strong> (@{softDeleteModalUser.username})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSoftDeleteModalUser(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: '#fef2f2',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid #fecaca',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  color: '#991b1b',
                }}
              >
                <strong>🛡️ Accounting & Audit Ledger Invariant:</strong>
                <p style={{ margin: '6px 0 0 0' }}>
                  In accordance with financial compliance rules, staff accounts are <strong>soft-deleted</strong> (deactivated) and never erased from the database.
                </p>
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li>All past shift records, cash register drawer balances, sales receipts, and khata audits remain completely intact.</li>
                  <li>This user will immediately be barred from logging in to POS and back-office forms.</li>
                  <li>You can restore this account at any time with one click.</li>
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setSoftDeleteModalUser(null)}
                  className="btn-secondary"
                  disabled={softDeleteSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSoftDelete}
                  className="btn-primary"
                  disabled={softDeleteSubmitting}
                  style={{ background: '#b91c1c', borderColor: '#991b1b', fontWeight: 700 }}
                >
                  {softDeleteSubmitting ? 'Soft-Deleting...' : '🗑️ Confirm Soft Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
