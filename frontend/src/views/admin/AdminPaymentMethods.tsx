import React, { useEffect, useState } from 'react';
import { adminAPI, uploadFile } from '../../api';
import { Plus, Power, PowerOff, CreditCard, Settings, X, Trash2, Upload } from 'lucide-react';

interface FieldDef {
  label: string;
  type: 'text' | 'number' | 'file';
  value?: string;
  required?: boolean;
}

interface ChargeDef {
  name: string;
  type: 'fixed' | 'percent';
  value: number;
}

export const AdminPaymentMethods: React.FC = () => {
  const [methods, setMethods] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Method State
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodType, setNewMethodType] = useState('deposit');
  const [newMinAmount, setNewMinAmount] = useState('0');
  const [newMaxAmount, setNewMaxAmount] = useState('10000000');

  // Configuration Modal State
  const [configuringMethod, setConfiguringMethod] = useState<any | null>(null);
  const [adminInstructions, setAdminInstructions] = useState<FieldDef[]>([]);
  const [userForm, setUserForm] = useState<FieldDef[]>([]);
  const [withdrawalCharges, setWithdrawalCharges] = useState<ChargeDef[]>([]);
  const [minAmount, setMinAmount] = useState('0');
  const [maxAmount, setMaxAmount] = useState('10000000');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const fetchData = async () => {
    try {
      const methodsData = await adminAPI.getMethods();
      setMethods(methodsData);
    } catch (err) {
      console.error('Failed to fetch methods:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethodName) return;
    try {
      await adminAPI.createMethod({
        name: newMethodName,
        type: newMethodType,
        is_active: true,
        admin_instructions: [],
        user_form: [],
        withdrawal_charges: [],
        min_amount: parseFloat(newMinAmount) || 0,
        max_amount: parseFloat(newMaxAmount) || 0
      });
      setNewMethodName('');
      setNewMinAmount('0');
      setNewMaxAmount('10000000');
      fetchData();
    } catch (err) {
      alert('Failed to create method');
    }
  };

  const handleToggleMethod = async (id: number, currentStatus: boolean) => {
    try {
      await adminAPI.updateMethod(id, { is_active: !currentStatus });
      fetchData();
    } catch (err) {
      alert('Failed to update method');
    }
  };

  const handleDeleteMethod = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this payment method? This cannot be undone.")) return;
    try {
      await adminAPI.deleteMethod(id);
      fetchData();
    } catch (err) {
      alert('Failed to delete method');
    }
  };

  const openConfigModal = (method: any) => {
    setConfiguringMethod(method);
    setAdminInstructions(method.admin_instructions ? (typeof method.admin_instructions === 'string' ? JSON.parse(method.admin_instructions) : method.admin_instructions) : []);
    setUserForm(method.user_form ? (typeof method.user_form === 'string' ? JSON.parse(method.user_form) : method.user_form) : []);
    setWithdrawalCharges(method.withdrawal_charges ? (typeof method.withdrawal_charges === 'string' ? JSON.parse(method.withdrawal_charges) : method.withdrawal_charges) : []);
    setMinAmount(typeof method.min_amount !== 'undefined' ? String(method.min_amount) : '0');
    setMaxAmount(typeof method.max_amount !== 'undefined' ? String(method.max_amount) : '10000000');
  };

  const handleSaveConfig = async () => {
    if (!configuringMethod) return;
    setIsSavingConfig(true);
    try {
      await adminAPI.updateMethod(configuringMethod.id, {
        admin_instructions: adminInstructions,
        user_form: userForm,
        withdrawal_charges: withdrawalCharges,
        min_amount: parseFloat(minAmount) || 0,
        max_amount: parseFloat(maxAmount) || 0
      });
      setConfiguringMethod(null);
      fetchData();
    } catch (err) {
      alert('Failed to save configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleAdminFileUpload = async (index: number, file: File) => {
    try {
      const url = await uploadFile(file, 'admin');
      const newInst = [...adminInstructions];
      newInst[index].value = url;
      setAdminInstructions(newInst);
    } catch (err) {
      alert('File upload failed');
    }
  };

  if (isLoading) return <div style={{ padding: '32px' }}>Loading payment methods...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Payment Channels</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Manage gateways, custom fields, and methods for deposits and withdrawals.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <form onSubmit={handleCreateMethod} className="glass-card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1.5, minWidth: '200px' }}>
            <label className="input-label">Channel Name</label>
            <input className="input-field" value={newMethodName} onChange={e => setNewMethodName(e.target.value)} placeholder="e.g. PayPal" required />
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label className="input-label">Type</label>
            <select className="input-field" value={newMethodType} onChange={e => setNewMethodType(e.target.value)}>
              <option value="deposit">Deposit</option>
              <option value="withdraw">Withdrawal</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label className="input-label">Min Amount (₹)</label>
            <input type="number" className="input-field" value={newMinAmount} onChange={e => setNewMinAmount(e.target.value)} required min="0" step="any" />
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label className="input-label">Max Amount (₹)</label>
            <input type="number" className="input-field" value={newMaxAmount} onChange={e => setNewMaxAmount(e.target.value)} required min="0" step="any" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '14px 20px' }}>
            <Plus size={18} /> Add Channel
          </button>
        </form>

        <div className="table-container">
          <table className="custom-table">
            <thead><tr><th>Name</th><th>Type</th><th>Limits (₹)</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {methods.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CreditCard size={16} color="var(--accent-primary)" />
                      {m.name}
                    </div>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{m.type}</td>
                  <td>
                    ₹{parseFloat(m.min_amount || '0').toLocaleString()} - ₹{parseFloat(m.max_amount || '0').toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge ${m.is_active ? 'badge-active' : 'badge-danger'}`}>
                      {m.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => openConfigModal(m)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        <Settings size={14}/> Configure Fields
                      </button>
                      <button onClick={() => handleToggleMethod(m.id, !!m.is_active)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        {m.is_active ? <><PowerOff size={14}/> Disable</> : <><Power size={14}/> Enable</>}
                      </button>
                      <button onClick={() => handleDeleteMethod(m.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--accent-danger)' }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {methods.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center' }}>No methods configured.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuration Modal */}
      {configuringMethod && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '30px', position: 'relative' }}>
            <button 
              onClick={() => setConfiguringMethod(null)} 
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '4px', fontWeight: 700 }}>
              Configure: {configuringMethod.name}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Define instructions to show the user, and fields the user must fill.
            </p>

            {/* Limit Settings */}
            <div style={{ display: 'flex', gap: '16px', background: 'var(--bg-tertiary)', padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label className="input-label">Minimum Transaction Amount (₹)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={minAmount} 
                  onChange={e => setMinAmount(e.target.value)} 
                  required 
                  min="0" 
                  step="any"
                />
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label className="input-label">Maximum Transaction Amount (₹)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={maxAmount} 
                  onChange={e => setMaxAmount(e.target.value)} 
                  required 
                  min="0" 
                  step="any"
                />
              </div>
            </div>

            <div className="responsive-two-col" style={{ alignItems: 'flex-start' }}>
              {/* Admin Instructions Builder */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-tertiary)', padding: '20px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Instruction Fields (Shown to User)</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                  Add bank details, UPI handles, or upload QR codes here.
                </p>

                {adminInstructions.map((field, index) => (
                  <div key={index} style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input 
                        className="input-field" 
                        placeholder="Label (e.g. Account No)" 
                        value={field.label}
                        onChange={e => {
                          const n = [...adminInstructions];
                          n[index].label = e.target.value;
                          setAdminInstructions(n);
                        }}
                      />
                      <select 
                        className="input-field" 
                        style={{ width: '100px' }}
                        value={field.type}
                        onChange={e => {
                          const n = [...adminInstructions];
                          n[index].type = e.target.value as any;
                          n[index].value = '';
                          setAdminInstructions(n);
                        }}
                      >
                        <option value="text">Text</option>
                        <option value="file">File/Image</option>
                      </select>
                      <button 
                        onClick={() => setAdminInstructions(adminInstructions.filter((_, i) => i !== index))}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    {field.type === 'text' ? (
                      <input 
                        className="input-field" 
                        placeholder="Value (e.g. 123456789)" 
                        value={field.value || ''}
                        onChange={e => {
                          const n = [...adminInstructions];
                          n[index].value = e.target.value;
                          setAdminInstructions(n);
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                          type="file" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) handleAdminFileUpload(index, e.target.files[0]);
                          }} 
                          style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                        />
                        {field.value && <a href={`/api${field.value}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', fontSize: '0.8rem' }}>View Uploaded</a>}
                      </div>
                    )}
                  </div>
                ))}
                
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setAdminInstructions([...adminInstructions, { label: '', type: 'text', value: '' }])}
                >
                  <Plus size={16} /> Add Instruction Field
                </button>
              </div>

              {/* User Form Builder */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-tertiary)', padding: '20px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>User Input Form</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                  Define what information the user must provide (e.g., Transaction ID, Payment Screenshot).
                </p>

                {userForm.map((field, index) => (
                  <div key={index} style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input 
                        className="input-field" 
                        placeholder="Label (e.g. TXN ID)" 
                        value={field.label}
                        onChange={e => {
                          const n = [...userForm];
                          n[index].label = e.target.value;
                          setUserForm(n);
                        }}
                      />
                      <select 
                        className="input-field" 
                        style={{ width: '100px' }}
                        value={field.type}
                        onChange={e => {
                          const n = [...userForm];
                          n[index].type = e.target.value as any;
                          setUserForm(n);
                        }}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="file">File Upload</option>
                      </select>
                      <button 
                        onClick={() => setUserForm(userForm.filter((_, i) => i !== index))}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={field.required}
                        onChange={e => {
                          const n = [...userForm];
                          n[index].required = e.target.checked;
                          setUserForm(n);
                        }}
                      />
                      Required Field
                    </label>
                  </div>
                ))}
                
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setUserForm([...userForm, { label: '', type: 'text', required: true }])}
                >
                  <Plus size={16} /> Add User Field
                </button>
              </div>

              {/* Withdrawal Charges Form Builder (Only for Withdraw type) */}
              {configuringMethod.type === 'withdraw' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-tertiary)', padding: '20px', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Withdrawal Charges</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                    Define dynamic charges that apply to withdrawals via this method.
                  </p>

                  {withdrawalCharges.map((charge, index) => (
                    <div key={index} style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input 
                          className="input-field" 
                          placeholder="Charge Name (e.g. TDS)" 
                          value={charge.name}
                          onChange={e => {
                            const n = [...withdrawalCharges];
                            n[index].name = e.target.value;
                            setWithdrawalCharges(n);
                          }}
                        />
                        <select 
                          className="input-field" 
                          style={{ width: '120px' }}
                          value={charge.type}
                          onChange={e => {
                            const n = [...withdrawalCharges];
                            n[index].type = e.target.value as any;
                            setWithdrawalCharges(n);
                          }}
                        >
                          <option value="fixed">Fixed (₹)</option>
                          <option value="percent">Percentage (%)</option>
                        </select>
                        <button 
                          onClick={() => setWithdrawalCharges(withdrawalCharges.filter((_, i) => i !== index))}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <input 
                        type="number"
                        className="input-field" 
                        placeholder="Value (e.g. 10)" 
                        value={charge.value || ''}
                        onChange={e => {
                          const n = [...withdrawalCharges];
                          n[index].value = parseFloat(e.target.value) || 0;
                          setWithdrawalCharges(n);
                        }}
                      />
                    </div>
                  ))}
                  
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setWithdrawalCharges([...withdrawalCharges, { name: '', type: 'fixed', value: 0 }])}
                  >
                    <Plus size={16} /> Add Charge
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setConfiguringMethod(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveConfig} disabled={isSavingConfig}>
                {isSavingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
