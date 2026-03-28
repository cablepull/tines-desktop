/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo } from 'react';
import { Configuration, ActionsApi } from 'tines-sdk';
import type { Action } from 'tines-sdk';
import { useLogger } from '../context/LogContext';
import NodeInspector from './NodeInspector';

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
  const [viewMode, setViewMode] = useState<'canvas' | 'json'>('canvas');

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
    if (draggedNode) {
       syncNodeCoordinates(draggedNode);
       // If mouse didn't move far from start offset, treat it as a click
       setDraggedNode(null);
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
      addLog('NETWORK', `Fetching actions for Story ${storyId}`);
      const res: any = await actionsApi.listActions({ storyId, perPage: 50 });
      const rawActions = res.actions ? res.actions : (Array.isArray(res) ? res : []);
      setActions(rawActions);
      addLog('SUCCESS', `Loaded ${rawActions.length} actions in Story ${storyId}`);
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

      {/* Mode Switcher */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => setViewMode('canvas')} className={viewMode === 'canvas' ? 'btn-primary' : 'btn-glass'}>
          Visual Canvas
        </button>
        <button onClick={() => setViewMode('json')} className={viewMode === 'json' ? 'btn-primary' : 'btn-glass'}>
          Raw Context JSON
        </button>
      </div>

      {viewMode === 'json' ? (
        <pre style={{
          background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '12px',
          overflow: 'auto', maxHeight: '500px',
          color: '#a5d6ff', fontSize: '0.85rem', border: '1px solid var(--glass-border)'
        }}>
          {JSON.stringify(actions, null, 2)}
        </pre>
      ) : (
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flex: 1, minHeight: '600px' }}>
          
        {/* Actions Canvas Plane */}
        <div 
          style={{ 
            flex: 2, position: 'relative', overflow: 'hidden', 
            background: 'var(--bg-card)', border: '1px solid var(--glass-border)',
            borderRadius: '12px', height: '100%', minHeight: '600px',
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundSize: '20px 20px',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundPosition: `${pan.x}px ${pan.y}px`
          }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleGlobalMouseUp} onMouseLeave={handleGlobalMouseUp}
        >
          <div style={{
            position: 'absolute', width: '100%', height: '100%',
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transition: isDragging ? 'none' : 'transform 0.05s linear'
          }}>
            {/* SVG Connecting Lines Layer */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0 }}>
              {actions.flatMap(act => {
                if (!act.sources || act.sources.length === 0) return [];
                return act.sources.map(sourceId => {
                  const sourceAct = actions.find(a => a.id === sourceId);
                  if (!sourceAct) return null;
                  
                  // Math algorithms anchoring line to the center-bottom of origin, and center-top of receiver
                  const x1 = (sourceAct.position?.x || 0) + 120; 
                  const y1 = (sourceAct.position?.y || 0) + 90; 
                  const x2 = (act.position?.x || 0) + 120;
                  const y2 = (act.position?.y || 0);

                  // Cubic Bezier calculations
                  const yMid = y1 + (y2 - y1) / 2;
                  const path = `M ${x1} ${y1} C ${x1} ${yMid}, ${x2} ${yMid}, ${x2} ${y2}`;

                  return (
                    <path 
                      key={`${sourceId}-${act.id}`}
                      d={path}
                      fill="none"
                      stroke="var(--glass-border)"
                      strokeWidth="3"
                      opacity="0.8"
                    />
                  );
                }).filter(Boolean);
              })}
            </svg>

            {loading && <div style={{ position: 'absolute', top: 20, left: 20, opacity: 0.7 }}>Loading connections...</div>}
            
            {actions.map(act => {
              const isTrigger = act.type === 'Agents::WebhookAgent' || act.type === 'Agents::TriggerAgent';
              const isBeingDragged = draggedNode === act.id;
              
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
                borderTop: `3px solid ${isTrigger ? 'var(--success-color)' : 'var(--accent-color)'}`, 
                cursor: isBeingDragged ? 'grabbing' : 'grab', zIndex: isBeingDragged ? 50 : 10,
                userSelect: 'none', transition: isBeingDragged ? 'none' : 'box-shadow 0.2s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <h4 style={{ fontWeight: 600, color: 'white', margin: 0, pointerEvents: 'none' }}>{act.name}</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {isTrigger && <span style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success-color)', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, letterSpacing: '0.5px', pointerEvents: 'none' }}>TRIGGER</span>}
                    <button onClick={(e) => handleDeleteAction(e, act.id!, act.name!)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem', padding: 0, pointerEvents: 'auto' }} title="Delete Action">×</button>
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: isTrigger ? 'var(--success-color)' : 'var(--accent-hover)', pointerEvents: 'none' }}>{act.type ? act.type.replace('Agents::', '') : 'Unknown Agent'}</span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', pointerEvents: 'none' }}>ID: {act.id}</div>
              </div>
            )})}
          </div>
        </div>

        {/* Create Action Drawer */}
        <div className="glass-panel nondraggable" style={{ flex: 1, padding: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 500 }}>Create Action</h3>
          <form onSubmit={handleCreateAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ACTION NAME</label>
              <input required value={actionName} onChange={e => setActionName(e.target.value)} placeholder="e.g. Receive Webhook" style={{ background: 'var(--bg-card)', color: 'white', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '8px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ACTION TYPE</label>
              <select value={actionType} onChange={e => setActionType(e.target.value)} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px', outline: 'none' }}>
                <option value="Agents::WebhookAgent">Webhook Agent</option>
                <option value="Agents::EventTransformationAgent">Event Transformation</option>
                <option value="Agents::HttpRequestAgent">HTTP Request</option>
              </select>
            </div>

            <button type="submit" className="btn-primary" disabled={creating} style={{ marginTop: '0.5rem' }}>
              {creating ? 'Building...' : '+ Attach Action'}
            </button>
          </form>
        </div>
        {inspectedNode && <NodeInspector action={inspectedNode} tenant={tenant} apiKey={apiKey} onClose={() => setInspectedNode(null)} />}
      </div>
      )}
    </div>
  );
}
