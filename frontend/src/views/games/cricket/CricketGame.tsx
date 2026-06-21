import React, { useState, useEffect, useCallback } from 'react';
import { fantasyAPI } from '../../../api';
import './CricketGame.css';
import { LogOut, RefreshCw, Trophy, Users, Shield, Zap, Eye, Info, Trash2, Edit3, List } from 'lucide-react';

type ViewState = 'dashboard' | 'match_details' | 'create_team' | 'leaderboard' | 'my_entries' | 'how_to_play';

export const CricketGame: React.FC<{ user: any, refreshUser: () => void, onNavigate: (view: string) => void }> = ({ user, refreshUser, onNavigate }) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [viewState, setViewState] = useState<ViewState>('dashboard');
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [squad, setSquad] = useState<any[]>([]);
  const [contests, setContests] = useState<any[]>([]);
  const [userTeams, setUserTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [matchFilter, setMatchFilter] = useState<'upcoming' | 'live' | 'completed'>('upcoming');

  // Team Creation State
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [teamSelectionPhase, setTeamSelectionPhase] = useState<'pick_players' | 'pick_captain'>('pick_players');
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedContest, setSelectedContest] = useState<any>(null);

  // Contest join dialog
  const [joinDialog, setJoinDialog] = useState<{ open: boolean; contest: any; teams: any[] }>({ open: false, contest: null, teams: [] });
  const [joinedContestIds, setJoinedContestIds] = useState<Set<number>>(new Set());

  // My entries
  const [myEntries, setMyEntries] = useState<any[]>([]);

  useEffect(() => {
    fetchMatches();
  }, [matchFilter]);

  const fetchMatches = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fantasyAPI.getMatches(matchFilter);
      setMatches(data || []);
    } catch (err: any) {
      setErrorMsg('Failed to load matches. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMatchDetails = async (match: any) => {
    setLoading(true);
    setErrorMsg('');
    setSelectedMatch(match);
    try {
      const [squadData, contestData, teamsData] = await Promise.all([
        fantasyAPI.getMatchSquad(match.id),
        fantasyAPI.getMatchContests(match.id),
        fantasyAPI.getMyTeams(match.id).catch(() => [])
      ]);
      setSquad(squadData.players || []);
      setContests(contestData || []);
      setUserTeams(teamsData || []);

      // Determine which contests user already joined
      const joined = new Set<number>();
      if (teamsData.length > 0) {
        try {
          const entries = await fantasyAPI.getMyEntries();
          entries.forEach((e: any) => {
            if (e.contest_id) joined.add(e.contest_id);
          });
        } catch (_) {}
      }
      setJoinedContestIds(joined);
      setViewState('match_details');
    } catch (err: any) {
      setErrorMsg('Failed to load match details. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshMatchDetails = () => {
    if (selectedMatch) loadMatchDetails(selectedMatch);
  };

  // Team creation
  const resetTeamSelection = () => {
    setSelectedPlayers([]);
    setCaptainId(null);
    setViceCaptainId(null);
    setTeamSelectionPhase('pick_players');
    setEditingTeamId(null);
    setErrorMsg('');
  };

  const handlePlayerToggle = (playerId: number) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId));
    } else {
      if (selectedPlayers.length >= 11) return;
      setSelectedPlayers([...selectedPlayers, playerId]);
    }
  };

  const getCreditsUsed = () => {
    return selectedPlayers.reduce((sum, id) => {
      const p = squad.find(s => s.id === id);
      return sum + (p ? parseFloat(p.credit_value) : 0);
    }, 0);
  };

  const getRoleCounts = () => {
    const counts = { 'wicket-keeper': 0, batsman: 0, 'all-rounder': 0, bowler: 0 };
    selectedPlayers.forEach(id => {
      const p = squad.find(s => s.id === id);
      if (p && counts[p.role] !== undefined) counts[p.role]++;
    });
    return counts;
  };

  const submitTeam = async () => {
    if (selectedPlayers.length !== 11) {
      setErrorMsg('You must select exactly 11 players.');
      return;
    }
    if (!captainId || !viceCaptainId) {
      setErrorMsg('You must select a Captain and Vice-Captain.');
      return;
    }
    if (captainId === viceCaptainId) {
      setErrorMsg('Captain and Vice-Captain must be different players.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      if (editingTeamId) {
        await fantasyAPI.updateTeam(editingTeamId, { captainId, viceCaptainId });
        alert('Team updated successfully!');
      } else {
        await fantasyAPI.createTeam({
          matchId: selectedMatch.id,
          playerIds: selectedPlayers,
          captainId,
          viceCaptainId
        });
        alert('Team created successfully!');
      }
      resetTeamSelection();
      await loadMatchDetails(selectedMatch);
    } catch (err: any) {
      setErrorMsg(err.error || err.message || 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteTeam = async (teamId: number) => {
    if (!window.confirm('Are you sure you want to delete this team?')) return;
    setLoading(true);
    try {
      await fantasyAPI.deleteTeam(teamId);
      alert('Team deleted.');
      await loadMatchDetails(selectedMatch);
    } catch (err: any) {
      alert(err.error || err.message || 'Failed to delete team');
    } finally {
      setLoading(false);
    }
  };

  const openEditTeam = (team: any) => {
    // For editing, we load the team's players and C/VC
    // For simplicity, we just allow C/VC change in current implementation
    // Full re-draft would need another flow
    setEditingTeamId(team.id);
    setCaptainId(team.captain_player_id);
    setViceCaptainId(team.vice_captain_player_id);
    // Load the players this team used
    setSelectedPlayers([]); // Would need team_players fetch
    setTeamSelectionPhase('pick_captain');
    setViewState('create_team');
  };

  // Contest joining
  const openJoinDialog = async (contest: any) => {
    try {
      const teams = await fantasyAPI.getMyTeams(selectedMatch.id);
      if (teams.length === 0) {
        alert('You need to create a team first!');
        setViewState('create_team');
        return;
      }
      setJoinDialog({ open: true, contest, teams });
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to load teams'));
    }
  };

  const joinContest = async (contestId: number, teamId: number) => {
    setLoading(true);
    try {
      await fantasyAPI.joinContest({ contestId, teamId });
      alert('Joined contest successfully!');
      setJoinDialog({ open: false, contest: null, teams: [] });
      refreshUser();
      await loadMatchDetails(selectedMatch);
    } catch (err: any) {
      alert(err.error || err.message || 'Failed to join contest');
    } finally {
      setLoading(false);
    }
  };

  // Leaderboard
  const viewLeaderboard = async (contest: any) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fantasyAPI.getLeaderboard(contest.id);
      setLeaderboard(data || []);
      setSelectedContest(contest);
      setViewState('leaderboard');
    } catch (err: any) {
      setErrorMsg('Failed to load leaderboard.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // My entries
  const loadMyEntries = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fantasyAPI.getMyEntries();
      setMyEntries(data || []);
      setViewState('my_entries');
    } catch (err: any) {
      setErrorMsg('Failed to load your entries.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered squad
  const getFilteredSquad = () => {
    let filtered = squad;
    if (roleFilter !== 'all') {
      filtered = filtered.filter(p => p.role === roleFilter);
    }
    if (teamFilter !== 'all') {
      filtered = filtered.filter(p => p.team_name === teamFilter);
    }
    return filtered;
  };

  const getUniqueRoles = () => ['all', ...new Set(squad.map(p => p.role))];
  const getUniqueTeams = () => ['all', ...new Set(squad.map(p => p.team_name))];

  if (loading && matches.length === 0 && viewState === 'dashboard') {
    return <div className="cric-loading"><RefreshCw className="spin" /> Loading Fantasy...</div>;
  }

  return (
    <div className="cric-container fade-in">
      {/* Header */}
      <div className="cric-header">
        <div className="cric-logo">
          🏏 Fantasy Cricket
          <button className="cric-info-btn" onClick={() => setViewState('how_to_play')} title="How to Play">
            <Info size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="cric-balance">₹{(user?.balance || 0).toFixed(2)}</div>
          <button className="cric-icon-btn" onClick={loadMyEntries} title="My Entries & Winnings">
            <List size={16} />
          </button>
          <button className="cric-exit-btn" onClick={() => onNavigate('games')} title="Exit Game">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Global error */}
      {errorMsg && <div className="cric-error">{errorMsg}</div>}

      {/* ===== DASHBOARD ===== */}
      {viewState === 'dashboard' && (
        <div className="cric-dashboard">
          <div className="cric-dashboard-header">
            <div className="cric-filter-tabs">
              <button className={`cric-filter-tab ${matchFilter === 'upcoming' ? 'active' : ''}`} onClick={() => setMatchFilter('upcoming')}>Upcoming</button>
              <button className={`cric-filter-tab ${matchFilter === 'live' ? 'active' : ''}`} onClick={() => setMatchFilter('live')}>Live</button>
              <button className={`cric-filter-tab ${matchFilter === 'completed' ? 'active' : ''}`} onClick={() => setMatchFilter('completed')}>Completed</button>
            </div>
            <button className="cric-refresh-btn" onClick={fetchMatches} title="Refresh">
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </div>

          <div className="cric-match-list">
            {matches.map((m, index) => (
              <div key={m.id} className="cric-match-card slide-up" style={{ animationDelay: `${index * 0.1}s` }} onClick={() => loadMatchDetails(m)}>
                <div className="cric-match-header">
                  {m.title}
                  <span className={`cric-status-badge cric-status-${m.status}`}>{m.status.toUpperCase()}</span>
                </div>
                <div className="cric-match-teams">
                  <div className="cric-team">
                    <div className="cric-team-logo-wrapper">
                      {m.team_a_logo ? (
                        <>
                          <img src={m.team_a_logo} alt={m.team_a} onError={(e) => { 
                            (e.target as HTMLImageElement).style.display = 'none'; 
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }} />
                          <div className="cric-team-fallback hidden">{m.team_a.substring(0, 2).toUpperCase()}</div>
                        </>
                      ) : (
                        <div className="cric-team-fallback">{m.team_a.substring(0, 2).toUpperCase()}</div>
                      )}
                    </div>
                    <span>{m.team_a}</span>
                  </div>
                  <div className="cric-vs">VS</div>
                  <div className="cric-team">
                    <div className="cric-team-logo-wrapper">
                      {m.team_b_logo ? (
                        <>
                          <img src={m.team_b_logo} alt={m.team_b} onError={(e) => { 
                            (e.target as HTMLImageElement).style.display = 'none'; 
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }} />
                          <div className="cric-team-fallback hidden">{m.team_b.substring(0, 2).toUpperCase()}</div>
                        </>
                      ) : (
                        <div className="cric-team-fallback">{m.team_b.substring(0, 2).toUpperCase()}</div>
                      )}
                    </div>
                    <span>{m.team_b}</span>
                  </div>
                </div>
                <div className="cric-match-footer">
                  <span>
                    {m.status === 'live' ? '🔴 LIVE' : m.status === 'completed' ? `✅ ${m.winning_team || 'Completed'}` : `Starts: ${new Date(m.start_time).toLocaleString()}`}
                  </span>
                  <button className="cric-btn-primary">
                    {m.status === 'completed' ? 'View Results' : 'View Contests'}
                  </button>
                </div>
              </div>
            ))}
            {matches.length === 0 && !loading && (
              <div className="cric-empty-state">
                <Trophy size={48} />
                <h3>No {matchFilter} Matches</h3>
                <p>There are no {matchFilter} matches currently.</p>
              </div>
            )}
            {loading && <div className="cric-loading"><RefreshCw className="spin" /> Loading...</div>}
          </div>
        </div>
      )}

      {/* ===== MATCH DETAILS ===== */}
      {viewState === 'match_details' && selectedMatch && (
        <div className="cric-match-details">
          <div className="cric-back" onClick={() => setViewState('dashboard')}>← Back</div>
          
          <div className="cric-match-hero">
            <h2>{selectedMatch.short_title}</h2>
            <span className={`cric-status-badge cric-status-${selectedMatch.status}`}>{selectedMatch.status.toUpperCase()}</span>
          </div>

          <div className="cric-action-bar">
            <button className="cric-btn-secondary" onClick={() => { resetTeamSelection(); setViewState('create_team'); }}>
              + Create Team
            </button>
            <button className="cric-refresh-btn" onClick={refreshMatchDetails} title="Refresh">
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </div>

          {/* User's teams */}
          {userTeams.length > 0 && (
            <div className="cric-my-teams">
              <h4>My Teams ({userTeams.length})</h4>
              <div className="cric-teams-row">
                {userTeams.map((t: any) => (
                  <div key={t.id} className="cric-team-card-small">
                    <div className="cric-team-card-header">
                      Team #{t.id} — {t.total_points || 0} pts
                      {t.team_rank && <span className="cric-rank-badge">#{t.team_rank}</span>}
                    </div>
                    <div className="cric-team-card-actions">
                      <button className="cric-small-btn" onClick={() => openEditTeam(t)} title="Edit C/VC"><Edit3 size={12}/></button>
                      <button className="cric-small-btn" onClick={() => deleteTeam(t.id)} title="Delete"><Trash2 size={12}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3>Contests ({contests.length})</h3>
          <div className="cric-contest-list">
            {contests.map((c, index) => {
              const isJoined = joinedContestIds.has(c.id);
              return (
                <div key={c.id} className={`cric-contest-card slide-up ${isJoined ? 'joined' : ''}`} style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="cric-contest-header">
                    <h3>{c.name}</h3>
                    <div className="cric-prize">₹{parseFloat(c.prize_pool).toFixed(2)}</div>
                  </div>
                  <div className="cric-contest-body">
                    <div className="cric-entry">Entry: ₹{parseFloat(c.entry_fee).toFixed(2)}</div>
                    <div className="cric-spots">
                      <div className="cric-spot-bar">
                        <div className="cric-spot-fill" style={{ width: `${(c.filled_spots / c.total_spots) * 100}%` }}></div>
                      </div>
                      <span>{c.total_spots - c.filled_spots} spots left</span>
                    </div>
                    {c.is_guaranteed ? <span className="cric-gtd-badge">Guaranteed</span> : null}
                  </div>
                  <div className="cric-contest-footer">
                    <button className="cric-btn-secondary" style={{padding: '6px 10px', fontSize: '0.8rem'}} onClick={() => viewLeaderboard(c)}>
                      <Eye size={14}/> Leaderboard
                    </button>
                    {isJoined ? (
                      <span className="cric-joined-badge">✓ Joined</span>
                    ) : (
                      <button className="cric-btn-primary" onClick={() => openJoinDialog(c)}>
                        Join ₹{parseFloat(c.entry_fee).toFixed(2)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {contests.length === 0 && <p style={{color: 'var(--text-secondary)'}}>No contests available for this match.</p>}
          </div>
        </div>
      )}

      {/* ===== CREATE / EDIT TEAM ===== */}
      {viewState === 'create_team' && selectedMatch && (
        <div className="cric-create-team">
          <div className="cric-back" onClick={() => { resetTeamSelection(); setViewState('match_details'); }}>
            ← Cancel
          </div>
          
          <div className="cric-team-status">
            <div>Players: {selectedPlayers.length}/11</div>
            <div>Credits: {100 - getCreditsUsed()} Left</div>
            {selectedPlayers.length > 0 && (
              <div className="cric-role-breakdown">
                🧤WK:{getRoleCounts()['wicket-keeper']} 🏏BAT:{getRoleCounts()['batsman']} ⚡AR:{getRoleCounts()['all-rounder']} 🎯BWL:{getRoleCounts()['bowler']}
              </div>
            )}
          </div>

          {errorMsg && <div className="cric-error">{errorMsg}</div>}

          {teamSelectionPhase === 'pick_players' ? (
            <>
              <h3>Select 11 Players</h3>
              {/* Filters */}
              <div className="cric-filters">
                <div className="cric-filter-group">
                  <label>Role:</label>
                  <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                    {getUniqueRoles().map(r => (
                      <option key={r} value={r}>{r === 'all' ? 'All' : r}</option>
                    ))}
                  </select>
                </div>
                <div className="cric-filter-group">
                  <label>Team:</label>
                  <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
                    {getUniqueTeams().map(t => (
                      <option key={t} value={t}>{t === 'all' ? 'All' : t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="cric-player-list">
                {getFilteredSquad().map((p, index) => {
                  const isSelected = selectedPlayers.includes(p.id);
                  return (
                    <div key={p.id} className={`cric-player-card slide-up ${isSelected ? 'selected' : ''}`} data-role={p.role} style={{ animationDelay: `${index * 0.05}s` }} onClick={() => handlePlayerToggle(p.id)}>
                      <div className="cric-player-info">
                        <div className="cric-player-name">{p.name}</div>
                        <div className="cric-player-role">{p.role.toUpperCase()} | {p.team_name}</div>
                      </div>
                      <div className="cric-player-credits">{parseFloat(p.credit_value).toFixed(1)} Cr</div>
                    </div>
                  );
                })}
                {getFilteredSquad().length === 0 && (
                  squad.length === 0
                    ? <p style={{color: 'var(--text-secondary)', textAlign: 'center', padding: '30px'}}>
                        Squad data not yet available. Please check back later or ask admin to sync squads.
                      </p>
                    : <p style={{color: 'var(--text-secondary)'}}>No players match current filters</p>
                )}
              </div>
              <button 
                className="cric-btn-primary cric-full-btn" 
                disabled={selectedPlayers.length !== 11 || getCreditsUsed() > 100}
                onClick={() => setTeamSelectionPhase('pick_captain')}
              >
                Next (Choose C & VC)
              </button>
            </>
          ) : (
            <>
              <h3>{editingTeamId ? 'Change' : 'Choose'} Captain & Vice Captain</h3>
              <div className="cric-player-list">
                {selectedPlayers.map((id, index) => {
                  const p = squad.find(s => s.id === id);
                  if (!p) return null;
                  return (
                    <div key={p.id} className="cric-cvc-card slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                      <div className="cric-player-info">
                        <div className="cric-player-name">{p.name}</div>
                        <div className="cric-player-role">{p.role.toUpperCase()} | {p.team_name}</div>
                      </div>
                      <div className="cric-cvc-actions">
                        <button 
                          className={`cric-cvc-btn ${captainId === p.id ? 'active' : ''}`}
                          onClick={() => { setCaptainId(p.id); if (viceCaptainId === p.id) setViceCaptainId(null); }}
                        >
                          C (2x)
                        </button>
                        <button 
                          className={`cric-cvc-btn ${viceCaptainId === p.id ? 'active' : ''}`}
                          onClick={() => { setViceCaptainId(p.id); if (captainId === p.id) setCaptainId(null); }}
                        >
                          VC (1.5x)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="cric-btn-primary cric-full-btn" onClick={submitTeam}>
                {loading ? 'Saving...' : 'Save Team'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== LEADERBOARD ===== */}
      {viewState === 'leaderboard' && selectedContest && (
        <div className="cric-leaderboard">
          <div className="cric-back" onClick={() => setViewState('match_details')}>← Back</div>
          <h2>{selectedContest.name} — Leaderboard</h2>
          <p style={{color: 'var(--text-secondary)', marginBottom: '15px'}}>
            Prize Pool: ₹{parseFloat(selectedContest.prize_pool).toFixed(2)} | 
            Entry: ₹{parseFloat(selectedContest.entry_fee).toFixed(2)}
          </p>

          {loading ? (
            <div className="cric-loading"><RefreshCw className="spin" /> Loading leaderboard...</div>
          ) : (
            <div className="cric-leaderboard-table">
              {leaderboard.map((e: any, i: number) => (
                <div key={e.id} className={`cric-lb-row slide-up ${e.user_id === user?.id ? 'cric-lb-mine' : ''} ${i < 3 ? 'cric-lb-top' : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="cric-lb-rank">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <div className="cric-lb-name">{e.name}{e.user_id === user?.id ? ' (You)' : ''}</div>
                  <div className="cric-lb-pts">{e.total_points || 0} pts</div>
                  <div className="cric-lb-prize">
                    {e.prize_won ? `₹${parseFloat(e.prize_won).toFixed(2)}` : '-'}
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && <p style={{color: 'var(--text-secondary)'}}>No entries yet.</p>}
            </div>
          )}
        </div>
      )}

      {/* ===== MY ENTRIES ===== */}
      {viewState === 'my_entries' && (
        <div className="cric-my-entries">
          <div className="cric-back" onClick={() => setViewState('dashboard')}>← Back</div>
          <h2>My Contest Entries & Winnings</h2>

          {loading ? (
            <div className="cric-loading"><RefreshCw className="spin" /> Loading...</div>
          ) : (
            <div className="cric-entries-list">
              {myEntries.map((e: any) => (
                <div key={e.id} className="cric-entry-card">
                  <div className="cric-entry-match">{e.match_title}</div>
                  <div className="cric-entry-contest">{e.contest_name}</div>
                  <div className="cric-entry-details">
                    <span>Fee: ₹{parseFloat(e.fee_paid || 0).toFixed(2)}</span>
                    <span>Points: {e.total_points || 0}</span>
                    {e.prize_won ? (
                      <span className="cric-entry-won">Won: ₹{parseFloat(e.prize_won).toFixed(2)} 🎉</span>
                    ) : (
                      <span className="cric-entry-pending">Pending</span>
                    )}
                  </div>
                </div>
              ))}
              {myEntries.length === 0 && <p style={{color: 'var(--text-secondary)'}}>You haven't joined any contests yet.</p>}
            </div>
          )}
        </div>
      )}

      {/* ===== HOW TO PLAY ===== */}
      {viewState === 'how_to_play' && (
        <div className="cric-how-to-play">
          <div className="cric-back" onClick={() => setViewState('dashboard')}>← Back</div>
          <h2>How to Play Fantasy Cricket</h2>
          <div className="cric-rules">
            <div className="cric-rule">
              <h4>1. Select a Match</h4>
              <p>Choose an upcoming match from the list.</p>
            </div>
            <div className="cric-rule">
              <h4>2. Create Your Team</h4>
              <p>Pick 11 players within a 100-credit budget. You need 1-4 Wicket-Keepers, 3-6 Batsmen, 1-4 All-Rounders, and 3-6 Bowlers. Max 7 players from one team.</p>
            </div>
            <div className="cric-rule">
              <h4>3. Choose Captain (C) & Vice-Captain (VC)</h4>
              <p>C gets <strong>2x points</strong>, VC gets <strong>1.5x points</strong>. Choose wisely!</p>
            </div>
            <div className="cric-rule">
              <h4>4. Join a Contest</h4>
              <p>Pay the entry fee and join a contest. Compete against other players.</p>
            </div>
            <div className="cric-rule">
              <h4>5. Scoring</h4>
              <p>Points are awarded for runs (+1), boundaries (+1), sixes (+2), wickets (+25), catches (+8), half-century (+8), century (+16). Duck = -2 points.</p>
            </div>
            <div className="cric-rule">
              <h4>6. Win Prizes</h4>
              <p>Top scorers win prize money. The higher your rank, the bigger your prize!</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== JOIN DIALOG ===== */}
      {joinDialog.open && joinDialog.contest && (
        <div className="cric-dialog-overlay" onClick={() => setJoinDialog({ open: false, contest: null, teams: [] })}>
          <div className="cric-dialog" onClick={e => e.stopPropagation()}>
            <h3>Select Team to Join</h3>
            <p style={{color: 'var(--text-secondary)', marginBottom: '15px'}}>
              Contest: {joinDialog.contest.name} — ₹{parseFloat(joinDialog.contest.entry_fee).toFixed(2)}
            </p>
            <div className="cric-team-select-list">
              {joinDialog.teams.map((t: any) => (
                <div key={t.id} className="cric-team-select-card" onClick={() => joinContest(joinDialog.contest.id, t.id)}>
                  <div className="cric-team-select-info">
                    <strong>Team #{t.id}</strong>
                    <span>{t.total_points || 0} pts</span>
                  </div>
                  <button className="cric-btn-primary" style={{padding: '6px 14px', fontSize: '0.85rem'}}>
                    Join with this Team
                  </button>
                </div>
              ))}
            </div>
            <button className="cric-btn-secondary" style={{marginTop: '10px', width: '100%'}} onClick={() => setJoinDialog({ open: false, contest: null, teams: [] })}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        .cric-dialog-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 20px;
        }
        .cric-dialog {
          background: var(--card-bg); border: 1px solid var(--border-color);
          border-radius: 12px; padding: 24px; max-width: 450px; width: 100%;
        }
        .cric-team-select-card {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; margin-bottom: 8px; border-radius: 8px;
          background: rgba(255,255,255,0.05); cursor: pointer; transition: all 0.2s;
        }
        .cric-team-select-card:hover {
          background: rgba(255,255,255,0.1);
        }
        .cric-team-select-info {
          display: flex; gap: 16px; align-items: center;
        }
        .cric-info-btn {
          background: none; border: 1px solid var(--border-color); color: var(--text-secondary);
          border-radius: 50%; width: 24px; height: 24px; display: inline-flex;
          align-items: center; justify-content: center; cursor: pointer;
          margin-left: 8px; vertical-align: middle;
        }
        .cric-info-btn:hover { color: white; border-color: var(--accent-primary); }
        .cric-icon-btn {
          background: rgba(255,255,255,0.1); border: none; color: var(--text-secondary);
          padding: 6px; border-radius: 6px; cursor: pointer;
        }
        .cric-icon-btn:hover { color: white; background: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );
};
