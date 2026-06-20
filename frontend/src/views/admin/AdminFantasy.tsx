import React, { useState, useEffect } from 'react';
import { adminRequest, adminAPI } from '../../api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { RefreshCw, Play, CheckCircle, Trophy, Settings } from 'lucide-react';
import './AdminFantasy.css';

export const AdminFantasy: React.FC = () => {
  const [matches, setMatches] = useState<any[]>([]);
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matches' | 'contests' | 'settings'>('matches');

  // Contest Form
  const [showContestForm, setShowContestForm] = useState(false);
  const [newContest, setNewContest] = useState({
    match_id: '',
    name: 'Mega Contest',
    entry_fee: '50',
    prize_pool: '10000',
    total_spots: '250',
    is_guaranteed: true,
    admin_commission_pct: '10'
  });

  // Settings
  const [sportsApiKey, setSportsApiKey] = useState('');

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const s = await adminAPI.getSettings();
      if (s.sports_api_key) setSportsApiKey(s.sports_api_key);
    } catch (err) {}
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'matches') {
        const data = await adminRequest('GET', '/admin/fantasy/matches');
        setMatches(data);
      } else if (activeTab === 'contests') {
        const data = await adminRequest('GET', '/admin/fantasy/contests');
        setContests(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    try {
      if (action === 'sync_matches') await adminRequest('POST', '/admin/fantasy/sync-matches');
      else if (action === 'sync_squads') await adminRequest('POST', '/admin/fantasy/sync-squads');
      else if (action === 'process_live') await adminRequest('POST', '/admin/fantasy/process-live');
      alert(`Action ${action} completed successfully`);
      fetchData();
    } catch (err: any) {
      alert('Action failed: ' + err.message);
    }
  };

  const createContest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminRequest('POST', '/admin/fantasy/contests', newContest);
      alert('Contest created successfully');
      setShowContestForm(false);
      fetchData();
    } catch (err: any) {
      alert('Failed to create contest: ' + err.message);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.updateSettings({ sports_api_key: sportsApiKey });
      alert('Settings saved successfully!');
    } catch (err: any) {
      alert('Failed to save settings: ' + err.message);
    }
  };

  if (loading && matches.length === 0 && contests.length === 0) {
    return <LoadingSpinner message="Loading Fantasy Admin..." />;
  }

  return (
    <div className="admin-fantasy-container fade-in">
      <div className="admin-fantasy-header">
        <h1><Trophy size={32} color="var(--accent-primary)" /> Fantasy Cricket Management</h1>
        <p>Manage real-world matches, synchronize squads, and launch custom fantasy contests</p>
      </div>

      <div className="admin-fantasy-tabs">
        <button className={`admin-fantasy-tab ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => setActiveTab('matches')}>Matches</button>
        <button className={`admin-fantasy-tab ${activeTab === 'contests' ? 'active' : ''}`} onClick={() => setActiveTab('contests')}>Contests</button>
        <button className={`admin-fantasy-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
      </div>

      {activeTab === 'matches' && (
        <div>
          <div className="admin-fantasy-actions">
            <button className="af-btn af-btn-primary" onClick={() => handleAction('sync_matches')}><RefreshCw size={18}/> Sync API Matches</button>
            <button className="af-btn af-btn-secondary" onClick={() => handleAction('sync_squads')}><RefreshCw size={18}/> Sync Squads</button>
            <button className="af-btn af-btn-danger" onClick={() => handleAction('process_live')}><Play size={18}/> Force Process Live Match</button>
          </div>

          <div className="admin-fantasy-table-wrapper">
            <table className="admin-fantasy-table">
              <thead>
                <tr>
                  <th>API ID</th>
                  <th>Title</th>
                  <th>Format</th>
                  <th>Start Time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
            <tbody>
              {matches.map(m => (
                <tr key={m.id}>
                  <td>{m.api_match_id}</td>
                  <td>{m.title}</td>
                  <td>{m.format}</td>
                  <td>{new Date(m.start_time).toLocaleString()}</td>
                  <td>
                    <span className={`af-status-badge af-status-${m.status}`}>{m.status.toUpperCase()}</span>
                  </td>
                  <td>
                    <button className="af-btn af-btn-secondary" style={{padding: '6px 12px', fontSize: '0.8rem'}}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {activeTab === 'contests' && (
        <div>
          <div className="admin-fantasy-actions">
            <button className="af-btn af-btn-primary" onClick={() => setShowContestForm(!showContestForm)}>+ Create New Contest</button>
          </div>

          {showContestForm && (
            <div className="af-form-container">
              <h3 style={{marginBottom: '20px', color: 'white'}}>Create Contest</h3>
              <form onSubmit={createContest}>
                <div className="af-form-grid">
                  <div className="af-form-group">
                    <label>Select Match</label>
                    <select value={newContest.match_id} onChange={e => setNewContest({...newContest, match_id: e.target.value})} required style={{background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', color: 'white', padding: '12px', borderRadius: '8px', fontSize: '1rem'}}>
                      <option value="" disabled>-- Select a Match --</option>
                      {matches.map(m => (
                        <option key={m.id} value={m.id}>{m.title} ({new Date(m.start_time).toLocaleDateString()})</option>
                      ))}
                    </select>
                  </div>
                  <div className="af-form-group">
                    <label>Contest Name</label>
                    <input type="text" value={newContest.name} onChange={e => setNewContest({...newContest, name: e.target.value})} required />
                  </div>
                  <div className="af-form-group">
                    <label>Entry Fee (₹)</label>
                    <input type="number" value={newContest.entry_fee} onChange={e => setNewContest({...newContest, entry_fee: e.target.value})} required />
                  </div>
                  <div className="af-form-group">
                    <label>Prize Pool (₹)</label>
                    <input type="number" value={newContest.prize_pool} onChange={e => setNewContest({...newContest, prize_pool: e.target.value})} required />
                  </div>
                  <div className="af-form-group">
                    <label>Total Spots Available</label>
                    <input type="number" value={newContest.total_spots} onChange={e => setNewContest({...newContest, total_spots: e.target.value})} required />
                  </div>
                  <div className="af-form-group">
                    <label>Admin Commission (%)</label>
                    <input type="number" value={newContest.admin_commission_pct} onChange={e => setNewContest({...newContest, admin_commission_pct: e.target.value})} required />
                  </div>
                </div>
                <button type="submit" className="af-btn af-btn-primary">Save Contest to Database</button>
              </form>
            </div>
          )}

          <div className="admin-fantasy-table-wrapper">
            <table className="admin-fantasy-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Match Title</th>
                  <th>Contest Name</th>
                  <th>Entry Fee</th>
                  <th>Prize Pool</th>
                  <th>Spots Filled</th>
                  <th>Status</th>
                </tr>
              </thead>
            <tbody>
              {contests.map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.match_title}</td>
                  <td>{c.name}</td>
                  <td>₹{c.entry_fee}</td>
                  <td>₹{c.prize_pool}</td>
                  <td>{c.filled_spots}/{c.total_spots}</td>
                  <td><span className={`af-status-badge af-status-${c.status}`}>{c.status.toUpperCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <div className="af-form-container">
            <h3 style={{marginBottom: '20px', color: 'white', fontSize: '1.2rem'}}>Dynamic API Settings</h3>
            <form onSubmit={saveSettings} className="af-form-grid" style={{alignItems: 'end', marginBottom: 0}}>
              <div className="af-form-group" style={{gridColumn: '1 / -1'}}>
                <label>Sports API Key (e.g. CricAPI, SportMonks)</label>
                <input type="text" value={sportsApiKey} onChange={e => setSportsApiKey(e.target.value)} placeholder="Enter your API Key here..." />
              </div>
              <button type="submit" className="af-btn af-btn-primary" style={{gridColumn: '1 / -1', maxWidth: '200px'}}>Save Settings</button>
            </form>
          </div>

          <div className="af-form-container" style={{display: 'flex', alignItems: 'flex-start', gap: '20px'}}>
            <Settings size={48} color="var(--accent-primary)" style={{opacity: 0.5}} />
            <div>
              <h3 style={{marginBottom: '10px', color: 'white', fontSize: '1.2rem'}}>Points System Engine</h3>
              <p style={{color: 'var(--text-secondary)', lineHeight: '1.6'}}>
                The Fantasy Cricket engine currently uses the default T20 Format points structure for calculating player scores during live matches (e.g., Runs: +1, Wickets: +25, Catches: +8).<br/><br/>
                To customize the scoring modifiers globally across all matches, you can edit the <code>fantasy_point_system</code> table directly in the database.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
