import React, { useState, useEffect } from 'react';
import { authAPI, uploadFile } from '../api';
import { User, Mail, MapPin, Phone, Building, Save, Camera, CheckCircle2 } from 'lucide-react';

interface ProfileProps {
  user: any;
  refreshUser: () => Promise<void>;
  onNavigate?: (view: string) => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, refreshUser, onNavigate }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: '',
    address: '',
    city: '',
    state: '',
    pin_code: '',
    profile_photo: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone_number: user.phone_number || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        pin_code: user.pin_code || '',
        profile_photo: user.profile_photo || ''
      });
      if (user.profile_photo) {
        setPreviewPhoto(`/api${user.profile_photo}`);
      }
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const url = await uploadFile(file, 'admin');
        setFormData({ ...formData, profile_photo: url });
        setPreviewPhoto(`/api${url}`);
      } catch (err) {
        setErrorMsg('Failed to upload profile photo');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await authAPI.updateProfile(formData);
      await refreshUser();
      setSuccessMsg('Profile updated successfully! Redirecting...');
      setTimeout(() => {
        setSuccessMsg('');
        if (onNavigate) {
          onNavigate('dashboard');
        }
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '800px' }}>
      
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>My Profile</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Manage your personal information and contact details.
        </p>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(0, 245, 160, 0.1)', border: '1px solid var(--accent-secondary)', padding: '16px', borderRadius: 'var(--radius-sm)', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={20} />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--accent-danger)', padding: '12px 16px', borderRadius: '4px', color: 'var(--accent-danger)' }}>
          {errorMsg}
        </div>
      )}

      <div className="glass-card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Profile Photo Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border-glass)' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-tertiary)', border: '2px solid var(--accent-primary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {previewPhoto ? (
                  <img src={previewPhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={40} color="var(--text-muted)" />
                )}
              </div>
              <label style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--accent-secondary)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--bg-primary)' }}>
                <Camera size={16} color="#000" />
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
              </label>
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Profile Photo</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Upload a professional square image.</p>
            </div>
          </div>

          {/* Personal Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" className="input-field" style={{ paddingLeft: '44px' }} name="name" value={formData.name} onChange={handleInputChange} required />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Email Address (Read Only)</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="email" className="input-field" style={{ paddingLeft: '44px', opacity: 0.7 }} name="email" value={formData.email} disabled />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Phone Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" className="input-field" style={{ paddingLeft: '44px' }} name="phone_number" value={formData.phone_number} onChange={handleInputChange} placeholder="+91 9876543210" />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Street Address</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" className="input-field" style={{ paddingLeft: '44px' }} name="address" value={formData.address} onChange={handleInputChange} placeholder="123 Main St, Apt 4B" />
              </div>
            </div>

            <div>
              <label className="input-label">City</label>
              <div style={{ position: 'relative' }}>
                <Building size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" className="input-field" style={{ paddingLeft: '44px' }} name="city" value={formData.city} onChange={handleInputChange} placeholder="Mumbai" />
              </div>
            </div>

            <div>
              <label className="input-label">State / Province</label>
              <input type="text" className="input-field" name="state" value={formData.state} onChange={handleInputChange} placeholder="Maharashtra" />
            </div>

            <div>
              <label className="input-label">Postal / Pin Code</label>
              <input type="text" className="input-field" name="pin_code" value={formData.pin_code} onChange={handleInputChange} placeholder="400001" />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '24px', marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              <Save size={18} />
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
