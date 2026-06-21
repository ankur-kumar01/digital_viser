import React, { useState, useEffect } from 'react';
import { adminRequest, adminAPI } from '../../api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Settings, Gamepad2, BarChart3, Trophy, Save, RefreshCw, Trash2, Eye, Edit3, Plus, X, Play, DollarSign, Users } from 'lucide-react';
import './AdminFantasy.css';

export const AdminLudo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'settings' | 'rooms' | 'stats' | 'tournaments'>('settings');
  const [loading, setLoading] = useState(true);

  // Settings
  const [ludoSettings, setLudoSettings] = useState<Record<string, string>>({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  // Rooms
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomDetail, setRoomDetail] = useState<{ room: any; moves: any[] } | null>(null);

  // Stats
  const [stats, setStats] = useState<any>(null);

  // Tournaments
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [tournamentForm, setTournamentForm] = useState<any>(null);
  const [editingTournament, setEditingTournament] = useState<any>(null);
  const [standingsView, setStandingsView] = useState<any>(null);
  const [tFormSaving, setTFormSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'settings') {
        const s = await adminRequest('GET', '/admin/ludo/settings');
        setLudoSettings(s);
      } else if (activeTab === 'rooms') {
        const data = await adminRequest('GET', '/admin/ludo/rooms');
        setRooms(data);
      } else if (activeTab === 'stats') {
        const s = await adminRequest('GET', '/admin/ludo/stats');
        setStats(s);
      } else if (activeTab === 'tournaments') {
        const t = await adminRequest('GET', '/admin/ludo/tournaments');
        setTournaments(t);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: string, value: string) => {
    setLudoSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg('');
    try {
      const result = await adminRequest('PUT', '/admin/ludo/settings', { settings: ludoSettings });
      setLudoSettings(result);
      setSettingsMsg('Settings saved successfully!');
      setTimeout(() => setSettingsMsg(''), 3000);
    } catch (err: any) {
      setSettingsMsg('Error: ' + (err?.error || 'Failed to save'));
    } finally {
      setSettingsSaving(false);
    }
  };

  const viewRoomDetail = async (roomId: number) => {
    try {
      const data = await adminRequest('GET', `/admin/ludo/rooms/${roomId}`);
      setRoomDetail(data);
    } catch (err) {
      alert('Failed to load room details');
    }
  };

  const handleDeleteRoom = async (room: any) => {
    if (!window.confirm(`Cancel room #${room.id}? This will refund both players.`)) return;
    try {
      await adminRequest('DELETE', `/admin/ludo/rooms/${room.id}`);
      fetchData();
    } catch (err: any) {
      alert(err?.error || 'Failed to cancel room');
    }
  };

  // Tournament handlers
  const openCreateTournament = () => {
    setEditingTournament(null);
    setTournamentForm({
      name: '',
      description: '',
      entry_fee: '10',
      prize_pool: '500',
      max_participants: '50',
      num_matches: '5',
      admin_commission: '5',
      start_time: '',
      end_time: '',
    });
  };

  const openEditTournament = (t: any) => {
    setEditingTournament(t);
    setTournamentForm({
      name: t.name,
      description: t.description || '',
      entry_fee: String(parseFloat(t.entry_fee)),
      prize_pool: String(parseFloat(t.prize_pool)),
      max_participants: String(t.max_participants),
      num_matches: String(t.num_matches),
      admin_commission: String(parseFloat(t.admin_commission)),
      start_time: t.start_time ? t.start_time.slice(0, 16) : '',
      end_time: t.end_time ? t.end_time.slice(0, 16) : '',
    });
  };

  const handleSaveTournament = async () => {
    if (!tournamentForm.name || !tournamentForm.start_time || !tournamentForm.end_time) {
      alert('Name, start time, and end time are required');
      return;
    }
    setTFormSaving(true);
    try {
      if (editingTournament) {
        await adminRequest('PUT', `/admin/ludo/tournaments/${editingTournament.id}`, tournamentForm);
        alert('Tournament updated');
      } else {
        await adminRequest('POST', '/admin/ludo/tournaments', tournamentForm);
        alert('Tournament created');
      }
      setTournamentForm(null);
      fetchData();
    } catch (err: any) {
      alert(err?.error || 'Failed to save tournament');
    } finally {
      setTFormSaving(false);
    }
  };

  const handleDeleteTournament = async (t: any) => {
    if (!window.confirm(`Cancel tournament "${t.name}"? All participants will be refunded.`)) return;
    try {
      await adminRequest('DELETE', `/admin/ludo/tournaments/${t.id}`);
      fetchData();
    } catch (err: any) {
      alert(err?.error || 'Failed to cancel tournament');
    }
  };

  const viewStandings = async (t: any) => {
    try {
      const data = await adminRequest('GET', `/admin/ludo/tournaments/${t.id}/standings`);
      setStandingsView(data);
    } catch (err: any) {
      alert(err?.error || 'Failed to fetch standings');
    }
  };

  const handleProcessTournament = async (t: any) => {
    if (!window.confirm(`Finalize tournament "${t.name}" and distribute prizes? This cannot be undone.`)) return;
    try {
      await adminRequest('POST', `/admin/ludo/tournaments/${t.id}/process`);
      alert('Tournament finalized and prizes distributed!');
      fetchData();
    } catch (err: any) {
      alert(err?.error || 'Failed to process tournament');
    }
  };

  const getTournamentStatusBadge = (status: string) => {
    const cls = status === 'active' ? 'af-status-live' : status === 'completed' ? 'af-status-upcoming' : 'af-status-cancelled';
    return <span className={`af-status-badge ${cls}`}>{status}</span>;
  };

  const getStatusBadge = (status: string) => {
    const cls = status === 'playing' ? 'af-status-live' : status === 'completed' ? 'af-status-upcoming' : 'af-status-cancelled';
    return <span className={`af-status-badge ${cls}`}>{status}</span>;
  };

  return (
    <div className="admin-fantasy-container">
      <h2 style={{ marginBottom: '20px' }}><Gamepad2 size={22} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Ludo Management</h2>

      {/* Tabs */}
      <div className="admin-fantasy-tabs">
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
          <Settings size={16} /> Settings
        </button>
        <button className={activeTab === 'rooms' ? 'active' : ''} onClick={() => setActiveTab('rooms')}>
          <Gamepad2 size={16} /> Active Rooms
        </button>
        <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>
          <BarChart3 size={16} /> Statistics
        </button>
        <button className={activeTab === 'tournaments' ? 'active' : ''} onClick={() => setActiveTab('tournaments')}>
          <Trophy size={16} /> Tournaments
        </button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="af-form-container">
              {settingsMsg && (
                <div style={{ padding: '10px 16px', background: settingsMsg.startsWith('Error') ? 'rgba(255,71,87,0.1)' : 'rgba(46,204,113,0.1)', border: `1px solid ${settingsMsg.startsWith('Error') ? '#ff4757' : '#2ecc71'}`, borderRadius: '8px', marginBottom: '16px', color: settingsMsg.startsWith('Error') ? '#ff4757' : '#2ecc71', fontWeight: 600, fontSize: '0.85rem' }}>
                  {settingsMsg}
                </div>
              )}
              <div className="af-form-grid">
                <div className="af-form-group">
                  <label>House Edge (%)</label>
                  <input type="number" step="0.1" min="0" max="100" value={ludoSettings.ludo_house_edge || '5'} onChange={e => handleSettingChange('ludo_house_edge', e.target.value)} />
                  <small>Platform commission deducted from each match pool</small>
                </div>
                <div className="af-form-group">
                  <label>Minimum Wager (₹)</label>
                  <input type="number" min="1" value={ludoSettings.ludo_min_bet || '10'} onChange={e => handleSettingChange('ludo_min_bet', e.target.value)} />
                </div>
                <div className="af-form-group">
                  <label>Maximum Wager (₹)</label>
                  <input type="number" min="1" value={ludoSettings.ludo_max_bet || '5000'} onChange={e => handleSettingChange('ludo_max_bet', e.target.value)} />
                </div>
                <div className="af-form-group">
                  <label>Turn Timeout (ms)</label>
                  <input type="number" min="5000" max="120000" step="1000" value={ludoSettings.ludo_turn_timeout || '16000'} onChange={e => handleSettingChange('ludo_turn_timeout', e.target.value)} />
                  <small>Milliseconds before a turn auto-skips (default: 16000 = 16s)</small>
                </div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <button className="af-btn af-btn-primary" onClick={handleSaveSettings} disabled={settingsSaving}>
                  <Save size={16} /> {settingsSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}

          {/* ROOMS TAB */}
          {activeTab === 'rooms' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button className="af-btn af-btn-secondary" onClick={fetchData}><RefreshCw size={16} /> Refresh</button>
              </div>
              <table className="af-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Host</th>
                    <th>Opponent</th>
                    <th>Wager</th>
                    <th>Status</th>
                    <th>Winner</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No Ludo rooms found</td></tr>
                  ) : rooms.map(room => (
                    <tr key={room.id}>
                      <td>#{room.id}</td>
                      <td><strong>{room.host_name || `User #${room.host_id}`}</strong></td>
                      <td>{room.challenger_name || room.challenger_id ? (room.challenger_name || `User #${room.challenger_id}`) : '-'}</td>
                      <td>₹{parseFloat(room.entry_fee).toFixed(2)}</td>
                      <td>{getStatusBadge(room.status)}</td>
                      <td>{room.winner_name || (room.winner_id === room.host_id ? room.host_name : room.challenger_name) || '-'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(room.created_at).toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="af-btn af-btn-sm af-btn-secondary" onClick={() => viewRoomDetail(room.id)} title="View Details"><Eye size={14} /></button>
                          {(room.status === 'playing' || room.status === 'waiting') && (
                            <button className="af-btn af-btn-sm af-btn-danger" onClick={() => handleDeleteRoom(room)} title="Cancel & Refund"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* STATS TAB */}
          {activeTab === 'stats' && stats && (
            <div className="af-form-container">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div className="af-stat-card">
                  <div className="af-stat-value">{stats.totalRooms ?? 0}</div>
                  <div className="af-stat-label">Total Rooms</div>
                </div>
                <div className="af-stat-card">
                  <div className="af-stat-value" style={{ color: '#2ecc71' }}>{stats.activeRooms ?? 0}</div>
                  <div className="af-stat-label">Active Now</div>
                </div>
                <div className="af-stat-card">
                  <div className="af-stat-value" style={{ color: '#3498db' }}>{stats.completedRooms ?? 0}</div>
                  <div className="af-stat-label">Completed</div>
                </div>
                <div className="af-stat-card">
                  <div className="af-stat-value">₹{parseFloat(stats.totalRevenue || '0').toFixed(2)}</div>
                  <div className="af-stat-label">Total Revenue</div>
                </div>
                <div className="af-stat-card">
                  <div className="af-stat-value">{stats.totalPlayers ?? 0}</div>
                  <div className="af-stat-label">Unique Players</div>
                </div>
              </div>
            </div>
          )}

          {/* TOURNAMENTS TAB */}
          {activeTab === 'tournaments' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button className="af-btn af-btn-primary" onClick={openCreateTournament}><Plus size={16} /> Create Tournament</button>
                <button className="af-btn af-btn-secondary" onClick={fetchData} style={{ marginLeft: '8px' }}><RefreshCw size={16} /> Refresh</button>
              </div>
              <table className="af-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Fee</th>
                    <th>Prize Pool</th>
                    <th>Players</th>
                    <th>Max</th>
                    <th>Status</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No tournaments found</td></tr>
                  ) : tournaments.map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.name}</strong></td>
                      <td>₹{parseFloat(t.entry_fee).toFixed(2)}</td>
                      <td>₹{parseFloat(t.prize_pool).toFixed(2)}</td>
                      <td>{t.participant_count ?? 0}</td>
                      <td>{t.max_participants}</td>
                      <td>{getTournamentStatusBadge(t.status)}</td>
                      <td style={{ fontSize: '0.8rem' }}>{new Date(t.start_time).toLocaleDateString()}</td>
                      <td style={{ fontSize: '0.8rem' }}>{new Date(t.end_time).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {t.status !== 'completed' && (
                            <button className="af-btn af-btn-sm af-btn-secondary" onClick={() => openEditTournament(t)} title="Edit"><Edit3 size={14} /></button>
                          )}
                          <button className="af-btn af-btn-sm af-btn-secondary" onClick={() => viewStandings(t)} title="Standings"><Users size={14} /></button>
                          {t.status === 'active' && (
                            <button className="af-btn af-btn-sm af-btn-primary" onClick={() => handleProcessTournament(t)} title="Finalize & Payout"><DollarSign size={14} /></button>
                          )}
                          {t.status !== 'completed' && (
                            <button className="af-btn af-btn-sm af-btn-danger" onClick={() => handleDeleteTournament(t)} title="Cancel"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {/* Tournament Form Modal */}
      {tournamentForm && (
        <div className="af-modal-overlay" onClick={() => setTournamentForm(null)}>
          <div className="af-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="af-modal-header">
              <h3>{editingTournament ? 'Edit Tournament' : 'Create Tournament'}</h3>
              <button className="af-btn af-btn-sm af-btn-secondary" onClick={() => setTournamentForm(null)}><X size={16} /></button>
            </div>
            <div className="af-modal-body">
              <div className="af-form-grid">
                <div className="af-form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Tournament Name</label>
                  <input type="text" value={tournamentForm.name} onChange={e => setTournamentForm({...tournamentForm, name: e.target.value})} placeholder="e.g. Ludo Grand Slam" />
                </div>
                <div className="af-form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Description</label>
                  <textarea value={tournamentForm.description} onChange={e => setTournamentForm({...tournamentForm, description: e.target.value})} rows={3} placeholder="Optional description" />
                </div>
                <div className="af-form-group">
                  <label>Entry Fee (₹)</label>
                  <input type="number" min="0" step="1" value={tournamentForm.entry_fee} onChange={e => setTournamentForm({...tournamentForm, entry_fee: e.target.value})} />
                </div>
                <div className="af-form-group">
                  <label>Prize Pool (₹)</label>
                  <input type="number" min="0" step="1" value={tournamentForm.prize_pool} onChange={e => setTournamentForm({...tournamentForm, prize_pool: e.target.value})} />
                </div>
                <div className="af-form-group">
                  <label>Max Participants</label>
                  <input type="number" min="2" value={tournamentForm.max_participants} onChange={e => setTournamentForm({...tournamentForm, max_participants: e.target.value})} />
                </div>
                <div className="af-form-group">
                  <label>Matches Per Player</label>
                  <input type="number" min="1" value={tournamentForm.num_matches} onChange={e => setTournamentForm({...tournamentForm, num_matches: e.target.value})} />
                </div>
                <div className="af-form-group">
                  <label>Admin Commission (%)</label>
                  <input type="number" min="0" max="100" step="0.1" value={tournamentForm.admin_commission} onChange={e => setTournamentForm({...tournamentForm, admin_commission: e.target.value})} />
                </div>
                <div className="af-form-group">
                  <label>Start Time</label>
                  <input type="datetime-local" value={tournamentForm.start_time} onChange={e => setTournamentForm({...tournamentForm, start_time: e.target.value})} />
                </div>
                <div className="af-form-group">
                  <label>End Time</label>
                  <input type="datetime-local" value={tournamentForm.end_time} onChange={e => setTournamentForm({...tournamentForm, end_time: e.target.value})} />
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="af-btn af-btn-secondary" onClick={() => setTournamentForm(null)}>Cancel</button>
                <button className="af-btn af-btn-primary" onClick={handleSaveTournament} disabled={tFormSaving}>
                  {tFormSaving ? 'Saving...' : (editingTournament ? 'Update Tournament' : 'Create Tournament')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standings Modal */}
      {standingsView && (
        <div className="af-modal-overlay" onClick={() => setStandingsView(null)}>
          <div className="af-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="af-modal-header">
              <h3>{standingsView.tournament.name} — Standings</h3>
              <button className="af-btn af-btn-sm af-btn-secondary" onClick={() => setStandingsView(null)}><X size={16} /></button>
            </div>
            <div className="af-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div><strong>Status:</strong> {getTournamentStatusBadge(standingsView.tournament.status)}</div>
                <div><strong>Participants:</strong> {standingsView.standings.length}</div>
                <div><strong>Prize Pool:</strong> ₹{parseFloat(standingsView.tournament.prize_pool).toFixed(2)}</div>
                <div><strong>Fee:</strong> ₹{parseFloat(standingsView.tournament.entry_fee).toFixed(2)}</div>
              </div>
              {standingsView.prizes?.length > 0 && (
                <>
                  <h4 style={{ marginBottom: '8px' }}>Prize Brackets</h4>
                  <table className="af-table" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                    <thead>
                      <tr>
                        <th>Rank From</th>
                        <th>Rank To</th>
                        <th>% of Pool</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standingsView.prizes.map((p: any, i: number) => (
                        <tr key={i}>
                          <td>#{p.rank_from}</td>
                          <td>#{p.rank_to}</td>
                          <td>{parseFloat(p.prize_percentage).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <h4 style={{ marginBottom: '8px' }}>Player Standings</h4>
              <table className="af-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Score</th>
                    <th>Matches</th>
                    <th>Prize</th>
                    <th>Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {standingsView.standings.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>No participants yet</td></tr>
                  ) : standingsView.standings.map((p: any, i: number) => (
                    <tr key={p.id || i}>
                      <td>{i + 1}</td>
                      <td>{p.user_name || `User #${p.user_id}`}</td>
                      <td><strong>{p.total_score}</strong></td>
                      <td>{p.matches_played}</td>
                      <td>{parseFloat(p.prize_amount || '0').toFixed(2) > '0.00' ? `₹${parseFloat(p.prize_amount).toFixed(2)}` : '-'}</td>
                      <td>{p.rank ? `#${p.rank}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Room Detail Modal */}
      {roomDetail && (
        <div className="af-modal-overlay" onClick={() => setRoomDetail(null)}>
          <div className="af-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="af-modal-header">
              <h3>Room #{roomDetail.room.id} Details</h3>
              <button className="af-btn af-btn-sm af-btn-secondary" onClick={() => setRoomDetail(null)}><X size={16} /></button>
            </div>
            <div className="af-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div><strong>Host:</strong> {roomDetail.room.host_name || `User #${roomDetail.room.host_id}`}</div>
                <div><strong>Challenger:</strong> {roomDetail.room.challenger_name || (roomDetail.room.challenger_id ? `User #${roomDetail.room.challenger_id}` : '-')}</div>
                <div><strong>Wager:</strong> ₹{parseFloat(roomDetail.room.entry_fee).toFixed(2)}</div>
                <div><strong>Status:</strong> {getStatusBadge(roomDetail.room.status)}</div>
                <div><strong>Winner:</strong> {roomDetail.room.winner_name || '-'}</div>
                <div><strong>Created:</strong> {new Date(roomDetail.room.created_at).toLocaleString()}</div>
              </div>
              <h4 style={{ marginBottom: '8px' }}>Move History ({roomDetail.moves?.length || 0})</h4>
              {roomDetail.moves?.length > 0 ? (
                <table className="af-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Piece</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Dice</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomDetail.moves.map((move: any, i: number) => (
                      <tr key={move.id || i}>
                        <td>#{move.user_id}</td>
                        <td>{move.piece_index}</td>
                        <td>{move.from_pos}</td>
                        <td>{move.to_pos}</td>
                        <td>{move.dice_value}</td>
                        <td style={{ fontSize: '0.75rem' }}>{new Date(move.created_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>No moves recorded</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
