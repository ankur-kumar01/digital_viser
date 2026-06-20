import React, { useState, useEffect } from 'react';
import { fantasyAPI } from '../../../api';
import './CricketGame.css';
import { LogOut, RefreshCw, Trophy, Users, Shield, Zap } from 'lucide-react';

export const CricketGame: React.FC<{ user: any, refreshUser: () => void, onNavigate: (view: string) => void }> = ({ user, refreshUser, onNavigate }) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [viewState, setViewState] = useState<'dashboard' | 'match_details' | 'create_team'>('dashboard');
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [squad, setSquad] = useState<any[]>([]);
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Team Creation State
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [teamSelectionPhase, setTeamSelectionPhase] = useState<'pick_players' | 'pick_captain'>('pick_players');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const data = await fantasyAPI.getMatches('upcoming');
      setMatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMatchDetails = async (match: any) => {
    setLoading(true);
    setSelectedMatch(match);
    try {
      const [squadData, contestData] = await Promise.all([
        fantasyAPI.getMatchSquad(match.id),
        fantasyAPI.getMatchContests(match.id)
      ]);
      setSquad(squadData.players);
      setContests(contestData);
      setViewState('match_details');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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

  const submitTeam = async () => {
    if (selectedPlayers.length !== 11) {
      setErrorMsg('You must select exactly 11 players.');
      return;
    }
    if (!captainId || !viceCaptainId) {
      setErrorMsg('You must select a Captain and Vice-Captain.');
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    try {
      await fantasyAPI.createTeam({
        matchId: selectedMatch.id,
        playerIds: selectedPlayers,
        captainId,
        viceCaptainId
      });
      alert('Team created successfully!');
      setViewState('match_details');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const joinContest = async (contestId: number) => {
    // For MVP, we assume user only has 1 team. In a real app, they'd select which team to join with.
    try {
      const myTeams = await fantasyAPI.getMyTeams(selectedMatch.id);
      if (myTeams.length === 0) {
        alert('You need to create a team first!');
        setViewState('create_team');
        return;
      }
      
      await fantasyAPI.joinContest({ contestId, teamId: myTeams[0].id });
      alert('Joined contest successfully!');
      refreshUser();
      loadMatchDetails(selectedMatch); // Refresh contests
    } catch (err: any) {
      alert(err.message || 'Failed to join contest');
    }
  };

  if (loading && matches.length === 0) return <div className="cric-loading"><RefreshCw className="spin" /> Loading Fantasy...</div>;

  return (
    <div className="cric-container fade-in">
      {/* Header */}
      <div className="cric-header">
        <div className="cric-logo">🏏 Fantasy Cricket</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="cric-balance">₹{(user?.balance || 0).toFixed(2)}</div>
          <button className="cric-exit-btn" onClick={() => onNavigate('games')} title="Exit Game">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {viewState === 'dashboard' && (
        <div className="cric-dashboard">
          <h2 className="cric-title">Upcoming Matches</h2>
          <div className="cric-match-list">
            {matches.map(m => (
              <div key={m.id} className="cric-match-card" onClick={() => loadMatchDetails(m)}>
                <div className="cric-match-header">{m.title}</div>
                <div className="cric-match-teams">
                  <div className="cric-team">
                    <img src={m.team_a_logo} alt={m.team_a} />
                    <span>{m.team_a}</span>
                  </div>
                  <div className="cric-vs">VS</div>
                  <div className="cric-team">
                    <img src={m.team_b_logo} alt={m.team_b} />
                    <span>{m.team_b}</span>
                  </div>
                </div>
                <div className="cric-match-footer">
                  <span>Starts: {new Date(m.start_time).toLocaleString()}</span>
                  <button className="cric-btn-primary">View Contests</button>
                </div>
              </div>
            ))}
            {matches.length === 0 && (
              <div className="cric-empty-state">
                <Trophy size={48} />
                <h3>No Matches Available</h3>
                <p>There are no upcoming matches currently. Please check back later.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewState === 'match_details' && selectedMatch && (
        <div className="cric-match-details">
          <div className="cric-back" onClick={() => setViewState('dashboard')}>← Back to Matches</div>
          <h2>{selectedMatch.short_title} Contests</h2>
          
          <div className="cric-action-bar">
            <button className="cric-btn-secondary" onClick={() => {
              setSelectedPlayers([]);
              setCaptainId(null);
              setViceCaptainId(null);
              setTeamSelectionPhase('pick_players');
              setViewState('create_team');
            }}>
              + Create Team
            </button>
          </div>

          <div className="cric-contest-list">
            {contests.map(c => (
              <div key={c.id} className="cric-contest-card">
                <div className="cric-contest-header">
                  <h3>{c.name}</h3>
                  <div className="cric-prize">Prize Pool: ₹{parseFloat(c.prize_pool).toFixed(2)}</div>
                </div>
                <div className="cric-contest-body">
                  <div className="cric-entry">Entry: ₹{parseFloat(c.entry_fee).toFixed(2)}</div>
                  <div className="cric-spots">
                    <div className="cric-spot-bar">
                      <div className="cric-spot-fill" style={{ width: `${(c.filled_spots / c.total_spots) * 100}%` }}></div>
                    </div>
                    <span>{c.total_spots - c.filled_spots} spots left</span>
                  </div>
                </div>
                <div className="cric-contest-footer">
                  <button className="cric-btn-primary" onClick={() => joinContest(c.id)}>Join ₹{parseFloat(c.entry_fee).toFixed(2)}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewState === 'create_team' && selectedMatch && (
        <div className="cric-create-team">
          <div className="cric-back" onClick={() => setViewState('match_details')}>← Cancel</div>
          
          <div className="cric-team-status">
            <div>Players: {selectedPlayers.length}/11</div>
            <div>Credits: {100 - getCreditsUsed()} Left</div>
          </div>

          {errorMsg && <div className="cric-error">{errorMsg}</div>}

          {teamSelectionPhase === 'pick_players' ? (
            <>
              <h3>Select 11 Players</h3>
              <div className="cric-player-list">
                {squad.map(p => {
                  const isSelected = selectedPlayers.includes(p.id);
                  return (
                    <div key={p.id} className={`cric-player-card ${isSelected ? 'selected' : ''}`} onClick={() => handlePlayerToggle(p.id)}>
                      <div className="cric-player-info">
                        <div className="cric-player-name">{p.name}</div>
                        <div className="cric-player-role">{p.role.toUpperCase()} | {p.team_name}</div>
                      </div>
                      <div className="cric-player-credits">{parseFloat(p.credit_value).toFixed(1)} Cr</div>
                    </div>
                  );
                })}
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
              <h3>Choose Captain & Vice Captain</h3>
              <div className="cric-player-list">
                {selectedPlayers.map(id => {
                  const p = squad.find(s => s.id === id);
                  if (!p) return null;
                  return (
                    <div key={p.id} className="cric-cvc-card">
                      <div className="cric-player-info">
                        <div className="cric-player-name">{p.name}</div>
                        <div className="cric-player-role">{p.role.toUpperCase()}</div>
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
              <button className="cric-btn-primary cric-full-btn" onClick={submitTeam}>Save Team</button>
            </>
          )}
        </div>
      )}

    </div>
  );
};
