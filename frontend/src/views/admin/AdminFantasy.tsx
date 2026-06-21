import React, { useState, useEffect } from 'react';
import { adminRequest, adminAPI } from '../../api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { RefreshCw, Play, Trophy, Settings, Edit3, Trash2, Eye, X, Plus, Save, AlertTriangle } from 'lucide-react';
import './AdminFantasy.css';

const defaultContestForm = {
  match_id: '',
  name: 'Mega Contest',
  entry_fee: '50',
  prize_pool: '10000',
  total_spots: '250',
  is_guaranteed: true,
  admin_commission_pct: '10',
  max_entries_per_user: '1'
};

const defaultMatchForm = {
  title: '',
  short_title: '',
  format: 'T20',
  team_a: '',
  team_b: '',
  team_a_logo: '',
  team_b_logo: '',
  start_time: '',
  status: 'upcoming'
};

export const AdminFantasy: React.FC = () => {
  const [matches, setMatches] = useState<any[]>([]);
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matches' | 'contests' | 'settings' | 'points'>('matches');

  // Settings
  const [sportsApiKey, setSportsApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Match modal
  const [matchModal, setMatchModal] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [matchForm, setMatchForm] = useState(defaultMatchForm);

  // Contest modal
  const [showContestForm, setShowContestForm] = useState(false);
  const [contestForm, setContestForm] = useState(defaultContestForm);
  const [editingContestId, setEditingContestId] = useState<number | null>(null);

  // Contest entries viewer
  const [entriesModal, setEntriesModal] = useState<{ open: boolean; contest: any; entries: any[] }>({ open: false, contest: null, entries: [] });

  // Points system
  const [pointRules, setPointRules] = useState<any[]>([]);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [editingPoint, setEditingPoint] = useState<any>(null);

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
        const [data, pointsData] = await Promise.all([
          adminRequest('GET', '/admin/fantasy/contests'),
          activeTab === 'contests' ? null : adminRequest('GET', '/admin/fantasy/point-system').catch(() => null)
        ]);
        setContests(data);
      } else if (activeTab === 'points') {
        const data = await adminRequest('GET', '/admin/fantasy/point-system');
        setPointRules(data);
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
      alert(`Action completed successfully`);
      fetchData();
    } catch (err: any) {
      alert('Action failed: ' + (err.message || err));
    }
  };

  // === MATCH CRUD ===
  const openCreateMatch = () => {
    setMatchForm({ ...defaultMatchForm, start_time: new Date(Date.now() + 86400000).toISOString().slice(0, 16) });
    setMatchModal({ open: true });
  };

  const openEditMatch = (m: any) => {
    setMatchForm({
      title: m.title || '',
      short_title: m.short_title || '',
      format: m.format || 'T20',
      team_a: m.team_a || '',
      team_b: m.team_b || '',
      team_a_logo: m.team_a_logo || '',
      team_b_logo: m.team_b_logo || '',
      start_time: m.start_time ? new Date(m.start_time).toISOString().slice(0, 16) : '',
      status: m.status || 'upcoming'
    });
    setMatchModal({ open: true, edit: m });
  };

  const saveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (matchModal.edit) {
        await adminRequest('PUT', `/admin/fantasy/matches/${matchModal.edit.id}`, { ...matchForm, start_time: new Date(matchForm.start_time).toISOString().replace('T', ' ').slice(0, 19) });
        alert('Match updated!');
      } else {
        await adminRequest('POST', '/admin/fantasy/matches', { ...matchForm, start_time: new Date(matchForm.start_time).toISOString().replace('T', ' ').slice(0, 19) });
        alert('Match created!');
      }
      setMatchModal({ open: false });
      fetchData();
    } catch (err: any) {
      alert('Error: ' + (err.message || err));
    }
  };

  const deleteMatch = async (id: number, title: string) => {
    if (!window.confirm(`Delete match "${title}" and all its contests/teams/entries? This cannot be undone.`)) return;
    try {
      await adminRequest('DELETE', `/admin/fantasy/matches/${id}`);
      alert('Match deleted.');
      fetchData();
    } catch (err: any) {
      alert('Error: ' + (err.message || err));
    }
  };

  // === CONTEST CRUD ===
  const openCreateContest = () => {
    setContestForm({ ...defaultContestForm, match_id: matches[0]?.id || '' });
    setEditingContestId(null);
    setShowContestForm(true);
  };

  const openEditContest = (c: any) => {
    setContestForm({
      match_id: String(c.match_id),
      name: c.name,
      entry_fee: String(c.entry_fee),
      prize_pool: String(c.prize_pool),
      total_spots: String(c.total_spots),
      is_guaranteed: c.is_guaranteed === 1 || c.is_guaranteed === true,
      admin_commission_pct: String(c.admin_commission_pct || 0),
      max_entries_per_user: String(c.max_entries_per_user || 1)
    });
    setEditingContestId(c.id);
    setShowContestForm(true);
  };

  const saveContest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingContestId) {
        await adminRequest('PUT', `/admin/fantasy/contests/${editingContestId}`, contestForm);
        alert('Contest updated!');
      } else {
        await adminRequest('POST', '/admin/fantasy/contests', contestForm);
        alert('Contest created!');
      }
      setShowContestForm(false);
      setContestForm(defaultContestForm);
      fetchData();
    } catch (err: any) {
      alert('Error: ' + (err.message || err));
    }
  };

  const deleteContest = async (id: number, name: string) => {
    if (!window.confirm(`Delete contest "${name}" and refund all entries?`)) return;
    try {
      await adminRequest('DELETE', `/admin/fantasy/contests/${id}`);
      alert('Contest deleted with refunds.');
      fetchData();
    } catch (err: any) {
      alert('Error: ' + (err.message || err));
    }
  };

  const cancelContest = async (id: number) => {
    if (!window.confirm('Cancel this contest and refund all participants?')) return;
    try {
      await adminRequest('POST', `/admin/fantasy/contests/${id}/cancel`);
      alert('Contest cancelled with refunds.');
      fetchData();
    } catch (err: any) {
      alert('Error: ' + (err.message || err));
    }
  };

  const viewContestEntries = async (contest: any) => {
    try {
      const entries = await adminRequest('GET', `/admin/fantasy/contests/${contest.id}/entries`);
      setEntriesModal({ open: true, contest, entries });
    } catch (err: any) {
      alert('Error loading entries: ' + (err.message || err));
    }
  };

  // === POINTS SYSTEM ===
  const openEditPoint = (p: any) => {
    setEditingPoint({ ...p });
    setShowPointsModal(true);
  };

  const savePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPoint) return;
    try {
      await adminRequest('PUT', `/admin/fantasy/point-system/${editingPoint.id}`, editingPoint);
      alert('Point rule updated!');
      setShowPointsModal(false);
      setEditingPoint(null);
      fetchData();
    } catch (err: any) {
      alert('Error: ' + (err.message || err));
    }
  };

  // === SETTINGS ===
  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.updateSettings({ sports_api_key: sportsApiKey });
      alert('Settings saved successfully!');
    } catch (err: any) {
      alert('Failed to save settings: ' + (err.message || err));
    }
  };

  if (loading && matches.length === 0 && contests.length === 0 && pointRules.length === 0) {
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
        <button className={`admin-fantasy-tab ${activeTab === 'points' ? 'active' : ''}`} onClick={() => setActiveTab('points')}>Scoring</button>
        <button className={`admin-fantasy-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
      </div>

      {/* === MATCHES TAB === */}
      {activeTab === 'matches' && (
        <div>
          <div className="admin-fantasy-actions">
            <button className="af-btn af-btn-primary" onClick={openCreateMatch}><Plus size={18}/> Create Match</button>
            <button className="af-btn af-btn-secondary" onClick={() => handleAction('sync_matches')}><RefreshCw size={18}/> Sync API Matches</button>
            <button className="af-btn af-btn-secondary" onClick={() => handleAction('sync_squads')}><RefreshCw size={18}/> Sync Squads</button>
            <button className="af-btn af-btn-danger" onClick={() => handleAction('process_live')}><Play size={18}/> Force Process Live</button>
          </div>

          <div className="admin-fantasy-table-wrapper">
            <table className="admin-fantasy-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Teams</th>
                  <th>Format</th>
                  <th>Start Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
            <tbody>
              {matches.map(m => (
                <tr key={m.id}>
                  <td>{m.id}</td>
                  <td>{m.short_title || m.title}</td>
                  <td style={{fontSize: '0.85rem'}}>{m.team_a} vs {m.team_b}</td>
                  <td>{m.format}</td>
                  <td>{new Date(m.start_time).toLocaleString()}</td>
                  <td>
                    <span className={`af-status-badge af-status-${m.status}`}>{m.status.toUpperCase()}</span>
                  </td>
                  <td>
                    <div style={{display: 'flex', gap: '6px'}}>
                      <button className="af-btn af-btn-secondary" style={{padding: '4px 8px'}} onClick={() => openEditMatch(m)} title="Edit">
                        <Edit3 size={14}/>
                      </button>
                      <button className="af-btn af-btn-danger" style={{padding: '4px 8px'}} onClick={() => deleteMatch(m.id, m.title)} title="Delete">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {matches.length === 0 && (
                <tr><td colSpan={7} style={{textAlign: 'center', padding: '30px', color: 'var(--text-secondary)'}}>No matches found. Create one or sync from API.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* === CONTESTS TAB === */}
      {activeTab === 'contests' && (
        <div>
          <div className="admin-fantasy-actions">
            <button className="af-btn af-btn-primary" onClick={openCreateContest}><Plus size={18}/> Create New Contest</button>
          </div>

          {showContestForm && (
            <div className="af-form-container">
              <h3 style={{marginBottom: '20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                {editingContestId ? 'Edit Contest' : 'Create Contest'}
                <button onClick={() => { setShowContestForm(false); setContestForm(defaultContestForm); }} style={{background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'}}><X size={20}/></button>
              </h3>
              <form onSubmit={saveContest}>
                <div className="af-form-grid">
                  <div className="af-form-group">
                    <label>Select Match</label>
                    <select value={contestForm.match_id} onChange={e => setContestForm({...contestForm, match_id: e.target.value})} required style={{background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', color: 'white', padding: '12px', borderRadius: '8px', fontSize: '1rem'}}>
                      <option value="" disabled>-- Select a Match --</option>
                      {matches.map(m => (
                        <option key={m.id} value={m.id}>{m.short_title || m.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="af-form-group">
                    <label>Contest Name</label>
                    <input type="text" value={contestForm.name} onChange={e => setContestForm({...contestForm, name: e.target.value})} required />
                  </div>
                  <div className="af-form-group">
                    <label>Entry Fee (₹)</label>
                    <input type="number" min="1" value={contestForm.entry_fee} onChange={e => setContestForm({...contestForm, entry_fee: e.target.value})} required />
                  </div>
                  <div className="af-form-group">
                    <label>Prize Pool (₹)</label>
                    <input type="number" min="1" value={contestForm.prize_pool} onChange={e => setContestForm({...contestForm, prize_pool: e.target.value})} required />
                  </div>
                  <div className="af-form-group">
                    <label>Total Spots</label>
                    <input type="number" min="2" value={contestForm.total_spots} onChange={e => setContestForm({...contestForm, total_spots: e.target.value})} required />
                  </div>
                  <div className="af-form-group">
                    <label>Admin Commission (%)</label>
                    <input type="number" min="0" max="100" value={contestForm.admin_commission_pct} onChange={e => setContestForm({...contestForm, admin_commission_pct: e.target.value})} required />
                  </div>
                  <div className="af-form-group">
                    <label>
                      <input type="checkbox" checked={contestForm.is_guaranteed} onChange={e => setContestForm({...contestForm, is_guaranteed: e.target.checked})} style={{marginRight: '8px'}} />
                      Guaranteed Contest
                    </label>
                  </div>
                  <div className="af-form-group">
                    <label>Max Entries Per User</label>
                    <input type="number" min="1" max="6" value={contestForm.max_entries_per_user} onChange={e => setContestForm({...contestForm, max_entries_per_user: e.target.value})} />
                  </div>
                </div>
                <button type="submit" className="af-btn af-btn-primary"><Save size={16}/> {editingContestId ? 'Update Contest' : 'Save Contest'}</button>
              </form>
            </div>
          )}

          <div className="admin-fantasy-table-wrapper">
            <table className="admin-fantasy-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Match</th>
                  <th>Contest</th>
                  <th>Entry Fee</th>
                  <th>Prize Pool</th>
                  <th>Spots</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
            <tbody>
              {contests.map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td style={{fontSize: '0.8rem'}}>{c.match_title?.slice(0, 30)}</td>
                  <td>{c.name}</td>
                  <td>₹{c.entry_fee}</td>
                  <td>₹{c.prize_pool}</td>
                  <td>{c.filled_spots}/{c.total_spots}</td>
                  <td><span className={`af-status-badge af-status-${c.status}`}>{c.status.toUpperCase()}</span></td>
                  <td>
                    <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
                      <button className="af-btn af-btn-secondary" style={{padding: '4px 6px'}} onClick={() => viewContestEntries(c)} title="View Entries"><Eye size={14}/></button>
                      <button className="af-btn af-btn-secondary" style={{padding: '4px 6px'}} onClick={() => openEditContest(c)} title="Edit"><Edit3 size={14}/></button>
                      {c.status === 'open' && (
                        <button className="af-btn af-btn-danger" style={{padding: '4px 6px'}} onClick={() => cancelContest(c.id)} title="Cancel & Refund"><AlertTriangle size={14}/></button>
                      )}
                      <button className="af-btn af-btn-danger" style={{padding: '4px 6px'}} onClick={() => deleteContest(c.id, c.name)} title="Delete"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {contests.length === 0 && (
                <tr><td colSpan={8} style={{textAlign: 'center', padding: '30px', color: 'var(--text-secondary)'}}>No contests found. Create one!</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* === POINTS TAB === */}
      {activeTab === 'points' && (
        <div>
          <div className="af-form-container">
            <h3 style={{marginBottom: '20px', color: 'white'}}>Scoring Rules (Fantasy Point System)</h3>
            <p style={{color: 'var(--text-secondary)', marginBottom: '20px'}}>Configure how many points each cricketing action awards. Click a row to edit.</p>
            <div className="admin-fantasy-table-wrapper">
              <table className="admin-fantasy-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Action</th>
                    <th>Points</th>
                    <th>Format</th>
                    <th>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {pointRules.map(p => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.action_key?.replace(/_/g, ' ')}</td>
                      <td><strong>{p.points > 0 ? '+' : ''}{p.points}</strong></td>
                      <td>{p.format || 'T20'}</td>
                      <td>
                        <button className="af-btn af-btn-secondary" style={{padding: '4px 8px'}} onClick={() => openEditPoint(p)}>
                          <Edit3 size={14}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* === SETTINGS TAB === */}
      {activeTab === 'settings' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <div className="af-form-container">
            <h3 style={{marginBottom: '20px', color: 'white', fontSize: '1.2rem'}}>API Settings</h3>
            <form onSubmit={saveSettings} className="af-form-grid" style={{alignItems: 'end', marginBottom: 0}}>
              <div className="af-form-group" style={{gridColumn: '1 / -1'}}>
                <label>Sports API Key (e.g. CricAPI, SportMonks)</label>
                <div style={{display: 'flex', gap: '8px'}}>
                  <input 
                    type={showApiKey ? 'text' : 'password'} 
                    value={sportsApiKey} 
                    onChange={e => setSportsApiKey(e.target.value)} 
                    placeholder="Enter your API Key here..." 
                    style={{flex: 1}} 
                  />
                  <button type="button" className="af-btn af-btn-secondary" onClick={() => setShowApiKey(!showApiKey)} style={{padding: '8px 12px'}}>
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <small style={{color: 'var(--text-secondary)', marginTop: '4px', display: 'block'}}>
                  API calls are rate-limited to preserve quota. Live scores sync every 2 minutes (not every second).
                </small>
              </div>
              <button type="submit" className="af-btn af-btn-primary" style={{gridColumn: '1 / -1', maxWidth: '200px'}}>Save Settings</button>
            </form>
          </div>
        </div>
      )}

      {/* === MATCH MODAL === */}
      {matchModal.open && (
        <div className="af-modal-overlay" onClick={() => setMatchModal({ open: false })}>
          <div className="af-modal" onClick={e => e.stopPropagation()}>
            <div className="af-modal-header">
              <h3>{matchModal.edit ? 'Edit Match' : 'Create Match'}</h3>
              <button onClick={() => setMatchModal({ open: false })} style={{background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'}}><X size={20}/></button>
            </div>
            <form onSubmit={saveMatch}>
              <div className="af-form-grid">
                <div className="af-form-group">
                  <label>Title</label>
                  <input type="text" value={matchForm.title} onChange={e => setMatchForm({...matchForm, title: e.target.value})} required />
                </div>
                <div className="af-form-group">
                  <label>Short Title</label>
                  <input type="text" value={matchForm.short_title} onChange={e => setMatchForm({...matchForm, short_title: e.target.value})} />
                </div>
                <div className="af-form-group">
                  <label>Format</label>
                  <select value={matchForm.format} onChange={e => setMatchForm({...matchForm, format: e.target.value})} style={{background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', color: 'white', padding: '12px', borderRadius: '8px', fontSize: '1rem'}}>
                    <option value="T20">T20</option>
                    <option value="ODI">ODI</option>
                    <option value="Test">Test</option>
                  </select>
                </div>
                <div className="af-form-group">
                  <label>Team A</label>
                  <input type="text" value={matchForm.team_a} onChange={e => setMatchForm({...matchForm, team_a: e.target.value})} required />
                </div>
                <div className="af-form-group">
                  <label>Team B</label>
                  <input type="text" value={matchForm.team_b} onChange={e => setMatchForm({...matchForm, team_b: e.target.value})} required />
                </div>
                <div className="af-form-group">
                  <label>Team A Logo URL</label>
                  <input type="text" value={matchForm.team_a_logo} onChange={e => setMatchForm({...matchForm, team_a_logo: e.target.value})} />
                </div>
                <div className="af-form-group">
                  <label>Team B Logo URL</label>
                  <input type="text" value={matchForm.team_b_logo} onChange={e => setMatchForm({...matchForm, team_b_logo: e.target.value})} />
                </div>
                <div className="af-form-group">
                  <label>Start Time</label>
                  <input type="datetime-local" value={matchForm.start_time} onChange={e => setMatchForm({...matchForm, start_time: e.target.value})} required />
                </div>
                <div className="af-form-group">
                  <label>Status</label>
                  <select value={matchForm.status} onChange={e => setMatchForm({...matchForm, status: e.target.value})} style={{background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', color: 'white', padding: '12px', borderRadius: '8px', fontSize: '1rem'}}>
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                <button type="submit" className="af-btn af-btn-primary"><Save size={16}/> {matchModal.edit ? 'Update Match' : 'Create Match'}</button>
                <button type="button" className="af-btn af-btn-secondary" onClick={() => setMatchModal({ open: false })}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === ENTRIES MODAL === */}
      {entriesModal.open && (
        <div className="af-modal-overlay" onClick={() => setEntriesModal({ open: false, contest: null, entries: [] })}>
          <div className="af-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '600px'}}>
            <div className="af-modal-header">
              <h3>Contest Entries: {entriesModal.contest?.name}</h3>
              <button onClick={() => setEntriesModal({ open: false, contest: null, entries: [] })} style={{background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'}}><X size={20}/></button>
            </div>
            <table className="admin-fantasy-table" style={{marginTop: '10px'}}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Points</th>
                  <th>Rank</th>
                  <th>Prize</th>
                </tr>
              </thead>
              <tbody>
                {entriesModal.entries.map((e: any, i: number) => (
                  <tr key={e.id}>
                    <td>{i + 1}</td>
                    <td>{e.user_name}</td>
                    <td style={{fontSize: '0.8rem'}}>{e.email}</td>
                    <td>{e.total_points || 0}</td>
                    <td>{e.team_rank || '-'}</td>
                    <td>₹{parseFloat(e.prize_won || 0).toFixed(2)}</td>
                  </tr>
                ))}
                {entriesModal.entries.length === 0 && (
                  <tr><td colSpan={6} style={{textAlign: 'center'}}>No entries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === POINT EDIT MODAL === */}
      {showPointsModal && editingPoint && (
        <div className="af-modal-overlay" onClick={() => { setShowPointsModal(false); setEditingPoint(null); }}>
          <div className="af-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '400px'}}>
            <div className="af-modal-header">
              <h3>Edit Scoring Rule</h3>
              <button onClick={() => { setShowPointsModal(false); setEditingPoint(null); }} style={{background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'}}><X size={20}/></button>
            </div>
            <form onSubmit={savePoint}>
              <div className="af-form-grid" style={{gridTemplateColumns: '1fr'}}>
                <div className="af-form-group">
                  <label>Action</label>
                  <input type="text" value={editingPoint.action_key} onChange={e => setEditingPoint({...editingPoint, action_key: e.target.value})} required />
                </div>
                <div className="af-form-group">
                  <label>Points</label>
                  <input type="number" value={editingPoint.points} onChange={e => setEditingPoint({...editingPoint, points: e.target.value})} required step="0.1" />
                </div>
                <div className="af-form-group">
                  <label>Format</label>
                  <input type="text" value={editingPoint.format || 'T20'} onChange={e => setEditingPoint({...editingPoint, format: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="af-btn af-btn-primary" style={{marginTop: '20px'}}><Save size={16}/> Update Rule</button>
            </form>
          </div>
        </div>
      )}

      {/* Inline styles for modal */}
      <style>{`
        .af-modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 20px;
        }
        .af-modal {
          background: var(--card-bg, #1a1a2e); border: 1px solid var(--border-color, #2a2a4a);
          border-radius: 12px; padding: 24px; max-width: 700px; width: 100%;
          max-height: 80vh; overflow-y: auto;
        }
        .af-modal-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 20px; padding-bottom: 10px;
          border-bottom: 1px solid var(--border-color, #2a2a4a);
        }
        .af-modal-header h3 { color: white; margin: 0; }
      `}</style>
    </div>
  );
};
