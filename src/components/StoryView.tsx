/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo, useRef } from 'react';
import { Configuration, ActionsApi } from 'tines-sdk';
import type { Action } from 'tines-sdk';
import { useLogger } from '../context/LogContext';
import NodeInspector from './NodeInspector';

// Phase 11: Safety Classification Engine
type SafetyTier = 'safe' | 'read-only' | 'interactive' | 'mutating';
interface SafetyInfo {
  tier: SafetyTier;
  color: string;
  bgColor: string;
  icon: string;
  label: string;
}

const SAFETY_TIERS: Record<SafetyTier, Omit<SafetyInfo, 'tier'>> = {
  'safe':        { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)',  icon: '🟢', label: 'Non-Mutating' },
  'read-only':   { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', icon: '🔵', label: 'External Read' },
  'interactive': { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', icon: '🟡', label: 'User-Facing' },
  'mutating':    { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)',  icon: '🔴', label: 'External Write' },
};

function classifyAction(action: any): SafetyInfo {
  const type = action.type || '';
  const method = (action.options?.method || '').toLowerCase();

  let tier: SafetyTier;
  if (type === 'Agents::EventTransformationAgent' || type === 'Agents::TriggerAgent') {
    tier = 'safe';
  } else if (type === 'Agents::FormAgent' || type === 'Agents::WebhookAgent' || type === 'Agents::ScheduleAgent') {
    tier = 'interactive';
  } else if (type === 'Agents::HTTPRequestAgent') {
    tier = (method === 'get' || method === 'head' || method === 'options') ? 'read-only' : 'mutating';
  } else if (type === 'Agents::LLMAgent') {
    tier = 'read-only';
  } else if (type === 'Agents::EmailAgent' || type === 'Agents::SendToStoryAgent') {
    tier = 'mutating';
  } else {
    tier = 'mutating'; // Default to highest risk
  }

  return { tier, ...SAFETY_TIERS[tier] };
}

interface StoryViewProps {
  tenant: string;
  apiKey: string;
  storyId: number;
  onBack: () => void;
}

export default function StoryView({ tenant, apiKey, storyId, onBack }: StoryViewProps) {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const { addLog } = useLogger();

  // Create Action State
  const [actionName, setActionName] = useState('');
  const [actionType, setActionType] = useState('Agents::WebhookAgent');
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'canvas' | 'json' | 'safety'>('canvas');
  const [zoom, setZoom] = useState(1);
  const [toolsCollapsed, setToolsCollapsed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [customLabels, setCustomLabels] = useState<Record<number, string>>({});
  const [tierOverrides, setTierOverrides] = useState<Record<number, SafetyTier>>({});

  // Board Comments / Annotations
  interface BoardNote { id: number; x: number; y: number; text: string; color: string; }
  const [notes, setNotes] = useState<BoardNote[]>([]);
  const [nextNoteId, setNextNoteId] = useState(1);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<number | null>(null);
  const [noteDragOffset, setNoteDragOffset] = useState({ x: 0, y: 0 });

  const addNote = () => {
    const containerW = canvasRef.current?.clientWidth || 800;
    const containerH = canvasRef.current?.clientHeight || 600;
    // Place the note in the center of the current viewport
    const cx = (-pan.x + containerW / 2) / zoom;
    const cy = (-pan.y + containerH / 2) / zoom;
    setNotes(prev => [...prev, { id: nextNoteId, x: cx - 90, y: cy - 40, text: 'New note...', color: '#fbbf24' }]);
    setNextNoteId(n => n + 1);
    addLog('INFO', `Added board note #${nextNoteId}`);
  };

  // Resolve safety with overrides applied
  const getEffectiveSafety = (act: any): SafetyInfo => {
    const override = tierOverrides[act.id];
    if (override) return { tier: override, ...SAFETY_TIERS[override] };
    return classifyAction(act);
  };

  // Infinite Canvas & Node Dragging State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [inspectedNode, setInspectedNode] = useState<Action | null>(null);
  
  const [draggedNode, setDraggedNode] = useState<number | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag canvas if not clicking cards or buttons
    if ((e.target as HTMLElement).closest('.nondraggable')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleNodeMouseDown = (e: React.MouseEvent, actionId: number) => {
    // Prevent the canvas from dragging!
    e.stopPropagation();
    // Don't drag if clicking the delete button
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;
    setDraggedNode(actionId);
    setNodeDragOffset({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Note dragging
    if (draggedNoteId !== null) {
      if (e.buttons !== 1) { setDraggedNoteId(null); return; }
      const nx = e.clientX / zoom - noteDragOffset.x;
      const ny = e.clientY / zoom - noteDragOffset.y;
      setNotes(prev => prev.map(n => n.id === draggedNoteId ? { ...n, x: nx, y: ny } : n));
      return;
    }

    if (draggedNode) {
      if (e.buttons !== 1) { handleGlobalMouseUp(); return; }
      const tempActions = [...actions];
      const actIndex = tempActions.findIndex(a => a.id === draggedNode);
      if (actIndex >= 0) {
         const deltaX = e.clientX - nodeDragOffset.x;
         const deltaY = e.clientY - nodeDragOffset.y;
         
         tempActions[actIndex].position = {
            x: (tempActions[actIndex].position?.x || 0) + deltaX,
            y: (tempActions[actIndex].position?.y || 0) + deltaY
         };
         setActions(tempActions);
         setNodeDragOffset({ x: e.clientX, y: e.clientY });
      }
      return;
    }

    if (!isDragging) return;
    if (e.buttons !== 1) { setIsDragging(false); return; }
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const syncNodeCoordinates = async (targetId: number) => {
     const updatedAct = actions.find(a => a.id === targetId);
     if (updatedAct) {
       addLog('NETWORK', `Saving new coordinates for ${updatedAct.name}`);
       try {
         await actionsApi.updateAction({ 
           actionId: updatedAct.id!, 
           actionUpdateRequest: { position: updatedAct.position } 
         });
         addLog('SUCCESS', `Synchronized node matrix to Cloud!`);
       } catch(err: any) {
         addLog('ERROR', 'Failed to update coordinate layout', { error: err.message });
       }
     }
  };

  const handleGlobalMouseUp = () => {
    setIsDragging(false);
    if (draggedNoteId !== null) { setDraggedNoteId(null); }
    if (draggedNode) {
       syncNodeCoordinates(draggedNode);
       setDraggedNode(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setZoom(prev => Math.min(Math.max(prev - e.deltaY * 0.005, 0.1), 2.5));
    } else {
      setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const handleNodeClick = (e: React.MouseEvent, act: Action) => {
    e.stopPropagation();
    setInspectedNode(act);
  };

  const handleDeleteAction = async (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to destruct ${name}?`)) return;
    addLog('NETWORK', `Deleting logic constraint: ${name}`);
    try {
      // Fallback: The derived OpenAPI spec currently lacks a delete proxy, manually route REST request
      await fetch(tenant.startsWith('http') ? `${tenant}/api/v1/actions/${id}` : `https://${tenant}/api/v1/actions/${id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        }
      });
      addLog('SUCCESS', `Removed ${name} from Graph.`);
      fetchActions();
    } catch(err: any) {
      addLog('ERROR', `Failed deletion schema`, { error: err.message });
    }
  };

  const actionsApi = useMemo(() => {
    const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
    const config = new Configuration({ basePath, apiKey });
    return new ActionsApi(config);
  }, [tenant, apiKey]);

  const fetchActions = async () => {
    try {
      setLoading(true);
      const basePath = tenant.startsWith('http') ? tenant : `https://${tenant}`;
      let rawActions = null;

      addLog('NETWORK', `Beginning Environment Waterfall Fetch for Story ${storyId}`);
      
      // Tines dynamically categorizes Actions into three strict isolated environments:
      // BUILD (The Editor), TEST (Legacy editor), and LIVE (Published execution)
      // If we attempt to query the wrong environment, Tines accurately securely returns 0.
      for (const mode of ['BUILD', 'TEST', 'LIVE', undefined]) {
         addLog('NETWORK', `Probing Environment plane: ${mode || 'DEFAULT'}...`);
         
         const url = mode 
            ? `${basePath}/api/v1/actions?story_id=${storyId}&story_mode=${mode}&per_page=500`
            : `${basePath}/api/v1/actions?story_id=${storyId}&per_page=500`;

         const actRes = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
         
         if (actRes.ok) {
            const actData = await actRes.json();
            const extracted = actData.actions || actData.agents || [];
            if (extracted.length > 0) {
                addLog('SUCCESS', `Successfully extracted ${extracted.length} actions from the ${mode || 'DEFAULT'} plane!`);
                rawActions = extracted;
                break;
            }
         }
      }

      if (!rawActions) rawActions = [];

      setActions(rawActions);
      if (rawActions.length === 0) {
         addLog('WARNING', `All environments yielded 0 actions! The Story is genuinely empty or access is fundamentally restricted.`);
      }

    } catch (err: any) {
      addLog('ERROR', 'Failed to fetch actions', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsApi, storyId]);

  // Viewport Auto-Centering: Calculate bounding box center and offset to canvas center
  const recenterCanvas = () => {
    if (actions.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    actions.forEach((a: any) => {
      const ax = a.position?.x || 0;
      const ay = a.position?.y || 0;
      if (ax < minX) minX = ax;
      if (ay < minY) minY = ay;
      if (ax + 240 > maxX) maxX = ax + 240; // node width
      if (ay + 100 > maxY) maxY = ay + 100; // node height
    });
    const graphW = maxX - minX;
    const graphH = maxY - minY;
    const containerW = canvasRef.current?.clientWidth || 800;
    const containerH = canvasRef.current?.clientHeight || 600;
    // Calculate zoom to fit if graph is larger than container
    const fitZoom = Math.min(containerW / (graphW + 100), containerH / (graphH + 100), 1);
    const newZoom = Math.max(fitZoom, 0.15);
    // Center the graph in the container
    const offsetX = (containerW / newZoom - graphW) / 2 - minX;
    const offsetY = (containerH / newZoom - graphH) / 2 - minY;
    setZoom(newZoom);
    setPan({ x: offsetX * newZoom, y: offsetY * newZoom });
    addLog('INFO', `Centered ${actions.length} nodes (zoom: ${Math.round(newZoom*100)}%)`);
  };

  useEffect(() => {
    if (actions.length > 0 && pan.x === 0 && pan.y === 0) {
      // Small delay to ensure canvas ref is mounted
      setTimeout(recenterCanvas, 100);
    }
  }, [actions]);

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionName) return;
    setCreating(true);
    addLog('NETWORK', `Creating new action: ${actionName}`);
    
    try {
      await actionsApi.createAction({
        actionCreateRequest: {
          name: actionName,
          type: actionType as any,
          storyId: storyId,
          position: { x: 0, y: 0 },
          options: {}, // Default empty options schema
        }
      });
      addLog('SUCCESS', `Creation successful for ${actionName}`);
      setActionName('');
      fetchActions(); // Refresh grid
    } catch (err: any) {
      addLog('ERROR', `Action creation failed`, { error: err.message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <button onClick={onBack} className="btn-glass" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
          ← Back to Dashboard
        </button>
        <button 
          onClick={() => (window as any).electronAPI?.openExternal(`https://${tenant.replace('https://', '')}/stories/${storyId}`)} 
          className="btn-primary" 
          style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', background: 'var(--success-color)' }}
        >
          ⭧ Open securely in Cloud
        </button>
      </div>

      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 600 }}>Story Canvas</h1>
        <p style={{ color: 'var(--text-secondary)' }}>ID: {storyId}</p>
      </header>

      {/* Mode Switcher & Recenter */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
        <button onClick={() => setViewMode('canvas')} className={viewMode === 'canvas' ? 'btn-primary' : 'btn-glass'}>
          Visual Canvas
        </button>
        <button onClick={() => setViewMode('safety')} className={viewMode === 'safety' ? 'btn-primary' : 'btn-glass'} style={viewMode === 'safety' ? { background: '#f59e0b' } : {}}>
          ⚠ Safety Map
        </button>
        <button onClick={() => setViewMode('json')} className={viewMode === 'json' ? 'btn-primary' : 'btn-glass'}>
          Raw Context JSON
        </button>
        {(viewMode === 'canvas' || viewMode === 'safety') && actions.length > 0 && (
           <button 
             onClick={recenterCanvas} 
             className="btn-glass" 
             style={{ marginLeft: 'auto', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', border: '1px solid var(--success-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             ⌖ Focus Canvas Over Nodes
           </button>
        )}
      </div>

      {viewMode === 'json' ? (
        <div style={{ overflow: 'auto', maxHeight: '80vh' }}>
          {actions.map((act, i) => {
            const safety = getEffectiveSafety(act);
            const isOverridden = tierOverrides[act.id!] !== undefined;
            return (
              <div key={act.id || i} style={{
                marginBottom: '0.75rem', borderRadius: '8px', overflow: 'hidden',
                border: `1px solid ${safety.color}44`, background: safety.bgColor
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.5rem 1rem', borderBottom: `1px solid ${safety.color}33`,
                  background: `${safety.color}15`
                }}>
                  <span style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem' }}>
                    {act.name || 'Unnamed'}
                  </span>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px',
                    background: safety.bgColor, color: safety.color, fontWeight: 600
                  }}>
                    {isOverridden ? '\ud83d\udd13 ' : ''}{safety.icon} {safety.label}
                  </span>
                </div>
                <pre style={{
                  padding: '0.75rem 1rem', margin: 0,
                  fontSize: '0.8rem', color: '#a5d6ff', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  background: 'rgba(0,0,0,0.3)'
                }}>
                  {JSON.stringify(act, null, 2)}
                </pre>
              </div>
            );
          })}
          {actions.length === 0 && (
            <pre style={{
              background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '12px',
              color: '#a5d6ff', fontSize: '0.85rem', border: '1px solid var(--glass-border)'
            }}>
              []
            </pre>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flex: 1, minHeight: '600px' }}>
          
        {/* Actions Canvas Plane */}
        <div ref={canvasRef}
          style={{ 
            flex: 2, position: 'relative', overflow: 'hidden', 
            background: 'var(--bg-card)', border: '1px solid var(--glass-border)',
            borderRadius: '12px', height: '100%', minHeight: '600px',
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundPosition: `${pan.x}px ${pan.y}px`
          }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleGlobalMouseUp} onMouseLeave={handleGlobalMouseUp}
          onWheel={handleWheel}
        >
          {/* Zoom Overlay HUD */}
          <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000, display: 'flex', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            <button className="btn-glass" onClick={addNote} style={{ padding: '4px 12px', color: '#fbbf24' }} title="Add sticky note">📝 {notes.length > 0 ? notes.length : ''}</button>
            <button className="btn-glass" onClick={() => setZoom(z => Math.max(z - 0.2, 0.1))} style={{ padding: '4px 12px' }}>−</button>
            <button className="btn-glass" onClick={() => setZoom(1)} style={{ padding: '4px 12px', minWidth: '60px' }}>{Math.round(zoom * 100)}%</button>
            <button className="btn-glass" onClick={() => setZoom(z => Math.min(z + 0.2, 2.5))} style={{ padding: '4px 12px' }}>+</button>
          </div>

          <div style={{
            position: 'absolute', width: '100%', height: '100%',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.05s linear'
          }}>
            {/* SVG Connecting Lines Layer */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0 }}>
              {actions?.flatMap(act => {
                if (!act || !Array.isArray(act.sources) || act.sources.length === 0) return [];
                return act.sources.map(sourceId => {
                  const sourceAct = actions.find(a => a?.id === sourceId);
                  if (!sourceAct) return null;
                  
                  const x1 = (sourceAct.position?.x || 0) + 120; 
                  const y1 = (sourceAct.position?.y || 0) + 90; 
                  const x2 = (act.position?.x || 0) + 120;
                  const y2 = (act.position?.y || 0);
                  const yMid = y1 + (y2 - y1) / 2;
                  const path = `M ${x1} ${y1} C ${x1} ${yMid}, ${x2} ${yMid}, ${x2} ${y2}`;

                  // Safety Map: color SVG links by the receiver's safety tier
                  let strokeColor = 'var(--glass-border)';
                  if (viewMode === 'safety') {
                    strokeColor = getEffectiveSafety(act).color;
                  }

                  return (
                    <path 
                      key={`${sourceId}-${act.id}`}
                      d={path}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="3"
                      opacity="0.8"
                    />
                  );
                }).filter(Boolean);
              })}
            </svg>

            {loading && <div style={{ position: 'absolute', top: 20, left: 20, opacity: 0.7 }}>Loading connections...</div>}
            
            {actions?.map(act => {
              if (!act) return null;
              const safety = getEffectiveSafety(act);
              const isOverridden = tierOverrides[act.id!] !== undefined;
              const isTrigger = act.type === 'Agents::WebhookAgent' || act.type === 'Agents::TriggerAgent';
              const isBeingDragged = draggedNode === act.id;
              const isSafetyMode = viewMode === 'safety';
              const displayLabel = customLabels[act.id!] || safety.label;
              
              return (
              <div key={act.id} className="glass-panel nondraggable" 
                onMouseDown={(e) => handleNodeMouseDown(e, act.id!)}
                onClick={(e) => handleNodeClick(e, act)}
                style={{ 
                position: 'absolute',
                left: act.position?.x || 0,
                top: act.position?.y || 0,
                width: '240px', padding: '1.25rem',
                boxShadow: isBeingDragged ? '0 16px 48px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.3)',
                borderTop: `3px solid ${isSafetyMode ? safety.color : (isTrigger ? 'var(--success-color)' : 'var(--accent-color)')}`,
                background: isSafetyMode ? safety.bgColor : undefined,
                cursor: isBeingDragged ? 'grabbing' : 'grab', zIndex: isBeingDragged ? 50 : 10,
                userSelect: 'none', transition: isBeingDragged ? 'none' : 'box-shadow 0.2s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <h4 style={{ fontWeight: 600, color: 'white', margin: 0, pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{act.name || 'Unnamed Action'}</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                    {isSafetyMode ? (
                      <span 
                        style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, letterSpacing: '0.5px', background: safety.bgColor, color: safety.color, cursor: 'pointer', pointerEvents: 'auto', position: 'relative' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Cycle through tiers on click
                          const tiers: SafetyTier[] = ['safe', 'read-only', 'interactive', 'mutating'];
                          const currentIdx = tiers.indexOf(safety.tier);
                          const nextTier = tiers[(currentIdx + 1) % tiers.length];
                          setTierOverrides(prev => ({ ...prev, [act.id!]: nextTier }));
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Right-click to reset to auto
                          setTierOverrides(prev => { const n = {...prev}; delete n[act.id!]; return n; });
                          setCustomLabels(prev => { const n = {...prev}; delete n[act.id!]; return n; });
                        }}
                        title={`Click to cycle tier${isOverridden ? ' • Right-click to reset to auto' : ''}`}
                      >
                        {isOverridden ? '🔓' : ''} {safety.icon} {displayLabel}
                      </span>
                    ) : (
                      isTrigger && <span style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success-color)', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, letterSpacing: '0.5px', pointerEvents: 'none' }}>TRIGGER</span>
                    )}
                    <button onClick={(e) => handleDeleteAction(e, act.id!, act.name!)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem', padding: 0, pointerEvents: 'auto' }} title="Delete Action">×</button>
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: isSafetyMode ? safety.color : (isTrigger ? 'var(--success-color)' : 'var(--accent-hover)'), pointerEvents: 'none' }}>
                  {typeof act.type === 'string' ? act.type.replace('Agents::', '') : 'Unknown Agent'}
                </span>
                {isSafetyMode && act.type === 'Agents::HTTPRequestAgent' && (
                  <div style={{ fontSize: '0.65rem', color: safety.color, marginTop: '0.25rem', opacity: 0.8, pointerEvents: 'none' }}>
                    HTTP {(act as any).options?.method?.toUpperCase() || 'UNKNOWN'} → {(act as any).options?.url?.split('/').slice(0,4).join('/') || 'N/A'}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', pointerEvents: 'none' }}>ID: {act.id}</div>
              </div>
            )})}

            {/* Board Notes / Comments */}
            {notes.map(note => (
              <div
                key={`note-${note.id}`}
                className="nondraggable"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggedNoteId(note.id);
                  setNoteDragOffset({ x: e.clientX / zoom - note.x, y: e.clientY / zoom - note.y });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingNoteId(note.id);
                }}
                style={{
                  position: 'absolute',
                  left: note.x,
                  top: note.y,
                  width: '180px',
                  minHeight: '80px',
                  background: `${note.color}dd`,
                  borderRadius: '4px',
                  padding: '0.75rem',
                  boxShadow: draggedNoteId === note.id ? '0 12px 36px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.3)',
                  cursor: draggedNoteId === note.id ? 'grabbing' : 'grab',
                  zIndex: draggedNoteId === note.id ? 60 : 5,
                  userSelect: 'none',
                  transition: draggedNoteId === note.id ? 'none' : 'box-shadow 0.2s ease',
                  fontFamily: "'Georgia', serif",
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>📌 NOTE</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setNotes(prev => prev.filter(n => n.id !== note.id)); }}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.3)', cursor: 'pointer', fontSize: '1rem', padding: 0, pointerEvents: 'auto', lineHeight: 1 }}
                    title="Delete note"
                  >×</button>
                </div>
                {editingNoteId === note.id ? (
                  <textarea
                    autoFocus
                    value={note.text}
                    onChange={(e) => setNotes(prev => prev.map(n => n.id === note.id ? { ...n, text: e.target.value } : n))}
                    onBlur={() => setEditingNoteId(null)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingNoteId(null); }}
                    style={{ width: '100%', minHeight: '50px', background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.8)', fontSize: '0.8rem', resize: 'vertical', outline: 'none', fontFamily: "'Georgia', serif" }}
                  />
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.8)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {note.text}
                  </div>
                )}
              </div>
            ))};

            {/* Safety Map Legend */}
            {viewMode === 'safety' && (
              <div style={{ position: 'fixed', top: '120px', right: '20px', zIndex: 2000, background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: '200px' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>Safety Classification</h4>
                {(['safe', 'read-only', 'interactive', 'mutating'] as SafetyTier[]).map(tier => {
                  const info = SAFETY_TIERS[tier];
                  const count = actions.filter(a => getEffectiveSafety(a).tier === tier).length;
                  return (
                    <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                      <span>{info.icon}</span>
                      <span style={{ color: info.color, fontWeight: 500, flex: 1 }}>{info.label}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Create Action Drawer — Collapsible */}
        <div className="glass-panel nondraggable" style={{ 
          width: toolsCollapsed ? '40px' : '280px', 
          padding: toolsCollapsed ? '1rem 0.5rem' : '1.5rem', 
          background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)',
          transition: 'width 0.25s ease, padding 0.25s ease',
          overflow: 'hidden', flexShrink: 0, position: 'relative'
        }}>
          <button 
            onClick={() => setToolsCollapsed(c => !c)}
            style={{ position: 'absolute', top: '0.5rem', right: toolsCollapsed ? '0.5rem' : '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem', zIndex: 10 }}
            title={toolsCollapsed ? 'Show tools' : 'Hide tools'}
          >
            {toolsCollapsed ? '◂' : '▸'}
          </button>
          {!toolsCollapsed && (
          <>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 500 }}>Create Action</h3>
          <form onSubmit={handleCreateAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ACTION NAME</label>
              <input required value={actionName} onChange={e => setActionName(e.target.value)} placeholder="e.g. Receive Webhook" style={{ background: 'var(--bg-card)', color: 'white', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '8px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ACTION TYPE</label>
              <select value={actionType} onChange={e => setActionType(e.target.value)} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px', outline: 'none' }}>
                <optgroup label="🟢 Entry Points">
                  <option value="Agents::WebhookAgent">Webhook — Receive inbound data</option>
                  <option value="Agents::FormAgent">Form — Collect user input</option>
                  <option value="Agents::IMAPAgent">IMAP — Monitor email inbox</option>
                </optgroup>
                <optgroup label="🔵 Logic & Transform">
                  <option value="Agents::EventTransformationAgent">Event Transform — Reshape data</option>
                  <option value="Agents::TriggerAgent">Trigger — Conditional branching</option>
                  <option value="Agents::GroupAgent">Group — Batch & aggregate events</option>
                </optgroup>
                <optgroup label="🟡 Communication">
                  <option value="Agents::HTTPRequestAgent">HTTP Request — Make API calls</option>
                  <option value="Agents::EmailAgent">Email — Send email notifications</option>
                  <option value="Agents::LLMAgent">LLM — AI language model</option>
                </optgroup>
                <optgroup label="🔴 Advanced">
                  <option value="Agents::SendToStoryAgent">Send to Story — Chain automations</option>
                </optgroup>
              </select>
            </div>

            <button type="submit" className="btn-primary" disabled={creating} style={{ marginTop: '0.5rem' }}>
              {creating ? 'Building...' : '+ Attach Action'}
            </button>
          </form>

          {/* Quick Templates */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>⚡ Quick Templates</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { name: 'Receive Webhook', type: 'Agents::WebhookAgent', icon: '🌐', desc: 'Inbound HTTP trigger' },
                { name: 'HTTP GET Request', type: 'Agents::HTTPRequestAgent', icon: '📡', desc: 'Fetch external data' },
                { name: 'Slack Notification', type: 'Agents::HTTPRequestAgent', icon: '💬', desc: 'Post to Slack channel' },
                { name: 'Conditional Branch', type: 'Agents::TriggerAgent', icon: '🔀', desc: 'If/then logic split' },
                { name: 'Data Transform', type: 'Agents::EventTransformationAgent', icon: '🔄', desc: 'Reshape event payload' },
                { name: 'LLM Summarize', type: 'Agents::LLMAgent', icon: '🧠', desc: 'AI text generation' },
                { name: 'Send Email Alert', type: 'Agents::EmailAgent', icon: '📧', desc: 'Email notification' },
              ].map(tpl => (
                <button
                  key={tpl.name}
                  className="btn-glass"
                  disabled={creating}
                  onClick={async () => {
                    setCreating(true);
                    addLog('NETWORK', `Creating template: ${tpl.name}`);
                    try {
                      await actionsApi.createAction({ actionCreateRequest: { name: tpl.name, type: tpl.type as any, storyId: storyId, options: {}, position: {} as any } });
                      addLog('SUCCESS', `Template "${tpl.name}" attached!`);
                      fetchActions();
                    } catch (err: any) { addLog('ERROR', `Template failed: ${err.message}`); }
                    setCreating(false);
                  }}
                  style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span style={{ fontSize: '1rem' }}>{tpl.icon}</span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{tpl.name}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{tpl.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          </>
          )}
        </div>
        {inspectedNode && <NodeInspector action={inspectedNode} tenant={tenant} apiKey={apiKey} onClose={() => setInspectedNode(null)} />}
      </div>
      )}
    </div>
  );
}
